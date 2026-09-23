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
  'FreeCell',
  'Spider',
  'Pyramid',
  'TriPeaks',
  'Crazy Eights',
  'Go Fish',
  'War',
  'Old Maid',
  'Hearts',
  'Spades',
  'Callbreak',
  'Gin Rummy',
  'Rummy',
  'Word Guess',
  'Word Search',
  'Mini Crossword',
  'Word Ladder',
  'Word Groups',
  'Anagram Hunt',
  'Target Number',
  'Quick Maths',
  'Memory',
  'Sliding Puzzle',
  'Sweeper',
  'Flood',
  'Tile Match',
  'Jigsaw',
  'Pool',
  'Mini Golf',
  'Archery',
  'Color Sort',
  'Echo',
  'Classic Snake',
  'Checkers',
  'Chess',
  'Backgammon',
  'Sea Battle',
  'Reversi',
  'Dots & Boxes',
  'Mancala',
  'Snakes & Ladders',
  'Ultimate Tic-Tac-Toe',
  'Yatzy',
  'Shut the Box',
  'Dominoes',
  'Air Hockey',
  'Ping Pong',
  'Tug of War',
  'Reflex Race',
  'Sumo',
  'Penalty Kicks',
  'Snake Battle',
];

/** Patience deals can be unwinnable, so for those a long stretch of play with no errors is the pass mark. */
const MAY_NOT_FINISH = new Set(['Solitaire', 'FreeCell', 'Spider', 'Pyramid', 'TriPeaks']);

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
