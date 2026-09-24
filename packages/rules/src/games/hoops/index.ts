import type { BotTier, GameResult, RealtimeGameDefinition, Seat } from '../../core/types';

/**
 * Basketball Hoops (docs/games/hoops.md): two players, one phone, each with their own little court
 * in their half, seen from the side. Flick the ball at the hoop; it arcs, clangs off the rim and
 * the backboard, and drops through or doesn't. Every basket moves you to a new spot. Most baskets
 * in a minute wins; level at the buzzer, the next basket wins. Real time, a pure fixed step.
 *
 * Each half is its own court in its own frame: x across, y down toward that player's edge of the
 * phone, so both players see the same court (the top one's turned round).
 */
export const HOOPS_CANVAS = { width: 600, height: 900 } as const;
export const COURT = { width: 600, height: 450 } as const;
export const HOOPS_STEP = 1 / 120;
export const HOOPS_TIME = 60;
export const HOOPS_BALL_R = 22;
/** The rim runs between two points; the backboard stands at the back of it. */
export const RIM = { front: 452, back: 540, y: 170, r: 5 } as const;
export const BOARD = { x: 552, top: 50, bottom: 196 } as const;
export const FLOOR_Y = 430;
export const MAX_THROW = 1400;

const COUNTDOWN = 1.5;
const GRAVITY = 1500;
const RIM_BOUNCE = 0.55;
const BOARD_BOUNCE = 0.6;
const FLOOR_BOUNCE = 0.5;
/** How long a ball may be in the air before it is called dead, and the wait before the next one. */
const LIFE = 3.2;
const NEXT = 0.55;

export interface HoopsBall {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
}

export interface HoopsCourt {
  /** 'ready': in the hand at the spot · 'flying' · 'done': scored or dead, waiting for the next. */
  readonly phase: 'ready' | 'flying' | 'done';
  readonly ball: HoopsBall;
  /** Where this player shoots from now. */
  readonly spot: { readonly x: number; readonly y: number };
  /** Seconds held while ready, in the air while flying, left to wait while done. */
  readonly timer: number;
  readonly shots: number;
  readonly made: boolean;
  /** Touched the rim or board on the way in: not a swish. */
  readonly touched: boolean;
}

export interface HoopsState {
  readonly seed: number;
  readonly phase: 'countdown' | 'play' | 'golden' | 'over';
  readonly timer: number;
  readonly clock: number;
  readonly courts: readonly [HoopsCourt, HoopsCourt];
  readonly scores: readonly [number, number];
  readonly result: GameResult | null;
}

export interface HoopsInput {
  /** A throw this step, as a velocity in the player's own court frame, or null. */
  readonly throw: { readonly vx: number; readonly vy: number } | null;
}

export interface HoopsEvents {
  thrown: Seat[];
  rim: Seat[];
  board: Seat[];
  /** Baskets this step, and whether each was a swish. */
  scored: { seat: Seat; swish: boolean }[];
  missed: Seat[];
  buzzer: boolean;
}

/** A number in [0, 1) from the seed and a counter. */
function hash(seed: number, n: number): number {
  let h = (seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 2 ** 32;
}

/** Where `seat` shoots from after `shots` shots: the left of their court, near or far. Both players get the same run of spots. */
export function spotFor(seed: number, shots: number): { x: number; y: number } {
  return { x: 70 + hash(seed, shots * 2) * 230, y: 250 + hash(seed, shots * 2 + 1) * 140 };
}

function ready(seed: number, shots: number): HoopsCourt {
  const spot = spotFor(seed, shots);
  return { phase: 'ready', ball: { x: spot.x, y: spot.y, vx: 0, vy: 0 }, spot, timer: 0, shots, made: false, touched: false };
}

export function newHoops(seed: number): HoopsState {
  return { seed, phase: 'countdown', timer: COUNTDOWN, clock: HOOPS_TIME, courts: [ready(seed, 0), ready(seed, 0)], scores: [0, 0], result: null };
}

/** A ball against a fixed point (a rim end): bounced off it with some give. */
function offPoint(b: { x: number; y: number; vx: number; vy: number }, px: number, py: number, r: number): boolean {
  const dx = b.x - px;
  const dy = b.y - py;
  const d = Math.hypot(dx, dy);
  const reach = HOOPS_BALL_R + r;
  if (d >= reach || d < 1e-6) return false;
  const ux = dx / d;
  const uy = dy / d;
  b.x = px + ux * reach;
  b.y = py + uy * reach;
  const along = b.vx * ux + b.vy * uy;
  if (along < 0) {
    b.vx -= (1 + RIM_BOUNCE) * along * ux;
    b.vy -= (1 + RIM_BOUNCE) * along * uy;
  }
  return true;
}

function stepCourt(state: HoopsState, seat: Seat, court: HoopsCourt, input: HoopsInput, events: HoopsEvents, dt: number): { court: HoopsCourt; point: boolean } {
  if (court.phase === 'ready') {
    if (!input.throw) return { court: { ...court, timer: court.timer + dt }, point: false };
    const t = input.throw;
    const speed = Math.hypot(t.vx, t.vy);
    // Only a throw upward counts; a flick down or sideways is not a shot.
    if (t.vy >= 0 || speed < 150) return { court: { ...court, timer: court.timer + dt }, point: false };
    const k = speed > MAX_THROW ? MAX_THROW / speed : 1;
    events.thrown.push(seat);
    return { court: { ...court, phase: 'flying', timer: 0, ball: { ...court.ball, vx: t.vx * k, vy: t.vy * k } }, point: false };
  }
  if (court.phase === 'done') {
    const timer = court.timer - dt;
    return { court: timer > 0 ? { ...court, timer } : ready(state.seed, court.shots + 1), point: false };
  }
  const b = { ...court.ball };
  const wasY = b.y;
  b.vy += GRAVITY * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  let touched = court.touched;
  // The rim's two ends.
  const front = offPoint(b, RIM.front, RIM.y, RIM.r);
  const back = offPoint(b, RIM.back, RIM.y, RIM.r);
  if (front || back) {
    if (!touched || Math.abs(b.vy) > 200) events.rim.push(seat);
    touched = true;
  }
  // The backboard: a thin upright at the back of the hoop.
  if (b.y > BOARD.top - HOOPS_BALL_R && b.y < BOARD.bottom + HOOPS_BALL_R && b.x + HOOPS_BALL_R > BOARD.x && b.x < BOARD.x + 8) {
    if (b.vx > 0) {
      b.x = BOARD.x - HOOPS_BALL_R;
      b.vx = -b.vx * BOARD_BOUNCE;
      events.board.push(seat);
      touched = true;
    }
  }
  // Nothing goes up through a hoop: the net turns it back down.
  if (wasY > RIM.y && b.y <= RIM.y && b.vy < 0 && b.x > RIM.front && b.x < RIM.back) {
    b.y = RIM.y + 1;
    b.vy = -b.vy * 0.3;
    touched = true;
  }
  // The middle of the phone is this court's ceiling.
  if (b.y < HOOPS_BALL_R) {
    b.y = HOOPS_BALL_R;
    b.vy = -b.vy * 0.5;
  }
  if (b.y > FLOOR_Y - HOOPS_BALL_R) {
    b.y = FLOOR_Y - HOOPS_BALL_R;
    b.vy = -b.vy * FLOOR_BOUNCE;
    b.vx *= 0.8;
  }
  const timer = court.timer + dt;
  // Through the hoop: the ball's middle passes down across the rim line, between its ends.
  if (!court.made && wasY < RIM.y && b.y >= RIM.y && b.vy > 0 && b.x > RIM.front + RIM.r && b.x < RIM.back - RIM.r) {
    events.scored.push({ seat, swish: !touched });
    return { court: { ...court, ball: b, touched, made: true, timer }, point: true };
  }
  // Dead: off the court, or rolling on the floor, or just too long in the air.
  const gone = b.x < -HOOPS_BALL_R || b.x > COURT.width + HOOPS_BALL_R || timer > LIFE;
  const rolling = b.y >= FLOOR_Y - HOOPS_BALL_R - 1 && Math.abs(b.vy) < 60 && timer > 0.3;
  if (gone || rolling || (court.made && b.y > RIM.y + 90)) {
    if (!court.made) events.missed.push(seat);
    return { court: { ...court, ball: b, phase: 'done', timer: NEXT, touched }, point: false };
  }
  return { court: { ...court, ball: b, touched, timer }, point: false };
}

/** Advances the match by one fixed step. Pure. */
export function stepHoops(state: HoopsState, inputs: readonly [HoopsInput, HoopsInput], dt = HOOPS_STEP): { state: HoopsState; events: HoopsEvents } {
  const events: HoopsEvents = { thrown: [], rim: [], board: [], scored: [], missed: [], buzzer: false };
  if (state.result) return { state, events };
  if (state.phase === 'countdown') {
    const timer = state.timer - dt;
    return { state: { ...state, timer: Math.max(timer, 0), phase: timer > 0 ? 'countdown' : 'play' }, events };
  }
  const scores: [number, number] = [state.scores[0], state.scores[1]];
  const courts = ([0, 1] as const).map((seat) => {
    const { court, point } = stepCourt(state, seat, state.courts[seat], inputs[seat], events, dt);
    if (point) scores[seat]++;
    return court;
  }) as unknown as [HoopsCourt, HoopsCourt];
  const clock = Math.max(state.clock - dt, 0);
  let phase = state.phase;
  let result: GameResult | null = null;
  if (phase === 'play' && clock === 0) {
    events.buzzer = true;
    if (scores[0] !== scores[1]) result = { winners: [scores[0] > scores[1] ? 0 : 1], draw: false };
    else phase = 'golden';
  } else if (phase === 'golden' && scores[0] !== scores[1]) {
    // The first basket after the buzzer wins; two in the same step is still level.
    result = { winners: [scores[0] > scores[1] ? 0 : 1], draw: false };
  }
  return { state: { ...state, courts, scores, clock, phase: result ? 'over' : phase, result }, events };
}

export interface HoopsTier {
  /** Seconds from getting the ball to letting it go. */
  readonly pace: number;
  /** How far off the right speed its throw can be, as a fraction either way. */
  readonly error: number;
}

export const HOOPS_TIERS: Record<BotTier, HoopsTier> = {
  easy: { pace: 1.8, error: 0.08 },
  medium: { pace: 1.4, error: 0.055 },
  hard: { pace: 1.1, error: 0.04 },
  expert: { pace: 0.85, error: 0.028 },
};

/** The throw that drops a ball from `spot` into the middle of the hoop, its arc topping out `lift` px above the rim. */
export function perfectThrow(spot: { x: number; y: number }, lift = 110): { vx: number; vy: number } {
  const apex = RIM.y - lift;
  const up = Math.sqrt(2 * GRAVITY * (spot.y - apex));
  const time = up / GRAVITY + Math.sqrt((2 * (RIM.y - apex)) / GRAVITY);
  return { vx: ((RIM.front + RIM.back) / 2 - spot.x) / time, vy: -up };
}

/** Bot hand: holds the ball for its pace, then throws, the speed off by a seeded wobble. */
export function hoopsBotInput(state: HoopsState, seat: Seat, tier: HoopsTier): HoopsInput {
  const court = state.courts[seat];
  if (state.phase === 'countdown' || court.phase !== 'ready' || state.result) return { throw: null };
  if (court.timer < tier.pace) return { throw: null };
  const lift = 90 + hash(state.seed, court.shots * 5 + seat * 3 + 7) * 50;
  const t = perfectThrow(court.spot, lift);
  const off = 1 + (hash(state.seed, court.shots * 5 + seat * 3 + 11) * 2 - 1) * tier.error;
  return { throw: { vx: t.vx * off, vy: t.vy * off } };
}

export const hoops: RealtimeGameDefinition = {
  id: 'hoops',
  name: 'Basketball Hoops',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive'],
  realtime: true,
};
