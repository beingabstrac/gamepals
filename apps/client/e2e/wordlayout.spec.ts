import { expect, test, type Page } from '@playwright/test';

/**
 * Every scene with a status line or a label somewhere a piece could land on, against its own
 * board. Every one of these scenes put a status line through
 * its own content at least once, and only a screenshot ever showed it: Word Guess printed
 * "Got it!" inside an empty square of the grid, Word Groups printed "All four." across the last
 * group, Anagram Hunt printed the count straight through the list of finds. Tests said all three
 * ran, finished, fitted eight screen types and logged nothing.
 *
 * So each scene now says where its bands are and this checks that none of them sit on top of
 * another. A band is a horizontal strip the scene draws something in.
 */
interface Band {
  name: string;
  top: number;
  bottom: number;
}

async function bands(page: Page): Promise<Band[] | null> {
  return page.evaluate(() => {
    const game = (window as unknown as { gamepalsTestGame?: { scene: { scenes: unknown[] } } }).gamepalsTestGame;
    const scene = game?.scene.scenes[0] as { layoutCheck?: () => Band[] } | undefined;
    return scene?.layoutCheck ? scene.layoutCheck() : null;
  });
}

async function open(page: Page, name: string): Promise<void> {
  await page.goto('/?autoplay=3');
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('.board canvas')).toBeVisible();
}

const BANDED = ['Word Guess', 'Word Search', 'Mini Crossword', 'Word Ladder', 'Word Groups', 'Anagram Hunt', 'Target Number', 'Quick Maths'];

for (const name of BANDED) {
  test(`${name}: nothing is drawn on top of anything else`, async ({ page }) => {
    await open(page, name);
    // Look a few times: the bands move as the board fills, and a bot game can end while we look.
    for (let look = 0; look < 4; look++) {
      const report = await bands(page);
      if (!report) break;
      expect(report.length, `${name} answers layoutCheck`).toBeGreaterThan(1);
      const sorted = [...report].sort((a, b) => a.top - b.top);
      for (let i = 0; i < sorted.length - 1; i++) {
        const above = sorted[i]!;
        const below = sorted[i + 1]!;
        expect(
          below.top,
          `look ${look + 1}: "${above.name}" ends at ${above.bottom} and "${below.name}" starts at ${below.top}`,
        ).toBeGreaterThanOrEqual(above.bottom);
      }
      await page.waitForTimeout(800);
    }
  });
}

test('Mini Crossword: no clue runs off the sides', async ({ page }) => {
  await open(page, 'Mini Crossword');
  // Bots fill the grid, so the clue changes as they go. Every one of them has to fit.
  for (let look = 0; look < 6; look++) {
    const report = await page.evaluate(() => {
      const game = (window as unknown as { gamepalsTestGame?: { scene: { scenes: unknown[] } } }).gamepalsTestGame;
      const scene = game?.scene.scenes[0] as { clueCheck?: () => { widest: number; room: number } } | undefined;
      return scene?.clueCheck ? scene.clueCheck() : null;
    });
    if (!report) break;
    expect(report.widest, `look ${look + 1}: the clue is wider than the board`).toBeLessThanOrEqual(report.room);
    await page.waitForTimeout(700);
  }
});

/**
 * Dominoes is not in the band list above, because its pieces are supposed to move across it: a
 * tile flies from its owner's chip to the board every time one is played. What it owes instead is
 * that they arrive. They did not for a long time, because every state change restarted the tween,
 * so tiles crawled a few pixels and stayed on their owner's name with the board empty.
 */
test('Dominoes: played tiles end up on the board, not on the players', async ({ page }) => {
  await open(page, 'Dominoes');
  let bestOnBoard = 0;
  let worstOnChips = 0;
  let laid = 0;
  for (let look = 0; look < 6; look++) {
    await page.waitForTimeout(900);
    const report = await page.evaluate(() => {
      const game = (window as unknown as { gamepalsTestGame?: { scene: { scenes: unknown[] } } }).gamepalsTestGame;
      const scene = game?.scene.scenes[0] as
        | { boardCheck?: () => { onBoard: number; onChips: number; laid: number } }
        | undefined;
      return scene?.boardCheck ? scene.boardCheck() : null;
    });
    if (!report) break;
    bestOnBoard = Math.max(bestOnBoard, report.onBoard);
    worstOnChips = Math.max(worstOnChips, report.onChips);
    laid = Math.max(laid, report.laid);
  }
  if (laid === 0) return; // Nothing was played in the time we watched, so there is nothing to say.
  expect(bestOnBoard, `${laid} tiles played and none ever settled on the board`).toBeGreaterThan(0);
  expect(worstOnChips, 'tiles came to rest on a player rather than the board').toBe(0);
});

/**
 * A scene that plays events out one at a time, while the line above it is read straight from the
 * state, can drift. Snakes & Ladders did, without limit: the board showed both tokens at the start
 * while the line had them on 47 and 45. Shut the Box was built the same way.
 */
for (const { name, limit } of [
  { name: 'Snakes & Ladders', limit: 6 },
  // Shut the Box plays each roll out in turn and had the same unbounded queue.
  { name: 'Shut the Box', limit: 2 },
  // Mancala keeps a copy of the pits and walks it as the hopper lands. It snaps back to the state
  // at the end of every sowing, so it should never settle behind at all.
  { name: 'Mancala', limit: 0 },
]) {
  test(`${name}: the board keeps up with the score line`, async ({ page }) => {
    await open(page, name);
    let worst = 0;
    for (let look = 0; look < 6; look++) {
      await page.waitForTimeout(900);
      const report = await page.evaluate(() => {
        const game = (window as unknown as { gamepalsTestGame?: { scene: { scenes: unknown[] } } }).gamepalsTestGame;
        const scene = game?.scene.scenes[0] as { boardCheck?: () => { behind: number; walking: boolean } } | undefined;
        return scene?.boardCheck ? scene.boardCheck() : null;
      });
      if (!report) break;
      // A token in the middle of its walk is allowed to be behind; a settled board is not.
      if (!report.walking) worst = Math.max(worst, report.behind);
    }
    expect(worst, `${name}: the board settled this far behind the state`).toBeLessThanOrEqual(limit);
  });
}

/**
 * A card with another card on top of it shows one strip: from its own top edge down to where the
 * next card starts. The corner index has to fit in that strip, or the card goes quiet. All three
 * fanning games stepped less far than their index reached, so a covered card showed its rank with
 * the suit below it cut off, and in Spider, where a run has to be all one suit, that is the one
 * thing you need to read. A screenshot showed it; no test could, because every game still played
 * and finished perfectly well with unreadable cards.
 */
for (const name of ['Solitaire', 'FreeCell', 'Spider']) {
  test(`${name}: a covered card still shows its suit`, async ({ page }) => {
    test.setTimeout(90_000);
    await open(page, name);
    let tight = 0;
    let checked = 0;
    let worst = Infinity;
    for (let look = 0; look < 12; look++) {
      await page.waitForTimeout(700);
      const report = await page.evaluate(() => {
        const game = (window as unknown as { gamepalsTestGame?: { scene: { scenes: unknown[] } } }).gamepalsTestGame;
        const scene = game?.scene.scenes[0] as { fanCheck?: () => { checked: number; tight: number; worst: number } } | undefined;
        return scene?.fanCheck ? scene.fanCheck() : null;
      });
      if (!report) break;
      tight += report.tight;
      checked += report.checked;
      if (report.checked > 0) worst = Math.min(worst, report.worst);
    }
    // Without this a green tick could mean the fan was never looked at, which is no tick at all.
    // A floor, not a target: it only has to be impossible to pass having looked at nothing.
    expect(checked, `${name}: no covered card was ever measured`).toBeGreaterThan(8);
    expect(tight, `${name}: covered cards cut their own index off (shortest step ${worst})`).toBe(0);
  });
}

/**
 * A sliding tile is born at scale 0 and popped up on a stagger. `animate` killed every tween on a
 * tile it was about to move, the entry pop included, so a tile that moved inside that window slid
 * to the right square and stayed invisible for the rest of the game: the gallery caught a 3x3
 * puzzle showing four tiles of eight at move 83. Nothing ever put the board back in agreement
 * with the state, because only the tiles named in the last move were ever touched.
 */
test('Sliding Puzzle: every tile the state has is on the board and visible', async ({ page }) => {
  test.setTimeout(90_000);
  await open(page, 'Sliding Puzzle');
  let settled = 0;
  let missing = 0;
  let adrift = 0;
  for (let look = 0; look < 8; look++) {
    await page.waitForTimeout(700);
    const report = await page.evaluate(() => {
      const game = (window as unknown as { gamepalsTestGame?: { scene: { scenes: unknown[] } } }).gamepalsTestGame;
      const scene = game?.scene.scenes[0] as { boardCheck?: () => { settled: number; shown: number; placed: number } } | undefined;
      return scene?.boardCheck ? scene.boardCheck() : null;
    });
    if (!report) break;
    settled += report.settled;
    missing += report.settled - report.shown;
    adrift += report.settled - report.placed;
  }
  // A floor, not a target: it only has to be impossible to pass having looked at nothing.
  expect(settled, 'no tile ever came to rest, so nothing was measured').toBeGreaterThan(8);
  expect(missing, 'tiles came to rest invisible').toBe(0);
  expect(adrift, 'tiles came to rest off their square').toBe(0);
});

/**
 * Colour Sort tubes are born at scale 0 and popped up on a stagger of up to 400ms, and the pour
 * calls killTweensOf on the tube it is about to swing, which takes the entry pop with it. A tube
 * caught inside that window keeps whatever size its tween died at, and the undo path put position
 * and angle back but never scale. The gallery caught two tubes smaller than the third and one
 * hanging above its place; the same shape of bug as the sliding tiles, found by grep rather than
 * by looking.
 */
test('Color Sort: every settled tube is its proper size, in its proper place', async ({ page }) => {
  test.setTimeout(90_000);
  await open(page, 'Color Sort');
  let settled = 0;
  let shrunk = 0;
  let adrift = 0;
  let worst = '';
  for (let look = 0; look < 12; look++) {
    await page.waitForTimeout(700);
    const report = await page.evaluate(() => {
      const game = (window as unknown as { gamepalsTestGame?: { scene: { scenes: unknown[] } } }).gamepalsTestGame;
      const scene = game?.scene.scenes[0] as
        | { boardCheck?: () => { settled: number; shown: number; placed: number; worst: string } }
        | undefined;
      return scene?.boardCheck ? scene.boardCheck() : null;
    });
    if (!report) break;
    settled += report.settled;
    shrunk += report.settled - report.shown;
    adrift += report.settled - report.placed;
    if (report.worst) worst = report.worst;
  }
  expect(settled, 'no tube ever came to rest, so nothing was measured').toBeGreaterThan(10);
  expect(shrunk, `tubes came to rest at the wrong size (${worst})`).toBe(0);
  expect(adrift, 'tubes came to rest away from their place').toBe(0);
});

/**
 * A result that names somebody has to name somebody at this table. Old Maid was handed the side
 * colours instead of the players, so the sheet read "Purple is the old maid!" directly above a
 * running score reading "Nova 0 · Pip 1 · Zed 1 · Bo 1": the same person, named two ways, one
 * line apart. The running score is the list of who is actually here, so the heading is checked
 * against it rather than against anything this test knows on its own.
 */
test('Old Maid: the result names a player at this table', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, 'Old Maid');
  const title = page.locator('.result-title');
  await expect(title).toBeVisible({ timeout: 90_000 });
  const heading = (await title.textContent()) ?? '';
  const tally = (await page.locator('.rivalry-score').textContent()) ?? '';
  // "Nova 0 · Pip 1 · Zed 1 · Bo 1" -> the names, without their counts.
  const players = tally
    .split('·')
    .map((part) => part.trim().replace(/\s+-?\d+$/, ''))
    .filter(Boolean);
  expect(players.length, `no players to check against, tally was "${tally}"`).toBeGreaterThan(1);
  expect(players.some((name) => heading.includes(name)), `"${heading}" names nobody in "${tally}"`).toBe(true);

  // While a sheet is up: the confetti must not land on the line that says who won. The sheet had
  // no stacking order of its own and the burst is at 10, so pieces sat on the headline.
  const order = await page.evaluate(() => {
    const layer = (name: string) => {
      const el = document.querySelector(name);
      return el ? Number(getComputedStyle(el).zIndex) || 0 : null;
    };
    return { sheet: layer('.result-sheet'), confetti: layer('.confetti') };
  });
  if (order.confetti !== null) {
    expect(order.sheet ?? 0, 'confetti is drawn over the result sheet').toBeGreaterThan(order.confetti);
  }
});

/**
 * Every card in your hand is either where the layout put it or on its way there. One that is
 * neither has been lost, and the gallery caught exactly that: Crazy Eights showing "Nova: 10"
 * with two cards on the table, sitting where a ten-card fan puts its fifth and sixth. The label
 * and the fan are written from the same state in the same pass, so they cannot disagree; what
 * disagreed was the state and the screen.
 */
test('Crazy Eights: every card in the hand is on the table or on its way', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, 'Crazy Eights');
  let looked = 0;
  let lost = 0;
  let worst = '';
  for (let look = 0; look < 12; look++) {
    await page.waitForTimeout(700);
    const report = await page.evaluate(() => {
      const game = (window as unknown as { gamepalsTestGame?: { scene: { scenes: unknown[] } } }).gamepalsTestGame;
      const scene = game?.scene.scenes[0] as
        | { handCheck?: () => { held: number; arrived: number; moving: number } }
        | undefined;
      return scene?.handCheck ? scene.handCheck() : null;
    });
    if (!report) break;
    if (report.held === 0) continue;
    looked += report.held;
    const missing = report.held - report.arrived - report.moving;
    if (missing > 0) {
      lost += missing;
      worst = `held ${report.held}, ${report.arrived} arrived, ${report.moving} moving`;
    }
  }
  expect(looked, 'the hand was never seen holding anything').toBeGreaterThan(8);
  expect(lost, `cards in hand were neither placed nor moving (${worst})`).toBe(0);
});
