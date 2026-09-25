import type { BotTier, GameResult, RealtimeGameDefinition, Seat } from '../../core/types';

/**
 * Balloon Bumpers (docs/games/balloon-bumpers.md): two bumper cars in a walled arena, each with a
 * balloon tied on behind. Ram the other car's balloon to pop it; three pops wins. A car's balloon
 * trails opposite the way it is heading, so charging keeps yours safe and turning shows it.
 * Top-down, logical pixels; seat 0 starts at the bottom, seat 1 at the top.
 */
export const BUMPER_CANVAS = { width: 600, height: 900 } as const;
export const ARENA = { left: 30, right: 570, top: 60, bottom: 840 } as const;
export const CAR_R = 36;
export const BALLOON_R = 18;
/** How far behind the car's middle the balloon floats. */
export const BALLOON_BACK = CAR_R + 20;
export const BUMPER_STEP = 1 / 120;
export const POPS_TO_WIN = 3;
/** A round with no pop ends empty after this long; a match is this many rounds at most. */
export const BUMPER_ROUND_SECONDS = 40;
export const BUMPER_MAX_ROUNDS = 7;

const ACCEL = 900;
const DRAG = 1.6;
const DASH_SPEED = 420;
const DASH_COOLDOWN = 1.1;
const TURN_RATE = 4;
const RESTITUTION = 0.8;
const WALL_BOUNCE = 0.7;
/** A balloon pops to a car moving into it; one drifting alongside at the same speed does not. */
const POP_SPEED = 30;
const COUNTDOWN = 1.3;
/** After this long without a pop the walls close in, so two cars circling each other have to meet. */
const CLOSE_AFTER = 20;
const CLOSE_SPEED = 6;
const CLOSE_MAX = 170;
const ROUND_PAUSE = 1.2;

export interface BumperCar {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  /** The way the car faces, radians; the balloon is behind it. */
  readonly heading: number;
  readonly cooldown: number;
}

export type BumperPhase = 'countdown' | 'play' | 'popped';

/** How far the walls have closed in, this far into a round. */
export const wallsIn = (played: number) => Math.min(CLOSE_MAX, Math.max(0, played - CLOSE_AFTER) * CLOSE_SPEED);

export interface BumperState {
  readonly cars: readonly [BumperCar, BumperCar];
  readonly phase: BumperPhase;
  /** Counting down before a round and after a pop; counting up (seconds played) during one. */
  readonly timer: number;
  /** Balloons each seat has popped. */
  readonly pops: readonly [number, number];
  readonly rounds: number;
  readonly lastPop: Seat | null;
  readonly result: GameResult | null;
}

export interface BumperInput {
  readonly steer: { readonly x: number; readonly y: number } | null;
  readonly dash: boolean;
}

export interface BumperEvents {
  bump: number;
  wall: number;
  dash: [boolean, boolean];
  /** The seat that popped a balloon this step. */
  pop: Seat | null;
  /** A round ran out of time with no pop. */
  timeUp: boolean;
}

const start = (seat: Seat): BumperCar =>
  seat === 0
    ? { x: 300, y: ARENA.bottom - 150, vx: 0, vy: 0, heading: -Math.PI / 2, cooldown: 0 }
    : { x: 300, y: ARENA.top + 150, vx: 0, vy: 0, heading: Math.PI / 2, cooldown: 0 };

export function newBumpers(): BumperState {
  return { cars: [start(0), start(1)], phase: 'countdown', timer: COUNTDOWN, pops: [0, 0], rounds: 0, lastPop: null, result: null };
}

/** Once the walls are all the way in, the balloon strings start to let out, so the balloons trail into reach. */
export const stringOut = (played: number) => Math.min(70, Math.max(0, played - CLOSE_AFTER - CLOSE_MAX / CLOSE_SPEED) * 5);

export const balloonOf = (c: BumperCar, played = 0) => {
  const back = BALLOON_BACK + stringOut(played);
  return { x: c.x - Math.cos(c.heading) * back, y: c.y - Math.sin(c.heading) * back };
};

/**
 * The stick pushes the car the way it points and the car turns to face the way it is going, so its
 * balloon trails behind; drag slows it when you let go. A dash is a burst.
 */
function drive(c: BumperCar, input: BumperInput, dt: number, dashed: boolean): BumperCar {
  let { vx, vy } = c;
  if (input.steer) {
    const len = Math.hypot(input.steer.x, input.steer.y);
    const scale = len > 1 ? 1 / len : 1;
    vx += input.steer.x * scale * ACCEL * dt;
    vy += input.steer.y * scale * ACCEL * dt;
  }
  if (dashed) {
    const dir = input.steer && Math.hypot(input.steer.x, input.steer.y) > 0.2 ? input.steer : { x: Math.cos(c.heading), y: Math.sin(c.heading) };
    const len = Math.hypot(dir.x, dir.y) || 1;
    vx += (dir.x / len) * DASH_SPEED;
    vy += (dir.y / len) * DASH_SPEED;
  }
  const damp = Math.exp(-DRAG * dt);
  vx *= damp;
  vy *= damp;
  let heading = c.heading;
  if (Math.hypot(vx, vy) > 25) {
    const want = Math.atan2(vy, vx);
    const diff = Math.atan2(Math.sin(want - heading), Math.cos(want - heading));
    heading += Math.max(-TURN_RATE * dt, Math.min(TURN_RATE * dt, diff));
    heading = Math.atan2(Math.sin(heading), Math.cos(heading));
  }
  return { x: c.x + vx * dt, y: c.y + vy * dt, vx, vy, heading, cooldown: dashed ? DASH_COOLDOWN : Math.max(0, c.cooldown - dt) };
}

/** After the last round: most pops wins, level is a draw. */
function byPops(pops: readonly [number, number]): GameResult {
  if (pops[0] === pops[1]) return { winners: [], draw: true };
  return { winners: [pops[0] > pops[1] ? 0 : 1], draw: false };
}

/** Walls (closed in by `inset`) bounce a car back in. Returns the speed it hit with (0 if it did not). */
function walls(c: BumperCar, inset: number): { car: BumperCar; hit: number } {
  let { x, y, vx, vy } = c;
  let hit = 0;
  const l = ARENA.left + inset + CAR_R;
  const r = ARENA.right - inset - CAR_R;
  const t = ARENA.top + inset + CAR_R;
  const b = ARENA.bottom - inset - CAR_R;
  if (x < l) (x = l), (hit = Math.max(hit, -vx)), (vx = Math.abs(vx) * WALL_BOUNCE);
  if (x > r) (x = r), (hit = Math.max(hit, vx)), (vx = -Math.abs(vx) * WALL_BOUNCE);
  if (y < t) (y = t), (hit = Math.max(hit, -vy)), (vy = Math.abs(vy) * WALL_BOUNCE);
  if (y > b) (y = b), (hit = Math.max(hit, vy)), (vy = -Math.abs(vy) * WALL_BOUNCE);
  return { car: { ...c, x, y, vx, vy }, hit };
}

/** Advances the arena by one fixed step. Pure. */
export function stepBumpers(state: BumperState, inputs: readonly [BumperInput, BumperInput], dt = BUMPER_STEP): { state: BumperState; events: BumperEvents } {
  const events: BumperEvents = { bump: 0, wall: 0, dash: [false, false], pop: null, timeUp: false };
  if (state.result) return { state, events };
  if (state.phase === 'countdown') {
    const timer = state.timer - dt;
    return { state: timer > 0 ? { ...state, timer } : { ...state, phase: 'play', timer: 0 }, events };
  }
  if (state.phase === 'popped') {
    const timer = state.timer - dt;
    if (timer > 0) return { state: { ...state, timer }, events };
    return { state: { ...state, cars: [start(0), start(1)], phase: 'countdown', timer: COUNTDOWN }, events };
  }
  const played = state.timer + dt;
  if (played >= BUMPER_ROUND_SECONDS) {
    // Nobody popped anything: the round ends empty.
    events.timeUp = true;
    const rounds = state.rounds + 1;
    return { state: { ...state, phase: 'popped', timer: ROUND_PAUSE, rounds, lastPop: null, result: rounds >= BUMPER_MAX_ROUNDS ? byPops(state.pops) : null }, events };
  }
  const [a, b] = state.cars;
  const dashA = inputs[0].dash && a.cooldown === 0;
  const dashB = inputs[1].dash && b.cooldown === 0;
  events.dash = [dashA, dashB];
  let c0 = drive(a, inputs[0], dt, dashA);
  let c1 = drive(b, inputs[1], dt, dashB);

  // A balloon pops to the other car's body arriving fast enough.
  for (const [hitter, target, seat] of [
    [c0, c1, 0],
    [c1, c0, 1],
  ] as const) {
    const balloon = balloonOf(target, played);
    const dx = balloon.x - hitter.x;
    const dy = balloon.y - hitter.y;
    const d = Math.hypot(dx, dy);
    if (d < CAR_R + BALLOON_R) {
      const closing = ((hitter.vx - target.vx) * dx + (hitter.vy - target.vy) * dy) / (d || 1);
      if (closing > POP_SPEED) {
        const pops: [number, number] = [state.pops[0], state.pops[1]];
        pops[seat]++;
        events.pop = seat as Seat;
        const rounds = state.rounds + 1;
        const result = pops[seat]! >= POPS_TO_WIN ? ({ winners: [seat as Seat], draw: false } as GameResult) : rounds >= BUMPER_MAX_ROUNDS ? byPops(pops) : null;
        return { state: { cars: [c0, c1], phase: 'popped', timer: ROUND_PAUSE, pops, rounds, lastPop: seat as Seat, result }, events };
      }
    }
  }

  // Cars bump like bumper cars: bouncy circles of equal weight.
  const dx = c1.x - c0.x;
  const dy = c1.y - c0.y;
  const dist = Math.hypot(dx, dy);
  if (dist < CAR_R * 2 && dist > 0) {
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = CAR_R * 2 - dist;
    c0 = { ...c0, x: c0.x - (nx * overlap) / 2, y: c0.y - (ny * overlap) / 2 };
    c1 = { ...c1, x: c1.x + (nx * overlap) / 2, y: c1.y + (ny * overlap) / 2 };
    const approach = (c1.vx - c0.vx) * nx + (c1.vy - c0.vy) * ny;
    if (approach < 0) {
      const j = (-(1 + RESTITUTION) * approach) / 2;
      c0 = { ...c0, vx: c0.vx - j * nx, vy: c0.vy - j * ny };
      c1 = { ...c1, vx: c1.vx + j * nx, vy: c1.vy + j * ny };
      events.bump = -approach;
    }
  }
  const w0 = walls(c0, wallsIn(played));
  const w1 = walls(c1, wallsIn(played));
  events.wall = Math.max(w0.hit, w1.hit);
  return { state: { ...state, cars: [w0.car, w1.car], timer: played }, events };
}

export interface BumperTier {
  /** How lined up with the balloon before it dashes (cosine, 1 is dead on). */
  readonly alignment: number;
  /** Radians of steering error. */
  readonly wobble: number;
  /** How stale its view of the other car is; the client feeds it an older snapshot. */
  readonly reactionMs: number;
  /** How far it aims ahead of where the balloon is going (0 chases it, 1 cuts it off). */
  readonly lead: number;
}

/**
 * Measured, not guessed. Guarding (turning away to hide your balloon) lost 12 of 12 against a bot
 * that did not, so no tier guards; a quicker reaction and a steadier hand are what win, and aiming a
 * little ahead of the balloon. Over 20 matches each: Medium beat Easy 17-3, Hard beat Medium 17-3,
 * Expert beat Hard 19-1, about four pops a match.
 */
export const BUMPER_TIERS: Record<BotTier, BumperTier> = {
  easy: { alignment: 0.3, wobble: 0.9, reactionMs: 300, lead: 0 },
  medium: { alignment: 0.5, wobble: 0.5, reactionMs: 200, lead: 0.2 },
  hard: { alignment: 0.55, wobble: 0.25, reactionMs: 120, lead: 0.4 },
  expert: { alignment: 0.6, wobble: 0.1, reactionMs: 60, lead: 0.6 },
};

/**
 * Bot driving: swing round behind the other car, going round it rather than through it, and charge
 * its balloon, dashing when lined up. `noise` in [-1, 1].
 */
export function bumperBotInput(state: BumperState, seat: Seat, tier: BumperTier, noise = 0): BumperInput {
  if (state.phase !== 'play') return { steer: null, dash: false };
  const me = state.cars[seat];
  const them = state.cars[seat === 0 ? 1 : 0];
  const rot = (v: { x: number; y: number }) => {
    const a = noise * tier.wobble;
    return { x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) };
  };
  // Aim where the balloon will be by the time we get there: chasing where it is now never catches
  // a car going round in a circle at the same speed.
  const now = balloonOf(them, state.timer);
  const eta = Math.hypot(now.x - me.x, now.y - me.y) / 260;
  const target = { x: now.x + them.vx * eta * tier.lead, y: now.y + them.vy * eta * tier.lead };
  const toBalloon = { x: target.x - me.x, y: target.y - me.y };
  const dist = Math.hypot(toBalloon.x, toBalloon.y) || 1;
  // Come at the balloon from behind the car: aim past it a little, away from the car's front.
  const behind = { x: target.x - Math.cos(them.heading) * 40, y: target.y - Math.sin(them.heading) * 40 };
  let steer = dist > 120 ? { x: behind.x - me.x, y: behind.y - me.y } : toBalloon;
  // If their car is in the way, go round it: head for a point out to the side of it instead.
  const toThem = { x: them.x - me.x, y: them.y - me.y };
  const lineLen = Math.hypot(steer.x, steer.y) || 1;
  const along = (toThem.x * steer.x + toThem.y * steer.y) / lineLen;
  const across = Math.abs(toThem.x * steer.y - toThem.y * steer.x) / lineLen;
  if (along > 0 && along < lineLen && across < CAR_R * 2.4) {
    const side = Math.sign(toThem.x * steer.y - toThem.y * steer.x + noise * 0.01) || 1;
    const nx = -toThem.y / (Math.hypot(toThem.x, toThem.y) || 1);
    const ny = toThem.x / (Math.hypot(toThem.x, toThem.y) || 1);
    // Kept inside the walls as they are now, or a closed-in arena pins both cars to a wall.
    const inset = wallsIn(state.timer) + CAR_R + 10;
    const fx = Math.max(ARENA.left + inset, Math.min(ARENA.right - inset, them.x + nx * side * 110));
    const fy = Math.max(ARENA.top + inset, Math.min(ARENA.bottom - inset, them.y + ny * side * 110));
    steer = { x: fx - me.x, y: fy - me.y };
  }
  const facing = (Math.cos(me.heading) * toBalloon.x + Math.sin(me.heading) * toBalloon.y) / dist;
  const dash = me.cooldown === 0 && dist < 230 && facing > tier.alignment;
  return { steer: rot(steer), dash };
}

export const balloonBumpers: RealtimeGameDefinition = {
  id: 'balloon-bumpers',
  name: 'Balloon Bumpers',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive'],
  realtime: true,
};
