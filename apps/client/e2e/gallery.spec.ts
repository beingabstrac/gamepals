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
  '2048', 'Sudoku', 'Solitaire', 'FreeCell', 'Spider', 'Pyramid', 'TriPeaks', 'Crazy Eights', 'Go Fish', 'War', 'Old Maid', 'Hearts', 'Spades', 'Callbreak', 'Gin Rummy', 'Rummy', 'Word Guess', 'Word Search', 'Mini Crossword', 'Word Ladder', 'Word Groups', 'Anagram Hunt', 'Target Number', 'Quick Maths', 'Memory', 'Sliding Puzzle', 'Sweeper', 'Flood', 'Tile Match', 'Jigsaw', 'Pool', 'Mini Golf', 'Archery', 'Spinner War', 'Color Sort', 'Echo', 'Classic Snake',
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
  const quiet = () =>
    page.waitForFunction(
      () => {
        const game = (
          window as unknown as {
            gamepalsTestGame?: { scene: { scenes: { busy?: () => boolean; tweens?: { getTweens(): unknown[] } }[] } };
          }
        ).gamepalsTestGame;
        const scene = game?.scene.scenes[0];
        if (!scene) return true;
        // A scene that moves things itself in `update()` rather than by tweening says so; to the
        // tween list it looks perfectly still while a disc is halfway down a column.
        if (typeof scene.busy === 'function') return !scene.busy();
        return scene.tweens ? scene.tweens.getTweens().length === 0 : true;
      },
      undefined,
      { timeout: 4000 },
    );
  // Twice, with a gap. One quiet moment is not the end of the motion: a Ludo token walks its
  // squares as a chain of short hops, so there is a still instant between every one of them and
  // a single check catches the board halfway through a move while the status line has already
  // moved on. Two quiet samples a beat apart means the chain really has finished.
  for (let look = 0; look < 2; look++) {
    const settled = await quiet().catch(() => null);
    // Nothing settles in a real-time game, so take the shot as it is rather than failing it.
    if (!settled) {
      await page.waitForTimeout(200);
      return;
    }
    if (look === 0) await page.waitForTimeout(280);
  }
  // The status line is HTML and the board is canvas, and a shot composites both. Phaser draws on
  // an animation frame, so without waiting for one the canvas in the picture can be a frame behind
  // the line above it: War's pill read "15 to 37" beside labels reading 36 and 16, and Ultimate's
  // line named one board while a different one glowed. Sixteen milliseconds nobody would ever see,
  // except that these pictures become the store screenshots.
  //
  // Two frames is not enough on its own, which the gallery proved: War still came back with a pill
  // reading "19 to 33" beside a label reading "Nova: 20". The board is not lagging, the game is
  // still being played. A move lands between settle returning and the shot being taken, the line
  // above the board redraws at once and the canvas waits for its frame, and the picture catches
  // the gap. So the wait is for a quiet window rather than a frame count: no move may land across
  // the frames we are about to photograph in.
  for (let tries = 0; tries < 12; tries++) {
    const steady = await page.evaluate(
      () =>
        new Promise<boolean>((done) => {
          const moves = () => {
            const game = (window as unknown as { gamepalsTestGame?: { scene: { scenes: unknown[] } } }).gamepalsTestGame;
            const scene = game?.scene.scenes[0] as { session?: { moves?: unknown[] } } | undefined;
            return scene?.session?.moves?.length ?? -1;
          };
          const before = moves();
          requestAnimationFrame(() => requestAnimationFrame(() => done(moves() === before)));
        }),
    );
    if (steady) return;
    await page.waitForTimeout(120);
  }
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
