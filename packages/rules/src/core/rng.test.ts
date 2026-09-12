import { describe, expect, it } from 'vitest';
import { createRng } from './rng';

describe('createRng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(Array.from({ length: 5 }, () => a.next())).not.toEqual(Array.from({ length: 5 }, () => b.next()));
  });

  it('keeps values in range', () => {
    const rng = createRng(7);
    for (let i = 0; i < 10_000; i++) {
      const f = rng.next();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = rng.int(6);
      expect(Number.isInteger(n) && n >= 0 && n < 6).toBe(true);
    }
  });

  it('covers every face of a die roughly evenly', () => {
    const rng = createRng(123);
    const counts = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 60_000; i++) counts[rng.int(6)]!++;
    for (const count of counts) expect(Math.abs(count - 10_000)).toBeLessThan(500);
  });

  it('rejects invalid arguments', () => {
    const rng = createRng(0);
    expect(() => rng.int(0)).toThrow(RangeError);
    expect(() => rng.pick([])).toThrow(RangeError);
  });
});
