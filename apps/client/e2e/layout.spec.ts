import { expect, test, type Page } from '@playwright/test';

/**
 * Layout checks on every screen size (docs/13-platforms-and-testing.md):
 * nothing scrolls sideways, the board fits on screen, and tile art stays inside its tile.
 */
const GAMES = ['Tic-Tac-Toe', 'Four in a Row', 'Ludo', '2048', 'Sudoku', 'Solitaire', 'FreeCell', 'Spider', 'Pyramid', 'TriPeaks', 'Crazy Eights', 'Go Fish', 'War', 'Old Maid', 'Hearts', 'Spades', 'Callbreak', 'Gin Rummy', 'Rummy', 'Word Guess', 'Word Search', 'Mini Crossword', 'Word Ladder', 'Memory', 'Sliding Puzzle', 'Color Sort', 'Echo', 'Classic Snake', 'Checkers', 'Chess', 'Backgammon', 'Sea Battle', 'Reversi', 'Dots & Boxes', 'Mancala', 'Snakes & Ladders', 'Ultimate Tic-Tac-Toe', 'Yatzy', 'Shut the Box', 'Dominoes', 'Air Hockey', 'Ping Pong', 'Tug of War', 'Reflex Race', 'Sumo', 'Penalty Kicks', 'Snake Battle'];

async function noSidewaysScroll(page: Page, where: string): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${where} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(1);
}

/**
 * The Android WebView is narrower than any of our eight screen types, and it was the only thing
 * that noticed a third button in the hero pushing the home screen 10px sideways. So the shelf is
 * checked at 320 too, which is narrower than any phone we expect to see.
 */
test('home fits a very narrow phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');
  await expect(page.locator('.tile').first()).toBeVisible();
  await page.waitForTimeout(500);
  await noSidewaysScroll(page, 'Home at 320px');
  // Every settings button is reachable, not hanging off the edge.
  for (const button of await page.locator('.toggles button').all()) await expect(button).toBeInViewport();
});

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

/**
 * Big screens should use the room rather than centring a phone layout in it. The store
 * screenshots showed the board sitting in the middle third of a landscape tablet with empty
 * space either side, and none of the checks above said a word, because nothing overflowed.
 */
test('a landscape screen puts the board and its controls side by side', async ({ page }) => {
  const viewport = page.viewportSize()!;
  test.skip(viewport.width < 900 || viewport.width <= viewport.height, 'This is about wide landscape screens');
  await page.goto('/');
  await page.getByRole('button', { name: /^Chess/ }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('.board canvas')).toBeVisible();
  await page.waitForTimeout(400);

  const board = (await page.locator('.board').boundingBox())!;
  const status = (await page.locator('.status').boundingBox())!;
  // Whose turn it is stands beside the board, not above it.
  expect(status.x, `the turn line starts at ${Math.round(status.x)} and the board ends at ${Math.round(board.x + board.width)}`).toBeGreaterThan(
    board.x + board.width - 1,
  );
  // And the board takes the height it has been given.
  const share = board.height / viewport.height;
  expect(share, `the board is ${Math.round(share * 100)}% of a ${viewport.width}x${viewport.height} screen`).toBeGreaterThan(0.7);
});

test('installed web app: opens and plays with no connection at all', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'The cold offline start is checked in Chromium, where service workers are fully supported in tests');
  await page.goto('/');
  await expect(page.locator('.tile').first()).toBeVisible();
  // The service worker has stored the whole app once it is active; reload so it controls the page.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.tile').first()).toBeVisible();
  await page.getByRole('button', { name: /^Sudoku/ }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('.board canvas')).toBeVisible();
  await context.setOffline(false);
});

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
