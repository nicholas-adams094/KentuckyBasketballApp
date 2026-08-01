# Deployment

The build output in `dist/` is a fully static bundle with `base: './'`, so every asset
reference is relative. It runs from any static host, from a subdirectory, and from a
local folder. There is no server component and no runtime configuration.

```bash
npm run build     # → dist/
npm run preview   # serve dist/ locally at http://localhost:4173
```

## Release checklist

Do not skip a step and do not deploy on a partial pass.

**1. Gates**

```bash
npm run validate:data
npm run audit:images
npm run lint
npm run build
npm run test:unit
npm run test:e2e
```

`npm run check` covers everything except the e2e suite.

**2. Confirm the reported totals**

`validate:data` should print 10 seasons, 58 profiles, 145 roster entries, 346 games,
263–83 overall and 120–40 in SEC regular-season play. If any of these changed, there must
be a matching entry in [DATA_CHANGELOG.md](DATA_CHANGELOG.md) with a source — otherwise
something broke.

**3. Manual review**

- All ten seasons open in all eight views.
- Player profiles open from a card, a table row, a leaderboard row and a deep link.
- Team-photograph crops and both jersey-card entries are visibly flagged.
- Light and dark themes both read correctly, including the top bar and season rail.
- Mobile (390px): no horizontal scrolling on any view.
- Print preview of Season HQ and a player profile.
- Offline: load, then disconnect and navigate — everything should keep working.

**4. Rights review — blocking**

Image rights are **not** cleared. Before any public deployment:

- Review the licence or permission status of every entry in `photo-manifest.json`.
- Preserve required attribution.
- Remove or replace anything that cannot be used in the intended context.
- Confirm the team-photograph crops cannot be mistaken for official imagery.
- Update `rights_review_status` in the manifest and revise
  [COPYRIGHT_AND_ATTRIBUTION.md](COPYRIGHT_AND_ATTRIBUTION.md).

Until this is done, keep the deployment private. `public/robots.txt` disallows crawling
and `index.html` is `noindex`; remove both only after the review passes.

**5. Tag and record**

Tag the release commit, and note the deployed version and the rollback point.

## Hosting notes

**Subdirectory** — works as-is; `base: './'` and hash routing need no rewrite rules.

**GitHub Pages** — publish `dist/`. No SPA fallback needed, because routing is in the hash.

**Local / file share** — open `dist/index.html` directly. Some browsers restrict ES module
loading over `file://`; serving the folder with any static server avoids that.

**Offline** — no third-party requests are made at runtime, so once the bundle and images
are cached the archive is fully functional offline. There is no service worker, so the
first visit still needs a network.

## Sizes

Roughly 500 kB of JavaScript and CSS (about 125 kB gzipped) plus 15.5 MB of images. Images
are lazy-loaded everywhere except the current hero, so a first paint transfers far less
than the total.
