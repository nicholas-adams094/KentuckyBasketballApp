#!/usr/bin/env python3
"""
Re-derive player portraits from the immutable originals.

Why this exists
---------------
The portraits inherited from the previous build had three defects that no amount of
upscaling would fix:

1. **Nine of them were not portraits at all.** They are narrow vertical bands sliced out
   of a season team photograph, each still containing two to five people, padded on the
   sides with a blurred copy of themselves. In a 3:4 card frame they routinely centred
   the wrong person. A reader looking at "Jules Camara" saw five men and no way to tell
   which was him.

2. **Aspect-ratio padding.** Because the sources are not 3:4, the previous pipeline
   padded rather than cropped, leaving the real photograph floating in a blurred field.

3. **A 3x upscale** that tripled the pixel dimensions without adding any real detail,
   and tripled the byte size along with it.

What this script does
---------------------
Crops a properly framed head-and-shoulders portrait from each original, passes the crop
through Real-ESRGAN ×4, then emits responsive WebP derivatives.

**The upscale is generative.** Real-ESRGAN is a GAN: it does not recover detail that was
lost, it synthesises detail that is plausible. Pores, hair strands and fabric weave in the
output were computed, not photographed. Measured by round-tripping each result back down
to source resolution, a reconstructive model (EDSR) lands within ~1 RMSE of the original
while Real-ESRGAN drifts 7–10.5 — that gap is invented content, and it is why every
reconstructed image is labelled as one wherever it renders.

This was a deliberate choice by the archive's owner, made after reviewing side-by-side
comparisons at both display size and 3× zoom. It supersedes the earlier rule that no
generative upscaler may touch a real person's face. What it does not supersede: an
upscaled portrait is never described as an archival photograph, and the four crops where
the model demonstrably fabricates a face are marked as fabrications rather than portraits.

Identifying the team-photo crops
--------------------------------
These were resolved by **jersey number**, not by guessing at faces. Each strip has the
number the archive records for that player in that season legibly visible on a jersey;
the crop is taken from the person wearing it. The number used for each identification is
recorded below and written into the photo manifest so the claim is auditable rather than
asserted — `tests/unit/lib.test.ts` re-checks every one of them against archive.json.

Nine of the ten passed. The tenth did not: the photograph filed under Ramon Harris shows
a #5 jersey, and the archive records Harris as #22 in the one season it covers for him
(#5 that season is Derrick Jasper). Rather than assert an identification the archive
cannot support, that source produces no portrait and Harris renders as a jersey card.
See NO_PORTRAIT below.

Run: python3 scripts/derive-portraits.py [--check]
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass

import cv2
import numpy as np
from PIL import Image, ImageFilter, ImageOps

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import upscale  # noqa: E402  (needs the path insert above)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGINAL_DIR = os.path.join(ROOT, "public/images/players/original")
RESOURCED_DIR = os.path.join(ROOT, "public/images/players/resourced")
OUTPUT_DIR = os.path.join(ROOT, "public/images/players/portrait")
NO_PORTRAIT_DIR = os.path.join(ROOT, "public/images/players/no-portrait")
CASCADE_DIR = os.path.join(ROOT, ".cache/cascades")

CASCADES = ("haarcascade_frontalface_default", "haarcascade_frontalface_alt2")

# Responsive widths. A variant is only emitted when it stays within MAX_UPSCALE of the
# native crop width. With a ×4 generative upscale in the chain that ceiling is 4.0 — the
# model's own scale factor, beyond which even synthesised detail is just resampling.
TARGET_WIDTHS = (160, 320, 640)
MAX_UPSCALE = 4.0

UPSCALE_MODEL = "esrgan"
UPSCALE_LABEL = "Real-ESRGAN x4plus (RRDBNet, 23 blocks)"
UPSCALE_SCALE = 4

# Below this native crop width the model has too little to work from and stops
# reconstructing a face: it invents one. Barbour, Heissenbuttel, Coury and Carruth are all
# under it. They are still processed — the archive's owner asked for the whole set — but
# they are recorded and rendered as fabrications, not as portraits of these players.
FABRICATION_WIDTH = 90

# Portrait framing: the face spans this fraction of the crop width, with the eye line
# this far down the frame. Chosen to match a media-guide headshot.
FACE_WIDTH_FRACTION = 0.38
EYE_LINE_FRACTION = 0.40
ASPECT = 3 / 4  # width / height


@dataclass(frozen=True)
class ManualCrop:
    """A face located by hand and verified against the player's recorded jersey number."""

    center_x: int
    eye_y: int
    face_w: int
    jersey: str
    season: str
    # Team photographs pack players shoulder to shoulder, so these need a much tighter
    # frame than a studio portrait or the neighbour ends up in shot.
    face_fraction: float = 0.60
    # Overrides the default provenance string for sources that are not team photographs.
    basis: str | None = None


# ---------------------------------------------------------------------------
# The nine team-photo strips, resolved by jersey number.
#
# Each centre/eye-line comes from an OpenCV face detection on the source, not from a
# hand-estimated pixel coordinate. Selecting *which* detection was the manual step, and
# each choice was cross-checked by confirming the face centre lines up horizontally with
# the jersey number beneath it (typically within a few pixels).
#
# `jersey` is the number visible on that person's uniform, and it matches the number
# src/data/archive.json records for the player in `season`.
# ---------------------------------------------------------------------------
#
# Four remain. Camara, Blevins, Carrier, Obrzut and Porter were retired from this list on
# 2026-08-01 when official individual UK headshots were recovered for them (see
# load_resourced); no jersey-number inference is needed once the university has published
# the portrait on the player's own page.
MANUAL: dict[str, ManualCrop] = {
    "uk_antwain_barbour":      ManualCrop(174, 121, 44, "33", "2002-03"),
    "uk_mark_coury":           ManualCrop(282, 130, 50, "42", "2006-07"),
    "uk_matt_heissenbuttel":   ManualCrop(176,  76, 52, "15", "2002-03"),
    "uk_rashaad_carruth":      ManualCrop(172,  53, 40, "2", "2001-02"),
}


def load_resourced() -> dict[str, dict]:
    """
    Official UK headshots recovered from Internet Archive captures of ukathletics.com.

    Where one of these exists it wins over the inherited original, which for these players
    was a strip of a team photograph containing several people. A 105px *individual*
    headshot published on the player's own official page beats an 83px slice of a group
    on both counts that matter: it is sharper, and it is identified by the university
    rather than inferred by this pipeline.

    Nothing under original/ is deleted — both files stay on disk so the substitution can
    be audited. See public/images/players/resourced/SOURCES.json.
    """
    path = os.path.join(RESOURCED_DIR, "SOURCES.json")
    if not os.path.exists(path):
        return {}
    with open(path) as fh:
        return json.load(fh)["items"]


@dataclass(frozen=True)
class NoPortrait:
    """A source that must never be cropped into a portrait, and why."""

    confidence: str
    photo_type: str
    note: str


# ---------------------------------------------------------------------------
# Sources that get no portrait crop.
#
# Both are re-encoded at native resolution so the manifest still has a display
# derivative to point at, but neither produces portrait variants — so every player-facing
# surface falls back to the generated jersey card, which is the only honest thing to show.
# ---------------------------------------------------------------------------
NO_PORTRAIT: dict[str, NoPortrait] = {
    "uk_eric_allen": NoPortrait(
        confidence="placeholder",
        photo_type="labeled-placeholder",
        note=(
            "Designed Kentucky-themed placeholder graphic, not a photograph. No verified "
            "UK-uniform image of Eric Allen was located."
        ),
    ),
}
# Ramon Harris was here until 2026-08-01. The inherited photograph showed a #5 jersey,
# which this archive's 2006-07 roster contradicts (it records Harris as #22 and #5 as
# Derrick Jasper), so no portrait could be published from it. An official UK headshot of
# Harris has since been recovered and supersedes it — see load_resourced.


def load_cascades() -> list[cv2.CascadeClassifier]:
    out = []
    for name in CASCADES:
        path = os.path.join(CASCADE_DIR, f"{name}.xml")
        if not os.path.exists(path):
            sys.exit(
                f"Missing cascade {path}.\n"
                "Fetch them once with:\n"
                f"  mkdir -p {CASCADE_DIR} && for c in {' '.join(CASCADES)}; do\n"
                f"    curl -sSLo {CASCADE_DIR}/$c.xml "
                "https://raw.githubusercontent.com/opencv/opencv/4.x/data/haarcascades/$c.xml\n"
                "  done"
            )
        clf = cv2.CascadeClassifier(path)
        if clf.empty():
            sys.exit(f"Cascade failed to load: {path}")
        out.append(clf)
    return out


def detect_face(img_bgr: np.ndarray, cascades) -> tuple[int, int, int] | None:
    """Returns (center_x, eye_y, face_w) for the most prominent face, or None."""
    gray = cv2.equalizeHist(cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY))
    h, w = gray.shape
    boxes: list[tuple[int, int, int, int]] = []
    for clf in cascades:
        found = clf.detectMultiScale(
            gray, scaleFactor=1.08, minNeighbors=6, minSize=(int(min(w, h) * 0.12),) * 2
        )
        boxes.extend(tuple(map(int, b)) for b in found)
    if not boxes:
        return None
    # Prefer the largest face in the upper half — a portrait's subject.
    boxes.sort(key=lambda b: (-(b[2] * b[3]), b[1]))
    x, y, fw, fh = boxes[0]
    return x + fw // 2, y + int(fh * 0.42), fw


def content_bounds(img_bgr: np.ndarray) -> tuple[int, int, int, int]:
    """
    Bounding box of the genuinely photographic region, as (x_lo, x_hi, y_lo, y_hi).

    Several sources are padded to 3:4 with a blurred copy of themselves or with flat
    letterbox bands. Local gradient energy separates the real photograph from that
    padding on both axes, so crops stay inside actual image content instead of pulling
    in a smear of blue or a black bar.
    """
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
    lap = np.abs(cv2.Laplacian(gray, cv2.CV_32F))
    H, W = gray.shape

    def span(profile: np.ndarray, limit: int) -> tuple[int, int]:
        if profile.max() <= 0:
            return 0, limit
        strong = np.where(profile > profile.max() * 0.18)[0]
        if strong.size == 0:
            return 0, limit
        return int(strong[0]), int(strong[-1]) + 1

    x_lo, x_hi = span(lap.mean(axis=0), W)
    y_lo, y_hi = span(lap.mean(axis=1), H)
    # Guard against a pathological result collapsing the crop to nothing.
    if x_hi - x_lo < W * 0.25:
        x_lo, x_hi = 0, W
    if y_hi - y_lo < H * 0.25:
        y_lo, y_hi = 0, H
    return x_lo, x_hi, y_lo, y_hi


def crop_box(cx: int, eye_y: int, face_w: int, bounds: tuple[int, int, int, int],
             face_fraction: float = FACE_WIDTH_FRACTION) -> tuple[int, int, int, int]:
    """A 3:4 head-and-shoulders box around the face, clamped to real image content."""
    x_lo, x_hi, y_lo, y_hi = bounds
    avail_w, avail_h = x_hi - x_lo, y_hi - y_lo

    crop_w = face_w / face_fraction
    # Fit the 3:4 frame inside whatever real content exists.
    crop_w = min(crop_w, avail_w, avail_h * ASPECT)
    crop_h = crop_w / ASPECT

    left = cx - crop_w / 2
    top = eye_y - crop_h * EYE_LINE_FRACTION
    left = max(x_lo, min(left, x_hi - crop_w))
    top = max(y_lo, min(top, y_hi - crop_h))
    return int(round(left)), int(round(top)), int(round(crop_w)), int(round(crop_h))


def reconstruct(im: Image.Image, descreen: bool = False) -> Image.Image:
    """
    Descreen at native pitch, then run the crop through Real-ESRGAN ×4.

    Order matters. `descreen` is for crops taken from the scanned team photographs: those
    are pictures of a *printed* page, so they carry a halftone rosette — a regular dot grid
    at roughly the same 1–2px pitch as the facial detail itself. A 3x3 median at native
    size removes the grid while leaving edges intact. It has to happen *before* the
    upscale, because Real-ESRGAN reads a halftone rosette as texture and will faithfully
    reconstruct a magnified dot pattern across the face.

    What comes back is a reconstruction. The model synthesises detail consistent with its
    training distribution rather than recovering what the camera recorded, so the output
    is a plausible face, not a measured one.
    """
    if descreen:
        im = im.filter(ImageFilter.MedianFilter(3))
    bgr = np.ascontiguousarray(np.array(im.convert("RGB"))[:, :, ::-1])
    return Image.fromarray(upscale.MODELS[UPSCALE_MODEL][1](bgr)[:, :, ::-1])


def finish(im: Image.Image, width: int) -> Image.Image:
    """Resize a reconstructed crop to an output width and normalise levels."""
    height = round(width / ASPECT)
    out = im.resize((width, height), Image.LANCZOS)
    # Gentle autocontrast: recovers the faded scans without crushing skin tones.
    out = ImageOps.autocontrast(out, cutoff=(0.4, 0.4), preserve_tone=True)
    # Real-ESRGAN already returns hard, high-contrast edges; the old 95% unsharp on top of
    # that produces visible halos along the jaw and collar. Only enough to restore what
    # the downsample to output width costs.
    if width < im.width:
        out = out.filter(
            ImageFilter.UnsharpMask(radius=max(0.6, width / 500), percent=35, threshold=3)
        )
    return out


MANIFEST_PATH = os.path.join(ROOT, "src/data/photo-manifest.json")


def update_manifest(report: dict[str, dict], skipped: dict[str, dict]) -> None:
    """
    Write the derivation back into the photo manifest.

    Keeping this in the same command as the derivation is deliberate: provenance that
    has to be updated by hand drifts from the assets it claims to describe. The manifest
    records how each portrait was framed and, for the team-photograph crops, the jersey
    number the identification rests on — so the claim can be audited rather than trusted.
    """
    with open(MANIFEST_PATH) as fh:
        manifest = json.load(fh)

    for item in manifest["items"]:
        if item["kind"] != "player":
            continue

        skip = skipped.get(item["image_key"])
        if skip is not None:
            rule: NoPortrait = skip["rule"]
            # No portrait variants at all: that is what makes every player-facing surface
            # fall back to the generated jersey card.
            item.pop("portrait", None)
            item.pop("identified_by", None)
            item.pop("jersey_number", None)
            item.pop("identified_in_season", None)
            item["processed_path"] = skip["path"]
            item["processed_dimensions"] = {"width": skip["width"], "height": skip["height"]}
            item["derivative_method"] = "native-resolution re-encode; no portrait derived"
            item["confidence"] = rule.confidence
            item["photo_type"] = rule.photo_type
            item["photo_note"] = rule.note
            item["needs_resourcing"] = True
            item["visual_review_status"] = "required"
            continue

        entry = report.get(item["image_key"])
        if entry is None:
            continue

        largest = max(entry["variants"], key=lambda v: v["width"])
        basis = entry["identification"]

        item["portrait"] = {
            "variants": entry["variants"],
            "source_crop": entry["source_crop"],
            "native_width": entry["native_width"],
            "derivation": basis,
            # Every portrait now passes through a generative model, so every portrait
            # carries the record of it. `class` separates a reconstruction — a real face
            # with synthesised texture on it — from a fabrication, where the crop was too
            # small for the model to reconstruct anything and it invented the face.
            "reconstruction": {
                "model": UPSCALE_LABEL,
                "scale": UPSCALE_SCALE,
                "generative": True,
                "class": "fabricated" if entry["fabricated"] else "reconstructed",
            },
        }
        # The canonical display derivative is now the largest portrait variant.
        item["processed_path"] = largest["path"]
        item["processed_dimensions"] = {"width": largest["width"], "height": largest["height"]}
        item["derivative_method"] = (
            "face-centred-crop-descreen-realesrgan-x4-lanczos"
            if basis.startswith("jersey-number")
            else "face-centred-crop-realesrgan-x4-lanczos"
        )

        if basis == "official-uk-headshot":
            src = entry["resourced"]
            item["photo_type"] = "official-uk-headshot"
            item["confidence"] = "verified-archival"
            item["identified_by"] = "official-university-publication"
            item["original_path"] = f"/images/players/resourced/{item['image_key']}.jpg"
            item["original_dimensions"] = entry["source_size"]
            item["source_url"] = src["image_url"]
            item["source_reference"] = src["page_url"]
            item["needs_resourcing"] = False
            item["visual_review_status"] = "complete"
            item.pop("jersey_number", None)
            item.pop("identified_in_season", None)
            era_note = (
                ""
                if src["in_covered_era"]
                else (
                    f" This headshot dates from {src['era']}, after the Tubby Smith era "
                    "this archive covers — it is the earliest official Kentucky portrait "
                    "of him that survives, and it is shown because a real, identified "
                    "photograph is better than none."
                )
            )
            item["photo_note"] = (
                f"Official University of Kentucky headshot ({src['era']}), recovered from "
                f"an Internet Archive capture of ukathletics.com and {src['identified_by']}. "
                "It replaces a crop of a season team photograph that contained several "
                f"people.{era_note}"
            )
            if not src["in_covered_era"]:
                item["photo_season_note"] = f"portrait dates from {src['era']}"

        elif basis.startswith("jersey-number"):
            item["photo_type"] = "team-photograph-crop"
            item["confidence"] = "verified-team-photograph-crop"
            item["identified_by"] = "jersey-number"
            item["jersey_number"] = entry["jersey"]
            item["identified_in_season"] = entry["season"]
            item["photo_note"] = (
                f"Cropped from the {entry['season']} Kentucky team photograph. The subject "
                f"is the player wearing jersey #{entry['jersey']}, the number this archive "
                f"records for {item['display_name']} that season. This is a crop of a group "
                "photograph, not an individual archival headshot."
            )
        else:
            item["photo_type"] = "archival-kentucky-portrait"
            item["confidence"] = "verified-archival"
            item["photo_note"] = (
                "Kentucky-uniform archival portrait, re-cropped from the extracted original "
                "to a consistent 3:4 head-and-shoulders frame."
            )

        # Disclosure, appended whatever the image's provenance. `confidence` still records
        # how the *subject* was identified — that is a separate question from how the
        # pixels were produced, and the jersey-number audit still depends on it.
        if item["portrait"]["reconstruction"]["class"] == "fabricated":
            item["photo_type"] = "ai-fabricated-face"
            item["visual_review_status"] = "required"
            item["photo_note"] += (
                " This image is NOT a photograph of this player. The underlying crop is "
                f"only {entry['native_width']}px wide — far too little for the upscaler to "
                "reconstruct a face from — so what it renders was synthesised by "
                f"{UPSCALE_LABEL}. It is published at the archive owner's request and is "
                "labelled a fabrication everywhere it appears."
            )
        else:
            item["photo_note"] += (
                f" Reconstructed with {UPSCALE_LABEL}, a generative model that synthesises "
                "plausible detail rather than recovering what was recorded: fine texture "
                "in this image was computed, not photographed."
            )

    # Counts are derived, not written by hand — the previous wording drifted out of date
    # the moment six portraits were re-sourced and stopped being team-photograph crops.
    crops = sum(1 for e in report.values() if e["identification"].startswith("jersey-number"))
    fabricated = sorted(k for k, e in report.items() if e["fabricated"])

    manifest["notes"] = [
        "Original means the image extracted from the last stable monolithic archive, not "
        "necessarily the highest-resolution historical source.",
        "Portrait variants are re-derived from the originals by scripts/derive-portraits.py: "
        f"a face-centred 3:4 crop, upscaled with {UPSCALE_LABEL}, then resampled to each "
        "output width with Lanczos.",
        "The upscaler is generative. Real-ESRGAN synthesises detail consistent with its "
        "training data rather than recovering detail the camera recorded, so fine texture — "
        "skin, hair, fabric — in every portrait here was computed rather than photographed. "
        "Round-tripping each result back to source resolution puts the drift at 7-10.5 RMSE "
        "against 1.0 for a reconstructive model, which is the measure of how much is "
        "invented. Every portrait is labelled as a reconstruction where it renders.",
        f"{len(fabricated)} portraits are fabrications rather than reconstructions: "
        f"{', '.join(fabricated)}. Their crops are under {FABRICATION_WIDTH}px wide, which "
        "leaves the model nothing to reconstruct from, and the faces it returns are "
        "invented. They are published at the archive owner's explicit request, and each is "
        "marked as a fabrication in this manifest and on every surface that renders it.",
        "Crops from the team photographs additionally get a 3x3 median at native size, "
        "before the upscale, to remove the halftone dot pattern left by photographing a "
        "printed page — otherwise the upscaler reads the rosette as texture and "
        "reconstructs a magnified dot grid across the face.",
        f"{crops} portraits are crops of a season team photograph rather than individual "
        "headshots. Each subject is the player wearing the jersey number this archive "
        "records for that player in that season, and each is labelled as a team-photograph "
        "crop wherever it appears.",
        f"{len(skipped)} player is shown as a labelled jersey card rather than a "
        "photograph: Eric Allen, for whom no verified UK-uniform image was located.",
    ]

    with open(MANIFEST_PATH, "w") as fh:
        json.dump(manifest, fh, indent=2, ensure_ascii=False)
        fh.write("\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true",
                        help="report what would change without writing files")
    parser.add_argument("--only", default=None,
                        help="comma-separated image keys to reconstruct; the manifest and "
                             "the stale-file prune are left alone so parallel shards "
                             "cannot delete each other's output")
    parser.add_argument("--force", action="store_true",
                        help="re-reconstruct even where the output files already exist")
    args = parser.parse_args()

    shard = set(filter(None, args.only.split(","))) if args.only else None

    cascades = load_cascades()
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(NO_PORTRAIT_DIR, exist_ok=True)

    report: dict[str, dict] = {}
    skipped: dict[str, dict] = {}
    undetected: list[str] = []
    written: list[str] = []
    resourced = load_resourced()

    for filename in sorted(os.listdir(ORIGINAL_DIR)):
        if not filename.endswith(".webp"):
            continue
        key = filename[:-5]
        if key in NO_PORTRAIT:
            src = Image.open(os.path.join(ORIGINAL_DIR, filename)).convert("RGB")
            if not args.check:
                src.save(os.path.join(NO_PORTRAIT_DIR, filename), "WEBP", quality=90, method=6)
            skipped[key] = {
                "path": f"/images/players/no-portrait/{filename}",
                "width": src.width,
                "height": src.height,
                "rule": NO_PORTRAIT[key],
            }
            continue

        # A re-sourced official headshot supersedes the inherited original.
        entry = resourced.get(key)
        path = (os.path.join(RESOURCED_DIR, f"{key}.jpg") if entry
                else os.path.join(ORIGINAL_DIR, filename))
        pil = Image.open(path).convert("RGB")
        bgr = np.ascontiguousarray(np.array(pil)[:, :, ::-1])
        W, H = pil.size
        bounds = content_bounds(bgr)

        manual = MANUAL.get(key)
        fraction = FACE_WIDTH_FRACTION
        if entry:
            # These arrive already framed as head-and-shoulders portraits. Detection still
            # runs so the eye line is placed consistently with the rest of the archive,
            # but crop_box clamps to the available content, so a frame this tight simply
            # yields most of the image back.
            found = detect_face(bgr, cascades)
            if found is None:
                cx, eye_y, face_w = W // 2, int(H * 0.34), int(W * 0.55)
            else:
                cx, eye_y, face_w = found
            basis = "official-uk-headshot"
        elif manual:
            cx, eye_y, face_w = manual.center_x, manual.eye_y, manual.face_w
            fraction = manual.face_fraction
            basis = manual.basis or (
                f"jersey-number-{manual.jersey}-in-{manual.season}-team-photograph"
            )
        else:
            found = detect_face(bgr, cascades)
            if found is None:
                undetected.append(key)
                cx, eye_y, face_w = W // 2, int(H * 0.30), int(W * 0.42)
                basis = "centred-fallback-no-face-detected"
            else:
                cx, eye_y, face_w = found
                basis = "face-detected"

        left, top, cw, ch = crop_box(cx, eye_y, face_w, bounds, fraction)
        cropped = pil.crop((left, top, left + cw, top + ch))

        # Never emit a variant wider than MAX_UPSCALE x the native crop — the upscaler's
        # own scale factor, past which even synthesised detail is just resampling. Where
        # even the smallest target would overshoot, fall back to exactly that ceiling.
        widths = [w for w in TARGET_WIDTHS if w <= cw * MAX_UPSCALE]
        if not widths:
            widths = [int(cw * MAX_UPSCALE)]
        variants = [
            {"width": w, "height": round(w / ASPECT),
             "path": f"/images/players/portrait/{key}-{w}w.webp"}
            for w in widths
        ]

        # Writing the images is the expensive half — minutes per crop on CPU — so it is
        # gated separately from computing the crop geometry, which is instant. That lets
        # several processes each write a slice of the set (--only) while a final pass with
        # everything already on disk assembles the manifest without redoing the work.
        mine = shard is None or key in shard
        done = all(os.path.exists(os.path.join(ROOT, "public" + v["path"])) for v in variants)
        if not args.check and mine and not (done and not args.force):
            # Only the team-photograph crops are scans of a printed page, so only they get
            # the descreen; on a clean studio portrait it would soften real detail for no
            # reason. The upscale runs once and every width is resized off that result.
            rebuilt = reconstruct(cropped, descreen=manual is not None)
            for variant in variants:
                finish(rebuilt, variant["width"]).save(
                    os.path.join(ROOT, "public" + variant["path"]),
                    "WEBP", quality=88, method=6,
                )
            written.append(key)

        report[key] = {
            "source_crop": {"x": left, "y": top, "w": cw, "h": ch},
            "native_width": cw,
            "identification": basis,
            "variants": variants,
            "jersey": manual.jersey if manual else None,
            "season": manual.season if manual else None,
            "resourced": entry,
            "source_size": {"width": W, "height": H},
            # Below FABRICATION_WIDTH the model has nothing to reconstruct from and
            # invents a face outright. Recorded here so the manifest, the audit and the
            # interface all treat those four differently from a reconstruction.
            "fabricated": cw < FABRICATION_WIDTH,
        }

    # Prune outputs from a previous run that this one no longer produces, so the derived
    # directories can never accumulate a file the manifest has stopped referencing —
    # which is precisely how a retracted portrait would survive on disk.
    expected = {
        os.path.basename(v["path"])
        for entry in report.values()
        for v in entry["variants"]
    } | {"index.json"}
    stale = [f for f in os.listdir(OUTPUT_DIR) if f not in expected]
    keep_np = {f"{k}.webp" for k in skipped}
    stale += [f for f in os.listdir(NO_PORTRAIT_DIR) if f not in keep_np]

    # A shard sees only its own slice, so from its point of view every other shard's
    # output is stale and the manifest is half-written. Both are therefore whole-run only.
    if not args.check and shard is None:
        for name in stale:
            for d in (OUTPUT_DIR, NO_PORTRAIT_DIR):
                p = os.path.join(d, name)
                if os.path.exists(p):
                    os.remove(p)
        update_manifest(report, skipped)
        with open(os.path.join(OUTPUT_DIR, "index.json"), "w") as fh:
            json.dump(report, fh, indent=2, sort_keys=True)

    manual_count = sum(1 for k in report if k in MANUAL)
    resourced_count = sum(1 for v in report.values() if v["identification"] == "official-uk-headshot")
    fallback = [k for k, v in report.items() if v["identification"].startswith("centred")]
    print(f"portraits derived      {len(report)}")
    print(f"  official UK headshot {resourced_count} (re-sourced)")
    print(f"  jersey-identified    {manual_count}")
    print(f"  face-detected        {len(report) - manual_count - resourced_count - len(fallback)}")
    print(f"  centred fallback     {len(fallback)}{' ' + ', '.join(fallback) if fallback else ''}")
    print(f"  variants declared    {sum(len(v['variants']) for v in report.values())}")
    print(f"  reconstructed here   {len(written)}{' (shard)' if shard else ''}")
    fab = sorted(k for k, e in report.items() if e["fabricated"])
    print(f"  FABRICATED faces     {len(fab)}{' — ' + ', '.join(fab) if fab else ''}")
    for key, entry in sorted(skipped.items()):
        print(f"  no portrait          {key} — {entry['rule'].confidence}")
    if stale:
        print(f"  stale files pruned   {len(stale)} ({', '.join(sorted(stale))})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
