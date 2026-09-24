import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { cellKey, choosePachisiMove, cowrieValue, isCastle, newPachisi, pachisi, PACHISI_HOME, PACHISI_PATH, PACHISI_TIERS, PACHISI_WAITING, pachisiCell, pachisiGrid, PachisiState } from './index';

/** A position by hand: `seat` to move with the throw `value`. */
const at = (pieces: number[][], seat: number, value: number) => {
  const up = [25, 10, 2, 3, 4, 5, 6].indexOf(value);
  const shells = [0, 1, 2, 3, 4, 5].map((i) => (i < up ? 1 : 0));
  return new PachisiState(pieces.length, 1, pieces, seat, 'move', shells, 3, null, false, null);
};

describe('pachisi', () => {
  it('the path goes step by step round the cross and back up your own arm', () => {
    for (let arm = 0; arm < 4; arm++) {
      const cells = Array.from({ length: PACHISI_PATH }, (_, i) => pachisiCell(arm, i));
      for (let i = 1; i < cells.length; i++) {
        const a = pachisiGrid(cells[i - 1]!);
        const b = pachisiGrid(cells[i]!);
        expect(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)), `arm ${arm} step ${i}`).toBe(1);
      }
      // Down your middle column, then everything else once, then back up the middle.
      expect(new Set(cells.map(cellKey)).size).toBe(PACHISI_PATH - 8);
      expect(cells[82]).toEqual({ arm, col: 'mid', row: 0 });
      for (const c of cells) {
        const g = pachisiGrid(c);
        const inCentre = g.x >= 8 && g.x <= 10 && g.y >= 8 && g.y <= 10;
        expect(inCentre).toBe(false);
      }
    }
    // Twelve castles in all.
    const all = new Set<string>();
    for (let arm = 0; arm < 4; arm++) for (let i = 0; i < PACHISI_PATH; i++) if (isCastle(pachisiCell(arm, i))) all.add(cellKey(pachisiCell(arm, i)));
    expect(all.size).toBe(12);
  });

  it('six cowries: none up is 25, one up is 10, the rest count themselves', () => {
    expect(cowrieValue([0, 0, 0, 0, 0, 0])).toBe(25);
    expect(cowrieValue([1, 0, 0, 0, 0, 0])).toBe(10);
    expect(cowrieValue([1, 1, 1, 0, 0, 0])).toBe(3);
    expect(cowrieValue([1, 1, 1, 1, 1, 1])).toBe(6);
  });

  it('only a grace brings a piece on, and a grace throws again', () => {
    expect(at([[-1, -1, -1, -1], [-1, -1, -1, -1]], 0, 3).legalMoves(0)).toEqual([]);
    const s = at([[-1, -1, -1, -1], [-1, -1, -1, -1]], 0, 6);
    expect(s.legalMoves(0)).toEqual(['e']);
    const after = s.apply('e');
    expect(after.pieces[0]).toEqual([0, -1, -1, -1]);
    expect(after.currentSeat).toBe(0);
  });

  it('landing on the other side sends every piece there back to the middle, and throws again', () => {
    // Red, from the top arm, has a piece where Blue's path lands with a 4.
    const blueTo = 20;
    const cell = pachisiCell(0, blueTo);
    let redAt = -1;
    for (let i = 0; i < PACHISI_PATH; i++) if (cellKey(pachisiCell(2, i)) === cellKey(cell)) redAt = i;
    expect(redAt).toBeGreaterThan(0);
    const s = at([[blueTo - 4, -1, -1, -1], [redAt, redAt, -1, -1]], 0, 4).apply('m0');
    expect(s.pieces[1]).toEqual([PACHISI_WAITING, PACHISI_WAITING, -1, -1]);
    expect(s.last?.captured).toHaveLength(2);
    expect(s.currentSeat).toBe(0);
  });

  it('a castle is safe, and one held by the other side cannot be landed on', () => {
    const castle = 24;
    expect(isCastle(pachisiCell(0, castle))).toBe(true);
    let redAt = -1;
    for (let i = 0; i < PACHISI_PATH; i++) if (cellKey(pachisiCell(2, i)) === cellKey(pachisiCell(0, castle))) redAt = i;
    expect(at([[castle - 4, -1, -1, -1], [redAt, -1, -1, -1]], 0, 4).target(0, 0, 4)).toBeNull();
  });

  it('home needs the exact throw, and nobody stops one short, since no throw is a one', () => {
    expect(at([[PACHISI_HOME - 4, -1, -1, -1], [-1, -1, -1, -1]], 0, 3).target(0, 0, 3)).toBeNull();
    expect(at([[PACHISI_HOME - 3, -1, -1, -1], [-1, -1, -1, -1]], 0, 3).target(0, 0, 3)).toBe(PACHISI_HOME);
    expect(at([[PACHISI_HOME - 3, -1, -1, -1], [-1, -1, -1, -1]], 0, 4).target(0, 0, 4)).toBeNull();
  });

  it('four play as partners: sitting opposite, they win together and never hit each other', () => {
    const four = newPachisi(1, 4);
    expect(four.partners(0, 2)).toBe(true);
    expect(four.partners(0, 1)).toBe(false);
    const done = new PachisiState(4, 1, [[80, 83, 83, 83], [-1, -1, -1, -1], [83, 83, 83, 83], [-1, -1, -1, -1]], 0, 'move', [1, 1, 1, 0, 0, 0], 3, null, false, null).apply('m0');
    expect(done.result).toEqual({ winners: [0, 2], draw: false });
  });

  it('two players sit opposite', () => {
    expect(newPachisi(1, 2).arm(1)).toBe(2);
    expect(newPachisi(1, 3).arm(2)).toBe(2);
  });

  it('bots finish, and the tiers come out in order', { timeout: 120_000 }, () => {
    const play = (a: keyof typeof PACHISI_TIERS, b: keyof typeof PACHISI_TIERS, games: number) => {
      let wins = 0;
      for (let seed = 0; seed < games; seed++) {
        const rng = createRng(seed);
        const aSeat = seed % 2;
        let s = newPachisi(seed, 2);
        let moves = 0;
        while (!s.result) {
          s = s.apply(choosePachisiMove(s, s.currentSeat, PACHISI_TIERS[s.currentSeat === aSeat ? a : b], rng));
          if (++moves > 20_000) throw new Error(`seed ${seed} never ends`);
        }
        if (s.result.winners.includes(aSeat)) wins++;
      }
      return wins / games;
    };
    expect(play('medium', 'easy', 120)).toBeGreaterThan(0.6);
    expect(play('hard', 'medium', 120)).toBeGreaterThan(0.5);
  });

  it('the same seed throws the same shells', () => {
    expect(pachisi.newGame({ players: 4 }, 9)).toEqual(newPachisi(9, 4));
  });
});

/** Invariant: four pieces each, and never two sides on one square that is not a castle. */
describe('pachisi invariants', () => {
  it('keeps every piece and every square honest', { timeout: 60_000 }, () => {
    for (let seed = 0; seed < 24; seed++) {
      const players = 2 + (seed % 3);
      const rng = createRng(seed);
      let s = newPachisi(seed, players);
      let moves = 0;
      while (!s.result && moves++ < 30_000) {
        const held = new Map<string, number>();
        s.pieces.forEach((list, seat) => {
          expect(list).toHaveLength(4);
          list.forEach((_, piece) => {
            const c = s.cellOf(seat, piece);
            if (!c || isCastle(c)) return;
            const side = players === 4 ? seat % 2 : seat;
            const key = cellKey(c);
            const other = held.get(key);
            expect(other === undefined || other === side, `seed ${seed}: two sides on ${key}`).toBe(true);
            held.set(key, side);
          });
        });
        s = s.apply(rng.pick(s.legalMoves(s.currentSeat)));
      }
      expect(s.result, `seed ${seed} ended`).not.toBeNull();
    }
  });
});
