import type { BotTier, GameResult, RealtimeGameDefinition, Seat } from '../../core/types';

/**
 * Wheelie (docs/games/wheelie.md): a balance duel. Each player rides a bike along their own half
 * of the phone. Hold to open the throttle and the front wheel lifts; let go and it drops. Ride the
 * wheelie as far as you can: land it and the distance counts, go over backwards and that ride
 * scores nothing. The road gets bumpier the further you go, the same bumps for both. Three rides
 * each; the longest total wins. Real time, a pure fixed step like the other duels.
 */
export const WHEELIE_CANVAS = { width: 600, height: 900 } as const;
export const WHEELIE_STEP = 1 / 120;
export const WHEELIE_RIDES = 3;
/** Tipped this far back (radians), the bike goes over. */
export const FLIP = 1.45;
/** Pixels of road per metre scored. */
export const PX_PER_M = 100;

const COUNTDOWN = 1.5;
const LIFT = 9;
const GRAVITY = 6;
const DAMP = 0.6;
/** The front counts as up once it is this far off the ground. */
const UP = 0.12;
/** Seconds of road before a rider has to lift, and the pause after a ride. */
const ROLL = 5;
const REST = 1.2;
const SPEED = 260;
/** A bump every so far along, harder the further the ride has gone. */
const BUMP_EVERY = 90;

export interface Rider {
  readonly phase: 'rolling' | 'up' | 'landed' | 'flipped' | 'done';
  readonly angle: number;
  readonly spin: number;
  /** Road covered this ride, and the part of it with the front wheel up. */
  readonly road: number;
  readonly wheelie: number;
  readonly timer: number;
  readonly ride: number;
  /** Metres scored on each ride so far. */
  readonly scores: readonly number[];
}

export interface WheelieState {
  readonly seed: number;
  readonly phase: 'countdown' | 'ride' | 'over';
  readonly timer: number;
  readonly riders: readonly [Rider, Rider];
  readonly result: GameResult | null;
}

export interface WheelieInput {
  readonly held: boolean;
}

export interface WheelieEvents {
  lifted: Seat[];
  landed: Seat[];
  flipped: Seat[];
  bumped: Seat[];
}

function hash(seed: number, n: number): number {
  let h = (seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 2 ** 32;
}

/** The kick bump `k` of ride `ride` gives the bike's spin: either way, and harder further along. */
export function bumpKick(seed: number, ride: number, k: number): number {
  return (hash(seed, ride * 10_000 + k) * 2 - 1) * (0.3 + k * 0.06);
}

const newRider = (ride = 0, scores: readonly number[] = []): Rider => ({ phase: 'rolling', angle: 0, spin: 0, road: 0, wheelie: 0, timer: 0, ride, scores });

export function newWheelie(seed: number): WheelieState {
  return { seed, phase: 'countdown', timer: COUNTDOWN, riders: [newRider(), newRider()], result: null };
}

export const wheelieTotal = (r: Rider) => r.scores.reduce((a, b) => a + b, 0);

function stepRider(seed: number, seat: Seat, r: Rider, held: boolean, events: WheelieEvents, dt: number): Rider {
  if (r.phase === 'done') return r;
  if (r.phase === 'landed' || r.phase === 'flipped') {
    const timer = r.timer - dt;
    if (timer > 0) return { ...r, timer };
    return r.ride + 1 >= WHEELIE_RIDES ? { ...r, phase: 'done', timer: 0 } : newRider(r.ride + 1, r.scores);
  }
  // The rider's weight pulls the front back down, less the higher it is, but never nothing before
  // the flip: a real rider leans forward to save it. Holding on past the tipping point is what flips.
  let spin = r.spin + ((held ? LIFT : 0) - GRAVITY * Math.cos(r.angle * 0.7) - DAMP * r.spin) * dt;
  let angle = r.angle + spin * dt;
  const road = r.road + SPEED * dt;
  let phase: Rider['phase'] = r.phase;
  // Bumps only shake a wheel that is up.
  if (phase === 'up' && Math.floor(road / BUMP_EVERY) > Math.floor(r.road / BUMP_EVERY)) {
    const k = Math.floor(road / BUMP_EVERY);
    spin += bumpKick(seed, r.ride, k);
    events.bumped.push(seat);
  }
  if (angle <= 0) {
    angle = 0;
    spin = Math.max(spin, 0);
  }
  if (phase === 'rolling' && angle > UP) {
    phase = 'up';
    events.lifted.push(seat);
  }
  const wheelie = r.wheelie + (phase === 'up' ? SPEED * dt : 0);
  const timer = r.timer + dt;
  if (phase === 'up' && angle >= FLIP) {
    events.flipped.push(seat);
    return { ...r, phase: 'flipped', angle: FLIP, spin: 0, road, wheelie, timer: REST, scores: [...r.scores, 0] };
  }
  if (phase === 'up' && angle <= 0) {
    events.landed.push(seat);
    return { ...r, phase: 'landed', angle: 0, spin: 0, road, wheelie, timer: REST, scores: [...r.scores, wheelie / PX_PER_M] };
  }
  // Never got the front up: that ride scores nothing.
  if (phase === 'rolling' && timer > ROLL) return { ...r, phase: 'landed', road, timer: REST, scores: [...r.scores, 0] };
  return { ...r, phase, angle, spin, road, wheelie, timer };
}

/** Advances the match by one fixed step. Pure. */
export function stepWheelie(state: WheelieState, inputs: readonly [WheelieInput, WheelieInput], dt = WHEELIE_STEP): { state: WheelieState; events: WheelieEvents } {
  const events: WheelieEvents = { lifted: [], landed: [], flipped: [], bumped: [] };
  if (state.result) return { state, events };
  if (state.phase === 'countdown') {
    const timer = state.timer - dt;
    return { state: { ...state, timer: Math.max(timer, 0), phase: timer > 0 ? 'countdown' : 'ride' }, events };
  }
  const riders = state.riders.map((r, i) => stepRider(state.seed, i as Seat, r, inputs[i]!.held, events, dt)) as unknown as [Rider, Rider];
  let result: GameResult | null = null;
  if (riders.every((r) => r.phase === 'done')) {
    const [a, b] = riders.map(wheelieTotal) as [number, number];
    result = Math.abs(a - b) < 1e-9 ? { winners: [], draw: true } : { winners: [a > b ? 0 : 1], draw: false };
  }
  return { state: { ...state, riders, phase: result ? 'over' : 'ride', result }, events };
}

export interface WheelieTier {
  /** The lean it tries to hold, radians. */
  readonly aim: number;
  /** How far ahead it reads the bike's spin, in seconds. */
  readonly look: number;
  /** How much its aim wanders, radians either way. */
  readonly wobble: number;
  /** Metres after which it lets the front down on purpose to bank the ride. */
  readonly bank: number;
}

export const WHEELIE_TIERS: Record<BotTier, WheelieTier> = {
  easy: { aim: 0.7, look: 0.05, wobble: 0.45, bank: Infinity },
  medium: { aim: 0.7, look: 0.1, wobble: 0.3, bank: 34 },
  hard: { aim: 0.7, look: 0.16, wobble: 0.18, bank: 30 },
  expert: { aim: 0.7, look: 0.25, wobble: 0.06, bank: 29 },
};

/**
 * Bot thumb: holds while the bike, read a little ahead by its spin, is below the lean it aims
 * for, and lets go when it is above. Its aim wanders a bit every tenth of a second, seeded. Past
 * its banking distance it lets the front down to keep the ride, as a careful person would.
 */
export function wheelieBotInput(state: WheelieState, seat: Seat, tier: WheelieTier): WheelieInput {
  const r = state.riders[seat];
  if (state.phase !== 'ride' || (r.phase !== 'rolling' && r.phase !== 'up')) return { held: false };
  // Far enough: let it down and keep the metres, rather than risk going over.
  if (r.phase === 'up' && r.wheelie / PX_PER_M >= tier.bank) return { held: false };
  const tick = Math.floor(r.timer * 10);
  const aim = tier.aim + (hash(state.seed, r.ride * 1_000_003 + tick * 2 + seat) * 2 - 1) * tier.wobble;
  return { held: r.angle + r.spin * tier.look < aim };
}

export const wheelie: RealtimeGameDefinition = {
  id: 'wheelie',
  name: 'Wheelie',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive'],
  realtime: true,
};
