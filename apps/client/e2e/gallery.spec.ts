import { expect, test } from '@playwright/test';

/**
 * Saves a picture of every game actually being played, for looking over how games read on a
 * phone (docs/08 quality passes) and later for store shots. Browser screenshots capture the
 * canvas; the Android WebView ones do not, whatever we try, so the gallery lives here.
 * Tagged @full, so it runs on the weekly and manual runs, not on every push.
 */
const GAMES = [
  'Tic-Tac-Toe', 'Checkers', 'Chess', 'Backgammon', 'Sea Battle', 'Reversi', 'Dots & Boxes', 'Mancala',
  'Snakes & Ladders', 'Ultimate Tic-Tac-Toe', 'Yatzy', 'Shut the Box', 'Dominoes', 'Four in a Row', 'Ludo',
  '2048', 'Sudoku', 'Solitaire', 'FreeCell', 'Spider', 'Pyramid', 'TriPeaks', 'Crazy Eights', 'Go Fish', 'War', 'Old Maid', 'Hearts', 'Spades', 'Callbreak', 'Gin Rummy', 'Rummy', 'Memory', 'Sliding Puzzle', 'Color Sort', 'Echo', 'Classic Snake',
  'Air Hockey', 'Ping Pong', 'Tug of War', 'Reflex Race', 'Sumo', 'Penalty Kicks', 'Snake Battle',
];

const slug = (name: string) => name.toLowerCase().replace(/\W+/g, '-');

for (const name of GAMES) {
  test(`${name}: gallery shot @full`, async ({ page }, testInfo) => {
    // One screen type is enough for a gallery; eight would mean 240 pictures a run.
    test.skip(testInfo.project.name !== 'iphone', 'The gallery is taken on the iPhone screen');
    // Bots in every seat, so the picture shows a game in progress rather than an empty board.
    await page.goto('/?autoplay=2');
    await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.locator('.board canvas')).toBeVisible();
    // Long enough for the deal and a few moves, short enough that quick games are not over.
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `screenshots/${testInfo.project.name}/${slug(name)}.png` });
  });
}
