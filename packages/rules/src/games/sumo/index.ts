import type { BotTier, GameResult, RealtimeGameDefinition, Seat } from '../../core/types';

/**
 * Sumo (docs/games/sumo.md): two heavy wrestlers in a round ring. Push the other one out.
 * Top-down, logical pixels; seat 0 starts below the center, seat 1 above.
 */
export const SUMO_CANVAS = { width: 600, height: 900 } as const;
export const RING = { x: 300, y: 450, radius: 250 } as const;
export const WRESTLER_RADIUS = 46;
export const SUMO_STEP = 1 / 120;
export const BOUTS_TO_WIN = 2;

const ACCEL = 1100;
const DRAG = 3;
const SHOVE_SPEED = 520;
const SHOVE_COOLDOWN = 0.6;
const SHOVE_BRACE = 0.18;
const BRACED_MASS = 1.8;
const RESTITUTION = 0.35;
/** Extra friction while the two bodies are locked together: moving someone takes sustained effort. */
const CLINCH_DRAG = 2.5;
const COUNTDOWN = 1.3;
const BOUT_PAUSE = 1.3;
const START_OFFSET = 90;

export interface Wrestler {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  /** Seconds until the next shove is allowed. */
  readonly cooldown: number;
  /** Seconds left of the braced, heavier shove stance. */
  readonly brace: number;
}

/** countdown: "Hakkeyoi!" · bout: wrestling · over: a wrestler is out, short pause. */
export type SumoPhase = 'countdown' | 'bout' | 'over';

export interface SumoState {
  readonly wrestlers: readonly [Wrestler, Wrestler];
  readonly phase: SumoPhase;
  readonly timer: number;
  /** Bouts won by each seat (best of 3). */
  readonly bouts: readonly [number, number];
  readonly lastBoutWinner: Seat | null;
  readonly result: GameResult | null;
}

export interface SumoInput {
  /** Direction to lean/steer, length 0…1 (null = no steering). */
  readonly steer: { readonly x: number; readonly y: number } | null;
  readonly shove: boolean;
}

export interface SumoEvents {
  /** Impact speed of a collision this step (0 = none). */
  clash: number;
  shove: [boolean, boolean];
  /** Winner of the bout that just ended, if any. */
  boutOver: Seat | null;
}

const idleWrestler = (x: number, y: number): Wrestler => ({ x, y, vx: 0, vy: 0, cooldown: 0, brace: 0 });

function startPositions(): readonly [Wrestler, Wrestler] {
  return [idleWrestler(RING.x, RING.y + START_OFFSET), idleWrestler(RING.x, RING.y - START_OFFSET)];
}

export function newSumoGame(): SumoState {
  return { wrestlers: startPositions(), phase: 'countdown', timer: COUNTDOWN, bouts: [0, 0], lastBoutWinner: null, result: null };
}

const distanceFromCenter = (w: Wrestler) => Math.hypot(w.x - RING.x, w.y - RING.y);
export const isOut = (w: Wrestler): boolean => distanceFromCenter(w) > RING.radius;

function drive(w: Wrestler, input: SumoInput, toward: { x: number; y: number }, dt: number, shoved: boolean): Wrestler {
  let { vx, vy } = w;
  if (input.steer) {
    const len = Math.hypot(input.steer.x, input.steer.y);
    const scale = len > 1 ? 1 / len : 1;
    vx += input.steer.x * scale * ACCEL * dt;
    vy += input.steer.y * scale * ACCEL * dt;
  }
  if (shoved) {
    // Shove in the steering direction, or straight at the opponent when not steering.
    const dir = input.steer && Math.hypot(input.steer.x, input.steer.y) > 0.2 ? input.steer : toward;
    const len = Math.hypot(dir.x, dir.y) || 1;
    vx += (dir.x / len) * SHOVE_SPEED;
    vy += (dir.y / len) * SHOVE_SPEED;
  }
  const damp = Math.exp(-DRAG * dt);
  vx *= damp;
  vy *= damp;
  return {
    x: w.x + vx * dt,
    y: w.y + vy * dt,
    vx,
    vy,
    cooldown: shoved ? SHOVE_COOLDOWN : Math.max(0, w.cooldown - dt),
    brace: shoved ? SHOVE_BRACE : Math.max(0, w.brace - dt),
  };
}

/** Advances the ring by one fixed step. Pure. */
export function stepSumo(state: SumoState, inputs: readonly [SumoInput, SumoInput], dt = SUMO_STEP): { state: SumoState; events: SumoEvents } {
  const events: SumoEvents = { clash: 0, shove: [false, false], boutOver: null };
  if (state.result) return { state, events };

  if (state.phase === 'countdown') {
    const timer = state.timer - dt;
    return { state: timer > 0 ? { ...state, timer } : { ...state, phase: 'bout', timer: 0 }, events };
  }
  if (state.phase === 'over') {
    const timer = state.timer - dt;
    if (timer > 0) return { state: { ...state, timer }, events };
    return { state: { ...state, wrestlers: startPositions(), phase: 'countdown', timer: COUNTDOWN }, events };
  }

  const [a, b] = state.wrestlers;
  const shoveA = inputs[0].shove && a.cooldown === 0;
  const shoveB = inputs[1].shove && b.cooldown === 0;
  events.shove = [shoveA, shoveB];
  let w0 = drive(a, inputs[0], { x: b.x - a.x, y: b.y - a.y }, dt, shoveA);
  let w1 = drive(b, inputs[1], { x: a.x - b.x, y: a.y - b.y }, dt, shoveB);

  // Clash: heavy circles bump; a braced (shoving) wrestler counts as heavier.
  const dx = w1.x - w0.x;
  const dy = w1.y - w0.y;
  const dist = Math.hypot(dx, dy);
  const minDist = WRESTLER_RADIUS * 2;
  if (dist < minDist && dist > 0) {
    const nx = dx / dist;
    const ny = dy / dist;
    const m0 = w0.brace > 0 ? BRACED_MASS : 1;
    const m1 = w1.brace > 0 ? BRACED_MASS : 1;
    const overlap = minDist - dist;
    w0 = { ...w0, x: w0.x - nx * overlap * (m1 / (m0 + m1)), y: w0.y - ny * overlap * (m1 / (m0 + m1)) };
    w1 = { ...w1, x: w1.x + nx * overlap * (m0 / (m0 + m1)), y: w1.y + ny * overlap * (m0 / (m0 + m1)) };
    const approach = (w1.vx - w0.vx) * nx + (w1.vy - w0.vy) * ny;
    if (approach < 0) {
      const impulse = (-(1 + RESTITUTION) * approach) / (1 / m0 + 1 / m1);
      w0 = { ...w0, vx: w0.vx - (impulse / m0) * nx, vy: w0.vy - (impulse / m0) * ny };
      w1 = { ...w1, vx: w1.vx + (impulse / m1) * nx, vy: w1.vy + (impulse / m1) * ny };
      events.clash = -approach;
    }
    const clinch = Math.exp(-CLINCH_DRAG * dt);
    w0 = { ...w0, vx: w0.vx * clinch, vy: w0.vy * clinch };
    w1 = { ...w1, vx: w1.vx * clinch, vy: w1.vy * clinch };
  }

  const out0 = isOut(w0);
  const out1 = isOut(w1);
  if (out0 || out1) {
    // Both over the edge in the same instant: whoever is further out loses.
    const loser: Seat = out0 && out1 ? (distanceFromCenter(w0) > distanceFromCenter(w1) ? 0 : 1) : out0 ? 0 : 1;
    const winner: Seat = loser === 0 ? 1 : 0;
    const bouts: [number, number] = [state.bouts[0], state.bouts[1]];
    bouts[winner]++;
    events.boutOver = winner;
    const result: GameResult | null = bouts[winner] >= BOUTS_TO_WIN ? { winners: [winner], draw: false } : null;
    return { state: { wrestlers: [w0, w1], phase: 'over', timer: BOUT_PAUSE, bouts, lastBoutWinner: winner, result }, events };
  }

  return { state: { ...state, wrestlers: [w0, w1] }, events };
}

export interface SumoTier {
  /** How lined up the bot must be before shoving (−1 shoves anytime … 1 only perfectly aligned). */
  readonly alignment: number;
  /** Distance from the edge at which it steers back to safety. */
  readonly edgeMargin: number;
  /** Radians of random steering error. */
  readonly wobble: number;
  /** How stale its view of the opponent is — the client feeds it an older snapshot. */
  readonly reactionMs: number;
}

export const SUMO_TIERS: Record<BotTier, SumoTier> = {
  easy: { alignment: -0.2, edgeMargin: 20, wobble: 0.7, reactionMs: 260 },
  medium: { alignment: 0.35, edgeMargin: 60, wobble: 0.4, reactionMs: 180 },
  hard: { alignment: 0.6, edgeMargin: 90, wobble: 0.2, reactionMs: 110 },
  expert: { alignment: 0.75, edgeMargin: 115, wobble: 0.08, reactionMs: 60 },
};

/**
 * Bot steering and shoving: get between the opponent and the ring center (so pushes go outward),
 * shove when close and lined up, and step back from the edge. `noise` in [-1, 1].
 */
export function sumoBotInput(state: SumoState, seat: Seat, tier: SumoTier, noise = 0): SumoInput {
  if (state.phase !== 'bout') return { steer: null, shove: false };
  const me = state.wrestlers[seat];
  const them = state.wrestlers[seat === 0 ? 1 : 0];

  const rot = (v: { x: number; y: number }) => {
    const angle = noise * tier.wobble;
    return { x: v.x * Math.cos(angle) - v.y * Math.sin(angle), y: v.x * Math.sin(angle) + v.y * Math.cos(angle) };
  };

  const myEdge = RING.radius - distanceFromCenter(me);
  if (myEdge < tier.edgeMargin) {
    return { steer: rot({ x: RING.x - me.x, y: RING.y - me.y }), shove: false };
  }

  // Aim to stand on the center side of the opponent so every push sends them outward.
  const outX = them.x - RING.x;
  const outY = them.y - RING.y;
  const outLen = Math.hypot(outX, outY) || 1;
  const spot = { x: them.x - (outX / outLen) * WRESTLER_RADIUS * 2.2, y: them.y - (outY / outLen) * WRESTLER_RADIUS * 2.2 };
  const toSpot = { x: spot.x - me.x, y: spot.y - me.y };
  const toThem = { x: them.x - me.x, y: them.y - me.y };
  const distance = Math.hypot(toThem.x, toThem.y);
  const aligned = (toThem.x * outX + toThem.y * outY) / ((distance || 1) * outLen);

  const shove = me.cooldown === 0 && distance < WRESTLER_RADIUS * 2 + 70 && aligned > tier.alignment;
  const steer = Math.hypot(toSpot.x, toSpot.y) > 30 ? toSpot : toThem;
  return { steer: rot(steer), shove };
}

export const sumo: RealtimeGameDefinition = {
  id: 'sumo',
  name: 'Sumo',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive'],
  realtime: true,
};
