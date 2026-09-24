/**
 * Native self-test, built in with `VITE_SELFTEST=1` (docs/13-platforms-and-testing.md).
 * Inside the real iOS or Android app, where no browser test tool can reach, the app plays every game
 * to its end by itself (bots in every seat, sped up), checks the layout and rematch, and prints
 * `SELFTEST` lines to the app log. CI reads them from the simulator or emulator.
 */
const GAMES = ['Tic-Tac-Toe', 'Four in a Row', 'Ludo', '2048', 'Sudoku', 'Solitaire', 'FreeCell', 'Spider', 'Pyramid', 'TriPeaks', 'Crazy Eights', 'Go Fish', 'War', 'Old Maid', 'Hearts', 'Spades', 'Callbreak', 'Gin Rummy', 'Rummy', 'Word Guess', 'Word Search', 'Mini Crossword', 'Word Ladder', 'Word Groups', 'Anagram Hunt', 'Target Number', 'Quick Maths', 'Memory', 'Sliding Puzzle', 'Sweeper', 'Flood', 'Tile Match', 'Jigsaw', 'Pool', 'Mini Golf', 'Archery', 'Spinner War', 'Racing', 'Sword Duel', 'Whack-a-Mole', 'Paint Fight', 'Grab It', 'Impostor', 'Charades', 'Draw & Guess', 'Guess the Person', 'Royal Game of Ur', 'Senet', "Nine Men's Morris", 'Pachisi', 'Color Sort', 'Echo', 'Classic Snake', 'Checkers', 'Chess', 'Backgammon', 'Sea Battle', 'Reversi', 'Dots & Boxes', 'Mancala', 'Snakes & Ladders', 'Ultimate Tic-Tac-Toe', 'Yatzy', 'Shut the Box', 'Dominoes', 'Air Hockey', 'Ping Pong', 'Tug of War', 'Reflex Race', 'Sumo', 'Penalty Kicks', 'Snake Battle'];
/** Solitaire deals can be unwinnable, so for it a stretch of play with no errors is the pass mark. */
const MAY_NOT_FINISH = new Set(['Solitaire', 'FreeCell', 'Spider', 'Pyramid', 'TriPeaks']);

const log = (line: string) => console.log(`SELFTEST ${line}`);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function until<T>(find: () => T | null | undefined, timeoutMs: number, what: string): Promise<T> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const found = find();
    if (found) return found;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await wait(200);
  }
}

const button = (text: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
const labelled = (label: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);

/** Back to the home shelf from wherever a game left us. */
async function goHome(): Promise<void> {
  for (let i = 0; i < 4 && !document.querySelector('.tile'); i++) {
    (labelled('Back to the table') ?? labelled('Back to games'))?.click();
    await wait(500);
  }
}

export async function runSelfTest(): Promise<void> {
  const errors: string[] = [];
  window.addEventListener('error', (event) => errors.push(event.message));
  window.addEventListener('unhandledrejection', (event) => errors.push(String(event.reason)));
  const consoleError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
    consoleError(...args);
  };

  const failures: string[] = [];
  await until(() => document.querySelector('.tile'), 30_000, 'the home screen');
  log(`start ${innerWidth}x${innerHeight} ${navigator.userAgent}`);

  for (const name of GAMES) {
    const before = errors.length;
    const started = Date.now();
    try {
      const tile = await until(() => [...document.querySelectorAll('.tile .title')].find((e) => e.textContent === name)?.closest('button'), 15_000, `the ${name} tile`);
      tile.click();
      (await until(() => button('Play'), 10_000, 'the Play button')).click();
      await until(() => document.querySelector('.board canvas'), 20_000, 'the board');
      const sideways = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      if (sideways > 1) failures.push(`${name}: scrolls sideways by ${sideways}px`);

      const finished = await until(() => document.querySelector('.result-sheet'), MAY_NOT_FINISH.has(name) ? 40_000 : 300_000, 'the result').then(
        () => true,
        (error: Error) => {
          if (MAY_NOT_FINISH.has(name)) return false;
          throw error;
        },
      );
      if (finished) {
        button('Rematch')?.click();
        await wait(1500);
        const boards = document.querySelectorAll('.board canvas').length;
        if (boards !== 1) failures.push(`${name}: ${boards} boards after a rematch`);
      }
      const fresh = errors.slice(before);
      if (fresh.length) failures.push(`${name}: ${fresh.join(' | ')}`);
      log(`${fresh.length ? '✗' : '✓'} ${name} ${Math.round((Date.now() - started) / 1000)}s`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${name}: ${message}`);
      log(`✗ ${name}: ${message}`);
    }
    await goHome();
  }

  log(failures.length ? `FAIL ${failures.length}: ${failures.join(' || ')}` : 'PASS');
}
