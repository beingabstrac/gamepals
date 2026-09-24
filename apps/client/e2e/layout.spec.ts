import { expect, test, type Page } from '@playwright/test';

/**
 * Layout checks on every screen size (docs/13-platforms-and-testing.md):
 * nothing scrolls sideways, the board fits on screen, and tile art stays inside its tile.
 */
const GAMES = ['Tic-Tac-Toe', 'Four in a Row', 'Ludo', '2048', 'Sudoku', 'Solitaire', 'FreeCell', 'Spider', 'Pyramid', 'TriPeaks', 'Crazy Eights', 'Go Fish', 'War', 'Old Maid', 'Hearts', 'Spades', 'Callbreak', 'Gin Rummy', 'Rummy', 'Word Guess', 'Word Search', 'Mini Crossword', 'Word Ladder', 'Word Groups', 'Anagram Hunt', 'Target Number', 'Quick Maths', 'Memory', 'Sliding Puzzle', 'Sweeper', 'Flood', 'Tile Match', 'Jigsaw', 'Pool', 'Mini Golf', 'Archery', 'Spinner War', 'Racing', 'Sword Duel', 'Whack-a-Mole', 'Paint Fight', 'Grab It', 'Impostor', 'Charades', 'Draw & Guess', 'Guess the Person', 'Royal Game of Ur', 'Senet', "Nine Men's Morris", 'Pachisi', 'Go 9×9', 'Color Sort', 'Echo', 'Classic Snake', 'Checkers', 'Chess', 'Backgammon', 'Sea Battle', 'Reversi', 'Dots & Boxes', 'Mancala', 'Snakes & Ladders', 'Ultimate Tic-Tac-Toe', 'Yatzy', 'Shut the Box', 'Dominoes', 'Air Hockey', 'Ping Pong', 'Tug of War', 'Reflex Race', 'Sumo', 'Penalty Kicks', 'Snake Battle'];

/**
 * Any text on the game screen that does not fit the box holding it. Yatzy's score card was cutting
 * half its row names down to "Two p..." and "Bonus ...", and nothing noticed for as long as it has
 * shipped, because the checks here look at `.board` and a game's own controls are HTML underneath
 * it. This looks at all of it.
 *
 * An element that scrolls is doing it on purpose and is left alone; so is one whose child simply
 * sits wider, which is a layout decision rather than lost text. What is reported is a box that
 * holds more text than it shows.
 */
async function textThatDoesNotFit(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('.screen *')].flatMap((node) => {
      const el = node as HTMLElement;
      if (!el.offsetParent && el.tagName !== 'TH') return [];
      // Only boxes whose own text is the thing overflowing.
      const text = [...el.childNodes].some((child) => child.nodeType === 3 && child.textContent?.trim());
      if (!text) return [];
      const style = getComputedStyle(el);
      if (style.overflowX === 'auto' || style.overflowX === 'scroll') return [];
      if (el.scrollWidth <= el.clientWidth + 1) return [];
      const label = (el.textContent ?? '').trim().slice(0, 40);
      return [`${el.className || el.tagName}: "${label}"`];
    }),
  );
}

async function noSidewaysScroll(page: Page, where: string): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${where} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(1);
}

/**
 * The Android WebView is narrower than any of our eight screen types, and it was the only thing
 * that noticed a third button in the hero pushing the home screen 10px sideways. So the shelf is
 * checked at 320 too, which is narrower than any phone we expect to see.
 */
test('home fits a very narrow phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');
  await expect(page.locator('.tile').first()).toBeVisible();
  await page.waitForTimeout(500);
  await noSidewaysScroll(page, 'Home at 320px');
  // Every settings button is reachable, not hanging off the edge.
  for (const button of await page.locator('.toggles button').all()) await expect(button).toBeInViewport();
});

test('home: no sideways scroll, and tile art stays inside each tile', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.tile').first()).toBeVisible();
  await page.waitForTimeout(800);
  await noSidewaysScroll(page, 'Home');
  const escapes = await page.evaluate(() =>
    [...document.querySelectorAll('.tile svg text')].flatMap((text) => {
      const svg = text.closest('svg')!.getBoundingClientRect();
      const box = text.getBoundingClientRect();
      const out = box.left < svg.left - 1 || box.right > svg.right + 1 || box.top < svg.top - 1 || box.bottom > svg.bottom + 1;
      return out ? [`${text.closest('.tile')?.querySelector('.title')?.textContent}: "${text.textContent}"`] : [];
    }),
  );
  expect(escapes).toEqual([]);
});

for (const name of GAMES) {
  test(`${name}: table and game fit the screen`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
    await noSidewaysScroll(page, `${name} table`);
    await page.getByRole('button', { name: 'Play', exact: true }).click();

    const board = page.locator('.board');
    await expect(board.locator('canvas')).toBeVisible();
    await page.waitForTimeout(600);
    await noSidewaysScroll(page, `${name} game`);

    const viewport = page.viewportSize()!;
    const box = (await board.boundingBox())!;
    expect(box.width, `${name} board is wider than the screen`).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.height, `${name} board is taller than the screen`).toBeLessThanOrEqual(viewport.height + 1);
    // The game's own buttons can be reached without zooming out.
    for (const button of await page.locator('.sudoku-tools button, .ludo-controls button').all()) {
      await button.scrollIntoViewIfNeeded();
      await expect(button).toBeInViewport();
    }
    // And nothing the game writes is wider than the box it is written in.
    expect(await textThatDoesNotFit(page), `${name}: text that does not fit`).toEqual([]);
  });
}

/**
 * Text that is cut off is worse than text that wraps: "Two p..." and "Bonus ..." tell you nothing.
 * The Yatzy card is the worst case, fifteen row names against four columns of scores, and the
 * gallery caught half of them ellipsised on a phone. This asks the page whether any name is wider
 * than the cell holding it, which covers both ways that goes wrong: cut off when the cell hides
 * its overflow, and spilling over the scores when it does not. A landscape screen puts the whole
 * card in a 220px column, so it is the harder case, not the phone.
 */
test('Yatzy: no row name is wider than its cell', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Yatzy/ }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('.yatzy-card')).toBeVisible();
  const clipped = await page.evaluate(() =>
    [...document.querySelectorAll('.yatzy-card th.box')].flatMap((cell) => {
      const box = cell as HTMLElement;
      // Wider than the cell means either an ellipsis or a spill onto the scores next to it.
      return box.scrollWidth > box.clientWidth + 1 ? [`${box.textContent}`] : [];
    }),
  );
  expect(clipped, 'these row names do not fit their cell').toEqual([]);
});

/**
 * How far each game runs past the bottom of the screen. Yatzy's score card does, which may be
 * right for a fifteen-row table, but nobody had ever measured the rest, and "every game fits
 * portrait and landscape" is a rule in CLAUDE.md that nothing checked. So it was measured, on
 * 2026-09-21, and the answer was not what a screenshot suggested:
 *
 *   sixteen games   1.03x to 1.14x   a footer and some margins past the fold
 *   Yatzy           1.58x, 1.81x     a different thing entirely
 *
 * Q2 then fixed the cause rather than the symptom: the board takes the height that is left
 * instead of 64vh whatever else is on screen. So the line is back at 1.02x, which is what "every
 * game fits portrait and landscape" actually means.
 *
 * One test, so the answer arrives as one list rather than fifty failures, and one that says how
 * long it needs, because fifty-one games do not fit in the sixty seconds a test gets by default.
 */
test('how far each game runs past the bottom of the screen', async ({ page }) => {
  // Playwright wants this inside the test; `{ timeout }` beside the name is vitest's way, which is
  // what the rules tests use and what I reached for first. Eight seconds a game, so it grows with the
  // list: a flat 300s held for 51 games and ran out at 65 on the slow Android engine.
  test.setTimeout(GAMES.length * 8_000);
  const tall: string[] = [];
  for (const name of GAMES) {
    await page.goto('/');
    await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.locator('.board canvas')).toBeVisible();
    await page.waitForTimeout(150);
    const over = await page.evaluate(() => {
      const doc = document.documentElement;
      return Math.round((doc.scrollHeight / doc.clientHeight) * 100) / 100;
    });
    if (over > 1.02) tall.push(`${name} ${over}x`);
  }
  expect(tall, 'games much taller than the screen').toEqual([]);
});

/**
 * Big screens should use the room rather than centring a phone layout in it. The store
 * screenshots showed the board sitting in the middle third of a landscape tablet with empty
 * space either side, and none of the checks above said a word, because nothing overflowed.
 */
test('a landscape screen puts the board and its controls side by side', async ({ page }) => {
  const viewport = page.viewportSize()!;
  test.skip(viewport.width < 900 || viewport.width <= viewport.height, 'This is about wide landscape screens');
  await page.goto('/');
  await page.getByRole('button', { name: /^Chess/ }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('.board canvas')).toBeVisible();
  await page.waitForTimeout(400);

  const board = (await page.locator('.board').boundingBox())!;
  const status = (await page.locator('.status').boundingBox())!;
  // Whose turn it is stands beside the board, not above it.
  expect(status.x, `the turn line starts at ${Math.round(status.x)} and the board ends at ${Math.round(board.x + board.width)}`).toBeGreaterThan(
    board.x + board.width - 1,
  );
  // And the board takes the height it has been given.
  const share = board.height / viewport.height;
  expect(share, `the board is ${Math.round(share * 100)}% of a ${viewport.width}x${viewport.height} screen`).toBeGreaterThan(0.7);
});

test('installed web app: opens and plays with no connection at all', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'The cold offline start is checked in Chromium, where service workers are fully supported in tests');
  await page.goto('/');
  await expect(page.locator('.tile').first()).toBeVisible();
  // The service worker has stored the whole app once it is active; reload so it controls the page.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.tile').first()).toBeVisible();
  await page.getByRole('button', { name: /^Sudoku/ }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('.board canvas')).toBeVisible();
  await context.setOffline(false);
});

test('offline: a game starts and plays with the network cut', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.tile').first()).toBeVisible();
  await context.setOffline(true);

  await page.getByRole('button', { name: /^Tic-Tac-Toe/ }).click();
  await page.getByRole('button', { name: /vs Bot/ }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  const box = (await page.locator('.board canvas').boundingBox())!;
  const result = page.locator('.result-sheet');
  for (let round = 0; round < 6 && !(await result.isVisible()); round++) {
    for (let cell = 0; cell < 9; cell++) {
      await page.mouse.click(box.x + box.width * ((cell % 3) / 3 + 1 / 6), box.y + box.height * (Math.floor(cell / 3) / 3 + 1 / 6));
    }
    await page.waitForTimeout(900);
  }
  await expect(result).toBeVisible({ timeout: 15_000 });
  await context.setOffline(false);
  expect(errors).toEqual([]);
});

/**
 * The glow and the line have to agree. A settled gallery shot had the top-middle board glowing
 * under a status reading "play in the right board", which are boards 1 and 5. Both come from the
 * same field, so this reads the canvas and the HTML at the same moment and says whether they
 * really disagree or whether the picture caught them a beat apart.
 */
test('Ultimate Tic-Tac-Toe: the glowing board is the one the line names', async ({ page }) => {
  const NAMES = ['top-left', 'top', 'top-right', 'left', 'middle', 'right', 'bottom-left', 'bottom', 'bottom-right'];
  await page.goto('/?autoplay=3');
  await page.getByRole('button', { name: /^Ultimate Tic-Tac-Toe/ }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('.board canvas')).toBeVisible();

  // Counted, because this skips any look where the player may go anywhere and there is no one
  // board to name. A run that skipped all eight would pass having checked nothing, which is the
  // shape of check I have thrown away twice today.
  let compared = 0;
  for (let look = 0; look < 8; look++) {
    await page.waitForTimeout(500);
    const both = await page.evaluate(() => {
      const game = (window as unknown as { gamepalsTestGame?: { scene: { scenes: unknown[] } } }).gamepalsTestGame;
      const scene = game?.scene.scenes[0] as { activeCheck?: () => { lit: number[]; active: number | null } } | undefined;
      const pill = document.querySelector('.turn-pill');
      return scene?.activeCheck ? { ...scene.activeCheck(), line: pill?.textContent ?? '' } : null;
    });
    if (!both) break;
    if (both.active === null || both.lit.length !== 1) continue;
    const named = NAMES[both.active]!;
    expect(both.lit[0], `the line says "${both.line.trim()}" and the glow is on board ${both.lit[0]}`).toBe(both.active);
    expect(both.line, `the glow is on the ${named} board`).toContain(named);
    compared++;
  }
  expect(compared, 'never caught a moment with one board to name, so nothing was compared').toBeGreaterThan(0);
});
