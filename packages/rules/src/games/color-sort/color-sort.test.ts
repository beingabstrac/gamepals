import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import {
  canPour,
  COLOR_SORT_LEVELS,
  colorSort,
  ColorSortState,
  isSorted,
  newColorSort,
  pourMove,
  solveColorSort,
  TUBE_SIZE,
  UNDO_POUR,
  type ColorSortMove,
} from './index';

const tubesOf = (tubes: number[][]) => new ColorSortState('easy', tubes, 0, null, null, null);

describe('color sort pouring', () => {
  it('pours only onto an empty tube or the same color, and never into a full tube', () => {
    const tubes = [[0, 1], [1], [0, 0, 0, 1], []];
    expect(canPour(tubes, 0, 1)).toBe(true);
    expect(canPour(tubes, 0, 3)).toBe(true);
    expect(canPour(tubes, 1, 2)).toBe(false);
    expect(canPour(tubes, 1, 1)).toBe(false);
    expect(canPour(tubes, 3, 0)).toBe(false);
  });

  it('moves as much of the top color as fits', () => {
    const state = tubesOf([[0, 1, 1, 1], [2, 2, 1], [], []]);
    const after = state.apply(pourMove(0, 1));
    expect(after.tubes[1]).toEqual([2, 2, 1, 1]);
    expect(after.tubes[0]).toEqual([0, 1, 1]);
    expect(after.last).toEqual({ from: 0, to: 1, color: 1, count: 1 });
    const all = state.apply(pourMove(0, 2));
    expect(all.tubes[2]).toEqual([1, 1, 1]);
  });

  it('illegal pours throw; undo restores the tubes', () => {
    const state = tubesOf([[0, 1], [1], [0, 0, 0], []]);
    expect(() => state.apply(pourMove(1, 2))).toThrow();
    const after = state.apply(pourMove(0, 1));
    expect(after.apply(UNDO_POUR).tubes).toEqual(state.tubes);
    expect(state.legalMoves(0)).not.toContain(UNDO_POUR);
  });

  it('sorting every tube wins', () => {
    const state = tubesOf([[0, 0, 0, 1], [1, 1, 1], [0], []]);
    expect(isSorted(state.tubes)).toBe(false);
    const after = state.apply(pourMove(0, 1)).apply(pourMove(0, 2));
    expect(isSorted(after.tubes)).toBe(true);
    expect(after.result).toEqual({ winners: [0], draw: false });
  });
});

describe('color sort deals and solver', () => {
  it('every level deals a solvable, unsorted puzzle from the seed', () => {
    for (const level of COLOR_SORT_LEVELS) {
      for (const seed of [1, 2, 3]) {
        const state = newColorSort(seed, level);
        expect(isSorted(state.tubes)).toBe(false);
        expect(state.tubes.flat()).toHaveLength((state.tubes.length - 2) * TUBE_SIZE);
        const path = solveColorSort(state.tubes)!;
        expect(path).not.toBeNull();
        let s = state;
        for (const [from, to] of path) s = s.apply(pourMove(from, to));
        expect(s.result).toEqual({ winners: [0], draw: false });
      }
    }
    expect(newColorSort(9, 'medium').tubes).toEqual(newColorSort(9, 'medium').tubes);
  });

  it('the bot finishes with legal moves, and games replay exactly', () => {
    const bot = colorSort.createBot('expert');
    const rng = createRng(1);
    let state = colorSort.newGame({ players: 1, variant: 'medium' }, 5) as ColorSortState;
    const moves: ColorSortMove[] = [];
    for (let i = 0; i < 500 && !state.result; i++) {
      const move = bot.chooseMove(state, 0, rng);
      expect(state.legalMoves(0)).toContain(move);
      moves.push(move);
      state = state.apply(move);
    }
    expect(state.result).toEqual({ winners: [0], draw: false });
    const replayed = replay(colorSort, toMoveLog(colorSort, { players: 1, variant: 'medium' }, 5, moves)) as ColorSortState;
    expect(replayed.tubes).toEqual(state.tubes);
  });
});

/**
 * Liquid is poured from one tube to another, never made and never spilled, so every colour is in
 * the puzzle exactly as many times as a full tube holds however far along it is.
 */
describe('color sort conservation', () => {
  it('keeps exactly one tube of every colour', () => {
    for (const level of COLOR_SORT_LEVELS) {
      for (let seed = 0; seed < 8; seed++) {
        const rng = createRng(seed);
        let state = newColorSort(seed, level);
        const colours = new Set(state.tubes.flat());
        for (let move = 0; move < 200 && !state.result; move++) {
          const counts = new Map<number, number>();
          for (const colour of state.tubes.flat()) counts.set(colour, (counts.get(colour) ?? 0) + 1);
          expect([...counts.keys()].sort(), `${level}, seed ${seed}, move ${move}`).toEqual([...colours].sort());
          for (const [colour, seen] of counts) expect(seen, `${level}, seed ${seed}, move ${move}, colour ${colour}`).toBe(TUBE_SIZE);
          const moves = state.legalMoves(0);
          if (moves.length === 0) break;
          state = state.apply(rng.pick(moves));
        }
      }
    }
  });
});
