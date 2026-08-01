# Architecture

## Shape

```
index.html                  theme applied pre-paint; noscript fallback
src/main.tsx                providers → App, wrapped in the outermost error boundary
src/App.tsx                 shell + lazily-loaded views + global shortcuts

src/data/                   archive.json, photo-manifest.json — source of truth
src/types/archive.ts        the data contract + competition-phase taxonomy

src/lib/
  archive.ts                loads the JSON once and builds every index
  analytics.ts              all derived metrics (see docs/ANALYTICS.md)
  tournament.ts             postseason round normalisation
  search.ts                 the command-palette index
  router.ts                 hash-route parsing and building
  format.ts                 presentation-only formatters
  storage.ts                localStorage with graceful degradation
  scroll.ts                 focus-safe horizontal scrolling

src/state/
  navigation.ts(x)          route state; the URL is the single source of truth
  preferences.ts(x)         theme, density, favorites, saved lineups
  toast.ts(x)               transient confirmations

src/components/
  layout/                   TopBar, Hero, SeasonRail, MainNav, Footer
  ui/                       Icon, Dialog, Toaster, ErrorBoundary, charts
  player/                   PlayerPortrait, PlayerDialog
  CommandPalette.tsx        ⌘K search
  OpponentDialog.tsx        head-to-head panel

src/views/                  one module per view, code-split
src/styles/                 tokens → base → layout → components → views → print
```

## Decisions

### Hash routing, not a router library

The archive is a static bundle that must run from a subdirectory, a static host, a file
share, or fully offline, with no server rewrite rules available. A hash router is the
only option that works in all of those unchanged, and it needs about 120 lines. Adding
React Router would add a dependency and a deployment constraint for no gain here.

`window.location.hash` is the single source of navigation truth. Every navigation writes
the hash and lets the `hashchange` listener drive state, so browser back/forward, a
pasted deep link and an in-app click all take exactly the same code path.

**Everything meaningful lives in the URL**: season, view, open profile, roster search /
role filter / sort key / sort direction / favorites-only, schedule filter and opponent
search, comparison selection, and the current Lineup Lab five. Any screen can be shared.

One subtlety worth knowing: `buildHash`'s `playerId` is tri-state — a string opens a
player, `null` closes one, and omitting it leaves whatever `params` already says.
Treating "omitted" as "close" silently stripped the parameter a caller had just set.

Similarly, `setParam` writes one parameter per navigation. Two calls in the same handler
would each read the same pre-update route and the second would discard the first, so
anything changing multiple parameters at once uses `setParams`.

### Data indexed once at module load

`src/lib/archive.ts` builds every index (player-seasons, careers, games, image lookups,
era totals) when the module is first imported. Views treat these as constants. Nothing
mutates archive data, so there is no cache-invalidation problem and no global mutable
singleton.

### Analytics isolated in one module

Every derived number comes from `src/lib/analytics.ts`, is documented in
[ANALYTICS.md](ANALYTICS.md), and is labelled as derived in the interface. Keeping the
derivations in one place is what makes it practical to state the method honestly and to
test it exhaustively.

### Hand-built SVG charts

`src/components/ui/charts.tsx` implements line, margin-bar, radar, sparkline and meter.
A charting library would add 40–150 kB, would need theme plumbing to respect the CSS
custom properties, and generally does not print well. These do all three, and each chart
carries `role="img"` plus a `<title>` and `<desc>` so screen readers get the data, not
just "graphic".

### Per-view error boundaries

Each view renders inside its own `ErrorBoundary`, keyed on view + season. A failure in
one view leaves navigation and every other view working and offers a retry — the blank
screen that the original monolithic build produced is structurally impossible here.

### Styling: tokens, no framework

Six CSS files layered tokens → base → layout → components → views → print. Every colour
is semantic (`--surface`, `--text-muted`), so light and dark stay in lockstep.

The one distinction worth calling out: **chrome that is dark in both themes** (top bar,
season rail, footer, editorial cover panels) uses a separate `--ink-panel-*` family.
Using `--surface-inverse` for those inverted them in dark mode and produced light text on
a light bar. That is exactly the kind of bug an automated contrast sweep catches and a
screenshot does not.

### Accessibility is verified, not assumed

See [ACCESSIBILITY.md](ACCESSIBILITY.md). Notably, the season rail and section nav scroll
by writing `scrollLeft` rather than calling `scrollIntoView`, because in Chromium
`scrollIntoView` moves the sequential focus navigation starting point — which made the
first Tab press skip the skip link and every header control.

### Bundle

React plus the archive data. Views are code-split; the initial load carries the shell and
Season HQ only. There are no third-party network requests at runtime — no fonts, no CDN,
no analytics — which is what makes the offline and file-share cases work.

```
vendor        ~194 kB  (61 kB gzip)   React + React DOM
archive-data  ~192 kB  (28 kB gzip)   the historical JSON
app shell     ~67 kB   (22 kB gzip)
each view     6–13 kB  (2–4 kB gzip)
css           ~57 kB   (11 kB gzip)
```

## Extending it

- **A new derived metric** → `src/lib/analytics.ts`, a test in
  `tests/unit/analytics.test.ts`, an entry in `docs/ANALYTICS.md`, and a "Derived" label
  wherever it renders.
- **A new view** → add it to `VIEWS` and `VIEW_META` in `src/lib/router.ts`, create
  `src/views/YourView.tsx`, lazy-import it in `App.tsx`, add an icon in `MainNav`, and add
  a search document in `src/lib/search.ts`.
- **A data correction** → edit `src/data/archive.json`, log it in
  `docs/DATA_CHANGELOG.md` with old value, new value, source and date, then run
  `npm run validate:data`. If it changes a headline total, update the assertion in
  `tests/unit/archive.test.ts` in the same commit.
