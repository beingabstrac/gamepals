import { expect, test, type Page } from '@playwright/test';

/**
 * Teaching and rivalry (docs/08 M8): the one line shown the first time a game is opened, and
 * the running score that follows the same players from one game to the next.
 */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function play(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('.board canvas')).toBeVisible();
}

test('the first time at a game, one line says what to do', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await play(page, 'Tic-Tac-Toe');
  // A fresh browser has played nothing, so the coaching line is there.
  await expect(page.locator('.coach')).toBeVisible();
  await expect(page.locator('.coach')).not.toBeEmpty();
  // It never takes a tap away from the board.
  await expect(page.locator('.coach')).toHaveCSS('pointer-events', 'none');
  expect(errors).toEqual([]);
});

test('the second time at a game, the line is gone', async ({ page }) => {
  await page.goto('/');
  await play(page, 'Tic-Tac-Toe');
  await expect(page.locator('.coach')).toBeVisible();
  // Back to the table and straight in again: the same game, now a game we have played.
  await page.getByRole('button', { name: 'Back to the table' }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('.board canvas')).toBeVisible();
  await expect(page.locator('.coach')).toHaveCount(0);
});

test('the running score follows the same players from game to game', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/?autoplay=6');
  await play(page, 'Tic-Tac-Toe');

  const sheet = page.locator('.result-sheet');
  await expect(sheet).toBeVisible({ timeout: 60_000 });
  const score = page.locator('.rivalry');
  await expect(score).toBeVisible();
  await expect(score).toHaveAttribute('data-games', '1');

  await sheet.getByRole('button', { name: 'Rematch' }).click();
  await expect(sheet).toBeHidden();
  await expect(sheet).toBeVisible({ timeout: 60_000 });
  await expect(score).toHaveAttribute('data-games', '2');
  // Both players are named in the score, whichever chair they are in this game.
  await expect(page.locator('.rivalry-score')).toContainText('·');
  expect(errors).toEqual([]);
});

test('a solo game keeps no score, because there is nobody to keep it against', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^2048/ }).click();
  // Checked at the table rather than at the end of a game: a solo puzzle can run for minutes,
  // and the same rule decides both places, so this catches it on every push instead of weekly.
  await expect(page.locator('.table-score')).toHaveCount(0);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('.board canvas')).toBeVisible();
  await expect(page.locator('.rivalry')).toHaveCount(0);
});
