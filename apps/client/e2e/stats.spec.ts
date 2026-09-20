import { expect, test } from '@playwright/test';

/**
 * Your own record (docs/08 D3b). The shop used to promise stats that did not exist, so the fix is
 * worth exactly the numbers behind it: this plays a game to the end and checks the count moved.
 */
test('a finished game goes on the record', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Your stats' }).click();
  const sheet = page.getByRole('dialog', { name: 'Your stats' });
  await expect(sheet).toContainText(/Nothing here yet/);
  await sheet.getByRole('button', { name: 'Close' }).click();

  // Tic-Tac-Toe against a bot is the quickest finish we have, and it always ends.
  await page.getByRole('button', { name: /^Tic-Tac-Toe/ }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  const board = page.locator('.board canvas');
  await expect(board).toBeVisible();
  const box = (await board.boundingBox())!;
  const result = page.locator('.result-sheet');
  for (let square = 0; square < 9 && !(await result.isVisible()); square++) {
    await board.click({
      position: {
        x: (box.width / 3) * ((square % 3) + 0.5),
        y: (box.height / 3) * (Math.floor(square / 3) + 0.5),
      },
    });
    await page.waitForTimeout(500);
  }
  await expect(result, 'the game finished').toBeVisible();

  await page.getByRole('button', { name: 'Back to the table' }).click();
  await page.getByRole('button', { name: 'Back to games' }).click();
  await page.getByRole('button', { name: 'Your stats' }).click();
  // The number and its label are separate elements, so read them separately rather than hoping
  // for a space between them: the page says "1" and "game finished", not "1 game finished".
  const first = sheet.locator('.stats-totals li').first();
  await expect(first.locator('.stats-number')).toHaveText('1');
  await expect(first.locator('.stats-label')).toHaveText('game finished');
  await expect(sheet.locator('.stats-game')).toHaveText('Tic-Tac-Toe');
  await expect(sheet.locator('.stats-count')).toContainText('1 played');
});

test('an autoplay run never reaches the record', async ({ page }) => {
  // Every seat is a bot, so nobody played it. Without this the numbers would all come from CI.
  await page.goto('/?autoplay=4');
  await page.getByRole('button', { name: /^Tic-Tac-Toe/ }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('.board canvas')).toBeVisible();
  await expect(page.locator('.result-sheet')).toBeVisible({ timeout: 30_000 });

  await page.goto('/');
  await page.getByRole('button', { name: 'Your stats' }).click();
  await expect(page.getByRole('dialog', { name: 'Your stats' })).toContainText(/Nothing here yet/);
});
