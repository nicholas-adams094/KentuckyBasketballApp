# Data model

`src/data/archive.json` is the source of historical truth. `src/types/archive.ts` is its
TypeScript contract. `scripts/validate-data.mjs` enforces the invariants below and gates
the build.

## Top level

```jsonc
{
  "profiles":     { "<player-id>": PlayerProfile },  // 58
  "seasons":      [ Season ],                        // 10, chronological
  "sources":      [ SourceReference ],               // 16
  "photoCredits": [ PhotoCredit ]                    // 12
}
```

Player ids are kebab-case (`rajon-rondo`). Season ids are `YYYY-YY` (`2002-03`).

## PlayerProfile

One per person, shared across every season they appear in.

| Field | Notes |
| --- | --- |
| `name`, `pos`, `height`, `weight` | `height` is `F-I` (`6-5`); `pos` is a loose label like `G`, `G/F`, `F/C` |
| `hometown`, `highSchool` | both indexed by roster search |
| `image` | manifest key; must resolve in `photo-manifest.json` |
| `bio`, `legacy` | prose |
| `photoNote`, `photoType`, `photoSeason` | provenance hints, superseded by the manifest |

## Season

| Field | Notes |
| --- | --- |
| `record`, `secRecord` | `[wins, losses]`; both must reconcile with the game log |
| `finish` | NCAA result as prose (`National Champion`, `Elite Eight`, `Round of 32`, …) |
| `conferenceFinish` | prose; **wording varies by season** — do not parse it for facts |
| `seed`, `apPre`, `apFinal` | `apFinal` is `null` for unranked seasons (2005–06, 2006–07) |
| `ppg`, `oppPpg`, `margin` | season averages as published |
| `signature`, `story`, `highlights`, `awards` | editorial content |
| `starters` | `{ PG, SG, SF, PF, C }` → player ids, all on the roster, all distinct |
| `rotation` | ordered list of rotation players; **not** a per-position backup chart |
| `roster` | `PlayerSeason[]` |
| `games` | `Game[]`, in date order |
| `teamImage` | manifest key |

## PlayerSeason

`id`, `number`, `year` (`Fr`/`So`/`Jr`/`Sr`/`RS Jr`/`RS Sr`), `role`
(`Starter`/`Rotation`/`Reserve`/`Limited`/`Inactive`/`Redshirt`/`Walk-on`), `gp`, and
per-game `mpg`, `ppg`, `rpg`, `apg`, `spg`, `bpg`, `tov`, plus `awards[]` and an optional
`note`.

**Only per-game rates are stored — no totals, no shooting splits, no possessions.** Every
derived metric works within that limit; see [ANALYTICS.md](ANALYTICS.md).

## Game

`date` (ISO), `loc` (`H`/`A`/`N`), `opponent`, `result` (`W`/`L`), `uk`, `opp`, `margin`,
`phase`, `sec`, optional `note` and `overtime` (`OT`, `2OT`).

### Competition phases — read this one

There are **five** phase values, not three. The original export's type declared three and
was wrong about its own data.

| Phase | Count | Postseason? | SEC-flagged? |
| --- | --- | --- | --- |
| `Regular Season` | 281 | no | sometimes |
| `Maui Invitational` | 6 | no | never |
| `Guardians Classic` | 2 | no | never |
| `SEC Tournament` | 25 | yes | never |
| `NCAA Tournament` | 32 | yes | never |

The two named events are exempt early-season multi-team tournaments (Maui in 2002–03 and
2006–07, the Guardians Classic in 2005–06). They count toward the regular-season record
and are always non-conference.

**Anything deciding "is this a conference game?" must test the `sec` flag, not
`phase === 'Regular Season'`.** Filtering on the phase string silently drops those eight
games. `src/types/archive.ts` exports `REGULAR_SEASON_PHASES`, `POSTSEASON_PHASES`,
`isPostseasonPhase()` and `isExemptTournamentPhase()` so no view has to hardcode this.

### Tournament round notes

`note` records the round, but wording differs by season — 1997–98 through 2001–02 use
`NCAA First Round` / `NCAA Sweet Sixteen`; 2002–03 onward use `Round of 64` / `Sweet 16`.
Both are faithful to their sources, so the data is left alone and `src/lib/tournament.ts`
normalises them at read time.

## Invariants enforced by `validate:data`

**Structure** — exactly 10 seasons, first `1997-98`, last `2006-07`, chronological; season
ids unique and well-formed.

**Games** — dates well-formed and non-decreasing within a season; valid location, result
and phase; integer scores; `margin === uk - opp`; no ties; `result` agrees with the score;
postseason and exempt-event games never SEC-flagged.

**Records** — `games.length === wins + losses`; the game log's W/L counts equal the stated
record; the SEC record equals the SEC-flagged regular-season games; the aggregate across
all ten seasons reconciles both overall and in SEC play.

**Rosters** — every entry maps to a profile; no duplicate player in a season; all box-score
fields present, numeric and non-negative; `gp` never exceeds team games; no statistics
recorded for a player with zero games.

**Lineups** — all five starting positions filled, all on the roster, all distinct; every
rotation id on the roster.

**Content** — non-empty story and signature; well-formed highlights (3-tuples) and awards
(2-tuples); every source and photo credit has a valid URL.

**Images** — every profile image key and team image key exists in the manifest.

Warnings (reported, non-blocking) cover known data quirks: a player listed both as a
starter and in the rotation list (1999–00, 2000–01), profiles never used on a roster, and
implausible-but-possible values.

## Photo manifest

`src/data/photo-manifest.json` — 70 entries (58 players, 10 teams, 2 interface). Each
records the immutable extracted `original_path`, the display `processed_path`, both sets
of dimensions, `photo_type`, `photo_note`, `confidence`, `derivative_method`,
`needs_resourcing`, and visual/rights review status.

`confidence` drives what the interface says about an image:

| Value | Count | Interface behaviour |
| --- | --- | --- |
| `verified-archival` | 50 | shown normally |
| `verified-official-team-photo` | 10 | team photographs |
| `verified-source-derived-portrait` | 9 | **flagged "Reconstruction"** wherever it appears |
| `placeholder` | 1 | **flagged "Placeholder"**; never described as a likeness |

`audit-images.mjs` additionally verifies that the recorded dimensions match the files on
disk, so a manifest entry can never drift from the asset it claims to describe.
