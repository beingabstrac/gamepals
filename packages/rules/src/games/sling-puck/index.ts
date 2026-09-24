import type { BotTier, GameResult, RealtimeGameDefinition, Seat } from '../../core/types';

/**
 * Sling Puck (docs/games/sling-puck.md): a board split by a wall with one slot in the middle,
 * five pucks on each side and a band across each end. Pull a puck back on your band and let go to
 * fire it through the slot. Both players shoot at once; the first with no pucks left on their
 * side wins. Real time, a pure fixed step like the other duels.
 */
export const SLING_CANVAS = { width: 600, height: 900 } as const;
export const SLING_STEP = 1 / 120;
export const SLING_R = 26;
export const SLING_PUCKS = 5;
/** The wall across the middle, and the slot in it. */
export const SLING_WALL = { y: 450, half: 12, slot0: 240, slot1: 360 } as const;
/** Where each band runs across: seat 0's near the bottom, seat 1's near the top. */
export const BAND_Y = [790, 110] as const;
/** The furthest a band stretches, and the fastest it fires. */
export const MAX_PULL = 150;
export const MAX_SHOT = 1500;
/** Seconds on the clock: if it runs out, fewer pucks on your side wins. */
export const SLING_TIME = 120;

const COUNTDOWN = 1.5;
const FRICTION = 1.1;
const WALL_BOUNCE = 0.7;
const PUCK_BOUNCE = 0.92;
/** How slow a puck has to be before its owner can pick it up again. */
const GRAB_SPEED = 240;
/** How hard a pull fires: speed per px of pull. */
const SHOT_PER_PX = MAX_SHOT / MAX_PULL;

export interface SlingPuck {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
}

export interface SlingState {
  readonly seed: number;
  readonly phase: 'countdown' | 'play' | 'over';
  readonly timer: number;
  readonly clock: number;
  readonly pucks: readonly SlingPuck[];
  readonly result: GameResult | null;
}

/** A shot: which puck, pulled back how far (canvas px from where it sits, away from the slot). */
export interface SlingShot {
  readonly puck: number;
  readonly pull: { readonly x: number; readonly y: number };
}

export interface SlingInput {
  readonly shot: SlingShot | null;
}

export interface SlingEvents {
  shots: Seat[];
  /** Pucks that hit each other, or a wall, hard enough to hear. */
  clack: number;
  thud: number;
  /** Pucks that crossed to the other side this step, by index. */
  crossed: number[];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Whose side a puck is on: seat 0 owns the bottom half. */
export const slingSide = (p: { y: number }): Seat => (p.y > SLING_WALL.y ? 0 : 1);

export const countOn = (state: SlingState, seat: Seat) => state.pucks.filter((p) => slingSide(p) === seat).length;

/** Five pucks in a row on each side, just in front of the band. */
export function newSlingPuck(seed: number): SlingState {
  const { width: W } = SLING_CANVAS;
  const pucks: SlingPuck[] = [];
  for (const seat of [0, 1] as const) {
    for (let i = 0; i < SLING_PUCKS; i++) {
      const x = W / 2 + (i - (SLING_PUCKS - 1) / 2) * 100;
      const y = seat === 0 ? BAND_Y[0] - 60 : BAND_Y[1] + 60;
      pucks.push({ x, y, vx: 0, vy: 0 });
    }
  }
  return { seed, phase: 'countdown', timer: COUNTDOWN, clock: SLING_TIME, pucks, result: null };
}

/** Can `seat` pick up this puck: on their side and nearly still. */
export function canGrab(state: SlingState, seat: Seat, i: number): boolean {
  const p = state.pucks[i];
  return !!p && state.phase === 'play' && slingSide(p) === seat && Math.hypot(p.vx, p.vy) < GRAB_SPEED;
}

/** How a pull fires: back the way it was pulled, harder the further, only ever toward the wall. */
export function shotVelocity(seat: Seat, pull: { x: number; y: number }): { vx: number; vy: number } | null {
  const len = Math.hypot(pull.x, pull.y);
  // A pull toward the wall would fire it into your own band.
  const back = seat === 0 ? pull.y : -pull.y;
  if (len < 12 || back <= 0) return null;
  const k = (Math.min(len, MAX_PULL) * SHOT_PER_PX) / len;
  return { vx: -pull.x * k, vy: -pull.y * k };
}

function collideWall(p: { x: number; y: number; vx: number; vy: number }, events: SlingEvents): void {
  const { width: W, height: H } = SLING_CANVAS;
  if (p.x < SLING_R || p.x > W - SLING_R) {
    p.x = clamp(p.x, SLING_R, W - SLING_R);
    if (Math.abs(p.vx) > 120) events.thud++;
    p.vx = -p.vx * WALL_BOUNCE;
  }
  if (p.y < SLING_R || p.y > H - SLING_R) {
    p.y = clamp(p.y, SLING_R, H - SLING_R);
    if (Math.abs(p.vy) > 120) events.thud++;
    p.vy = -p.vy * WALL_BOUNCE;
  }
  // The two pieces of the middle wall either side of the slot.
  for (const [x0, x1] of [
    [0, SLING_WALL.slot0],
    [SLING_WALL.slot1, W],
  ] as const) {
    const nx = clamp(p.x, x0, x1);
    const ny = clamp(p.y, SLING_WALL.y - SLING_WALL.half, SLING_WALL.y + SLING_WALL.half);
    const dx = p.x - nx;
    const dy = p.y - ny;
    const d = Math.hypot(dx, dy);
    if (d >= SLING_R) continue;
    // Inside the wall itself (it came in fast): push it back out the way it came.
    const [ux, uy] = d > 1e-6 ? [dx / d, dy / d] : [0, p.vy > 0 ? -1 : 1];
    p.x = nx + ux * SLING_R;
    p.y = ny + uy * SLING_R;
    const along = p.vx * ux + p.vy * uy;
    if (along < 0) {
      if (-along > 120) events.thud++;
      p.vx -= (1 + WALL_BOUNCE) * along * ux;
      p.vy -= (1 + WALL_BOUNCE) * along * uy;
    }
  }
}

/** Advances the match by one fixed step. Pure. */
export function stepSling(state: SlingState, inputs: readonly [SlingInput, SlingInput], dt = SLING_STEP): { state: SlingState; events: SlingEvents } {
  const events: SlingEvents = { shots: [], clack: 0, thud: 0, crossed: [] };
  if (state.result) return { state, events };
  if (state.phase === 'countdown') {
    const timer = state.timer - dt;
    return { state: { ...state, timer: Math.max(timer, 0), phase: timer > 0 ? 'countdown' : 'play' }, events };
  }
  const pucks = state.pucks.map((p) => ({ ...p }));
  for (const seat of [0, 1] as const) {
    const shot = inputs[seat].shot;
    if (!shot || !canGrab(state, seat, shot.puck)) continue;
    const v = shotVelocity(seat, shot.pull);
    if (!v) continue;
    const p = pucks[shot.puck]!;
    p.vx = v.vx;
    p.vy = v.vy;
    events.shots.push(seat);
  }
  const drag = Math.exp(-FRICTION * dt);
  for (const p of pucks) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= drag;
    p.vy *= drag;
    if (Math.hypot(p.vx, p.vy) < 6) p.vx = p.vy = 0;
  }
  // Pucks against each other: equal weights, a little give.
  for (let i = 0; i < pucks.length; i++) {
    for (let j = i + 1; j < pucks.length; j++) {
      const a = pucks[i]!;
      const b = pucks[j]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d >= 2 * SLING_R || d < 1e-6) continue;
      const ux = dx / d;
      const uy = dy / d;
      const overlap = 2 * SLING_R - d;
      a.x -= (ux * overlap) / 2;
      a.y -= (uy * overlap) / 2;
      b.x += (ux * overlap) / 2;
      b.y += (uy * overlap) / 2;
      const closing = (a.vx - b.vx) * ux + (a.vy - b.vy) * uy;
      if (closing <= 0) continue;
      if (closing > 120) events.clack++;
      const impulse = ((1 + PUCK_BOUNCE) / 2) * closing;
      a.vx -= impulse * ux;
      a.vy -= impulse * uy;
      b.vx += impulse * ux;
      b.vy += impulse * uy;
    }
  }
  for (const p of pucks) collideWall(p, events);
  pucks.forEach((p, i) => slingSide(p) !== slingSide(state.pucks[i]!) && events.crossed.push(i));
  const next: SlingState = { ...state, pucks, clock: Math.max(state.clock - dt, 0) };
  return { state: { ...next, ...judge(next) }, events };
}

/** Over when a side is empty, or when the clock runs out (fewer pucks on your side wins). */
function judge(state: SlingState): Pick<SlingState, 'phase' | 'result'> {
  const on = [countOn(state, 0), countOn(state, 1)];
  const empty = on.findIndex((n) => n === 0);
  if (empty >= 0) return { phase: 'over', result: { winners: [empty as Seat], draw: false } };
  if (state.clock > 0) return { phase: state.phase, result: null };
  if (on[0] === on[1]) return { phase: 'over', result: { winners: [], draw: true } };
  return { phase: 'over', result: { winners: [on[0]! < on[1]! ? 0 : 1], draw: false } };
}

export interface SlingTier {
  /** Seconds between shots. */
  readonly pace: number;
  /** How far off its aim can be, in radians either way. */
  readonly aim: number;
  /** Picks the puck with the clearest line to the slot, rather than the nearest. */
  readonly choosy: boolean;
}

export const SLING_TIERS: Record<BotTier, SlingTier> = {
  easy: { pace: 2.2, aim: 0.22, choosy: false },
  medium: { pace: 1.6, aim: 0.14, choosy: false },
  hard: { pace: 1.2, aim: 0.08, choosy: true },
  expert: { pace: 0.9, aim: 0.04, choosy: true },
};

/** A number in [-1, 1) from the seed and a counter, for the bots' wobble. */
function wobble(seed: number, n: number): number {
  let h = (seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 2 ** 31 - 1;
}

/** How close the nearest other puck comes to the straight line from `p` to the slot. */
function clearance(state: SlingState, i: number): number {
  const p = state.pucks[i]!;
  const tx = SLING_CANVAS.width / 2 - p.x;
  const ty = SLING_WALL.y - p.y;
  const len = Math.hypot(tx, ty) || 1;
  let best = Infinity;
  state.pucks.forEach((q, j) => {
    if (j === i) return;
    const t = clamp(((q.x - p.x) * tx + (q.y - p.y) * ty) / (len * len), 0, 1);
    best = Math.min(best, Math.hypot(p.x + tx * t - q.x, p.y + ty * t - q.y));
  });
  return best;
}

/**
 * Bot hand: every `pace` seconds it picks up a still puck on its side and fires it at the slot,
 * hard enough to carry well past it, with a seeded wobble in the aim. `shotCount` numbers the shot.
 */
export function slingBotInput(state: SlingState, seat: Seat, tier: SlingTier, sinceShot: number, shotCount: number): SlingInput {
  if (state.phase !== 'play' || sinceShot < tier.pace) return { shot: null };
  const mine = state.pucks.flatMap((_, i) => (canGrab(state, seat, i) ? [i] : []));
  if (!mine.length) return { shot: null };
  const slotX = SLING_CANVAS.width / 2;
  const score = (i: number) => {
    const p = state.pucks[i]!;
    const off = Math.abs(p.x - slotX) + Math.abs(p.y - SLING_WALL.y) * 0.3;
    return tier.choosy ? clearance(state, i) * 2 - off : -off;
  };
  const puck = mine.reduce((a, b) => (score(b) > score(a) ? b : a));
  return { shot: aimAt(state, puck, wobble(state.seed, shotCount * 2 + seat) * tier.aim) };
}

/** The pull that fires puck `i` at the middle of the slot, hard enough to carry well past it, turned by `off` radians. */
export function aimAt(state: SlingState, i: number, off = 0): SlingShot {
  const p = state.pucks[i]!;
  const slotX = SLING_CANVAS.width / 2;
  const angle = Math.atan2(SLING_WALL.y - p.y, slotX - p.x) + off;
  const dist = Math.hypot(slotX - p.x, SLING_WALL.y - p.y);
  const pull = Math.min((dist + 260) * FRICTION, MAX_SHOT) / SHOT_PER_PX;
  return { puck: i, pull: { x: -Math.cos(angle) * pull, y: -Math.sin(angle) * pull } };
}

export const slingPuck: RealtimeGameDefinition = {
  id: 'sling-puck',
  name: 'Sling Puck',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive'],
  realtime: true,
};
