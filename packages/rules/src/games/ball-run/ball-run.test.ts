import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { replay } from '../../core/replay';
import { ballRun, DOWN, LEFT, newBallRun, RIGHT, RUN_SIZES, RunState, pieceSides, turnSides, UP, type RunLevel } from './index';

describe('ball run', () => {
  it('a quarter turn moves every side on one, clockwise', () => {
    expect(turnSides(UP, 1)).toBe(RIGHT);
    expect(turnSides(UP | RIGHT, 1)).toBe(RIGHT | DOWN);
    expect(turnSides(LEFT, 1)).toBe(UP);
    expect(turnSides(UP | DOWN, 2)).toBe(UP | DOWN);
    expect(pieceSides({ kind: 'bend', turn: 3 })).toBe(LEFT | UP);
  });

  it('every board starts unjoined and can be joined: turning its path home wins', { timeout: 30_000 }, () => {
    for (const level of Object.keys(RUN_SIZES) as RunLevel[])
      for (let seed = 1; seed <= 40; seed++) {
        const s = newBallRun(seed, level);
        expect(s.pieces.length).toBe(RUN_SIZES[level] ** 2);
        expect(s.trace().home).toBe(false);
        expect(s.par).toBeGreaterThan(0);
        let t: RunState = s;
        const bot = ballRun.createBot('easy');
        const rng = createRng(seed);
        for (let k = 0; k < 400 && !t.result; k++) t = t.apply(bot.chooseMove(t, 0, rng)) as RunState;
        expect(t.result).toEqual({ winners: [0], draw: false });
        expect(t.moves).toBeLessThanOrEqual(s.par);
      }
  });

  it('a tap turns one piece a quarter turn; a cross is never a move', () => {
    const s = newBallRun(3, 'medium');
    const i = s.pieces.findIndex((p) => p.kind !== 'cross');
    const next = s.apply(`r${i}`);
    expect(next.pieces[i]!.turn).toBe((s.pieces[i]!.turn + 1) % 4);
    expect(next.moves).toBe(1);
    const cross = s.pieces.findIndex((p) => p.kind === 'cross');
    if (cross >= 0) expect(() => s.apply(`r${cross}`)).toThrow();
  });

  it('the referee replays a solved board', () => {
    const rng = createRng(4);
    let s = ballRun.newGame({ players: 1, variant: 'large' }, 4) as RunState;
    const bot = ballRun.createBot('easy');
    const moves: string[] = [];
    while (!s.result) {
      const m = bot.chooseMove(s, 0, rng);
      moves.push(m);
      s = s.apply(m);
    }
    expect(replay(ballRun, { gameId: 'ball-run', seed: 4, config: { players: 1, variant: 'large' }, moves }).result).toEqual(s.result);
  });
});
