import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { dealPicture, lineSolve, newNonogram, nonogram, NonoState, runs, solveLine } from './index';

describe('nonogram', () => {
  it('reads the runs in a line', () => {
    expect(runs([true, true, false, true, false, false, true, true, true])).toEqual([2, 1, 3]);
    expect(runs([false, false])).toEqual([]);
  });

  it('line logic finds the squares every fit agrees on', () => {
    // A run of 4 in 5: the middle three are filled whatever happens.
    expect(solveLine([4], [-1, -1, -1, -1, -1])).toEqual([-1, 1, 1, 1, -1]);
    // 3 and 1 in 5 fit exactly one way.
    expect(solveLine([3, 1], [-1, -1, -1, -1, -1])).toEqual([1, 1, 1, 0, 1]);
    // A known square can settle the rest.
    expect(solveLine([1], [-1, -1, 1, -1, -1])).toEqual([0, 0, 1, 0, 0]);
    expect(solveLine([2], [0, 1, 0, 0, 0])).toBeNull();
  });

  it('every picture is mirrored, has no blank lines, and line logic alone solves it', () => {
    for (const size of [5, 10, 15]) {
      for (let seed = 0; seed < (size === 15 ? 4 : 12); seed++) {
        const pic = dealPicture(seed, size);
        for (const row of pic) expect(row).toEqual(row.slice().reverse());
        expect(pic.every((r) => r.some(Boolean))).toBe(true);
        const solved = lineSolve(pic.map(runs), pic[0]!.map((_, x) => runs(pic.map((r) => r[x]!))));
        expect(solved?.map((r) => r.map((v) => v === 1))).toEqual(pic);
      }
    }
  });

  it('filling the picture wins; marks do not count as filled', () => {
    let s = newNonogram(3, 'small');
    s.picture.forEach((row, y) => row.forEach((v, x) => {
      if (!v) s = s.apply(`x${y * 5 + x}`);
    }));
    expect(s.result).toBeNull();
    s.picture.forEach((row, y) => row.forEach((v, x) => {
      if (v && !s.result) s = s.apply(`f${y * 5 + x}`);
    }));
    expect(s.result).toEqual({ winners: [0], draw: false });
  });

  it('a wrong square blocks the win until it is cleared', () => {
    let s = newNonogram(5, 'small');
    const wrong = s.picture.flat().findIndex((v) => !v);
    s = s.apply(`f${wrong}`);
    s.picture.forEach((row, y) => row.forEach((v, x) => {
      if (v) s = s.apply(`f${y * 5 + x}`);
    }));
    expect(s.result).toBeNull();
    expect(s.apply(`c${wrong}`).result).toEqual({ winners: [0], draw: false });
  });

  it('a line lights up when it matches its clue', () => {
    let s = newNonogram(2, 'small');
    const row = 0;
    s.picture[row]!.forEach((v, x) => {
      if (v) s = s.apply(`f${row * 5 + x}`);
    });
    expect(s.lineDone('row', row)).toBe(true);
  });

  it('test play solves it, and the same seed deals the same picture', () => {
    const bot = nonogram.createBot('medium');
    let s = newNonogram(9, 'medium') as NonoState;
    const rng = createRng(1);
    while (!s.result) s = s.apply(bot.chooseMove(s, 0, rng)) as NonoState;
    expect(s.result.winners).toEqual([0]);
    expect(newNonogram(9, 'medium')).toEqual(newNonogram(9, 'medium'));
  });
});

/** Invariant: the picture never changes under the player, and only one square changes a move. */
describe('nonogram invariants', () => {
  it('keeps the picture fixed', () => {
    for (let seed = 0; seed < 10; seed++) {
      const rng = createRng(seed);
      let s = newNonogram(seed, 'small');
      const pic = JSON.stringify(s.picture);
      for (let n = 0; n < 60 && !s.result; n++) {
        const before = s.cells;
        s = s.apply(rng.pick(s.legalMoves(0)));
        expect(JSON.stringify(s.picture)).toBe(pic);
        expect(s.cells.filter((v, i) => v !== before[i])).toHaveLength(1);
      }
    }
  });
});
