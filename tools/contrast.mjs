/**
 * WCAG contrast sweep: walks the rendered DOM of every view in both themes and
 * reports any visible text below the AA threshold against its effective background.
 */
import { chromium } from '@playwright/test';

const BASE = 'http://127.0.0.1:4173';
const VIEWS = ['overview', 'roster', 'lineup', 'schedule', 'postseason', 'compare', 'era', 'sources'];

const AUDIT = `(() => {
  // Handles both rgb()/rgba() and the color(srgb r g b / a) form that color-mix()
  // resolves to in Chromium — the latter uses 0-1 channel values.
  const parse = (c) => {
    if (!c) return null;
    let m = c.match(/^color\\(srgb ([^)]+)\\)/);
    if (m) {
      const p = m[1].split(/[ /]+/).filter(Boolean).map(Number);
      return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p.length > 3 ? p[3] : 1 };
    }
    m = c.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  // Proper source-over compositing, including the resulting alpha — without this the
  // walk stops at the first translucent layer and reports a bogus background.
  const over = (fg, bg) => {
    const a = fg.a + bg.a * (1 - fg.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
      g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
      b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a,
      a,
    };
  };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); };

  const effectiveBg = (el) => {
    let node = el;
    let acc = null;
    while (node && node !== document.documentElement.parentNode) {
      const cs = getComputedStyle(node);
      const c = parse(cs.backgroundColor);
      const hasImage = cs.backgroundImage && cs.backgroundImage !== 'none';
      if (hasImage) return { color: { r: 255, g: 255, b: 255, a: 1 }, uncertain: true };
      if (c && c.a > 0) {
        acc = acc ? over(acc, c) : c;
        if (acc.a >= 0.995) return { color: acc, uncertain: false };
      }
      node = node.parentElement;
    }
    return { color: acc || { r: 255, g: 255, b: 255, a: 1 }, uncertain: !acc };
  };

  const out = [];
  const seen = new Set();
  for (const el of document.querySelectorAll('*')) {
    // Only elements that themselves render text.
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
    if (!text) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.15) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    if (el.closest('.visually-hidden')) continue;

    const fg = parse(cs.color);
    if (!fg) continue;
    const { color: bg, uncertain } = effectiveBg(el);
    if (uncertain) continue; // text over a photo/gradient is scrimmed by design

    const composited = fg.a < 1 ? over(fg, bg) : fg;
    const r = ratio(composited, bg);
    const size = parseFloat(cs.fontSize);
    const weight = Number(cs.fontWeight) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const threshold = large ? 3 : 4.5;

    if (r < threshold) {
      const key = el.className + '|' + text.slice(0, 24);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        ratio: Number(r.toFixed(2)),
        threshold,
        text: text.slice(0, 46),
        cls: (typeof el.className === 'string' ? el.className : '').slice(0, 52) || el.tagName.toLowerCase(),
        size: Math.round(size),
        fg: cs.color,
        bg: 'rgb(' + Math.round(bg.r) + ',' + Math.round(bg.g) + ',' + Math.round(bg.b) + ')',
      });
    }
  }
  return out.sort((a, b) => a.ratio - b.ratio);
})()`;

const browser = await chromium.launch();
let total = 0;

for (const theme of ['light', 'dark']) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: theme });
  for (const view of VIEWS) {
    await page.goto(`${BASE}/#/season/2002-03/${view}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(320);
    const issues = await page.evaluate(AUDIT);
    if (issues.length) {
      total += issues.length;
      console.log(`\n### ${theme} / ${view} — ${issues.length} below AA`);
      for (const i of issues.slice(0, 8)) {
        console.log(`  ${String(i.ratio).padStart(5)} (need ${i.threshold})  ${i.size}px  .${i.cls}  fg=${i.fg} bg=${i.bg}  "${i.text}"`);
      }
    }
  }
  // Player dialog
  await page.goto(`${BASE}/#/player/rajon-rondo`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const dlg = await page.evaluate(AUDIT);
  if (dlg.length) {
    total += dlg.length;
    console.log(`\n### ${theme} / player dialog — ${dlg.length} below AA`);
    for (const i of dlg.slice(0, 8)) {
      console.log(`  ${String(i.ratio).padStart(5)} (need ${i.threshold})  ${i.size}px  .${i.cls}  fg=${i.fg} bg=${i.bg}  "${i.text}"`);
    }
  }
  await page.close();
}

await browser.close();
console.log(`\n=== total below AA: ${total} ===`);
