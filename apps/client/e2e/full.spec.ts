import { expect, test } from '@playwright/test';

/**
 * Whole games, start to finish, on every screen type (docs/13-platforms-and-testing.md).
 * `?autoplay` puts bots of mixed levels in every seat and speeds the game up, so late-game code
 * (win animations, cascades, sudden death, result sheets) runs on every device, not just the first taps.
 * Tagged @full: CI runs these weekly, on release tags and on manual runs.
 */
const GAMES = [
  'Tic-Tac-Toe',
  'Four in a Row',
  'Ludo',
  '2048',
  'Sudoku',
  'Solitaire',
  'FreeCell',
  'Spider',
  'Pyramid',
  'TriPeaks',
  'Crazy Eights',
  'Go Fish',
  'War',
  'Old Maid',
  'Hearts',
  'Spades',
  'Callbreak',
  'Gin Rummy',
  'Rummy',
  'Word Guess',
  'Word Search',
  'Mini Crossword',
  'Word Ladder',
  'Word Groups',
  'Anagram Hunt',
  'Target Number',
  'Quick Maths',
  'Memory',
  'Sliding Puzzle',
  'Sweeper',
  'Flood',
  'Tile Match',
  'Jigsaw',
  'Pool',
  'Mini Golf',
  'Archery',
  'Spinner War',
  'Racing',
  'Sword Duel',
  'Whack-a-Mole',
  'Paint Fight',
  'Grab It',
  'Bomb Pass',
  'Brick Blast',
  'Sling Puck',
  'Basketball Hoops',
  'Tank Duel',
  'Road Dodge',
  'Slot Cars',
  'Wheelie',
  'Speed',
  'Gravity Run',
  'Impostor',
  'Charades',
  'Draw & Guess',
  'Guess the Person',
  'Royal Game of Ur',
  'Senet',
  "Nine Men's Morris",
  'Pachisi',
  'Go 9×9',
  'Hnefatafl',
  'Fanorona',
  'Chowka Bhara',
  'Code Breaker',
  'Hex',
  'Chinese Checkers',
  'Nonogram',
  'Mahjong Solitaire',
  'Block Puzzle',
  'Number Match',
  '2248',
  'Maze Paint',
  'Ball Run',
  'Fruit Merge',
  'Tower',
  'Switch Board',
  'Clean It',
  'Straighten Up',
  'Sand Fall',
  'Dominoes Topple',
  'Gomoku',
  'Oware',
  'Mexican Train',
  'Pop It',
  'Zen Garden',
  "Newton's Cradle",
  'Would You Rather',
  'Truth or Dare',
  'Hangman',
  'Pointers',
  'Color Sort',
  'Echo',
  'Classic Snake',
  'Checkers',
  'Chess',
  'Backgammon',
  'Sea Battle',
  'Reversi',
  'Dots & Boxes',
  'Mancala',
  'Snakes & Ladders',
  'Ultimate Tic-Tac-Toe',
  'Yatzy',
  'Shut the Box',
  'Dominoes',
  'Air Hockey',
  'Ping Pong',
  'Tug of War',
  'Reflex Race',
  'Sumo',
  'Penalty Kicks',
  'Snake Battle',
];

/**
 * A four-player Pachisi is 700 to 1300 plies and Chowka Bhara 600 to 830: past the time limit on the
 * slower engines (Pachisi failed on six of the eight at 240s). Two players is 280 to 460 plies and
 * plays every rule just the same.
 */
const TWO_SEATS = new Set(['Pachisi', 'Chowka Bhara']);
/**
 * Long race games, 300 to 460 plies of throw and hop, get more time: the Android phone engine spent
 * about 0.75s a ply on Senet and ran out at 240s.
 */
const LONG = new Set(['Pachisi', 'Chowka Bhara', 'Senet', 'Fruit Merge']);

/** Patience deals can be unwinnable, so for those a long stretch of play with no errors is the pass mark. */
const MAY_NOT_FINISH = new Set(['Solitaire', 'FreeCell', 'Spider', 'Pyramid', 'TriPeaks']);

for (const name of GAMES) {
  test(`${name}: a whole game plays to the end @full`, async ({ page }) => {
    test.setTimeout(LONG.has(name) ? 600_000 : 300_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });

    await page.goto(TWO_SEATS.has(name) ? '/?autoplay=6&seats=2' : '/?autoplay=6');
    await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.locator('.board canvas')).toBeVisible();

    const result = page.locator('.result-sheet');
    if (MAY_NOT_FINISH.has(name)) {
      await result.waitFor({ state: 'visible', timeout: 45_000 }).catch(() => undefined);
    } else {
      await expect(result).toBeVisible({ timeout: LONG.has(name) ? 540_000 : 240_000 });
      // A rematch starts cleanly too.
      await result.getByRole('button').first().click();
      await expect(page.locator('.board canvas')).toBeVisible();
      await page.waitForTimeout(1500);
    }
    expect(errors).toEqual([]);
  });
}
