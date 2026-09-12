export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
}

const rotl = (x: number, k: number): number => ((x << k) | (x >>> (32 - k))) >>> 0;

/**
 * xoshiro128** seeded through splitmix32. Integer-only math, so the sequence is
 * identical on every JS engine (browsers, iOS/Android WebViews, Cloudflare Workers).
 */
export function createRng(seed: number): Rng {
  let sm = seed >>> 0;
  const splitmix = (): number => {
    sm = (sm + 0x9e3779b9) >>> 0;
    let z = sm;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };

  let a = splitmix();
  let b = splitmix();
  let c = splitmix();
  let d = splitmix();

  const nextU32 = (): number => {
    const result = Math.imul(rotl(Math.imul(b, 5) >>> 0, 7), 9) >>> 0;
    const t = (b << 9) >>> 0;
    c = (c ^ a) >>> 0;
    d = (d ^ b) >>> 0;
    b = (b ^ c) >>> 0;
    a = (a ^ d) >>> 0;
    c = (c ^ t) >>> 0;
    d = rotl(d, 11);
    return result;
  };

  const next = (): number => nextU32() / 4294967296;

  return {
    next,
    int(maxExclusive: number): number {
      if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
        throw new RangeError(`maxExclusive must be a positive integer, got ${maxExclusive}`);
      }
      return Math.floor(next() * maxExclusive);
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new RangeError('Cannot pick from an empty list');
      return items[Math.floor(next() * items.length)] as T;
    },
  };
}
