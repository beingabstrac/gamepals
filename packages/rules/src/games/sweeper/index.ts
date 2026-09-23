import type { Rng } from '../../core/rng';
import { createRng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/** Sweeper: mines under a grid, and a board that never needs a guess (docs/games/sweeper.md). */
export type SweeperLevel = 'easy' | 'medium' | 'hard';
export const SWEEPER_LEVELS: readonly SweeperLevel[] = ['easy', 'medium', 'hard'];

/**
 * Sizes for a phone held upright. The densities follow the classic three (12%, 16%, 21%), and twelve
 * across is as narrow as a square can go and still take a thumb.
 */
export const SWEEPER_SIZES: Record<SweeperLevel, { readonly w: number; readonly h: number; readonly mines: number }> = {
  easy: { w: 8, h: 10, mines: 10 },
  medium: { w: 10, h: 14, mines: 22 },
  hard: { w: 12, h: 18, mines: 40 },
};

/**
 * How many times a board is laid before one that needs a guess is accepted. Measured at 30 redraws
 * at the very worst on the hardest board, so this is a safety net that should never be reached.
 */
const MAX_LAYS = 2000;

/** Uncover (`r<cell>`), flag or unflag (`f<cell>`), or chord a finished number (`c<cell>`). */
export type SweeperMove = string;
export const revealMove = (cell: number): SweeperMove => `r${cell}`;
export const flagMove = (cell: number): SweeperMove => `f${cell}`;
export const chordMove = (cell: number): SweeperMove => `c${cell}`;

/** The eight squares around a cell, fewer at an edge. */
export function neighboursOf(w: number, h: number, cell: number): number[] {
  const x = cell % w;
  const y = Math.floor(cell / w);
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h) out.push(ny * w + nx);
    }
  }
  return out;
}

function countsOf(w: number, h: number, mines: readonly boolean[]): number[] {
  return mines.map((_, cell) => neighboursOf(w, h, cell).filter((n) => mines[n]).length);
}

/**
 * Everything that can be proved from the numbers showing, and nothing else. Flags are the player's
 * notes and can be wrong, so they are never trusted here.
 *
 * Two rules, repeated until neither finds anything more. A number whose mines are all accounted for
 * makes every other unknown neighbour safe, and a number with exactly as many unknown neighbours as
 * mines still to find makes them all mines. And where one number's unknowns are a subset of
 * another's, the difference between them is settled by the difference between what they need.
 */
export function deduce(
  w: number,
  h: number,
  open: readonly boolean[],
  counts: readonly number[],
): { safe: number[]; mine: number[] } {
  const safe = new Set<number>();
  const mine = new Set<number>();
  const cells = w * h;
  for (let progress = true; progress; ) {
    progress = false;
    const constraints: { cells: number[]; need: number }[] = [];
    for (let cell = 0; cell < cells; cell++) {
      if (!open[cell] || counts[cell] === 0) continue;
      const around = neighboursOf(w, h, cell).filter((n) => !open[n]);
      const unknown = around.filter((n) => !mine.has(n) && !safe.has(n));
      if (unknown.length === 0) continue;
      const need = counts[cell]! - around.filter((n) => mine.has(n)).length;
      if (need === 0) {
        for (const n of unknown) safe.add(n);
        progress = true;
      } else if (need === unknown.length) {
        for (const n of unknown) mine.add(n);
        progress = true;
      } else constraints.push({ cells: unknown, need });
    }
    if (progress) continue;
    for (const a of constraints) {
      for (const b of constraints) {
        if (a === b || a.cells.length >= b.cells.length) continue;
        if (!a.cells.every((n) => b.cells.includes(n))) continue;
        const rest = b.cells.filter((n) => !a.cells.includes(n));
        const extra = b.need - a.need;
        if (extra === 0) for (const n of rest) safe.add(n);
        else if (extra === rest.length) for (const n of rest) mine.add(n);
        else continue;
        progress = true;
      }
    }
  }
  return { safe: [...safe].sort((a, b) => a - b), mine: [...mine].sort((a, b) => a - b) };
}

/** Uncovers from `start`, opening outward through zeros and stopping at numbers and at `flags`. */
function flood(
  w: number,
  h: number,
  start: number,
  counts: readonly number[],
  open: boolean[],
  flags: readonly boolean[],
  into: number[],
): void {
  const stack = [start];
  while (stack.length > 0) {
    const cell = stack.pop()!;
    if (open[cell] || flags[cell]) continue;
    open[cell] = true;
    into.push(cell);
    if (counts[cell] === 0) for (const n of neighboursOf(w, h, cell)) if (!open[n]) stack.push(n);
  }
}

/** Whether logic alone, starting from `first`, uncovers every square that is not a mine. */
export function solvableFrom(w: number, h: number, mines: readonly boolean[], first: number): boolean {
  const counts = countsOf(w, h, mines);
  const open = mines.map(() => false);
  const none = mines.map(() => false);
  const scratch: number[] = [];
  flood(w, h, first, counts, open, none, scratch);
  for (;;) {
    const { safe } = deduce(w, h, open, counts);
    if (safe.length === 0) break;
    for (const cell of safe) flood(w, h, cell, counts, open, none, scratch);
  }
  return mines.every((isMine, cell) => isMine || open[cell]);
}

/**
 * Lays the mines once the first square is known, keeping it and its whole ring clear so the first tap
 * always opens a region, and throwing back any board that logic alone cannot finish from there.
 */
export function layMines(seed: number, level: SweeperLevel, first: number): boolean[] {
  const { w, h, mines } = SWEEPER_SIZES[level];
  const rng = createRng(((seed >>> 0) ^ Math.imul(first + 1, 0x9e3779b1)) >>> 0);
  const keepClear = new Set([first, ...neighboursOf(w, h, first)]);
  const candidates = Array.from({ length: w * h }, (_, cell) => cell).filter((cell) => !keepClear.has(cell));
  let board: boolean[] = [];
  for (let attempt = 0; attempt < MAX_LAYS; attempt++) {
    const order = candidates.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    board = Array<boolean>(w * h).fill(false);
    for (const cell of order.slice(0, mines)) board[cell] = true;
    if (solvableFrom(w, h, board, first)) return board;
  }
  return board;
}

export class SweeperState implements GameState<SweeperMove> {
  readonly currentSeat: Seat = 0;

  constructor(
    readonly level: SweeperLevel,
    readonly seed: number,
    readonly w: number,
    readonly h: number,
    readonly mineCount: number,
    /** Where the mines are, or null until the first square is uncovered and they are laid. */
    readonly mines: readonly boolean[] | null,
    /** The number each square shows, or null until the mines are laid. */
    readonly counts: readonly number[] | null,
    readonly open: readonly boolean[],
    readonly flags: readonly boolean[],
    readonly result: GameResult | null,
    /** The mine that ended the game, if one did. */
    readonly boom: number | null,
    /** Squares the last move uncovered, in the order they opened, for the animation. */
    readonly last: readonly number[],
  ) {}

  get cells(): number {
    return this.w * this.h;
  }

  /** Mines still to find as every version counts them: mines minus flags, and it can go below zero. */
  get minesLeft(): number {
    return this.mineCount - this.flags.filter(Boolean).length;
  }

  /** Squares that are not mines and are still covered. */
  get safeLeft(): number {
    if (!this.mines) return this.cells - this.mineCount;
    return this.mines.filter((isMine, cell) => !isMine && !this.open[cell]).length;
  }

  /** A finished number: its flags already add up to it and it still has a neighbour to sweep. */
  canChord(cell: number): boolean {
    if (!this.counts || !this.open[cell] || this.counts[cell] === 0) return false;
    const around = neighboursOf(this.w, this.h, cell);
    const flagged = around.filter((n) => this.flags[n]).length;
    return flagged === this.counts[cell] && around.some((n) => !this.open[n] && !this.flags[n]);
  }

  legalMoves(seat: Seat): readonly SweeperMove[] {
    if (this.result || seat !== 0) return [];
    const moves: SweeperMove[] = [];
    for (let cell = 0; cell < this.cells; cell++) {
      if (!this.open[cell]) {
        if (!this.flags[cell]) moves.push(revealMove(cell));
        moves.push(flagMove(cell));
      } else if (this.canChord(cell)) moves.push(chordMove(cell));
    }
    return moves;
  }

  apply(move: SweeperMove): SweeperState {
    if (this.result) throw new Error('Game is over');
    if (!this.legalMoves(0).includes(move)) throw new Error(`Illegal move: ${move}`);
    const cell = Number(move.slice(1));
    if (move[0] === 'f') {
      const flags = this.flags.slice();
      flags[cell] = !flags[cell];
      return this.with(this.mines, this.counts, this.open, flags, null, null, []);
    }
    let mines = this.mines;
    let counts = this.counts;
    if (!mines || !counts) {
      mines = layMines(this.seed, this.level, cell);
      counts = countsOf(this.w, this.h, mines);
    }
    const targets = move[0] === 'c' ? neighboursOf(this.w, this.h, cell).filter((n) => !this.open[n] && !this.flags[n]) : [cell];
    const open = this.open.slice();
    const last: number[] = [];
    let boom: number | null = null;
    for (const target of targets) {
      if (open[target]) continue;
      if (mines[target]) {
        // A chord onto a wrong flag uncovers the mine it was hiding, the same as tapping it would.
        open[target] = true;
        last.push(target);
        boom ??= target;
        continue;
      }
      flood(this.w, this.h, target, counts, open, this.flags, last);
    }
    const cleared = mines.every((isMine, n) => isMine || open[n]);
    const result: GameResult | null = boom !== null ? { winners: [], draw: false } : cleared ? { winners: [0], draw: false } : null;
    return this.with(mines, counts, open, this.flags, result, boom, last);
  }

  private with(
    mines: readonly boolean[] | null,
    counts: readonly number[] | null,
    open: readonly boolean[],
    flags: readonly boolean[],
    result: GameResult | null,
    boom: number | null,
    last: readonly number[],
  ): SweeperState {
    return new SweeperState(this.level, this.seed, this.w, this.h, this.mineCount, mines, counts, open, flags, result, boom, last);
  }
}

export function newSweeper(seed: number, level: SweeperLevel): SweeperState {
  const { w, h, mines } = SWEEPER_SIZES[level];
  const blank = Array<boolean>(w * h).fill(false);
  return new SweeperState(level, seed >>> 0, w, h, mines, null, null, blank, blank, null, null, []);
}

/**
 * Autoplay: starts in the middle, flags what it has proved to be a mine and uncovers what it has proved
 * safe, using the same solver the boards are checked with. On a board laid to need no guess it never
 * has to pick at random and never loses.
 */
function createSweeperBot(): Bot<SweeperMove> {
  return {
    chooseMove(generic: GameState<SweeperMove>, _seat: Seat, rng: Rng): SweeperMove {
      const state = generic as SweeperState;
      if (!state.counts) {
        const middle = Math.floor(state.h / 2) * state.w + Math.floor(state.w / 2);
        return state.flags[middle] ? rng.pick(state.legalMoves(0).filter((m) => m[0] === 'r')) : revealMove(middle);
      }
      const { safe, mine } = deduce(state.w, state.h, state.open, state.counts);
      // Flag what is proved first, so the board looks like a game somebody is playing.
      for (const cell of mine) if (!state.flags[cell]) return flagMove(cell);
      for (const cell of safe) return state.flags[cell] ? flagMove(cell) : revealMove(cell);
      return rng.pick(state.legalMoves(0).filter((m) => m[0] === 'r'));
    },
  };
}

const isLevel = (value: string | undefined): value is SweeperLevel => SWEEPER_LEVELS.includes(value as SweeperLevel);

export const sweeper: GameDefinition<SweeperMove> = {
  id: 'sweeper',
  name: 'Sweeper',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo', 'race'],
  // The layout is a secret from the player, and it is laid from the seed: a server keeping score has
  // to be the one that knows it.
  hiddenInfo: true,
  realtime: false,
  newGame: (config, seed) => newSweeper(seed, isLevel(config.variant) ? config.variant : 'easy'),
  createBot: () => createSweeperBot(),
  encodeMove: (move) => move,
};
