import { createSearchBot, type SearchTier } from '../../core/bots';
import type { BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Reversi (docs/games/reversi.md). 64 squares, row by row (row 0 at the top).
 * 0 empty, 1 dark (seat 0, moves first), 2 light (seat 1).
 */
export const REVERSI_EMPTY = 0;
export const discOf = (seat: Seat): number => seat + 1;

/** `m<square>` places a disc; `pass` when you have no legal move. */
export type ReversiMove = string;
export const placeDisc = (square: number): ReversiMove => `m${square}`;
export const REVERSI_PASS: ReversiMove = 'pass';

export interface ReversiEvent {
  readonly seat: Seat;
  /** The square played, or null for a pass. */
  readonly square: number | null;
  /** Discs that flipped, nearest first in each direction. */
  readonly flipped: readonly number[];
}

const DIRS: readonly (readonly [number, number])[] = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];

/** Discs that placing on `square` would flip for `seat` (empty when the move is not legal). */
export function flipsFor(board: readonly number[], square: number, seat: Seat): number[] {
  if (board[square] !== REVERSI_EMPTY) return [];
  const mine = discOf(seat);
  const r0 = Math.floor(square / 8);
  const c0 = square % 8;
  const flips: number[] = [];
  for (const [dr, dc] of DIRS) {
    const line: number[] = [];
    let r = r0 + dr;
    let c = c0 + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const disc = board[r * 8 + c]!;
      if (disc === REVERSI_EMPTY) break;
      if (disc === mine) {
        flips.push(...line);
        break;
      }
      line.push(r * 8 + c);
      r += dr;
      c += dc;
    }
  }
  return flips;
}

function placements(board: readonly number[], seat: Seat): number[] {
  const out: number[] = [];
  for (let sq = 0; sq < 64; sq++) if (flipsFor(board, sq, seat).length) out.push(sq);
  return out;
}

export function initialReversiBoard(): number[] {
  const board = Array<number>(64).fill(REVERSI_EMPTY);
  // Dark on the upper right and lower left of the middle four.
  board[3 * 8 + 3] = discOf(1);
  board[4 * 8 + 4] = discOf(1);
  board[3 * 8 + 4] = discOf(0);
  board[4 * 8 + 3] = discOf(0);
  return board;
}

export class ReversiState implements GameState<ReversiMove> {
  private cachedMoves: ReversiMove[] | null = null;

  constructor(
    readonly board: readonly number[],
    readonly currentSeat: Seat,
    readonly result: GameResult | null,
    readonly last: ReversiEvent | null,
  ) {}

  count(seat: Seat): number {
    return this.board.filter((d) => d === discOf(seat)).length;
  }

  legalMoves(seat: Seat): readonly ReversiMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    if (!this.cachedMoves) {
      const places = placements(this.board, seat);
      // No move: the only thing you can do is pass (the game ends before a double pass).
      this.cachedMoves = places.length ? places.map(placeDisc) : [REVERSI_PASS];
    }
    return this.cachedMoves;
  }

  apply(move: ReversiMove): ReversiState {
    if (this.result) throw new Error('Game is over');
    if (!this.legalMoves(this.currentSeat).includes(move)) throw new Error(`Illegal move: ${move}`);
    const seat = this.currentSeat;
    const next: Seat = seat === 0 ? 1 : 0;
    if (move === REVERSI_PASS) return new ReversiState(this.board, next, null, { seat, square: null, flipped: [] });

    const square = Number(move.slice(1));
    const flipped = flipsFor(this.board, square, seat);
    const board = this.board.slice();
    board[square] = discOf(seat);
    for (const sq of flipped) board[sq] = discOf(seat);
    const event: ReversiEvent = { seat, square, flipped };

    // The game ends when neither side can move (a full board is the usual case).
    if (placements(board, next).length === 0 && placements(board, seat).length === 0) {
      const mine = board.filter((d) => d === discOf(seat)).length;
      const theirs = board.filter((d) => d === discOf(next)).length;
      const result: GameResult = mine === theirs ? { winners: [], draw: true } : { winners: [mine > theirs ? seat : next], draw: false };
      return new ReversiState(board, next, result, event);
    }
    return new ReversiState(board, next, null, event);
  }
}

export function newReversi(): ReversiState {
  return new ReversiState(initialReversiBoard(), 0, null, null);
}

/** Classic square values: corners are gold, the squares next to them are risky, edges are good. */
const WEIGHTS = [
  120, -20, 20, 5, 5, 20, -20, 120,
  -20, -40, -5, -5, -5, -5, -40, -20,
  20, -5, 15, 3, 3, 15, -5, 20,
  5, -5, 3, 3, 3, 3, -5, 5,
  5, -5, 3, 3, 3, 3, -5, 5,
  20, -5, 15, 3, 3, 15, -5, 20,
  -20, -40, -5, -5, -5, -5, -40, -20,
  120, -20, 20, 5, 5, 20, -20, 120,
];

function evaluate(sharp: boolean) {
  return (generic: GameState<ReversiMove>, seat: Seat): number => {
    const state = generic as ReversiState;
    const other: Seat = seat === 0 ? 1 : 0;
    const empty = state.board.filter((d) => d === REVERSI_EMPTY).length;
    // Near the end, only the disc count matters.
    if (empty <= 10) return state.count(seat) - state.count(other);
    let score = 0;
    state.board.forEach((disc, sq) => {
      if (disc === discOf(seat)) score += WEIGHTS[sq]!;
      else if (disc === discOf(other)) score -= WEIGHTS[sq]!;
    });
    if (sharp) score += 8 * (placements(state.board, seat).length - placements(state.board, other).length);
    return score;
  };
}

const TIERS: Record<BotTier, SearchTier & { sharp: boolean }> = {
  easy: { depth: 1, randomMoveRate: 0.3, sharp: false },
  medium: { depth: 2, randomMoveRate: 0.08, sharp: false },
  hard: { depth: 4, randomMoveRate: 0.02, sharp: true },
  expert: { depth: 5, randomMoveRate: 0, sharp: true },
};

export const reversi: GameDefinition<ReversiMove> = {
  id: 'reversi',
  name: 'Reversi',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: false,
  realtime: false,
  newGame: () => newReversi(),
  createBot: (tier) => createSearchBot(TIERS[tier], evaluate(TIERS[tier].sharp)),
  encodeMove: (move) => move,
};
