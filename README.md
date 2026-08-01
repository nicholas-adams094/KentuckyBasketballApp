# Big Blue Archive

**Kentucky men's basketball — the complete Tubby Smith era, 1997–2007.**

An interactive, fully offline-capable archive of ten seasons: 58 player profiles, 145
roster entries, 346 games, every postseason path, and a set of clearly-labelled derived
analytics computed from the archive's own data.

Built as a static Vite + React + TypeScript application with **no runtime dependencies
beyond React** — no charting library, no icon package, no CDN, no tracking, no
third-party network requests of any kind. The built bundle runs from any static host, a
subdirectory, or a local folder.

---

## Quick start

```bash
npm install
npm run validate:data     # historical data integrity gate
npm run audit:images      # image + provenance audit
npm run dev               # http://localhost:5173
```

Full pre-commit check:

```bash
npm run check             # validate + audit + lint + build + unit tests
npm run test:e2e          # Playwright, desktop + mobile
```

Playwright needs its browsers once: `npx playwright install chromium`.

---

## What's in it

| View | What it does |
| --- | --- |
| **Season HQ** | Records, the season story, statistical leaders, per-game form strip, margin chart, signature moments, honors, and venue/competition splits. |
| **Roster & Stats** | All players as cards or a sortable table. Search by name, hometown, high school, jersey number or position. Favorites persist locally. CSV export. |
| **Lineup Lab** | Build any five from the roster, score it against the decade, load optimizer presets, save lineups locally, and share a five via URL. |
| **Schedule** | Every game with venue, score, margin bar, competition stage, filters, opponent search, a cumulative record trace, and CSV export. |
| **Postseason** | SEC and NCAA Tournament paths with round labels normalised across seasons, plus a decade-wide map of how deep each March went. |
| **Compare** | Up to four player-seasons side by side — from any seasons, including the same player in different years — with bar and radar comparisons. |
| **Era Vault** | Decade leaderboards, a computed all-decade five, rival head-to-head records, a multi-season career table with sparklines, and decade totals. |
| **Sources** | Every cited source, every photo credit, the full image provenance manifest, the exact method behind each derived metric, and the editorial standards. |

### Things worth knowing about

- **Command palette** — `⌘K` / `Ctrl-K` (or `/`) searches players, seasons, games,
  opponents and sections from anywhere. Full keyboard operation, ARIA combobox pattern.
- **Everything is deep-linkable.** Season, view, open profile, roster filters, schedule
  filters, comparison selection and the current lineup all live in the URL.
- **Light and dark themes**, plus a compact density mode, applied before first paint so
  there is no flash of the wrong theme.
- **Print stylesheet** turns any view into a clean media-guide page.
- **Graceful degradation** — if `localStorage` is unavailable the archive stays fully
  usable and says so, rather than breaking.

---

## Architecture

```
src/
  data/          archive.json + photo-manifest.json  (source of truth, never mutated)
  types/         the data contract, including the competition-phase taxonomy
  lib/           archive indices, analytics, tournament normalisation, search,
                 routing, formatting, storage
  state/         navigation, preferences and toast providers
                 (React context — no global mutable singleton)
  components/    layout chrome, UI primitives, charts, player + opponent dialogs
  views/         one module per view, lazily loaded
  styles/        design tokens → base → layout → components → views → print
scripts/         validate-data.mjs, audit-images.mjs  (both gate the build)
tests/unit/      Vitest — analytics, formatting, routing, search, tournament, storage
tests/e2e/       Playwright — shell, features, accessibility (desktop + mobile)
```

Key decisions and why:

- **Hash routing.** The archive must run from a subdirectory, a static host, a file share
  or fully offline with no server rewrite rules. A hash router is the only thing that
  works everywhere unchanged.
- **Data is loaded once and indexed at module load.** Views treat lookups as constants;
  nothing mutates archive data.
- **Derived analytics live in one module** (`src/lib/analytics.ts`) and are labelled as
  derived everywhere they surface. See [docs/ANALYTICS.md](docs/ANALYTICS.md).
- **Charts are hand-built SVG.** Themeable, printable, screen-reader-described, and zero
  bytes of dependency.
- **Error boundaries per view.** A failure in one view cannot blank the archive — the
  exact failure mode the original single-file build suffered from.

---

## Data integrity

`npm run validate:data` is a hard gate. It fails the build on any of:

- a roster entry with no matching profile, or a documented starter not on the roster
- a stated record that does not reconcile with the game log
- a game whose result contradicts its score, or whose margin is not `uk − opp`
- an SEC record that does not match the SEC-flagged regular-season games
- postseason or exempt-tournament games incorrectly flagged as conference games
- seasons out of chronological order, or games out of date order within a season
- a profile or team image key with no manifest entry

It currently reports **263–83 overall and 120–40 in SEC regular-season play** across 346
games, reconciled from the game log rather than taken on trust.

`npm run audit:images` verifies every manifest path exists inside `public/`, that no file
is truncated, that no path is referenced twice, and — importantly — that the dimensions
recorded in the manifest **match the actual files on disk**. It warns (without failing) on
the known open items: low-resolution originals, the four team-photograph crops, and
pending rights review. It **fails** if a portrait claims more than 2x the resolution of
its native crop, or if a crop names a jersey number the archive's own roster
contradicts.

---

## Editorial standards

These are enforced by the validators and by the interface itself:

- No historical statistic, result, roster entry, award or record is invented, inferred or
  silently altered. Corrections go in [docs/DATA_CHANGELOG.md](docs/DATA_CHANGELOG.md)
  with old value, new value, source and date.
- Every derived metric is labelled as derived and never presented as an official
  statistic. The method is documented in [docs/ANALYTICS.md](docs/ANALYTICS.md) and
  restated in the Sources view.
- Player imagery is Kentucky-uniform only.
- **Six portraits are official University of Kentucky headshots** recovered from Internet
  Archive captures of `ukathletics.com`, replacing crops of team photographs. Every source
  URL and retrieval date is recorded in `public/images/players/resourced/SOURCES.json`, and
  the superseded originals stay on disk so the substitution can be audited.
- **Four portraits remain crops of a team photograph**, each identified by the jersey
  number the archive records for that player that season — a claim the build re-derives
  from the data rather than takes on trust. They are flagged `Team photo · #N` wherever
  they appear and are never described as archival headshots.
- **One player (Eric Allen) is shown as a jersey card**, because no verified image of him
  has been located. Where no image can be verified, the archive draws a generated jersey
  card — never a stand-in face.
- **Two portraits post-date the era** and say so on the card and in the dialog.
- All-decade selections and lineup ratings are explicitly computed fan opinion.

## Rights

**Image rights review is not complete.** Every manifest entry is marked
`required-before-publication`. `public/robots.txt` disallows indexing and the page is
marked `noindex`. Treat this as a private, non-commercial editorial archive until that
review is finished. See
[docs/COPYRIGHT_AND_ATTRIBUTION.md](docs/COPYRIGHT_AND_ATTRIBUTION.md).

This is an independent fan project. It is not affiliated with, endorsed by, or sponsored
by the University of Kentucky, the Southeastern Conference or the NCAA.

---

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — module map and design decisions
- [docs/ANALYTICS.md](docs/ANALYTICS.md) — every derived metric, defined
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md) — the JSON contract and its quirks
- [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md) — what was done and how it is verified
- [docs/TESTING.md](docs/TESTING.md) — what each suite covers
- [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) — open items, honestly stated
- [docs/PHOTO_PIPELINE.md](docs/PHOTO_PIPELINE.md) — image sourcing and restoration rules
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — release checklist
- [docs/MIGRATION_NOTES.md](docs/MIGRATION_NOTES.md) — what changed from the original export
