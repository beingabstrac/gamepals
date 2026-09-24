import { createRng, type Rng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Nonogram (docs/games/nonogram.md): the numbers beside each row and above each column say the
 * runs of filled squares in it, in order. Fill the grid to match. Every puzzle is a picture
 * mirrored left to right, like a little sprite, and is only dealt if it can be solved one line at
 * a time with no guessing, which also means it has exactly one answer.
 */
export const NONO_SIZES: Readonly<Record<string, number>> = { small: 5, medium: 10, large: 15 };

/** The runs of filled cells in a line. */
export function runs(line: readonly boolean[]): number[] {
  const out: number[] = [];
  let n = 0;
  for (const v of line) {
    if (v) n++;
    else if (n) {
      out.push(n);
      n = 0;
    }
  }
  if (n) out.push(n);
  return out;
}

/**
 * One pass of line logic: every way the runs fit the line given what is known, and the cells that
 * are the same in all of them. `known` is 1 filled, 0 empty, -1 unknown. Null if nothing fits.
 */
export function solveLine(clue: readonly number[], known: readonly number[]): number[] | null {
  const n = known.length;
  // Filled in every placement, and empty in every placement. An object, because the placements are
  // found in a closure, and the type checker cannot follow assignments made in one.
  const acc: { filled: boolean[] | null; empty: boolean[] | null } = { filled: null, empty: null };
  const current = Array<boolean>(n).fill(false);
  const place = (k: number, from: number): void => {
    if (k === clue.length) {
      for (let i = from; i < n; i++) if (known[i] === 1) return;
      if (!acc.filled || !acc.empty) {
        acc.filled = current.slice();
        acc.empty = current.map((v) => !v);
      } else {
        for (let i = 0; i < n; i++) {
          if (!current[i]) acc.filled[i] = false;
          if (current[i]) acc.empty[i] = false;
        }
      }
      return;
    }
    const len = clue[k]!;
    const rest = clue.slice(k + 1).reduce((a, b) => a + b + 1, 0);
    for (let start = from; start + len + rest <= n; start++) {
      // Cells skipped before this run must not be known filled.
      if (start > from && known[start - 1] === 1) break;
      let ok = true;
      for (let i = start; i < start + len; i++) if (known[i] === 0) ok = false;
      if (start + len < n && known[start + len] === 1) ok = false;
      if (!ok) continue;
      for (let i = start; i < start + len; i++) current[i] = true;
      place(k + 1, start + len + 1);
      for (let i = start; i < start + len; i++) current[i] = false;
    }
  };
  place(0, 0);
  const { filled, empty } = acc;
  if (!filled || !empty) return null;
  return known.map((v, i) => (v !== -1 ? v : filled[i] ? 1 : empty[i] ? 0 : -1));
}

/** Solve by line logic alone; null if it gets stuck or finds a contradiction. */
export function lineSolve(rowClues: readonly (readonly number[])[], colClues: readonly (readonly number[])[]): number[][] | null {
  const h = rowClues.length;
  const w = colClues.length;
  const grid = Array.from({ length: h }, () => Array<number>(w).fill(-1));
  for (let changed = true; changed; ) {
    changed = false;
    for (let y = 0; y < h; y++) {
      const next = solveLine(rowClues[y]!, grid[y]!);
      if (!next) return null;
      next.forEach((v, x) => {
        if (v !== grid[y]![x]) {
          grid[y]![x] = v;
          changed = true;
        }
      });
    }
    for (let x = 0; x < w; x++) {
      const next = solveLine(colClues[x]!, grid.map((r) => r[x]!));
      if (!next) return null;
      next.forEach((v, y) => {
        if (v !== grid[y]![x]) {
          grid[y]![x] = v;
          changed = true;
        }
      });
    }
  }
  return grid.every((r) => r.every((v) => v !== -1)) ? grid : null;
}

/** A picture mirrored left to right, a little over half filled, that line logic can solve. */
export function dealPicture(seed: number, size: number): boolean[][] {
  const rng = createRng(seed);
  for (let tries = 0; ; tries++) {
    const half = Math.ceil(size / 2);
    const grid = Array.from({ length: size }, () => {
      const left = Array.from({ length: half }, () => rng.next() < 0.58);
      return [...left, ...left.slice(0, size - half).reverse()];
    });
    const rows = grid.map(runs);
    const cols = grid[0]!.map((_, x) => runs(grid.map((r) => r[x]!)));
    // No empty lines: a picture with a blank row is half a puzzle.
    if (rows.some((r) => !r.length) || cols.some((c) => !c.length)) continue;
    const solved = lineSolve(rows, cols);
    if (solved && solved.every((r, y) => r.every((v, x) => (v === 1) === grid[y]![x]))) return grid;
    if (tries > 5000) throw new Error('No solvable picture');
  }
}

/** `f<i>` fill, `x<i>` mark empty, `c<i>` clear. */
export type NonoMove = string;

export class NonoState implements GameState<NonoMove> {
  readonly currentSeat: Seat = 0;

  constructor(
    readonly size: number,
    readonly picture: readonly (readonly boolean[])[],
    /** 1 filled, 0 marked empty, -1 blank. */
    readonly cells: readonly number[],
    readonly moves: number,
    readonly result: GameResult | null,
  ) {}

  get rowClues(): number[][] {
    return this.picture.map(runs);
  }

  get colClues(): number[][] {
    return this.picture[0]!.map((_, x) => runs(this.picture.map((r) => r[x]!)));
  }

  /** Whether a row (or column) as filled so far already matches its clue. */
  lineDone(kind: 'row' | 'col', i: number): boolean {
    const n = this.size;
    const line = Array.from({ length: n }, (_, k) => this.cells[kind === 'row' ? i * n + k : k * n + i] === 1);
    const clue = kind === 'row' ? this.rowClues[i]! : this.colClues[i]!;
    const got = runs(line);
    return got.length === clue.length && got.every((v, k) => v === clue[k]);
  }

  legalMoves(seat: Seat): readonly NonoMove[] {
    if (this.result || seat !== 0) return [];
    const moves: NonoMove[] = [];
    this.cells.forEach((v, i) => {
      if (v !== 1) moves.push(`f${i}`);
      if (v !== 0) moves.push(`x${i}`);
      if (v !== -1) moves.push(`c${i}`);
    });
    return moves;
  }

  apply(move: NonoMove): NonoState {
    if (!this.legalMoves(0).includes(move)) throw new Error(`Illegal move: ${move}`);
    const i = Number(move.slice(1));
    const cells = this.cells.slice();
    cells[i] = move[0] === 'f' ? 1 : move[0] === 'x' ? 0 : -1;
    const n = this.size;
    // Solved when the filled squares are the picture: marks and blanks both count as empty.
    const solved = this.picture.every((row, y) => row.every((v, x) => v === (cells[y * n + x] === 1)));
    return new NonoState(n, this.picture, cells, this.moves + 1, solved ? { winners: [0], draw: false } : null);
  }
}

export function newNonogram(seed: number, level = 'small'): NonoState {
  const size = NONO_SIZES[level] ?? 5;
  const picture = dealPicture(seed, size);
  return new NonoState(size, picture, Array<number>(size * size).fill(-1), 0, null);
}

/** Test play: fill the next square of the picture. */
function createNonoBot(): Bot<NonoMove> {
  return {
    chooseMove(generic: GameState<NonoMove>, _seat: Seat, _rng: Rng): NonoMove {
      const s = generic as NonoState;
      const n = s.size;
      for (let i = 0; i < n * n; i++) {
        const want = s.picture[Math.floor(i / n)]![i % n]!;
        if (want && s.cells[i] !== 1) return `f${i}`;
        if (!want && s.cells[i] === 1) return `c${i}`;
      }
      return `x0`;
    },
  };
}

export const nonogram: GameDefinition<NonoMove> = {
  id: 'nonogram',
  name: 'Nonogram',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo', 'race'],
  hiddenInfo: false,
  realtime: false,
  newGame: (config, seed) => newNonogram(seed, config.variant ?? 'small'),
  createBot: () => createNonoBot(),
  encodeMove: (move) => move,
};
