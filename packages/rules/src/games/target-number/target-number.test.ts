import { describe, expect, it } from 'vitest';
import { BOT_TIERS } from '../../core/types';
import { createRng } from '../../core/rng';
import { replay, toMoveLog } from '../../core/replay';
import {
  applyOp,
  combine,
  COUNT,
  LARGE,
  newTargetNumber,
  SMALL,
  solve,
  STEP_BACK,
  TARGET_HIGH,
  TARGET_LOW,
  targetNumberGame,
  TargetState,
  type TargetMove,
} from './index';

describe('the four operations', () => {
  it('never makes a fraction or anything below zero', () => {
    expect(applyOp(6, 3, '+')).toBe(9);
    expect(applyOp(6, 3, '*')).toBe(18);
    expect(applyOp(6, 3, '-')).toBe(3);
    expect(applyOp(6, 3, '/')).toBe(2);
    // The ones the rules refuse come back as nothing.
    expect(applyOp(3, 6, '-')).toBe(0);
    expect(applyOp(7, 2, '/')).toBe(0);
    expect(applyOp(5, 5, '-')).toBe(0);
    expect(applyOp(5, 0, '/')).toBe(0);
  });
});

describe('a round', () => {
  it('draws six numbers and a three-digit target that can really be reached', { timeout: 120_000 }, () => {
    for (let seed = 0; seed < 20; seed++) {
      const state = newTargetNumber(seed);
      expect(state.drawn).toHaveLength(COUNT);
      expect(state.target).toBeGreaterThanOrEqual(TARGET_LOW);
      expect(state.target).toBeLessThanOrEqual(TARGET_HIGH);
      for (const number of state.drawn) {
        expect(SMALL.includes(number) || LARGE.includes(number), `${number} is not in the bag`).toBe(true);
      }
      // No more than one of each large number, and no more than two of each small one.
      for (const large of LARGE) expect(state.drawn.filter((n) => n === large).length).toBeLessThanOrEqual(1);
      for (const small of SMALL) expect(state.drawn.filter((n) => n === small).length).toBeLessThanOrEqual(2);
      // Ask a solver that does not know what the generator claimed.
      expect(solve(state.drawn, state.target).exact, `seed ${seed} cannot be done`).toBe(true);
    }
  });

  it('gives the same round for the same seed', () => {
    expect(newTargetNumber(7).drawn).toEqual(newTargetNumber(7).drawn);
    expect(newTargetNumber(7).target).toBe(newTargetNumber(7).target);
    const seen = new Set([1, 2, 3, 4, 5].map((seed) => `${newTargetNumber(seed).target}`));
    expect(seen.size).toBeGreaterThan(3);
  });
});

describe('working it out', () => {
  it('combines two numbers into one, and refuses what the rules do not allow', () => {
    const state = new TargetState(100, [6, 3], [6, 3], [], 6, 0, 0, null);
    const after = state.apply(combine(0, '+', 1));
    expect(after.pool).toEqual([9]);
    expect(after.steps).toEqual([{ a: 6, op: '+', b: 3, out: 9 }]);
    // Seven divided by two is not a whole number, and a number cannot be combined with itself.
    const odd = new TargetState(100, [7, 2], [7, 2], [], 7, 0, 0, null);
    expect(() => odd.apply(combine(0, '/', 1))).toThrow(/Illegal/);
    expect(() => odd.apply(combine(0, '+', 0))).toThrow(/Illegal/);
    expect(() => odd.apply(combine(0, '+', 9))).toThrow(/Illegal/);
    expect(() => odd.apply('nonsense')).toThrow(/Illegal/);
  });

  it('ends on the target, and ends stuck when one number is left', () => {
    const win = new TargetState(9, [6, 3], [6, 3], [], 6, 0, 0, null).apply(combine(0, '+', 1));
    expect(win.result?.winners).toEqual([0]);
    const lose = new TargetState(100, [6, 3], [6, 3], [], 6, 0, 0, null).apply(combine(0, '+', 1));
    expect(lose.result?.winners).toEqual([]);
    expect(lose.closest).toBe(9);
    expect(lose.away).toBe(91);
  });

  it('keeps the nearest it has come', () => {
    const state = new TargetState(20, [6, 3, 5], [6, 3, 5], [], 6, 0, 0, null);
    const after = state.apply(combine(0, '*', 1));
    expect(after.pool).toEqual([5, 18]);
    expect(after.closest).toBe(18);
    expect(after.away).toBe(2);
  });

  it('takes a step back', () => {
    const state = new TargetState(100, [6, 3, 5], [6, 3, 5], [], 6, 0, 0, null);
    expect(() => state.apply(STEP_BACK)).toThrow(/Illegal/);
    const stepped = state.apply(combine(0, '+', 1));
    const back = stepped.apply(STEP_BACK);
    expect(back.steps).toEqual([]);
    expect([...back.pool].sort((a, b) => a - b)).toEqual([3, 5, 6]);
  });
});

describe('target number bots', () => {
  it('the good ones reach it, and every tier replays exactly', { timeout: 120_000 }, () => {
    for (const tier of BOT_TIERS) {
      const bot = targetNumberGame.createBot(tier);
      let state = targetNumberGame.newGame({ players: 1 }, 4) as TargetState;
      const moves: TargetMove[] = [];
      while (!state.result && moves.length < 20) {
        const move = bot.chooseMove(state, 0, createRng(moves.length + 1));
        moves.push(move);
        state = state.apply(move);
      }
      expect(state.result, `${tier} never finished`).not.toBe(null);
      if (tier === 'hard' || tier === 'expert') {
        expect(state.result?.winners, `${tier} should have got there`).toEqual([0]);
      }
      const replayed = replay(targetNumberGame, toMoveLog(targetNumberGame, { players: 1 }, 4, moves)) as TargetState;
      expect(replayed.steps).toEqual(state.steps);
    }
  });
});
