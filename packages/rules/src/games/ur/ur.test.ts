import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { chooseUrMove, newUr, ur, UR_OFF, UR_PIECES, UR_TIERS, urDice, UrState } from './index';

/** A position with the pieces placed by hand, `seat` to move with a throw of `value`. */
const at = (a: number[], b: number[], seat: 0 | 1, value: number) => {
  const fill = (list: number[]) => [...list, ...Array<number>(UR_PIECES - list.length).fill(0)].sort((x, y) => x - y);
  const dice = [0, 1, 2, 3].map((i) => (i < value ? 1 : 0));
  return new UrState(1, [fill(a), fill(b)], seat, 'move', dice, 5, null, false, null);
};

describe('royal game of ur', () => {
  it('throws four binary dice, 0 to 4, with 2 the most common', () => {
    const counts = [0, 0, 0, 0, 0];
    for (let n = 0; n < 4000; n++) counts[urDice(3, n).reduce((a: number, b) => a + b, 0)]!++;
    expect(counts[2]).toBeGreaterThan(counts[1]!);
    expect(counts[1]).toBeGreaterThan(counts[0]!);
    expect(counts[3]).toBeGreaterThan(counts[4]!);
    expect(counts.every((c) => c > 0)).toBe(true);
  });

  it('a nought, or a throw nothing can use, passes the turn', () => {
    let seed = 0;
    while (urDice(seed, 0).some((d) => d === 1)) seed++;
    const s = newUr(seed).apply('roll');
    expect(s.passed).toBe(true);
    expect(s.currentSeat).toBe(1);
    expect(s.phase).toBe('roll');
  });

  it('landing on a rosette throws again', () => {
    const s = at([], [], 0, 4).apply('m0');
    expect(s.last).toMatchObject({ from: 0, to: 4, again: true });
    expect(s.currentSeat).toBe(0);
  });

  it('landing on the other player in the shared row knocks them back', () => {
    const s = at([5], [7], 0, 2).apply('m5');
    expect(s.last?.captured).toBe(true);
    expect(s.pieces[1].filter((p) => p === 0)).toHaveLength(UR_PIECES);
    expect(s.currentSeat).toBe(1);
  });

  it('the same number in private rows is a different square, so no knock', () => {
    const s = at([1], [3], 0, 2).apply('m1');
    expect(s.last?.captured).toBe(false);
    expect(s.pieces[1]).toContain(3);
  });

  it('nobody can be knocked off the middle rosette, and you cannot land on your own piece', () => {
    expect(at([6], [8], 0, 2).legalMoves(0)).not.toContain('m6');
    expect(at([6, 8], [], 0, 2).legalMoves(0)).not.toContain('m6');
  });

  it('bearing off needs the exact throw', () => {
    expect(at([13], [], 0, 2).legalMoves(0)).toContain('m13');
    expect(at([13], [], 0, 3).legalMoves(0)).not.toContain('m13');
    const s = at([13], [], 0, 2).apply('m13');
    expect(s.pieces[0]).toContain(UR_OFF);
  });

  it('all seven off wins', () => {
    const s = at([UR_OFF, UR_OFF, UR_OFF, UR_OFF, UR_OFF, UR_OFF, 14], [], 0, 1).apply('m14');
    expect(s.result).toEqual({ winners: [0], draw: false });
  });

  it('pieces waiting to come on are one move, not seven', () => {
    expect(newUr(2).apply('roll').legalMoves(0).filter((m) => m === 'm0').length).toBeLessThanOrEqual(1);
  });

  it('bots finish, and the tiers come out in order', { timeout: 120_000 }, () => {
    const play = (a: 'easy' | 'medium' | 'hard' | 'expert', b: typeof a, games: number) => {
      let wins = 0;
      for (let seed = 0; seed < games; seed++) {
        const rng = createRng(seed);
        const aSeat = seed % 2;
        let s = newUr(seed);
        let moves = 0;
        while (!s.result) {
          s = s.apply(chooseUrMove(s, s.currentSeat, UR_TIERS[s.currentSeat === aSeat ? a : b], rng));
          if (++moves > 5000) throw new Error('stuck');
        }
        if (s.result.winners[0] === aSeat) wins++;
      }
      return wins / games;
    };
    expect(play('medium', 'easy', 200)).toBeGreaterThan(0.6);
    expect(play('hard', 'medium', 200)).toBeGreaterThan(0.52);
  });

  it('the same seed throws the same dice', () => {
    expect(ur.newGame({ players: 2 }, 9)).toEqual(newUr(9));
    expect(newUr(9).apply('roll').dice).toEqual(newUr(9).apply('roll').dice);
  });
});

/** Invariant: seven pieces each, never two of one color on a square, never two colors on a shared square. */
describe('ur invariants', () => {
  it('keeps every piece and every square honest', () => {
    for (let seed = 0; seed < 30; seed++) {
      const rng = createRng(seed);
      let s = newUr(seed);
      let moves = 0;
      while (!s.result && moves++ < 3000) {
        for (const seat of [0, 1] as const) {
          const mine = s.pieces[seat];
          expect(mine).toHaveLength(UR_PIECES);
          const onPath = mine.filter((p) => p > 0 && p < UR_OFF);
          expect(new Set(onPath).size, `seed ${seed}: two pieces on one square`).toBe(onPath.length);
        }
        const shared = (seat: 0 | 1) => s.pieces[seat].filter((p) => p >= 5 && p <= 12);
        expect(shared(0).filter((p) => shared(1).includes(p)), `seed ${seed}: two colors on a shared square`).toEqual([]);
        s = s.apply(rng.pick(s.legalMoves(s.currentSeat)));
      }
      expect(s.result).not.toBeNull();
    }
  });
});
