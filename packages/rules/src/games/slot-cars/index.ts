import type { BotTier, GameResult, RealtimeGameDefinition, Seat } from '../../core/types';

/**
 * Slot Cars (docs/games/slot-cars.md): two cars on a two-lane track, one button each. Hold it and
 * your car speeds up; let go and it slows. Take a bend too fast and it flies off, and a marshal
 * puts it back after a moment. The lanes cross over halfway down each straight, so each car runs
 * one bend on the inside and one on the outside every lap and the laps are the same length. First
 * to finish the laps wins. Real time, a pure fixed step like the other duels.
 */
export const SLOT_CANVAS = { width: 600, height: 900 } as const;
export const SLOT_STEP = 1 / 120;
export const SLOT_LAPS = 7;
/** The track's middle line: two straights and a bend at each end. */
export const SLOT_TRACK = { cx: 300, top: 250, bottom: 650, r: 190, lane: 30 } as const;

const COUNTDOWN = 1.5;
const ACCEL = 600;
const BRAKE = 1200;
const TOP_SPEED = 800;
/** How hard a car can be pushed sideways before it lets go of the track, px/s². */
const GRIP = 1100;
/** Seconds a car sits off the track before the marshal puts it back. */
const OFF = 1.2;
/** Length of each crossover, where the two lanes swap sides. */
const CROSS = 120;

export interface SlotPoint {
  readonly x: number;
  readonly y: number;
  /** The way the car points, radians. */
  readonly angle: number;
  /** The fastest a car can take this bit of track. */
  readonly limit: number;
}

interface Sample extends SlotPoint {
  readonly s: number;
}

/** Offset of lane `lane` from the middle line at centerline distance `u` (positive is outward). */
function offsetAt(lane: 0 | 1, u: number, straight: number, bend: number): number {
  const side = lane === 0 ? 1 : -1;
  // u runs: right straight going up (0..straight), top bend, left straight going down, bottom bend.
  const crossA = straight / 2;
  const crossB = straight + bend + straight / 2;
  const w = (d: number) => Math.max(-1, Math.min(1, d / (CROSS / 2)));
  // Lane 0 is outside on the bottom bend and inside on the top one; the crossovers blend between.
  let sign: number;
  if (u < crossA) sign = 1;
  else if (u < crossB) sign = -1;
  else sign = 1;
  const nearA = Math.abs(u - crossA) < CROSS / 2;
  const nearB = Math.abs(u - crossB) < CROSS / 2;
  if (nearA) sign = -w(u - crossA);
  if (nearB) sign = w(u - crossB);
  return side * sign * SLOT_TRACK.lane;
}

/** Each lane, sampled every couple of px along its own length. */
const LANES: readonly (readonly Sample[])[] = ([0, 1] as const).map((lane) => {
  const { cx, top, bottom, r } = SLOT_TRACK;
  const straight = bottom - top;
  const bend = Math.PI * r;
  const L = 2 * straight + 2 * bend;
  const out: Sample[] = [];
  let s = 0;
  let prev: { x: number; y: number } | null = null;
  for (let u = 0; u < L; u += 2) {
    let x: number;
    let y: number;
    let nx: number;
    let ny: number;
    let angle: number;
    let onBend = true;
    if (u < straight) {
      x = cx + r;
      y = bottom - u;
      nx = 1;
      ny = 0;
      angle = -Math.PI / 2;
      onBend = false;
    } else if (u < straight + bend) {
      const a = (u - straight) / r;
      x = cx + Math.cos(a) * r;
      y = top - Math.sin(a) * r;
      nx = Math.cos(a);
      ny = -Math.sin(a);
      angle = -Math.PI / 2 - a;
    } else if (u < 2 * straight + bend) {
      x = cx - r;
      y = top + (u - straight - bend);
      nx = -1;
      ny = 0;
      angle = Math.PI / 2;
      onBend = false;
    } else {
      const a = (u - 2 * straight - bend) / r;
      x = cx - Math.cos(a) * r;
      y = bottom + Math.sin(a) * r;
      nx = -Math.cos(a);
      ny = Math.sin(a);
      angle = Math.PI / 2 - a;
    }
    const off = offsetAt(lane, u, straight, bend);
    const p = { x: x + nx * off, y: y + ny * off };
    if (prev) s += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
    const limit = onBend ? Math.sqrt(GRIP * (r + off)) : Infinity;
    out.push({ ...p, angle, limit, s });
  }
  return out;
});

/** How long one lap is. Both lanes are the same length. */
export const LAP = LANES[0]![LANES[0]!.length - 1]!.s;

/** Where a car is and how fast it may go, at distance `s` along its lane (laps wrap). */
export function slotAt(lane: 0 | 1, s: number): SlotPoint {
  const samples = LANES[lane]!;
  const t = ((s % LAP) + LAP) % LAP;
  let lo = 0;
  let hi = samples.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (samples[mid]!.s <= t) lo = mid;
    else hi = mid - 1;
  }
  return samples[lo]!;
}

export interface SlotCar {
  /** Distance driven, laps included. */
  readonly s: number;
  readonly v: number;
  /** Seconds left sitting off the track, 0 while racing. */
  readonly off: number;
  /** Where it flew to, for the scene. */
  readonly flew: { readonly x: number; readonly y: number; readonly angle: number } | null;
  readonly crashes: number;
}

export interface SlotState {
  readonly seed: number;
  readonly phase: 'countdown' | 'race' | 'over';
  readonly timer: number;
  readonly time: number;
  readonly cars: readonly [SlotCar, SlotCar];
  /** When each car crossed the line for the last time, if it has. */
  readonly finished: readonly [number | null, number | null];
  readonly result: GameResult | null;
}

export interface SlotInput {
  readonly held: boolean;
}

export interface SlotEvents {
  crashed: Seat[];
  back: Seat[];
  lap: Seat[];
  /** Pushing close to the limit on a bend: the scene squeals. */
  squeal: Seat[];
}

const newCar = (): SlotCar => ({ s: 0, v: 0, off: 0, flew: null, crashes: 0 });

export function newSlotCars(seed: number): SlotState {
  return { seed, phase: 'countdown', timer: COUNTDOWN, time: 0, cars: [newCar(), newCar()], finished: [null, null], result: null };
}

export const lapsDone = (car: SlotCar) => Math.floor(car.s / LAP);

/** Advances the race by one fixed step. Pure. */
export function stepSlot(state: SlotState, inputs: readonly [SlotInput, SlotInput], dt = SLOT_STEP): { state: SlotState; events: SlotEvents } {
  const events: SlotEvents = { crashed: [], back: [], lap: [], squeal: [] };
  if (state.result) return { state, events };
  if (state.phase === 'countdown') {
    const timer = state.timer - dt;
    return { state: { ...state, timer: Math.max(timer, 0), phase: timer > 0 ? 'countdown' : 'race' }, events };
  }
  const time = state.time + dt;
  const finished: [number | null, number | null] = [state.finished[0], state.finished[1]];
  const cars = state.cars.map((car, i) => {
    const seat = i as Seat;
    const lane = seat as 0 | 1;
    if (finished[seat] !== null) return { ...car, v: Math.max(car.v - BRAKE * dt, 0), s: car.s + car.v * dt };
    if (car.off > 0) {
      const off = car.off - dt;
      if (off > 0) return { ...car, off };
      events.back.push(seat);
      return { ...car, off: 0, v: 0, flew: null };
    }
    const v = inputs[seat].held ? Math.min(car.v + ACCEL * dt, TOP_SPEED) : Math.max(car.v - BRAKE * dt, 0);
    const s = car.s + v * dt;
    const here = slotAt(lane, s);
    if (lapsDone({ ...car, s }) > lapsDone(car)) {
      events.lap.push(seat);
      if (lapsDone({ ...car, s }) >= SLOT_LAPS) finished[seat] = time;
    }
    if (v > here.limit) {
      // Off it goes, straight on the way it was pointing.
      events.crashed.push(seat);
      const fly = 70 + v * 0.12;
      return { s, v: 0, off: OFF, crashes: car.crashes + 1, flew: { x: here.x + Math.cos(here.angle) * fly, y: here.y + Math.sin(here.angle) * fly, angle: here.angle + 1.6 } };
    }
    if (v > here.limit * 0.92) events.squeal.push(seat);
    return { ...car, s, v };
  }) as unknown as [SlotCar, SlotCar];
  let result: GameResult | null = null;
  const [a, b] = finished;
  if (a !== null || b !== null) {
    // The first over the line wins; the same step is a dead heat.
    if (a !== null && b !== null && a === b) result = { winners: [], draw: true };
    else if (a !== null && (b === null || a < b)) result = { winners: [0], draw: false };
    else result = { winners: [1], draw: false };
  }
  return { state: { ...state, time, cars, finished, phase: result ? 'over' : 'race', result }, events };
}

export interface SlotTier {
  /** How close to the grip limit it dares go, as a fraction. */
  readonly nerve: number;
  /** Chance, each bend, that it brakes too late. */
  readonly slip: number;
}

export const SLOT_TIERS: Record<BotTier, SlotTier> = {
  easy: { nerve: 0.8, slip: 0.14 },
  medium: { nerve: 0.87, slip: 0.08 },
  hard: { nerve: 0.93, slip: 0.04 },
  expert: { nerve: 0.97, slip: 0.015 },
};

function hash(seed: number, n: number): number {
  let h = (seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 2 ** 32;
}

/**
 * Bot thumb: holds on while it could still slow in time for everything in the next stretch of
 * track (within its nerve), and lets go otherwise. Now and then, a bend at a time, it leaves the
 * brakes too late.
 */
export function slotBotInput(state: SlotState, seat: Seat, tier: SlotTier): SlotInput {
  const car = state.cars[seat];
  if (state.phase !== 'race' || car.off > 0) return { held: false };
  const lane = seat as 0 | 1;
  // Half-laps counted from the first crossover each hold exactly one bend, so a slip lasts one bend.
  const bend = Math.floor((car.s - (SLOT_TRACK.bottom - SLOT_TRACK.top) / 2 + LAP) / (LAP / 2));
  const nerve = hash(state.seed, bend * 2 + seat) < tier.slip ? 1.12 : tier.nerve;
  const next = Math.min(car.v + ACCEL * SLOT_STEP, TOP_SPEED);
  for (let d = 0; d <= 480; d += 12) {
    const limit = slotAt(lane, car.s + d).limit * nerve;
    // The room to brake in loses the gap between the points it checks and the step it takes first.
    const room = Math.max(0, d - 12 - 2 * next * SLOT_STEP);
    if (next * next > limit * limit + 2 * BRAKE * room) return { held: false };
  }
  return { held: true };
}

export const slotCars: RealtimeGameDefinition = {
  id: 'slot-cars',
  name: 'Slot Cars',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive'],
  realtime: true,
};
