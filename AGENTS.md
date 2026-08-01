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
high-school or unrelated photograph. `public/images/**/original/` is immutable; write
derivatives elsewhere and record them in the manifest. Never describe an AI or
crop-derived reconstruction as an authentic archival headshot — the nine reconstructions
and the one placeholder must stay visibly flagged. Where no verified image exists, show
the generated jersey card, never a stand-in face.

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
