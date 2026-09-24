import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { newZen, ZEN_STONES, zenGarden, ZenState } from './index';

describe('zen garden', () => {
  it('a stone goes down and comes up again', () => {
    const s = newZen().apply('s5');
    expect(s.stones[5]).toBe(0);
    expect(s.apply('s5').stones[5]).toBe(-1);
  });

  it('each new stone is the next shape, up to seven in the garden', () => {
    let s = newZen();
    for (let i = 0; i < ZEN_STONES; i++) s = s.apply(`s${i}`);
    expect(s.stones.slice(0, ZEN_STONES)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(s.legalMoves(0)).not.toContain('s20');
    // Lifting one makes room again.
    expect(s.apply('s0').legalMoves(0)).toContain('s20');
  });

  it('done finishes it, whatever is in it', () => {
    expect(newZen().apply('done').result).toEqual({ winners: [0], draw: false });
    expect(() => newZen().apply('done').apply('s0')).toThrow();
  });

  it('test play finishes', () => {
    const bot = zenGarden.createBot('medium');
    let s = newZen() as ZenState;
    const rng = createRng(1);
    while (!s.result) s = s.apply(bot.chooseMove(s, 0, rng)) as ZenState;
    expect(s.count).toBe(3);
  });
});

/** Invariant: never more than seven stones, and a move only ever touches one cell. */
describe('zen garden invariants', () => {
  it('keeps it tidy', () => {
    for (let seed = 0; seed < 8; seed++) {
      const rng = createRng(seed);
      let s = newZen();
      for (let n = 0; n < 60 && !s.result; n++) {
        const move = rng.pick(s.legalMoves(0).filter((m) => m !== 'done' || n > 50));
        const before = s.stones;
        s = s.apply(move);
        expect(s.count).toBeLessThanOrEqual(ZEN_STONES);
        if (move !== 'done') expect(s.stones.filter((v, i) => v !== before[i])).toHaveLength(1);
      }
    }
  });
});
