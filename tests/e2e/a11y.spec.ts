import { expect, expectClean, goToRoute, test, VIEW_IDS } from './fixtures';

test.describe('accessibility and keyboard operation', () => {
  test('exposes a working skip link as the first tab stop', async ({ page }) => {
    await goToRoute(page, '#/season/2002-03/overview');
    // Regression guard: the rails auto-scroll to the active item on load, and doing
    // that with scrollIntoView would move Chromium's sequential focus starting point
    // into the nav, silently skipping the skip link and every header control.
    await page.keyboard.press('Tab');

    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skip).toBeFocused();
    await skip.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
  });

  test('gives every view exactly one h1-level landmark structure', async ({ page }) => {
    for (const view of VIEW_IDS) {
      await goToRoute(page, `#/season/2002-03/${view}`);

      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.getByRole('main')).toBeVisible();
      await expect(page.getByRole('contentinfo')).toBeAttached();
      await expect(page.getByRole('navigation', { name: 'Archive sections' })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Choose a season' })).toBeVisible();
    }
  });

  test('marks the current season and view for assistive technology', async ({ page }) => {
    await goToRoute(page, '#/season/2004-05/schedule');

    await expect(page.getByRole('link', { name: /2004–05/ }).first()).toHaveAttribute(
      'aria-current',
      'true',
    );
    await expect(page.getByRole('link', { name: 'Schedule' })).toHaveAttribute('aria-current', 'page');
  });

  test('gives every image a non-empty alt or marks it decorative', async ({ page }) => {
    for (const view of ['overview', 'roster', 'era'] as const) {
      await goToRoute(page, `#/season/2002-03/${view}`);
      const missing = await page.evaluate(() =>
        [...document.images]
          .filter((image) => image.alt === null || image.alt === undefined)
          .map((image) => image.src),
      );
      expect(missing, `${view} images without an alt attribute`).toEqual([]);
    }
  });

  test('describes every chart with a title and description', async ({ page }) => {
    await goToRoute(page, '#/season/2002-03/era');
    const charts = page.locator('svg.chart[role="img"]');
    const count = await charts.count();
    expect(count).toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      const chart = charts.nth(index);
      await expect(chart).toHaveAttribute('aria-labelledby', /.+/);
      // Direct children only — data points carry their own nested <title> tooltips.
      await expect(chart.locator('> title')).not.toBeEmpty();
      await expect(chart.locator('> desc')).not.toBeEmpty();
    }
  });

  test('traps focus inside the player dialog and restores it on close', async ({ page }) => {
    await goToRoute(page, '#/season/2005-06/roster');

    const trigger = page.getByRole('button', { name: /Open Rajon Rondo profile/ });
    await trigger.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');

    // Tab several times; focus must never leave the dialog.
    for (let index = 0; index < 14; index += 1) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => {
        const panel = document.querySelector('[role="dialog"]');
        return Boolean(panel && document.activeElement && panel.contains(document.activeElement));
      });
      expect(inside, `focus escaped the dialog after ${index + 1} tabs`).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('announces route changes in a live region', async ({ page }) => {
    await goToRoute(page, '#/season/2002-03/overview');
    const announcer = page.locator('#route-announcer');
    await expect(announcer).toHaveAttribute('aria-live', 'polite');

    await goToRoute(page, '#/season/2002-03/schedule');
    await expect(announcer).toContainText('Schedule');
  });

  test('opens the command palette by keyboard and navigates with the arrow keys', async ({
    page,
    problems,
  }) => {
    await goToRoute(page, '#/season/2002-03/overview');

    await page.keyboard.press('ControlOrMeta+k');
    const palette = page.getByRole('dialog', { name: 'Search the archive' });
    await expect(palette).toBeVisible();

    const input = palette.getByRole('combobox');
    await expect(input).toBeFocused();
    await input.fill('prince');

    const options = palette.getByRole('option');
    await expect(options.first()).toBeVisible();
    // The virtual cursor is exposed through aria-activedescendant.
    await expect(input).toHaveAttribute('aria-activedescendant', 'palette-option-0');
    await page.keyboard.press('ArrowDown');
    await expect(input).toHaveAttribute('aria-activedescendant', 'palette-option-1');
    await page.keyboard.press('ArrowUp');
    await expect(input).toHaveAttribute('aria-activedescendant', 'palette-option-0');

    await page.keyboard.press('Enter');
    await expect(palette).toBeHidden();
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Tayshaun Prince' })).toBeVisible();

    expectClean(problems);
  });

  test('closes the command palette with Escape', async ({ page }) => {
    await goToRoute(page, '#/season/2002-03/overview');
    await page.keyboard.press('/');
    const palette = page.getByRole('dialog', { name: 'Search the archive' });
    await expect(palette).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(palette).toBeHidden();
  });

  test('does not hijack the slash key while typing in a field', async ({ page }) => {
    await goToRoute(page, '#/season/2002-03/roster');
    const searchBox = page.getByRole('searchbox', { name: 'Search the roster' });
    await searchBox.click();
    await page.keyboard.type('a/b');

    await expect(page.getByRole('dialog', { name: 'Search the archive' })).toBeHidden();
    await expect(searchBox).toHaveValue('a/b');
  });

  test('operates the roster table by keyboard alone', async ({ page }) => {
    await goToRoute(page, '#/season/2002-03/roster');
    await page.getByRole('button', { name: 'Table', exact: true }).click();

    const firstRow = page.locator('table.table tbody tr').first();
    await firstRow.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('honours reduced-motion without hiding content', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await goToRoute(page, '#/season/2002-03/overview');
    await expect(page.getByRole('heading', { name: /2002–03 at a glance/ })).toBeVisible();
    await expect(page.locator('.view')).toBeVisible();
  });
});
