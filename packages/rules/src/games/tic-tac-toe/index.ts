import { createSearchBot, type SearchTier } from '../../core/bots';
import type { BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/** Board cell: the seat that marked it (0 = X, 1 = O) or empty. */
export type Cell = Seat | null;
/** Cell index 0–8, row by row. */
export type TicTacToeMove = number;

export const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function winningLine(board: readonly Cell[]): readonly [number, number, number] | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    const v = board[a];
    if (v !== null && v !== undefined && v === board[b] && v === board[c]) return line;
  }
  return null;
}

function computeResult(board: readonly Cell[]): GameResult | null {
  const line = winningLine(board);
  if (line) return { winners: [board[line[0]] as Seat], draw: false };
  return board.every((cell) => cell !== null) ? { winners: [], draw: true } : null;
}

export class TicTacToeState implements GameState<TicTacToeMove> {
  constructor(
    readonly board: readonly Cell[],
    readonly currentSeat: Seat,
    readonly result: GameResult | null,
  ) {}

  legalMoves(seat: Seat): readonly TicTacToeMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    const moves: TicTacToeMove[] = [];
    this.board.forEach((cell, index) => {
      if (cell === null) moves.push(index);
    });
    return moves;
  }

  apply(move: TicTacToeMove): TicTacToeState {
    if (this.result) throw new Error('Game is over');
    if (!Number.isInteger(move) || move < 0 || move > 8 || this.board[move] !== null) {
      throw new Error(`Illegal move: ${move}`);
    }
    const board = this.board.slice();
    board[move] = this.currentSeat;
    return new TicTacToeState(board, this.currentSeat === 0 ? 1 : 0, computeResult(board));
  }
}

/** Open lines weighted by how many marks they already hold. */
function evaluate(state: GameState<TicTacToeMove>, seat: Seat): number {
  const { board } = state as TicTacToeState;
  let score = 0;
  for (const line of LINES) {
    let mine = 0;
    let theirs = 0;
    for (const index of line) {
      const cell = board[index];
      if (cell === seat) mine++;
      else if (cell !== null) theirs++;
    }
    if (theirs === 0) score += mine * mine;
    if (mine === 0) score -= theirs * theirs;
  }
  return score;
}

const TIERS: Record<BotTier, SearchTier> = {
  easy: { depth: 1, randomMoveRate: 0.45 },
  medium: { depth: 2, randomMoveRate: 0.15 },
  hard: { depth: 4, randomMoveRate: 0.05 },
  expert: { depth: 9, randomMoveRate: 0 },
};

export const ticTacToe: GameDefinition<TicTacToeMove> = {
  id: 'tic-tac-toe',
  name: 'Tic-Tac-Toe',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: false,
  realtime: false,
  newGame: () => new TicTacToeState(Array<Cell>(9).fill(null), 0, null),
  createBot: (tier) => createSearchBot(TIERS[tier], evaluate),
  encodeMove: (move) => String(move),
};
