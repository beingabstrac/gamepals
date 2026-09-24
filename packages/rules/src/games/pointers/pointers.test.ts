import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { newPointers, POINTER_LIVES, pointers, PointerState } from './index';

const grid = (size: number, cells: Record<number, number>) => {
  const arrows = Array<number>(size * size).fill(-1);
  for (const [c, d] of Object.entries(cells)) arrows[Number(c)] = d;
  return new PointerState(size, arrows, POINTER_LIVES, null, null);
};

describe('pointers', () => {
  it('an arrow with a clear road flies off; one blocked bumps and costs a life', () => {
    // 3 by 3: an arrow on the middle pointing right, and one on its right pointing up.
    const s = grid(3, { 4: 1, 5: 0 });
    expect(s.clear(4)).toBe(false);
    const bumped = s.apply('t4');
    expect(bumped.lives).toBe(POINTER_LIVES - 1);
    expect(bumped.arrows[4]).toBe(1);
    const gone = s.apply('t5');
    expect(gone.arrows[5]).toBe(-1);
    expect(gone.clear(4)).toBe(true);
  });

  it('clearing the board wins; running out of lives loses', () => {
    expect(grid(3, { 4: 0 }).apply('t4').result).toEqual({ winners: [0], draw: false });
    let s = grid(3, { 4: 1, 5: 1 });
    for (let i = 0; i < POINTER_LIVES; i++) s = s.apply('t4');
    expect(s.result).toEqual({ winners: [], draw: false });
  });

  it('every board can be cleared without a bump, and is about two thirds full', () => {
    for (const level of ['small', 'medium', 'large']) {
      for (let seed = 0; seed < 12; seed++) {
        let s = newPointers(seed, level);
        expect(s.left).toBeGreaterThan(s.size * s.size * 0.5);
        while (!s.result) {
          const free = s.arrows.findIndex((a, i) => a >= 0 && s.clear(i));
          expect(free, `${level} ${seed} got stuck`).toBeGreaterThanOrEqual(0);
          s = s.apply(`t${free}`);
        }
        expect(s.lives).toBe(POINTER_LIVES);
      }
    }
  });

  it('the same seed deals the same board; test play finishes', () => {
    expect(newPointers(3, 'medium')).toEqual(newPointers(3, 'medium'));
    const bot = pointers.createBot('medium');
    let s = newPointers(3) as PointerState;
    const rng = createRng(1);
    while (!s.result) s = s.apply(bot.chooseMove(s, 0, rng)) as PointerState;
    expect(s.result.winners).toEqual([0]);
  });
});

/** Invariant: a tap either takes exactly that arrow off or costs exactly one life, never both. */
describe('pointers invariants', () => {
  it('keeps count', () => {
    for (let seed = 0; seed < 12; seed++) {
      const rng = createRng(seed);
      let s = newPointers(seed, 'medium');
      while (!s.result) {
        const before = { left: s.left, lives: s.lives };
        s = s.apply(rng.pick(s.legalMoves(0)));
        const took = before.left - s.left;
        const lost = before.lives - s.lives;
        expect(took + lost).toBe(1);
      }
    }
  });
});
