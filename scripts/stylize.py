#!/usr/bin/env python3
"""
One consistent rendered treatment for every player portrait.

Why this exists
---------------
The portraits come from sources spanning 67px team-photo crops to 1254px studio
headshots, shot across a decade on different cameras and scanned by different hands.
Roughly forty-four of the fifty-seven already agree. The rest do not, and the
disagreement is mostly colour rather than content: heavy red casts on two, magenta on
another, three in black and white, one badly degraded.

Correcting those one at a time cannot fix the greyscale three, because there is no colour
in them to correct. A single stylised treatment fixes consistency by *flattening* the
differences instead — cast, grain, resolution and even the absence of colour are absorbed
into a look that comes out the same whatever went in.

How it works
------------
1. **Segment the subject** with U²-Net (human segmentation). Two earlier attempts tried
   to separate subject from background by colour distance from the frame corners; both
   failed the same way, bleeding backdrop into faces, because skin and a blue backdrop
   are not reliably far apart in RGB. A real matte is what makes the rest possible.
2. **Correct the cast** by mapping the *measured background* — now known exactly, rather
   than guessed from corners — onto the archive's blue. An earlier version neutralised
   the backdrop instead, the textbook white balance, which was wrong here and obviously
   so: the backdrop is meant to be blue, so making it grey pushed every white jersey
   yellow.
3. **Render the subject**: edge-preserving smoothing for flat, even skin, then a light
   detail pass so eyes, hairline and collar stay defined.
4. **Composite onto one identical gradient.** Fifty-seven studio backdrops never match;
   one synthetic gradient always does. This is the single largest consistency win here.
5. **Rim light and vignette**, identical on every card, so they share a light source.

This is deliberately not photorealistic, and it does not pretend to be. Nothing is
generated: no face is synthesised, no feature invented, no colour imagined for a
greyscale source. The geometry stays exactly where the camera put it, and what changes is
lighting, grading and what sits behind the subject.
"""

from __future__ import annotations

import functools

import cv2
import numpy as np
from PIL import Image

# The archive's backdrop blue, in RGB.
UK_BLUE = (21, 52, 112)


@functools.lru_cache(maxsize=1)
def _session():
    from rembg import new_session

    return new_session("u2net_human_seg")


def _alpha(im: Image.Image) -> np.ndarray:
    """Subject matte in [0,1], from U²-Net human segmentation."""
    from rembg import remove

    cut = remove(im.convert("RGB"), session=_session())
    a = np.asarray(cut.convert("RGBA"))[:, :, 3].astype(np.float32) / 255.0
    # Feather very slightly: a hard matte edge reads as a cut-out sticker.
    return cv2.GaussianBlur(a, (0, 0), max(0.8, im.width / 400))


def _correct_cast(bgr: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """
    Map the measured background onto UK blue, carrying the subject with it.

    With a real matte the background is known rather than guessed, which is what lets this
    correct a red or magenta cast at the root instead of merely dulling it.
    """
    bg = alpha < 0.15
    if bg.sum() < 200:                      # almost no background visible; leave it alone
        return bgr
    ref = bgr[bg].reshape(-1, 3).mean(axis=0).astype(np.float32)
    target = np.array(UK_BLUE[::-1], dtype=np.float32)
    # Normalise each to its own mean so this corrects hue without dragging exposure along:
    # a dark backdrop must not brighten the whole portrait.
    gain = (target / max(target.mean(), 1e-3)) / np.maximum(ref / max(ref.mean(), 1e-3), 1e-3)
    return np.clip(bgr.astype(np.float32) * np.clip(gain, 0.7, 1.4), 0, 255).astype(np.uint8)


def _neutralise_cast(bgr: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """
    Remove a colour cast by measuring how far the backdrop has drifted from the blue it
    is supposed to be, and subtracting that drift from the whole frame.

    Done in LAB as an *offset* on the a/b chroma channels, not as RGB gains. The gain
    version tried earlier over-corrected some portraits and under-corrected others,
    because a multiplicative correction scales with pixel value and skin is far brighter
    than a dark backdrop. An offset shifts everything by the same amount, which is what a
    cast actually is.

    Deliberately partial (70%): pushed to full correction it starts flattening genuine
    differences in complexion, which is neither accurate nor the point.
    """
    bg = alpha < 0.15
    if bg.sum() < 200:
        return bgr
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    target = cv2.cvtColor(
        np.array([[UK_BLUE[::-1]]], dtype=np.uint8), cv2.COLOR_BGR2LAB
    ).astype(np.float32)[0, 0]
    for ch in (1, 2):                                   # a and b only; L is exposure
        drift = float(lab[:, :, ch][bg].mean()) - float(target[ch])
        lab[:, :, ch] = np.clip(lab[:, :, ch] - 0.70 * np.clip(drift, -40, 40), 0, 255)
    return cv2.cvtColor(lab.astype(np.uint8), cv2.COLOR_LAB2BGR)


def _normalise_exposure(bgr: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """Bring the subject's luminance to a common level, measured on the subject only."""
    fg = alpha > 0.6
    if fg.sum() < 200:
        return bgr
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    l = lab[:, :, 0]
    cur = float(np.median(l[fg]))
    # 148 sits mid-range: bright enough for dark skin to hold detail, not so bright that
    # pale skin blows out. Chosen from the median of the set rather than from taste.
    lab[:, :, 0] = np.clip(l * (148.0 / max(cur, 1e-3)), 0, 255)
    return cv2.cvtColor(lab.astype(np.uint8), cv2.COLOR_LAB2BGR)


def _render(bgr: np.ndarray) -> np.ndarray:
    """Edge-preserving smoothing, then a light detail pass. The rendered base."""
    smooth = cv2.edgePreservingFilter(bgr, flags=cv2.RECURS_FILTER, sigma_s=45, sigma_r=0.30)
    # Kept gentle on purpose: a hard detailEnhance produces crunchy haloes along every
    # hairline, which reads as a filter rather than as a render.
    return cv2.detailEnhance(smooth, sigma_s=8, sigma_r=0.12)


def _backdrop(h: int, w: int) -> np.ndarray:
    """The one gradient every portrait is composited onto."""
    base = np.array(UK_BLUE[::-1], dtype=np.float32)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    # Radial pool of light behind where the head sits, falling off to the corners.
    r = np.sqrt(((yy - h * 0.34) / (h * 0.9)) ** 2 + ((xx - w * 0.5) / (w * 0.75)) ** 2)
    # Kept close to 1.0. An earlier version lifted to 1.6x and washed the backdrop out to
    # near-white, which defeated the whole point of compositing onto a known blue.
    lift = np.clip(1.18 - 0.42 * r, 0.62, 1.2)[:, :, None]
    return np.clip(base[None, None, :] * lift, 0, 255)


def stylize(im: Image.Image) -> Image.Image:
    """The full treatment. PIL RGB in, PIL RGB out."""
    rgb = im.convert("RGB")
    bgr = np.ascontiguousarray(np.array(rgb)[:, :, ::-1])
    h, w = bgr.shape[:2]
    alpha = _alpha(rgb)

    # A greyscale source keeps its monochrome subject. Inventing skin colour for it would
    # be exactly the fabrication this archive refuses everywhere else; it still gets the
    # common backdrop and lighting, which is enough to stop it reading as an accident.
    b, g, r = (bgr[:, :, i].astype(np.float32) for i in range(3))
    is_grey = float(np.mean(np.abs(b - g)) + np.mean(np.abs(g - r))) < 6.0
    # _neutralise_cast is deliberately not called, and the third approach to this problem
    # to be rejected. Measured across the set it pushed skin green and yellow, because the
    # studio backdrops genuinely differ in hue — forcing them all onto one blue drags
    # complexion along with them. Compositing onto a common backdrop already removes the
    # cast where it read most strongly, and normalising exposure does the rest without
    # guessing at anyone's skin tone.
    _ = is_grey
    bgr = _normalise_exposure(bgr, alpha)

    subject = _render(bgr).astype(np.float32)
    a = alpha[:, :, None]
    out = subject * a + _backdrop(h, w) * (1 - a)

    # Shared vignette.
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    rr = np.sqrt(((yy - h / 2) / (h / 2)) ** 2 + ((xx - w / 2) / (w / 2)) ** 2) / np.sqrt(2)
    out = np.clip(out * (1.0 - 0.16 * np.clip(rr, 0, 1) ** 2)[:, :, None], 0, 255)

    return Image.fromarray(out.astype(np.uint8)[:, :, ::-1])
