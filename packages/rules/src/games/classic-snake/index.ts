import { createRng } from '../../core/rng';
import type { GameResult, RealtimeGameDefinition } from '../../core/types';

/**
 * Classic Snake (docs/games/classic-snake.md): one snake, a walled grid, grow by eating,
 * crash into a wall or yourself and it's over. Fill the board to win.
 */
export const CLASSIC_GRID = { cols: 16, rows: 22 } as const;
export const CLASSIC_STEP = 1 / 120;

const START_INTERVAL = 0.15;
const MIN_INTERVAL = 0.07;
const SPEEDUP = 0.003;
const COUNTDOWN = 1.0;
const MAX_QUEUED = 2;

/** 0 up, 1 right, 2 down, 3 left. */
export type Heading = 0 | 1 | 2 | 3;
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

export interface SnakeCell {
  readonly x: number;
  readonly y: number;
}

export interface ClassicSnakeState {
  readonly seed: number;
  /** Head first. */
  readonly body: readonly SnakeCell[];
  /** Body before the last tick, so views can glide between cells. */
  readonly previous: readonly SnakeCell[];
  readonly heading: Heading;
  /** Up to two turns, so quick double turns are never lost. */
  readonly queue: readonly Heading[];
  readonly fruit: SnakeCell | null;
  readonly fruitCount: number;
  readonly eaten: number;
  readonly phase: 'countdown' | 'play' | 'over';
  readonly timer: number;
  readonly tickTimer: number;
  readonly interval: number;
  readonly result: GameResult | null;
}

export interface ClassicSnakeEvents {
  tick: boolean;
  ate: boolean;
  crashed: boolean;
}

const same = (a: SnakeCell, b: SnakeCell) => a.x === b.x && a.y === b.y;
const inBounds = (c: SnakeCell) => c.x >= 0 && c.x < CLASSIC_GRID.cols && c.y >= 0 && c.y < CLASSIC_GRID.rows;
const step = (c: SnakeCell, dir: Heading): SnakeCell => ({ x: c.x + DX[dir]!, y: c.y + DY[dir]! });
const opposite = (a: Heading, b: Heading) => (a + 2) % 4 === b;

/** Food on an empty cell, chosen from the seed; null when the board is full. */
function placeFruit(seed: number, count: number, body: readonly SnakeCell[]): SnakeCell | null {
  const taken = new Set(body.map((c) => `${c.x},${c.y}`));
  const empty: SnakeCell[] = [];
  for (let y = 0; y < CLASSIC_GRID.rows; y++) {
    for (let x = 0; x < CLASSIC_GRID.cols; x++) if (!taken.has(`${x},${y}`)) empty.push({ x, y });
  }
  if (empty.length === 0) return null;
  return empty[createRng((seed ^ Math.imul(count + 1, 0x27d4eb2d)) >>> 0).int(empty.length)]!;
}

export function newClassicSnake(seed: number): ClassicSnakeState {
  const s = seed >>> 0;
  const x = Math.floor(CLASSIC_GRID.cols / 2);
  const body = [0, 1, 2].map((i) => ({ x, y: CLASSIC_GRID.rows - 6 + i }));
  return {
    seed: s,
    body,
    previous: body,
    heading: 0,
    queue: [],
    fruit: placeFruit(s, 0, body),
    fruitCount: 1,
    eaten: 0,
    phase: 'countdown',
    timer: COUNTDOWN,
    tickTimer: 0,
    interval: START_INTERVAL,
    result: null,
  };
}

/** Point the snake a new way. Reversing into itself and repeats are ignored. */
export function classicSnakeSteer(state: ClassicSnakeState, dir: Heading): ClassicSnakeState {
  if (state.result || state.queue.length >= MAX_QUEUED) return state;
  const last = state.queue[state.queue.length - 1] ?? state.heading;
  if (dir === last || opposite(dir, last)) return state;
  return { ...state, queue: [...state.queue, dir] };
}

function tick(state: ClassicSnakeState, events: ClassicSnakeEvents): ClassicSnakeState {
  events.tick = true;
  const [next, ...queue] = state.queue;
  const heading = next ?? state.heading;
  const head = step(state.body[0]!, heading);
  const eats = state.fruit !== null && same(head, state.fruit);
  const body = [head, ...(eats ? state.body : state.body.slice(0, -1))];
  if (!inBounds(head) || body.slice(1).some((c) => same(c, head))) {
    events.crashed = true;
    // The crash is drawn where the snake was, so it doesn't poke through the wall.
    return { ...state, heading, queue, previous: state.body, phase: 'over', result: { winners: [], draw: false } };
  }
  events.ate = eats;
  const fruit = eats ? placeFruit(state.seed, state.fruitCount, body) : state.fruit;
  const won = eats && fruit === null;
  return {
    ...state,
    body,
    previous: state.body,
    heading,
    queue,
    fruit,
    fruitCount: eats ? state.fruitCount + 1 : state.fruitCount,
    eaten: state.eaten + (eats ? 1 : 0),
    interval: eats ? Math.max(MIN_INTERVAL, state.interval - SPEEDUP) : state.interval,
    phase: won ? 'over' : 'play',
    result: won ? { winners: [0], draw: false } : null,
  };
}

export function stepClassicSnake(state: ClassicSnakeState, dt = CLASSIC_STEP): { state: ClassicSnakeState; events: ClassicSnakeEvents } {
  const events: ClassicSnakeEvents = { tick: false, ate: false, crashed: false };
  if (state.phase === 'over') return { state, events };
  if (state.phase === 'countdown') {
    const timer = state.timer - dt;
    return { state: timer > 0 ? { ...state, timer } : { ...state, phase: 'play', timer: 0 }, events };
  }
  const tickTimer = state.tickTimer + dt;
  if (tickTimer < state.interval) return { state: { ...state, tickTimer }, events };
  return { state: tick({ ...state, tickTimer: tickTimer - state.interval }, events), events };
}

const key = (c: SnakeCell) => c.y * CLASSIC_GRID.cols + c.x;

/** Cells reachable from `from` without crossing `blocked` (flood fill). */
function room(from: SnakeCell, blocked: Set<number>): number {
  const seen = new Set<number>([key(from)]);
  const queue = [from];
  while (queue.length) {
    const cell = queue.shift()!;
    for (const dir of [0, 1, 2, 3] as Heading[]) {
      const next = step(cell, dir);
      const k = key(next);
      if (inBounds(next) && !blocked.has(k) && !seen.has(k)) {
        seen.add(k);
        queue.push(next);
      }
    }
  }
  return seen.size;
}

/**
 * Autoplay only: the next heading. Takes the shortest safe path to the fruit if the snake would still
 * have room afterwards; otherwise the move that leaves the most room.
 */
export function classicSnakeBotHeading(state: ClassicSnakeState): Heading {
  const body = state.body;
  const head = body[0]!;
  // The tail moves out of the way next tick.
  const blocked = new Set(body.slice(0, -1).map(key));
  const options = ([0, 1, 2, 3] as Heading[]).filter((dir) => !opposite(dir, state.heading)).filter((dir) => {
    const next = step(head, dir);
    return inBounds(next) && !blocked.has(key(next));
  });
  if (options.length === 0) return state.heading;

  if (state.fruit) {
    // Breadth-first search to the fruit.
    const target = state.fruit;
    const first = new Map<number, Heading>();
    const queue: SnakeCell[] = [];
    for (const dir of options) {
      const next = step(head, dir);
      first.set(key(next), dir);
      queue.push(next);
    }
    while (queue.length) {
      const cell = queue.shift()!;
      const dir = first.get(key(cell))!;
      if (same(cell, target)) {
        const after = new Set(blocked).add(key(step(head, dir)));
        if (room(step(head, dir), after) > body.length + 2) return dir;
        break;
      }
      for (const d of [0, 1, 2, 3] as Heading[]) {
        const next = step(cell, d);
        const k = key(next);
        if (inBounds(next) && !blocked.has(k) && !first.has(k) && !same(next, head)) {
          first.set(k, dir);
          queue.push(next);
        }
      }
    }
  }
  // No safe path to the food: stay alive by taking the roomiest move.
  let best = options[0]!;
  let bestRoom = -1;
  for (const dir of options) {
    const next = step(head, dir);
    const space = room(next, new Set(blocked).add(key(next)));
    if (space > bestRoom) {
      bestRoom = space;
      best = dir;
    }
  }
  return best;
}

export const classicSnake: RealtimeGameDefinition = {
  id: 'classic-snake',
  name: 'Classic Snake',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo', 'race'],
  realtime: true,
};
