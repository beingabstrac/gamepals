import { defineConfig, devices } from '@playwright/test';

// Software WebGL so the Phaser renderer works on CI machines without a GPU (Chromium only).
const swiftshader = { launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } };
const desktop = { viewport: { width: 1280, height: 720 } };

/**
 * Store screenshot sizes, from Apple's and Google's own pages (checked 2026-09-18).
 * Apple takes 6.9" iPhone (1260x2736) and 13" iPad (2064x2752), and scales those down for every
 * smaller size. Google Play insists on exactly 16:9 or 9:16, which Apple's shapes are not, so
 * Play gets its own pair. These run on demand (`--project store-*`), never on a push.
 */
const store = {
  'store-iphone': { viewport: { width: 420, height: 912 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  'store-ipad': { viewport: { width: 1032, height: 1376 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  'store-play-phone': { viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  'store-play-tablet': { viewport: { width: 960, height: 540 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  // Play's feature graphic is 1024x500 flat, so this one renders at its own size, not scaled up.
  'store-feature': { viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 },
} as const;

/**
 * End-to-end tests against the production build on every kind of screen we ship to
 * (docs/13-platforms-and-testing.md). CI runs one project per job: `--project <name>`.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'android-phone', use: { ...devices['Pixel 7'], ...swiftshader } },
    { name: 'iphone', use: { ...devices['iPhone 15'] } },
    { name: 'ipad', use: { ...devices['iPad Pro 11'] } },
    { name: 'ipad-landscape', use: { ...devices['iPad Pro 11 landscape'] } },
    { name: 'android-tablet', use: { ...devices['Galaxy Tab S4'], ...swiftshader } },
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'], ...desktop, ...swiftshader } },
    { name: 'desktop-safari', use: { ...devices['Desktop Safari'], ...desktop } },
    { name: 'desktop-firefox', use: { ...devices['Desktop Firefox'], ...desktop } },
    ...Object.entries(store).map(([name, size]) => ({ name, use: { ...devices['Desktop Chrome'], ...size, ...swiftshader } })),
  ],
  webServer: {
    command: 'pnpm preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
