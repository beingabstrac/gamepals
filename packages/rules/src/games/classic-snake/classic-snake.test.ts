import { describe, expect, it } from 'vitest';
import {
  CLASSIC_GRID,
  classicSnakeBotHeading,
  classicSnakeSteer,
  newClassicSnake,
  stepClassicSnake,
  type ClassicSnakeState,
  type Heading,
} from './index';

/** Runs the game until the next tick (skipping the countdown). */
function nextTick(state: ClassicSnakeState): { state: ClassicSnakeState; ate: boolean; crashed: boolean } {
  let s = state;
  for (let i = 0; i < 1000; i++) {
    const { state: next, events } = stepClassicSnake(s);
    s = next;
    if (events.tick) return { state: s, ate: events.ate, crashed: events.crashed };
    if (s.phase === 'over') break;
  }
  return { state: s, ate: false, crashed: false };
}

describe('classic snake', () => {
  it('moves one cell per tick and keeps its length', () => {
    const start = newClassicSnake(3);
    const { state } = nextTick({ ...start, fruit: { x: 0, y: 0 } });
    expect(state.body[0]).toEqual({ x: start.body[0]!.x, y: start.body[0]!.y - 1 });
    expect(state.body).toHaveLength(start.body.length);
  });

  it('grows by one and scores when it eats, and new food lands on an empty cell', () => {
    const start = newClassicSnake(3);
    const head = start.body[0]!;
    const { state, ate } = nextTick({ ...start, fruit: { x: head.x, y: head.y - 1 } });
    expect(ate).toBe(true);
    expect(state.body).toHaveLength(start.body.length + 1);
    expect(state.eaten).toBe(1);
    expect(state.body.some((c) => c.x === state.fruit!.x && c.y === state.fruit!.y)).toBe(false);
    expect(state.interval).toBeLessThan(start.interval);
  });

  it("can't reverse into itself, ignores repeats, and keeps two quick turns", () => {
    const start = newClassicSnake(1);
    expect(classicSnakeSteer(start, 2).queue).toEqual([]);
    expect(classicSnakeSteer(start, 0).queue).toEqual([]);
    const two = classicSnakeSteer(classicSnakeSteer(start, 1), 2);
    expect(two.queue).toEqual([1, 2]);
    expect(classicSnakeSteer(two, 3).queue).toEqual([1, 2]);
  });

  it('crashing into a wall ends the game', () => {
    let state: ClassicSnakeState = { ...newClassicSnake(2), fruit: { x: 0, y: CLASSIC_GRID.rows - 1 } };
    for (let i = 0; i < 40 && !state.result; i++) state = nextTick(state).state;
    expect(state.phase).toBe('over');
    expect(state.result).toEqual({ winners: [], draw: false });
  });

  it('crashing into itself ends the game', () => {
    // A long snake making a tight loop runs into its own body.
    const body = [4, 5, 6, 7, 8, 9].map((y) => ({ x: 5, y }));
    let state: ClassicSnakeState = { ...newClassicSnake(1), body, previous: body, heading: 0, phase: 'play', fruit: { x: 0, y: 0 } };
    for (const dir of [1, 2, 3] as Heading[]) {
      state = classicSnakeSteer(state, dir);
      state = nextTick(state).state;
    }
    expect(state.result).toEqual({ winners: [], draw: false });
  });

  it('food follows the seed', () => {
    expect(newClassicSnake(9).fruit).toEqual(newClassicSnake(9).fruit);
  });

  it('the autoplay bot eats plenty and never turns into a wall on purpose', () => {
    let total = 0;
    for (const seed of [1, 2, 3]) {
      let state = newClassicSnake(seed);
      for (let i = 0; i < 20_000 && !state.result; i++) {
        const { state: next, events } = stepClassicSnake(state);
        state = next;
        if (events.tick || state.queue.length === 0) state = classicSnakeSteer(state, classicSnakeBotHeading(state));
      }
      total += state.eaten;
    }
    expect(total / 3).toBeGreaterThan(20);
  });
});
