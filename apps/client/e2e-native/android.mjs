/**
 * End-to-end test of the real Android app (Capacitor APK) on an emulator (docs/13-platforms-and-testing.md).
 * Playwright connects to the app's own WebView, so this runs inside the installed app, not a browser.
 * Every game is played to its result with `?autoplay`, and a screenshot of each is saved.
 *
 * Run after `adb install app-debug.apk`:  node e2e-native/android.mjs
 */
import { mkdirSync } from 'node:fs';
import { _android as android } from '@playwright/test';

const PKG = 'app.gamepals.game';
const SHOTS = new URL('../native-shots/', import.meta.url).pathname;
const GAMES = ['Tic-Tac-Toe', 'Four in a Row', 'Ludo', '2048', 'Sudoku', 'Solitaire', 'Memory', 'Sliding Puzzle', 'Color Sort', 'Echo', 'Classic Snake', 'Air Hockey', 'Ping Pong', 'Tug of War', 'Reflex Race', 'Sumo', 'Penalty Kicks', 'Snake Battle'];
/** Solitaire deals can be unwinnable; a long stretch of play with no errors is its pass mark. */
const MAY_NOT_FINISH = new Set(['Solitaire']);

mkdirSync(SHOTS, { recursive: true });
const failures = [];
const [device] = await android.devices();
if (!device) throw new Error('No Android device or emulator found');
console.log(`Device: ${device.model()} (${device.serial()})`);

await device.shell(`am force-stop ${PKG}`);
await device.shell(`monkey -p ${PKG} -c android.intent.category.LAUNCHER 1`);
const webView = await device.webView({ pkg: PKG }, { timeout: 90_000 });
const page = await webView.page();
// Page screenshots only: pulling full-screen captures through the same device connection (device.screenshot,
// adb screencap) dropped the connection to the app's WebView. CI takes one real screen capture afterwards.
const shot = (path) => page.screenshot({ path });

let errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});

const origin = new URL(page.url()).origin;
console.log(`App loaded at ${origin}`);

// The home screen fits the phone: nothing scrolls sideways.
await page.locator('.tile').first().waitFor({ timeout: 60_000 });
const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
if (sideways > 1) failures.push(`Home scrolls sideways by ${sideways}px`);
await shot(`${SHOTS}android-home.png`);

for (const name of GAMES) {
  errors = [];
  const started = Date.now();
  try {
    await page.goto(`${origin}/?autoplay=6`);
    await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.locator('.board canvas').waitFor({ timeout: 30_000 });
    const result = page.locator('.result-sheet');
    if (MAY_NOT_FINISH.has(name)) await result.waitFor({ timeout: 45_000 }).catch(() => undefined);
    else await result.waitFor({ timeout: 300_000 });
    await shot(`${SHOTS}android-${name.toLowerCase().replace(/\W+/g, '-')}.png`);
    if (errors.length) failures.push(`${name}: ${errors.join(' | ')}`);
    console.log(`${errors.length ? '✗' : '✓'} ${name} (${Math.round((Date.now() - started) / 1000)}s)`);
  } catch (error) {
    failures.push(`${name}: ${error.message.split('\n')[0]}`);
    console.log(`✗ ${name}: ${error.message.split('\n')[0]}`);
    await shot(`${SHOTS}android-${name.toLowerCase().replace(/\W+/g, '-')}-failed.png`).catch(() => undefined);
  }
}

await device.close();
if (failures.length) {
  console.error(`\n${failures.length} problem(s) on Android:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('\nAll games played to the end inside the Android app.');
