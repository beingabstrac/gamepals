import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { NM_ADDS, NM_START, newNumberMatch, numberMatch, NumberState } from './index';

/** A grid by hand: digits in reading order, 0 meaning a crossed-out cell. */
const grid = (digits: number[], adds = NM_ADDS) =>
  new NumberState(
    digits.map((d) => d || 5),
    digits.map((d) => d === 0),
    adds,
    0,
    null,
    null,
  );

describe('number match', () => {
  it('pairs are the same number or make ten', () => {
    const s = grid([3, 7, 3, 4, 1, 1, 9, 9, 2]);
    expect(s.canPair(0, 1)).toBe(true);
    expect(s.canPair(4, 5)).toBe(true);
    expect(s.canPair(2, 3)).toBe(false);
  });

  it('only crossed-out numbers may lie between them: across, down, diagonal and reading on', () => {
    // Row 0: 3 _ _ 3, the gaps crossed out.
    const across = grid([3, 0, 0, 3, 1, 2, 4, 6, 8]);
    expect(across.canPair(0, 3)).toBe(true);
    const blocked = grid([3, 1, 0, 3, 2, 4, 6, 8, 9]);
    expect(blocked.canPair(0, 3)).toBe(false);
    // Down a column, and on a diagonal.
    const rows = [
      [4, 1, 2, 3, 5, 6, 8, 9, 7],
      [0, 1, 1, 2, 3, 6, 8, 9, 7],
      [6, 2, 4, 1, 1, 2, 3, 4, 5],
    ].flat();
    const s = grid(rows);
    expect(s.canPair(0, 18)).toBe(true);
    expect(s.canPair(0, 20)).toBe(false);
    const diag = grid([
      [4, 1, 2, 3, 5, 6, 8, 9, 7],
      [2, 0, 1, 2, 3, 6, 8, 9, 7],
      [3, 2, 6, 1, 1, 2, 3, 4, 5],
    ].flat());
    expect(diag.canPair(0, 20)).toBe(true);
    // Reading on from the end of one row to the start of the next.
    const wrap = grid([1, 2, 3, 4, 5, 6, 7, 8, 2, 8, 1, 2, 3, 4, 6, 7, 1, 2]);
    expect(wrap.canPair(8, 9)).toBe(true);
  });

  it('a row with nothing left vanishes and scores ten', () => {
    const s = grid([0, 0, 0, 0, 3, 7, 0, 0, 0, 1, 2, 4, 5, 6, 8, 9, 1, 2]);
    const next = s.apply('p4-5');
    expect(next.values).toHaveLength(9);
    expect(next.last?.rows).toBe(1);
    expect(next.score).toBe(11);
  });

  it('add copies every number still standing onto the end', () => {
    const s = newNumberMatch(3);
    const standing = s.values.length;
    const next = s.apply('add');
    expect(next.values).toHaveLength(standing * 2);
    expect(next.adds).toBe(NM_ADDS - 1);
  });

  it('clearing everything wins; stuck with no adds loses', () => {
    const win = grid([4, 6, 0, 0, 0, 0, 0, 0, 0], 0);
    expect(win.apply('p0-1').result).toEqual({ winners: [0], draw: false });
    // One row, nothing next to its own kind or its ten: no pair anywhere.
    const stuck = grid([1, 2, 1, 2, 1, 2, 1, 2, 1], 0);
    expect(stuck.pairs()).toHaveLength(0);
  });

  it('starts with 36 numbers, the same for the same seed', () => {
    expect(newNumberMatch(4).values).toHaveLength(NM_START);
    expect(numberMatch.newGame({ players: 1 }, 4)).toEqual(newNumberMatch(4));
  });

  it('test play finishes', { timeout: 60_000 }, () => {
    const bot = numberMatch.createBot('medium');
    for (let seed = 0; seed < 10; seed++) {
      const rng = createRng(seed);
      let s = newNumberMatch(seed) as NumberState;
      let moves = 0;
      while (!s.result && moves++ < 2000) s = s.apply(bot.chooseMove(s, 0, rng)) as NumberState;
      expect(s.result).not.toBeNull();
    }
  });
});

/** Invariant: a number never changes, and every crossing out takes exactly two. */
describe('number match invariants', () => {
  it('keeps the count', () => {
    for (let seed = 0; seed < 15; seed++) {
      const rng = createRng(seed);
      let s = newNumberMatch(seed);
      let moves = 0;
      while (!s.result && moves++ < 400) {
        const move = rng.pick(s.legalMoves(0));
        const standing = s.gone.filter((g) => !g).length;
        s = s.apply(move);
        const after = s.gone.filter((g) => !g).length;
        expect(after).toBe(move === 'add' ? standing * 2 : standing - 2);
      }
    }
  });
});
