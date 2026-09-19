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

  // Exactly two people and no bots: then nothing moves except the keys this test presses,
  // which is the only way to be sure about what raised or lifted the cover.
  await page.locator('.seat').nth(1).click();
  await page.getByRole('button', { name: /Person/ }).click();
  for (const chair of [3, 2]) {
    await page.locator('.seat').nth(chair).click();
    await page.getByRole('button', { name: /Nobody/ }).click();
  }
  // Empty chairs keep the .seat class and say "Add", so count the ones somebody is sitting in.
  await expect(page.getByRole('button', { name: /Tap to change/ })).toHaveCount(2);
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
  // Phaser reads input on its own frame, so a press is not finished when Playwright returns and
  // the next one can arrive after the turn has changed. That is exactly the case the cover has
  // to survive, so the test keeps pressing quickly rather than tiptoeing around it.
  const board = page.locator('.board');
  const keys = ['ArrowRight', 'Enter', 'd'];
  for (let tries = 0; tries < 60; tries++) {
    if ((await handCheck(page))?.shown !== first!.shown) break;
    await board.press(keys[tries % keys.length]!);
  }
  await page.waitForTimeout(150);
  expect((await handCheck(page))?.shown, 'the turn never reached the other person').not.toBe(first!.shown);
  const second = await handCheck(page);
  const saw = `first ${JSON.stringify(first)}, then ${JSON.stringify(second)}`;
  expect(second!.covered, `the hand is covered when the phone changes hands: ${saw}`).toBe(true);
  expect(second!.faceUp, `no card of the new hand is face up behind the cover: ${saw}`).toBe(0);
  expect(errors).toEqual([]);
});
