import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { replay } from '../../core/replay';
import { newOware, OwareState, oware } from './index';

/** A position: seat 0's houses 0-5, seat 1's 7-12, captures in 6 and 13. */
const at = (pits: number[], seat: 0 | 1 = 0) => new OwareState(pits, seat, 0, null, null);

describe('oware', () => {
  it('sows round one seed a house, never into the capture pits', () => {
    const s = newOware().apply('h5');
    expect(s.pits.slice(0, 6)).toEqual([4, 4, 4, 4, 4, 0]);
    expect(s.pits.slice(7, 11)).toEqual([5, 5, 5, 5]);
    expect(s.pits[6]).toBe(0);
    expect(s.last?.path).toEqual([7, 8, 9, 10]);
  });

  it('a big house skips itself going round', () => {
    const pits = [12, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0];
    const s = at(pits).apply('h0');
    expect(s.pits[0]).toBe(0);
    expect(s.last?.path.includes(0)).toBe(false);
    expect(s.last?.path.length).toBe(12);
  });

  it('a last seed making two or three captures it and the run before it', () => {
    // Sowing 3 from house 3 lands on 7 (via 4, 5): 7 and nothing before on their side.
    const pits = [0, 0, 0, 3, 0, 0, 0, 1, 2, 1, 4, 4, 4, 0];
    const s = at(pits).apply('h3');
    expect(s.pits[6]).toBe(2);
    expect(s.pits[7]).toBe(0);
    // Sowing 5 from house 3 lands on 9 making 2, and 8 (3) and 7 (2) before it go too.
    const run = [0, 0, 0, 5, 0, 0, 0, 1, 2, 1, 4, 4, 4, 0];
    const t = at(run).apply('h3');
    expect(t.pits[6]).toBe(2 + 3 + 2);
    expect(t.last?.capture?.seeds).toBe(7);
  });

  it('taking every seed they have captures nothing (grand slam)', () => {
    const pits = [0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 20];
    const s = at(pits).apply('h5');
    expect(s.pits[6]).toBe(0);
    expect(s.pits[7]).toBe(2);
  });

  it('an empty side must be fed if it can be', () => {
    const pits = [0, 0, 0, 0, 1, 3, 10, 0, 0, 0, 0, 0, 0, 20];
    const s = at(pits);
    // House 4 (one seed) stays on this side; house 5 (three seeds) reaches theirs.
    expect(s.legalMoves(0)).toEqual(['h5']);
  });

  it('more than 24 wins; the referee replays a whole game', () => {
    const rng = createRng(3);
    let s = newOware();
    const bot = oware.createBot('medium');
    const moves: string[] = [];
    while (!s.result) {
      const m = bot.chooseMove(s, s.currentSeat, rng);
      moves.push(m);
      s = s.apply(m) as OwareState;
    }
    // Over 24 ends it on the spot; otherwise the board was swept into the stores.
    expect(s.pits.reduce((a, b) => a + b, 0)).toBe(48);
    expect(s.pits[6]! > 24 || s.pits[13]! > 24 || s.pits[6]! + s.pits[13]! === 48).toBe(true);
    expect(replay(oware, { gameId: 'oware', seed: 3, config: { players: 2 }, moves }).result).toEqual(s.result);
  });

  it('the deeper bot wins more', { timeout: 60_000 }, () => {
    let wins = 0;
    for (let g = 0; g < 8; g++) {
      const rng = createRng(g + 10);
      const me = g % 2;
      let s = newOware();
      const bots = [oware.createBot(me === 0 ? 'hard' : 'easy'), oware.createBot(me === 0 ? 'easy' : 'hard')];
      while (!s.result) s = s.apply(bots[s.currentSeat]!.chooseMove(s, s.currentSeat, rng)) as OwareState;
      if (s.result.winners[0] === me) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(6);
  });

  it('invariant, every move: all 48 seeds are always on the board or taken', () => {
    const rng = createRng(7);
    let s = newOware();
    const bot = oware.createBot('easy');
    while (!s.result) {
      s = s.apply(bot.chooseMove(s, s.currentSeat, rng)) as OwareState;
      expect(s.pits.reduce((a, b) => a + b, 0)).toBe(48);
    }
  });
});
