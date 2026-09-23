import type { BotTier, GameResult, RealtimeGameDefinition, Seat } from '../../core/types';

/**
 * Spinner War (docs/games/spinner-war.md): two tops in a bowl. The bowl pulls them together, every
 * clash winds their spin down, and a top that leaves the bowl or stops spinning loses the round.
 * Top-down, logical pixels; seat 0 launches from below the middle, seat 1 from above.
 */
export const SPINNER_CANVAS = { width: 600, height: 900 } as const;
export const BOWL = { x: 300, y: 450, radius: 262 } as const;
export const TOP_RADIUS = 38;
export const SPINNER_STEP = 1 / 120;
export const POINTS_TO_WIN = 3;
export const RING_OUT_POINTS = 2;
export const SPIN_FINISH_POINTS = 1;
export const FULL_SPIN = 100;

/** The bowl's pull toward the middle at the rim, in px/s²; it grows from nothing at the middle. */
const PULL = 700;
const LEAN = 430;
const GLIDE = 0.55;
/** Spin lost every second just by spinning. */
const SPIN_DECAY = 3.4;
const DASH_SPEED = 380;
const DASH_COST = 6;
const DASH_COOLDOWN = 1.4;
/** Below this, a top is too slow to dash. */
const DASH_FLOOR = 12;
/** Spin lost per px/s of impact: shared by both, plus the slower top's extra. */
const CLASH_SHARED = 0.004;
const CLASH_SLOWER = 0.01;
/** Grinding together below this speed costs no spin: only a real hit does. */
const CLASH_FLOOR = 90;
const RESTITUTION = 0.75;
/** The bowl's lip: a top only goes over it moving outward faster than this; slower, it bounces back. */
const ESCAPE_SPEED = 360;
const LIP_BOUNCE = 0.45;
const COUNTDOWN = 1.3;
const ROUND_PAUSE = 1.4;
/** Each top launches with a spin round the bowl, so the round opens moving. */
const LAUNCH_SPEED = 260;

export interface Top {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly spin: number;
  readonly cooldown: number;
}

export type SpinnerPhase = 'countdown' | 'round' | 'over';
export type RoundEnd = 'ring-out' | 'spin-finish';

export interface SpinnerState {
  readonly tops: readonly [Top, Top];
  readonly phase: SpinnerPhase;
  readonly timer: number;
  readonly points: readonly [number, number];
  readonly lastRound: { readonly winner: Seat; readonly how: RoundEnd } | null;
  readonly result: GameResult | null;
}

export interface SpinnerInput {
  /** Which way to lean, length 0…1 (null = no lean). */
  readonly steer: { readonly x: number; readonly y: number } | null;
  readonly dash: boolean;
}

export interface SpinnerEvents {
  /** Impact speed of a clash this step (0 = none). */
  clash: number;
  dash: [boolean, boolean];
  roundOver: { winner: Seat; how: RoundEnd } | null;
}

function launch(): readonly [Top, Top] {
  // Opposite sides of the middle, sent round the bowl the same way, so they come together.
  return [
    { x: BOWL.x, y: BOWL.y + 150, vx: -LAUNCH_SPEED, vy: 0, spin: FULL_SPIN, cooldown: 0 },
    { x: BOWL.x, y: BOWL.y - 150, vx: LAUNCH_SPEED, vy: 0, spin: FULL_SPIN, cooldown: 0 },
  ];
}

export function newSpinnerGame(): SpinnerState {
  return { tops: launch(), phase: 'countdown', timer: COUNTDOWN, points: [0, 0], lastRound: null, result: null };
}

export const fromMiddle = (t: { x: number; y: number }): number => Math.hypot(t.x - BOWL.x, t.y - BOWL.y);

/** A top's weight in a clash: a fast-spinning top is harder to shove. */
const massOf = (t: Top) => 0.6 + t.spin / FULL_SPIN;

function drive(t: Top, input: SpinnerInput, dt: number, dashed: boolean): Top {
  let { vx, vy } = t;
  const dx = BOWL.x - t.x;
  const dy = BOWL.y - t.y;
  const d = Math.hypot(dx, dy);
  if (d > 0) {
    // The bowl: pulled toward the middle, harder the higher up the side.
    const pull = PULL * (d / BOWL.radius);
    vx += (dx / d) * pull * dt;
    vy += (dy / d) * pull * dt;
  }
  if (input.steer && t.spin > 0) {
    const len = Math.hypot(input.steer.x, input.steer.y);
    const scale = len > 1 ? 1 / len : 1;
    // A top low on spin leans more feebly.
    const grip = 0.4 + 0.6 * (t.spin / FULL_SPIN);
    vx += input.steer.x * scale * LEAN * grip * dt;
    vy += input.steer.y * scale * LEAN * grip * dt;
  }
  if (dashed) {
    const dir = input.steer && Math.hypot(input.steer.x, input.steer.y) > 0.2 ? input.steer : { x: vx, y: vy };
    const len = Math.hypot(dir.x, dir.y) || 1;
    vx += (dir.x / len) * DASH_SPEED;
    vy += (dir.y / len) * DASH_SPEED;
  }
  const damp = Math.exp(-GLIDE * dt);
  vx *= damp;
  vy *= damp;
  return {
    x: t.x + vx * dt,
    y: t.y + vy * dt,
    vx,
    vy,
    spin: Math.max(0, t.spin - SPIN_DECAY * dt - (dashed ? DASH_COST : 0)),
    cooldown: dashed ? DASH_COOLDOWN : Math.max(0, t.cooldown - dt),
  };
}

export const canDash = (t: Top): boolean => t.cooldown === 0 && t.spin > DASH_FLOOR;

/** Advances the bowl by one fixed step. Pure. */
export function stepSpinner(state: SpinnerState, inputs: readonly [SpinnerInput, SpinnerInput], dt = SPINNER_STEP): { state: SpinnerState; events: SpinnerEvents } {
  const events: SpinnerEvents = { clash: 0, dash: [false, false], roundOver: null };
  if (state.result) return { state, events };
  if (state.phase === 'countdown') {
    const timer = state.timer - dt;
    return { state: timer > 0 ? { ...state, timer } : { ...state, phase: 'round', timer: 0 }, events };
  }
  if (state.phase === 'over') {
    const timer = state.timer - dt;
    if (timer > 0) return { state: { ...state, timer }, events };
    return { state: { ...state, tops: launch(), phase: 'countdown', timer: COUNTDOWN }, events };
  }

  const [a, b] = state.tops;
  const dashA = inputs[0].dash && canDash(a);
  const dashB = inputs[1].dash && canDash(b);
  events.dash = [dashA, dashB];
  let t0 = drive(a, inputs[0], dt, dashA);
  let t1 = drive(b, inputs[1], dt, dashB);

  const dx = t1.x - t0.x;
  const dy = t1.y - t0.y;
  const dist = Math.hypot(dx, dy);
  const minDist = TOP_RADIUS * 2;
  if (dist < minDist && dist > 0) {
    const nx = dx / dist;
    const ny = dy / dist;
    const m0 = massOf(t0);
    const m1 = massOf(t1);
    const overlap = minDist - dist;
    t0 = { ...t0, x: t0.x - nx * overlap * (m1 / (m0 + m1)), y: t0.y - ny * overlap * (m1 / (m0 + m1)) };
    t1 = { ...t1, x: t1.x + nx * overlap * (m0 / (m0 + m1)), y: t1.y + ny * overlap * (m0 / (m0 + m1)) };
    const approach = (t1.vx - t0.vx) * nx + (t1.vy - t0.vy) * ny;
    if (approach < 0) {
      const hit = -approach;
      // Who was going faster into the hit keeps more of their spin.
      const s0 = Math.hypot(a.vx, a.vy);
      const s1 = Math.hypot(b.vx, b.vy);
      const share0 = s0 + s1 > 0 ? s0 / (s0 + s1) : 0.5;
      const impulse = ((1 + RESTITUTION) * hit) / (1 / m0 + 1 / m1);
      const cost = Math.max(0, hit - CLASH_FLOOR);
      t0 = { ...t0, vx: t0.vx - (impulse / m0) * nx, vy: t0.vy - (impulse / m0) * ny, spin: Math.max(0, t0.spin - cost * (CLASH_SHARED + CLASH_SLOWER * (1 - share0))) };
      t1 = { ...t1, vx: t1.vx + (impulse / m1) * nx, vy: t1.vy + (impulse / m1) * ny, spin: Math.max(0, t1.spin - cost * (CLASH_SHARED + CLASH_SLOWER * share0)) };
      events.clash = hit;
    }
  }

  // The lip: a top that reaches the rim going slowly is turned back in; a hard-thrown one goes over.
  const lip = (t: Top): { top: Top; over: boolean } => {
    const d = fromMiddle(t);
    if (d <= BOWL.radius) return { top: t, over: false };
    const nx = (t.x - BOWL.x) / d;
    const ny = (t.y - BOWL.y) / d;
    const outward = t.vx * nx + t.vy * ny;
    if (outward > ESCAPE_SPEED) return { top: t, over: true };
    const back = outward > 0 ? outward * (1 + LIP_BOUNCE) : 0;
    return { top: { ...t, x: BOWL.x + nx * BOWL.radius, y: BOWL.y + ny * BOWL.radius, vx: t.vx - back * nx, vy: t.vy - back * ny }, over: false };
  };
  const l0 = lip(t0);
  const l1 = lip(t1);
  t0 = l0.top;
  t1 = l1.top;
  const out = [l0.over, l1.over];
  const spent = [t0.spin <= 0, t1.spin <= 0];
  let loser: Seat | null = null;
  let how: RoundEnd = 'ring-out';
  if (out[0] || out[1]) {
    loser = out[0] && out[1] ? (fromMiddle(t0) > fromMiddle(t1) ? 0 : 1) : out[0] ? 0 : 1;
  } else if (spent[0] || spent[1]) {
    how = 'spin-finish';
    // Both stopped in the same step: whoever had less spin going into it stopped first. Level even
    // then, nobody scores and the tops go again; giving it to either seat made the second seat win
    // every mirror match, since equal tops run down together.
    if (spent[0] && spent[1]) {
      if (a.spin === b.spin) return { state: { ...state, tops: launch(), phase: 'countdown', timer: COUNTDOWN }, events };
      loser = a.spin < b.spin ? 0 : 1;
    } else loser = spent[0] ? 0 : 1;
  }
  if (loser === null) return { state: { ...state, tops: [t0, t1] }, events };
  const winner: Seat = loser === 0 ? 1 : 0;
  const points: [number, number] = [state.points[0], state.points[1]];
  points[winner] += how === 'ring-out' ? RING_OUT_POINTS : SPIN_FINISH_POINTS;
  events.roundOver = { winner, how };
  const result: GameResult | null = points[winner] >= POINTS_TO_WIN ? { winners: [winner], draw: false } : null;
  return { state: { tops: [t0, t1], phase: 'over', timer: ROUND_PAUSE, points, lastRound: { winner, how }, result }, events };
}

export interface SpinnerTier {
  /** How lined up the bot must be before it dashes (−1 any time … 1 only dead on). */
  readonly alignment: number;
  /** How far from the rim it starts steering back in. */
  readonly rimMargin: number;
  /** Radians of steering error. */
  readonly wobble: number;
  /** How stale its view of the other top is; the scene feeds it an older snapshot. */
  readonly reactionMs: number;
}

export const SPINNER_TIERS: Record<BotTier, SpinnerTier> = {
  easy: { alignment: -0.3, rimMargin: 25, wobble: 0.8, reactionMs: 260 },
  medium: { alignment: 0.3, rimMargin: 60, wobble: 0.45, reactionMs: 180 },
  hard: { alignment: 0.6, rimMargin: 85, wobble: 0.22, reactionMs: 110 },
  expert: { alignment: 0.75, rimMargin: 105, wobble: 0.08, reactionMs: 60 },
};

/**
 * Bot lean and dash: stay off the rim; when it has more spin, come at the other top from the rim side
 * so a hit sends it outward; when it has less, circle and wait for the other to wind down. `noise` in
 * [-1, 1].
 */
export function spinnerBotInput(state: SpinnerState, seat: Seat, tier: SpinnerTier, noise = 0): SpinnerInput {
  if (state.phase !== 'round') return { steer: null, dash: false };
  const me = state.tops[seat];
  const them = state.tops[seat === 0 ? 1 : 0];
  const rot = (v: { x: number; y: number }) => {
    const angle = noise * tier.wobble;
    return { x: v.x * Math.cos(angle) - v.y * Math.sin(angle), y: v.x * Math.sin(angle) + v.y * Math.cos(angle) };
  };
  if (BOWL.radius - fromMiddle(me) < tier.rimMargin) return { steer: rot({ x: BOWL.x - me.x, y: BOWL.y - me.y }), dash: false };

  const toThem = { x: them.x - me.x, y: them.y - me.y };
  const distance = Math.hypot(toThem.x, toThem.y) || 1;
  if (me.spin + 5 < them.spin) {
    // Behind on spin: circle the middle, the way it is already going, and let them waste theirs.
    const cx = me.x - BOWL.x;
    const cy = me.y - BOWL.y;
    const turn = cx * me.vy - cy * me.vx >= 0 ? 1 : -1;
    return { steer: rot({ x: -cy * turn, y: cx * turn }), dash: false };
  }
  // Ahead: hit them outward. Aim at a spot just inside them, on the line from the middle.
  const outX = them.x - BOWL.x;
  const outY = them.y - BOWL.y;
  const outLen = Math.hypot(outX, outY) || 1;
  const aligned = (toThem.x * outX + toThem.y * outY) / (distance * outLen);
  // A dash costs spin, so it is only worth it with spin to spare.
  const spare = me.spin > them.spin + 10 || me.spin > 60;
  const dash = spare && canDash(me) && distance < TOP_RADIUS * 2 + 120 && aligned > tier.alignment;
  return { steer: rot(toThem), dash };
}

export const spinnerWar: RealtimeGameDefinition = {
  id: 'spinner-war',
  name: 'Spinner War',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive'],
  realtime: true,
};
