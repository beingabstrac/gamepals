import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import type { BotTier } from '../../core/types';
import { CheckerPiece as P, checkers, checkersFrom, CheckersState, newCheckers, NO_PROGRESS_PLIES, type CheckersMove } from './index';

const sq = (r: number, c: number) => r * 8 + c;
/** A board with just these pieces. */
function board(pieces: [number, number, number][]): number[] {
  const b = Array<number>(64).fill(P.empty);
  for (const [r, c, piece] of pieces) b[sq(r, c)] = piece;
  return b;
}

describe('checkers setup', () => {
  it('starts with 12 pieces each on dark squares, black to move with 7 moves', () => {
    const state = newCheckers();
    expect(state.board.filter((p) => p === P.blackMan)).toHaveLength(12);
    expect(state.board.filter((p) => p === P.redMan)).toHaveLength(12);
    state.board.forEach((p, i) => {
      if (p) expect((Math.floor(i / 8) + (i % 8)) % 2).toBe(1);
    });
    expect(state.legalMoves(0)).toHaveLength(7);
    expect(state.legalMoves(1)).toEqual([]);
  });
});

describe('checkers rules', () => {
  it('captures are required when available', () => {
    // Black man at (5,2) can jump the red man at (4,3); another black man could just step.
    const state = checkersFrom(board([[5, 2, P.blackMan], [4, 3, P.redMan], [6, 7, P.blackMan], [0, 1, P.redMan]]), 0);
    expect(state.legalMoves(0)).toEqual([`${sq(5, 2)}-${sq(3, 4)}`]);
    expect(state.movablePieces()).toEqual([sq(5, 2)]);
  });

  it('a jump must continue while the same piece can jump again', () => {
    const state = checkersFrom(board([[7, 0, P.blackMan], [6, 1, P.redMan], [4, 3, P.redMan], [0, 7, P.redMan]]), 0);
    const move = `${sq(7, 0)}-${sq(5, 2)}-${sq(3, 4)}`;
    expect(state.legalMoves(0)).toEqual([move]);
    const after = state.apply(move);
    expect(after.board[sq(6, 1)]).toBe(P.empty);
    expect(after.board[sq(4, 3)]).toBe(P.empty);
    expect(after.last?.captured).toHaveLength(2);
  });

  it('a man crowned in the middle of a jump stops there', () => {
    // Jumping into row 0 crowns; a further jump back down would need a king, so the move ends.
    const state = checkersFrom(board([[2, 1, P.blackMan], [1, 2, P.redMan], [1, 4, P.redMan], [7, 0, P.redMan]]), 0);
    const move = `${sq(2, 1)}-${sq(0, 3)}`;
    expect(state.legalMoves(0)).toEqual([move]);
    const after = state.apply(move);
    expect(after.board[sq(0, 3)]).toBe(P.blackKing);
    expect(after.last?.crowned).toBe(true);
    expect(after.currentSeat).toBe(1);
  });

  it('men only move forward; kings move both ways', () => {
    const man = checkersFrom(board([[4, 3, P.blackMan], [0, 1, P.redMan]]), 0);
    expect(man.legalMoves(0).sort()).toEqual([`${sq(4, 3)}-${sq(3, 2)}`, `${sq(4, 3)}-${sq(3, 4)}`].sort());
    const king = checkersFrom(board([[4, 3, P.blackKing], [0, 1, P.redMan]]), 0);
    expect(king.legalMoves(0)).toHaveLength(4);
  });

  it('taking the last piece wins', () => {
    const state = checkersFrom(board([[5, 2, P.blackMan], [4, 3, P.redMan]]), 0);
    expect(state.apply(`${sq(5, 2)}-${sq(3, 4)}`).result).toEqual({ winners: [0], draw: false });
  });

  it('leaving the other side with no move wins', () => {
    // Red's only man is stuck at (7,0)... red men move down, so a red man on row 7 can never move.
    const state = checkersFrom(board([[5, 4, P.blackMan], [7, 0, P.redMan]]), 0);
    const after = state.apply(`${sq(5, 4)}-${sq(4, 3)}`);
    expect(after.result).toEqual({ winners: [0], draw: false });
  });

  it('40 moves each without a capture or a man moving is a draw', () => {
    // 79 quiet plies already played: the next king move (no capture, no man) makes 80.
    const kings = board([[7, 0, P.blackKing], [0, 7, P.redKing], [0, 1, P.redMan]]);
    const almost = new CheckersState(kings, 0, NO_PROGRESS_PLIES - 1, new Map(), null, null);
    expect(almost.apply(`${sq(7, 0)}-${sq(6, 1)}`).result).toEqual({ winners: [], draw: true });
    // A man moving resets the count.
    const reset = new CheckersState(board([[5, 2, P.blackMan], [0, 7, P.redKing]]), 0, NO_PROGRESS_PLIES - 1, new Map(), null, null);
    const after = reset.apply(`${sq(5, 2)}-${sq(4, 1)}`);
    expect(after.result).toBeNull();
    expect(after.quiet).toBe(0);
  });

  it('the same position three times is a draw', () => {
    let state: CheckersState = checkersFrom(board([[7, 0, P.blackKing], [0, 7, P.redKing]]), 0);
    const shuffle = [`${sq(7, 0)}-${sq(6, 1)}`, `${sq(0, 7)}-${sq(1, 6)}`, `${sq(6, 1)}-${sq(7, 0)}`, `${sq(1, 6)}-${sq(0, 7)}`];
    for (let i = 0; i < 8 && !state.result; i++) state = state.apply(shuffle[i % 4]!);
    expect(state.result).toEqual({ winners: [], draw: true });
  });

  it('rejects illegal and out-of-turn moves', () => {
    const state = newCheckers();
    expect(() => state.apply(`${sq(5, 0)}-${sq(3, 2)}`)).toThrow();
    expect(() => state.apply(`${sq(2, 1)}-${sq(3, 0)}`)).toThrow();
  });
});

describe('checkers bots', () => {
  function playBots(tiers: [BotTier, BotTier], seed: number, maxPlies = 200) {
    const rng = createRng(seed);
    const bots = tiers.map((tier) => checkers.createBot(tier));
    let state = checkers.newGame({ players: 2 }, seed) as CheckersState;
    const moves: CheckersMove[] = [];
    while (!state.result && moves.length < maxPlies) {
      const move = bots[state.currentSeat]!.chooseMove(state, state.currentSeat, rng);
      expect(state.legalMoves(state.currentSeat)).toContain(move);
      moves.push(move);
      state = state.apply(move);
    }
    return { state, moves };
  }

  it('play legal moves and replay exactly', () => {
    const { state, moves } = playBots(['easy', 'medium'], 3, 80);
    const replayed = replay(checkers, toMoveLog(checkers, { players: 2 }, 3, moves)) as CheckersState;
    expect(replayed.board).toEqual(state.board);
  });

  it('Bo (4 ahead) beats Pip (2 ahead, careless) most of the time', { timeout: 120_000 }, () => {
    let boWins = 0;
    let boLosses = 0;
    for (let seed = 0; seed < 8; seed++) {
      const bo = seed % 2;
      const tiers: [BotTier, BotTier] = bo === 0 ? ['medium', 'easy'] : ['easy', 'medium'];
      const result = playBots(tiers, seed).state.result;
      if (result?.winners.includes(bo)) boWins++;
      else if (result && !result.draw) boLosses++;
    }
    expect(boWins).toBeGreaterThan(boLosses);
    expect(boWins).toBeGreaterThanOrEqual(5);
  });
});
