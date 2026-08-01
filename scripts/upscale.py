#!/usr/bin/env python3
"""
AI upscaling for the archive's images.

Two families of model are wired up here because they do genuinely different things, and
the difference matters for an archive of real people:

* **Reconstructive** (EDSR, LapSRN) — CNNs trained to invert a known downsampling. They
  sharpen edges and suppress resampling artefacts. They do not invent structure that has
  no support in the input, so a face stays the face that was photographed.

* **Generative** (Real-ESRGAN) — a GAN. It *synthesises* plausible high-frequency detail:
  pores, hair strands, fabric weave. On a 105px headshot of a real person a meaningful
  share of the output face is invented rather than recovered. It usually looks better.

Neither is "the truth". Whichever is used, `scripts/audit-images.mjs` requires the
manifest to record it, and the interface labels the result — an upscaled portrait is a
reconstruction, not an archival photograph.

Usage:
    python3 scripts/upscale.py --demo            # comparison sheets for approval
    python3 scripts/upscale.py --model esrgan    # run the whole set
"""

from __future__ import annotations

import argparse
import functools
import os

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR_DIR = os.path.join(ROOT, ".cache/sr")


# ---------------------------------------------------------------------------
# Real-ESRGAN (RRDBNet). Architecture written out rather than pulled from basicsr,
# which drags in a large dependency tree for one class.
# ---------------------------------------------------------------------------
def _build_rrdbnet():
    import torch
    from torch import nn

    class ResidualDenseBlock(nn.Module):
        def __init__(self, nf=64, gc=32):
            super().__init__()
            self.conv1 = nn.Conv2d(nf, gc, 3, 1, 1)
            self.conv2 = nn.Conv2d(nf + gc, gc, 3, 1, 1)
            self.conv3 = nn.Conv2d(nf + 2 * gc, gc, 3, 1, 1)
            self.conv4 = nn.Conv2d(nf + 3 * gc, gc, 3, 1, 1)
            self.conv5 = nn.Conv2d(nf + 4 * gc, nf, 3, 1, 1)
            self.lrelu = nn.LeakyReLU(0.2, inplace=True)

        def forward(self, x):
            x1 = self.lrelu(self.conv1(x))
            x2 = self.lrelu(self.conv2(torch.cat((x, x1), 1)))
            x3 = self.lrelu(self.conv3(torch.cat((x, x1, x2), 1)))
            x4 = self.lrelu(self.conv4(torch.cat((x, x1, x2, x3), 1)))
            x5 = self.conv5(torch.cat((x, x1, x2, x3, x4), 1))
            return x5 * 0.2 + x

    class RRDB(nn.Module):
        def __init__(self, nf, gc=32):
            super().__init__()
            self.rdb1, self.rdb2, self.rdb3 = (ResidualDenseBlock(nf, gc) for _ in range(3))

        def forward(self, x):
            out = self.rdb3(self.rdb2(self.rdb1(x)))
            return out * 0.2 + x

    class RRDBNet(nn.Module):
        def __init__(self, in_ch=3, out_ch=3, nf=64, nb=23, gc=32, scale=4):
            super().__init__()
            self.scale = scale
            self.conv_first = nn.Conv2d(in_ch, nf, 3, 1, 1)
            self.body = nn.Sequential(*[RRDB(nf, gc) for _ in range(nb)])
            self.conv_body = nn.Conv2d(nf, nf, 3, 1, 1)
            self.conv_up1 = nn.Conv2d(nf, nf, 3, 1, 1)
            self.conv_up2 = nn.Conv2d(nf, nf, 3, 1, 1)
            self.conv_hr = nn.Conv2d(nf, nf, 3, 1, 1)
            self.conv_last = nn.Conv2d(nf, out_ch, 3, 1, 1)
            self.lrelu = nn.LeakyReLU(0.2, inplace=True)

        def forward(self, x):
            feat = self.conv_first(x)
            feat = feat + self.conv_body(self.body(feat))
            feat = self.lrelu(self.conv_up1(nn.functional.interpolate(feat, scale_factor=2, mode="nearest")))
            feat = self.lrelu(self.conv_up2(nn.functional.interpolate(feat, scale_factor=2, mode="nearest")))
            return self.conv_last(self.lrelu(self.conv_hr(feat)))

    return RRDBNet


@functools.lru_cache(maxsize=1)
def _esrgan():
    import torch

    net = _build_rrdbnet()()
    blob = torch.load(os.path.join(SR_DIR, "realesrgan_x4plus.pth"), map_location="cpu",
                      weights_only=True)
    for key in ("params_ema", "params", "state_dict"):
        if isinstance(blob, dict) and key in blob:
            blob = blob[key]
            break
    net.load_state_dict(blob, strict=True)
    net.eval()
    # Respect OMP_NUM_THREADS when it is set. Several of these run in parallel to shard the
    # work, and unconditionally claiming most of the cores in each process oversubscribes
    # the box — four processes at three threads each on four cores spends its time in the
    # scheduler rather than in the convolutions.
    requested = os.environ.get("OMP_NUM_THREADS")
    torch.set_num_threads(
        int(requested) if requested and requested.isdigit() and int(requested) > 0
        else max(1, (os.cpu_count() or 4) - 1)
    )
    return net


# Tiling exists only to bound peak memory on the large team photographs. It is not free:
# every tile re-computes its overlap margin, so tiling a small image is pure waste. Below
# TILE_THRESHOLD pixels the image goes through whole.
TILE = 400
TILE_OVERLAP = 32       # 23 RRDB blocks have a wide receptive field; 16px still seamed
TILE_THRESHOLD = 400 * 400


def _esrgan_whole(net, rgb: np.ndarray) -> np.ndarray:
    import torch

    t = torch.from_numpy(np.ascontiguousarray(rgb)).permute(2, 0, 1).unsqueeze(0)
    with torch.no_grad():
        return net(t).squeeze(0).permute(1, 2, 0).clamp(0, 1).numpy()


def esrgan_x4(bgr: np.ndarray) -> np.ndarray:
    """
    Real-ESRGAN ×4, tiled when the input is large enough to need it.

    A 1500×993 team photograph expands to 6000×3972, and the intermediate activations at
    64 channels run to several GB if it goes through in one piece. Tiles overlap by
    TILE_OVERLAP and the margin is discarded after upscaling, so the join carries the same
    context an untiled run would have had and no seam appears.
    """
    net = _esrgan()
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    H, W = rgb.shape[:2]

    if H * W <= TILE_THRESHOLD:
        out = _esrgan_whole(net, rgb)
    else:
        # Accumulate tiles weighted by a margin that ramps to zero at the tile edge, then
        # normalise. A hard cut turns any residual mismatch between neighbouring tiles into
        # a straight line — the one artefact the eye finds instantly. Cross-fading spreads
        # the same error over the overlap, where it is invisible.
        acc = np.zeros((H * 4, W * 4, 3), dtype=np.float32)
        wsum = np.zeros((H * 4, W * 4, 1), dtype=np.float32)
        for y in range(0, H, TILE):
            for x in range(0, W, TILE):
                x0, y0 = max(0, x - TILE_OVERLAP), max(0, y - TILE_OVERLAP)
                x1, y1 = min(W, x + TILE + TILE_OVERLAP), min(H, y + TILE + TILE_OVERLAP)
                up = _esrgan_whole(net, rgb[y0:y1, x0:x1])
                th, tw = up.shape[:2]

                def ramp(length: int, lead: bool, trail: bool) -> np.ndarray:
                    """1.0 across the tile, ramping to ~0 on any edge that has a neighbour."""
                    w = np.ones(length, dtype=np.float32)
                    n = min(TILE_OVERLAP * 4, length // 2)
                    if n > 0:
                        edge = np.linspace(0.0, 1.0, n + 2, dtype=np.float32)[1:-1]
                        if lead:
                            w[:n] = edge
                        if trail:
                            w[-n:] = edge[::-1]
                    return w

                wy = ramp(th, y0 > 0, y1 < H)
                wx = ramp(tw, x0 > 0, x1 < W)
                weight = (wy[:, None] * wx[None, :])[:, :, None]
                acc[y0 * 4:y1 * 4, x0 * 4:x1 * 4] += up * weight
                wsum[y0 * 4:y1 * 4, x0 * 4:x1 * 4] += weight
        out = acc / np.maximum(wsum, 1e-6)

    return cv2.cvtColor((np.clip(out, 0, 1) * 255).round().astype(np.uint8), cv2.COLOR_RGB2BGR)


@functools.lru_cache(maxsize=4)
def _dnn(name: str, scale: int):
    sr = cv2.dnn_superres.DnnSuperResImpl.create()
    sr.readModel(os.path.join(SR_DIR, f"{name}_x{scale}.pb"))
    sr.setModel(name.lower(), scale)
    return sr


def dnn_x4(bgr: np.ndarray, name: str) -> np.ndarray:
    return _dnn(name, 4).upsample(bgr)


def bicubic_x4(bgr: np.ndarray) -> np.ndarray:
    h, w = bgr.shape[:2]
    return cv2.resize(bgr, (w * 4, h * 4), interpolation=cv2.INTER_CUBIC)


MODELS = {
    "bicubic": ("Bicubic (no AI — baseline)", bicubic_x4),
    "fsrcnn": ("FSRCNN ×4 (fast CNN)", lambda b: dnn_x4(b, "FSRCNN")),
    "lapsrn": ("LapSRN ×4 (CNN)", lambda b: dnn_x4(b, "LapSRN")),
    "edsr": ("EDSR ×4 (CNN, reconstructive)", lambda b: dnn_x4(b, "EDSR")),
    "esrgan": ("Real-ESRGAN ×4 (GAN, generative)", esrgan_x4),
}


def upscale(path: str, model: str) -> Image.Image:
    bgr = cv2.imread(path, cv2.IMREAD_COLOR)
    if bgr is None:
        bgr = np.array(Image.open(path).convert("RGB"))[:, :, ::-1]
    out = MODELS[model][1](np.ascontiguousarray(bgr))
    return Image.fromarray(cv2.cvtColor(out, cv2.COLOR_BGR2RGB))
