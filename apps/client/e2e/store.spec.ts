import { expect, test, type Page, type TestInfo } from '@playwright/test';

/**
 * Store screenshots, taken from real play at the sizes Apple and Google ask for
 * (docs/14-store-kit.md). They run only on the `store-*` projects, which CI starts on demand,
 * and land in `store/<project>/` as JPEGs, because both stores refuse an alpha channel and a
 * JPEG cannot carry one.
 */
const shots = (info: TestInfo) => `store/${info.project.name}`;

/**
 * These only make sense at a store's own size, so every other project walks past them.
 * The four device projects take the screenshots; `store-feature` takes only the 1024x500 banner.
 */
function storeOnly(info: TestInfo, which: 'devices' | 'feature'): void {
  const name = info.project.name;
  if (!name.startsWith('store-')) test.skip(true, 'Store shots are taken on the store-* projects only');
  else if (which === 'feature' && name !== 'store-feature') test.skip(true, 'The banner is taken once, at its own size');
  else if (which === 'devices' && name === 'store-feature') test.skip(true, 'That project takes the banner, not the screenshots');
}
/** Long enough for a board to fill up, short enough that the quick games are not over. */
const PLAYED_IN_MS = 3000;

async function playedIn(page: Page, name: string): Promise<void> {
  // Bots in every seat, so the picture is a real game rather than an empty board.
  await page.goto('/?autoplay=2');
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('.board canvas')).toBeVisible();
  await page.waitForTimeout(PLAYED_IN_MS);
}

test.describe('store screenshots @store', () => {
  test('the shelf: every game in one app', async ({ page }, info) => {
    storeOnly(info, 'devices');
    await page.goto('/');
    await expect(page.getByRole('button', { name: /^Chess/ })).toBeVisible();
    await page.screenshot({ path: `${shots(info)}/01-shelf.jpg`, type: 'jpeg', quality: 92 });
  });

  test('the table: who is playing, and how good the bots are', async ({ page }, info) => {
    storeOnly(info, 'devices');
    await page.goto('/');
    await page.getByRole('button', { name: /^Chess/ }).click();
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    await page.screenshot({ path: `${shots(info)}/02-table.jpg`, type: 'jpeg', quality: 92 });
  });

  for (const [order, name] of [
    ['03', 'Chess'],
    ['04', 'Ludo'],
    ['05', 'Air Hockey'],
    ['06', 'Solitaire'],
  ] as const) {
    test(`${name} in play`, async ({ page }, info) => {
      storeOnly(info, 'devices');
      await playedIn(page, name);
      await page.screenshot({ path: `${shots(info)}/${order}-${name.toLowerCase().replace(/\W+/g, '-')}.jpg`, type: 'jpeg', quality: 92 });
    });
  }

  test('the feature graphic, from the app itself', async ({ page }, info) => {
    storeOnly(info, 'feature');
    // Google Play's feature graphic is 1024x500. Taking it from the real home screen keeps the
    // logo, the mascot and the colours honest: they can never drift from the app.
    await page.goto('/');
    await expect(page.getByRole('button', { name: /^Chess/ })).toBeVisible();
    await page.screenshot({ path: 'store/feature-graphic.jpg', type: 'jpeg', quality: 92 });
  });
});
