import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { CRADLE_BALLS, newCradle, newtonsCradle, CradleState } from './index';

describe("newton's cradle", () => {
  it('one to four balls may be let go from either side, never all five', () => {
    const moves = newCradle().legalMoves(0);
    for (let n = 1; n < CRADLE_BALLS; n++) {
      expect(moves).toContain(`l${n}`);
      expect(moves).toContain(`r${n}`);
    }
    expect(moves).not.toContain(`l${CRADLE_BALLS}`);
  });

  it('counts the swings and remembers the last', () => {
    const s = newCradle().apply('l2').apply('r1');
    expect(s.swings).toBe(2);
    expect(s.last).toEqual({ side: 'r', n: 1 });
  });

  it('done puts it down, and nothing moves after', () => {
    const s = newCradle().apply('done');
    expect(s.result).toEqual({ winners: [0], draw: false });
    expect(() => s.apply('l1')).toThrow();
  });

  it('test play finishes', () => {
    const bot = newtonsCradle.createBot('medium');
    let s = newCradle() as CradleState;
    const rng = createRng(1);
    while (!s.result) s = s.apply(bot.chooseMove(s, 0, rng)) as CradleState;
    expect(s.swings).toBe(2);
  });
});

/** Invariant: every swing adds one to the count, and only done ends it. */
describe('cradle invariants', () => {
  it('counts honestly', () => {
    const rng = createRng(3);
    let s = newCradle();
    for (let n = 0; n < 40 && !s.result; n++) {
      const move = rng.pick(s.legalMoves(0).filter((m) => m !== 'done' || n > 30));
      const before = s.swings;
      s = s.apply(move);
      expect(s.swings).toBe(move === 'done' ? before : before + 1);
      expect(s.result !== null).toBe(move === 'done');
    }
  });
});
