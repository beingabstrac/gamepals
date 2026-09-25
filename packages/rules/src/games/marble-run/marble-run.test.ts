import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { replay } from '../../core/replay';
import { makeLevel, marbleRun, newMarbleRun, rampAt, roll, type MarbleLevel } from './index';

const open: MarbleLevel = { start: 100, cup: 380, fixed: [], pegs: [{ x: 100, y: 200 }, { x: 240, y: 330 }, { x: 380, y: 460 }, { x: 60, y: 560 }], solution: [], par: 0 };

describe('marble run', () => {
  it('with no ramps the marble falls straight down past the cup', () => {
    const r = roll(open, [0, 0, 0, 0]);
    expect(r.landed).toBe(false);
    expect(r.path.every((p) => Math.abs(p.x - 100) < 0.01)).toBe(true);
  });

  it('a ramp tilted right sends it right; the cup catches it', () => {
    const r = roll(open, [2, 0, 0, 0]);
    expect(r.path[r.path.length - 1]!.x).toBeGreaterThan(130);
    const ramp = rampAt({ x: 100, y: 200 }, 2)!;
    expect(ramp.y2).toBeGreaterThan(ramp.y1);
    // Straight above the cup, it lands.
    expect(roll({ ...open, start: 380 }, [0, 0, 0, 0]).landed).toBe(true);
  });

  it('levels: no ramps misses, the solution lands, par is the fewest ramps', { timeout: 120_000 }, () => {
    for (let seed = 1; seed <= 25; seed++) {
      const level = makeLevel(seed);
      expect(roll(level, [0, 0, 0, 0]).landed, `seed ${seed}`).toBe(false);
      expect(roll(level, level.solution).landed, `seed ${seed}`).toBe(true);
      expect(level.solution.filter(Boolean).length).toBe(level.par);
      expect(level.par).toBeGreaterThan(0);
    }
  });

  it('tapping a peg cycles it: none, left, right, none', () => {
    const s = newMarbleRun(3);
    expect(s.apply('t1').states[1]).toBe(1);
    expect(s.apply('t1').apply('t1').states[1]).toBe(2);
    expect(s.apply('t1').apply('t1').apply('t1').states[1]).toBe(0);
    expect(() => s.apply('t9')).toThrow();
  });

  it('test play misses once, sets the ramps and lands; the referee replays it', () => {
    let s = marbleRun.newGame({ players: 1 }, 7);
    const bot = marbleRun.createBot('easy');
    const rng = createRng(7);
    const moves: string[] = [];
    while (!s.result && moves.length < 20) {
      const m = bot.chooseMove(s, 0, rng);
      moves.push(m);
      s = s.apply(m);
    }
    expect(s.result?.winners).toEqual([0]);
    expect(replay(marbleRun, { gameId: 'marble-run', seed: 7, config: { players: 1 }, moves }).result).toEqual(s.result);
  });
});
