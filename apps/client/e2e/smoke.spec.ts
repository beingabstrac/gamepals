import { expect, test, type Page } from '@playwright/test';

/** Every playable game on the shelf. Add new games here so they're opened and played on every push. */
const GAMES = ['Tic-Tac-Toe', 'Four in a Row', 'Ludo', 'Air Hockey', 'Ping Pong', 'Tug of War', 'Reflex Race', 'Sumo', 'Penalty Kicks', 'Snake Battle'];

/** Collects uncaught exceptions and console errors; any of them fails the test. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function openTable(page: Page, name: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
}

test('home shows every playable game', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  for (const name of GAMES) {
    await expect(page.getByRole('button', { name: new RegExp(`^${name}`) })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

for (const name of GAMES) {
  test(`${name}: starts from the table and survives play`, async ({ page }) => {
    const errors = watchErrors(page);
    await openTable(page, name);
    await page.getByRole('button', { name: 'Play', exact: true }).click();

    const canvas = page.locator('.board canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Game canvas has no size');

    // Tap and drag around the board the way players do.
    for (let i = 0; i < 12; i++) {
      const x = box.x + box.width * (0.1 + ((i * 37) % 80) / 100);
      const y = box.y + box.height * (0.55 + ((i * 23) % 40) / 100);
      await page.mouse.click(x, y);
      const roll = page.getByRole('button', { name: 'Roll' });
      if ((await roll.count()) > 0 && (await roll.isEnabled())) await roll.click();
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(1500);

    await expect(page.getByRole('button', { name: /Back to the table/ })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('a full Tic-Tac-Toe game against a bot reaches a result', async ({ page }) => {
  const errors = watchErrors(page);
  await openTable(page, 'Tic-Tac-Toe');
  await page.getByRole('button', { name: /vs Bot/ }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();

  const box = await page.locator('.board canvas').boundingBox();
  if (!box) throw new Error('Game canvas has no size');
  const result = page.locator('.result-sheet');
  for (let round = 0; round < 6 && !(await result.isVisible()); round++) {
    for (let cell = 0; cell < 9; cell++) {
      const x = box.x + box.width * ((cell % 3) / 3 + 1 / 6);
      const y = box.y + box.height * (Math.floor(cell / 3) / 3 + 1 / 6);
      await page.mouse.click(x, y);
    }
    await page.waitForTimeout(900);
  }
  await expect(result).toBeVisible({ timeout: 15_000 });
  expect(errors).toEqual([]);
});
