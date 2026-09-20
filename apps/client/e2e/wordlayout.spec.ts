import { expect, test, type Page } from '@playwright/test';

/**
 * Every scene with a status line, against its own board. Every one of these scenes put a status line through
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

const BANDED = ['Word Guess', 'Word Search', 'Mini Crossword', 'Word Ladder', 'Word Groups', 'Anagram Hunt', 'Target Number'];

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
