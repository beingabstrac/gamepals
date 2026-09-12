import { createSearchBot, type SearchTier } from '../../core/bots';
import type { BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

export const COLS = 7;
export const ROWS = 6;

/** The seat whose disc fills a cell, or empty. */
export type Disc = Seat | null;
/** Column to drop a disc into, 0–6. */
export type FourInARowMove = number;

/** Center-first order: better alpha-beta pruning and more natural bot play. */
const COLUMN_ORDER = [3, 2, 4, 1, 5, 0, 6];
const DIRECTIONS: readonly (readonly [number, number])[] = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

/** Row 0 is the bottom row. */
export const cellIndex = (col: number, row: number): number => row * COLS + col;

const inBounds = (col: number, row: number) => col >= 0 && col < COLS && row >= 0 && row < ROWS;

/** Cells of a line of 4+ through (col, row), or null. */
export function findWin(board: readonly Disc[], col: number, row: number): number[] | null {
  const seat = board[cellIndex(col, row)];
  if (seat === null || seat === undefined) return null;
  for (const [dc, dr] of DIRECTIONS) {
    const line = [cellIndex(col, row)];
    for (const sign of [1, -1]) {
      let c = col + dc * sign;
      let r = row + dr * sign;
      while (inBounds(c, r) && board[cellIndex(c, r)] === seat) {
        line.push(cellIndex(c, r));
        c += dc * sign;
        r += dr * sign;
      }
    }
    if (line.length >= 4) return line;
  }
  return null;
}

export class FourInARowState implements GameState<FourInARowMove> {
  constructor(
    readonly board: readonly Disc[],
    readonly heights: readonly number[],
    readonly currentSeat: Seat,
    readonly result: GameResult | null,
    readonly winLine: readonly number[] | null,
    readonly lastMove: FourInARowMove | null,
  ) {}

  legalMoves(seat: Seat): readonly FourInARowMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    return COLUMN_ORDER.filter((col) => (this.heights[col] ?? ROWS) < ROWS);
  }

  apply(move: FourInARowMove): FourInARowState {
    if (this.result) throw new Error('Game is over');
    const row = this.heights[move];
    if (!Number.isInteger(move) || row === undefined || row >= ROWS) throw new Error(`Illegal move: ${move}`);

    const board = this.board.slice();
    board[cellIndex(move, row)] = this.currentSeat;
    const heights = this.heights.slice();
    heights[move] = row + 1;

    const winLine = findWin(board, move, row);
    let result: GameResult | null = null;
    if (winLine) result = { winners: [this.currentSeat], draw: false };
    else if (heights.every((h) => h === ROWS)) result = { winners: [], draw: true };

    return new FourInARowState(board, heights, this.currentSeat === 0 ? 1 : 0, result, winLine, move);
  }
}

/** Every line of 4 cells on the board (69 of them). */
const WINDOWS: readonly (readonly number[])[] = (() => {
  const windows: number[][] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      for (const [dc, dr] of DIRECTIONS) {
        if (!inBounds(col + 3 * dc, row + 3 * dr)) continue;
        windows.push([0, 1, 2, 3].map((i) => cellIndex(col + i * dc, row + i * dr)));
      }
    }
  }
  return windows;
})();

/** Score by own discs in a window the opponent hasn't blocked. */
const WINDOW_SCORE = [0, 1, 4, 16, 1000];
const CENTER_BONUS = 3;

function evaluate(state: GameState<FourInARowMove>, seat: Seat): number {
  const { board } = state as FourInARowState;
  let score = 0;
  for (const window of WINDOWS) {
    let mine = 0;
    let theirs = 0;
    for (const index of window) {
      const disc = board[index];
      if (disc === seat) mine++;
      else if (disc !== null) theirs++;
    }
    if (theirs === 0) score += WINDOW_SCORE[mine] ?? 0;
    else if (mine === 0) score -= WINDOW_SCORE[theirs] ?? 0;
  }
  for (let row = 0; row < ROWS; row++) {
    const disc = board[cellIndex(3, row)];
    if (disc === seat) score += CENTER_BONUS;
    else if (disc !== null) score -= CENTER_BONUS;
  }
  return score;
}

const TIERS: Record<BotTier, SearchTier> = {
  easy: { depth: 2, randomMoveRate: 0.3 },
  medium: { depth: 3, randomMoveRate: 0.1 },
  hard: { depth: 5, randomMoveRate: 0.03 },
  expert: { depth: 7, randomMoveRate: 0 },
};

export const fourInARow: GameDefinition<FourInARowMove> = {
  id: 'four-in-a-row',
  name: 'Four in a Row',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: false,
  realtime: false,
  newGame: () => new FourInARowState(Array<Disc>(COLS * ROWS).fill(null), Array<number>(COLS).fill(0), 0, null, null, null),
  createBot: (tier) => createSearchBot(TIERS[tier], evaluate),
  encodeMove: (move) => String(move),
};
