# Project instructions

Big Blue Archive — Kentucky men's basketball, the Tubby Smith era (1997–2007).
Static Vite + React + strict TypeScript. React is the only runtime dependency.

Read [README.md](README.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before
changing code. Run the gates before and after any substantive change:

```bash
npm run validate:data && npm run audit:images
npm run check          # + lint, typecheck, build, unit tests
npm run test:e2e       # Playwright, desktop + mobile
```

## Source-of-truth hierarchy

1. `src/data/archive.json` — historical fact.
2. `src/data/photo-manifest.json` — image provenance.
3. `src/lib/analytics.ts` — every derived number, documented in `docs/ANALYTICS.md`.
4. `reference/` — historical snapshots. **Never edit anything under `reference/`.**

## Non-negotiable rules

**Data integrity.** Never invent, infer or silently alter a statistic, game result,
roster entry, award, ranking or record. Any correction requires an entry in
`docs/DATA_CHANGELOG.md` with old value, new value, source and date, plus a matching
update to the assertions in `tests/unit/archive.test.ts` in the same commit.

**Derived ≠ official.** Anything computed is labelled as derived wherever it renders,
documented in `docs/ANALYTICS.md`, and covered by a unit test. This dataset has only
per-game rates — no shooting splits, no possessions — so never present or imply a
possession-based efficiency metric.

**Images and identity.** Kentucky uniforms only; never substitute a professional,
high-school or unrelated photograph. `public/images/**/original/` is immutable — every
portrait is regenerated from it by `scripts/derive-portraits.py`, which owns both the
files under `public/images/players/portrait/` and the provenance in the manifest. Do not
hand-edit either; change the script and re-run it.

**Re-sourcing beats processing.** When a portrait looks bad, the fix is almost always a
better source, not a better filter. Official UK headshots recovered from Internet Archive
captures of `ukathletics.com` replaced six team-photo crops outright. New sources go in
`public/images/players/resourced/` with their URL and retrieval date in `SOURCES.json`;
never delete what they supersede. Check first that the new source is actually better —
era-official UK headshots are only 105px wide, so for the 420×560 studio portraits they
would be a downgrade.

Never describe a crop of a team photograph as an authentic archival headshot. The four
crops must stay visibly flagged, and each must name the jersey number that identifies its
subject — the audit and the unit tests re-derive that number from `archive.json`, so an
identification the roster contradicts fails the build. Where no image can be verified as a
given player, show the generated jersey card, never a stand-in face; that fallback is
driven by the *absence* of portrait variants, so never add variants to an entry marked
`placeholder` or `unverified-identification`.

**Every displayed image is AI-upscaled.** On 2026-08-01 the owner directed that the whole
image set be run through Real-ESRGAN ×4 — a generative model — after reviewing
side-by-side comparisons at display size and at 3× zoom. This supersedes the former rule
that no generative upscaler may touch a real person's face. What it does *not* supersede,
and what the build enforces:

- Nothing upscaled may be presented as an unmodified archival photograph. Every portrait
  carries a `reconstruction` record naming the model, and the audit fails without one.
- No variant may exceed the model's own scale factor (×4) over its native crop.
- Below a 90px native crop the model invents a face rather than reconstructing one. Those
  entries are `class: "fabricated"`, carry `photo_type: "ai-fabricated-face"`, and are
  flagged on the card, in the dialog, in the alt text and on the sources page — that flag
  shows whether or not provenance display is requested. Four portraits are in this state.
- The originals under `public/images/**/original/` remain immutable and untouched; every
  derived file is reproducible by re-running the two derivation scripts.

Re-sourcing a better original still beats upscaling a worse one, and always will.

**Rights.** Image rights are not cleared. Keep `robots.txt` and the `noindex` meta in
place, and do not deploy publicly until `docs/COPYRIGHT_AND_ATTRIBUTION.md` says the
review passed.

## Things that have already bitten this codebase

Read these before touching the relevant area.

- **Competition phases: there are five, not three.** Eight games sit under
  `Maui Invitational` / `Guardians Classic`. Anything deciding "is this a conference
  game?" must test the `sec` flag, not `phase === 'Regular Season'`. Use the helpers in
  `src/types/archive.ts`.
- **Never derive facts from `conferenceFinish`** or any other prose field; its wording
  varies by season. Derive postseason facts from game results.
- **Tournament round notes are inconsistent between seasons.** `src/lib/tournament.ts`
  normalises them. Its matching is ordered most-specific-first because "semifinal" and
  "quarterfinal" both end in "final" — a naive pattern reported seven SEC titles instead
  of five.
- **`buildHash`'s `playerId` is tri-state**: a string opens, `null` closes, omitted leaves
  `params` alone. Omitting it used to strip a `player` parameter the caller had just set.
- **`setParam` writes one parameter per navigation.** Two calls in one handler both read
  the pre-update route and the second discards the first. Use `setParams` for multiples.
- **Never use `element.scrollIntoView()` for the rails.** In Chromium it moves the
  sequential focus navigation starting point, which made the first Tab press skip the skip
  link. Use `src/lib/scroll.ts`.
- **Chrome that is dark in both themes** (top bar, season rail, footer, cover panels) uses
  `--ink-panel-*`. Using `--surface-inverse` inverts it in dark mode and produces light
  text on a light bar.
- **Grid children need `min-width: 0`** when they contain a `<select>`; the intrinsic
  width of the longest option otherwise pushes the layout past the viewport on mobile.

## Definition of done

- `npm run check` and `npm run test:e2e` both pass with nothing skipped.
- `node tools/contrast.mjs` reports zero pairs below WCAG AA, in both themes, after any
  design-token change.
- New behaviour has a test; a fixed bug has a regression test.
- Anything derived is labelled, documented and tested.
- `docs/KNOWN_ISSUES.md` reflects reality.

Do not report a milestone complete when a check was skipped, timed out or partially ran.
