import type { Rng } from '../../core/rng';
import { createRng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Sudoku (docs/games/sudoku.md). Every puzzle is made from the seed, has exactly one answer,
 * and its level comes from the solving tricks it needs, not only from how many numbers are given.
 */
export type SudokuLevel = 'easy' | 'medium' | 'hard' | 'expert';
export const SUDOKU_LEVELS: readonly SudokuLevel[] = ['easy', 'medium', 'hard', 'expert'];
export const SUDOKU_HINTS = 3;

export const rowOf = (cell: number): number => Math.floor(cell / 9);
export const colOf = (cell: number): number => cell % 9;
export const boxOf = (cell: number): number => Math.floor(rowOf(cell) / 3) * 3 + Math.floor(colOf(cell) / 3);

const CELLS = Array.from({ length: 81 }, (_, i) => i);

/** The 27 groups that must each hold 1 to 9: rows 0–8, columns 9–17, boxes 18–26. */
export const UNITS: readonly (readonly number[])[] = [
  ...Array.from({ length: 9 }, (_, r) => CELLS.filter((c) => rowOf(c) === r)),
  ...Array.from({ length: 9 }, (_, k) => CELLS.filter((c) => colOf(c) === k)),
  ...Array.from({ length: 9 }, (_, b) => CELLS.filter((c) => boxOf(c) === b)),
];
const unitName = (unit: number): string => (unit < 9 ? 'row' : unit < 18 ? 'column' : 'box');

/** The 20 cells that share a row, column or box with each cell. */
export const PEERS: readonly (readonly number[])[] = CELLS.map((cell) =>
  CELLS.filter((other) => other !== cell && (rowOf(other) === rowOf(cell) || colOf(other) === colOf(cell) || boxOf(other) === boxOf(cell))),
);

const ALL = 0x3fe;
const bit = (digit: number): number => 1 << digit;
function popcount(mask: number): number {
  let n = 0;
  for (let m = mask; m; m &= m - 1) n++;
  return n;
}
function digitsOf(mask: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= 9; d++) if (mask & bit(d)) out.push(d);
  return out;
}
function shuffle<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

/**
 * Backtracking search that always tries the square with the fewest options first.
 * Counts answers up to `limit`; with an `rng` it tries digits in random order (to make full grids).
 */
function backtrack(grid: readonly number[], limit: number, rng: Rng | null): { count: number; first: number[] | null } {
  const cells = grid.slice();
  const used = { row: Array<number>(9).fill(0), col: Array<number>(9).fill(0), box: Array<number>(9).fill(0) };
  for (let i = 0; i < 81; i++) {
    const d = cells[i]!;
    if (!d) continue;
    const b = bit(d);
    if ((used.row[rowOf(i)]! | used.col[colOf(i)]! | used.box[boxOf(i)]!) & b) return { count: 0, first: null };
    used.row[rowOf(i)]! |= b;
    used.col[colOf(i)]! |= b;
    used.box[boxOf(i)]! |= b;
  }
  let count = 0;
  let first: number[] | null = null;
  const search = (): void => {
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (cells[i]) continue;
      const mask = ALL & ~(used.row[rowOf(i)]! | used.col[colOf(i)]! | used.box[boxOf(i)]!);
      const n = popcount(mask);
      if (n === 0) return;
      if (n < bestCount) {
        best = i;
        bestMask = mask;
        bestCount = n;
        if (n === 1) break;
      }
    }
    if (best === -1) {
      count++;
      if (!first) first = cells.slice();
      return;
    }
    const options = digitsOf(bestMask);
    if (rng) shuffle(options, rng);
    const r = rowOf(best);
    const c = colOf(best);
    const x = boxOf(best);
    for (const d of options) {
      const b = bit(d);
      cells[best] = d;
      used.row[r]! |= b;
      used.col[c]! |= b;
      used.box[x]! |= b;
      search();
      cells[best] = 0;
      used.row[r]! &= ~b;
      used.col[c]! &= ~b;
      used.box[x]! &= ~b;
      if (count >= limit) return;
    }
  };
  search();
  return { count, first };
}

/** Number of answers a grid has, counting no further than `limit`. */
export const countSolutions = (grid: readonly number[], limit = 2): number => backtrack(grid, limit, null).count;

/** Options left for each empty square, from the numbers already in its row, column and box. */
function candidates(values: readonly number[]): number[] {
  return values.map((v, i) => {
    if (v) return 0;
    let seen = 0;
    for (const p of PEERS[i]!) if (values[p]) seen |= bit(values[p]!);
    return ALL & ~seen;
  });
}

function place(values: number[], cand: number[], cell: number, digit: number): void {
  values[cell] = digit;
  cand[cell] = 0;
  for (const p of PEERS[cell]!) cand[p]! &= ~bit(digit);
}

function hiddenSingle(values: readonly number[], cand: readonly number[]): { cell: number; digit: number; unit: number } | null {
  for (let u = 0; u < UNITS.length; u++) {
    for (let d = 1; d <= 9; d++) {
      let spot = -1;
      let n = 0;
      for (const c of UNITS[u]!) {
        if (!values[c] && cand[c]! & bit(d)) {
          n++;
          spot = c;
        }
      }
      if (n === 1) return { cell: spot, digit: d, unit: u };
    }
  }
  return null;
}

function nakedSingle(values: readonly number[], cand: readonly number[]): { cell: number; digit: number } | null {
  for (let i = 0; i < 81; i++) if (!values[i] && popcount(cand[i]!) === 1) return { cell: i, digit: digitsOf(cand[i]!)[0]! };
  return null;
}

/** Pointing pairs, box/line reduction and naked pairs: rule out options without placing anything. */
function eliminate(values: readonly number[], cand: number[]): boolean {
  let changed = false;
  const remove = (cells: readonly number[], mask: number, keep: (c: number) => boolean) => {
    for (const c of cells) {
      if (values[c] || keep(c) || !(cand[c]! & mask)) continue;
      cand[c]! &= ~mask;
      changed = true;
    }
  };
  for (let u = 0; u < UNITS.length; u++) {
    const unit = UNITS[u]!;
    for (let d = 1; d <= 9; d++) {
      const spots = unit.filter((c) => !values[c] && cand[c]! & bit(d));
      if (spots.length < 2) continue;
      if (u >= 18) {
        // In a box, all spots on one line: that line can't have the digit elsewhere.
        const r = rowOf(spots[0]!);
        const k = colOf(spots[0]!);
        if (spots.every((c) => rowOf(c) === r)) remove(UNITS[r]!, bit(d), (c) => boxOf(c) === u - 18);
        if (spots.every((c) => colOf(c) === k)) remove(UNITS[9 + k]!, bit(d), (c) => boxOf(c) === u - 18);
      } else {
        // In a line, all spots in one box: the rest of that box can't have the digit.
        const b = boxOf(spots[0]!);
        if (spots.every((c) => boxOf(c) === b)) remove(UNITS[18 + b]!, bit(d), (c) => unit.includes(c));
      }
    }
    const pairs = unit.filter((c) => !values[c] && popcount(cand[c]!) === 2);
    for (let i = 0; i < pairs.length; i++) {
      for (let j = i + 1; j < pairs.length; j++) {
        const mask = cand[pairs[i]!]!;
        if (cand[pairs[j]!] !== mask) continue;
        remove(unit, mask, (c) => c === pairs[i] || c === pairs[j]);
      }
    }
  }
  return changed;
}

/**
 * Solves like a person, using tricks up to `maxLevel`:
 * 1 one option left in a square, 2 one place left for a number, 3 pointing and pairs.
 * Returns the hardest trick needed, or 4 when these tricks are not enough.
 */
export function logicLevel(grid: readonly number[], maxLevel = 3): number {
  const values = grid.slice();
  const cand = candidates(values);
  let level = 1;
  for (;;) {
    if (values.every((v) => v)) return level;
    const naked = nakedSingle(values, cand);
    if (naked) {
      place(values, cand, naked.cell, naked.digit);
      continue;
    }
    if (maxLevel >= 2) {
      const hidden = hiddenSingle(values, cand);
      if (hidden) {
        place(values, cand, hidden.cell, hidden.digit);
        level = Math.max(level, 2);
        continue;
      }
    }
    if (maxLevel >= 3 && eliminate(values, cand)) {
      level = 3;
      continue;
    }
    return 4;
  }
}

export interface SudokuPuzzle {
  readonly givens: readonly number[];
  readonly solution: readonly number[];
  /** Hardest trick needed (see logicLevel). */
  readonly rating: number;
}

/** max: hardest trick allowed while removing numbers. floor: fewest givens. want: trick the puzzle should need. */
const LEVELS: Record<SudokuLevel, { max: number; floor: number; want: number }> = {
  easy: { max: 2, floor: 38, want: 1 },
  medium: { max: 2, floor: 30, want: 2 },
  hard: { max: 3, floor: 22, want: 3 },
  expert: { max: 4, floor: 17, want: 4 },
};

/** Full grid from the seed, then numbers removed in mirrored pairs while the puzzle keeps one answer. */
export function generateSudoku(seed: number, level: SudokuLevel): SudokuPuzzle {
  const cfg = LEVELS[level];
  let best: SudokuPuzzle | null = null;
  // Each try takes about a millisecond, so keep trying until the puzzle needs the right tricks.
  for (let attempt = 0; attempt < 60; attempt++) {
    const rng = createRng((seed ^ Math.imul(attempt + 1, 0x85ebca6b)) >>> 0);
    const solution = backtrack(Array<number>(81).fill(0), 1, rng).first!;
    const puzzle = solution.slice();
    let givens = 81;
    for (const cell of shuffle(Array.from({ length: 41 }, (_, i) => i), rng)) {
      // Classic puzzles look the same turned upside down, so squares go in mirrored pairs.
      const pair = cell === 40 ? [40] : [cell, 80 - cell];
      if (givens - pair.length < cfg.floor) continue;
      for (const c of pair) puzzle[c] = 0;
      const ok = countSolutions(puzzle) === 1 && (cfg.max >= 4 || logicLevel(puzzle, cfg.max) <= cfg.max);
      if (ok) givens -= pair.length;
      else for (const c of pair) puzzle[c] = solution[c]!;
    }
    const candidate: SudokuPuzzle = { givens: puzzle, solution, rating: logicLevel(puzzle) };
    if (candidate.rating >= cfg.want) return candidate;
    if (!best || candidate.rating > best.rating) best = candidate;
  }
  return best!;
}

/** Moves are strings so they compare by value: p<cell>:<digit>, n<cell>:<digit>, e<cell>, h, u. */
export type SudokuMove = string;
export const placeMove = (cell: number, digit: number): SudokuMove => `p${cell}:${digit}`;
export const noteMove = (cell: number, digit: number): SudokuMove => `n${cell}:${digit}`;
export const eraseMove = (cell: number): SudokuMove => `e${cell}`;
export const HINT_MOVE: SudokuMove = 'h';
export const UNDO_MOVE: SudokuMove = 'u';

export interface SudokuHint {
  readonly cell: number;
  readonly digit: number;
  /** One plain sentence explaining why. */
  readonly reason: string;
}

export class SudokuState implements GameState<SudokuMove> {
  readonly currentSeat: Seat = 0;
  private cachedMoves: SudokuMove[] | null = null;

  constructor(
    readonly level: SudokuLevel,
    readonly givens: readonly number[],
    readonly solution: readonly number[],
    /** Givens plus the player's numbers; 0 is empty. */
    readonly values: readonly number[],
    /** Pencil notes per square as a bit mask (bit d = note d). */
    readonly notes: readonly number[],
    readonly hintsLeft: number,
    readonly result: GameResult | null,
    readonly lastHint: SudokuHint | null,
    readonly previous: SudokuState | null,
  ) {}

  isGiven(cell: number): boolean {
    return this.givens[cell] !== 0;
  }

  /** Squares still empty. */
  get remaining(): number {
    return this.values.filter((v) => !v).length;
  }

  /** Squares whose number repeats in their row, column or box. */
  conflicts(): Set<number> {
    const out = new Set<number>();
    this.values.forEach((v, i) => {
      if (v && PEERS[i]!.some((p) => this.values[p] === v)) out.add(i);
    });
    return out;
  }

  legalMoves(seat: Seat): readonly SudokuMove[] {
    if (this.result || seat !== 0) return [];
    if (this.cachedMoves) return this.cachedMoves;
    const moves: SudokuMove[] = [];
    for (let cell = 0; cell < 81; cell++) {
      if (this.isGiven(cell)) continue;
      const value = this.values[cell]!;
      for (let d = 1; d <= 9; d++) {
        if (d !== value) moves.push(placeMove(cell, d));
        if (!value) moves.push(noteMove(cell, d));
      }
      if (value || this.notes[cell]) moves.push(eraseMove(cell));
    }
    if (this.hintsLeft > 0) moves.push(HINT_MOVE);
    if (this.previous) moves.push(UNDO_MOVE);
    this.cachedMoves = moves;
    return moves;
  }

  apply(move: SudokuMove): SudokuState {
    if (this.result) throw new Error('Game is over');
    if (!this.legalMoves(0).includes(move)) throw new Error(`Illegal move: ${move}`);
    if (move === UNDO_MOVE) {
      const back = this.previous!;
      // Undo takes back the board, but a hint once used stays used.
      return new SudokuState(this.level, this.givens, this.solution, back.values, back.notes, this.hintsLeft, null, null, back.previous);
    }
    if (move === HINT_MOVE) {
      const hint = findHint(this);
      return this.withPlacement(hint.cell, hint.digit, this.hintsLeft - 1, hint);
    }
    const [cell, digit] = move.slice(1).split(':').map(Number) as [number, number];
    if (move[0] === 'p') return this.withPlacement(cell, digit, this.hintsLeft, null);
    const values = this.values.slice();
    const notes = this.notes.slice();
    if (move[0] === 'n') notes[cell]! ^= bit(digit);
    else {
      values[cell] = 0;
      notes[cell] = 0;
    }
    return new SudokuState(this.level, this.givens, this.solution, values, notes, this.hintsLeft, null, null, this);
  }

  private withPlacement(cell: number, digit: number, hintsLeft: number, hint: SudokuHint | null): SudokuState {
    const values = this.values.slice();
    const notes = this.notes.slice();
    values[cell] = digit;
    notes[cell] = 0;
    // Like pencil marks you'd rub out: the number can't go anywhere else in the row, column or box.
    for (const p of PEERS[cell]!) notes[p]! &= ~bit(digit);
    const solved = values.every((v, i) => v === this.solution[i]);
    const result: GameResult | null = solved ? { winners: [0], draw: false } : null;
    return new SudokuState(this.level, this.givens, this.solution, values, notes, hintsLeft, result, hint, this);
  }
}

/** The next square a person could fill, with the reason in plain words. Fixes a wrong number first. */
export function findHint(state: SudokuState): SudokuHint {
  const { values, solution } = state;
  const wrong = values.findIndex((v, i) => v !== 0 && v !== solution[i]);
  if (wrong >= 0) return { cell: wrong, digit: solution[wrong]!, reason: `This square was wrong. It should be ${solution[wrong]}.` };
  const cand = candidates(values);
  const hidden = hiddenSingle(values, cand);
  if (hidden) {
    const { cell, digit, unit } = hidden;
    return { cell, digit, reason: `${digit} can only go in this one square of its ${unitName(unit)}.` };
  }
  const naked = nakedSingle(values, cand);
  if (naked) {
    const { cell, digit } = naked;
    return { cell, digit, reason: `Only ${digit} fits here. Its row, column and box already have every other number.` };
  }
  let cell = -1;
  for (let i = 0; i < 81; i++) if (!values[i] && (cell < 0 || popcount(cand[i]!) < popcount(cand[cell]!))) cell = i;
  return { cell, digit: solution[cell]!, reason: `This one needs a harder trick, so here is the answer: ${solution[cell]}.` };
}

export function newSudoku(seed: number, level: SudokuLevel): SudokuState {
  const { givens, solution } = generateSudoku(seed >>> 0, level);
  return new SudokuState(level, givens, solution, givens.slice(), Array<number>(81).fill(0), SUDOKU_HINTS, null, null, null);
}

/** Solves the way a person would, one square at a time (used for demos and tests). */
function createSudokuBot(): Bot<SudokuMove> {
  return {
    chooseMove(generic: GameState<SudokuMove>): SudokuMove {
      const hint = findHint(generic as SudokuState);
      return placeMove(hint.cell, hint.digit);
    },
  };
}

const isLevel = (value: string | undefined): value is SudokuLevel => SUDOKU_LEVELS.includes(value as SudokuLevel);

export const sudoku: GameDefinition<SudokuMove> = {
  id: 'sudoku',
  name: 'Sudoku',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo', 'race'],
  hiddenInfo: false,
  realtime: false,
  newGame: (config, seed) => newSudoku(seed, isLevel(config.variant) ? config.variant : 'easy'),
  createBot: () => createSudokuBot(),
  encodeMove: (move) => move,
};
