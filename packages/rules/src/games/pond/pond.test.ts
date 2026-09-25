import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { replay } from '../../core/replay';
import { inPond, newPond, pond, POND_PAD_R, POND_PADS } from './index';

describe('pond', () => {
  it('lays five pads inside the pond and apart, for any seed', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const s = newPond(seed);
      expect(s.pads.length, `seed ${seed}`).toBe(POND_PADS);
      for (const p of s.pads) expect(inPond(p.x, p.y, POND_PAD_R)).toBe(true);
      for (let i = 0; i < s.pads.length; i++)
        for (let j = i + 1; j < s.pads.length; j++) expect(Math.hypot(s.pads[i]!.x - s.pads[j]!.x, s.pads[i]!.y - s.pads[j]!.y)).toBeGreaterThanOrEqual(POND_PAD_R * 2.6);
    }
  });

  it('a bud opens once; a pad that is not there is not a move; food any time', () => {
    const s = newPond(3).apply('b2');
    expect(s.open[2]).toBe(true);
    expect(() => s.apply('b2')).toThrow();
    expect(() => s.apply('b9')).toThrow();
    expect(s.apply('f').apply('f').feeds).toBe(2);
  });

  it('every lotus open is done; test play gets there and the referee replays it', () => {
    let s = pond.newGame({ players: 1 }, 5);
    const bot = pond.createBot('easy');
    const rng = createRng(5);
    const moves: string[] = [];
    while (!s.result) {
      const m = bot.chooseMove(s, 0, rng);
      moves.push(m);
      s = s.apply(m);
    }
    expect(s.result?.winners).toEqual([0]);
    expect(moves.filter((m) => m === 'f').length).toBeGreaterThan(0);
    expect(replay(pond, { gameId: 'pond', seed: 5, config: { players: 1 }, moves }).result).toEqual(s.result);
  });
});
