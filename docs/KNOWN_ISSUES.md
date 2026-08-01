# Known issues and open items

Honestly stated. Nothing here is hidden by the interface — the archive flags each of
these where a reader would encounter it.

## Images

1. **Rights review is not complete.** All 70 manifest entries are marked
   `required-before-publication`. `public/robots.txt` disallows indexing and the page is
   `noindex`. Do not deploy publicly until this is resolved. See
   [COPYRIGHT_AND_ATTRIBUTION.md](COPYRIGHT_AND_ATTRIBUTION.md).

2. **Four portraits are crops of a team photograph**, not individual archival headshots:
   Antwain Barbour, Matt Heissenbuttel, Mark Coury and Rashaad Carruth. (Five others were
   re-sourced to official UK headshots on 2026-08-01; no archived headshot survives for
   these four — the URLs their own UK pages reference were never captured.) Each subject is the
   player wearing the jersey number this archive records for him that season — a claim
   `npm run audit:images` and `tests/unit/lib.test.ts` re-derive from `archive.json` on
   every build rather than take on trust. Each is flagged `Team photo · #N` on its card,
   in the Era Vault and in the Sources manifest, and the profile dialog says plainly that
   it is a crop of a group photograph. Their native crops are 67–87px against a median of
   356px — all four below the 90px floor, which is why they are also the four AI
   fabrications in item 3. Replace with verified individual portraits when they can be
   located.

3. **Four faces on this site are AI-generated and are not the players they label.**
   *Antwain Barbour*, *Matt Heissenbuttel*, *Mark Coury* and *Rashaad Carruth*. Their
   source crops are 67–87px, far below what Real-ESRGAN needs to reconstruct a face, so
   the model invented one instead — the output is sharp, confident and wrong. They are
   published at the archive owner's explicit request, recorded as
   `reconstruction.class: "fabricated"` with `photo_type: "ai-fabricated-face"`, and
   flagged as not-a-photograph on the card, in the alt text, in the profile dialog and in
   the Sources manifest. That flag is not suppressible: unlike other provenance notes it
   shows whether or not provenance display is requested. Re-sourcing a real headshot is
   the only fix; upscaling harder makes it worse, not better.

4. **Every other displayed image is AI-reconstructed.** All 57 portraits and all 10 team
   photographs pass through Real-ESRGAN ×4, a generative model: fine texture — skin, hair,
   fabric — was computed rather than photographed. Round-trip drift measures 7–10.5 RMSE
   against 1.0 for a non-generative upscaler. Likenesses are real; surface detail is not.
   The originals are untouched under `public/images/**/original/` and every derived file
   is reproducible from the two derivation scripts.

5. **One player is shown as a jersey card rather than a photograph.** *Eric Allen* — no
   verified Kentucky-uniform image has been located, including in the Internet Archive
   sweep of `ukathletics.com`; he has no archived UK bio page at all. The entry carries no
   portrait variants, which is the mechanism that forces the jersey-card fallback, and the
   image audit fails if it ever acquires one.

6. **Two portraits post-date the era.** The only surviving official Kentucky headshots of
   *Michael Porter* and *Ramon Harris* are from 2008–09, after the decade this archive
   covers. They are the right player in a Kentucky uniform and are preferred to showing
   nothing, but each carries a visible "portrait dates from 2008-09" flag and says so in
   the profile dialog, so a reader never takes them for contemporary imagery.

7. **Originals are low resolution.** 52 of 68 player originals are 420×560; several team
   photographs are under 1,000px wide (1999–00 is only 528×305). These are the files
   extracted from the previous build, not the best available historical sources.
   Derivatives are capped at ×4 the native crop, the upscaler's own scale factor. The
   generative upscale changes how they *look*, not how much was actually recorded. The correct fix is re-sourcing; see [PHOTO_PIPELINE.md](PHOTO_PIPELINE.md).
   Cropping the small portraits from the full team photographs instead was measured and
   rejected: those hold fewer pixels per face than the strips do.

## Data

8. **Two players appear in both the starting five and the rotation list** — Keith Bogans
   in 1999–00 and Gerald Fitch in 2000–01. `validate:data` reports this as a warning
   rather than an error, because the `rotation` field is an ordered list of the season's
   rotation players, not a strict per-position backup chart. The Lineup Lab says so on
   the depth-chart card. Worth reconciling against a media guide.

9. **Tournament round wording is inconsistent between seasons.** 1997–98 through 2001–02
   use `NCAA First Round` / `NCAA Sweet Sixteen`; 2002–03 onward use `Round of 64` /
   `Sweet 16`. Both are faithful to their sources, so the data is untouched and
   `src/lib/tournament.ts` normalises at read time. If round notes are ever regularised in
   the data, that module can be simplified.

10. **The archive stores only per-game rates** — no totals, no shooting splits, no
   possessions, no play-by-play. Season totals used for team-share calculations are
   *reconstructed* as `rate × gamesPlayed` and will differ slightly from official totals.
   No possession-based efficiency metric is possible, and none is claimed.

11. **`conferenceFinish` is prose and its wording varies.** Deriving facts from it is
   unsafe — an earlier version of this archive did exactly that and undercounted SEC
   Tournament titles. Postseason facts are now derived from game results instead.

## Application

12. **No real assistive-technology testing.** Accessibility is verified against the
   accessibility tree and by automated checks, not with VoiceOver, NVDA or JAWS. See
   [ACCESSIBILITY.md](ACCESSIBILITY.md).

13. **No axe-core sweep.** The a11y checks are hand-written and targeted rather than a
    generic rule engine, so they catch what they were written to catch.

14. **No service worker.** The build is fully static and works offline once cached by the
    browser, and the web manifest is in place, but there is no explicit precache, so a
    first visit still requires a network.

15. **Playwright is pinned to `~1.56.1`** so it matches the browser build available in
    this development environment. On another machine, run `npx playwright install
    chromium` after `npm install`.

## Deliberate non-goals

- **No seasons outside 1997–2007.** The archive is scoped to the Tubby Smith era.
- **No live data.** Everything is a static historical snapshot.
- **No user accounts or server.** Favorites and saved lineups are per-browser
  `localStorage` only, and the archive says so when storage is unavailable.
