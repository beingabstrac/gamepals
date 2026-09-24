import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { replay } from '../../core/replay';
import { allConnected, chooseMazeMove, MAZE_SIZES, MazeState, mazePaint, newMazePaint, rollTo, type MazeLevel } from './index';

/** A 3 by 3 room with a wall in the middle square: four rolls round the edge paint it. */
function room(): MazeState {
  const open = Array.from({ length: 9 }, (_, i) => i !== 4);
  const painted = open.map((_, i) => i === 0);
  return new MazeState(3, open, 0, painted, 0, 4, null, null);
}

describe('maze paint', () => {
  it('a roll goes until a wall and paints everything it passes', () => {
    const s = room();
    expect(rollTo(3, s.open, 0, 'r')).toEqual([1, 2]);
    expect(rollTo(3, s.open, 2, 'd')).toEqual([5, 8]);
    expect(rollTo(3, s.open, 1, 'd')).toEqual([]);
    expect(rollTo(3, s.open, 0, 'u')).toEqual([]);
    const next = s.apply('r');
    expect(next.ball).toBe(2);
    expect(next.last!.fresh).toEqual([1, 2]);
    expect(next.painted.slice(0, 3).every(Boolean)).toBe(true);
  });

  it('a roll straight into a wall is not a move', () => {
    const s = room();
    expect(s.legalMoves(0)).toEqual(['d', 'r']);
    expect(() => s.apply('l')).toThrow();
  });

  it('painting every square finishes it', () => {
    let s = room();
    for (const d of ['r', 'd', 'l'] as const) s = s.apply(d);
    expect(s.result).toBeNull();
    expect(s.left).toBe(1);
    s = s.apply('u');
    expect(s.left).toBe(0);
    expect(s.moves).toBe(4);
    expect(s.result).toEqual({ winners: [0], draw: false });
  });

  it('every maze of every size can be painted, and from anywhere the ball stops it can still get everywhere', { timeout: 30_000 }, () => {
    for (const level of Object.keys(MAZE_SIZES) as MazeLevel[]) {
      for (let seed = 1; seed <= 40; seed++) {
        const s = newMazePaint(seed, level);
        expect(s.size).toBe(MAZE_SIZES[level].size);
        expect(s.open.filter(Boolean).length).toBeGreaterThan(s.size * s.size * 0.3);
        expect(allConnected(s.size, s.open, s.ball)).toBe(true);
        let p = s;
        const rng = createRng(seed);
        for (let n = 0; n < 500 && !p.result; n++) p = p.apply(chooseMazeMove(p, rng));
        expect(p.result).toEqual({ winners: [0], draw: false });
      }
    }
  });

  it('a wandering player can never get stuck: random rolls still finish', () => {
    const rng = createRng(7);
    let s = newMazePaint(7, 'medium');
    for (let n = 0; n < 20_000 && !s.result; n++) s = s.apply(chooseMazeMove(s, rng, 0));
    expect(s.result).not.toBeNull();
  });

  it('the same seed carves the same maze, and the referee replays a game', () => {
    expect(newMazePaint(5, 'large').open).toEqual(newMazePaint(5, 'large').open);
    const rng = createRng(2);
    let s = newMazePaint(2, 'medium');
    const moves: string[] = [];
    while (!s.result) {
      const m = chooseMazeMove(s, rng);
      moves.push(m);
      s = s.apply(m);
    }
    const back = replay(mazePaint, { gameId: 'maze-paint', seed: 2, config: { players: 1, variant: 'medium' }, moves });
    expect(back.result).toEqual(s.result);
  });

  it('invariant, every roll of bot play: painted squares stay painted, walls are never painted, the ball sits on floor', () => {
    const rng = createRng(11);
    let s = newMazePaint(11, 'large');
    while (!s.result) {
      const next = s.apply(chooseMazeMove(s, rng, 0.7));
      next.painted.forEach((p, i) => {
        if (s.painted[i]) expect(p).toBe(true);
        if (p) expect(next.open[i]).toBe(true);
      });
      expect(next.open[next.ball]).toBe(true);
      s = next;
    }
  });
});
