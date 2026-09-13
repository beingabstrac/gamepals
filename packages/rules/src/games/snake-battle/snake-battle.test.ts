import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import type { BotTier, Seat } from '../../core/types';
import {
  GRID,
  newSnakeGame,
  SNAKE_STEP,
  SNAKE_TIERS,
  snakeBotTurn,
  snakeTurn,
  stepSnake,
  type GridCell,
  type Snake,
  type SnakeEvents,
  type SnakeState,
} from './index';

const playing = (seed = 1): SnakeState => ({ ...newSnakeGame(seed), phase: 'play', timer: 0 });

/** Steps until the next tick happens and returns the state right after it. */
function nextTick(state: SnakeState): { state: SnakeState; events: SnakeEvents } {
  let s = state;
  for (let i = 0; i < 1000; i++) {
    const r = stepSnake(s);
    s = r.state;
    if (r.events.tick) return { state: s, events: r.events };
  }
  throw new Error('No tick happened');
}

const withSnakes = (state: SnakeState, snakes: [Snake, Snake], fruit: GridCell = { x: 0, y: 0 }): SnakeState => ({ ...state, snakes, fruit });

function match(tiers: [BotTier, BotTier], seed: number): SnakeState {
  const rng = createRng(seed);
  let state = newSnakeGame(seed);
  for (let i = 0; i < 600 / SNAKE_STEP && !state.result; i++) {
    const r = stepSnake(state);
    state = r.state;
    if (r.events.tick || (state.phase === 'play' && state.ticks === 0)) {
      for (const seat of [0, 1] as Seat[]) {
        const turn = snakeBotTurn(state, seat, SNAKE_TIERS[tiers[seat]], rng.next(), rng.next() * 2 - 1);
        if (turn !== 0) state = snakeTurn(state, seat, turn);
      }
    }
  }
  return state;
}

describe('snake battle', () => {
  it('snakes move one cell forward per tick', () => {
    const start = playing();
    const { state } = nextTick(start);
    expect(state.snakes[0].body[0]).toEqual({ x: 8, y: start.snakes[0].body[0]!.y - 1 });
    expect(state.snakes[1].body[0]).toEqual({ x: 9, y: start.snakes[1].body[0]!.y + 1 });
    expect(state.snakes[0].body).toHaveLength(4);
  });

  it('turns are relative to where the snake faces', () => {
    const turnedRight = nextTick(snakeTurn(playing(), 0, 1)).state;
    expect(turnedRight.snakes[0].dir).toBe(1);
    const turnedLeft = nextTick(snakeTurn(playing(), 1, -1)).state;
    // Seat 1 starts facing down; its left is the screen's right.
    expect(turnedLeft.snakes[1].dir).toBe(1);
  });

  it('eating fruit grows the snake and moves the fruit to an empty cell', () => {
    const start = playing();
    const head = start.snakes[0].body[0]!;
    const ate = nextTick({ ...start, fruit: { x: head.x, y: head.y - 1 } });
    expect(ate.events.ate[0]).toBe(true);
    expect(ate.state.snakes[0].body).toHaveLength(5);
    const occupied = ate.state.snakes.flatMap((s) => s.body);
    expect(occupied.some((c) => c.x === ate.state.fruit.x && c.y === ate.state.fruit.y)).toBe(false);
  });

  it('hitting a wall loses the round', () => {
    const edge: Snake = { body: [{ x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }], dir: 3, queue: [] };
    const { state } = nextTick(withSnakes(playing(), [edge, playing().snakes[1]]));
    expect(state.phase).toBe('roundOver');
    expect(state.rounds).toEqual([0, 1]);
  });

  it('running into yourself loses the round', () => {
    const coiled: Snake = { body: [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 6, y: 5 }, { x: 6, y: 4 }], dir: 0, queue: [1] };
    const { state } = nextTick(withSnakes(playing(), [coiled, playing().snakes[1]]));
    expect(state.lastRound?.crashed).toEqual([true, false]);
  });

  it('running into the other snake loses; head-on is a draw', () => {
    const a: Snake = { body: [{ x: 5, y: 10 }, { x: 5, y: 11 }], dir: 0, queue: [] };
    const wall: Snake = { body: [{ x: 3, y: 9 }, { x: 4, y: 9 }, { x: 5, y: 9 }, { x: 6, y: 9 }], dir: 3, queue: [] };
    expect(nextTick(withSnakes(playing(), [a, wall])).state.rounds).toEqual([0, 1]);

    const up: Snake = { body: [{ x: 5, y: 10 }, { x: 5, y: 11 }], dir: 0, queue: [] };
    const down: Snake = { body: [{ x: 5, y: 8 }, { x: 5, y: 7 }], dir: 2, queue: [] };
    const headOn = nextTick(withSnakes(playing(), [up, down])).state;
    expect(headOn.lastRound?.winner).toBeNull();
    expect(headOn.rounds).toEqual([0, 0]);
  });

  it('bots at Hard and above never steer into a wall they can avoid', () => {
    const edge: Snake = { body: [{ x: 0, y: 12 }, { x: 1, y: 12 }, { x: 2, y: 12 }], dir: 3, queue: [] };
    const state = withSnakes(playing(), [edge, playing().snakes[1]], { x: 10, y: 10 });
    for (const tier of ['hard', 'expert'] as const) {
      expect(snakeBotTurn(state, 0, SNAKE_TIERS[tier], 1, 0)).not.toBe(0);
    }
  });

  it('Nova (expert) beats Pip (easy) from either side', () => {
    expect(match(['expert', 'easy'], 1).result?.winners).toEqual([0]);
    expect(match(['easy', 'expert'], 2).result?.winners).toEqual([1]);
  });

  it('the board is the size the scene draws', () => {
    expect(GRID).toEqual({ cols: 18, rows: 24 });
  });
});
