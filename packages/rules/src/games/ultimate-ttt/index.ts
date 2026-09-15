import { createSearchBot, type SearchTier } from '../../core/bots';
import type { BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';
import { LINES, winningLine } from '../tic-tac-toe';

/**
 * Ultimate Tic-Tac-Toe (docs/games/ultimate-ttt.md). 81 squares: square `b * 9 + c` is square c of small board b,
 * both numbered 0–8 row by row. The square you play sends the other player to the small board with the same number.
 */
export type UltimateMove = string;
export const ultimateMove = (board: number, cell: number): UltimateMove => `u${board * 9 + cell}`;
export const ultimateSquare = (move: UltimateMove): number => Number(move.slice(1));

/** A small board: won by a seat, full with no winner, or still open. */
export type SmallBoard = Seat | 'full' | null;

function markOf(cells: readonly (Seat | null)[], board: number): SmallBoard {
  const small = cells.slice(board * 9, board * 9 + 9);
  const line = winningLine(small);
  if (line) return small[line[0]] as Seat;
  return small.every((cell) => cell !== null) ? 'full' : null;
}

const wonBy = (boards: readonly SmallBoard[]) => boards.map((b) => (typeof b === 'number' ? b : null));

export class UltimateState implements GameState<UltimateMove> {
  constructor(
    readonly cells: readonly (Seat | null)[],
    readonly boards: readonly SmallBoard[],
    /** The small board the next move must go in, or null for any open board. */
    readonly active: number | null,
    readonly currentSeat: Seat,
    readonly result: GameResult | null,
    /** The last square played. */
    readonly last: number | null,
  ) {}

  /** Small boards the current player may play in. */
  get liveBoards(): number[] {
    if (this.result) return [];
    if (this.active !== null) return [this.active];
    return this.boards.flatMap((mark, board) => (mark === null ? [board] : []));
  }

  legalMoves(seat: Seat): readonly UltimateMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    const moves: UltimateMove[] = [];
    for (const board of this.liveBoards) {
      for (let cell = 0; cell < 9; cell++) if (this.cells[board * 9 + cell] === null) moves.push(ultimateMove(board, cell));
    }
    return moves;
  }

  apply(move: UltimateMove): UltimateState {
    if (this.result) throw new Error('Game is over');
    if (!this.legalMoves(this.currentSeat).includes(move)) throw new Error(`Illegal move: ${move}`);
    const square = ultimateSquare(move);
    const board = Math.floor(square / 9);
    const cell = square % 9;
    const cells = this.cells.slice();
    cells[square] = this.currentSeat;
    const boards = this.boards.slice();
    boards[board] = markOf(cells, board);

    const next: Seat = this.currentSeat === 0 ? 1 : 0;
    const line = winningLine(wonBy(boards));
    if (line) return new UltimateState(cells, boards, null, this.currentSeat, { winners: [this.currentSeat], draw: false }, square);
    if (boards.every((mark) => mark !== null)) return new UltimateState(cells, boards, null, this.currentSeat, { winners: [], draw: true }, square);
    // Sent to a board that is won or full: play in any open board.
    const active = boards[cell] === null ? cell : null;
    return new UltimateState(cells, boards, active, next, null, square);
  }
}

/** A position from its 81 squares, for tests and puzzles. */
export function ultimateFrom(cells: readonly (Seat | null)[], active: number | null, toMove: Seat): UltimateState {
  const boards = Array.from({ length: 9 }, (_, b) => markOf(cells, b));
  const open = active !== null && boards[active] === null ? active : null;
  return new UltimateState(cells, boards, open, toMove, null, null);
}

export const newUltimate = (): UltimateState => ultimateFrom(Array<Seat | null>(81).fill(null), null, 0);

/** Lines on a 3 by 3 grid, weighted by how many of them one side already holds and the other doesn't. */
function lineScore(grid: readonly (Seat | null | 'blocked')[], seat: Seat): number {
  let score = 0;
  for (const [a, b, c] of LINES) {
    let mine = 0;
    let theirs = 0;
    for (const v of [grid[a], grid[b], grid[c]]) {
      if (v === seat) mine++;
      else if (v !== null) theirs++;
    }
    if (theirs === 0) score += mine * mine;
    if (mine === 0) score -= theirs * theirs;
  }
  return score;
}

function evaluate(sharp: boolean) {
  return (generic: GameState<UltimateMove>, seat: Seat): number => {
    const state = generic as UltimateState;
    // The big board: won boards and lines of them. Full boards block lines for both sides.
    const big = state.boards.map((mark) => (mark === 'full' ? 'blocked' : mark));
    let score = lineScore(big, seat) * 30;
    state.boards.forEach((mark, board) => {
      if (typeof mark !== 'number') return;
      const worth = board === 4 ? 70 : 50;
      score += mark === seat ? worth : -worth;
    });
    if (!sharp) return score;
    // Small boards still open: two-in-a-rows and centre squares.
    state.boards.forEach((mark, board) => {
      if (mark !== null) return;
      const small = state.cells.slice(board * 9, board * 9 + 9);
      score += lineScore(small, seat) * (board === 4 ? 4 : 3);
      const centre = small[4];
      if (centre !== null && centre !== undefined) score += centre === seat ? 3 : -3;
    });
    // Handing the other player a free choice of board is costly.
    if (state.active === null && !state.result) score += state.currentSeat === seat ? 12 : -12;
    return score;
  };
}

const TIERS: Record<BotTier, SearchTier & { sharp: boolean }> = {
  easy: { depth: 1, randomMoveRate: 0.4, sharp: false },
  medium: { depth: 2, randomMoveRate: 0.1, sharp: false },
  hard: { depth: 3, randomMoveRate: 0.03, sharp: true },
  expert: { depth: 5, randomMoveRate: 0, sharp: true },
};

export const ultimateTtt: GameDefinition<UltimateMove> = {
  id: 'ultimate-ttt',
  name: 'Ultimate Tic-Tac-Toe',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: false,
  realtime: false,
  newGame: () => newUltimate(),
  createBot: (tier) => createSearchBot(TIERS[tier], evaluate(TIERS[tier].sharp)),
  encodeMove: (move) => move,
};
