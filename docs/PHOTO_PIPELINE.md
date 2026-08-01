# Photo sourcing and restoration pipeline

## 1. Source discovery

For every player and team, search in this order:

1. University of Kentucky media guides and official athletics archives
2. Walter’s Wildcat World archival player pages
3. University and newspaper photo archives with clear provenance
4. Reputable licensed image archives
5. Verified team-photo crop only when no individual Kentucky portrait exists

Do not use NBA or later-career images.

## 2. Preserve inputs

- Save the highest-resolution file unchanged under `original/`.
- Record source URL, retrieval date, dimensions, and rights/attribution notes.
- Compute a checksum.
- Never overwrite an original.

## 3. Derivative processing

- Correct orientation, exposure, white balance, fading, and compression artifacts.
- Crop player portraits to a consistent 3:4 frame with safe headroom.
- Use conservative denoise and sharpening.
- Avoid repeated upscaling.
- Generate WebP/AVIF derivatives and retain a high-quality archival derivative.

## 4. AI-assisted restoration

AI reconstruction may be used only as a clearly labeled derivative when the identity is verified and a better source is unavailable. It may not be represented as an authentic archival headshot. Record the method and source image in the manifest.

## 5. Manual review

Review every asset for:

- Correct player identity
- Kentucky uniform or team apparel
- Natural facial geometry
- No invented jersey number or lettering
- Consistent crop and background
- Acceptable sharpness at card and modal sizes
- Rights and attribution status

## 6. Automated checks

`npm run audit:images` **fails** on a missing path, a duplicate key, a path referenced by
two entries, a path resolving outside `public/`, a truncated file, an entry with no
provenance note, a profile or team image key with no manifest record, or a manifest
entry pointing at an unknown player.

It also reads PNG/JPEG/WebP headers directly and fails if the dimensions on disk differ
from the manifest, so a provenance record can never drift from the asset it describes.

It **warns** (without blocking) on low-resolution originals, reconstructions, the
placeholder, and pending rights review — these are tracked open items, not defects.

## 7. Current state

| | Count |
| --- | --- |
| Manifest entries | 70 (58 players, 10 teams, 2 interface) |
| Verified archival portraits | 48 players + 2 interface |
| Official team photographs | 10 |
| **Reconstructions from team-photo crops** | **9** |
| **Labelled placeholders** | **1** (Eric Allen) |
| Originals below the resolution target | 68 |

The nine reconstructions are Jules Camara, Antwain Barbour, Josh Carrier, Matt
Heissenbuttel, Lukasz Obrzut, Michael Porter, Mark Coury, J.P. Blevins and Rashaad
Carruth. Each is flagged "Reconstruction" wherever it appears, and the profile dialog
states explicitly that it is not an archival headshot.

Most player originals are 420×560 and the 1999–00 team photograph is only 528×305. These
are the files extracted from the previous build, not the best available historical
sources. The processed derivatives were upscaled, which increased display dimensions
without adding real detail — **the fix is re-sourcing, not another upscale.**

## 8. Replacing an image

1. Save the new source unmodified to `public/images/<kind>/original/<key>.<ext>`.
2. Produce the display derivative in `processed/` following section 3.
3. Update that manifest entry: both paths, both dimension pairs, `photo_type`,
   `photo_note`, `source_url`, `confidence`, `derivative_method`, `needs_resourcing`,
   and both review statuses.
4. Run `npm run audit:images` — the dimension cross-check will catch a manifest that was
   not updated to match the new file.
5. If the change moves an image out of `verified-source-derived-portrait` or
   `placeholder`, update `docs/KNOWN_ISSUES.md` and the counts above.
