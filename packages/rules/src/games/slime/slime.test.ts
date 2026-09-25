import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { replay } from '../../core/replay';
import { newSlime, slime } from './index';

describe('slime', () => {
  it('colors change, each mix-in goes in once, pokes count', () => {
    const s = newSlime().apply('c1').apply('m2').apply('p').apply('p');
    expect(s.color).toBe(1);
    expect(s.mixins).toEqual([false, false, true, false]);
    expect(s.pokes).toBe(2);
    expect(() => s.apply('m2')).toThrow();
    expect(() => s.apply('c1')).toThrow();
    expect(() => s.apply('c9')).toThrow();
  });

  it('done when you say; test play gets there and the referee replays it', () => {
    let s = slime.newGame({ players: 1 }, 1);
    const bot = slime.createBot('easy');
    const rng = createRng(1);
    const moves: string[] = [];
    while (!s.result) {
      const m = bot.chooseMove(s, 0, rng);
      moves.push(m);
      s = s.apply(m);
    }
    expect(s.mixins.every(Boolean)).toBe(true);
    expect(() => s.apply('p')).toThrow();
    expect(replay(slime, { gameId: 'slime', seed: 1, config: { players: 1 }, moves }).result).toEqual(s.result);
  });
});
