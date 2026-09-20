import { expect, test, type Page } from '@playwright/test';

/**
 * Every scene with a status line or a label somewhere a piece could land on, against its own
 * board. Every one of these scenes put a status line through
 * its own content at least once, and only a screenshot ever showed it: Word Guess printed
 * "Got it!" inside an empty square of the grid, Word Groups printed "All four." across the last
 * group, Anagram Hunt printed the count straight through the list of finds. Tests said all three
 * ran, finished, fitted eight screen types and logged nothing.
 *
 * So each scene now says where its bands are and this checks that none of them sit on top of
 * another. A band is a horizontal strip the scene draws something in.
 */
interface Band {
  name: string;
  top: number;
  bottom: number;
}

async function bands(page: Page): Promise<Band[] | null> {
  return page.evaluate(() => {
    const game = (window as unknown as { gamepalsTestGame?: { scene: { scenes: unknown[] } } }).gamepalsTestGame;
    const scene = game?.scene.scenes[0] as { layoutCheck?: () => Band[] } | undefined;
    return scene?.layoutCheck ? scene.layoutCheck() : null;
  });
}

async function open(page: Page, name: string): Promise<void> {
  await page.goto('/?autoplay=3');
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('.board canvas')).toBeVisible();
}

const BANDED = ['Word Guess', 'Word Search', 'Mini Crossword', 'Word Ladder', 'Word Groups', 'Anagram Hunt', 'Target Number', 'Quick Maths'];

for (const name of BANDED) {
  test(`${name}: nothing is drawn on top of anything else`, async ({ page }) => {
    await open(page, name);
    // Look a few times: the bands move as the board fills, and a bot game can end while we look.
    for (let look = 0; look < 4; look++) {
      const report = await bands(page);
      if (!report) break;
      expect(report.length, `${name} answers layoutCheck`).toBeGreaterThan(1);
      const sorted = [...report].sort((a, b) => a.top - b.top);
      for (let i = 0; i < sorted.length - 1; i++) {
        const above = sorted[i]!;
        const below = sorted[i + 1]!;
        expect(
          below.top,
          `look ${look + 1}: "${above.name}" ends at ${above.bottom} and "${below.name}" starts at ${below.top}`,
        ).toBeGreaterThanOrEqual(above.bottom);
      }
      await page.waitForTimeout(800);
    }
  });
}

test('Mini Crossword: no clue runs off the sides', async ({ page }) => {
  await open(page, 'Mini Crossword');
  // Bots fill the grid, so the clue changes as they go. Every one of them has to fit.
  for (let look = 0; look < 6; look++) {
    const report = await page.evaluate(() => {
      const game = (window as unknown as { gamepalsTestGame?: { scene: { scenes: unknown[] } } }).gamepalsTestGame;
      const scene = game?.scene.scenes[0] as { clueCheck?: () => { widest: number; room: number } } | undefined;
      return scene?.clueCheck ? scene.clueCheck() : null;
    });
    if (!report) break;
    expect(report.widest, `look ${look + 1}: the clue is wider than the board`).toBeLessThanOrEqual(report.room);
    await page.waitForTimeout(700);
  }
});

/**
 * Dominoes is not in the band list above, because its pieces are supposed to move across it: a
 * tile flies from its owner's chip to the board every time one is played. What it owes instead is
 * that they arrive. They did not for a long time, because every state change restarted the tween,
 * so tiles crawled a few pixels and stayed on their owner's name with the board empty.
 */
test('Dominoes: played tiles end up on the board, not on the players', async ({ page }) => {
  await open(page, 'Dominoes');
  let bestOnBoard = 0;
  let worstOnChips = 0;
  let laid = 0;
  for (let look = 0; look < 6; look++) {
    await page.waitForTimeout(900);
    const report = await page.evaluate(() => {
      const game = (window as unknown as { gamepalsTestGame?: { scene: { scenes: unknown[] } } }).gamepalsTestGame;
      const scene = game?.scene.scenes[0] as
        | { boardCheck?: () => { onBoard: number; onChips: number; laid: number } }
        | undefined;
      return scene?.boardCheck ? scene.boardCheck() : null;
    });
    if (!report) break;
    bestOnBoard = Math.max(bestOnBoard, report.onBoard);
    worstOnChips = Math.max(worstOnChips, report.onChips);
    laid = Math.max(laid, report.laid);
  }
  if (laid === 0) return; // Nothing was played in the time we watched, so there is nothing to say.
  expect(bestOnBoard, `${laid} tiles played and none ever settled on the board`).toBeGreaterThan(0);
  expect(worstOnChips, 'tiles came to rest on a player rather than the board').toBe(0);
});

/**
 * A scene that plays events out one at a time, while the line above it is read straight from the
 * state, can drift. Snakes & Ladders did, without limit: the board showed both tokens at the start
 * while the line had them on 47 and 45. Shut the Box was built the same way.
 */
for (const { name, limit } of [
  { name: 'Snakes & Ladders', limit: 6 },
  // Shut the Box plays each roll out in turn and had the same unbounded queue.
  { name: 'Shut the Box', limit: 2 },
]) {
  test(`${name}: the board keeps up with the score line`, async ({ page }) => {
    await open(page, name);
    let worst = 0;
    for (let look = 0; look < 6; look++) {
      await page.waitForTimeout(900);
      const report = await page.evaluate(() => {
        const game = (window as unknown as { gamepalsTestGame?: { scene: { scenes: unknown[] } } }).gamepalsTestGame;
        const scene = game?.scene.scenes[0] as { boardCheck?: () => { behind: number; walking: boolean } } | undefined;
        return scene?.boardCheck ? scene.boardCheck() : null;
      });
      if (!report) break;
      // A token in the middle of its walk is allowed to be behind; a settled board is not.
      if (!report.walking) worst = Math.max(worst, report.behind);
    }
    expect(worst, `${name}: the board settled this far behind the state`).toBeLessThanOrEqual(limit);
  });
}
