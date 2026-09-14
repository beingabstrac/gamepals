import { expect, test, type Page } from '@playwright/test';

/**
 * Layout checks on every screen size (docs/13-platforms-and-testing.md):
 * nothing scrolls sideways, the board fits on screen, and tile art stays inside its tile.
 */
const GAMES = ['Tic-Tac-Toe', 'Four in a Row', 'Ludo', '2048', 'Sudoku', 'Solitaire', 'Memory', 'Sliding Puzzle', 'Color Sort', 'Echo', 'Air Hockey', 'Ping Pong', 'Tug of War', 'Reflex Race', 'Sumo', 'Penalty Kicks', 'Snake Battle'];

async function noSidewaysScroll(page: Page, where: string): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${where} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(1);
}

test('home: no sideways scroll, and tile art stays inside each tile', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.tile').first()).toBeVisible();
  await page.waitForTimeout(800);
  await noSidewaysScroll(page, 'Home');
  const escapes = await page.evaluate(() =>
    [...document.querySelectorAll('.tile svg text')].flatMap((text) => {
      const svg = text.closest('svg')!.getBoundingClientRect();
      const box = text.getBoundingClientRect();
      const out = box.left < svg.left - 1 || box.right > svg.right + 1 || box.top < svg.top - 1 || box.bottom > svg.bottom + 1;
      return out ? [`${text.closest('.tile')?.querySelector('.title')?.textContent}: "${text.textContent}"`] : [];
    }),
  );
  expect(escapes).toEqual([]);
});

for (const name of GAMES) {
  test(`${name}: table and game fit the screen`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
    await noSidewaysScroll(page, `${name} table`);
    await page.getByRole('button', { name: 'Play', exact: true }).click();

    const board = page.locator('.board');
    await expect(board.locator('canvas')).toBeVisible();
    await page.waitForTimeout(600);
    await noSidewaysScroll(page, `${name} game`);

    const viewport = page.viewportSize()!;
    const box = (await board.boundingBox())!;
    expect(box.width, `${name} board is wider than the screen`).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.height, `${name} board is taller than the screen`).toBeLessThanOrEqual(viewport.height + 1);
    // The game's own buttons can be reached without zooming out.
    for (const button of await page.locator('.sudoku-tools button, .ludo-controls button').all()) {
      await button.scrollIntoViewIfNeeded();
      await expect(button).toBeInViewport();
    }
  });
}

test('offline: a game starts and plays with the network cut', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.tile').first()).toBeVisible();
  await context.setOffline(true);

  await page.getByRole('button', { name: /^Tic-Tac-Toe/ }).click();
  await page.getByRole('button', { name: /vs Bot/ }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  const box = (await page.locator('.board canvas').boundingBox())!;
  const result = page.locator('.result-sheet');
  for (let round = 0; round < 6 && !(await result.isVisible()); round++) {
    for (let cell = 0; cell < 9; cell++) {
      await page.mouse.click(box.x + box.width * ((cell % 3) / 3 + 1 / 6), box.y + box.height * (Math.floor(cell / 3) / 3 + 1 / 6));
    }
    await page.waitForTimeout(900);
  }
  await expect(result).toBeVisible({ timeout: 15_000 });
  await context.setOffline(false);
  expect(errors).toEqual([]);
});
