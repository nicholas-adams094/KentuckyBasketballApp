import { test as base, expect, type Page } from '@playwright/test';

export const SEASON_IDS = [
  '1997-98',
  '1998-99',
  '1999-00',
  '2000-01',
  '2001-02',
  '2002-03',
  '2003-04',
  '2004-05',
  '2005-06',
  '2006-07',
] as const;

export const VIEW_IDS = [
  'overview',
  'roster',
  'lineup',
  'schedule',
  'postseason',
  'compare',
  'era',
  'sources',
] as const;

export interface PageProblems {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
}

/**
 * Every test runs against a page that records console errors, uncaught exceptions and
 * failed network requests. `expectClean` asserts none occurred — the archive is a
 * static bundle with no third-party requests, so any of these is a real defect.
 */
export const test = base.extend<{ problems: PageProblems }>({
  problems: async ({ page }, use) => {
    const problems: PageProblems = { consoleErrors: [], pageErrors: [], failedRequests: [] };

    page.on('console', (message) => {
      if (message.type() === 'error') problems.consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => problems.pageErrors.push(error.message));
    page.on('requestfailed', (request) => {
      problems.failedRequests.push(`${request.url()} — ${request.failure()?.errorText}`);
    });
    page.on('response', (response) => {
      if (response.status() >= 400) problems.failedRequests.push(`${response.status()} ${response.url()}`);
    });

    await use(problems);
  },
});

export { expect };

export function expectClean(problems: PageProblems): void {
  expect(problems.pageErrors, 'uncaught page errors').toEqual([]);
  expect(problems.consoleErrors, 'console errors').toEqual([]);
  expect(problems.failedRequests, 'failed or 4xx/5xx requests').toEqual([]);
}

/** Navigates to an in-app hash route and waits for the view to settle. */
export async function goToRoute(page: Page, hash: string): Promise<void> {
  await page.goto(`/${hash}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#main-content .view', { state: 'attached' });
  await page.waitForLoadState('networkidle');
}

/** Returns the src of every image that finished loading with no intrinsic size. */
export async function brokenImages(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.images]
      .filter((image) => image.complete && image.naturalWidth === 0)
      .map((image) => image.currentSrc || image.src),
  );
}

/** True when the document scrolls horizontally — always a layout bug. */
export async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
}
