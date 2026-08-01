import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:4173';
const OUT = process.argv[2] || 'screenshots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function shot(name, hash, opts = {}) {
  const page = await browser.newPage({
    viewport: opts.viewport || { width: 1440, height: 980 },
    colorScheme: opts.theme || 'light',
  });
  await page.goto(`${BASE}/${hash}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  if (opts.action) await opts.action(page);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: opts.full ?? false });
  await page.close();
  console.log('shot', name);
}

await shot('01-overview', '#/season/2002-03/overview');
await shot('02-overview-dark', '#/season/1997-98/overview', { theme: 'dark' });
await shot('03-roster', '#/season/2005-06/roster');
await shot('04-lineup', '#/season/2002-03/lineup');
await shot('05-schedule', '#/season/1997-98/schedule');
await shot('06-postseason', '#/season/1997-98/postseason');
await shot('07-compare', '#/season/2002-03/compare');
await shot('08-era', '#/season/2002-03/era', { theme: 'dark' });
await shot('09-sources', '#/season/2002-03/sources');
await shot('10-player', '#/player/rajon-rondo');
await shot('11-palette', '#/season/2002-03/overview', {
  action: async (p) => {
    await p.keyboard.press('Meta+k');
    await p.waitForTimeout(250);
    await p.keyboard.type('prince');
    await p.waitForTimeout(350);
  },
});
await shot('12-mobile', '#/season/2002-03/overview', { viewport: { width: 390, height: 844 } });
await shot('13-mobile-roster', '#/season/2002-03/roster', { viewport: { width: 390, height: 844 } });
await shot('14-opponent', '#/opponent/Louisville', { theme: 'dark' });

await browser.close();
