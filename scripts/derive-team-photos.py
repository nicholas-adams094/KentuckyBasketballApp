#!/usr/bin/env python3
"""
Re-derive the season team photographs from the immutable originals.

Why this exists
---------------
The processed team photographs inherited from the previous build had no script behind
them at all. The manifest described them as "upscaled-and-color-corrected" and nothing in
the repository could reproduce that, so the largest images the archive serves were the
only ones whose derivation could not be audited or repeated. This script closes that gap.

What it does
------------
Descreens each original at native pitch, runs it through Real-ESRGAN ×4, and writes a
single display derivative capped at MAX_WIDTH.

The descreen has to come first. These are photographs of printed media-guide pages, so
they carry a halftone rosette; Real-ESRGAN reads that dot grid as texture and will
reconstruct a magnified version of it across every face in the frame.

Unlike the portraits, the upscale is uncontroversial here. Nobody's face is the subject of
a team photograph at the size it renders, and the visible win — the halftone screen
disappearing and the jersey numbers resolving — is large. The output is still a generative
reconstruction and is recorded as one in the manifest.

Run: python3 scripts/derive-team-photos.py [--check] [--only KEY,KEY] [--force]
"""

from __future__ import annotations

import argparse
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter, ImageOps

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import upscale  # noqa: E402  (needs the path insert above)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGINAL_DIR = os.path.join(ROOT, "public/images/teams/original")
OUTPUT_DIR = os.path.join(ROOT, "public/images/teams/processed")
MANIFEST_PATH = os.path.join(ROOT, "src/data/photo-manifest.json")

UPSCALE_MODEL = "esrgan"
UPSCALE_LABEL = "Real-ESRGAN x4plus (RRDBNet, 23 blocks)"
UPSCALE_SCALE = 4

# The model gives ×4; past ~2560 the extra pixels cost bandwidth on a page that displays
# these at a fraction of the size. Never exceed the model's own scale factor either.
MAX_WIDTH = 2560


def derive(path: str) -> tuple[Image.Image, int]:
    """Returns the finished derivative and the native width it came from."""
    src = Image.open(path).convert("RGB")
    native = src.width

    # Median at native pitch removes the halftone rosette while leaving edges — faces,
    # numbers, collars — intact, because a median rejects isolated outliers rather than
    # averaging them in.
    descreened = src.filter(ImageFilter.MedianFilter(3))

    bgr = np.ascontiguousarray(np.array(descreened)[:, :, ::-1])
    big = Image.fromarray(upscale.MODELS[UPSCALE_MODEL][1](bgr)[:, :, ::-1])

    target = min(MAX_WIDTH, native * UPSCALE_SCALE)
    if big.width != target:
        big = big.resize((target, round(big.height * target / big.width)), Image.LANCZOS)
    return ImageOps.autocontrast(big, cutoff=(0.4, 0.4), preserve_tone=True), native


def update_manifest(report: dict[str, dict]) -> None:
    with open(MANIFEST_PATH) as fh:
        manifest = json.load(fh)

    for item in manifest["items"]:
        if item["kind"] != "team":
            continue
        entry = report.get(item["image_key"])
        if entry is None:
            continue

        item["processed_path"] = entry["path"]
        item["processed_dimensions"] = {"width": entry["width"], "height": entry["height"]}
        item["derivative_method"] = "descreen-realesrgan-x4-lanczos"
        item["reconstruction"] = {
            "model": UPSCALE_LABEL,
            "scale": UPSCALE_SCALE,
            "generative": True,
            "class": "reconstructed",
            "native_width": entry["native_width"],
        }
        base = item["photo_note"].split(" Reconstructed with ")[0].rstrip()
        item["photo_note"] = (
            f"{base} Reconstructed with {UPSCALE_LABEL} from the "
            f"{entry['native_width']}px original after descreening: a generative model "
            "that synthesises plausible detail rather than recovering what was recorded, "
            "so fine texture in this image was computed, not photographed."
        )

    with open(MANIFEST_PATH, "w") as fh:
        json.dump(manifest, fh, indent=2, ensure_ascii=False)
        fh.write("\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--only", default=None,
                        help="comma-separated image keys; leaves the manifest alone so "
                             "parallel shards do not overwrite each other")
    parser.add_argument("--force", action="store_true",
                        help="re-derive even where the output already exists")
    args = parser.parse_args()

    shard = set(filter(None, args.only.split(","))) if args.only else None
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    report: dict[str, dict] = {}
    written: list[str] = []

    for filename in sorted(os.listdir(ORIGINAL_DIR)):
        if not filename.endswith(".webp"):
            continue
        key = filename[:-5]
        out_path = os.path.join(OUTPUT_DIR, filename)
        rel = f"/images/teams/processed/{filename}"

        mine = shard is None or key in shard
        if args.check or not mine or (os.path.exists(out_path) and not args.force):
            # Report the file that is already there so a manifest-only pass stays accurate.
            if os.path.exists(out_path):
                done = Image.open(out_path)
                src = Image.open(os.path.join(ORIGINAL_DIR, filename))
                report[key] = {"path": rel, "width": done.width, "height": done.height,
                               "native_width": src.width}
            continue

        finished, native = derive(os.path.join(ORIGINAL_DIR, filename))
        finished.save(out_path, "WEBP", quality=82, method=6)
        written.append(key)
        report[key] = {"path": rel, "width": finished.width, "height": finished.height,
                       "native_width": native}

    if not args.check and shard is None:
        update_manifest(report)

    print(f"team photographs       {len(report)}")
    print(f"  reconstructed here   {len(written)}{' (shard)' if shard else ''}")
    for key in sorted(report):
        e = report[key]
        print(f"  {key:16} {e['native_width']}px -> {e['width']}x{e['height']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
