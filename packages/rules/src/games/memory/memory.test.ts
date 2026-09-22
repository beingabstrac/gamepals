import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import type { BotTier } from '../../core/types';
import { flipMove, memory, MemoryState, newMemory, type MemoryMove } from './index';

/** Indices of the two cards with this picture. */
const pairOf = (state: MemoryState, symbol: number) => state.symbols.flatMap((s, i) => (s === symbol ? [i] : []));
/** Two cards that don't match. */
function missPair(state: MemoryState): [number, number] {
  const a = 0;
  const b = state.symbols.findIndex((s) => s !== state.symbols[a]);
  return [a, b];
}

describe('memory deal', () => {
  it('has every picture exactly twice, from the seed', () => {
    for (const size of ['small', 'medium', 'large'] as const) {
      const state = newMemory(2, 7, size);
      const counts = new Map<number, number>();
      state.symbols.forEach((s) => counts.set(s, (counts.get(s) ?? 0) + 1));
      expect([...counts.values()].every((n) => n === 2)).toBe(true);
      expect(state.symbols.length).toBe({ small: 12, medium: 20, large: 30 }[size]);
    }
    expect(newMemory(2, 5, 'medium').symbols).toEqual(newMemory(2, 5, 'medium').symbols);
  });
});

describe('memory rules', () => {
  it('a match keeps the pair and the turn', () => {
    const state = newMemory(2, 3, 'small');
    const [a, b] = pairOf(state, 0) as [number, number];
    const after = state.apply(flipMove(a)).apply(flipMove(b));
    expect(after.owner[a]).toBe(0);
    expect(after.owner[b]).toBe(0);
    expect(after.scores).toEqual([1, 0]);
    expect(after.currentSeat).toBe(0);
    expect(after.last).toEqual({ seat: 0, cards: [a, b], match: true });
  });

  it('a miss flips back and passes the turn', () => {
    const state = newMemory(3, 3, 'small');
    const [a, b] = missPair(state);
    const after = state.apply(flipMove(a)).apply(flipMove(b));
    expect(after.owner.every((o) => o < 0)).toBe(true);
    expect(after.open).toEqual([]);
    expect(after.currentSeat).toBe(1);
    expect(after.turns).toBe(1);
  });

  it("can't flip the same card twice or a taken card", () => {
    const state = newMemory(2, 3, 'small');
    const [a, b] = pairOf(state, 1) as [number, number];
    expect(() => state.apply(flipMove(a)).apply(flipMove(a))).toThrow();
    const taken = state.apply(flipMove(a)).apply(flipMove(b));
    expect(taken.legalMoves(0)).not.toContain(flipMove(a));
    expect(() => taken.apply(flipMove(b))).toThrow();
    expect(state.legalMoves(1)).toEqual([]);
  });

  it('most pairs wins, and a full tie is a draw', () => {
    const play = (state: MemoryState, symbols: number[]) =>
      symbols.reduce((s, symbol) => {
        const [a, b] = pairOf(s, symbol) as [number, number];
        return s.apply(flipMove(a)).apply(flipMove(b));
      }, state);
    // Seat 0 takes every pair.
    const sweep = play(newMemory(2, 9, 'small'), [0, 1, 2, 3, 4, 5]);
    expect(sweep.result).toEqual({ winners: [0], draw: false });

    // Seat 0 takes three pairs, misses, seat 1 takes the other three.
    let state = play(newMemory(2, 9, 'small'), [0, 1, 2]);
    const left = state.symbols.map((_, i) => i).filter((i) => state.owner[i]! < 0);
    const miss = left.find((i) => state.symbols[i] !== state.symbols[left[0]!])!;
    state = state.apply(flipMove(left[0]!)).apply(flipMove(miss));
    expect(state.currentSeat).toBe(1);
    state = play(state, [3, 4, 5]);
    expect(state.result).toEqual({ winners: [], draw: true });
  });

  it('solo play counts turns and always ends in a win', () => {
    let state = newMemory(1, 2, 'small');
    const [a, b] = missPair(state);
    state = state.apply(flipMove(a)).apply(flipMove(b));
    expect(state.currentSeat).toBe(0);
    for (let symbol = 0; symbol < 6; symbol++) {
      const [x, y] = pairOf(state, symbol) as [number, number];
      state = state.apply(flipMove(x)).apply(flipMove(y));
    }
    expect(state.turns).toBe(7);
    expect(state.result).toEqual({ winners: [0], draw: false });
  });
});

describe('memory bots', () => {
  function playBots(tiers: BotTier[], seed: number) {
    const rng = createRng(seed);
    const bots = tiers.map((tier) => memory.createBot(tier));
    let state = memory.newGame({ players: tiers.length, variant: 'medium' }, seed) as MemoryState;
    const moves: MemoryMove[] = [];
    while (!state.result) {
      const move = bots[state.currentSeat]!.chooseMove(state, state.currentSeat, rng);
      expect(state.legalMoves(state.currentSeat)).toContain(move);
      moves.push(move);
      state = state.apply(move);
    }
    return { state, moves };
  }

  it('play legal moves only and replay exactly', () => {
    const { state, moves } = playBots(['easy', 'medium', 'hard', 'expert'], 12);
    const replayed = replay(memory, toMoveLog(memory, { players: 4, variant: 'medium' }, 12, moves)) as MemoryState;
    expect(replayed.scores).toEqual(state.scores);
    expect(replayed.result).toEqual(state.result);
  });

  it('Nova (remembers everything) beats Pip (remembers 2 flips) most of the time', () => {
    let novaWins = 0;
    const games = 40;
    for (let seed = 0; seed < games; seed++) {
      const nova = seed % 2;
      const tiers: BotTier[] = nova === 0 ? ['expert', 'easy'] : ['easy', 'expert'];
      if (playBots(tiers, seed).state.result?.winners.includes(nova)) novaWins++;
    }
    expect(novaWins).toBeGreaterThan(games * 0.7);
  });
});

/**
 * Every picture is on exactly two cards, and a card that has been won stays won by the player who
 * won it. A symbol appearing an odd number of times would make the board unwinnable.
 */
describe('memory invariants', () => {
  it('pairs every symbol, and never takes a card back', () => {
    for (const size of ['small', 'medium', 'large'] as const) {
      for (let seed = 0; seed < 6; seed++) {
        const rng = createRng(seed);
        let state = newMemory(2, seed, size);
        const counts = new Map<number, number>();
        for (const symbol of state.symbols) counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
        for (const [symbol, seen] of counts) expect(seen, `size ${size}, seed ${seed}, symbol ${symbol}`).toBe(2);
        for (let move = 0; move < 300 && !state.result; move++) {
          const owner = [...state.owner];
          const moves = state.legalMoves(state.currentSeat);
          if (moves.length === 0) break;
          state = state.apply(rng.pick(moves));
          owner.forEach((who, card) => {
            if (who >= 0) expect(state.owner[card], `size ${size}, seed ${seed}, move ${move}, card ${card}`).toBe(who);
          });
        }
      }
    }
  });
});
