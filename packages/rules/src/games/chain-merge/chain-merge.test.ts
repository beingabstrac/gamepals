import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { replay } from '../../core/replay';
import { isLegalMove } from '../../core/moves';
import {
  CHAIN_TIERS,
  chainFits,
  chainMerge,
  chainMove,
  chainResult,
  ChainState,
  chooseChainMove,
  CM_CHAINS,
  CM_COLS,
  CM_GOAL,
  CM_ROWS,
  newChainMerge,
  parseChain,
  touching,
} from './index';

const at = (col: number, row: number) => row * CM_COLS + col;
/** A board of 1s (twos) with some cells set. */
function board(set: Record<number, number> = {}, used = 0): ChainState {
  const grid = Array.from({ length: CM_COLS * CM_ROWS }, (_, i) => set[i] ?? ((i * 7) % 5) + 1);
  return new ChainState(grid, 0, 5, 0, used, null, null);
}

describe('2248', () => {
  it('a chain starts with two the same, then each the same or double', () => {
    expect(chainFits([1, 1])).toBe(true);
    expect(chainFits([1, 1, 1, 2, 3, 3])).toBe(true);
    expect(chainFits([1, 2])).toBe(false);
    expect(chainFits([2, 2, 1])).toBe(false);
    expect(chainFits([1, 1, 3])).toBe(false);
    expect(chainFits([4])).toBe(false);
  });

  it('a chain makes its sum rounded up to a power of two', () => {
    expect(chainResult([1, 1])).toBe(2);
    expect(chainResult([1, 1, 1])).toBe(3);
    expect(chainResult([1, 1, 2])).toBe(3);
    expect(chainResult([3, 3, 4, 5])).toBe(6);
  });

  it('neighbours touch sideways, up, down and on the corners, and not across the edge', () => {
    expect(touching(at(0, 0), at(1, 1))).toBe(true);
    expect(touching(at(4, 0), at(0, 1))).toBe(false);
    expect(touching(at(0, 0), at(2, 0))).toBe(false);
    expect(parseChain('p1.1')).toBeNull();
    expect(parseChain('p1')).toBeNull();
  });

  it('a chain leaves one tile at its end, the rest drop down and new ones fall in', () => {
    const s = board({ [at(2, 6)]: 3, [at(2, 5)]: 3, [at(3, 4)]: 4 });
    const move = chainMove([at(2, 6), at(2, 5), at(3, 4)]);
    expect(s.allows(move)).toBe(true);
    const next = s.apply(move);
    // 8 + 8 + 16 = 32 lands where the chain ended, then falls into the gap below it.
    expect(next.last!.made).toBe(5);
    expect(next.grid[at(3, 4)] === 5 || next.grid[at(3, 5)] === 5 || next.grid[at(3, 6)] === 5).toBe(true);
    expect(next.score).toBe(32);
    expect(next.used).toBe(1);
    expect(next.grid.every((p) => p >= 1)).toBe(true);
  });

  it('a chain that breaks the rules, jumps a gap or doubles back is refused', () => {
    const s = board({ [at(0, 0)]: 2, [at(1, 0)]: 2, [at(3, 0)]: 2, [at(1, 1)]: 5 });
    expect(s.allows(chainMove([at(0, 0), at(1, 0), at(3, 0)]))).toBe(false);
    expect(s.allows(chainMove([at(0, 0), at(1, 0), at(1, 1)]))).toBe(false);
    expect(() => s.apply('p0.1.0')).toThrow();
    expect(s.allows(chainMove([at(0, 0), at(1, 0)]))).toBe(true);
  });

  it('every move the bots are offered is one the rules take, and the referee agrees', () => {
    const rng = createRng(3);
    let s = newChainMerge(3);
    const log: string[] = [];
    while (!s.result) {
      for (const m of s.legalMoves(0)) expect(isLegalMove(s, m)).toBe(true);
      const m = chooseChainMove(s, CHAIN_TIERS.medium, rng);
      log.push(m);
      s = s.apply(m);
    }
    expect(replay(chainMerge, { gameId: 'chain-merge', seed: 3, config: { players: 1 }, moves: log }).result).toEqual(s.result);
  });

  it('making the goal wins; running out of chains ends it', () => {
    const win = board({ [at(0, 6)]: CM_GOAL - 1, [at(1, 6)]: CM_GOAL - 1 }).apply(chainMove([at(0, 6), at(1, 6)]));
    expect(win.result).toEqual({ winners: [0], draw: false });
    const last = board({}, CM_CHAINS - 1);
    const pair = last.legalMoves(0)[0]!;
    expect(last.apply(pair).result).toEqual({ winners: [], draw: false });
  });

  it('the greedy bot gets further than the random one', { timeout: 30_000 }, () => {
    const play = (tier: keyof typeof CHAIN_TIERS) => {
      let total = 0;
      for (let seed = 1; seed <= 10; seed++) {
        const rng = createRng(seed);
        let s = newChainMerge(seed);
        while (!s.result) s = s.apply(chooseChainMove(s, CHAIN_TIERS[tier], rng));
        total += s.best;
      }
      return total;
    };
    expect(play('medium')).toBeGreaterThan(play('easy'));
  });

  it('invariant, every chain of bot play: every cell holds a number, the score only climbs, the best tile never shrinks', () => {
    const rng = createRng(9);
    let s = newChainMerge(9);
    while (!s.result) {
      const next = s.apply(chooseChainMove(s, CHAIN_TIERS.hard, rng));
      expect(next.grid.length).toBe(CM_COLS * CM_ROWS);
      expect(next.grid.every((p) => Number.isInteger(p) && p >= 1)).toBe(true);
      expect(next.score).toBeGreaterThan(s.score);
      expect(next.best).toBeGreaterThanOrEqual(s.best);
      s = next;
    }
  });
});
