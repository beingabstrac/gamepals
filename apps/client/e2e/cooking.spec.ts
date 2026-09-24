import { expect, test } from '@playwright/test';

/**
 * The still-cooking shelf (docs/08 D4). The row is empty in a normal build, which is the point:
 * it exists so the next game can go out before it is finished rather than sitting behind a
 * "coming soon" tile nobody can play. `?cooking=<id>` puts a game in it so the promise it makes,
 * that nothing here is kept, can actually be tested.
 */
test('a normal build has no still-cooking row', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.cooking')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Tic-Tac-Toe/ })).toBeVisible();
});

test('a game still cooking is playable, sits in its own row, and keeps nothing', async ({ page }) => {
  await page.goto('/?cooking=tic-tac-toe');
  const shelf = page.locator('.cooking');
  await expect(shelf).toBeVisible();
  await expect(shelf).toContainText('nothing here counts');
  // It moved out of the main shelves rather than being in both. (Every shelf, not the first grid:
  // since the home has shelves by kind, the first grid is the duels, which never held it.)
  await expect(shelf.getByRole('button', { name: /^Tic-Tac-Toe/ })).toBeVisible();
  await expect(page.locator('.shelf').getByRole('button', { name: /^Tic-Tac-Toe/ })).toHaveCount(0);

  await shelf.getByRole('button', { name: /^Tic-Tac-Toe/ }).click();
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

  // Finished, and the record is still empty: that is the whole promise of the row.
  await page.goto('/');
  await page.getByRole('button', { name: 'Your stats' }).click();
  await expect(page.getByRole('dialog', { name: 'Your stats' })).toContainText(/Nothing here yet/);
});
