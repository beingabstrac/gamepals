import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import { newTwenty48, Twenty48State, twenty48, type Slide, type Tile } from './index';

/** A board from a row-by-row list of values (0 = empty), with a fixed seed. */
function board(values: number[], seed = 1): Twenty48State {
  const tiles: Tile[] = [];
  values.forEach((value, index) => {
    if (value) tiles.push({ id: index, value, index });
  });
  return new Twenty48State(tiles, 0, seed, 0, 100, null, null);
}

const row = (state: Twenty48State, r: number) =>
  [0, 1, 2, 3].map((c) => state.tiles.find((t) => t.index === r * 4 + c)?.value ?? 0);

describe('2048 rules', () => {
  it('starts with two tiles of 2 or 4', () => {
    const state = newTwenty48(7);
    expect(state.tiles).toHaveLength(2);
    for (const tile of state.tiles) expect([2, 4]).toContain(tile.value);
  });

  it('slides tiles as far as they go and merges each pair once', () => {
    const after = board([2, 2, 2, 2, ...Array(12).fill(0)]).apply('left');
    expect(row(after, 0).slice(0, 2)).toEqual([4, 4]);
    expect(after.score).toBe(8);
  });

  it('never merges a freshly merged tile again in the same move', () => {
    const after = board([4, 4, 8, 0, ...Array(12).fill(0)]).apply('left');
    expect(row(after, 0).slice(0, 2)).toEqual([8, 8]);
    expect(after.score).toBe(8);
  });

  it('merges toward the direction of the swipe', () => {
    const after = board([2, 0, 2, 4, ...Array(12).fill(0)]).apply('right');
    expect(row(after, 0).slice(2)).toEqual([4, 4]);
  });

  it('refuses a move that changes nothing', () => {
    const stuck = board([2, 4, 0, 0, ...Array(12).fill(0)]);
    expect(stuck.legalMoves(0)).not.toContain('left');
    expect(() => stuck.apply('left')).toThrow();
  });

  it('adds one new tile after every move, 2 about 90% of the time', () => {
    let twos = 0;
    let total = 0;
    for (let seed = 0; seed < 2000; seed++) {
      const after = board([2, 0, 0, 0, ...Array(12).fill(0)], seed).apply('right');
      expect(after.tiles).toHaveLength(2);
      const spawned = after.lastChange?.spawned;
      if (spawned?.value === 2) twos++;
      total++;
    }
    expect(twos / total).toBeGreaterThan(0.86);
    expect(twos / total).toBeLessThan(0.94);
  });

  it('a full board with no equal neighbours has no moves', () => {
    const locked = board([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2]);
    expect(locked.legalMoves(0)).toEqual([]);
  });

  it('the last move that locks the board ends the game', () => {
    // One gap left; filling it can only produce a locked board or a merge, never an illegal state.
    const almost = board([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 0]);
    let state = almost;
    for (let i = 0; i < 20 && !state.result && state.legalMoves(0).length > 0; i++) state = state.apply(state.legalMoves(0)[0]!);
    if (state.result) expect(state.result.winners).toEqual([]);
    else expect(state.legalMoves(0).length).toBeGreaterThan(0);
  });

  it('replays exactly from a move log', () => {
    const rng = createRng(3);
    let state = newTwenty48(42);
    const moves: Slide[] = [];
    for (let i = 0; i < 60 && !state.result; i++) {
      const move = rng.pick(state.legalMoves(0));
      moves.push(move);
      state = state.apply(move);
    }
    const replayed = replay(twenty48, toMoveLog(twenty48, { players: 1 }, 42, moves)) as Twenty48State;
    expect(replayed.tiles).toEqual(state.tiles);
    expect(replayed.score).toBe(state.score);
  });

  it('a thinking bot scores more than a random one', () => {
    const play = (tier: 'easy' | 'expert', seed: number) => {
      const rng = createRng(seed);
      const bot = twenty48.createBot(tier);
      let state = twenty48.newGame({ players: 1 }, seed) as Twenty48State;
      for (let i = 0; i < 400 && !state.result; i++) state = state.apply(bot.chooseMove(state, 0, rng));
      return state.score;
    };
    let smart = 0;
    let random = 0;
    for (let seed = 0; seed < 3; seed++) {
      smart += play('expert', seed);
      random += play('easy', seed);
    }
    expect(smart).toBeGreaterThan(random);
  });
});
