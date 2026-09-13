import type { BotTier, GameResult, RealtimeGameDefinition, Seat } from '../../core/types';

/**
 * Table tennis (docs/games/ping-pong.md). Seen from above: x across, y along the table
 * (seat 0 at the bottom end, seat 1 at the top), z = height above the table. Gravity pulls z;
 * the table bounces the ball; a net stands across the middle.
 */
export const PP_CANVAS = { width: 600, height: 900 } as const;
export const PP_TABLE = { x0: 80, x1: 520, y0: 110, y1: 790 } as const;
export const NET_Y = 450;
export const NET_HEIGHT = 26;
export const PP_STEP = 1 / 120;
export const PP_GRAVITY = 2400;
export const PP_WIN_SCORE = 11;

const RESTITUTION = 0.8;
const BOUNCE_FRICTION = 0.95;
const POINT_PAUSE = 1.1;
const SERVE_HEIGHT = 60;
/** Height at which a returned ball is struck best (the top of its bounce). */
const SWEET_SPOT_Z = 90;

export interface Ball3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly vx: number;
  readonly vy: number;
  readonly vz: number;
}

/** serve: the server holds the ball · rally: ball in play · point: short pause after a point. */
export type PingPongPhase = 'serve' | 'rally' | 'point';
export type PointReason = 'missed' | 'double-bounce' | 'out' | 'net' | 'own-side' | 'bad-serve';

export interface PingPongState {
  readonly ball: Ball3;
  readonly phase: PingPongPhase;
  readonly server: Seat;
  /** True from the serve until the ball bounces on the receiver's side. */
  readonly serving: boolean;
  readonly lastHitter: Seat | null;
  /** Bounces on each side since the last hit. */
  readonly bounces: readonly [number, number];
  readonly scores: readonly [number, number];
  readonly pause: number;
  readonly lastPoint: { readonly winner: Seat; readonly reason: PointReason } | null;
  readonly result: GameResult | null;
}

export interface PingPongEvents {
  bounce: boolean;
  net: boolean;
  /** The serve clipped the net: replayed, no point. */
  let: boolean;
  point: Seat | null;
}

/** A swing: aim −1 (left) … 1 (right) across the table, power 0 … 1. */
export interface Swing {
  readonly aim: number;
  readonly power: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const other = (seat: Seat): Seat => (seat === 0 ? 1 : 0);
const CENTER_X = (PP_TABLE.x0 + PP_TABLE.x1) / 2;
const HALF_WIDTH = (PP_TABLE.x1 - PP_TABLE.x0) / 2;
const HALF_LENGTH = NET_Y - PP_TABLE.y0;

export const sideOf = (y: number): Seat => (y > NET_Y ? 0 : 1);
const onTable = (x: number, y: number) => x >= PP_TABLE.x0 && x <= PP_TABLE.x1 && y >= PP_TABLE.y0 && y <= PP_TABLE.y1;

/** Serve changes every 2 points, and every point once both players reach 10. */
export function serverFor(scores: readonly [number, number]): Seat {
  const total = scores[0] + scores[1];
  if (scores[0] >= 10 && scores[1] >= 10) return total % 2 === 0 ? 0 : 1;
  return Math.floor(total / 2) % 2 === 0 ? 0 : 1;
}

function heldBall(server: Seat): Ball3 {
  return { x: CENTER_X, y: server === 0 ? PP_TABLE.y1 - 10 : PP_TABLE.y0 + 10, z: SERVE_HEIGHT, vx: 0, vy: 0, vz: 0 };
}

export function newPingPongGame(): PingPongState {
  return {
    ball: heldBall(0),
    phase: 'serve',
    server: 0,
    serving: false,
    lastHitter: null,
    bounces: [0, 0],
    scores: [0, 0],
    pause: 0,
    lastPoint: null,
    result: null,
  };
}

/** A player may return the ball once it has bounced exactly once on their side. */
export function isHittable(state: PingPongState, seat: Seat): boolean {
  if (state.phase !== 'rally' || state.serving || state.lastHitter === seat) return false;
  return sideOf(state.ball.y) === seat && state.bounces[seat] === 1;
}

/** 1 at the top of the bounce, falling off the further the ball is from that height. */
export function hitQuality(z: number): number {
  return 1 - Math.min(Math.abs(z - SWEET_SPOT_Z) / 110, 1);
}

/** Velocity that carries the ball from where it is to (tx, ty) on the table in T seconds. */
function launch(from: Ball3, tx: number, ty: number, T: number): Ball3 {
  return { ...from, vx: (tx - from.x) / T, vy: (ty - from.y) / T, vz: ((PP_GRAVITY / 2) * T * T - from.z) / T };
}

/** Serves (if it's this seat's serve) or returns the ball (if it's hittable). Otherwise nothing happens. */
export function swing(state: PingPongState, seat: Seat, input: Swing): PingPongState {
  if (state.result) return state;
  const aim = clamp(input.aim, -1, 1);
  const power = clamp(input.power, 0, 1);
  const toward = seat === 0 ? -1 : 1;

  if (state.phase === 'serve') {
    if (seat !== state.server) return state;
    // The serve bounces once on the server's half (after T1) and carries over the net (flight T2).
    const T1 = 0.55;
    const T2 = 0.5;
    const carry = T1 + BOUNCE_FRICTION * T2;
    const landY = NET_Y + toward * lerp(0.3, 0.8, power) * HALF_LENGTH;
    const landX = CENTER_X + aim * (HALF_WIDTH - 40);
    const b = state.ball;
    const ball: Ball3 = {
      ...b,
      vx: (landX - b.x) / carry,
      vy: (landY - b.y) / carry,
      vz: ((PP_GRAVITY / 2) * T1 * T1 - b.z) / T1,
    };
    return { ...state, phase: 'rally', serving: true, lastHitter: seat, bounces: [0, 0], ball };
  }

  if (!isHittable(state, seat)) return state;
  // Timing matters: mistimed power shots fly long or wide, mistimed flat shots find the net.
  const quality = hitQuality(state.ball.z);
  const depth = HALF_LENGTH * (0.3 + 0.65 * power) * (1 + (1 - quality) * 0.6);
  const tx = CENTER_X + aim * (HALF_WIDTH - 30) * (1 + (1 - quality) * 0.8);
  const T = lerp(1.1, 0.6, power) - (1 - quality) * 0.2;
  return { ...state, lastHitter: seat, bounces: [0, 0], ball: launch(state.ball, tx, NET_Y + toward * depth, T) };
}

function award(state: PingPongState, winner: Seat, reason: PointReason, events: PingPongEvents): { state: PingPongState; events: PingPongEvents } {
  events.point = winner;
  const scores: [number, number] = [state.scores[0], state.scores[1]];
  scores[winner]++;
  const won = scores[winner] >= PP_WIN_SCORE && scores[winner] - scores[other(winner)] >= 2;
  const result: GameResult | null = won ? { winners: [winner], draw: false } : null;
  return {
    state: { ...state, phase: 'point', serving: false, pause: POINT_PAUSE, scores, lastPoint: { winner, reason }, result },
    events,
  };
}

/** Advances the ball by one fixed step and applies the rules. Pure. */
export function stepPingPong(state: PingPongState, dt = PP_STEP): { state: PingPongState; events: PingPongEvents } {
  const events: PingPongEvents = { bounce: false, net: false, let: false, point: null };
  if (state.result || state.phase === 'serve') return { state, events };

  if (state.phase === 'point') {
    const pause = state.pause - dt;
    if (pause > 0) return { state: { ...state, pause }, events };
    const server = serverFor(state.scores);
    return {
      state: { ...state, phase: 'serve', server, serving: false, lastHitter: null, bounces: [0, 0], pause: 0, ball: heldBall(server) },
      events,
    };
  }

  const b = state.ball;
  const hitter = state.lastHitter ?? state.server;
  let vx = b.vx;
  let vy = b.vy;
  let vz = b.vz - PP_GRAVITY * dt;
  const x = b.x + vx * dt;
  const y = b.y + vy * dt;
  let z = b.z + vz * dt;

  // Crossing the middle below the top of the net: the net stops it.
  const crossed = b.y > NET_Y !== y > NET_Y;
  if (crossed && z < NET_HEIGHT && x >= PP_TABLE.x0 - 20 && x <= PP_TABLE.x1 + 20) {
    events.net = true;
    if (state.serving) {
      events.let = true;
      return {
        state: { ...state, phase: 'serve', serving: false, lastHitter: null, bounces: [0, 0], ball: heldBall(state.server) },
        events,
      };
    }
    return award(state, other(hitter), 'net', events);
  }

  if (z <= 0 && vz < 0) {
    const receiver = other(hitter);
    if (!onTable(x, y)) {
      // Off the table: if it already landed on the receiver's side, they failed to return it.
      const landed = !state.serving && state.bounces[receiver] >= 1;
      return award(state, landed ? hitter : receiver, landed ? 'missed' : 'out', events);
    }

    const side = sideOf(y);
    const bounces: [number, number] = [state.bounces[0], state.bounces[1]];
    bounces[side]++;
    events.bounce = true;
    z = 0;
    vz = -vz * RESTITUTION;
    vx *= BOUNCE_FRICTION;
    vy *= BOUNCE_FRICTION;

    let serving = state.serving;
    if (serving) {
      // A serve must bounce on the server's side first, then once on the receiver's side.
      if (side === hitter && bounces[hitter] > 1) return award(state, receiver, 'bad-serve', events);
      if (side === receiver) {
        if (bounces[hitter] === 0) return award(state, receiver, 'bad-serve', events);
        serving = false;
      }
    } else {
      if (side === hitter) return award(state, receiver, 'own-side', events);
      if (bounces[side] >= 2) return award(state, hitter, 'double-bounce', events);
    }
    return { state: { ...state, serving, bounces, ball: { x, y, z, vx, vy, vz } }, events };
  }

  return { state: { ...state, ball: { x, y, z, vx, vy, vz } }, events };
}

export interface PingPongTier {
  /** How far from the sweet spot the bot may strike (0 = always perfect timing). */
  readonly timingError: number;
  /** How close to the lines it aims (0 = middle of the table). */
  readonly aim: number;
  readonly power: number;
  /** Chance of not reaching an easy ball; wide, fast balls are missed more often. */
  readonly missBase: number;
}

export const PING_PONG_TIERS: Record<BotTier, PingPongTier> = {
  easy: { timingError: 0.9, aim: 0.15, power: 0.3, missBase: 0.22 },
  medium: { timingError: 0.6, aim: 0.4, power: 0.5, missBase: 0.12 },
  hard: { timingError: 0.35, aim: 0.65, power: 0.7, missBase: 0.06 },
  expert: { timingError: 0.15, aim: 0.85, power: 0.85, missBase: 0.025 },
};

/** Noise for one ball, each value in [-1, 1]: [timing, side, power, reach]. */
export type BotNoise = readonly [number, number, number, number];

/**
 * The bot's swing this step, or null to wait. The caller re-rolls `noise` for each new ball.
 */
export function pingPongBotSwing(state: PingPongState, seat: Seat, tier: PingPongTier, noise: BotNoise): Swing | null {
  const side = noise[1] >= 0 ? 1 : -1;
  const aim = clamp(tier.aim * side + noise[1] * 0.1, -1, 1);
  const power = clamp(tier.power * (0.85 + 0.15 * noise[2]), 0.1, 1);
  if (state.phase === 'serve') return state.server === seat ? { aim: aim * 0.6, power: 0.5 } : null;
  if (!isHittable(state, seat)) return null;
  // Wide and fast balls are harder to reach; weaker bots miss them more.
  const width = Math.abs(state.ball.x - CENTER_X) / HALF_WIDTH;
  const speed = Math.hypot(state.ball.vx, state.ball.vy) / 1200;
  const missChance = tier.missBase * (1 + 2 * (0.6 * width + 0.4 * speed));
  if ((noise[3] + 1) / 2 < missChance) return null;
  const strikeHeight = SWEET_SPOT_Z + noise[0] * tier.timingError * 80;
  return state.ball.vz <= 0 && state.ball.z <= strikeHeight ? { aim, power } : null;
}

export const pingPong: RealtimeGameDefinition = {
  id: 'ping-pong',
  name: 'Ping Pong',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive'],
  realtime: true,
};
