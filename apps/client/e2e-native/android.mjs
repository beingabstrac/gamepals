/**
 * End-to-end test of the real Android app (Capacitor APK) on an emulator (docs/13-platforms-and-testing.md).
 * Playwright connects to the app's own WebView, so this runs inside the installed app, not a browser.
 * Every game is played to its result with `?autoplay`, and a screenshot of each is saved.
 *
 * There is exactly one page load per app launch (to switch autoplay on); games are then opened and left
 * with the app's own Back buttons. Reloading the page for every game sometimes detached the WebView from
 * Playwright ("Target page ... has been closed") with no crash in the Android log.
 *
 * If the app's page is still lost mid-run, the app is relaunched and that game is tried once more. Every
 * relaunch is reported by name; CI prints the Android crash log afterwards so the cause is visible.
 *
 * Run after `adb install app-debug.apk`:  node e2e-native/android.mjs
 */
import { mkdirSync } from 'node:fs';
import { _android as android } from '@playwright/test';

const PKG = 'app.gamepals.game';
const SHOTS = new URL('../native-shots/', import.meta.url).pathname;
const GAMES = ['Tic-Tac-Toe', 'Four in a Row', 'Ludo', '2048', 'Sudoku', 'Solitaire', 'FreeCell', 'Spider', 'Pyramid', 'TriPeaks', 'Crazy Eights', 'Go Fish', 'War', 'Old Maid', 'Hearts', 'Spades', 'Memory', 'Sliding Puzzle', 'Color Sort', 'Echo', 'Classic Snake', 'Checkers', 'Chess', 'Backgammon', 'Sea Battle', 'Reversi', 'Dots & Boxes', 'Mancala', 'Snakes & Ladders', 'Ultimate Tic-Tac-Toe', 'Yatzy', 'Shut the Box', 'Dominoes', 'Air Hockey', 'Ping Pong', 'Tug of War', 'Reflex Race', 'Sumo', 'Penalty Kicks', 'Snake Battle'];
/** Solitaire deals can be unwinnable; a long stretch of play with no errors is its pass mark. */
const MAY_NOT_FINISH = new Set(['Solitaire', 'FreeCell', 'Spider', 'Pyramid', 'TriPeaks']);
const slug = (name) => name.toLowerCase().replace(/\W+/g, '-');
const firstLine = (error) => String(error?.message ?? error).split('\n')[0];
/** The page or its connection went away (not a failed check inside a working page). */
const lost = (error) => /has been closed|crashed|disconnected|Target closed/i.test(firstLine(error));

mkdirSync(SHOTS, { recursive: true });
const failures = [];
const relaunches = [];
const [device] = await android.devices();
if (!device) throw new Error('No Android device or emulator found');
console.log(`Device: ${device.model()} (${device.serial()})`);

let page;
let origin;
let errors = [];

/** Starts the app fresh and attaches to its WebView. */
async function connect() {
  await device.shell(`am force-stop ${PKG}`);
  await device.shell(`monkey -p ${PKG} -c android.intent.category.LAUNCHER 1`);
  const webView = await device.webView({ pkg: PKG }, { timeout: 90_000 });
  page = await webView.page();
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  origin = new URL(page.url()).origin;
  // The only navigation of the run: bots in every seat, games sped up.
  await page.goto(`${origin}/?autoplay=6`);
  await page.locator('.tile').first().waitFor({ timeout: 60_000 });
}

/** Back to the game shelf using the app's own buttons, from wherever we are. */
async function goHome() {
  for (const label of ['Back to the table', 'Back to games']) {
    const button = page.getByRole('button', { name: label });
    if (await button.count()) await button.click();
  }
  await page.locator('.tile').first().waitFor({ timeout: 30_000 });
}

// Page screenshots only: pulling full-screen captures through the same device connection (device.screenshot,
// adb screencap) dropped the connection to the app's WebView. CI takes one real screen capture afterwards.
// These shots show the page around the game, not the game: a WebView screenshot taken this way comes
// back with an empty canvas (preserveDrawingBuffer makes no difference). For pictures of the games
// themselves see e2e/gallery.spec.ts, where the browser does capture the canvas.
const shot = (path) => page.screenshot({ path });

await connect();
console.log(`App loaded at ${origin}`);

// The home screen fits the phone: nothing scrolls sideways.
const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
if (sideways > 1) failures.push(`Home scrolls sideways by ${sideways}px`);
await shot(`${SHOTS}android-home.png`);

async function play(name) {
  errors = [];
  await goHome();
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.locator('.board canvas').waitFor({ timeout: 30_000 });
  const result = page.locator('.result-sheet');
  if (MAY_NOT_FINISH.has(name)) await result.waitFor({ timeout: 45_000 }).catch(() => undefined);
  else await result.waitFor({ timeout: 300_000 });
  await shot(`${SHOTS}android-${slug(name)}.png`);
}

for (const name of GAMES) {
  const started = Date.now();
  for (let attempt = 0; ; attempt++) {
    try {
      await play(name);
      if (errors.length) failures.push(`${name}: ${errors.join(' | ')}`);
      console.log(`${errors.length ? '✗' : '✓'} ${name} (${Math.round((Date.now() - started) / 1000)}s)${attempt ? ' after a relaunch' : ''}`);
      break;
    } catch (error) {
      if (lost(error) && attempt === 0) {
        relaunches.push(name);
        console.log(`↻ ${name}: the app's page was lost (${firstLine(error)}); relaunching the app and trying again`);
        try {
          await connect();
          continue;
        } catch (again) {
          failures.push(`${name}: could not relaunch the app (${firstLine(again)})`);
          console.log(`✗ ${name}: could not relaunch the app (${firstLine(again)})`);
          break;
        }
      }
      failures.push(`${name}: ${firstLine(error)}`);
      console.log(`✗ ${name}: ${firstLine(error)}`);
      await shot(`${SHOTS}android-${slug(name)}-failed.png`).catch(() => undefined);
      break;
    }
  }
}

await device.close();
if (relaunches.length) console.log(`\nNote: the app was relaunched during ${relaunches.join(', ')}. The Android crash log below shows why.`);
if (failures.length) {
  console.error(`\n${failures.length} problem(s) on Android:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('\nAll games played to the end inside the Android app.');
