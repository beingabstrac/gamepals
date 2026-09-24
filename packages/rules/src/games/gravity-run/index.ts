import type { BotTier, GameResult, RealtimeGameDefinition, Seat } from '../../core/types';

/**
 * Gravity Run (docs/games/gravity-run.md): each player's runner races along their own corridor,
 * in their half of the phone. One tap flips gravity: the runner falls up to the ceiling, or back
 * down to the floor. Blocks stick out of the floor or the ceiling; be on the other side when one
 * comes. Both corridors have the same blocks, faster and faster. Three bumps and you are out.
 *
 * Each corridor is its own frame: x along the run, y down toward that player's edge of the phone.
 */
export const GRAVITY_CANVAS = { width: 600, height: 900 } as const;
export const RUN_STEP = 1 / 120;
export const RUN_LIVES = 3;
export const CORRIDOR = { floor: 380, ceiling: 70 } as const;
export const RUNNER = { x: 150, w: 40, h: 50 } as const;
export const RUN_BLOCK = { w: 60, h: 90 } as const;
/** A match that runs this long ends on hearts left; level is a draw. */
export const RUN_TIME = 120;

const COUNTDOWN = 1.5;
const GRAVITY = 2600;
const START_SPEED = 300;
const SPEED_UP = 6;
const TOP_SPEED = 620;
const FIRST = 700;
const SAFE = 1.2;

export interface Runner {
  /** Height of the runner's middle, and which way gravity pulls it: 1 to the floor, -1 up. */
  readonly y: number;
  readonly vy: number;
  readonly down: 1 | -1;
  readonly lives: number;
  readonly safe: number;
  /** The last block that bumped it, so one block bumps once. */
  readonly bumped: number;
}

export interface GravityState {
  readonly seed: number;
  readonly phase: 'countdown' | 'run' | 'over';
  readonly timer: number;
  readonly time: number;
  readonly distance: number;
  readonly speed: number;
  readonly runners: readonly [Runner, Runner];
  readonly result: GameResult | null;
}

export interface GravityInput {
  readonly flip: boolean;
}

export interface GravityEvents {
  flipped: Seat[];
  landed: Seat[];
  bumped: Seat[];
  out: Seat[];
}

function hash(seed: number, n: number): number {
  let h = (seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 2 ** 32;
}

/** How fast the run is going once it has come `distance` (speed climbs steadily from the start). */
function speedAt(distance: number): number {
  const t = (-START_SPEED + Math.sqrt(START_SPEED * START_SPEED + 2 * SPEED_UP * distance)) / SPEED_UP;
  return Math.min(START_SPEED + SPEED_UP * t, TOP_SPEED);
}

/** Is block `k` one of a close pair (it follows the one before it quickly)? Never twice running. */
const quick = (seed: number, k: number): boolean => k > 4 && hash(seed, k * 5 + 3) < 0.28 && !(k > 5 && hash(seed, (k - 1) * 5 + 3) < 0.28);

/** Where each block stands along the run, per seed, worked out once and kept. */
const placed = new Map<number, number[]>();

/** Block `k`: how far along the run it stands, and whether it sticks down from the ceiling. */
export function blockAt(seed: number, k: number): { at: number; top: boolean } {
  let list = placed.get(seed);
  if (!list) {
    if (placed.size > 32) placed.clear();
    list = [FIRST];
    placed.set(seed, list);
  }
  // Gaps shrink as the run goes on; now and then (past the first few) two come close together on
  // opposite sides, and the flip between them has to be just right.
  for (let i = list.length; i <= k; i++) {
    const at = list[i - 1]!;
    // A quick gap is only as short as a good flip allows at the speed the run will have there.
    const gap = quick(seed, i) ? 0.36 * speedAt(at) + 110 + hash(seed, i * 2) * 30 : Math.max(330, 520 - i * 6) + hash(seed, i * 2) * 160;
    list.push(at + gap);
  }
  // A quick block is always on the other side from the one before it.
  const top = quick(seed, k) && k > 0 ? !(hash(seed, (k - 1) * 2 + 1) < 0.5) : hash(seed, k * 2 + 1) < 0.5;
  return { at: list[k]!, top };
}

/** The blocks near `distance`, found without walking the whole run from the start every step. */
export function blocksNear(seed: number, distance: number, ahead: number): { k: number; at: number; top: boolean }[] {
  const out: { k: number; at: number; top: boolean }[] = [];
  // The average gap is at least 410, so this is never past the first block that matters.
  let k = Math.max(0, Math.floor((distance - FIRST) / 690) - 1);
  for (let b = blockAt(seed, k); b.at < distance + ahead; b = blockAt(seed, ++k)) if (b.at + RUN_BLOCK.w > distance - RUNNER.x - 10) out.push({ k, ...b });
  return out;
}

const standY = (down: 1 | -1) => (down === 1 ? CORRIDOR.floor - RUNNER.h / 2 : CORRIDOR.ceiling + RUNNER.h / 2);
const newRunner = (): Runner => ({ y: standY(1), vy: 0, down: 1, lives: RUN_LIVES, safe: 0, bumped: -1 });

export function newGravityRun(seed: number): GravityState {
  return { seed: seed >>> 0, phase: 'countdown', timer: COUNTDOWN, time: 0, distance: 0, speed: START_SPEED, runners: [newRunner(), newRunner()], result: null };
}

/** Is the runner standing on a floor or ceiling (so a tap can flip it)? */
export const standing = (r: Runner) => Math.abs(r.y - standY(r.down)) < 0.5 && r.vy === 0;

/** Advances the match by one fixed step. Pure. */
export function stepGravity(state: GravityState, inputs: readonly [GravityInput, GravityInput], dt = RUN_STEP): { state: GravityState; events: GravityEvents } {
  const events: GravityEvents = { flipped: [], landed: [], bumped: [], out: [] };
  if (state.result) return { state, events };
  if (state.phase === 'countdown') {
    const timer = state.timer - dt;
    return { state: { ...state, timer: Math.max(timer, 0), phase: timer > 0 ? 'countdown' : 'run' }, events };
  }
  const distance = state.distance + state.speed * dt;
  const speed = Math.min(state.speed + SPEED_UP * dt, TOP_SPEED);
  const time = state.time + dt;
  const near = blocksNear(state.seed, distance, RUNNER.x + 200);
  const runners = state.runners.map((r, i) => {
    const seat = i as Seat;
    if (r.lives <= 0) return r;
    let { down, vy, y, lives, safe, bumped } = r;
    if (inputs[seat].flip && standing(r)) {
      down = down === 1 ? -1 : 1;
      events.flipped.push(seat);
    }
    vy += GRAVITY * down * dt;
    y += vy * dt;
    const rest = standY(down);
    if ((down === 1 && y >= rest) || (down === -1 && y <= rest)) {
      if (vy !== 0 && Math.abs(vy) > 40) events.landed.push(seat);
      y = rest;
      vy = 0;
    }
    safe = Math.max(safe - dt, 0);
    // The runner stands at RUNNER.x along the run: does a block overlap it?
    for (const b of near) {
      if (b.k <= bumped) continue;
      const left = b.at - distance + RUNNER.x;
      const inX = left < RUNNER.x + RUNNER.w / 2 && left + RUN_BLOCK.w > RUNNER.x - RUNNER.w / 2;
      const blockTop = b.top ? CORRIDOR.ceiling : CORRIDOR.floor - RUN_BLOCK.h;
      const blockBottom = blockTop + RUN_BLOCK.h;
      const inY = y - RUNNER.h / 2 < blockBottom && y + RUNNER.h / 2 > blockTop;
      if (!inX || !inY) continue;
      bumped = b.k;
      if (safe > 0) continue;
      lives--;
      safe = SAFE;
      events.bumped.push(seat);
      if (lives <= 0) events.out.push(seat);
    }
    return { y, vy, down, lives, safe, bumped };
  }) as unknown as [Runner, Runner];
  const next: GravityState = { ...state, distance, speed, time, runners };
  const alive = runners.map((r) => r.lives > 0);
  let result: GameResult | null = null;
  if (!alive[0] || !alive[1]) result = alive[0] ? { winners: [0], draw: false } : alive[1] ? { winners: [1], draw: false } : { winners: [], draw: true };
  else if (time >= RUN_TIME) {
    const [a, b] = [runners[0].lives, runners[1].lives];
    result = a === b ? { winners: [], draw: true } : { winners: [a > b ? 0 : 1], draw: false };
  }
  return { state: result ? { ...next, phase: 'over', result } : next, events };
}

export interface GravityTier {
  /** How far before a block it means to flip, px, and how far off that can be either way. */
  readonly lead: number;
  readonly wobble: number;
}

export const GRAVITY_TIERS: Record<BotTier, GravityTier> = {
  easy: { lead: 112, wobble: 80 },
  medium: { lead: 122, wobble: 55 },
  hard: { lead: 124, wobble: 50 },
  expert: { lead: 150, wobble: 24 },
};

/**
 * Bot thumb: when the next block is on its side and has come within its lead (which wobbles a
 * little each block, seeded), it flips. It never flips toward a block on the other side.
 */
export function gravityBotInput(state: GravityState, seat: Seat, tier: GravityTier): GravityInput {
  const r = state.runners[seat];
  if (state.phase !== 'run' || r.lives <= 0 || !standing(r)) return { flip: false };
  const next = blocksNear(state.seed, state.distance, 900).find((b) => b.at + RUN_BLOCK.w > state.distance);
  if (!next) return { flip: false };
  const onMySide = next.top === (r.down === -1);
  if (!onMySide) return { flip: false };
  // The lead grows with speed: a faster run needs an earlier flip.
  const lead = (tier.lead * state.speed) / START_SPEED + (hash(state.seed, next.k * 7 + seat * 3 + 1) * 2 - 1) * tier.wobble;
  return { flip: next.at - state.distance < lead };
}

export const gravityRun: RealtimeGameDefinition = {
  id: 'gravity-run',
  name: 'Gravity Run',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive'],
  realtime: true,
};
