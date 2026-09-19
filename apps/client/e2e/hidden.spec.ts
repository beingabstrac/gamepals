import { expect, test, type Page } from '@playwright/test';

/**
 * Hands are private (docs/games/crazy-eights.md). With two people on one phone, nobody may see
 * a hand that is not theirs: when the turn passes, a cover comes down until its owner says they
 * are ready. A canvas cannot be asked that from the outside, so the scene answers `handCheck()`.
 */
async function handCheck(page: Page): Promise<{ shown: number; covered: boolean; faceUp: number } | null> {
  return page.evaluate(() => {
    const game = (window as unknown as { gamepalsTestGame?: { scene: { scenes: unknown[] } } }).gamepalsTestGame;
    const scene = game?.scene.scenes[0] as { handCheck?: () => { shown: number; covered: boolean; faceUp: number } } | undefined;
    return scene?.handCheck ? scene.handCheck() : null;
  });
}

test('two people on one phone never see each other\'s cards', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  // `?inspect` opens the test seam without putting bots in the chairs, so these are real people.
  await page.goto('/?inspect=1');
  await page.getByRole('button', { name: /^Crazy Eights/ }).click();

  // Sit a person in the second chair as well, so the phone has to pass.
  await page.locator('.seat').nth(1).click();
  await page.getByRole('button', { name: /Person/ }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('.board canvas')).toBeVisible();

  const first = await handCheck(page);
  expect(first, 'the scene answers handCheck in test mode').not.toBeNull();
  // The first player's own hand is theirs to see.
  expect(first!.covered).toBe(false);
  expect(first!.faceUp).toBeGreaterThan(0);

  // Play this hand's turn with the keyboard: Enter plays the card in focus, D draws when stuck.
  // One key at a time, checking in between: a key is also how you lift the cover, so pressing on
  // past the turn change would knock on the very cover this test is here to see.
  const board = page.locator('.board');
  const keys = ['ArrowRight', 'Enter', 'd'];
  for (let tries = 0; tries < 60; tries++) {
    if ((await handCheck(page))?.shown !== first!.shown) break;
    await board.press(keys[tries % keys.length]!);
  }
  expect((await handCheck(page))?.shown, 'the turn never reached the other person').not.toBe(first!.shown);
  const second = await handCheck(page);
  expect(second!.covered, 'the hand is covered when the phone changes hands').toBe(true);
  expect(second!.faceUp, 'no card of the new hand is face up behind the cover').toBe(0);
  expect(errors).toEqual([]);
});
