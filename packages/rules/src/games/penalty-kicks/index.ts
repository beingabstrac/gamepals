import type { BotTier, GameResult, RealtimeGameDefinition, Seat } from '../../core/types';

/**
 * Penalty shootout (docs/games/penalty-kicks.md). Roles alternate every kick; the goal is at the
 * keeper's end and the ball spot is just inside the kicker's half. Logical pixels, portrait.
 */
export const PK_CANVAS = { width: 600, height: 900 } as const;
export const GOAL_CENTER_X = 300;
export const GOAL_HALF_WIDTH = 150;
export const REGULATION_KICKS = 5;
export const PK_STEP = 1 / 120;

/** Goal line and penalty spot for each keeper seat (seat 0 keeps goal at the bottom). */
export const GOAL_LINE_Y: Readonly<Record<Seat, number>> = { 0: 780, 1: 120 };
export const SPOT_Y: Readonly<Record<Seat, number>> = { 0: 430, 1: 470 };

const AIM_WINDOW = 5;
const RESULT_PAUSE = 1.5;
const KEEPER_SPEED = 320;
export const KEEPER_BODY = 38;
const HAND_REACH = 62;
const DIVE_SPEED = 1100;
const DIVE_TIME = 0.32;
const BALL_RADIUS = 12;
const KEEPER_RANGE = 190;
/** Standing, a keeper covers almost the full goal height; at full stretch only up to this height. */
const BODY_HEIGHT = 0.92;
const HANDS_HEIGHT = 0.72;

/** A shot: aim −1 (left post) … 1 (right post), beyond ±1 is wide; power 0 … 1; curl only bends the path. */
export interface Shot {
  readonly aim: number;
  readonly power: number;
  readonly curl: number;
}

export type KickOutcome = 'goal' | 'saved' | 'post' | 'over' | 'wide' | 'too-slow';

export interface Kick {
  readonly kicker: Seat;
  readonly outcome: KickOutcome;
}

/** aim: kicker's window · flight: ball on its way · result: showing what happened. */
export type PenaltyPhase = 'aim' | 'flight' | 'result';

export interface PenaltyState {
  readonly phase: PenaltyPhase;
  readonly timer: number;
  readonly kicks: readonly Kick[];
  readonly shot: Shot | null;
  readonly flightT: number;
  readonly flightDuration: number;
  readonly keeperX: number;
  readonly keeperTargetX: number;
  /** −1 / 1 once the keeper has committed to a dive. */
  readonly dive: -1 | 0 | 1;
  readonly diveT: number;
  /** Where the dive started: a diving body covers the whole stretch it flies across. */
  readonly diveFromX: number;
  readonly result: GameResult | null;
}

export interface PenaltyEvents {
  outcome: KickOutcome | null;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const kickerFor = (kickIndex: number): Seat => (kickIndex % 2 === 0 ? 0 : 1);
export const keeperFor = (kickIndex: number): Seat => (kickIndex % 2 === 0 ? 1 : 0);

/** Harder shots fly faster and higher; above 1 the ball clears the bar. */
export const shotHeight = (power: number): number => power * power * 1.15;
const flightTime = (power: number): number => lerp(0.95, 0.38, power);

export function goalsFor(kicks: readonly Kick[], seat: Seat): number {
  return kicks.filter((k) => k.kicker === seat && k.outcome === 'goal').length;
}

/** Ends early once a side can't catch up in the first five each; after that, sudden death by rounds. */
export function shootoutWinner(kicks: readonly Kick[]): Seat | null {
  const taken: [number, number] = [0, 0];
  for (const kick of kicks) taken[kick.kicker]++;
  const goals: [number, number] = [goalsFor(kicks, 0), goalsFor(kicks, 1)];
  if (taken[0] <= REGULATION_KICKS && taken[1] <= REGULATION_KICKS) {
    const left: [number, number] = [REGULATION_KICKS - taken[0], REGULATION_KICKS - taken[1]];
    if (goals[0] + left[0] < goals[1]) return 1;
    if (goals[1] + left[1] < goals[0]) return 0;
    if (left[0] > 0 || left[1] > 0) return null;
  }
  if (taken[0] === taken[1] && goals[0] !== goals[1]) return goals[0] > goals[1] ? 0 : 1;
  return null;
}

function freshKick(kicks: readonly Kick[], result: GameResult | null): PenaltyState {
  return {
    phase: 'aim',
    timer: AIM_WINDOW,
    kicks,
    shot: null,
    flightT: 0,
    flightDuration: 0,
    keeperX: GOAL_CENTER_X,
    keeperTargetX: GOAL_CENTER_X,
    dive: 0,
    diveT: 0,
    diveFromX: GOAL_CENTER_X,
    result,
  };
}

export function newPenaltyGame(): PenaltyState {
  return freshKick([], null);
}

export function penaltyShoot(state: PenaltyState, seat: Seat, shot: Shot): PenaltyState {
  if (state.result || state.phase !== 'aim' || seat !== kickerFor(state.kicks.length)) return state;
  const power = clamp(shot.power, 0, 1);
  return {
    ...state,
    phase: 'flight',
    shot: { aim: clamp(shot.aim, -1.4, 1.4), power, curl: clamp(shot.curl, -1, 1) },
    flightT: 0,
    flightDuration: flightTime(power),
  };
}

/** The keeper shuffles toward x along the line (until they dive). */
export function penaltyKeeperTarget(state: PenaltyState, seat: Seat, x: number): PenaltyState {
  if (state.result || state.phase === 'result' || seat !== keeperFor(state.kicks.length) || state.dive !== 0) return state;
  return { ...state, keeperTargetX: clamp(x, GOAL_CENTER_X - KEEPER_RANGE, GOAL_CENTER_X + KEEPER_RANGE) };
}

/** One committed dive per kick. */
export function penaltyDive(state: PenaltyState, seat: Seat, dir: -1 | 1): PenaltyState {
  if (state.result || state.phase === 'result' || seat !== keeperFor(state.kicks.length) || state.dive !== 0) return state;
  return { ...state, dive: dir, diveT: 0, diveFromX: state.keeperX };
}

/** Where the ball crosses the goal line, in x. */
export const shotX = (shot: Shot): number => GOAL_CENTER_X + shot.aim * GOAL_HALF_WIDTH;

function judge(state: PenaltyState, shot: Shot): KickOutcome {
  const aim = Math.abs(shot.aim);
  if (aim > 1.06) return 'wide';
  if (aim >= 0.94) return 'post';
  const height = shotHeight(shot.power);
  if (height > 1) return 'over';
  const bx = shotX(shot);
  if (Math.abs(bx - state.keeperX) <= KEEPER_BODY + BALL_RADIUS && height <= BODY_HEIGHT) return 'saved';
  if (state.dive !== 0 && height <= HANDS_HEIGHT) {
    // The diving body sweeps from where it started to where it is now, with hands reaching ahead.
    const lo = Math.min(state.diveFromX, state.keeperX) - KEEPER_BODY - BALL_RADIUS;
    const hi = Math.max(state.diveFromX, state.keeperX) + KEEPER_BODY + BALL_RADIUS;
    const from = state.dive === 1 ? lo : lo - HAND_REACH;
    const to = state.dive === 1 ? hi + HAND_REACH : hi;
    if (bx >= from && bx <= to) return 'saved';
  }
  return 'goal';
}

export function stepPenalty(state: PenaltyState, dt = PK_STEP): { state: PenaltyState; events: PenaltyEvents } {
  const events: PenaltyEvents = { outcome: null };
  if (state.result && state.phase === 'result') return { state, events };

  if (state.phase === 'result') {
    const timer = state.timer - dt;
    return { state: timer > 0 ? { ...state, timer } : freshKick(state.kicks, state.result), events };
  }

  // Keeper: shuffle toward the target, or fly through a committed dive (fast at first, then slowing).
  let keeperX = state.keeperX;
  let diveT = state.diveT;
  if (state.dive !== 0) {
    if (diveT < DIVE_TIME) keeperX += state.dive * DIVE_SPEED * dt * (1 - diveT / DIVE_TIME);
    diveT += dt;
  } else {
    const step = KEEPER_SPEED * dt;
    keeperX += clamp(state.keeperTargetX - keeperX, -step, step);
  }
  keeperX = clamp(keeperX, GOAL_CENTER_X - KEEPER_RANGE - 40, GOAL_CENTER_X + KEEPER_RANGE + 40);
  let next: PenaltyState = { ...state, keeperX, diveT };

  if (next.phase === 'aim') {
    const timer = next.timer - dt;
    if (timer > 0) return { state: { ...next, timer }, events };
    return finish(next, 'too-slow', events);
  }

  const flightT = next.flightT + dt;
  next = { ...next, flightT };
  if (flightT < next.flightDuration || !next.shot) return { state: next, events };
  return finish(next, judge(next, next.shot), events);
}

function finish(state: PenaltyState, outcome: KickOutcome, events: PenaltyEvents): { state: PenaltyState; events: PenaltyEvents } {
  events.outcome = outcome;
  const kicks = [...state.kicks, { kicker: kickerFor(state.kicks.length), outcome }];
  const winner = shootoutWinner(kicks);
  const result: GameResult | null = winner === null ? null : { winners: [winner], draw: false };
  return { state: { ...state, kicks, phase: 'result', timer: RESULT_PAUSE, result }, events };
}

export interface PenaltyTier {
  /** How close to the posts the bot aims as a kicker (0 = middle). */
  readonly aim: number;
  readonly aimError: number;
  readonly power: number;
  /** As a keeper: seconds after the kick before diving. */
  readonly reaction: number;
  /** As a keeper: chance of reading the right side. */
  readonly read: number;
}

export const PENALTY_TIERS: Record<BotTier, PenaltyTier> = {
  easy: { aim: 0.35, aimError: 0.3, power: 0.5, reaction: 0.05, read: 0.5 },
  medium: { aim: 0.6, aimError: 0.22, power: 0.62, reaction: 0.12, read: 0.65 },
  hard: { aim: 0.72, aimError: 0.14, power: 0.74, reaction: 0.14, read: 0.78 },
  expert: { aim: 0.82, aimError: 0.08, power: 0.82, reaction: 0.16, read: 0.88 },
};

/** A bot's shot. `noise` values in [-1, 1]: [side, aim error, power error]. */
export function penaltyBotShot(tier: PenaltyTier, noise: readonly [number, number, number]): Shot {
  const side = noise[0] >= 0 ? 1 : -1;
  const aim = side * clamp(tier.aim + noise[1] * tier.aimError, 0, 1.1);
  return { aim, power: clamp(tier.power + noise[2] * 0.08, 0.2, 1), curl: side * 0.4 };
}

/**
 * A bot keeper's decision: dive (or not) once its reaction time has passed after the kick.
 * `read01` in [0, 1] decides whether it reads the shot correctly.
 */
export function penaltyBotDive(state: PenaltyState, tier: PenaltyTier, read01: number, sinceKick: number): -1 | 0 | 1 {
  if (state.phase !== 'flight' || !state.shot || state.dive !== 0 || sinceKick < tier.reaction) return 0;
  const offset = shotX(state.shot) - state.keeperX;
  if (Math.abs(offset) <= KEEPER_BODY) return 0;
  const correct: -1 | 1 = offset > 0 ? 1 : -1;
  return read01 < tier.read ? correct : correct === 1 ? -1 : 1;
}

export const penaltyKicks: RealtimeGameDefinition = {
  id: 'penalty-kicks',
  name: 'Penalty Kicks',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive'],
  realtime: true,
};
