import { expect, test, type Page } from '@playwright/test';

/**
 * Saves a picture of every game actually being played, for looking over how games read on a
 * phone (docs/08 quality passes) and later for store shots. Browser screenshots capture the
 * canvas; the Android WebView ones do not, whatever we try, so the gallery lives here.
 * Tagged @full, so it runs on the weekly and manual runs, not on every push.
 */
const GAMES = [
  'Tic-Tac-Toe', 'Checkers', 'Chess', 'Backgammon', 'Sea Battle', 'Reversi', 'Dots & Boxes', 'Mancala',
  'Snakes & Ladders', 'Ultimate Tic-Tac-Toe', 'Yatzy', 'Shut the Box', 'Dominoes', 'Four in a Row', 'Ludo',
  '2048', 'Sudoku', 'Solitaire', 'FreeCell', 'Spider', 'Pyramid', 'TriPeaks', 'Crazy Eights', 'Go Fish', 'War', 'Old Maid', 'Hearts', 'Spades', 'Callbreak', 'Gin Rummy', 'Rummy', 'Word Guess', 'Word Search', 'Mini Crossword', 'Word Ladder', 'Word Groups', 'Anagram Hunt', 'Target Number', 'Quick Maths', 'Memory', 'Sliding Puzzle', 'Color Sort', 'Echo', 'Classic Snake',
  'Air Hockey', 'Ping Pong', 'Tug of War', 'Reflex Race', 'Sumo', 'Penalty Kicks', 'Snake Battle',
];

const slug = (name: string) => name.toLowerCase().replace(/\W+/g, '-');

/**
 * Wait until nothing is moving before taking the picture. A shot at a fixed moment catches
 * whatever happened to be mid-flight: a domino halfway from a player's chip to the table looks
 * exactly like a domino drawn on top of a player's name, and a card on its way to a pile looks
 * like a card in the wrong place. Reviewing those pictures means guessing which it was, so the
 * gallery now settles first. Real-time games never settle, so there is a cap.
 */
async function settle(page: Page): Promise<void> {
  const quiet = await page
    .waitForFunction(
      () => {
        const game = (window as unknown as { gamepalsTestGame?: { scene: { scenes: { tweens?: { getTweens(): unknown[] } }[] } } })
          .gamepalsTestGame;
        const scene = game?.scene.scenes[0];
        return scene?.tweens ? scene.tweens.getTweens().length === 0 : true;
      },
      undefined,
      { timeout: 4000 },
    )
    .catch(() => null);
  // Nothing settled in time: a real-time game, so take it as it is rather than failing a shot.
  if (!quiet) await page.waitForTimeout(200);
}

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
    await settle(page);
    await page.screenshot({ path: `screenshots/${testInfo.project.name}/${slug(name)}.png` });
  });
}
