import {
  brokenImages,
  expect,
  expectClean,
  goToRoute,
  hasHorizontalOverflow,
  SEASON_IDS,
  test,
  VIEW_IDS,
} from './fixtures';

test.describe('application shell', () => {
  test('boots from a bare URL and normalises to a shareable route', async ({ page, problems }) => {
    await page.goto('/');
    await expect(page.locator('#main-content')).toBeVisible();
    // The archive rewrites a bare URL to a canonical deep link.
    await expect.poll(() => page.evaluate(() => window.location.hash)).toMatch(/^#\/season\/1997-98\//);
    expectClean(problems);
  });

  test('renders every view for every season without a blank screen', async ({ page, problems }) => {
    for (const seasonId of SEASON_IDS) {
      for (const view of VIEW_IDS) {
        await goToRoute(page, `#/season/${seasonId}/${view}`);

        const heading = page.locator('#main-content h2').first();
        await expect(heading, `${seasonId}/${view} heading`).toBeVisible();
        await expect(heading).not.toBeEmpty();

        expect(await brokenImages(page), `${seasonId}/${view} broken images`).toEqual([]);
      }
    }
    expectClean(problems);
  });

  test('falls back to the default season for an unknown route', async ({ page, problems }) => {
    await goToRoute(page, '#/total/nonsense/route');
    await expect(page.locator('#main-content h2').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /1997–98 at a glance/ })).toBeVisible();
    expectClean(problems);
  });

  test('keeps the document title in step with the route', async ({ page }) => {
    await goToRoute(page, '#/season/2002-03/schedule');
    await expect(page).toHaveTitle(/2002–03 Schedule · Big Blue Archive/);
    await goToRoute(page, '#/season/2005-06/era');
    await expect(page).toHaveTitle(/2005–06 Era Vault · Big Blue Archive/);
  });

  test('navigates seasons and views by clicking, and supports browser back', async ({ page, problems }) => {
    await goToRoute(page, '#/season/1997-98/overview');

    await page.getByRole('link', { name: /2002–03/ }).first().click();
    await expect(page.getByRole('heading', { name: /2002–03 at a glance/ })).toBeVisible();

    await page.getByRole('link', { name: 'Roster & Stats' }).click();
    await expect(page.getByRole('heading', { name: /2002–03 Wildcats roster/ })).toBeVisible();

    await page.goBack();
    await expect(page.getByRole('heading', { name: /2002–03 at a glance/ })).toBeVisible();

    await page.goBack();
    await expect(page.getByRole('heading', { name: /1997–98 at a glance/ })).toBeVisible();

    expectClean(problems);
  });

  test('never scrolls horizontally on any view', async ({ page }) => {
    for (const view of VIEW_IDS) {
      await goToRoute(page, `#/season/2002-03/${view}`);
      expect(await hasHorizontalOverflow(page), `${view} horizontal overflow`).toBe(false);
    }
  });

  test('recovers the theme preference across a reload', async ({ page }) => {
    await goToRoute(page, '#/season/2002-03/overview');

    // Cycle system → light → dark and confirm the document reflects it. The button is
    // matched by its accessible name, which describes the current and next theme.
    await page.getByRole('button', { name: /Switch to light theme/ }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.getByRole('button', { name: /Switch to dark theme/ }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});
