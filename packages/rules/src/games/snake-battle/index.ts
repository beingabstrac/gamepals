import { createRng } from '../../core/rng';
import type { BotTier, GameResult, RealtimeGameDefinition, Seat } from '../../core/types';

/**
 * Snake Battle (docs/games/snake-battle.md): two snakes on one grid. Crash into a wall, yourself or
 * the other snake and you lose the round; head-on is a draw. First to 3 rounds wins.
 */
export const GRID = { cols: 18, rows: 24 } as const;
export const SNAKE_STEP = 1 / 120;
export const ROUNDS_TO_WIN = 3;

const START_INTERVAL = 0.16;
const MIN_INTERVAL = 0.09;
const SPEEDUP = 0.004;
const COUNTDOWN = 1.2;
const ROUND_PAUSE = 1.5;
const MAX_QUEUED_TURNS = 2;

/** 0 up, 1 right, 2 down, 3 left. */
export type Dir = 0 | 1 | 2 | 3;
export type Turn = -1 | 1;
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

export interface GridCell {
  readonly x: number;
  readonly y: number;
}

export interface Snake {
  /** Head first. */
  readonly body: readonly GridCell[];
  readonly dir: Dir;
  readonly queue: readonly Turn[];
}

/** countdown: get ready · play: snakes moving · roundOver: short pause after a crash. */
export type SnakePhase = 'countdown' | 'play' | 'roundOver';

export interface SnakeState {
  readonly seed: number;
  readonly snakes: readonly [Snake, Snake];
  /** Bodies before the last tick, so views can glide between cells. */
  readonly previous: readonly [readonly GridCell[], readonly GridCell[]];
  readonly fruit: GridCell;
  readonly fruitCount: number;
  readonly phase: SnakePhase;
  readonly timer: number;
  readonly tickTimer: number;
  readonly interval: number;
  readonly ticks: number;
  readonly rounds: readonly [number, number];
  readonly lastRound: { readonly winner: Seat | null; readonly crashed: readonly [boolean, boolean] } | null;
  readonly result: GameResult | null;
}

export interface SnakeEvents {
  tick: boolean;
  ate: [boolean, boolean];
  roundOver: boolean;
}

const same = (a: GridCell, b: GridCell) => a.x === b.x && a.y === b.y;
const inBounds = (c: GridCell) => c.x >= 0 && c.x < GRID.cols && c.y >= 0 && c.y < GRID.rows;
const step = (c: GridCell, dir: Dir): GridCell => ({ x: c.x + DX[dir]!, y: c.y + DY[dir]! });
export const turned = (dir: Dir, turn: Turn | 0): Dir => (((dir + turn) % 4) + 4) % 4 as Dir;

function startSnakes(): readonly [Snake, Snake] {
  const bottom = GRID.rows - 5;
  return [
    { body: [0, 1, 2, 3].map((i) => ({ x: 8, y: bottom + i })), dir: 0, queue: [] },
    { body: [0, 1, 2, 3].map((i) => ({ x: 9, y: 4 - i })), dir: 2, queue: [] },
  ];
}

/** New fruit on an empty cell, chosen from the seed so games replay the same everywhere. */
function placeFruit(seed: number, count: number, bodies: readonly (readonly GridCell[])[]): GridCell {
  const taken = new Set(bodies.flat().map((c) => `${c.x},${c.y}`));
  const empty: GridCell[] = [];
  for (let y = 0; y < GRID.rows; y++) {
    for (let x = 0; x < GRID.cols; x++) if (!taken.has(`${x},${y}`)) empty.push({ x, y });
  }
  const rng = createRng((seed ^ Math.imul(count + 1, 0x27d4eb2d)) >>> 0);
  return empty[rng.int(empty.length)]!;
}

function freshRound(state: Pick<SnakeState, 'seed' | 'fruitCount' | 'rounds' | 'result'>): SnakeState {
  const snakes = startSnakes();
  return {
    seed: state.seed,
    snakes,
    previous: [snakes[0].body, snakes[1].body],
    fruit: placeFruit(state.seed, state.fruitCount, snakes.map((s) => s.body)),
    fruitCount: state.fruitCount + 1,
    phase: 'countdown',
    timer: COUNTDOWN,
    tickTimer: 0,
    interval: START_INTERVAL,
    ticks: 0,
    rounds: state.rounds,
    lastRound: null,
    result: state.result,
  };
}

export function newSnakeGame(seed: number): SnakeState {
  return freshRound({ seed: seed >>> 0, fruitCount: 0, rounds: [0, 0], result: null });
}

/** Queues a relative turn (left −1 / right +1) for the next move. */
export function snakeTurn(state: SnakeState, seat: Seat, turn: Turn): SnakeState {
  if (state.result || state.phase === 'roundOver') return state;
  const snake = state.snakes[seat];
  if (snake.queue.length >= MAX_QUEUED_TURNS) return state;
  const snakes: [Snake, Snake] = [state.snakes[0], state.snakes[1]];
  snakes[seat] = { ...snake, queue: [...snake.queue, turn] };
  return { ...state, snakes };
}

function tick(state: SnakeState, events: SnakeEvents): SnakeState {
  events.tick = true;
  const moves = state.snakes.map((snake) => {
    const [next, ...rest] = snake.queue;
    const dir = next === undefined ? snake.dir : turned(snake.dir, next);
    return { dir, queue: rest, head: step(snake.body[0]!, dir) };
  });
  const eats = moves.map((m) => same(m.head, state.fruit));
  const bodies = state.snakes.map((snake, i) => [moves[i]!.head, ...(eats[i] ? snake.body : snake.body.slice(0, -1))]);

  const crashed = [0, 1].map((i) => {
    const head = moves[i]!.head;
    const mine = bodies[i]!;
    const theirs = bodies[1 - i]!;
    return !inBounds(head) || mine.slice(1).some((c) => same(c, head)) || theirs.some((c) => same(c, head));
  }) as [boolean, boolean];
  // Passing through each other head to head also counts as a collision.
  const [a, b] = state.snakes;
  if (same(moves[0]!.head, b.body[0]!) && same(moves[1]!.head, a.body[0]!)) {
    crashed[0] = true;
    crashed[1] = true;
  }

  const snakes: [Snake, Snake] = [
    { body: bodies[0]!, dir: moves[0]!.dir, queue: moves[0]!.queue },
    { body: bodies[1]!, dir: moves[1]!.dir, queue: moves[1]!.queue },
  ];
  const previous: [readonly GridCell[], readonly GridCell[]] = [a.body, b.body];

  if (crashed[0] || crashed[1]) {
    events.roundOver = true;
    const winner: Seat | null = crashed[0] && crashed[1] ? null : crashed[0] ? 1 : 0;
    const rounds: [number, number] = [state.rounds[0], state.rounds[1]];
    if (winner !== null) rounds[winner]++;
    const result: GameResult | null = winner !== null && rounds[winner] >= ROUNDS_TO_WIN ? { winners: [winner], draw: false } : null;
    return { ...state, snakes, previous, phase: 'roundOver', timer: ROUND_PAUSE, rounds, lastRound: { winner, crashed }, result, ticks: state.ticks + 1 };
  }

  events.ate = [eats[0]!, eats[1]!];
  const ate = eats[0] || eats[1];
  return {
    ...state,
    snakes,
    previous,
    fruit: ate ? placeFruit(state.seed, state.fruitCount, bodies) : state.fruit,
    fruitCount: ate ? state.fruitCount + 1 : state.fruitCount,
    interval: ate ? Math.max(MIN_INTERVAL, state.interval - SPEEDUP) : state.interval,
    ticks: state.ticks + 1,
  };
}

export function stepSnake(state: SnakeState, dt = SNAKE_STEP): { state: SnakeState; events: SnakeEvents } {
  const events: SnakeEvents = { tick: false, ate: [false, false], roundOver: false };
  if (state.result && state.phase === 'roundOver') return { state, events };
  if (state.phase === 'countdown') {
    const timer = state.timer - dt;
    return { state: timer > 0 ? { ...state, timer } : { ...state, phase: 'play', timer: 0 }, events };
  }
  if (state.phase === 'roundOver') {
    const timer = state.timer - dt;
    return { state: timer > 0 ? { ...state, timer } : freshRound(state), events };
  }
  const tickTimer = state.tickTimer + dt;
  if (tickTimer < state.interval) return { state: { ...state, tickTimer }, events };
  return { state: tick({ ...state, tickTimer: tickTimer - state.interval }, events), events };
}

export interface SnakeTier {
  /** Chance of a careless turn. */
  readonly mistake: number;
  /** Looks at how much room a move leaves (avoids boxing itself in). */
  readonly floodFill: boolean;
  /** How much it tries to take room away from the opponent. */
  readonly trap: number;
  readonly greed: number;
}

export const SNAKE_TIERS: Record<BotTier, SnakeTier> = {
  easy: { mistake: 0.08, floodFill: false, trap: 0, greed: 0.6 },
  medium: { mistake: 0.02, floodFill: false, trap: 0, greed: 1 },
  hard: { mistake: 0.005, floodFill: true, trap: 0, greed: 1 },
  expert: { mistake: 0, floodFill: true, trap: 0.5, greed: 1 },
};

const key = (c: GridCell) => c.y * GRID.cols + c.x;

function reachable(from: GridCell, blocked: Set<number>, limit: number): number {
  const seen = new Set<number>([key(from)]);
  const queue = [from];
  while (queue.length > 0 && seen.size < limit) {
    const cell = queue.shift()!;
    for (const dir of [0, 1, 2, 3] as Dir[]) {
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
 * The bot's turn for its next move (0 = straight). Call once per tick, after the tick.
 * `mistake01` in [0, 1] triggers careless turns; `pick` in [-1, 1] chooses which.
 */
export function snakeBotTurn(state: SnakeState, seat: Seat, tier: SnakeTier, mistake01: number, pick: number): Turn | 0 {
  if (state.phase === 'roundOver') return 0;
  const me = state.snakes[seat];
  const them = state.snakes[seat === 0 ? 1 : 0];
  if (me.queue.length > 0) return 0;
  if (mistake01 < tier.mistake) return pick > 0.33 ? 1 : pick < -0.33 ? -1 : 0;

  // Tails move out of the way next tick, so they don't block.
  const blocked = new Set<number>();
  for (const snake of [me, them]) for (const c of snake.body.slice(0, -1)) blocked.add(key(c));
  const theirNext = ([0, 1, 2, 3] as Dir[]).map((d) => step(them.body[0]!, d));

  let best: Turn | 0 = 0;
  let bestScore = -Infinity;
  for (const turn of [0, -1, 1] as (Turn | 0)[]) {
    const head = step(me.body[0]!, turned(me.dir, turn));
    let score: number;
    if (!inBounds(head) || blocked.has(key(head))) {
      score = -1_000_000;
    } else {
      score = -tier.greed * (Math.abs(head.x - state.fruit.x) + Math.abs(head.y - state.fruit.y));
      if (theirNext.some((c) => same(c, head))) score -= 400;
      if (tier.floodFill) {
        const after = new Set(blocked).add(key(head));
        const room = reachable(head, after, 250);
        score += room * 2;
        if (room < me.body.length + 2) score -= 5000 - room;
        if (tier.trap > 0) score -= tier.trap * reachable(them.body[0]!, after, 250);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = turn;
    }
  }
  return best;
}

export const snakeBattle: RealtimeGameDefinition = {
  id: 'snake-battle',
  name: 'Snake Battle',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive'],
  realtime: true,
};
