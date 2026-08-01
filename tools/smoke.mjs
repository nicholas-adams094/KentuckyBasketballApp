import { chromium } from '@playwright/test';

const BASE = 'http://127.0.0.1:4173';
const VIEWS = ['overview', 'roster', 'lineup', 'schedule', 'postseason', 'compare', 'era', 'sources'];
const SEASONS = ['1997-98', '1998-99', '1999-00', '2000-01', '2001-02', '2002-03', '2003-04', '2004-05', '2005-06', '2006-07'];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errors = [];
const badRequests = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => badRequests.push(`${r.url()} :: ${r.failure()?.errorText}`));
page.on('response', (r) => { if (r.status() >= 400) badRequests.push(`${r.status()} ${r.url()}`); });

async function visit(hash, label) {
  await page.goto(`${BASE}/${hash}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(220);
  const h2 = await page.locator('main h2, main h1').first().textContent().catch(() => null);
  const imgCount = await page.locator('img').count();
  const brokenImgs = await page.evaluate(() =>
    [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc || i.src),
  );
  console.log(`${label.padEnd(34)} → "${(h2 || '').trim().slice(0, 46)}" imgs=${imgCount} broken=${brokenImgs.length}`);
  if (brokenImgs.length) console.log('   BROKEN:', brokenImgs.slice(0, 5));
  return brokenImgs.length;
}

let totalBroken = 0;

console.log('--- all views (2002-03) ---');
for (const v of VIEWS) totalBroken += await visit(`#/season/2002-03/${v}`, v);

console.log('\n--- all seasons (overview) ---');
for (const s of SEASONS) totalBroken += await visit(`#/season/${s}/overview`, s);

console.log('\n--- all seasons (roster, checks every portrait) ---');
for (const s of SEASONS) totalBroken += await visit(`#/season/${s}/roster`, s);

console.log('\n--- deep links ---');
totalBroken += await visit('#/player/rajon-rondo', 'player deep link');
totalBroken += await visit('#/opponent/Louisville', 'opponent deep link');
totalBroken += await visit('#/nonsense/route', 'invalid route fallback');
totalBroken += await visit('', 'bare url');

console.log('\n--- mobile ---');
await page.setViewportSize({ width: 390, height: 844 });
for (const v of VIEWS) totalBroken += await visit(`#/season/2005-06/${v}`, `mobile ${v}`);
const hScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
console.log('mobile horizontal overflow:', hScroll);

await browser.close();

console.log('\n=== ERRORS ===');
console.log(errors.length ? [...new Set(errors)].join('\n') : 'none');
console.log('=== BAD REQUESTS ===');
console.log(badRequests.length ? [...new Set(badRequests)].slice(0, 20).join('\n') : 'none');
console.log('=== BROKEN IMAGES TOTAL ===', totalBroken);
process.exit(errors.length || badRequests.length || totalBroken || hScroll ? 1 : 0);
