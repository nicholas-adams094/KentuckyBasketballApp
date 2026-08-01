# Migration notes

What this build is, relative to the `Kentucky_Wildcats_Tubby_Smith_Codex_Export` package
it was rebuilt from.

## What came from the export, unchanged

- `src/data/archive.json` — the historical data, byte-for-byte.
- `src/data/photo-manifest.json` — the provenance manifest, unchanged.
- `public/images/**` — all 140 image files (70 originals, 70 processed), unchanged.
- The editorial rules in the original `AGENTS.md`, which this build follows.

`reference/` keeps the raw archive snapshot, the manifest CSV, the checksums, and a
base64-stripped copy of the legacy monolithic HTML for behavioural comparison. The 4.3 MB
original is not committed; stripping the embedded data URIs leaves 242 kB of markup, CSS
and application code, which is the part worth keeping.

## What was rebuilt

The export shipped a deliberately incomplete scaffold: three components rendering season
cards and six portraits. Everything else in this repository is new — the shell, all eight
views, the state layer, the analytics engine, the charts, the search index, the design
system, both validators, and all the tests.

## Corrections to the export's own assumptions

Three things in the export were wrong about its own data, and the rebuild fixes them.

**1. The phase taxonomy was incomplete.** `src/types/archive.ts` declared
`GamePhase = 'Regular Season' | 'SEC Tournament' | 'NCAA Tournament'`, but the data
contains five values — Kentucky played eight games in exempt early-season events (Maui
Invitational 2002–03 and 2006–07, Guardians Classic 2005–06) recorded under the event
name. Any code filtering conference play on `phase === 'Regular Season'` silently drops
those eight games. The type now models all five phases, and conference play is decided by
the `sec` flag. See [DATA_MODEL.md](DATA_MODEL.md).

**2. Postseason facts were derived from prose.** The legacy build read SEC Tournament
titles out of the `conferenceFinish` sentence, whose wording varies by season — 2002–03
says "SEC regular-season & tournament champions", which a "SEC Tournament champions"
match misses. Titles are now derived from the championship-game result. Five, correctly:
1997–98, 1998–99, 2000–01, 2002–03, 2003–04.

**3. Round labels are inconsistent between seasons** and cannot be compared directly.
`src/lib/tournament.ts` normalises them at read time; the data is untouched.

## Architectural changes

| Legacy | Now | Why |
| --- | --- | --- |
| One 4.3 MB HTML file | Vite + React + strict TypeScript, code-split per view | The monolith had blank-screen bootstrap failures from syntax errors and duplicate declarations |
| Base64 images inline | File-based under `public/images/` | Editing one image no longer rewrites a multi-megabyte object |
| Global mutable `state` object | React context, URL as the source of truth | Every screen is deep-linkable and back/forward work |
| `innerHTML` string templates | Components with typed props | No manual escaping; the compiler catches shape errors |
| No error handling | Per-view error boundaries | One broken view cannot blank the archive |
| `document.querySelector` wiring | Declarative rendering | The class of bug that broke the legacy build is structurally absent |

## Feature parity, and beyond

Everything the legacy build did is here: ten-season navigation, season overview with team
photograph, searchable/sortable rosters and profiles, career progression, complete
schedules and filters, SEC/NCAA postseason paths, starting lineups and depth charts, the
Lineup Lab, player comparison, the Era Vault, leaderboards, rival records, favorites,
saved lineups, and desktop/tablet/mobile/print/offline behaviour.

Added on top:

- Command palette (⌘K) over players, seasons, games, opponents and sections
- Deep links for every piece of state, including a shareable Lineup Lab five
- An era-relative analytics engine — per-40 rates, team share, z-scores, percentiles,
  a composite impact rating — all documented and tested
- Season splits, streaks, record traces and margin charts
- Comparison of up to four player-seasons, with radar and bar views
- A computed all-decade five, derived rather than hand-picked
- Decade-wide opponent head-to-head panels
- Light/dark themes and a compact density mode
- CSV export for rosters and schedules
- Visible provenance flags on team-photograph crops and both jersey-card entries, everywhere
- A Sources view that states the method behind every derived number
- Two build-gating validators, 97 unit tests and 42 e2e tests across two viewports

## Milestone status

The export's `MIGRATION_PLAN.md` defined ten milestones. Milestones 0–6 and 8 (baseline,
shell, overview, roster, lineup, schedule, postseason, compare, era vault, QA) are
complete and verified by the test suites.

**Milestone 7 (image re-sourcing) is not done** and cannot be done from this repository
alone — it requires locating higher-resolution originals from external archives. The
manifest records exactly which 68 assets need it. **Milestone 9 (deployment) is blocked**
on the rights review. Both are tracked in [KNOWN_ISSUES.md](KNOWN_ISSUES.md).
