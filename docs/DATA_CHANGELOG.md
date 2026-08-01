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

## Known data quirks (not corrected)

Reported as warnings by `validate:data`, left alone pending a source check:

- **1999–00** — Keith Bogans appears in both `starters` and `rotation`.
- **2000–01** — Gerald Fitch appears in both `starters` and `rotation`.

`rotation` is an ordered list of the season's rotation players, not a strict
per-position backup chart, so this is not necessarily an error. The Lineup Lab states
that on the depth-chart card. Worth reconciling against a media guide.
