import { expect, test, type Page } from '@playwright/test';

/**
 * The word games against their own boards. Both of these shipped green and only a screenshot
 * showed the trouble: Word Guess printed "Got it!" inside an empty square of the grid, because
 * the line under the board sat 8px above where the grid ended. The crossword's clue is the same
 * kind of thing waiting to happen, since one clue in the dictionary is forty-two characters and
 * the short ones set the font size. Each scene answers a small question about itself.
 */
async function ask<T>(page: Page, method: string): Promise<T | null> {
  return page.evaluate((name) => {
    const game = (window as unknown as { gamepalsTestGame?: { scene: { scenes: unknown[] } } }).gamepalsTestGame;
    const scene = game?.scene.scenes[0] as Record<string, undefined | (() => unknown)> | undefined;
    const method = scene?.[name];
    return typeof method === 'function' ? (method.call(scene) as T) : null;
  }, method);
}

async function open(page: Page, name: string): Promise<void> {
  await page.goto('/?autoplay=3');
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('.board canvas')).toBeVisible();
}

test('Word Guess: the line under the board is below the board', async ({ page }) => {
  await open(page, 'Word Guess');
  const report = await ask<{ gridBottom: number; sayTop: number; keysTop: number }>(page, 'bannerCheck');
  expect(report, 'the scene answers bannerCheck').not.toBeNull();
  expect(report!.sayTop, 'the line sits inside the grid').toBeGreaterThan(report!.gridBottom);
  expect(report!.keysTop, 'the keyboard sits on the line').toBeGreaterThan(report!.sayTop + 16);
});

test('Mini Crossword: no clue runs off the sides', async ({ page }) => {
  await open(page, 'Mini Crossword');
  // Bots fill the grid, so the clue changes as they go. Every one of them has to fit.
  for (let look = 0; look < 6; look++) {
    const report = await ask<{ widest: number; room: number }>(page, 'clueCheck');
    if (!report) break;
    expect(report.widest, `look ${look + 1}: the clue is wider than the board`).toBeLessThanOrEqual(report.room);
    await page.waitForTimeout(700);
  }
});
