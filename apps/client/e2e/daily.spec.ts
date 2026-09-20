import { expect, test } from '@playwright/test';

/**
 * Today's puzzle (docs/08 D2). The point of it is that everybody gets the same board on the same
 * day with no server involved, so the two things worth proving are that it is there and that it
 * does not change when the page does.
 */
test('the shelf offers today\'s puzzle, and it is the same one on every load', async ({ page }) => {
  await page.goto('/');
  const daily = page.locator('.daily');
  await expect(daily).toBeVisible();
  await expect(daily.locator('.daily-kicker')).toContainText(/Today's puzzle/i);

  const name = (await daily.locator('h2').textContent())?.trim();
  expect(name, 'the daily names a game').toBeTruthy();
  // It says how long it takes and when the next one lands.
  await expect(daily.locator('.daily-note')).toContainText(/min/);
  await expect(daily.locator('.daily-note')).toContainText(/next in/);

  // The same day gives the same puzzle: the seed is the date, not a random number.
  await page.reload();
  await expect(page.locator('.daily h2')).toHaveText(name!);

  await daily.getByRole('button', { name: /Play/ }).click();
  await expect(page.locator('.board canvas')).toBeVisible();
});

test('the streak can be switched off', async ({ page }) => {
  await page.goto('/');
  const flame = page.getByRole('button', { name: /Streaks (on|off)/ });
  await expect(flame).toBeVisible();
  await expect(flame).toHaveAttribute('aria-pressed', 'true');
  await flame.click();
  await expect(page.getByRole('button', { name: 'Streaks off' })).toHaveAttribute('aria-pressed', 'false');
});
