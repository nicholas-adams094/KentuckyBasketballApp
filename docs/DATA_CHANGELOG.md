# Historical data changelog

Every change to a roster entry, statistic, game result, award, ranking or season summary
is recorded here with its source. A change that is not logged here should be treated as a
mistake and reverted.

## Process

1. Edit `src/data/archive.json`.
2. Add a row below with the old value, the new value, the source and the date.
3. Run `npm run validate:data`.
4. If the change moves a headline total, update the matching assertion in
   `tests/unit/archive.test.ts` **in the same commit** — those assertions exist precisely
   so that an unlogged change fails the build.

## Changes

| Date | Entity | Field | Old value | New value | Source | Rationale |
|---|---|---|---|---|---|---|
| — | — | — | — | — | — | No historical data has been altered. |

## Interpretation changes (no data edited)

Changes to how stored data is *read*. The JSON is untouched in every case.

| Date | Area | Change | Rationale |
|---|---|---|---|
| 2026-08-01 | Competition phases | `GamePhase` widened from 3 values to the 5 actually present in the data (`Maui Invitational`, `Guardians Classic` added) | The exported type was wrong about its own data. Eight games sat under event names; code filtering conference play on `phase === 'Regular Season'` silently dropped them. Conference play is now decided by the `sec` flag. |
| 2026-08-01 | SEC Tournament titles | Derived from the championship-game result instead of parsing the `conferenceFinish` prose | `conferenceFinish` wording varies by season; 2002–03 reads "SEC regular-season & tournament champions", which a "SEC Tournament champions" match misses. The count is five: 1997–98, 1998–99, 2000–01, 2002–03, 2003–04. |
| 2026-08-01 | Tournament rounds | Round labels normalised at read time in `src/lib/tournament.ts` | Wording differs between seasons (`NCAA Sweet Sixteen` vs `Sweet 16`). Both are faithful to their sources, so the data is left as-is and the reader is normalised. |
| 2026-08-01 | Season totals | Team-share calculations reconstruct season totals as `rate × gamesPlayed` | The archive stores per-game rates only. Reconstructed totals will differ slightly from official season totals; the Sources view says so. |
| 2026-08-01 | Player portraits | All 56 portraits re-derived from the immutable originals by `scripts/derive-portraits.py`; the previous blanket 3× upscales under `public/images/players/processed/` deleted | The inherited derivatives had three defects no upscale could fix: nine were vertical strips of a team photograph still containing two to five people, all were padded to 3:4 with a blurred copy of themselves, and every one was tripled in size without gaining detail. Derivatives are now cropped, capped at 2× the native crop, and served responsively. No historical data was touched. |
| 2026-08-01 | Portrait identification | The nine team-photograph crops are identified by jersey number, cross-checked against `archive.json` by both the image audit and the unit tests | Converts an unverifiable "which of these five men is he" guess into an auditable claim. Each number matches the one the archive records for that player in that season, and each is unique on that roster. |
| 2026-08-01 | Player profiles | `photoNote` and `photoType` removed from all 58 profiles in `archive.json` | Duplicated image provenance that no code read and that the manifest now contradicted — 48 profiles still claimed "Upscaled Kentucky-uniform archival headshot" after the upscales were deleted, and 9 called a crop a "rebuilt portrait". `photo-manifest.json` is the single source of truth for image provenance. No historical fact, statistic, roster entry, award or record was touched. |
| 2026-08-01 | `uk_ramon_harris` | Confidence `verified-in-game-photograph` → `unverified-identification`; portrait variants withdrawn | The photograph showed a Kentucky player wearing **#5**. This archive records Ramon Harris as **#22** in 2006–07 — the only season it covers for him — and records **#5** that season as **Derrick Jasper** (`src/data/archive.json`, 2006–07 roster). The subject could not be identified from the archive's own data, so it was not published as him. No roster data was altered; the archive's existing numbers are what falsified the identification. *Superseded later the same day — see the re-sourcing row below.* |
| 2026-08-01 | Six player portraits | Re-sourced from official University of Kentucky individual headshots recovered from Internet Archive captures of `ukathletics.com`: Jules Camara, J.P. Blevins, Josh Carrier, Lukasz Obrzut, Michael Porter and Ramon Harris | Each of the six previously showed a crop of a season team photograph — a strip containing two to five people — or, for Harris, nothing at all. The replacements are individual headshots published by the university on the player's own bio/roster page or in its `m-baskbl/auto_headshot` directory, so identification comes from the publisher rather than from this pipeline inferring a jersey number. Nothing under `public/images/players/original/` was deleted; the superseded strips remain on disk beside the new sources, and `public/images/players/resourced/SOURCES.json` records every URL and retrieval date. Harris consequently returns to a published portrait and leaves `unverified-identification`. |
| 2026-08-01 | `uk_michael_porter`, `uk_ramon_harris` | New field `photo_season_note`, set to "portrait dates from 2008-09" | The only official Kentucky headshots that survive for these two date from after the Tubby Smith era. They are the right player in a Kentucky uniform, but they are not contemporary with the seasons they are displayed beside, so both the card flag and the profile dialog say so. Preferred over showing no photograph, but not presented as era imagery. |

## Known data quirks (not corrected)

Reported as warnings by `validate:data`, left alone pending a source check:

- **1999–00** — Keith Bogans appears in both `starters` and `rotation`.
- **2000–01** — Gerald Fitch appears in both `starters` and `rotation`.

`rotation` is an ordered list of the season's rotation players, not a strict
per-position backup chart, so this is not necessarily an error. The Lineup Lab states
that on the depth-chart card. Worth reconciling against a media guide.
