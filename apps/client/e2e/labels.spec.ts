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

for (const name of ['Hearts', 'Spades', 'Callbreak']) {
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
