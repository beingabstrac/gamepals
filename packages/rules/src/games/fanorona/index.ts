import { createSearchBot, type SearchTier } from '../../core/bots';
import type { BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Fanorona (docs/games/fanorona.md), Madagascar's national board game: 22 pieces each on a 9 by 5
 * board, every point filled but the middle. Capture by approaching a piece along a line or by
 * withdrawing from one, and the whole unbroken line of theirs behind it goes too. Capturing is a
 * must, and a capturing piece may keep going, never the same way twice running and never back to
 * a point it has been. Take all of theirs to win.
 */
export const FANO_W = 9;
export const FANO_H = 5;
export const FANO_POINTS = FANO_W * FANO_H;
/** Plies with nothing taken before it is called a draw. */
export const FANO_QUIET_LIMIT = 100;

/** Points with (x + y) even have diagonals too. */
export const isStrong = (p: number): boolean => ((p % FANO_W) + Math.floor(p / FANO_W)) % 2 === 0;

const ALL_DIRS: readonly (readonly [number, number])[] = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];

function stepFrom(p: number, dx: number, dy: number): number | null {
  const x = (p % FANO_W) + dx;
  const y = Math.floor(p / FANO_W) + dy;
  return x < 0 || y < 0 || x >= FANO_W || y >= FANO_H ? null : y * FANO_W + x;
}

/** The directions a piece on `p` can go along the lines. */
export const fanoDirs = (p: number): readonly (readonly [number, number])[] => (isStrong(p) ? ALL_DIRS : ALL_DIRS.slice(0, 4));

/** -1 empty, 0 White (seat 0, moves first, along the bottom), 1 Black. */
export function fanoStart(): number[] {
  const board = Array<number>(FANO_POINTS).fill(-1);
  for (let x = 0; x < FANO_W; x++) {
    board[x] = 1;
    board[FANO_W + x] = 1;
    board[3 * FANO_W + x] = 0;
    board[4 * FANO_W + x] = 0;
  }
  // The middle row alternates, the center left empty: the same from either side of the board.
  const middle = [1, 0, 1, 0, -1, 1, 0, 1, 0];
  middle.forEach((v, x) => (board[2 * FANO_W + x] = v));
  return board;
}

/** `m<from>-<to>` a paika (no capture); add `a` for approach or `w` for withdrawal; `stop` ends a capture run. */
export type FanoMove = string;

export interface FanoChain {
  readonly at: number;
  readonly visited: readonly number[];
  readonly dir: readonly [number, number];
}

export class FanoState implements GameState<FanoMove> {
  constructor(
    readonly board: readonly number[],
    readonly currentSeat: Seat,
    /** A capture run in progress: only this piece may move, and only to capture again. */
    readonly chain: FanoChain | null,
    readonly quiet: number,
    readonly last: { seat: Seat; from: number; to: number; captured: readonly number[] } | null,
    readonly result: GameResult | null,
  ) {}

  /** The line of theirs taken by an approach (`a`) or withdrawal (`w`) from `from` to `to`. */
  taken(from: number, to: number, kind: 'a' | 'w', seat: Seat): number[] {
    const dx = (to % FANO_W) - (from % FANO_W);
    const dy = Math.floor(to / FANO_W) - Math.floor(from / FANO_W);
    const enemy = seat === 0 ? 1 : 0;
    const line: number[] = [];
    let p = kind === 'a' ? stepFrom(to, dx, dy) : stepFrom(from, -dx, -dy);
    const sx = kind === 'a' ? dx : -dx;
    const sy = kind === 'a' ? dy : -dy;
    while (p !== null && this.board[p] === enemy) {
      line.push(p);
      p = stepFrom(p, sx, sy);
    }
    return line;
  }

  /** Every capturing move for `seat` (just the chaining piece's, mid-run). */
  captures(seat: Seat): FanoMove[] {
    const moves: FanoMove[] = [];
    const chain = this.chain;
    for (let from = 0; from < FANO_POINTS; from++) {
      if (this.board[from] !== seat || (chain && from !== chain.at)) continue;
      for (const [dx, dy] of fanoDirs(from)) {
        const to = stepFrom(from, dx, dy);
        if (to === null || this.board[to] !== -1) continue;
        if (chain && ((dx === chain.dir[0] && dy === chain.dir[1]) || chain.visited.includes(to))) continue;
        if (this.taken(from, to, 'a', seat).length) moves.push(`m${from}-${to}a`);
        if (this.taken(from, to, 'w', seat).length) moves.push(`m${from}-${to}w`);
      }
    }
    return moves;
  }

  legalMoves(seat: Seat): readonly FanoMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    const caps = this.captures(seat);
    if (this.chain) return [...caps, 'stop'];
    if (caps.length) return caps;
    const moves: FanoMove[] = [];
    for (let from = 0; from < FANO_POINTS; from++) {
      if (this.board[from] !== seat) continue;
      for (const [dx, dy] of fanoDirs(from)) {
        const to = stepFrom(from, dx, dy);
        if (to !== null && this.board[to] === -1) moves.push(`m${from}-${to}`);
      }
    }
    return moves;
  }

  apply(move: FanoMove): FanoState {
    if (!this.legalMoves(this.currentSeat).includes(move)) throw new Error(`Illegal move: ${move}`);
    const seat = this.currentSeat;
    const other: Seat = seat === 0 ? 1 : 0;
    if (move === 'stop') return this.pass(this.board, other, this.quiet, this.last);
    const kind = move.endsWith('a') ? 'a' : move.endsWith('w') ? 'w' : null;
    const [from, to] = move.slice(1, kind ? -1 : undefined).split('-').map(Number) as [number, number];
    const board = this.board.slice();
    board[to] = seat;
    board[from] = -1;
    const captured = kind ? this.taken(from, to, kind, seat) : [];
    for (const p of captured) board[p] = -1;
    const last = { seat, from, to, captured };
    if (!board.includes(other)) return new FanoState(board, seat, null, 0, last, { winners: [seat], draw: false });
    if (!kind) return this.pass(board, other, this.quiet + 1, last);
    // The same piece may capture again: not the same way twice running, never back where it has been.
    const dir: [number, number] = [(to % FANO_W) - (from % FANO_W), Math.floor(to / FANO_W) - Math.floor(from / FANO_W)];
    const visited = [...(this.chain?.visited ?? [from]), to];
    const chained = new FanoState(board, seat, { at: to, visited, dir }, 0, last, null);
    return chained.captures(seat).length ? chained : this.pass(board, other, 0, last);
  }

  private pass(board: readonly number[], next: Seat, quiet: number, last: FanoState['last']): FanoState {
    const state = new FanoState(board, next, null, quiet, last, null);
    if (state.legalMoves(next).length === 0) return new FanoState(board, next, null, quiet, last, { winners: [next === 0 ? 1 : 0], draw: false });
    if (quiet >= FANO_QUIET_LIMIT) return new FanoState(board, next, null, quiet, last, { winners: [], draw: true });
    return state;
  }
}

export function newFanorona(): FanoState {
  return new FanoState(fanoStart(), 0, null, 0, null, null);
}

function evaluate(state: GameState<FanoMove>, seat: Seat): number {
  const s = state as FanoState;
  let mine = 0;
  let theirs = 0;
  for (const b of s.board) {
    if (b === seat) mine++;
    else if (b !== -1) theirs++;
  }
  // Pieces on strong points have more lines to fight along.
  let shape = 0;
  s.board.forEach((b, p) => {
    if (b !== -1 && isStrong(p)) shape += b === seat ? 1 : -1;
  });
  return (mine - theirs) * 100 + shape * 3;
}

const TIERS: Record<BotTier, SearchTier> = {
  easy: { depth: 1, randomMoveRate: 0.4 },
  medium: { depth: 2, randomMoveRate: 0.1 },
  hard: { depth: 3, randomMoveRate: 0.02 },
  expert: { depth: 5, randomMoveRate: 0 },
};

export const fanorona: GameDefinition<FanoMove> = {
  id: 'fanorona',
  name: 'Fanorona',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: false,
  realtime: false,
  newGame: () => newFanorona(),
  createBot: (tier) => createSearchBot(TIERS[tier], evaluate),
  encodeMove: (move) => move,
};
