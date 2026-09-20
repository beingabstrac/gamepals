import { createRng, type Rng } from '../../core/rng';
import type { Bot, BotTier, GameConfig, GameDefinition, GameResult, GameState, Seat } from '../../core/types';
import { THEMES, type Theme } from './words';

/**
 * Word Search (docs/games/word-search.md). A square of letters with a themed list hidden in it,
 * across, down and diagonally, and backwards too on the big grid.
 *
 * A move is the line the finger drew, not the word it was after: `f<r1>,<c1>,<r2>,<c2>`. The rules
 * read the letters along it and say which word that is, so a word found by accident counts and
 * nothing in the move says what the player was looking for.
 */
export type SearchMove = string;
export const searchLine = (r1: number, c1: number, r2: number, c2: number): SearchMove => `f${r1},${c1},${r2},${c2}`;

export interface Size {
  readonly side: number;
  readonly words: number;
  /** Whether words may run right to left or bottom to top. */
  readonly backwards: boolean;
}

export const SIZES: Record<string, Size> = {
  small: { side: 8, words: 6, backwards: false },
  medium: { side: 10, words: 8, backwards: false },
  large: { side: 12, words: 10, backwards: true },
};

export const sizeFor = (variant?: string): Size => SIZES[variant ?? 'medium'] ?? SIZES.medium!;

/** The eight lines a word may run along: the first four forwards, then the same four reversed. */
const WAYS: readonly (readonly [number, number])[] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [-1, 1],
  [0, -1],
  [-1, 0],
  [-1, -1],
  [1, -1],
];

export interface Found {
  readonly word: string;
  readonly r: number;
  readonly c: number;
  readonly dr: number;
  readonly dc: number;
}

export class SearchState implements GameState<SearchMove> {
  private cached?: SearchMove[];

  constructor(
    readonly theme: string,
    /** One string per row, lower case. */
    readonly grid: readonly string[],
    readonly words: readonly string[],
    readonly found: readonly Found[],
    readonly currentSeat: Seat,
    readonly moves: number,
    readonly result: GameResult | null,
  ) {}

  get side(): number {
    return this.grid.length;
  }

  get left(): readonly string[] {
    const done = new Set(this.found.map((one) => one.word));
    return this.words.filter((word) => !done.has(word));
  }

  letterAt(r: number, c: number): string {
    return this.grid[r]?.[c] ?? '';
  }

  /** The letters along a line, or '' if the line leaves the grid or is not one of the eight. */
  read(r1: number, c1: number, r2: number, c2: number): string {
    const dr = Math.sign(r2 - r1);
    const dc = Math.sign(c2 - c1);
    const rows = Math.abs(r2 - r1);
    const cols = Math.abs(c2 - c1);
    // A line is straight when it moves along one axis or equally along both.
    if (rows !== 0 && cols !== 0 && rows !== cols) return '';
    const steps = Math.max(rows, cols);
    let word = '';
    for (let i = 0; i <= steps; i++) {
      const letter = this.letterAt(r1 + dr * i, c1 + dc * i);
      if (!letter) return '';
      word += letter;
    }
    return word;
  }

  /**
   * Every line that spells a word still on the list. A solo puzzle has no opponent to keep
   * anything from, so this is the answer sheet, and it is what lets a test build finish a game.
   */
  legalMoves(seat: Seat): readonly SearchMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    if (this.cached) return this.cached;
    const wanted = new Set(this.left);
    const lines: SearchMove[] = [];
    for (let r = 0; r < this.side; r++) {
      for (let c = 0; c < this.side; c++) {
        for (const [dr, dc] of WAYS) {
          for (const word of wanted) {
            const r2 = r + dr * (word.length - 1);
            const c2 = c + dc * (word.length - 1);
            if (this.read(r, c, r2, c2) === word) lines.push(searchLine(r, c, r2, c2));
          }
        }
      }
    }
    return (this.cached = lines);
  }

  apply(move: SearchMove): SearchState {
    if (this.result) throw new Error('Game is over');
    const parts = move.startsWith('f') ? move.slice(1).split(',').map(Number) : [];
    if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n))) throw new Error(`Illegal move: ${move}`);
    const [r1, c1, r2, c2] = parts as [number, number, number, number];
    const along = this.read(r1, c1, r2, c2);
    // Dragging a word backwards finds the same word: the line is the same line either way.
    const back = along.split('').reverse().join('');
    const word = this.left.find((one) => one === along || one === back);
    if (!word) throw new Error(`Illegal move: ${move}`);
    const forwards = word === along;
    const found: Found = {
      word,
      r: forwards ? r1 : r2,
      c: forwards ? c1 : c2,
      dr: Math.sign(forwards ? r2 - r1 : r1 - r2),
      dc: Math.sign(forwards ? c2 - c1 : c1 - c2),
    };
    const all = [...this.found, found];
    const over = all.length === this.words.length;
    const result: GameResult | null = over ? { winners: [0], draw: false } : null;
    return new SearchState(this.theme, this.grid, this.words, all, 0, this.moves + 1, result);
  }
}

/** Can this word sit here without covering a different letter? */
function fitsAt(rows: string[][], word: string, r: number, c: number, dr: number, dc: number): boolean {
  const side = rows.length;
  for (let i = 0; i < word.length; i++) {
    const rr = r + dr * i;
    const cc = c + dc * i;
    if (rr < 0 || rr >= side || cc < 0 || cc >= side) return false;
    const there = rows[rr]![cc]!;
    if (there && there !== word[i]) return false;
  }
  return true;
}

function place(rows: string[][], word: string, ways: readonly (readonly [number, number])[], rng: Rng): boolean {
  const side = rows.length;
  // Enough tries that a word only fails when the grid really has no room for it.
  for (let attempt = 0; attempt < 250; attempt++) {
    const [dr, dc] = ways[rng.int(ways.length)]!;
    const r = rng.int(side);
    const c = rng.int(side);
    if (!fitsAt(rows, word, r, c, dr, dc)) continue;
    for (let i = 0; i < word.length; i++) rows[r + dr * i]![c + dc * i] = word[i]!;
    return true;
  }
  return false;
}

/** Fisher-Yates, so which words a seed picks is settled and repeatable. */
function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function newWordSearch(config: GameConfig, seed: number): SearchState {
  const size = sizeFor(config.variant);
  const rng = createRng(seed >>> 0);
  const theme: Theme = THEMES[rng.int(THEMES.length)]!;
  const ways = size.backwards ? WAYS : WAYS.slice(0, 4);
  const pool = theme.words.filter((word) => word.length <= size.side);

  // Longest first, because a long word has the fewest places it can go.
  for (let attempt = 0; attempt < 40; attempt++) {
    const picks = shuffled(pool, rng).slice(0, size.words);
    const words = [...picks].sort((a, b) => b.length - a.length);
    const rows: string[][] = Array.from({ length: size.side }, () => Array.from({ length: size.side }, () => ''));
    if (!words.every((word) => place(rows, word, ways, rng))) continue;
    // Filler comes from the theme's own letters, so the noise looks like it belongs.
    const letters = theme.words.join('');
    for (let r = 0; r < size.side; r++) {
      for (let c = 0; c < size.side; c++) {
        if (!rows[r]![c]) rows[r]![c] = letters[rng.int(letters.length)]!;
      }
    }
    const grid = rows.map((row) => row.join(''));
    return new SearchState(theme.name, grid, picks, [], 0, 0, null);
  }
  throw new Error('Could not lay out a word search');
}

/** What a seat may know. There is nothing held back: the grid and the list are the whole game. */
export interface SearchView {
  readonly grid: readonly string[];
  readonly left: readonly string[];
}

export const searchViewFor = (state: SearchState): SearchView => ({ grid: state.grid, left: state.left });

interface SearchStyle {
  /** Takes the shortest word still on the list rather than any of them. */
  readonly tidy: boolean;
}

const TIERS: Record<BotTier, SearchStyle> = {
  easy: { tidy: false },
  medium: { tidy: false },
  hard: { tidy: true },
  expert: { tidy: true },
};

function createSearchBot(style: SearchStyle): Bot<SearchMove> {
  return {
    chooseMove(generic: GameState<SearchMove>, seat: Seat, rng: Rng): SearchMove {
      const state = generic as SearchState;
      const moves = state.legalMoves(seat);
      if (!moves.length) throw new Error('No legal moves');
      if (!style.tidy) return rng.pick(moves);
      const shortest = state.left.reduce((a, b) => (b.length < a.length ? b : a));
      const first = moves.find((move) => {
        const [r1, c1, r2, c2] = move.slice(1).split(',').map(Number) as [number, number, number, number];
        const along = state.read(r1, c1, r2, c2);
        return along === shortest || along.split('').reverse().join('') === shortest;
      });
      return first ?? moves[0]!;
    },
  };
}

export const wordSearchGame: GameDefinition<SearchMove> = {
  id: 'word-search',
  name: 'Word Search',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo'],
  hiddenInfo: false,
  realtime: false,
  newGame: (config, seed) => newWordSearch(config, seed),
  createBot: (tier) => createSearchBot(TIERS[tier]),
  encodeMove: (move) => move,
};
