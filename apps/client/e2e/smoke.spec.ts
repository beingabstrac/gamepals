import { expect, test, type Page } from '@playwright/test';

/** Every playable game on the shelf. Add new games here so they're opened and played on every push. */
const GAMES = ['Tic-Tac-Toe', 'Four in a Row', 'Ludo', 'Air Hockey', 'Ping Pong', 'Tug of War', 'Reflex Race', 'Sumo', 'Penalty Kicks', 'Snake Battle', '2048', 'Sudoku', 'Solitaire', 'FreeCell', 'Spider', 'Pyramid', 'TriPeaks', 'Crazy Eights', 'Go Fish', 'War', 'Old Maid', 'Hearts', 'Spades', 'Callbreak', 'Gin Rummy', 'Rummy', 'Memory', 'Sliding Puzzle', 'Color Sort', 'Echo', 'Classic Snake', 'Checkers', 'Chess', 'Backgammon', 'Sea Battle', 'Reversi', 'Dots & Boxes', 'Mancala', 'Snakes & Ladders', 'Ultimate Tic-Tac-Toe', 'Yatzy', 'Shut the Box', 'Dominoes'];

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

test('the privacy page is there, and says what the app stores', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  // Both stores want a privacy URL that works, and it ships inside the apps so it opens offline.
  await page.getByRole('link', { name: 'Privacy' }).click();
  await expect(page.getByRole('heading', { name: 'Privacy', level: 1 })).toBeVisible();
  await expect(page.locator('body')).toContainText('never leaves it');
  await expect(page.locator('body')).toContainText('microphone, camera, location');
  await page.getByRole('link', { name: 'Back to the games' }).click();
  await expect(page.getByRole('button', { name: /^Chess/ })).toBeVisible();
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

test('Sudoku: pick a level, use a hint, undo it', async ({ page }) => {
  const errors = watchErrors(page);
  await openTable(page, 'Sudoku');
  await page.getByRole('button', { name: 'Hard', exact: true }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();

  const status = page.locator('.status');
  await expect(status).toContainText('Hard');
  const before = await status.innerText();
  await page.getByRole('button', { name: /^Hint/ }).click();
  await expect(page.locator('.hint-bubble')).toBeVisible();
  await expect(status).not.toHaveText(before);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(status).toHaveText(before);
  await expect(page.getByRole('button', { name: /^Hint/ })).toHaveAccessibleName('Hint, 2 left');
  expect(errors).toEqual([]);
});

test('Solitaire: draw from the deck, then undo it', async ({ page }) => {
  const errors = watchErrors(page);
  await openTable(page, 'Solitaire');
  await page.getByRole('button', { name: 'Draw 3', exact: true }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();

  const box = await page.locator('.board canvas').boundingBox();
  if (!box) throw new Error('Game canvas has no size');
  const undo = page.getByRole('button', { name: 'Undo', exact: true });
  await expect(undo).toBeDisabled();
  // The deck sits in the top-left corner of the table.
  await page.mouse.click(box.x + box.width * 0.078, box.y + box.height * 0.078);
  await expect(undo).toBeEnabled();
  await undo.click();
  await expect(undo).toBeDisabled();
  await page.getByRole('button', { name: 'Hint', exact: true }).click();
  expect(errors).toEqual([]);
});

test('keyboard: Tic-Tac-Toe and Four in a Row play with number keys', async ({ page }) => {
  const errors = watchErrors(page);
  const cases: [string, string, string][] = [
    ['Tic-Tac-Toe', '5', '(O)'],
    ['Four in a Row', '4', '(Red)'],
  ];
  await page.goto('/');
  // Move between games with the app's own Back buttons, like a player, not a page reload mid-game
  // (Firefox logs "Navigated away from page" for work a game had in flight when the page reloads).
  const leaveGame = async () => {
    await page.getByRole('button', { name: 'Back to the table' }).click();
    await page.getByRole('button', { name: 'Back to games' }).click();
  };
  const pick = (name: string) => page.getByRole('button', { name: new RegExp(`^${name}`) }).click();

  for (const [name, key, nextSide] of cases) {
    await pick(name);
    await page.getByRole('button', { name: /Friends/ }).click();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.locator('.board canvas')).toBeVisible();
    await page.waitForTimeout(400);
    await page.keyboard.press(key);
    // The key played a move, so it's now the second player's turn.
    await expect(page.locator('.status')).toContainText(nextSide);
    await leaveGame();
  }

  // Duels: against a bot, Space pulls for the one person playing.
  await pick('Tug of War');
  await page.getByRole('button', { name: /vs Bot/ }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('.board canvas')).toBeVisible();
  await page.waitForTimeout(3500);
  for (let i = 0; i < 10; i++) await page.keyboard.press(' ');
  expect(errors).toEqual([]);
});

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
