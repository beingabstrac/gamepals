import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import type { BotTier } from '../../core/types';
import { mancala, MancalaState, newMancala, oppositeHouse, sowMove, storeOf, type MancalaMove } from './index';

/** A board from 14 pit counts, seat to move. */
const at = (pits: number[], seat: 0 | 1 = 0) => new MancalaState(pits, seat, null, null);

describe('mancala setup', () => {
  it('starts with 4 seeds in each of the 12 houses and empty stores', () => {
    const state = newMancala('four');
    expect(state.pits.reduce((a, b) => a + b, 0)).toBe(48);
    expect(state.store(0)).toBe(0);
    expect(state.store(1)).toBe(0);
    expect(state.legalMoves(0)).toHaveLength(6);
    expect(state.legalMoves(1)).toEqual([]);
  });
});

describe('mancala rules', () => {
  it('sows one seed per pit counter-clockwise, into your store', () => {
    const after = newMancala('four').apply(sowMove(3));
    expect(after.pits.slice(0, 7)).toEqual([4, 4, 4, 0, 5, 5, 1]);
    expect(after.pits[7]).toBe(5);
    expect(after.last?.path).toEqual([4, 5, 6, 7]);
  });

  it("skips the other player's store", () => {
    // 12 seeds from house 5 go round the board; seat 1's store (13) is skipped.
    const pits = [0, 0, 0, 0, 0, 12, 0, 0, 0, 0, 0, 0, 1, 0];
    const after = at(pits).apply(sowMove(5));
    expect(after.pits[13]).toBe(0);
    expect(after.last?.path).not.toContain(13);
    expect(after.pits.reduce((a, b) => a + b, 0)).toBe(13);
  });

  it('the last seed in your store gives another turn', () => {
    // House 2 has 4 seeds: 3, 4, 5, store.
    const after = newMancala('four').apply(sowMove(2));
    expect(after.last?.extraTurn).toBe(true);
    expect(after.currentSeat).toBe(0);
  });

  it('captures when the last seed lands in your own empty house with seeds across', () => {
    // House 1 has 1 seed; house 2 is empty; across from 2 is house 10 with 5 seeds.
    const pits = [0, 1, 0, 0, 0, 3, 0, 4, 4, 4, 5, 4, 4, 0];
    const after = at(pits).apply(sowMove(1));
    expect(oppositeHouse(2)).toBe(10);
    expect(after.last?.capture).toEqual({ from: 10, seeds: 6 });
    expect(after.pits[2]).toBe(0);
    expect(after.pits[10]).toBe(0);
    expect(after.store(0)).toBe(6);
    expect(after.currentSeat).toBe(1);
  });

  it('no capture when the house across is empty', () => {
    const pits = [0, 1, 0, 0, 0, 3, 0, 4, 4, 4, 0, 4, 4, 0];
    const after = at(pits).apply(sowMove(1));
    expect(after.last?.capture).toBeNull();
    expect(after.pits[2]).toBe(1);
  });

  it("when one side is empty, the other side's seeds go to their owner's store and the game ends", () => {
    // Seat 0's last seed goes into its store, emptying its side; seat 1 keeps 7 seeds.
    const pits = [0, 0, 0, 0, 0, 1, 10, 3, 0, 0, 4, 0, 0, 8];
    const after = at(pits).apply(sowMove(5));
    expect(after.result).not.toBeNull();
    expect(after.store(0)).toBe(11);
    expect(after.store(1)).toBe(15);
    expect(after.result).toEqual({ winners: [1], draw: false });
    expect(after.last?.swept).toEqual([0, 7]);
  });

  it('equal stores at the end are a draw', () => {
    const pits = [0, 0, 0, 0, 0, 1, 10, 3, 0, 0, 0, 0, 0, 8];
    const after = at(pits).apply(sowMove(5));
    expect(after.store(0)).toBe(11);
    expect(after.store(1)).toBe(11);
    expect(after.result).toEqual({ winners: [], draw: true });
  });

  it("can't play an empty house or the other player's house", () => {
    const state = at([0, 1, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0]);
    expect(() => state.apply(sowMove(0))).toThrow();
    expect(() => state.apply(sowMove(8))).toThrow();
    expect(() => state.apply(sowMove(storeOf(0)))).toThrow();
  });
});

describe('mancala bots', () => {
  function playBots(tiers: [BotTier, BotTier], seed: number) {
    const rng = createRng(seed);
    const bots = tiers.map((tier) => mancala.createBot(tier));
    let state = mancala.newGame({ players: 2, variant: 'four' }, seed) as MancalaState;
    const moves: MancalaMove[] = [];
    while (!state.result && moves.length < 400) {
      const move = bots[state.currentSeat]!.chooseMove(state, state.currentSeat, rng);
      expect(state.legalMoves(state.currentSeat)).toContain(move);
      moves.push(move);
      state = state.apply(move);
    }
    return { state, moves };
  }

  it('play legal moves to the end and replay exactly', () => {
    const { state, moves } = playBots(['easy', 'medium'], 3);
    expect(state.result).not.toBeNull();
    expect(state.store(0) + state.store(1)).toBe(48);
    const replayed = replay(mancala, toMoveLog(mancala, { players: 2, variant: 'four' }, 3, moves)) as MancalaState;
    expect(replayed.pits).toEqual(state.pits);
  });

  it('Zed beats Pip most of the time', { timeout: 120_000 }, () => {
    let zedWins = 0;
    for (let seed = 0; seed < 10; seed++) {
      const zed = seed % 2;
      const tiers: [BotTier, BotTier] = zed === 0 ? ['hard', 'easy'] : ['easy', 'hard'];
      if (playBots(tiers, seed).state.result?.winners.includes(zed)) zedWins++;
    }
    expect(zedWins).toBeGreaterThanOrEqual(8);
  });
});

describe('mancala conservation', () => {
  /**
   * Seeds are never made and never destroyed: sowing moves them, capturing moves them, and the
   * sweep at the end moves them. So the fourteen pits always hold the same total they started
   * with. A gallery picture of a finished board showed six seeds where there should have been
   * forty-eight, which is either the rules losing them or the board drawing them wrong, and this
   * says which.
   */
  it('never loses a seed, from the deal to the last move', () => {
    for (const level of ['three', 'four', 'six'] as const) {
      const start = newMancala(level);
      const total = start.pits.reduce((a, b) => a + b, 0);
      for (let seed = 0; seed < 12; seed++) {
        const rng = createRng(seed);
        let state: MancalaState = start;
        let guard = 0;
        while (!state.result && guard++ < 400) {
          const moves = state.legalMoves(state.currentSeat);
          if (moves.length === 0) break;
          state = state.apply(rng.pick(moves));
          expect(state.pits.reduce((a, b) => a + b, 0), `${level}, seed ${seed}, move ${guard}`).toBe(total);
        }
        expect(state.pits.reduce((a, b) => a + b, 0), `${level}, seed ${seed}, at the end`).toBe(total);
      }
    }
  });
});
