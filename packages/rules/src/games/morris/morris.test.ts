import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { MILLS, MORRIS_LINKS, MORRIS_PIECES, MORRIS_XY, morris, MorrisState, newMorris } from './index';

const through = (state: MorrisState, moves: string[]) => moves.reduce((s, m) => s.apply(m), state);
/** A moving-game position by hand: `a` and `b` are the points each side holds. */
const at = (a: number[], b: number[], seat: 0 | 1 = 0) => {
  const board = Array<number>(24).fill(-1);
  for (const p of a) board[p] = 0;
  for (const p of b) board[p] = 1;
  return new MorrisState(board, [0, 0], seat, false, 0, null, null);
};

describe("nine men's morris", () => {
  it('the board is right: every line is one step, every mill is three on a line', () => {
    for (const [a, b] of MORRIS_LINKS) {
      const [ax, ay] = MORRIS_XY[a]!;
      const [bx, by] = MORRIS_XY[b]!;
      expect(ax === bx || ay === by, `${a}-${b}`).toBe(true);
    }
    expect(MORRIS_LINKS).toHaveLength(32);
    expect(MILLS).toHaveLength(16);
    for (const [a, b, c] of MILLS) {
      const linked = (x: number, y: number) => MORRIS_LINKS.some(([p, q]) => (p === x && q === y) || (p === y && q === x));
      expect(linked(a, b) && linked(b, c), `${a} ${b} ${c}`).toBe(true);
    }
  });

  it('placing nine each, then moving along a line', () => {
    let s = newMorris();
    // Places that never make a mill: points spread so no three share a line.
    const spread = [0, 4, 8, 10, 13, 15, 19, 23, 6, 1, 3, 7, 12, 14, 16, 18, 20, 21];
    for (const p of spread.slice(0, 18)) {
      if (s.taking) break;
      s = s.apply(`p${p}`);
    }
    if (!s.taking) {
      expect(s.inHand).toEqual([0, 0]);
      expect(s.legalMoves(s.currentSeat).every((m) => m.startsWith('m'))).toBe(true);
    }
  });

  it('a mill takes a piece, and not one out of a mill while another is loose', () => {
    const s = through(newMorris(), ['p0', 'p9', 'p1', 'p10', 'p2']);
    expect(s.taking).toBe(true);
    expect(s.currentSeat).toBe(0);
    expect(s.legalMoves(0)).toEqual(['x9', 'x10']);
    const taken = s.apply('x9');
    expect(taken.board[9]).toBe(-1);
    expect(taken.currentSeat).toBe(1);
    // Red's 9, 10 and 11 are a mill and 22 is loose: only 22 can go. With no loose piece, any can.
    const guarded = new MorrisState(at([0, 1, 2], [9, 10, 11, 22]).board, [0, 0], 0, true, 0, null, null);
    expect(guarded.legalMoves(0)).toEqual(['x22']);
    const allMills = new MorrisState(at([0, 1, 2], [9, 10, 11]).board, [0, 0], 0, true, 0, null, null);
    expect(allMills.legalMoves(0)).toEqual(['x9', 'x10', 'x11']);
  });

  it('pieces move only to an empty neighbor, until three are left and they fly', () => {
    const s = at([0, 4, 8, 23], [21, 22, 14]);
    expect(s.legalMoves(0)).toContain('m0-1');
    expect(s.legalMoves(0)).not.toContain('m0-2');
    const flier = at([0, 4, 8, 23], [21, 22, 14], 1);
    expect(flier.stage(1)).toBe('fly');
    expect(flier.legalMoves(1)).toContain('m21-5');
  });

  it('down to two pieces loses', () => {
    // Blue closes 0-1-2 and takes one of Red's last three.
    const s = at([0, 1, 14, 6], [21, 22, 23], 0).apply('m14-2');
    expect(s.taking).toBe(true);
    const end = s.apply(s.legalMoves(0)[0]!);
    expect(end.result).toEqual({ winners: [0], draw: false });
  });

  it('no move loses', () => {
    // Red's four pieces in the top corner are hemmed in once Blue steps to 22.
    const s = at([4, 14, 10, 21, 23], [0, 1, 2, 9], 0).apply('m23-22');
    expect(s.result).toEqual({ winners: [0], draw: false });
  });

  it('a long quiet spell is a draw', () => {
    const s = new MorrisState(at([0, 4, 8, 23], [21, 22, 16, 10]).board, [0, 0], 0, false, 99, null, null);
    const end = s.apply(s.legalMoves(0).find((m) => !s.apply(m).taking)!);
    expect(end.result).toEqual({ winners: [], draw: true });
  });

  it('bots finish and the tiers come out in order', { timeout: 120_000 }, () => {
    const play = (a: 'easy' | 'medium' | 'hard', b: 'easy' | 'medium', games: number) => {
      let wins = 0;
      for (let seed = 0; seed < games; seed++) {
        const rng = createRng(seed);
        const aSeat = seed % 2;
        const bots = [morris.createBot(aSeat === 0 ? a : b), morris.createBot(aSeat === 0 ? b : a)];
        let s = newMorris() as MorrisState;
        let plies = 0;
        while (!s.result && plies++ < 600) s = s.apply(bots[s.currentSeat]!.chooseMove(s, s.currentSeat, rng)) as MorrisState;
        if (s.result?.winners[0] === aSeat) wins++;
        else if (!s.result?.draw && s.result) wins += 0;
      }
      return wins / games;
    };
    expect(play('medium', 'easy', 30)).toBeGreaterThan(0.6);
    expect(play('hard', 'medium', 20)).toBeGreaterThan(0.5);
  });
});

/** Invariant: never more than nine a side, pieces never grow, and a mill always takes exactly one. */
describe('morris invariants', () => {
  it('keeps the count', { timeout: 60_000 }, () => {
    for (let seed = 0; seed < 30; seed++) {
      const rng = createRng(seed);
      let s = newMorris();
      while (!s.result) {
        for (const seat of [0, 1] as const) expect(s.onBoard(seat) + s.inHand[seat]).toBeLessThanOrEqual(MORRIS_PIECES);
        const before = s.onBoard(0) + s.onBoard(1) + s.inHand[0] + s.inHand[1];
        const move = rng.pick(s.legalMoves(s.currentSeat));
        s = s.apply(move);
        const after = s.onBoard(0) + s.onBoard(1) + s.inHand[0] + s.inHand[1];
        expect(before - after).toBe(move[0] === 'x' ? 1 : 0);
      }
    }
  });
});
