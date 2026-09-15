import { expect, test } from '@playwright/test';

/**
 * Whole games, start to finish, on every screen type (docs/13-platforms-and-testing.md).
 * `?autoplay` puts bots of mixed levels in every seat and speeds the game up, so late-game code
 * (win animations, cascades, sudden death, result sheets) runs on every device, not just the first taps.
 * Tagged @full: CI runs these weekly, on release tags and on manual runs.
 */
const GAMES = [
  'Tic-Tac-Toe',
  'Four in a Row',
  'Ludo',
  '2048',
  'Sudoku',
  'Solitaire',
  'Memory',
  'Sliding Puzzle',
  'Color Sort',
  'Echo',
  'Classic Snake',
  'Checkers',
  'Reversi',
  'Dots & Boxes',
  'Mancala',
  'Air Hockey',
  'Ping Pong',
  'Tug of War',
  'Reflex Race',
  'Sumo',
  'Penalty Kicks',
  'Snake Battle',
];

/** Solitaire deals can be unwinnable, so for it a long stretch of play with no errors is the pass mark. */
const MAY_NOT_FINISH = new Set(['Solitaire']);

for (const name of GAMES) {
  test(`${name}: a whole game plays to the end @full`, async ({ page }) => {
    test.setTimeout(300_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });

    await page.goto('/?autoplay=6');
    await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.locator('.board canvas')).toBeVisible();

    const result = page.locator('.result-sheet');
    if (MAY_NOT_FINISH.has(name)) {
      await result.waitFor({ state: 'visible', timeout: 45_000 }).catch(() => undefined);
    } else {
      await expect(result).toBeVisible({ timeout: 240_000 });
      // A rematch starts cleanly too.
      await result.getByRole('button').first().click();
      await expect(page.locator('.board canvas')).toBeVisible();
      await page.waitForTimeout(1500);
    }
    expect(errors).toEqual([]);
  });
}
