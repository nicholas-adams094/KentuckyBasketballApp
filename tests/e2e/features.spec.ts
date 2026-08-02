import { expect, expectClean, goToRoute, test } from './fixtures';

test.describe('roster and player profiles', () => {
  test('opens a profile from a card and closes it with Escape', async ({ page, problems }) => {
    await goToRoute(page, '#/season/2005-06/roster');

    await page.getByRole('button', { name: /Open Rajon Rondo profile/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Rajon Rondo' })).toBeVisible();
    // The route carries the open profile so it can be shared.
    await expect.poll(() => page.evaluate(() => window.location.hash)).toContain('player=rajon-rondo');

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect.poll(() => page.evaluate(() => window.location.hash)).not.toContain('player=');

    expectClean(problems);
  });

  test('opens every profile on a roster without error', async ({ page, problems }) => {
    await goToRoute(page, '#/season/2002-03/roster');
    const cards = page.getByRole('button', { name: /^Open .+ profile$/ });
    const count = await cards.count();
    expect(count).toBeGreaterThan(10);

    for (let index = 0; index < count; index += 1) {
      await cards.nth(index).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('.player-dialog__name')).not.toBeEmpty();
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    }
    expectClean(problems);
  });

  test('opens a profile directly from a deep link', async ({ page, problems }) => {
    await goToRoute(page, '#/player/tayshaun-prince');
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Tayshaun Prince' })).toBeVisible();
    expectClean(problems);
  });

  test('filters and searches the roster, and reflects it in the URL', async ({ page }) => {
    await goToRoute(page, '#/season/2002-03/roster');

    const searchBox = page.getByRole('searchbox', { name: 'Search the roster' });
    await searchBox.fill('bogans');
    await expect(page.getByRole('button', { name: /Open Keith Bogans profile/ })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.location.hash)).toContain('q=bogans');

    await searchBox.fill('zzzzz');
    await expect(page.getByText('No players match these filters')).toBeVisible();

    await searchBox.fill('');
    await page.getByRole('button', { name: /^Starter — 5 players$/ }).click();
    await expect(page.locator('.player-card')).toHaveCount(5);
  });

  test('sorts the roster table and marks the sorted column', async ({ page }) => {
    await goToRoute(page, '#/season/2002-03/roster');
    await page.getByRole('button', { name: 'Table', exact: true }).click();

    const rebounds = page.getByRole('columnheader', { name: /RPG/ });
    await rebounds.getByRole('button').click();
    await expect(rebounds).toHaveAttribute('aria-sort', 'descending');

    const values = await page.locator('table.table tbody tr td:nth-child(6)').allInnerTexts();
    const numbers = values.map(Number);
    expect(numbers).toEqual([...numbers].sort((a, b) => b - a));
  });

  test('persists a favorite across a reload', async ({ page }) => {
    await goToRoute(page, '#/season/2005-06/roster');

    const favorite = page.getByRole('button', { name: /Add Rajon Rondo to favorites/ });
    await favorite.click();
    await expect(page.getByRole('button', { name: /Remove Rajon Rondo from favorites/ })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('button', { name: /Remove Rajon Rondo from favorites/ })).toBeVisible();
  });
});

test.describe('schedule', () => {
  test('filters games and updates the summary', async ({ page, problems }) => {
    await goToRoute(page, '#/season/1997-98/schedule');

    const rows = page.locator('table.table tbody tr');
    await expect(rows).toHaveCount(39);

    await page.getByRole('button', { name: /^Losses — 4 games$/ }).click();
    await expect(rows).toHaveCount(4);
    await expect(page.getByText('0–4', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: /^NCAA Tournament — 6 games$/ }).click();
    await expect(rows).toHaveCount(6);

    expectClean(problems);
  });

  test('separates the named early-season events from conference play', async ({ page }) => {
    // 2002-03 played three Maui Invitational games; they are non-conference, not
    // postseason, and must not appear under the SEC filter.
    await goToRoute(page, '#/season/2002-03/schedule');
    const rows = page.locator('table.table tbody tr');

    await page.getByRole('button', { name: /^Early-season event — 3 games$/ }).click();
    await expect(rows).toHaveCount(3);

    await page.getByRole('button', { name: /^SEC — 16 games$/ }).click();
    await expect(rows).toHaveCount(16);
  });

  test('searches opponents and opens the head-to-head panel', async ({ page, problems }) => {
    await goToRoute(page, '#/season/2005-06/schedule');

    await page.getByRole('searchbox', { name: 'Search opponents' }).fill('Louisville');
    const rows = page.locator('table.table tbody tr');
    await expect(rows).toHaveCount(1);

    await rows.first().getByRole('button', { name: /Louisville/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: /Kentucky vs Louisville/ })).toBeVisible();

    expectClean(problems);
  });
});

test.describe('lineup lab', () => {
  test('loads presets, scores the five and shares a link', async ({ page, problems }) => {
    await goToRoute(page, '#/season/2002-03/lineup');

    const score = page.locator('.score-ring b');
    const documented = await score.innerText();

    await page.getByRole('button', { name: 'Best offense' }).click();
    await expect.poll(async () => score.innerText()).not.toBe('');
    // The chosen five is encoded into the URL so it can be shared.
    await expect.poll(() => page.evaluate(() => window.location.hash)).toContain('five=');

    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(score).toHaveText(documented);

    expectClean(problems);
  });

  test('restores a five from a shared link', async ({ page }) => {
    await goToRoute(page, '#/season/2002-03/lineup');
    await page.getByRole('button', { name: 'Best passing' }).click();
    const shared = await page.evaluate(() => window.location.hash);
    const score = await page.locator('.score-ring b').innerText();

    await page.goto('/');
    await goToRoute(page, shared);
    await expect(page.locator('.score-ring b')).toHaveText(score);
  });

  test('warns when a player is duplicated across two slots', async ({ page }) => {
    await goToRoute(page, '#/season/2002-03/lineup');

    const pointGuard = page.getByLabel('Point guard selection');
    const shootingGuard = page.getByLabel('Shooting guard selection');
    await shootingGuard.selectOption(await pointGuard.inputValue());

    await expect(page.getByText('A player is selected in more than one slot.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Save lineup/ })).toBeDisabled();
  });

  test('saves and deletes a lineup, surviving a reload', async ({ page }) => {
    await goToRoute(page, '#/season/2004-05/lineup');

    await page.getByRole('button', { name: /Save lineup/ }).click();
    const saved = page.locator('.saved-lineup');
    await expect(saved).toHaveCount(1);

    await page.reload();
    await expect(page.locator('.saved-lineup')).toHaveCount(1);

    await page.locator('.saved-lineup').first().getByRole('button', { name: /^Delete/ }).click();
    await expect(page.locator('.saved-lineup')).toHaveCount(0);
  });
});

test.describe('compare and era vault', () => {
  test('compares player-seasons and reflects the selection in the URL', async ({ page, problems }) => {
    await goToRoute(page, '#/season/2002-03/compare');
    await expect(page.locator('.compare-slot')).toHaveCount(2);

    await page.getByRole('button', { name: 'Add a player' }).click();
    await expect(page.locator('.compare-slot')).toHaveCount(3);
    await expect.poll(() => page.evaluate(() => window.location.hash)).toContain('players=');

    expectClean(problems);
  });

  test('shows the derived decade totals in the Era Vault', async ({ page, problems }) => {
    await goToRoute(page, '#/season/2002-03/era');

    // Scoped to the view: the top bar shows the same era totals.
    const main = page.locator('#main-content');
    await expect(main.getByText('263–83')).toBeVisible();
    await expect(main.getByText('120–40')).toBeVisible();
    // Five SEC Tournament titles, derived from the championship-game results.
    const secTitles = page.locator('.vault-cover__stat', { hasText: 'SEC Tournament titles' });
    await expect(secTitles.locator('b')).toHaveText('5');

    expectClean(problems);
  });

  test('switches the decade leaderboard category', async ({ page }) => {
    await goToRoute(page, '#/season/2002-03/era');
    const firstRow = page.locator('.leaderboard-row').first();
    const scoringLeader = await firstRow.locator('strong').innerText();

    await page.getByRole('button', { name: 'BPG', exact: true }).click();
    await expect.poll(async () => firstRow.locator('strong').innerText()).not.toBe(scoringLeader);
  });
});

test.describe('postseason', () => {
  test('renders the 1998 title run in canonical round order', async ({ page, problems }) => {
    await goToRoute(page, '#/season/1997-98/postseason');

    // The round chips are uppercased in CSS, so compare against the canonical values
    // case-insensitively rather than asserting the rendered casing.
    const rounds = await page.locator('.bracket').last().locator('.bracket-game__round').allInnerTexts();
    expect(rounds.map((round) => round.toLowerCase())).toEqual([
      'round of 64',
      'round of 32',
      'sweet 16',
      'elite eight',
      'final four',
      'national championship',
    ]);

    expectClean(problems);
  });

  test('reads a 2004-05 SEC Tournament final as a loss, not a title', async ({ page }) => {
    await goToRoute(page, '#/season/2004-05/postseason');
    const secCard = page.locator('.metric', { hasText: 'SEC Tournament' }).first();
    await expect(secCard).toContainText('Runner-up');
  });
});

test.describe('sources', () => {
  test('lists sources and flags every image not shown as a portrait', async ({ page, problems }) => {
    await goToRoute(page, '#/season/2002-03/sources');

    await expect(page.getByRole('heading', { name: 'Historical sources' })).toBeVisible();
    await expect(page.getByText('Image rights have not been cleared')).toBeVisible();

    // Every image is now AI-upscaled, and the page has to say so standing rather than
    // only on the individual entries.
    await expect(page.getByText('Every image here has been AI-upscaled')).toBeVisible();

    // No portrait rests on jersey-number inference any longer: official individual
    // headshots were located for all four remaining team-photograph crops.
    await page.getByRole('button', { name: /^Team-photo crops — 0 images$/ }).click();
    await expect(page.locator('.provenance-tile')).toHaveCount(0);

    // One face is still generated rather than photographed, and must be flagged as such.
    await page.getByRole('button', { name: /^AI-generated faces — 1 image$/ }).click();
    await expect(page.locator('.provenance-tile')).toHaveCount(1);
    await expect(
      page.locator('.provenance-flag', { hasText: 'AI-generated face' }),
    ).toBeVisible();

    await page.getByRole('button', { name: /^Not shown as a portrait — 1 image$/ }).click();
    await expect(page.locator('.provenance-tile')).toHaveCount(1);
    await expect(page.locator('.provenance-flag', { hasText: 'No photograph' })).toBeVisible();

    expectClean(problems);
  });
});

test.describe('portrait honesty', () => {
  test('draws a jersey card, not a photograph, for the player with no verified image', async ({
    page,
    problems,
  }) => {
    await goToRoute(page, '#/player/eric-allen');

    const portrait = page.locator('.player-dialog .portrait img').first();
    await expect(portrait).toBeVisible();
    // The jersey card is drawn as an inline data URI; a photograph would be a file path.
    await expect(portrait).toHaveAttribute('src', /^data:/);
    await expect(page.locator('.provenance-flag', { hasText: 'No photograph' })).toBeVisible();

    expectClean(problems);
  });

  test('serves the re-sourced official headshot, not the team-photo crop', async ({ page, problems }) => {
    await goToRoute(page, '#/player/jules-camara');
    const portrait = page.locator('.player-dialog .portrait img').first();
    await expect(portrait).toHaveAttribute('src', /uk_jules_camara-\d+w\.webp/);
    // No jersey-number flag: the university published this portrait on his own page, so
    // nothing is being inferred from a group photograph any more.
    await expect(page.locator('.provenance-flag', { hasText: 'Team photo' })).toHaveCount(0);
    expectClean(problems);
  });

  test('says when a portrait post-dates the era, rather than letting it pass as contemporary', async ({
    page,
    problems,
  }) => {
    await goToRoute(page, '#/player/ramon-harris');
    await expect(page.locator('.provenance-flag', { hasText: /portrait dates from 2008-09/ })).toBeVisible();
    await expect(
      page.locator('.callout--gold', { hasText: /after the Tubby Smith era/ }),
    ).toBeVisible();
    expectClean(problems);
  });

  test('serves a responsive portrait rather than one oversized file', async ({ page, problems }) => {
    await goToRoute(page, '#/player/tayshaun-prince');

    const portrait = page.locator('.player-dialog .portrait img').first();
    await expect(portrait).toHaveAttribute('srcset', /\d+w/);
    await expect(portrait).toHaveAttribute('sizes', /.+/);

    expectClean(problems);
  });
});
