import { expect, test } from '@playwright/test';

/**
 * The shop (docs/08 M11b). There is no store behind it yet, so what is worth proving is the shape:
 * three ways to buy, the one-off standing out as the one we lead with, and a purchase that
 * actually turns Pro on and is still on after a reload.
 */
test('the shop offers three plans, and the one-off is the one it leads with', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Go Pro' }).click();

  const sheet = page.getByRole('dialog', { name: /Pro/ });
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('.pro-offer')).toHaveCount(3);
  // Monthly, yearly and one payment, with the one-off flagged.
  await expect(sheet.locator('.pro-offer.hero')).toContainText('One payment');
  await expect(sheet.locator('.pro-offer.hero .pro-flag')).toContainText(/best value/i);
  await expect(sheet.locator('.pro-gives li')).not.toHaveCount(0);
  await expect(sheet.getByRole('button', { name: /Restore/ })).toBeVisible();
});

test('buying turns Pro on, and it survives a reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Go Pro' }).click();
  await page.locator('.pro-offer.hero').click();

  await expect(page.getByText('You have Pro 🎉')).toBeVisible();
  await expect(page.getByText(/yours for good/i)).toBeVisible();

  await page.reload();
  // The shelf remembers, so the way in says so rather than selling it again.
  await expect(page.getByRole('button', { name: 'You have Pro' })).toBeVisible();
});
