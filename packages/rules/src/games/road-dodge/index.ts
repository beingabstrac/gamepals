import type { BotTier, GameResult, RealtimeGameDefinition, Seat } from '../../core/types';

/**
 * Road Dodge (docs/games/road-dodge.md): each player drives their own three-lane road in their
 * half of the phone, and traffic comes at them faster and faster. Tap left or right to change
 * lane. Both roads carry the same traffic, so it is fair. Three bumps and you are out; last one
 * driving wins. Real time, a pure fixed step like the other duels.
 *
 * Each road is its own frame: x across in lanes (0, 1, 2), y down toward that player's edge.
 */
export const ROAD_CANVAS = { width: 600, height: 900 } as const;
export const ROAD = { width: 600, height: 450, lanes: 3 } as const;
export const ROAD_STEP = 1 / 120;
export const ROAD_LIVES = 3;
/** Where the car sits on its road, and how tall a car and a row of traffic are. */
export const CAR_Y = 370;
export const CAR_H = 70;
export const ROW_H = 64;
/** Distance between rows of traffic. */
export const ROW_GAP = 230;
/** A match that runs this long ends on lives left; level is a draw. */
export const ROAD_TIME = 120;

const COUNTDOWN = 1.5;
const FIRST_ROW = 700;
const START_SPEED = 300;
const SPEED_UP = 7;
const TOP_SPEED = 760;
/** Lanes a second a car slides across when it changes lane. */
const SLIDE = 11;
/** After a bump a car blinks and cannot be bumped again for this long. */
const SAFE = 1.2;

export interface RoadCar {
  /** Where it is, in lanes, and the lane it is heading for. */
  readonly x: number;
  readonly lane: number;
  readonly lives: number;
  readonly safe: number;
  /** The last row that bumped it, so one row bumps once. */
  readonly bumped: number;
}

export interface RoadState {
  readonly seed: number;
  readonly phase: 'countdown' | 'play' | 'over';
  readonly timer: number;
  readonly time: number;
  /** How far both roads have rolled. */
  readonly distance: number;
  readonly speed: number;
  readonly cars: readonly [RoadCar, RoadCar];
  readonly result: GameResult | null;
}

export interface RoadInput {
  /** -1 a lane left, 1 a lane right, 0 stay. */
  readonly steer: -1 | 0 | 1;
}

export interface RoadEvents {
  steered: Seat[];
  bumped: Seat[];
  out: Seat[];
}

function hash(seed: number, n: number): number {
  let h = (seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 2 ** 32;
}

/**
 * Which lanes row `k` blocks: one lane early on, more often two as the rows go by, never all
 * three. Rows alternate which side leans, so a road is never one lane held all the way.
 */
export function rowLanes(seed: number, k: number): readonly boolean[] {
  const two = hash(seed, k * 3) < Math.min(0.15 + k * 0.012, 0.6);
  const free = Math.floor(hash(seed, k * 3 + 1) * ROAD.lanes);
  if (two) return [0, 1, 2].map((l) => l !== free);
  const block = Math.floor(hash(seed, k * 3 + 2) * ROAD.lanes);
  return [0, 1, 2].map((l) => l === block);
}

/** How far along the road row `k` sits. */
export const rowAt = (k: number) => FIRST_ROW + k * ROW_GAP;

/** Where row `k` is on screen (its middle, in the road's frame) once the road has rolled `distance`. */
export const rowY = (k: number, distance: number) => CAR_Y - (rowAt(k) - distance);

const newCar = (): RoadCar => ({ x: 1, lane: 1, lives: ROAD_LIVES, safe: 0, bumped: -1 });

export function newRoadDodge(seed: number): RoadState {
  return { seed, phase: 'countdown', timer: COUNTDOWN, time: 0, distance: 0, speed: START_SPEED, cars: [newCar(), newCar()], result: null };
}

/** Advances the match by one fixed step. Pure. */
export function stepRoad(state: RoadState, inputs: readonly [RoadInput, RoadInput], dt = ROAD_STEP): { state: RoadState; events: RoadEvents } {
  const events: RoadEvents = { steered: [], bumped: [], out: [] };
  if (state.result) return { state, events };
  if (state.phase === 'countdown') {
    const timer = state.timer - dt;
    return { state: { ...state, timer: Math.max(timer, 0), phase: timer > 0 ? 'countdown' : 'play' }, events };
  }
  const distance = state.distance + state.speed * dt;
  const speed = Math.min(state.speed + SPEED_UP * dt, TOP_SPEED);
  const time = state.time + dt;
  // The rows that could be alongside a car now.
  const near = Math.max(0, Math.floor((distance - FIRST_ROW - CAR_H) / ROW_GAP));
  const cars = state.cars.map((car, i) => {
    const seat = i as Seat;
    if (car.lives <= 0) return car;
    const steer = inputs[seat].steer;
    const lane = Math.max(0, Math.min(ROAD.lanes - 1, car.lane + steer));
    if (lane !== car.lane) events.steered.push(seat);
    const step = SLIDE * dt;
    const x = Math.abs(lane - car.x) <= step ? lane : car.x + Math.sign(lane - car.x) * step;
    let { lives, bumped } = car;
    let safe = Math.max(car.safe - dt, 0);
    for (let k = near; k <= near + 1; k++) {
      const y = rowY(k, distance);
      if (k <= bumped || Math.abs(y - CAR_Y) > (CAR_H + ROW_H) / 2 - 6) continue;
      const lanes = rowLanes(state.seed, k);
      // A car half across two lanes can be clipped by either.
      const hit = lanes.some((blocked, l) => blocked && Math.abs(x - l) < 0.62);
      if (!hit) continue;
      bumped = k;
      if (safe > 0) continue;
      lives--;
      safe = SAFE;
      events.bumped.push(seat);
      if (lives <= 0) events.out.push(seat);
    }
    return { x, lane, lives, safe, bumped };
  }) as unknown as [RoadCar, RoadCar];
  const next: RoadState = { ...state, distance, speed, time, cars };
  const alive = cars.map((c) => c.lives > 0);
  let result: GameResult | null = null;
  if (!alive[0] || !alive[1]) {
    result = alive[0] ? { winners: [0], draw: false } : alive[1] ? { winners: [1], draw: false } : { winners: [], draw: true };
  } else if (time >= ROAD_TIME) {
    const [a, b] = [cars[0].lives, cars[1].lives];
    result = a === b ? { winners: [], draw: true } : { winners: [a > b ? 0 : 1], draw: false };
  }
  return { state: result ? { ...next, phase: 'over', result } : next, events };
}

export interface RoadTier {
  /** How far up the road it looks, in px. */
  readonly sight: number;
  /** Chance it misses seeing a row altogether. */
  readonly slip: number;
}

export const ROAD_TIERS: Record<BotTier, RoadTier> = {
  easy: { sight: 190, slip: 0.14 },
  medium: { sight: 240, slip: 0.07 },
  hard: { sight: 300, slip: 0.035 },
  expert: { sight: 380, slip: 0.015 },
};

/**
 * Bot hands: looks at the next row it has not passed, if it is within sight and it has not
 * slipped on it, and heads for the nearest free lane of it, one lane at a time.
 */
export function roadBotInput(state: RoadState, seat: Seat, tier: RoadTier): RoadInput {
  const car = state.cars[seat];
  if (state.phase !== 'play' || car.lives <= 0) return { steer: 0 };
  // The first row whose back has not yet gone past the car.
  let k = Math.max(0, Math.ceil((state.distance - FIRST_ROW - (CAR_H + ROW_H) / 2) / ROW_GAP));
  for (; k < 1e6; k++) {
    const y = rowY(k, state.distance);
    if (y < CAR_Y + (CAR_H + ROW_H) / 2) break;
  }
  if (CAR_Y - rowY(k, state.distance) > tier.sight) return { steer: 0 };
  if (hash(state.seed, k * 7 + seat * 13 + 5) < tier.slip) return { steer: 0 };
  const lanes = rowLanes(state.seed, k);
  const free = [0, 1, 2].filter((l) => !lanes[l]);
  const goal = free.reduce((a, b) => (Math.abs(b - car.lane) < Math.abs(a - car.lane) ? b : a));
  if (car.lane !== Math.round(car.x)) return { steer: 0 };
  return { steer: goal < car.lane ? -1 : goal > car.lane ? 1 : 0 };
}

export const roadDodge: RealtimeGameDefinition = {
  id: 'road-dodge',
  name: 'Road Dodge',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive'],
  realtime: true,
};
