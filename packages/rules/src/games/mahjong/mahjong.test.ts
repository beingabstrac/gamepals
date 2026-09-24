import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { FLOWER, mahjong, MAHJONG_LAYOUTS, MahjongState, newMahjong } from './index';

describe('mahjong solitaire', () => {
  it('layouts of 36, 72 and the 144-tile turtle, no two tiles in one place', () => {
    expect(MAHJONG_LAYOUTS.small).toHaveLength(36);
    expect(MAHJONG_LAYOUTS.medium).toHaveLength(72);
    expect(MAHJONG_LAYOUTS.large).toHaveLength(144);
    for (const slots of Object.values(MAHJONG_LAYOUTS)) {
      expect(new Set(slots.map((s) => `${s.x},${s.y},${s.z}`)).size).toBe(slots.length);
      // Every tile above the floor rests on something.
      for (const s of slots) {
        if (s.z === 0) continue;
        expect(slots.some((t) => t.z === s.z - 1 && t.x < s.x + 2 && s.x < t.x + 2 && t.y < s.y + 2 && s.y < t.y + 2)).toBe(true);
      }
    }
  });

  it('four of each face, flowers and seasons each four different pictures', () => {
    const s = newMahjong(3, 'large');
    const count = new Map<number, number>();
    for (const f of s.faces) count.set(f, (count.get(f) ?? 0) + 1);
    expect([...count.values()].every((n) => n === 4)).toBe(true);
    expect(count.size).toBe(36);
    const flowers = s.faces.flatMap((f, i) => (f === FLOWER ? [s.looks[i]] : []));
    expect(new Set(flowers).size).toBe(4);
  });

  it('free: nothing on top, and one side open', () => {
    const s = newMahjong(1, 'small');
    const slots = s.slots;
    // The top tiles of the pyramid are free; a floor tile under them is not.
    const top = slots.findIndex((t) => t.z === 2);
    expect(s.isFree(top)).toBe(true);
    const under = slots.findIndex((t) => t.z === 1 && t.x === slots[top]!.x && t.y <= slots[top]!.y + 1 && t.y + 2 > slots[top]!.y);
    if (under >= 0) expect(s.isFree(under)).toBe(false);
    // A floor tile in the middle of a row with neighbors both sides is not free.
    const middle = slots.findIndex((t) => t.z === 0 && t.x === 4 && t.y === 0);
    expect(s.isFree(middle)).toBe(false);
  });

  it('a matching pair of free tiles comes off; anything else is refused', () => {
    const s = newMahjong(2, 'small');
    const [a, b] = s.pairs()[0]!;
    const next = s.apply(`m${a}-${b}`);
    expect(next.faces[a]).toBe(-1);
    expect(next.left).toBe(34);
    const blocked = s.faces.findIndex((_, i) => !s.isFree(i));
    expect(() => s.apply(`m${blocked}-${a}`)).toThrow();
  });

  it('every deal can be cleared: test play clears it', { timeout: 60_000 }, () => {
    for (const level of ['small', 'medium', 'large']) {
      for (let seed = 0; seed < (level === 'large' ? 3 : 8); seed++) {
        // Play the pairs in the order the deal was built backwards: here, any sensible order,
        // with two shuffles in hand, should clear it.
        const bot = mahjong.createBot('medium');
        const rng = createRng(seed);
        let s = newMahjong(seed, level) as MahjongState;
        while (!s.result) s = s.apply(bot.chooseMove(s, 0, rng)) as MahjongState;
        expect(s.left, `${level} seed ${seed}`).toBe(0);
      }
    }
  });

  it('a shuffle keeps the same faces', () => {
    const s = newMahjong(5, 'small');
    const next = s.apply('shuffle');
    expect(next.faces.slice().sort()).toEqual(s.faces.slice().sort());
    expect(next.shuffles).toBe(1);
  });
});

/** Invariant: tiles only ever come off in matching pairs, and the faces left always pair up. */
describe('mahjong invariants', () => {
  it('keeps every face in pairs', () => {
    for (let seed = 0; seed < 10; seed++) {
      const rng = createRng(seed);
      let s = newMahjong(seed, 'small');
      while (!s.result) {
        const count = new Map<number, number>();
        for (const f of s.faces) if (f >= 0) count.set(f, (count.get(f) ?? 0) + 1);
        expect([...count.values()].every((n) => n % 2 === 0)).toBe(true);
        s = s.apply(rng.pick(s.legalMoves(0)));
      }
    }
  });
});
