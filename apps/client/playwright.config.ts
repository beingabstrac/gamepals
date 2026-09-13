import { defineConfig, devices } from '@playwright/test';

// Software WebGL so the Phaser renderer works on CI machines without a GPU (Chromium only).
const swiftshader = { launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } };
const desktop = { viewport: { width: 1280, height: 720 } };

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
  ],
  webServer: {
    command: 'pnpm preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
