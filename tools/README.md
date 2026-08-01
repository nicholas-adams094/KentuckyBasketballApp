# Development tools

Review scripts that are not part of CI. Each expects a preview server already running:

```bash
npm run build && npm run preview     # http://127.0.0.1:4173
```

Then, in another shell:

| Script | What it does |
| --- | --- |
| `node tools/contrast.mjs` | Walks the rendered DOM of every view in both themes and reports any text below WCAG AA against its effective background. Composites translucent layers and handles `color(srgb …)`. **Re-run after any design-token change.** |
| `node tools/smoke.mjs` | Loads all eight views × all ten seasons plus deep links, on desktop and mobile, and reports console errors, failed requests, broken images and horizontal overflow. Fast sanity sweep. |
| `node tools/shots.mjs [outdir]` | Captures a screenshot set (both themes, mobile, dialogs, command palette) for visual review. Defaults to `screenshots/`. |

All three exit non-zero when they find something, so they can be wired into a pre-release
check if desired. They are kept out of CI because they are review aids rather than
pass/fail gates — the assertions that must never regress live in `tests/`.
