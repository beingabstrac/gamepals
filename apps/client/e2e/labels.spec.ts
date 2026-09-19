import { expect, test, type Page } from '@playwright/test';

/**
 * Seat names against the table they sit on. In Hearts, Spades and Callbreak the two seats at the
 * sides had their names centred 76px from the edge, so a name like "Pip · bid 5 · won 0" ran off
 * the table and sat on top of that seat's face-down pile. Every test passed for two milestones:
 * the page did not scroll, the board fitted, no card went missing. Only a screenshot showed it.
 * The scene answers `labelCheck()` in test mode; any scene with text on a table can grow the same.
 */
interface LabelReport {
  outside: string[];
  over: string[];
}

async function labelCheck(page: Page): Promise<LabelReport | null> {
  return page.evaluate(() => {
    const game = (window as unknown as { gamepalsTestGame?: { scene: { scenes: unknown[] } } }).gamepalsTestGame;
    const scene = game?.scene.scenes[0] as { labelCheck?: () => LabelReport } | undefined;
    return scene?.labelCheck ? scene.labelCheck() : null;
  });
}

for (const name of ['Hearts', 'Spades', 'Callbreak', 'Gin Rummy', 'Rummy']) {
  test(`${name}: every seat name is on the table and clear of the cards`, async ({ page }) => {
    await page.goto('/?autoplay=4');
    await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.locator('.board canvas')).toBeVisible();

    // Look a few times: the labels change length as the calls and scores come in. A bot game can
    // finish while we are looking, so the scene going away ends the looking rather than failing it.
    let looked = 0;
    for (let look = 0; look < 4; look++) {
      await page.waitForTimeout(1200);
      const report = await labelCheck(page);
      if (!report) break;
      expect(report.outside, `look ${look + 1}: names off the table`).toEqual([]);
      expect(report.over, `look ${look + 1}: names on top of a card`).toEqual([]);
      looked++;
    }
    expect(looked, 'the scene answered labelCheck at least once').toBeGreaterThan(0);
  });
}

/**
 * The turn line, while moves come quickly. `.turn-pill` is keyed on its own text, so it remounts
 * whenever the text changes and replays its entry animation. In Gin Rummy the text changes on
 * every single move (take, draw, throw), so the pill restarted a fade-from-nothing several times
 * a second and was never actually readable. The gallery shot showed an empty gap where the turn
 * line should be, and no test said a word.
 */
test('Gin Rummy: the turn line stays readable while moves come quickly', async ({ page }) => {
  await page.goto('/?autoplay=2');
  await page.getByRole('button', { name: /^Gin Rummy/ }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('.board canvas')).toBeVisible();

  const seen: number[] = [];
  for (let look = 0; look < 6; look++) {
    await page.waitForTimeout(400);
    const opacity = await page.evaluate(() => {
      const pill = document.querySelector('.turn-pill');
      return pill ? Number(getComputedStyle(pill).opacity) : -1;
    });
    if (opacity >= 0) seen.push(opacity);
  }
  expect(seen.length, 'the turn line is on screen').toBeGreaterThan(0);
  expect(Math.min(...seen), `turn line opacity over a stretch of play: ${seen.map((n) => n.toFixed(2)).join(', ')}`).toBeGreaterThan(0.5);
});
