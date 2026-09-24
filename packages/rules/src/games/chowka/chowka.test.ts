import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { chooseChowkaMove, chowka, CHOWKA_HOME, CHOWKA_SAFE, CHOWKA_TIERS, chowkaSquare, ChowkaState, chowkaValue, newChowka } from './index';

/** A position by hand, `seat` to move with `value`. */
const at = (pieces: number[][], hit: boolean[], seat: number, value: number) => {
  const ups = value === 8 ? 0 : value;
  const shells = [0, 1, 2, 3].map((i) => (i < ups ? 1 : 0));
  return new ChowkaState(pieces.length, 1, pieces, hit, seat, 'move', shells, 3, null, false, null);
};

describe('chowka bhara', () => {
  it('the path runs round the outside, round the inner ring and into the middle, one step at a time', () => {
    for (let side = 0; side < 4; side++) {
      const cells = Array.from({ length: CHOWKA_HOME + 1 }, (_, i) => chowkaSquare(side, i));
      expect(new Set(cells.map((c) => c.y * 5 + c.x)).size).toBe(25);
      for (let i = 1; i < cells.length; i++) expect(Math.abs(cells[i]!.x - cells[i - 1]!.x) + Math.abs(cells[i]!.y - cells[i - 1]!.y)).toBe(1);
      expect(cells[CHOWKA_HOME]).toEqual({ x: 2, y: 2 });
      expect(CHOWKA_SAFE.has(cells[0]!.y * 5 + cells[0]!.x)).toBe(true);
    }
  });

  it('four cowries: the ones mouth up, none up is eight', () => {
    expect(chowkaValue([0, 0, 0, 0])).toBe(8);
    expect(chowkaValue([1, 1, 1, 1])).toBe(4);
    expect(chowkaValue([1, 0, 1, 0])).toBe(2);
  });

  it('only a four or an eight brings a piece on, and throws again', () => {
    expect(at([[-1, -1, -1, -1], [-1, -1, -1, -1]], [false, false], 0, 3).legalMoves(0)).toEqual([]);
    const s = at([[-1, -1, -1, -1], [-1, -1, -1, -1]], [false, false], 0, 4).apply('e');
    expect(s.pieces[0]).toEqual([0, -1, -1, -1]);
    expect(s.currentSeat).toBe(0);
  });

  it('the inner ring stays shut until you have knocked somebody off: round the outside again', () => {
    expect(at([[14, -1, -1, -1], [-1, -1, -1, -1]], [false, false], 0, 3).target(0, 0, 3)).toBe(1);
    expect(at([[14, -1, -1, -1], [-1, -1, -1, -1]], [true, false], 0, 3).target(0, 0, 3)).toBe(17);
  });

  it('a hit sends the piece back, opens the inner ring and throws again', () => {
    // Blue lands on Red's piece on a square both paths share and that is not safe.
    const blueTo = 3;
    const square = chowkaSquare(0, blueTo);
    let redAt = -1;
    for (let i = 0; i < 16; i++) {
      const c = chowkaSquare(2, i);
      if (c.x === square.x && c.y === square.y) redAt = i;
    }
    expect(redAt).toBeGreaterThanOrEqual(0);
    const s = at([[1, -1, -1, -1], [redAt, -1, -1, -1]], [false, false], 0, 2).apply('m0');
    expect(s.pieces[1]![0]).toBe(-1);
    expect(s.hit[0]).toBe(true);
    expect(s.currentSeat).toBe(0);
  });

  it('a double cannot be hit by a single piece, and nobody is hit on a safe square', () => {
    const square = chowkaSquare(0, 3);
    let redAt = -1;
    for (let i = 0; i < 16; i++) {
      const c = chowkaSquare(2, i);
      if (c.x === square.x && c.y === square.y) redAt = i;
    }
    expect(at([[1, -1, -1, -1], [redAt, redAt, -1, -1]], [false, false], 0, 2).target(0, 0, 2)).toBeNull();
  });

  it('home needs the exact throw, and all four home wins', () => {
    expect(at([[22, -1, -1, -1], [-1, -1, -1, -1]], [true, false], 0, 3).target(0, 0, 3)).toBeNull();
    const s = at([[22, 24, 24, 24], [-1, -1, -1, -1]], [true, false], 0, 2).apply('m0');
    expect(s.result).toEqual({ winners: [0], draw: false });
  });

  it('bots finish, and the tiers come out in order', { timeout: 120_000 }, () => {
    const play = (a: keyof typeof CHOWKA_TIERS, b: keyof typeof CHOWKA_TIERS, games: number) => {
      let wins = 0;
      for (let seed = 0; seed < games; seed++) {
        const rng = createRng(seed);
        const aSeat = seed % 2;
        let s = newChowka(seed, 2);
        while (!s.result) s = s.apply(chooseChowkaMove(s, s.currentSeat, CHOWKA_TIERS[s.currentSeat === aSeat ? a : b], rng));
        if (s.result.winners.includes(aSeat)) wins++;
      }
      return wins / games;
    };
    expect(play('medium', 'easy', 150)).toBeGreaterThan(0.55);
    expect(play('hard', 'medium', 150)).toBeGreaterThan(0.5);
  });

  it('the same seed throws the same shells', () => {
    expect(chowka.newGame({ players: 3 }, 4)).toEqual(newChowka(4, 3));
  });
});

/** Invariant: four pieces each, and outside the safe squares never two sides on one square. */
describe('chowka invariants', () => {
  it('keeps every square honest, and every game ends', { timeout: 60_000 }, () => {
    for (let seed = 0; seed < 24; seed++) {
      const players = 2 + (seed % 3);
      const rng = createRng(seed);
      let s = newChowka(seed, players);
      while (!s.result) {
        const holder = new Map<number, number>();
        s.pieces.forEach((list, seat) => list.forEach((_, piece) => {
          const sq = s.squareOf(seat, piece);
          if (sq === null || CHOWKA_SAFE.has(sq)) return;
          const other = holder.get(sq);
          expect(other === undefined || other === seat, `seed ${seed}: two sides on ${sq}`).toBe(true);
          holder.set(sq, seat);
        }));
        s = s.apply(rng.pick(s.legalMoves(s.currentSeat)));
      }
      expect(s.result.draw, `seed ${seed} ran out of time`).toBe(false);
    }
  });
});
