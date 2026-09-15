import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import type { BotTier, Seat } from '../../core/types';
import { newShutTheBox, shutDie, shutMove, shutTheBox, ShutState, type ShutLevel, type ShutMove } from './index';

const mask = (tiles: number[]) => tiles.reduce((m, t) => m | (1 << (t - 1)), 0);

/** A seed whose first two dice add up to `total` (or don't, with `not`). */
function seedFor(test: (total: number) => boolean): number {
  for (let seed = 1; seed < 100_000; seed++) if (test(shutDie(seed, 0) + shutDie(seed, 1))) return seed;
  throw new Error('No seed');
}

/** Waiting to shut tiles after rolling `dice`. */
const rolled = (open: number[], dice: number[], scores: (number | null)[] = [null], seat: Seat = 0) =>
  new ShutState('nine', 1, mask(open), scores, seat, 'shut', dice, 2, null, null);
/** Waiting to roll. */
const toRoll = (open: number[], seed: number, scores: (number | null)[] = [null], seat: Seat = 0, level: ShutLevel = 'nine') =>
  new ShutState(level, seed, mask(open), scores, seat, 'roll', [], 0, null, null);

describe('shut the box rules', () => {
  it('starts with every tile open and two dice to roll', () => {
    const state = newShutTheBox(2, 3);
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].every((t) => state.isOpen(t))).toBe(true);
    expect(state.legalMoves(0)).toEqual(['r2']);
    expect(state.legalMoves(1)).toEqual([]);
    expect(newShutTheBox(1, 3, 'twelve').isOpen(12)).toBe(true);
  });

  it('shuts exactly the open tiles that add up to the roll', () => {
    const state = rolled([1, 2, 3, 4, 5, 6, 7, 8, 9], [3, 5]);
    const moves = [...state.legalMoves(0)].sort();
    expect(moves).toEqual(['s1.2.5', 's1.3.4', 's1.7', 's2.6', 's3.5', 's8'].sort());
    const after = state.apply(shutMove([1, 3, 4]));
    expect(after.isOpen(1) || after.isOpen(3) || after.isOpen(4)).toBe(false);
    expect(after.phase).toBe('roll');
    expect(() => state.apply('s2.5')).toThrow();
  });

  it('allows one die only once 7, 8 and 9 are shut', () => {
    expect(toRoll([1, 2, 7], 1).legalMoves(0)).toEqual(['r2']);
    const low = toRoll([1, 2, 3], 1);
    expect(low.legalMoves(0)).toEqual(['r2', 'r1']);
    expect(low.apply('r1').dice).toHaveLength(1);
    expect(toRoll([1, 12], 1, [null], 0, 'twelve').legalMoves(0)).toEqual(['r2']);
  });

  it('ends the turn when no tiles add up to the roll, scoring the open tiles', () => {
    const seed = seedFor((total) => total !== 9);
    const after = toRoll([9], seed).apply('r2');
    expect(after.last).toMatchObject({ kind: 'roll', stuck: true, score: 9 });
    expect(after.result).toEqual({ winners: [0], draw: false });
  });

  it('shutting the box wins at once', () => {
    const after = rolled([3, 5], [3, 5], [null, null]).apply(shutMove([3, 5]));
    expect(after.last).toMatchObject({ kind: 'shut', shutBox: true });
    expect(after.result).toEqual({ winners: [0], draw: false });
  });

  it('passes a fresh box to the next player, and the lowest score wins', () => {
    const seed = seedFor((total) => total !== 9);
    const first = toRoll([9], seed, [null, null], 0).apply('r2');
    expect(first.currentSeat).toBe(1);
    expect(first.open).toBe(mask([1, 2, 3, 4, 5, 6, 7, 8, 9]));
    expect(first.scores).toEqual([9, null]);
    expect(toRoll([9], seed, [10, null], 1).apply('r2').result).toEqual({ winners: [1], draw: false });
    expect(toRoll([9], seed, [9, null], 1).apply('r2').result).toEqual({ winners: [], draw: true });
  });
});

function playSolo(tier: BotTier, seed: number, level: ShutLevel = 'nine'): { state: ShutState; moves: ShutMove[] } {
  const bot = shutTheBox.createBot(tier);
  const rng = createRng(seed + 99);
  let state = shutTheBox.newGame({ players: 1, variant: level }, seed) as ShutState;
  const moves: ShutMove[] = [];
  while (!state.result) {
    const move = bot.chooseMove(state, 0, rng);
    expect(state.legalMoves(0)).toContain(move);
    moves.push(move);
    state = state.apply(move);
  }
  return { state, moves };
}

describe('shut the box bots', () => {
  it('play whole games with only legal moves, and replay exactly', () => {
    for (const tier of ['easy', 'medium', 'hard', 'expert'] as const) {
      for (const level of ['nine', 'twelve'] as const) {
        const { state, moves } = playSolo(tier, 5, level);
        const replayed = replay(shutTheBox, toMoveLog(shutTheBox, { players: 1, variant: level }, 5, moves)) as ShutState;
        expect(replayed.scores).toEqual(state.scores);
      }
    }
    const bots = (['easy', 'expert', 'hard'] as const).map((tier) => shutTheBox.createBot(tier));
    let state = shutTheBox.newGame({ players: 3 }, 8) as ShutState;
    const rng = createRng(4);
    while (!state.result) state = state.apply(bots[state.currentSeat]!.chooseMove(state, state.currentSeat, rng));
    expect(state.scores.every((s) => s !== null) || state.last?.kind === 'shut').toBe(true);
  });

  it('Nova gets a lower average score than Pip', () => {
    let pip = 0;
    let nova = 0;
    for (let seed = 1; seed <= 60; seed++) {
      pip += playSolo('easy', seed).state.scores[0]!;
      nova += playSolo('expert', seed).state.scores[0]!;
    }
    expect(nova).toBeLessThan(pip);
  });
});
