import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import { isSolvableLayout, newSliding, SLIDING_LEVELS, slideMove, slidingPuzzle, SlidingState, type SlidingMove } from './index';

/** A 3×3 board from a row-by-row list (0 is the space). */
const board = (tiles: number[]) => new SlidingState(3, tiles, tiles.indexOf(0), 0, [tiles.indexOf(0)], null, []);

describe('sliding puzzle shuffle', () => {
  it('is always solvable, never already solved, and follows the seed', () => {
    for (const level of SLIDING_LEVELS) {
      for (let seed = 0; seed < 20; seed++) {
        const state = newSliding(seed, level);
        expect(isSolvableLayout(state.tiles, state.n)).toBe(true);
        expect(state.solved).toBe(false);
        expect([...state.tiles].sort((a, b) => a - b)).toEqual(Array.from({ length: state.n * state.n }, (_, i) => i));
      }
    }
    expect(newSliding(7, '4x4').tiles).toEqual(newSliding(7, '4x4').tiles);
  });

  it('the parity check spots an unsolvable layout', () => {
    expect(isSolvableLayout([1, 2, 3, 4, 5, 6, 7, 8, 0], 3)).toBe(true);
    expect(isSolvableLayout([1, 2, 3, 4, 5, 6, 8, 7, 0], 3)).toBe(false);
  });
});

describe('sliding puzzle rules', () => {
  it('slides one tile into the space and counts one move', () => {
    const state = board([1, 2, 3, 4, 5, 6, 7, 0, 8]);
    const after = state.apply(slideMove(8));
    expect(after.tiles).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 0]);
    expect(after.moves).toBe(1);
    expect(after.result).toEqual({ winners: [0], draw: false });
  });

  it('tapping further along a row or column slides every tile in between', () => {
    const state = board([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    const row = state.apply(slideMove(2));
    expect(row.tiles.slice(0, 3)).toEqual([1, 2, 0]);
    expect(row.moves).toBe(2);
    expect(row.last).toEqual([
      { tile: 1, from: 1, to: 0 },
      { tile: 2, from: 2, to: 1 },
    ]);
    const column = state.apply(slideMove(6));
    expect([column.tiles[0], column.tiles[3], column.tiles[6]]).toEqual([3, 6, 0]);
  });

  it("tiles outside the space's row and column can't move", () => {
    const state = board([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(state.legalMoves(0)).not.toContain(slideMove(4));
    expect(() => state.apply(slideMove(4))).toThrow();
    expect(state.legalMoves(1)).toEqual([]);
  });

  it('retracing the trail solves every size', () => {
    for (const level of SLIDING_LEVELS) {
      let state = newSliding(3, level);
      for (let i = 0; i < 5000 && !state.result; i++) state = state.apply(slideMove(state.trail[state.trail.length - 2]!));
      expect(state.result).toEqual({ winners: [0], draw: false });
      expect(state.solved).toBe(true);
    }
  });

  it('the autoplay bot finishes with legal moves, and games replay exactly', () => {
    const bot = slidingPuzzle.createBot('expert');
    const rng = createRng(1);
    let state = slidingPuzzle.newGame({ players: 1, variant: '4x4' }, 11) as SlidingState;
    // A few player moves first, so the bot has to deal with them too.
    // Each move is picked from the position after the one before (the space moves every time).
    for (let i = 0; i < 2; i++) state = state.apply(state.legalMoves(0)[0]!);
    const moves: SlidingMove[] = [];
    while (!state.result) {
      const move = bot.chooseMove(state, 0, rng);
      expect(state.legalMoves(0)).toContain(move);
      moves.push(move);
      state = state.apply(move);
    }
    expect(state.solved).toBe(true);
    const fresh = replay(slidingPuzzle, toMoveLog(slidingPuzzle, { players: 1, variant: '4x4' }, 11, []));
    expect((fresh as SlidingState).tiles).toEqual(newSliding(11, '4x4').tiles);
  });
});
