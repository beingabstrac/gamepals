import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { replay } from '../../core/replay';
import { newSandFall, SAND_COLORS, sandFall } from './index';

describe('sand fall', () => {
  it('counts pours in any color and shakes, and done finishes it', () => {
    let s = newSandFall();
    for (let c = 0; c < SAND_COLORS; c++) s = s.apply(`p${c}`);
    s = s.apply('shake').apply('p2');
    expect(s.pours).toBe(SAND_COLORS + 1);
    expect(s.shakes).toBe(1);
    expect(s.apply('done').result).toEqual({ winners: [0], draw: false });
    expect(() => s.apply(`p${SAND_COLORS}`)).toThrow();
  });

  it('the referee replays a jar', () => {
    const rng = createRng(1);
    const bot = sandFall.createBot('easy');
    let s = sandFall.newGame({ players: 1 }, 1);
    const moves: string[] = [];
    while (!s.result) {
      const m = bot.chooseMove(s, 0, rng);
      moves.push(m);
      s = s.apply(m);
    }
    expect(replay(sandFall, { gameId: 'sand-fall', seed: 1, config: { players: 1 }, moves }).result).toEqual(s.result);
  });
});
