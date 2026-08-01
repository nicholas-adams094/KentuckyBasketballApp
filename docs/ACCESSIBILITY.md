# Accessibility

## Colour and contrast

Every text/background pair in the interface was measured, in both themes, across all
eight views and both dialogs, using a DOM-walking WCAG sweep that composites translucent
layers properly and handles the `color(srgb …)` values that `color-mix()` resolves to.

**Result: zero pairs below WCAG AA** (4.5:1 for body text, 3:1 for large text).

Getting there required four real fixes, not just token tweaks:

1. **Chrome that must stay dark in both themes** — top bar, season rail, footer, editorial
   cover panels — was using `--surface-inverse`, which by definition flips with the theme.
   In dark mode that produced light text on a light bar at roughly 1.05:1. These now use a
   separate `--ink-panel-*` family that is dark in both themes.
2. **`--text-subtle`** carries 10–12px labels and measured 3.5:1 in light and 4.4:1 in
   dark. Both were darkened/lightened to clear AA on `--surface` *and* `--canvas`.
3. **White text on the dark theme's bright accent** (`#4d84ff`) measured 3.5:1 on filled
   chips, primary buttons and the skip link. Dark ink on the bright accent is 7.4:1, so
   `--text-on-accent` inverts per theme.
4. **Win/loss result dots** carried white text on the theme accent colours. Solid
   `--win-solid` / `--loss-solid` fills were added specifically for the case where white
   text sits on top.

Colour is never the only signal: results carry a `W`/`L` glyph and a text label, form
dots have a visually-hidden full description, and charts label their series.

## Keyboard

- **Skip link** is the first tab stop and moves focus to `<main>`.
- **Every control is reachable and operable by keyboard.** Season tabs and section nav
  are real links, so they are in document order, middle-clickable and shareable.
- **Roster table rows** are focusable and open a profile on Enter or Space.
- **Command palette** — `⌘K`/`Ctrl-K` or `/`. The `/` shortcut is suppressed while typing
  in a field. Arrow keys, Home/End, Enter and Escape all work.
- **Dialogs** trap focus, close on Escape, and return focus to whatever opened them.

### One bug worth recording

The season rail and section nav auto-scroll the active item into view on load. Doing that
with `element.scrollIntoView()` moves Chromium's *sequential focus navigation starting
point* onto the scrolled element — so the first Tab press landed inside the section nav
and silently skipped the skip link and every header control.

They now write `container.scrollLeft` instead (`src/lib/scroll.ts`), which achieves the
same visual result without touching focus, and cannot scroll the page vertically as a
side effect. `tests/e2e/a11y.spec.ts` guards it.

## Screen readers

- Landmarks: `banner`, `navigation` (named "Choose a season" and "Archive sections"),
  `main`, `contentinfo`.
- One `<h1>` per page (the season identity in the hero), with a sensible heading order
  below it.
- `aria-current="true"` on the active season, `aria-current="page"` on the active section.
- Route changes are announced through a polite live region — a single-page app gives no
  other cue that the view changed.
- Sortable columns expose `aria-sort`; filter chips and toggles expose `aria-pressed`.
- The command palette implements the ARIA combobox pattern: the input keeps DOM focus and
  owns the listbox, with `aria-activedescendant` tracking the highlighted option.
- **Charts** are `role="img"` with a `<title>` and a `<desc>` that states the actual
  values, so the data is available and not just "graphic".
- Toasts are in a polite live region and never steal focus.

## Images

- Every portrait has descriptive alt text including the player's position, and says so
  explicitly when no verified photograph exists.
- Decorative background imagery is `aria-hidden` or applied via CSS.
- When an image fails to load, a generated jersey card is drawn — never a broken icon,
  and never a stand-in face for a real person.

## Motion and preferences

- `prefers-reduced-motion: reduce` disables all animation and transitions, and switches
  the rail auto-scroll to an instant jump. Nothing depends on motion to convey meaning.
- Light/dark/system theme and a compact density mode, applied before first paint so there
  is no flash of the wrong theme.
- The layout is fluid from 320px up; no view scrolls horizontally at any width. Wide
  tables scroll inside their own container.

## Verification

`tests/e2e/a11y.spec.ts` runs on desktop and mobile and asserts: skip-link focus order,
landmark structure, one `<h1>` per view, `aria-current` correctness, alt-text presence,
chart title/description presence, dialog focus trapping and restoration, live-region
announcements, the full command-palette keyboard contract, `/` suppression while typing,
keyboard table operation, and reduced-motion rendering.

The contrast sweep lives in the repository root as a development script and is intended
to be re-run after any token change.

## Known gaps

- Not tested with real assistive technology (VoiceOver, NVDA, JAWS) — only against the
  accessibility tree and automated checks.
- No axe-core integration; the checks are hand-written and targeted rather than a generic
  rule sweep.
- Not audited at 400% zoom / 320px reflow against WCAG 1.4.10 specifically, though the
  layout is fluid and passes a no-horizontal-scroll check at 390px.
