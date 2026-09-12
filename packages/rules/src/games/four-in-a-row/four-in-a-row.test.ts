import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import type { BotTier, GameState } from '../../core/types';
import { fourInARow, FourInARowState, type FourInARowMove } from './index';

const config = { players: 2 };

function drop(columns: FourInARowMove[]): GameState<FourInARowMove> {
  return columns.reduce<GameState<FourInARowMove>>((state, col) => state.apply(col), fourInARow.newGame(config, 1));
}

function playBots(tiers: [BotTier, BotTier], seed: number): GameState<FourInARowMove> {
  const rng = createRng(seed);
  const bots = tiers.map((tier) => fourInARow.createBot(tier));
  let state = fourInARow.newGame(config, seed);
  while (!state.result) {
    const seat = state.currentSeat;
    state = state.apply(bots[seat]!.chooseMove(state, seat, rng));
  }
  return state;
}

describe('four-in-a-row rules', () => {
  it('starts with 7 open columns and seat 0 to move', () => {
    const state = fourInARow.newGame(config, 1);
    expect(state.currentSeat).toBe(0);
    expect([...state.legalMoves(0)].sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('detects a vertical win', () => {
    expect(drop([0, 1, 0, 1, 0, 1, 0]).result).toEqual({ winners: [0], draw: false });
  });

  it('detects a horizontal win', () => {
    expect(drop([0, 0, 1, 1, 2, 2, 3]).result).toEqual({ winners: [0], draw: false });
  });

  it('detects a rising diagonal win', () => {
    const state = drop([0, 1, 1, 2, 6, 2, 2, 3, 6, 3, 6, 3, 3]) as FourInARowState;
    expect(state.result).toEqual({ winners: [0], draw: false });
    expect(state.winLine).toHaveLength(4);
  });

  it('closes a full column', () => {
    const state = drop([0, 0, 0, 0, 0, 0]);
    expect(state.result).toBeNull();
    expect(state.legalMoves(state.currentSeat)).not.toContain(0);
    expect(() => state.apply(0)).toThrow();
    expect(() => state.apply(7)).toThrow();
  });

  it('replays a move log', () => {
    const moves = [3, 3, 2, 4, 1];
    const replayed = replay(fourInARow, toMoveLog(fourInARow, config, 1, moves)) as FourInARowState;
    expect(replayed.board).toEqual((drop(moves) as FourInARowState).board);
  });
});

describe('four-in-a-row bots', () => {
  it('takes an immediate win', () => {
    // Seat 0 has the bottom row 0–2; column 3 wins.
    const state = drop([0, 0, 1, 1, 2, 2]);
    for (const tier of ['hard', 'expert'] as const) {
      const rng = createRng(1);
      expect(fourInARow.createBot(tier).chooseMove(state, 0, rng)).toBe(3);
    }
  });

  it('blocks an immediate loss', () => {
    // Seat 1 has the bottom row 0–2; seat 0 must block column 3.
    const state = drop([6, 0, 6, 1, 5, 2]);
    const rng = createRng(1);
    expect(fourInARow.createBot('expert').chooseMove(state, 0, rng)).toBe(3);
  });

  it('expert does not lose to easy', { timeout: 120_000 }, () => {
    for (let seed = 0; seed < 2; seed++) {
      expect(playBots(['expert', 'easy'], seed).result?.winners).not.toContain(1);
      expect(playBots(['easy', 'expert'], seed).result?.winners).not.toContain(0);
    }
  });
});
