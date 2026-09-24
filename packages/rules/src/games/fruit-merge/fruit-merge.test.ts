import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { replay } from '../../core/replay';
import {
  chooseFruitMove,
  DROP_KINDS,
  dropRange,
  FRUIT_BOX,
  FRUIT_R,
  fruitMerge,
  fruitMove,
  fruitPoints,
  FruitState,
  newFruitMerge,
  parseDrop,
  settle,
  stepWorld,
  type Fruit,
} from './index';

const at = (id: number, kind: number, x: number, y: number): Fruit => ({ id, kind, x, y, vx: 0, vy: 0 });
const inBox = (f: Fruit) => {
  const r = FRUIT_R[f.kind]!;
  return f.x - r >= FRUIT_BOX.left - 0.5 && f.x + r <= FRUIT_BOX.right + 0.5 && f.y + r <= FRUIT_BOX.bottom + 0.5;
};

describe('fruit merge', () => {
  it('a dropped fruit falls and comes to rest on the floor', () => {
    const w = settle({ fruit: [at(0, 2, 300, 200)], nextId: 1, made: [] });
    const f = w.fruit[0]!;
    expect(Math.abs(f.y + FRUIT_R[2]! - FRUIT_BOX.bottom)).toBeLessThan(1);
    expect(Math.abs(f.x - 300)).toBeLessThan(1);
  });

  it('two the same that touch become one of the next size, where they met', () => {
    const r = FRUIT_R[1]!;
    const w = stepWorld({ fruit: [at(0, 1, 300, 800), at(1, 1, 300 + 2 * r - 4, 800)], nextId: 2, made: [] });
    expect(w.fruit.length).toBe(1);
    expect(w.fruit[0]!.kind).toBe(2);
    expect(Math.abs(w.fruit[0]!.x - (300 + r - 2))).toBeLessThan(2);
    expect(w.made).toEqual([2]);
    expect(fruitPoints(2)).toBe(6);
  });

  it('two different ones push apart instead, and neither leaves the box', () => {
    const w = settle({ fruit: [at(0, 1, 300, 600), at(1, 3, 310, 700), at(2, 0, FRUIT_BOX.left + 5, 500)], nextId: 3, made: [] });
    expect(w.fruit.length).toBe(3);
    const [a, b] = w.fruit;
    expect(Math.hypot(a!.x - b!.x, a!.y - b!.y)).toBeGreaterThan(FRUIT_R[1]! + FRUIT_R[3]! - 1.5);
    for (const f of w.fruit) expect(inBox(f)).toBe(true);
  });

  it('a drop must fit between the walls; anything else is refused', () => {
    const s = newFruitMerge(1);
    const [lo, hi] = dropRange(s.kind);
    expect(s.allows(fruitMove(lo + 1))).toBe(true);
    expect(s.allows(fruitMove(hi + 3))).toBe(false);
    expect(s.allows('x')).toBe(false);
    expect(parseDrop('x300')).toBe(300);
    expect(() => s.apply(fruitMove(FRUIT_BOX.right + 50))).toThrow();
  });

  it('the fruit in hand comes from the smallest five, and the next one moves up after a drop', () => {
    let s = newFruitMerge(4);
    const rng = createRng(4);
    for (let i = 0; i < 30 && !s.result; i++) {
      const next = s.next;
      s = s.apply(chooseFruitMove(s, 'easy', rng));
      expect(s.kind).toBe(next);
      expect(s.next).toBeLessThan(DROP_KINDS);
    }
  });

  it('a pile over the line ends the game', () => {
    // Two columns of big fruit, sizes taking turns so nothing touching is the same.
    const column = (kinds: number[], x: number, id0: number) => {
      let y = FRUIT_BOX.bottom;
      return kinds.map((k, i) => {
        y -= FRUIT_R[k]!;
        const f = at(id0 + i, k, x, y);
        y -= FRUIT_R[k]!;
        return f;
      });
    };
    const tall = [...column([9, 7, 9, 7], 161, 0), ...column([8, 6, 8, 6], 439, 10)];
    const s = new FruitState(1, tall, 20, 0, 0, 0, 0, null, []);
    expect(s.apply(fruitMove(300)).result).toEqual({ winners: [], draw: false });
  });

  it('the same drops land the same way, and the referee replays a game', { timeout: 30_000 }, () => {
    const rng = createRng(2);
    let s = newFruitMerge(2);
    const moves: string[] = [];
    for (let i = 0; i < 40 && !s.result; i++) {
      const m = chooseFruitMove(s, 'medium', rng);
      moves.push(m);
      s = s.apply(m);
    }
    const back = replay(fruitMerge, { gameId: 'fruit-merge', seed: 2, config: { players: 1 }, moves }) as FruitState;
    expect(back.fruit).toEqual(s.fruit);
    expect(back.score).toBe(s.score);
  });

  it('a medium bot scores more than dropping anywhere', { timeout: 60_000 }, () => {
    const play = (tier: 'easy' | 'medium') => {
      let total = 0;
      for (let seed = 1; seed <= 3; seed++) {
        const rng = createRng(seed);
        let s = newFruitMerge(seed);
        while (!s.result && s.drops < 300) s = s.apply(chooseFruitMove(s, tier, rng));
        total += s.score;
      }
      return total;
    };
    expect(play('medium')).toBeGreaterThan(play('easy'));
  });

  it('invariant, every drop of bot play: fruit stays in the box, the score only climbs, and every fruit is a real size', { timeout: 30_000 }, () => {
    const rng = createRng(6);
    let s = newFruitMerge(6);
    for (let i = 0; i < 80 && !s.result; i++) {
      const next = s.apply(chooseFruitMove(s, 'medium', rng));
      for (const f of next.fruit) {
        expect(inBox(f)).toBe(true);
        expect(f.kind >= 0 && f.kind < FRUIT_R.length).toBe(true);
      }
      expect(next.score).toBeGreaterThanOrEqual(s.score);
      s = next;
    }
  });
});
