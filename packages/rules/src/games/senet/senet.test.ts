import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { chooseSenetMove, newSenet, senet, SENET_OFF, SENET_PIECES, SENET_TIERS, SenetState, senetSticks, sticksValue } from './index';

/** A position by hand, `seat` to move with a throw of `value`. */
const at = (a: number[], b: number[], seat: 0 | 1, value: number) => {
  const whites = value === 5 ? 0 : value;
  const sticks = [0, 1, 2, 3].map((i) => (i < whites ? 1 : 0));
  return new SenetState(1, [a.slice().sort((x, y) => x - y), b.slice().sort((x, y) => x - y)], seat, 'move', sticks, 3, null, false, null);
};

describe('senet', () => {
  it('four sticks throw 1 to 5, no whites counting five', () => {
    expect(sticksValue([0, 0, 0, 0])).toBe(5);
    expect(sticksValue([1, 0, 1, 0])).toBe(2);
    const seen = new Set<number>();
    for (let n = 0; n < 500; n++) seen.add(sticksValue(senetSticks(4, n)));
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('starts mixed along the first row, five each', () => {
    const s = newSenet(1);
    expect(s.pieces[0]).toEqual([1, 3, 5, 7, 9]);
    expect(s.pieces[1]).toEqual([2, 4, 6, 8, 10]);
  });

  it('landing on a lone piece swaps places with it', () => {
    const s = at([12], [14], 0, 2).apply('m12');
    expect(s.pieces[0]).toEqual([14]);
    expect(s.pieces[1]).toEqual([12]);
    expect(s.last?.swapped).toBe(true);
  });

  it('two side by side are safe, and you cannot land on your own', () => {
    expect(at([12], [14, 15], 0, 2).target(0, 12, 2, false)).toBeNull();
    expect(at([12, 14], [], 0, 2).target(0, 12, 2, false)).toBeNull();
    // Nothing forward, so the piece has to go back instead.
    expect(at([12], [14, 15], 0, 2).options(0, 2)).toEqual({ froms: [12], backward: true });
  });

  it('three in a row cannot be passed', () => {
    const s = at([11, 5], [13, 14, 15], 0, 5);
    expect(s.legalMoves(0)).not.toContain('m11');
    expect(s.legalMoves(0)).toContain('m5');
  });

  it('with no move forward a piece must go back; with neither the throw is lost', () => {
    const back = at([20], [22, 23, 24, 25], 0, 3);
    expect(back.options(0, 3)).toEqual({ froms: [20], backward: true });
    expect(back.apply('m20').pieces[0]).toEqual([17]);
  });

  it('every piece must stop on the House of Beauty', () => {
    expect(at([24], [], 0, 3).target(0, 24, 3, false)).toBeNull();
    expect(at([24], [], 0, 2).target(0, 24, 2, false)).toBe(26);
  });

  it('the House of Water washes a piece back to Rebirth, or the first free square before it', () => {
    expect(at([26], [], 0, 1).apply('m26').pieces[0]).toEqual([15]);
    expect(at([26], [15, 14], 0, 1).apply('m26').pieces[0]).toEqual([13]);
  });

  it('the last houses go off only with their own throw', () => {
    expect(at([26], [], 0, 5).apply('m26').pieces[0]).toEqual([SENET_OFF]);
    expect(at([28], [], 0, 3).legalMoves(0)).toEqual(['m28']);
    expect(at([28, 1], [], 0, 2).legalMoves(0)).toEqual(['m1']);
    expect(at([29], [], 0, 2).apply('m29').pieces[0]).toEqual([SENET_OFF]);
    expect(at([30], [], 0, 1).apply('m30').pieces[0]).toEqual([SENET_OFF]);
  });

  it('1, 4 and 5 throw again; 2 and 3 end the turn', () => {
    expect(at([3], [20], 0, 1).apply('m3').currentSeat).toBe(0);
    expect(at([3], [20], 0, 4).apply('m3').currentSeat).toBe(0);
    expect(at([3], [20], 0, 2).apply('m3').currentSeat).toBe(1);
  });

  it('all five off wins', () => {
    const s = at([SENET_OFF, SENET_OFF, SENET_OFF, SENET_OFF, 30], [5], 0, 1).apply('m30');
    expect(s.result).toEqual({ winners: [0], draw: false });
  });

  it('bots finish, and the tiers come out in order', { timeout: 120_000 }, () => {
    const play = (a: keyof typeof SENET_TIERS, b: keyof typeof SENET_TIERS, games: number) => {
      let wins = 0;
      for (let seed = 0; seed < games; seed++) {
        const rng = createRng(seed);
        const aSeat = seed % 2;
        let s = newSenet(seed);
        let moves = 0;
        while (!s.result) {
          s = s.apply(chooseSenetMove(s, s.currentSeat, SENET_TIERS[s.currentSeat === aSeat ? a : b], rng));
          if (++moves > 20_000) throw new Error(`seed ${seed} never ends`);
        }
        if (s.result.winners[0] === aSeat) wins++;
      }
      return wins / games;
    };
    expect(play('medium', 'easy', 200)).toBeGreaterThan(0.6);
    expect(play('hard', 'medium', 200)).toBeGreaterThan(0.52);
  });

  it('the same seed throws the same sticks', () => {
    expect(senet.newGame({ players: 2 }, 9)).toEqual(newSenet(9));
    expect(newSenet(9).apply('roll').sticks).toEqual(newSenet(9).apply('roll').sticks);
  });
});

/** Invariant: five pieces each, and never two pieces on one square. */
describe('senet invariants', () => {
  it('keeps every piece and every square honest', { timeout: 60_000 }, () => {
    for (let seed = 0; seed < 30; seed++) {
      const rng = createRng(seed);
      let s = newSenet(seed);
      let moves = 0;
      while (!s.result && moves++ < 20_000) {
        const board = [...s.pieces[0], ...s.pieces[1]].filter((p) => p < SENET_OFF);
        expect(new Set(board).size, `seed ${seed} move ${moves}`).toBe(board.length);
        expect(s.pieces[0]).toHaveLength(SENET_PIECES);
        expect(s.pieces[1]).toHaveLength(SENET_PIECES);
        expect(board.includes(27), 'nobody stays in the water').toBe(false);
        s = s.apply(rng.pick(s.legalMoves(s.currentSeat)));
      }
      expect(s.result, `seed ${seed} ended`).not.toBeNull();
    }
  });
});
