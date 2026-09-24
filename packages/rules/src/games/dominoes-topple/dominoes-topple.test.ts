import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { replay } from '../../core/replay';
import { dominoesTopple, layMove, newTopple, TOPPLE_GOAL, TOPPLE_SPACING, toppleChain, topplePath, type ToppleState } from './index';

const line = (count: number, gapAt = -1): ToppleState => {
  let s = newTopple();
  for (let k = 0; k < count; k++) s = s.apply(layMove(30 + k * TOPPLE_SPACING + (k > gapAt && gapAt >= 0 ? 40 : 0), 200, 0));
  return s;
};

describe('dominoes topple', () => {
  it('a straight line falls one after another, each later than the last', () => {
    const s = line(12);
    const falls = toppleChain(s.dominoes, s.down, 0);
    expect(falls.map((f) => f.i)).toEqual([...Array(12).keys()]);
    for (let k = 1; k < falls.length; k++) expect(falls[k]!.at).toBeGreaterThan(falls[k - 1]!.at);
  });

  it('a gap longer than a domino stops the chain there', () => {
    const s = line(12, 5);
    expect(toppleChain(s.dominoes, s.down, 0).length).toBe(6);
  });

  it('a domino pushed from in front falls backwards, and one behind the push stays up', () => {
    const s = line(8);
    const falls = toppleChain(s.dominoes, s.down, 3);
    expect(falls.map((f) => f.i)).toEqual([3, 4, 5, 6, 7]);
    let r = newTopple().apply(layMove(100, 100, 0)).apply(layMove(124, 100, 180));
    r = r.apply('t0');
    expect((r.last as { falls: { dir: number }[] }).falls[1]!.dir).toBe(0);
  });

  it('the path round a bend carries all the way, and every domino falls once', () => {
    const path = topplePath(30);
    const falls = toppleChain(path, path.map(() => false), 0);
    expect(new Set(falls.map((f) => f.i)).size).toBe(30);
  });

  it('crowding, the edge, tipping one already down and standing up with none down are not moves', () => {
    const s = newTopple().apply(layMove(100, 100, 0));
    expect(() => s.apply(layMove(105, 100, 0))).toThrow();
    expect(() => s.apply(layMove(5, 100, 0))).toThrow();
    expect(() => s.apply('up')).toThrow();
    const t = s.apply('t0');
    expect(() => t.apply('t0')).toThrow();
    expect(t.apply('up').down).toEqual([false]);
    expect(t.apply('clear').dominoes.length).toBe(0);
  });

  it('all down in one push with enough on the table is done; fewer is not', () => {
    expect(line(TOPPLE_GOAL - 1).apply('t0').result).toBeNull();
    expect(line(TOPPLE_GOAL).apply('t0').result?.winners).toEqual([0]);
    expect(line(TOPPLE_GOAL, 8).apply('t0').result).toBeNull();
  });

  it('test play lays the line and knocks it all down; the referee replays it', () => {
    let s = dominoesTopple.newGame({ players: 1 }, 3);
    const bot = dominoesTopple.createBot('easy');
    const rng = createRng(3);
    const moves: string[] = [];
    while (!s.result && moves.length < 100) {
      const m = bot.chooseMove(s, 0, rng);
      moves.push(m);
      s = s.apply(m);
    }
    expect(s.result?.winners).toEqual([0]);
    expect(replay(dominoesTopple, { gameId: 'dominoes-topple', seed: 3, config: { players: 1 }, moves }).result).toEqual(s.result);
  });
});
