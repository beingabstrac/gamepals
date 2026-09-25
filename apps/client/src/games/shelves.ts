import type { AnyEntry } from './registry';

/**
 * The home screen's shelves, in order. Eighty-odd games in one grid is a wall; a shelf per kind of
 * game is how people look for something to play. A game missing from every list still shows, on
 * the last shelf, so a new game can never vanish from home by being forgotten here.
 */
export const SHELVES: readonly { readonly title: string; readonly ids: readonly string[] }[] = [
  {
    title: 'Two on one phone',
    ids: ['air-hockey', 'ping-pong', 'tug-of-war', 'reflex-race', 'sumo', 'penalty-kicks', 'snake-battle', 'spinner-war', 'racing', 'sword-duel', 'whack-a-mole', 'paint-fight', 'grab-it', 'bomb-pass', 'brick-blast', 'sling-puck', 'hoops', 'tank-duel', 'road-dodge', 'slot-cars', 'wheelie', 'gravity-run', 'pool', 'mini-golf', 'archery', 'darts'],
  },
  {
    title: 'Board games',
    ids: ['tic-tac-toe', 'four-in-a-row', 'ultimate-ttt', 'checkers', 'chess', 'reversi', 'go', 'hex', 'backgammon', 'ludo', 'snakes-and-ladders', 'sea-battle', 'dots-and-boxes', 'mancala', 'morris', 'chinese-checkers', 'guess-person', 'dominoes', 'yatzy', 'shut-the-box', 'tower', 'gomoku', 'connect-six', 'mexican-train'],
  },
  { title: 'Games from long ago', ids: ['ur', 'senet', 'pachisi', 'chowka', 'tafl', 'fanorona', 'oware', 'goose'] },
  {
    title: 'Cards',
    ids: ['solitaire', 'freecell', 'spider', 'pyramid', 'tripeaks', 'crazy-eights', 'go-fish', 'war', 'old-maid', 'hearts', 'spades', 'callbreak', 'gin-rummy', 'rummy', 'speed'],
  },
  { title: 'Words and numbers', ids: ['word-guess', 'word-search', 'mini-crossword', 'word-ladder', 'word-groups', 'anagram-hunt', 'target-number', 'quick-maths', 'number-match', 'chain-merge', 'code-breaker', 'hangman'] },
  {
    title: 'Puzzles',
    ids: ['2048', 'sudoku', 'nonogram', 'sweeper', 'flood', 'color-sort', 'tile-match', 'mahjong', 'block-puzzle', 'pointers', 'maze-paint', 'ball-run', 'marble-run', 'pizza-memory', 'fruit-merge', 'sliding-puzzle', 'jigsaw', 'memory', 'echo', 'classic-snake'],
  },
  { title: 'Party: pass the phone', ids: ['impostor', 'charades', 'draw-guess', 'would-you-rather', 'truth-or-dare'] },
  { title: 'Chill', ids: ['pop-it', 'zen-garden', 'newtons-cradle', 'switch-board', 'clean-it', 'straighten-up', 'sand-fall', 'dominoes-topple', 'pond', 'wind-chimes', 'slime', 'mirror-paint'] },
];

/** The games on each shelf, in shelf order, and anything not listed on a last shelf of its own. */
export function shelve(entries: readonly AnyEntry[]): { title: string; entries: AnyEntry[] }[] {
  const byId = new Map(entries.map((e) => [e.definition.id, e]));
  const placed = new Set<string>();
  const out = SHELVES.map(({ title, ids }) => {
    const list = ids.flatMap((id) => {
      const entry = byId.get(id);
      if (!entry) return [];
      placed.add(id);
      return [entry];
    });
    return { title, entries: list };
  }).filter((s) => s.entries.length > 0);
  const rest = entries.filter((e) => !placed.has(e.definition.id));
  if (rest.length) out.push({ title: 'More games', entries: rest });
  return out;
}
