import { expect, test, type Page } from '@playwright/test';

/**
 * What is on the screen against what the rules say is on the board. 2048 used to lose tiles when
 * moves came faster than its animation, and no screenshot can tell you that has come back. The
 * scene answers `tileCheck()` in test mode; any scene can grow the same answer.
 */
async function tileCheck(page: Page): Promise<{ drawn: number; real: number } | null> {
  return page.evaluate(() => {
    const game = (window as unknown as { gamepalsTestGame?: { scene: { scenes: unknown[] } } }).gamepalsTestGame;
    const scene = game?.scene.scenes[0] as { tileCheck?: () => { drawn: number; real: number } } | undefined;
    return scene?.tileCheck ? scene.tileCheck() : null;
  });
}

test('2048 draws every tile the rules say is there, however fast the moves come', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  // The fastest bots we have, which is what used to overtake the animation.
  await page.goto('/?autoplay=10');
  await page.getByRole('button', { name: /^2048/ }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('.board canvas')).toBeVisible();

  // Look several times over a stretch of play, not once: the drift used to come and go.
  for (let look = 0; look < 6; look++) {
    await page.waitForTimeout(700);
    const check = await tileCheck(page);
    expect(check, 'the scene answers tileCheck in test mode').not.toBeNull();
    expect(check!.drawn, `look ${look + 1}: tiles drawn against tiles in the game`).toBe(check!.real);
  }
  expect(errors).toEqual([]);
});
