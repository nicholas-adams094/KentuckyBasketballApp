# Known issues and open items

Honestly stated. Nothing here is hidden by the interface — the archive flags each of
these where a reader would encounter it.

## Images

1. **Rights review is not complete.** All 70 manifest entries are marked
   `required-before-publication`. `public/robots.txt` disallows indexing and the page is
   `noindex`. Do not deploy publicly until this is resolved. See
   [COPYRIGHT_AND_ATTRIBUTION.md](COPYRIGHT_AND_ATTRIBUTION.md).

2. **Nine portraits are reconstructions**, derived from official team photographs rather
   than individual archival headshots: Jules Camara, Antwain Barbour, Josh Carrier, Matt
   Heissenbuttel, Lukasz Obrzut, Michael Porter, Mark Coury, J.P. Blevins and Rashaad
   Carruth. Each is flagged "Reconstruction" on its card, in the Era Vault, and in the
   Sources manifest, and the profile dialog states plainly that it is not an archival
   headshot. Replace with verified individual portraits when they can be located.

3. **Eric Allen has no verified image.** A labelled placeholder is shown and marked
   "Placeholder" everywhere. This must stay labelled until a verified Kentucky-uniform
   photograph is found. The archive never substitutes a stand-in face.

4. **Originals are low resolution.** 58 of 68 player originals are 420×560; several team
   photographs are under 1,000px wide (1999–00 is only 528×305). These are the files
   extracted from the previous build, not the best available historical sources. The
   processed derivatives were upscaled, which increased display dimensions without adding
   genuine detail. The correct fix is re-sourcing from originals, not further upscaling —
   see [PHOTO_PIPELINE.md](PHOTO_PIPELINE.md).

## Data

5. **Two players appear in both the starting five and the rotation list** — Keith Bogans
   in 1999–00 and Gerald Fitch in 2000–01. `validate:data` reports this as a warning
   rather than an error, because the `rotation` field is an ordered list of the season's
   rotation players, not a strict per-position backup chart. The Lineup Lab says so on
   the depth-chart card. Worth reconciling against a media guide.

6. **Tournament round wording is inconsistent between seasons.** 1997–98 through 2001–02
   use `NCAA First Round` / `NCAA Sweet Sixteen`; 2002–03 onward use `Round of 64` /
   `Sweet 16`. Both are faithful to their sources, so the data is untouched and
   `src/lib/tournament.ts` normalises at read time. If round notes are ever regularised in
   the data, that module can be simplified.

7. **The archive stores only per-game rates** — no totals, no shooting splits, no
   possessions, no play-by-play. Season totals used for team-share calculations are
   *reconstructed* as `rate × gamesPlayed` and will differ slightly from official totals.
   No possession-based efficiency metric is possible, and none is claimed.

8. **`conferenceFinish` is prose and its wording varies.** Deriving facts from it is
   unsafe — an earlier version of this archive did exactly that and undercounted SEC
   Tournament titles. Postseason facts are now derived from game results instead.

## Application

9. **No real assistive-technology testing.** Accessibility is verified against the
   accessibility tree and by automated checks, not with VoiceOver, NVDA or JAWS. See
   [ACCESSIBILITY.md](ACCESSIBILITY.md).

10. **No axe-core sweep.** The a11y checks are hand-written and targeted rather than a
    generic rule engine, so they catch what they were written to catch.

11. **No service worker.** The build is fully static and works offline once cached by the
    browser, and the web manifest is in place, but there is no explicit precache, so a
    first visit still requires a network.

12. **Playwright is pinned to `~1.56.1`** so it matches the browser build available in
    this development environment. On another machine, run `npx playwright install
    chromium` after `npm install`.

## Deliberate non-goals

- **No seasons outside 1997–2007.** The archive is scoped to the Tubby Smith era.
- **No live data.** Everything is a static historical snapshot.
- **No user accounts or server.** Favorites and saved lineups are per-browser
  `localStorage` only, and the archive says so when storage is unavailable.
