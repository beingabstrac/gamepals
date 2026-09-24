import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { replay } from '../../core/replay';
import { LEVEL, newStraighten, straightenUp, TILT_MAX, turnMove, WALL_FRAMES, type WallSize } from './index';

describe('straighten up', () => {
  it('every frame starts properly crooked, within reach', () => {
    for (const size of Object.keys(WALL_FRAMES) as WallSize[])
      for (let seed = 1; seed <= 20; seed++) {
        const s = newStraighten(seed, size);
        expect(s.tilts.length).toBe(WALL_FRAMES[size]);
        expect(s.tilts.every((t) => Math.abs(t) >= 6 && Math.abs(t) <= TILT_MAX)).toBe(true);
        expect(s.straight).toBe(0);
      }
  });

  it('a turn to within a degree of level clicks it straight; further off stays crooked', () => {
    const s = newStraighten(3);
    expect(s.apply(turnMove(0, LEVEL)).tilts[0]).toBe(0);
    expect(s.apply(turnMove(0, -LEVEL)).tilts[0]).toBe(0);
    const t = s.tilts[0]! > 0 ? 3 : -3;
    expect(s.apply(turnMove(0, t)).tilts[0]).toBe(t);
  });

  it('turning past the end, or to where it already is, is not a move', () => {
    const s = newStraighten(4);
    expect(() => s.apply(turnMove(0, TILT_MAX + 1))).toThrow();
    expect(() => s.apply(turnMove(0, s.tilts[0]!))).toThrow();
  });

  it('the whole wall straight, it is done; the referee replays it', () => {
    for (const size of Object.keys(WALL_FRAMES) as WallSize[]) {
      let s = straightenUp.newGame({ players: 1, variant: size }, 6);
      const bot = straightenUp.createBot('easy');
      const rng = createRng(6);
      const moves: string[] = [];
      while (!s.result) {
        const m = bot.chooseMove(s, 0, rng);
        moves.push(m);
        s = s.apply(m);
      }
      expect(s.result).toEqual({ winners: [0], draw: false });
      expect(replay(straightenUp, { gameId: 'straighten-up', seed: 6, config: { players: 1, variant: size }, moves }).result).toEqual(s.result);
    }
  });
});
