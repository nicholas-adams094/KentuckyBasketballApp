# Photo sourcing and restoration pipeline

Every portrait the archive serves is produced by `scripts/derive-portraits.py` from the
immutable files in `public/images/**/original/` and `public/images/players/resourced/`. Nothing is hand-edited; re-running the
script from a clean checkout reproduces `public/images/players/portrait/` byte for byte
and rewrites the provenance in `src/data/photo-manifest.json` to match.

## 1. Source discovery

For every player and team, search in this order:

1. University of Kentucky media guides and official athletics archives
2. Walter's Wildcat World archival player pages
3. University and newspaper photo archives with clear provenance
4. Reputable licensed image archives
5. Verified team-photo crop only when no individual Kentucky portrait exists

Do not use NBA or later-career images.

## 2. Preserve inputs

- Save the highest-resolution file unchanged under `original/`.
- Record source URL, retrieval date, dimensions, and rights/attribution notes.
- Never overwrite an original. `public/images/**/original/` is immutable.

## 3. Derivative processing

`scripts/derive-portraits.py` does all of it:

0. **Prefer a re-sourced original.** Where `public/images/players/resourced/<key>.jpg`
   exists it supersedes the inherited original for that player (see §4).
1. **Find the subject.** OpenCV Haar cascades locate the face. For the team-photograph
   crops the detection box is chosen by hand (see §4) rather than automatically, because
   those frames contain several people.
2. **Bound the real content.** `content_bounds()` measures gradient energy on both axes
   and trims the blurred aspect-padding the previous build left around each photograph,
   so the crop is fitted to the actual picture rather than to the padded canvas.
3. **Crop to 3:4**, with the face spanning a fixed fraction of the frame width and the
   eye line at a fixed height — the framing of a media-guide headshot. Team-photograph
   crops use a much tighter fraction (0.60 vs 0.38) or the neighbouring player appears in
   shot.
4. **Descreen — team-photograph crops only.** Those sources are photographs of a
   *printed* page and carry a halftone rosette at roughly the same 1–2px pitch as the
   facial detail. A 3×3 median at native size removes the dot grid while leaving edges
   intact. This deletes an artefact of reproduction; it adds nothing.
5. **Resample with Lanczos**, then autocontrast (cutoff 0.4, tone-preserving) and unsharp
   at output size — 95%, or 80% on descreened crops where pushing harder only resurrects
   the dot pattern.
6. **Emit responsive WebP variants** at 160/320/640w, *skipping any width above 2× the
   native crop*. A small crop simply yields fewer, smaller files; the browser picks the
   smallest adequate one from `srcset`.
7. **Prune.** Any file in `portrait/` or `no-portrait/` that this run did not produce is
   deleted, so a retracted portrait cannot survive on disk.

### The 2× rule

No variant may exceed twice its native crop width. This is enforced in the script, again
in `npm run audit:images`, and again in `tests/unit/lib.test.ts`. It is the rule that
replaced the previous build's blanket 3× upscale, which tripled both the stated dimensions
and the byte size while adding no real detail.

## 4. Re-sourcing beats every processing trick

Nine of the 58 player originals were not portraits at all — they were vertical bands
sliced out of a season team photograph, each still containing two to five people.

On 2026-08-01 an Internet Archive sweep of `ukathletics.com` recovered **official
University of Kentucky individual headshots for six players**: Jules Camara, J.P. Blevins,
Josh Carrier, Lukasz Obrzut, Michael Porter and Ramon Harris. They live in
`public/images/players/resourced/`, with every source URL and retrieval date in
`SOURCES.json` beside them, and the derivation script prefers them automatically.

At 105×145–158 these are small, but they beat what they replaced on both axes that matter:
more real pixels on the face than an 83px slice of a group, and identification by the
*publisher* rather than inference by this pipeline. Nothing under `original/` was deleted —
the superseded strips stay on disk so the substitution can be audited, and the image audit
knows not to flag them as orphans.

They are also the ceiling. Every era-official UK headshot in the archive is 105px wide, so
for the 47 players whose originals are 420×560 studio portraits (≈356px native crop),
re-sourcing would be a *downgrade* and is not done.

### The four that remain

Antwain Barbour, Matt Heissenbuttel, Mark Coury and Rashaad Carruth still show team-photo
crops. Their own UK pages reference headshots — `p-barbour_antwain.jpg`,
`p-heissenbuttel.jpg` — but those files were never captured by the Wayback Machine. Framing
them as 3:4 cards routinely centred the wrong person, so they are resolved as follows.

They are identified by **jersey number**, not by guessing at faces. Each strip has the
number the archive records for that player in that season legibly visible on a uniform;
the crop is taken from the person wearing it. The number is written into the manifest as
`jersey_number` + `identified_by: "jersey-number"` + `identified_in_season`, and both the
image audit and the unit tests re-derive it from `src/data/archive.json` — so the claim is
checked on every build rather than trusted.

**An identification the archive's own roster contradicts is not published.** If the number
in the photograph is not the number the archive records for that player that season, or if
two players shared it, the build fails. The affected player then renders as a generated
jersey card instead. See `NO_PORTRAIT` in the script.

## 5. What is never done

- **No generative upscaling, face restoration or detail synthesis on a real person.**
  Non-local-means denoising and median+NLM both produced visibly cleaner skin than the
  median descreen and were rejected for exactly that reason: they invent a plausible
  surface on a real face. Removing a halftone artefact is restoration; inventing pores is
  not.
- **No stand-in faces.** Where no image can be verified as a given player, the archive
  draws a labelled jersey card.
- **No professional, high-school or later-career photographs.** Kentucky uniforms only.

## 6. Manual review

Review every asset for correct player identity, Kentucky uniform, natural facial geometry,
no invented jersey number or lettering, consistent crop and background, acceptable
sharpness at card and modal sizes, and rights/attribution status.

## 7. Automated checks

`npm run audit:images` **fails** on a missing path, a duplicate key, a path referenced by
two entries, a path resolving outside `public/`, a truncated file, an entry with no
provenance note, a profile or team image key with no manifest record, or a manifest entry
pointing at an unknown player.

It reads PNG/JPEG/WebP headers directly and fails if the dimensions on disk differ from
the manifest, so a provenance record can never drift from the asset it describes.

It additionally fails if:

- a portrait variant exceeds 2× its recorded native crop;
- a team-photograph crop has no `jersey_number`, or one that disagrees with
  `archive.json`, or one shared by two players that season;
- an entry marked `placeholder` or `unverified-identification` still has portrait
  variants — the absence of variants is what forces the jersey-card fallback, so the audit
  checks the mechanism rather than the label.

It **warns** (without blocking) on low-resolution originals, team-photograph crops, the
placeholder, and pending rights review — tracked open items, not defects. Originals that a
re-sourced headshot superseded are recognised and not reported as orphans.

## 8. Current state

| | Count |
| --- | --- |
| Manifest entries | 70 (58 players, 10 teams, 2 interface) |
| Portrait variants served | 147 |
| Verified archival portraits | 53 players (47 inherited + 6 re-sourced) |
| Official team photographs | 10 |
| **Team-photograph crops** | **4** |
| **Shown as a jersey card, not a photograph** | **1** |
| Originals below the resolution target | 68 |

The four remaining team-photograph crops are Antwain Barbour, Matt Heissenbuttel, Mark
Coury and Rashaad Carruth. Each is flagged `Team photo · #N` wherever it appears, and the
profile dialog states that it is a crop of a group photograph, not an archival headshot.

Eric Allen is the one player with no photograph at all and is drawn as a jersey card.

Michael Porter's and Ramon Harris's headshots date from 2008-09, after the covered era.
Both carry a `portrait dates from 2008-09` flag and say so in the profile dialog.

Native crop widths run from 67px to 396px, median 356px. The nine team-photograph crops
are the small end — 67–87px — and are the only portraits that look soft at card size.
That is the real ceiling of the available sources, and it was checked: the full team
photographs hold *fewer* pixels per face (median 30px, and 45px for 2006–07) than the
strips do, so cropping from them would be a downgrade. **The fix is re-sourcing, not
another upscale.**

## 9. Replacing an image

1. Save the new source unmodified to `public/images/<kind>/original/<key>.<ext>`.
2. If it is a player portrait, delete its `MANUAL` / `NO_PORTRAIT` entry in
   `scripts/derive-portraits.py` if present, then re-run the script — it rewrites the
   manifest entry, the variants and the provenance note together.
3. Run `npm run audit:images`. The dimension cross-check catches a manifest that was not
   updated to match the new file; the jersey cross-check catches a misidentified subject.
4. If the change moves an image between confidence values, update
   `docs/KNOWN_ISSUES.md`, `docs/DATA_CHANGELOG.md` and the counts above.
