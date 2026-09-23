import type { BotTier, GameResult, RealtimeGameDefinition, Seat } from '../../core/types';

/**
 * Racing (docs/games/racing.md): two cars that drive themselves round a closed track; each player
 * only steers. Top-down, logical pixels. Real time, like Sumo: a pure fixed step, the scene feeding it.
 */
export const RACE_CANVAS = { width: 600, height: 900 } as const;
export const RACE_STEP = 1 / 120;
export const LAPS = 3;
export const TRACK_WIDTH = 116;
export const CAR_RADIUS = 16;
export const TOP_SPEED = 330;
export const GRASS_SPEED = 110;

const ACCEL = 240;
const TURN_RATE = 2.7;
/** Turning scrubs this share of speed per second. */
const TURN_SCRUB = 0.18;
const GRASS_DRAG = 3;
const COUNTDOWN = 1.8;
const CHECKPOINTS = 8;
/** Samples round a track's centre line; plenty for a smooth road and a cheap nearest-point search. */
const SAMPLES = 120;

export interface Track {
  readonly name: string;
  /** The centre line, a closed loop, `SAMPLES` points running the way the race goes. */
  readonly line: readonly { readonly x: number; readonly y: number }[];
}

/** Catmull-Rom through the control points, sampled evenly by index, closed. */
function smooth(points: readonly [number, number][]): { x: number; y: number }[] {
  const n = points.length;
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const u = (i / SAMPLES) * n;
    const k = Math.floor(u);
    const t = u - k;
    const p = (j: number) => points[(j + n) % n]!;
    const [p0, p1, p2, p3] = [p(k - 1), p(k), p(k + 1), p(k + 2)];
    const f = (a: number, b: number, c: number, d: number) =>
      0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
    out.push({ x: f(p0[0], p1[0], p2[0], p3[0]), y: f(p0[1], p1[1], p2[1], p3[1]) });
  }
  return out;
}

/** Three tracks of our own; each race is on one picked by its seed. */
export const TRACKS: readonly Track[] = [
  {
    name: 'The oval',
    line: smooth([
      [300, 820],
      [480, 760],
      [520, 450],
      [480, 140],
      [300, 80],
      [120, 140],
      [80, 450],
      [120, 760],
    ]),
  },
  {
    name: 'The bean',
    line: smooth([
      [300, 820],
      [500, 740],
      [520, 480],
      [470, 250],
      [300, 90],
      [130, 200],
      [120, 360],
      [300, 460],
      [140, 600],
      [110, 760],
    ]),
  },
  {
    name: 'The hairpin',
    line: smooth([
      [300, 830],
      [520, 780],
      [525, 560],
      [370, 470],
      [520, 340],
      [500, 120],
      [300, 80],
      [100, 150],
      [80, 450],
      [100, 760],
    ]),
  },
];

export interface Car {
  readonly x: number;
  readonly y: number;
  /** Which way it points, radians. */
  readonly angle: number;
  readonly speed: number;
  /** The checkpoint it needs next; 0 is the start line. */
  readonly next: number;
  readonly laps: number;
}

export type RacePhase = 'countdown' | 'race' | 'over';

export interface RaceState {
  readonly track: number;
  readonly cars: readonly [Car, Car];
  readonly phase: RacePhase;
  readonly timer: number;
  readonly result: GameResult | null;
}

/** -1 steers left, 1 right, 0 straight. */
export interface RaceInput {
  readonly turn: number;
}

export interface RaceEvents {
  bump: number;
  lap: [boolean, boolean];
  grass: [boolean, boolean];
}

/** The index of a track's checkpoint `k` on its centre line. */
export const checkpointAt = (k: number): number => Math.round((k * SAMPLES) / CHECKPOINTS) % SAMPLES;

/** The nearest centre-line sample to a point, and how far off the line the point is. */
export function nearest(track: Track, x: number, y: number): { index: number; off: number } {
  let index = 0;
  let best = Infinity;
  track.line.forEach((p, i) => {
    const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
    if (d < best) {
      best = d;
      index = i;
    }
  });
  // Distance to the segments either side, not just the sample, so the road edge is smooth.
  let off = Math.sqrt(best);
  for (const j of [index - 1, index]) {
    const a = track.line[(j + SAMPLES) % SAMPLES]!;
    const b = track.line[(j + 1) % SAMPLES]!;
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const len2 = ex * ex + ey * ey || 1;
    const k = Math.max(0, Math.min(1, ((x - a.x) * ex + (y - a.y) * ey) / len2));
    off = Math.min(off, Math.hypot(x - a.x - ex * k, y - a.y - ey * k));
  }
  return { index, off };
}

export const onRoad = (track: Track, x: number, y: number): boolean => nearest(track, x, y).off <= TRACK_WIDTH / 2;

function grid(track: number): readonly [Car, Car] {
  const line = TRACKS[track]!.line;
  // Just behind the start line, side by side, pointing the way the race goes.
  const at = line[SAMPLES - 3]!;
  const ahead = line[0]!;
  const angle = Math.atan2(ahead.y - at.y, ahead.x - at.x);
  const nx = -Math.sin(angle);
  const ny = Math.cos(angle);
  const car = (side: number): Car => ({ x: at.x + nx * side * 26, y: at.y + ny * side * 26, angle, speed: 0, next: 1, laps: 0 });
  // Crossing the start line from the grid is not a lap: they start needing checkpoint 1.
  return [car(1), car(-1)];
}

export function newRace(seed: number): RaceState {
  const track = (seed >>> 0) % TRACKS.length;
  return { track, cars: grid(track), phase: 'countdown', timer: COUNTDOWN, result: null };
}

function drive(track: Track, car: Car, input: RaceInput, dt: number): { car: Car; lap: boolean; grass: boolean } {
  const road = onRoad(track, car.x, car.y);
  const turn = Math.max(-1, Math.min(1, input.turn));
  const angle = car.angle + turn * TURN_RATE * dt * Math.min(1, 0.35 + car.speed / TOP_SPEED);
  let speed = car.speed + ACCEL * dt;
  if (turn !== 0) speed -= speed * TURN_SCRUB * dt;
  const top = road ? TOP_SPEED : GRASS_SPEED;
  if (speed > top) speed = road ? top : Math.max(top, speed - speed * GRASS_DRAG * dt);
  const x = Math.max(CAR_RADIUS, Math.min(RACE_CANVAS.width - CAR_RADIUS, car.x + Math.cos(angle) * speed * dt));
  const y = Math.max(CAR_RADIUS, Math.min(RACE_CANVAS.height - CAR_RADIUS, car.y + Math.sin(angle) * speed * dt));
  // Checkpoints in order: a car has to reach the next one to count it, so cutting across is no lap.
  const { index } = nearest(track, x, y);
  const target = checkpointAt(car.next);
  const reached = Math.abs(((index - target + SAMPLES + SAMPLES / 2) % SAMPLES) - SAMPLES / 2) <= 2;
  let { next, laps } = car;
  let lap = false;
  if (reached) {
    if (car.next === 0) {
      laps++;
      lap = true;
    }
    next = (car.next + 1) % CHECKPOINTS;
  }
  return { car: { x, y, angle, speed, next, laps }, lap, grass: !road };
}

/** Advances the race by one fixed step. Pure. */
export function stepRace(state: RaceState, inputs: readonly [RaceInput, RaceInput], dt = RACE_STEP): { state: RaceState; events: RaceEvents } {
  const events: RaceEvents = { bump: 0, lap: [false, false], grass: [false, false] };
  if (state.result || state.phase === 'over') return { state, events };
  if (state.phase === 'countdown') {
    const timer = state.timer - dt;
    return { state: timer > 0 ? { ...state, timer } : { ...state, phase: 'race', timer: 0 }, events };
  }
  const track = TRACKS[state.track]!;
  const d0 = drive(track, state.cars[0], inputs[0], dt);
  const d1 = drive(track, state.cars[1], inputs[1], dt);
  let c0 = d0.car;
  let c1 = d1.car;
  events.lap = [d0.lap, d1.lap];
  events.grass = [d0.grass, d1.grass];
  const dx = c1.x - c0.x;
  const dy = c1.y - c0.y;
  const dist = Math.hypot(dx, dy);
  if (dist < CAR_RADIUS * 2 && dist > 0) {
    const push = (CAR_RADIUS * 2 - dist) / 2;
    const nx = dx / dist;
    const ny = dy / dist;
    c0 = { ...c0, x: c0.x - nx * push, y: c0.y - ny * push };
    c1 = { ...c1, x: c1.x + nx * push, y: c1.y + ny * push };
    // Whoever ran into whom loses a little speed.
    const faster = c0.speed >= c1.speed ? 0 : 1;
    if (faster === 0) c0 = { ...c0, speed: c0.speed * 0.9 };
    else c1 = { ...c1, speed: c1.speed * 0.9 };
    events.bump = Math.abs(c0.speed - c1.speed) + 40;
  }
  const done = [c0.laps >= LAPS, c1.laps >= LAPS];
  if (done[0] || done[1]) {
    // Both over the line in one step: the one further past it wins; exactly level is shared.
    let winners: Seat[] = done[0] && done[1] ? [0, 1] : done[0] ? [0] : [1];
    if (winners.length === 2) {
      const past = [0, 1].map((i) => nearest(track, [c0, c1][i]!.x, [c0, c1][i]!.y).index);
      if (past[0] !== past[1]) winners = [past[0]! > past[1]! ? 0 : 1];
    }
    const result: GameResult = { winners, draw: winners.length === 2 };
    return { state: { ...state, cars: [c0, c1], phase: 'over', result }, events };
  }
  return { state: { ...state, cars: [c0, c1] }, events };
}

export interface RaceTier {
  /** How many centre-line samples ahead it steers for. */
  readonly lookahead: number;
  /** How far off (radians) the target has to be before it bothers to steer. */
  readonly deadZone: number;
  /** Radians of steering error. */
  readonly wobble: number;
}

export const RACE_TIERS: Record<BotTier, RaceTier> = {
  easy: { lookahead: 3, deadZone: 0.35, wobble: 0.5 },
  medium: { lookahead: 5, deadZone: 0.2, wobble: 0.3 },
  hard: { lookahead: 6, deadZone: 0.1, wobble: 0.15 },
  expert: { lookahead: 7, deadZone: 0.05, wobble: 0.05 },
};

/** Bot steering: aim for a point ahead on the centre line. `noise` in [-1, 1]. */
export function raceBotInput(state: RaceState, seat: Seat, tier: RaceTier, noise = 0): RaceInput {
  if (state.phase !== 'race') return { turn: 0 };
  const track = TRACKS[state.track]!;
  const car = state.cars[seat];
  const { index } = nearest(track, car.x, car.y);
  const target = track.line[(index + tier.lookahead) % SAMPLES]!;
  const want = Math.atan2(target.y - car.y, target.x - car.x) + noise * tier.wobble;
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return { turn: Math.abs(diff) < tier.deadZone ? 0 : diff > 0 ? 1 : -1 };
}

export const racing: RealtimeGameDefinition = {
  id: 'racing',
  name: 'Racing',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive'],
  realtime: true,
};
