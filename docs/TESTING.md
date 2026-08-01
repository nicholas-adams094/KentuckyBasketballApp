# Testing

```bash
npm run validate:data   # historical integrity gate — fails the build
npm run audit:images    # image + provenance audit — fails the build
npm run lint            # ESLint, incl. jsx-a11y and react-hooks
npm run test:unit       # Vitest
npm run test:e2e        # Playwright, desktop + mobile
npm run check           # validate + audit + lint + build + unit
```

Playwright needs browsers once: `npx playwright install chromium`.

## The gates

### `validate-data.mjs`

Enforces every invariant in [DATA_MODEL.md](DATA_MODEL.md) and exits non-zero on any
violation. Full list there; the ones that matter most are that stated records must
reconcile with the game log, results must agree with scores, and starters must be on the
roster. It currently reports 263–83 overall and 120–40 in SEC play across 346 games,
derived rather than trusted.

### `audit-images.mjs`

Fails on a missing file, a duplicate key, a path referenced twice, a path escaping
`public/`, a truncated asset, an entry with no provenance note, or a profile/team image
key with no manifest record. It also reads PNG/JPEG/WebP headers directly and fails if
the dimensions on disk differ from the manifest, so provenance records cannot drift from
the assets they describe.

Warnings (non-blocking) cover the known open items: 68 low-resolution originals, 9
reconstructions, 1 placeholder, 70 entries pending rights review.

## Unit tests — Vitest (86 tests)

**`archive.test.ts`** pins the headline facts (10 seasons, 58 profiles, 145 roster
entries, 346 games, 263–83, 120–40, 23–9 in the NCAA Tournament), asserts every roster
entry maps to a profile and every starter is on their roster, and checks that every image
key resolves.

If a data edit breaks one of these, that is either a sourced correction — update the
assertion and `DATA_CHANGELOG.md` together — or a mistake, which is the point.

**`analytics.test.ts`** covers every derived metric: per-40 suppression below 4 mpg, the
turnover inversion, impact ratings staying inside 1–99, team shares summing to exactly 1
per season, split coverage (including the eight early-season-event games), streak
detection, record traces ending at wins − losses, leaderboard ordering and the minutes
floor, minutes-weighted career averages, lineup legality and duplicate penalties, and the
optimizer returning five distinct players for every season × objective.

**`lib.test.ts`** covers formatting, hash routing (including fallbacks for every malformed
input and the `playerId` tri-state), the search index, tournament round normalisation, and
storage degradation.

### Two real bugs these caught

- **`/final\b/` matched "semi**final**"** in the SEC round classifier. The archive would
  have reported seven SEC Tournament titles instead of five and shown 2004–05 — who lost
  the championship game — as champions.
- **`localStorage` failure handling** could not be tested by assigning to
  `localStorage.setItem`, because jsdom's `Storage` is a Proxy that stores that as a key.
  The test spies on `Storage.prototype` instead.

## E2E tests — Playwright (desktop 1440×900 + Pixel 7)

Every test runs against a page that records console errors, uncaught exceptions and
failed/4xx/5xx requests, and asserts all three are empty. The archive makes no
third-party requests, so any of them is a real defect.

**`shell.spec.ts`** — boots from a bare URL and normalises to a shareable route; renders
**all 8 views × all 10 seasons** with a non-empty heading and zero broken images (80
combinations); falls back cleanly from a nonsense route; keeps the document title in step;
supports click navigation and browser back; checks no horizontal overflow on any view;
persists the theme across a reload.

**`features.spec.ts`** — opens **every profile on a roster** and closes each with Escape;
deep-links a profile; roster search, filters and sorting with `aria-sort`; favorite
persistence across reload; schedule filters and counts, including that the eight
early-season-event games are separated from conference play; opponent head-to-head panel;
Lineup Lab presets, share links, duplicate-player warning, and save/delete surviving a
reload; comparison slots; derived Era Vault totals; the 1998 title run in canonical round
order; 2004–05 read as SEC runner-up; the Sources provenance filters.

**`a11y.spec.ts`** — see [ACCESSIBILITY.md](ACCESSIBILITY.md).

### Two real bugs these caught

- **`buildHash` stripped the `player` parameter** that `openPlayer` had just set, because
  `playerId` was omitted from the call. Clicking a player card did nothing; only the
  `#/player/…` path form worked.
- **`scrollIntoView` moved the sequential focus starting point**, so the first Tab press
  skipped the skip link and every header control.

## Development scripts

In `tools/`, not wired into CI — review aids rather than pass/fail gates. Each expects a
preview server on `http://127.0.0.1:4173`.

- `tools/contrast.mjs` — WCAG sweep over every view in both themes. Re-run after any
  design-token change.
- `tools/smoke.mjs` — fast broken-image / console-error / overflow sweep across all
  seasons and views, desktop and mobile.
- `tools/shots.mjs` — screenshot set for visual review.

## CI

`.github/workflows/ci.yml` runs the data and image gates, lint, typecheck, build, unit
tests and the full Playwright matrix on every push and pull request, and uploads the
Playwright report on failure.
