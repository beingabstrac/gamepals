import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { replay } from '../../core/replay';
import { mirrorPaint, newMirror, type MirrorState } from './index';

describe('mirror paint', () => {
  it('settings change, strokes count, clearing keeps the settings', () => {
    const s = newMirror().apply('w3').apply('k0').apply('b2').apply('s').apply('s').apply('clear');
    expect([s.ways, s.color, s.brush, s.strokes]).toEqual([3, 0, 2, 2]);
    expect(() => s.apply('w3')).toThrow();
    expect(() => s.apply('k7')).toThrow();
  });

  it('done when you say; test play gets there and the referee replays it', () => {
    let s = mirrorPaint.newGame({ players: 1 }, 1);
    const bot = mirrorPaint.createBot('easy');
    const rng = createRng(1);
    const moves: string[] = [];
    while (!s.result) {
      const m = bot.chooseMove(s, 0, rng);
      moves.push(m);
      s = s.apply(m);
    }
    expect((s as MirrorState).strokes).toBe(8);
    expect(() => s.apply('s')).toThrow();
    expect(replay(mirrorPaint, { gameId: 'mirror-paint', seed: 1, config: { players: 1 }, moves }).result).toEqual(s.result);
  });
});
