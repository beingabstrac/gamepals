import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { newPopIt, popCells, popIt, PopState, POP_SHAPE_IDS } from './index';

describe('pop it', () => {
  it('every shape has bubbles, none twice', () => {
    for (const id of POP_SHAPE_IDS) {
      const cells = popCells(id);
      expect(cells.length).toBeGreaterThan(30);
      expect(new Set(cells.map((c) => `${c.col},${c.row}`)).size).toBe(cells.length);
    }
  });

  it('press them all, flip, press them all again, and the sheet is done', () => {
    let s = newPopIt(1, 'square');
    const n = s.down.length;
    for (let i = 0; i < n; i++) s = s.apply(`p${i}`);
    expect(s.result).toBeNull();
    expect(s.legalMoves(0)).toEqual(['flip']);
    s = s.apply('flip');
    expect(s.down.every((d) => !d)).toBe(true);
    for (let i = 0; i < n; i++) s = s.apply(`p${i}`);
    expect(s.result).toEqual({ winners: [0], draw: false });
    expect(s.pops).toBe(2 * n);
  });

  it('a bubble cannot be pressed twice, and there is no flip until they are all down', () => {
    const s = newPopIt(2, 'circle').apply('p0');
    expect(() => s.apply('p0')).toThrow();
    expect(s.legalMoves(0)).not.toContain('flip');
  });

  it('the seed picks the shape; test play finishes', () => {
    expect(newPopIt(5)).toEqual(newPopIt(5));
    const bot = popIt.createBot('medium');
    let s = newPopIt(5) as PopState;
    const rng = createRng(1);
    while (!s.result) s = s.apply(bot.chooseMove(s, 0, rng)) as PopState;
    expect(s.side).toBe(1);
  });
});

/** Invariant: a press only ever pushes one bubble down, and a flip only ever brings them all up. */
describe('pop it invariants', () => {
  it('keeps the bubbles honest', () => {
    for (let seed = 0; seed < 8; seed++) {
      const rng = createRng(seed);
      let s = newPopIt(seed);
      while (!s.result) {
        const before = s.down.filter(Boolean).length;
        const move = rng.pick(s.legalMoves(0));
        s = s.apply(move);
        expect(s.down.filter(Boolean).length).toBe(move === 'flip' ? 0 : before + 1);
      }
    }
  });
});
