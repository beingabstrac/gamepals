import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import type { BotTier, Seat } from '../../core/types';
import { newUltimate, ultimateFrom, ultimateMove, ultimateTtt, UltimateState, type UltimateMove } from './index';

const X: Seat = 0;
const O: Seat = 1;

/** 81 empty squares with some filled: `marks` maps square → seat. */
function cells(marks: Record<number, Seat>): (Seat | null)[] {
  const list = Array<Seat | null>(81).fill(null);
  for (const [square, seat] of Object.entries(marks)) list[Number(square)] = seat;
  return list;
}

/** Marks that win small board `board` for `seat` with its top row. */
const topRow = (board: number, seat: Seat): Record<number, Seat> => ({ [board * 9]: seat, [board * 9 + 1]: seat, [board * 9 + 2]: seat });

/** A full small board with no winner: X O X / X O O / O X X. */
const fullBoard = (board: number): Record<number, Seat> =>
  Object.fromEntries([X, O, X, X, O, O, O, X, X].map((seat, cell) => [board * 9 + cell, seat]));

describe('ultimate tic-tac-toe rules', () => {
  it('X starts and may play any of the 81 squares', () => {
    const state = newUltimate();
    expect(state.currentSeat).toBe(0);
    expect(state.legalMoves(0)).toHaveLength(81);
    expect(state.legalMoves(1)).toEqual([]);
  });

  it('the square you play sends the other player to the matching board', () => {
    // Top-right square (2) of the centre board (4) sends O to the top-right board.
    const after = newUltimate().apply(ultimateMove(4, 2));
    expect(after.active).toBe(2);
    expect(after.currentSeat).toBe(1);
    const moves = after.legalMoves(1);
    expect(moves).toHaveLength(9);
    for (const move of moves) expect(Math.floor(Number(move.slice(1)) / 9)).toBe(2);
    expect(() => after.apply(ultimateMove(5, 0))).toThrow();
  });

  it('three in a row wins a small board, and its empty squares close', () => {
    const state = ultimateFrom(cells({ 0: X, 1: X, 40: O, 41: O }), 0, X);
    const after = state.apply(ultimateMove(0, 2));
    expect(after.boards[0]).toBe(X);
    // Sent to board 2 (open), and board 0 can't be played any more.
    expect(after.active).toBe(2);
    expect(ultimateFrom(after.cells, null, O).legalMoves(O).some((m) => Number(m.slice(1)) < 9)).toBe(false);
  });

  it('being sent to a won board frees you to play in any open board', () => {
    const state = ultimateFrom(cells({ ...topRow(0, O) }), 4, X);
    const after = state.apply(ultimateMove(4, 0));
    expect(after.active).toBeNull();
    // 81 squares, minus the won board, minus the one just played.
    expect(after.legalMoves(O)).toHaveLength(81 - 9 - 1);
  });

  it('being sent to a full board frees you too', () => {
    const state = ultimateFrom(cells({ ...fullBoard(0) }), 4, X);
    expect(state.boards[0]).toBe('full');
    const after = state.apply(ultimateMove(4, 0));
    expect(after.active).toBeNull();
    expect(after.legalMoves(O)).toHaveLength(81 - 9 - 1);
  });

  it('three small boards in a row wins the game', () => {
    const state = ultimateFrom(cells({ ...topRow(0, X), ...topRow(1, X), 18: X, 19: X, 40: O, 50: O }), 2, X);
    const after = state.apply(ultimateMove(2, 2));
    expect(after.result).toEqual({ winners: [X], draw: false });
    expect(after.legalMoves(O)).toEqual([]);
    expect(() => after.apply(ultimateMove(5, 5))).toThrow();
  });

  it('a big board with every small board closed and no line is a draw', () => {
    // Big board: X O X / X O O / O X X, with the last X board still to win.
    const pattern: Seat[] = [X, O, X, X, O, O, O, X];
    const marks: Record<number, Seat> = {};
    pattern.forEach((seat, board) => Object.assign(marks, topRow(board, seat)));
    const state = ultimateFrom(cells({ ...marks, 72: X, 73: X }), 8, X);
    const after = state.apply(ultimateMove(8, 2));
    expect(after.boards[8]).toBe(X);
    expect(after.result).toEqual({ winners: [], draw: true });
  });

  it('rejects squares already taken and unknown moves', () => {
    const after = newUltimate().apply(ultimateMove(0, 0));
    expect(() => after.apply(ultimateMove(0, 0))).toThrow();
    expect(() => after.apply('x9' as UltimateMove)).toThrow();
  });
});

function playGame(tiers: [BotTier, BotTier], seed: number): { state: UltimateState; moves: UltimateMove[] } {
  const bots = tiers.map((tier) => ultimateTtt.createBot(tier));
  const rng = createRng(seed);
  let state = ultimateTtt.newGame({ players: 2 }, seed) as UltimateState;
  const moves: UltimateMove[] = [];
  while (!state.result) {
    const move = bots[state.currentSeat]!.chooseMove(state, state.currentSeat, rng);
    expect(state.legalMoves(state.currentSeat)).toContain(move);
    moves.push(move);
    state = state.apply(move);
  }
  return { state, moves };
}

describe('ultimate tic-tac-toe bots', () => {
  it('play whole games with only legal moves, and replay exactly', () => {
    for (const [seed, tiers] of [[1, ['easy', 'medium']], [2, ['hard', 'easy']], [3, ['medium', 'hard']]] as const) {
      const { state, moves } = playGame([tiers[0], tiers[1]], seed);
      const replayed = replay(ultimateTtt, toMoveLog(ultimateTtt, { players: 2 }, seed, moves)) as UltimateState;
      expect(replayed.cells).toEqual(state.cells);
      expect(replayed.result).toEqual(state.result);
    }
  });

  it('Nova beats Pip', () => {
    let wins = 0;
    for (let game = 0; game < 4; game++) {
      const expertSeat = game % 2;
      const { state } = playGame(expertSeat === 0 ? ['expert', 'easy'] : ['easy', 'expert'], 10 + game);
      if (state.result?.winners[0] === expertSeat) wins++;
    }
    expect(wins).toBeGreaterThan(2);
  });
});

/**
 * A mark is put down and never taken back or changed, and a small board that has been won stays
 * won. Either of those going wrong would rewrite a game already played.
 */
describe('ultimate tic-tac-toe permanence', () => {
  it('never changes a cell or un-wins a board', () => {
    for (let seed = 0; seed < 24; seed++) {
      const rng = createRng(seed);
      let state = newUltimate();
      for (let move = 0; move < 100 && !state.result; move++) {
        const cells = state.cells;
        const boards = state.boards;
        const moves = state.legalMoves(state.currentSeat);
        if (moves.length === 0) break;
        state = state.apply(rng.pick(moves));
        cells.forEach((mark, i) => {
          if (mark !== null) expect(state.cells[i], `seed ${seed}, move ${move}, cell ${i}`).toBe(mark);
        });
        boards.forEach((won, i) => {
          if (won !== null) expect(state.boards[i], `seed ${seed}, move ${move}, board ${i}`).toBe(won);
        });
      }
    }
  });
});
