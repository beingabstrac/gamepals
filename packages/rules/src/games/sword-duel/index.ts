import type { BotTier, GameResult, RealtimeGameDefinition, Seat } from '../../core/types';

/**
 * Sword Duel (docs/games/sword-duel.md): two fencers on a strip held upright. Step, lunge and parry;
 * first to five touches. Positions are along the strip in logical pixels, seat 0 at the bottom
 * facing up, seat 1 at the top facing down. Real time, like Sumo: a pure fixed step.
 */
export const DUEL_CANVAS = { width: 600, height: 900 } as const;
export const STRIP = { top: 90, bottom: 810, x: 300 } as const;
export const DUEL_STEP = 1 / 120;
export const TOUCHES_TO_WIN = 5;
export const FENCER_RADIUS = 30;
/** How far a sword reaches from the body, and how much more a lunge adds. */
export const REACH = 95;
export const LUNGE_REACH = 75;

const STEP_SPEED = 230;
const LUNGE_MS = 0.22;
const RECOVER_MS = 0.55;
const PARRY_MS = 0.22;
const PARRY_COOLDOWN = 0.45;
const STUN_MS = 0.6;
const COUNTDOWN = 1.2;
const TOUCH_PAUSE = 1.1;
/** The en-garde lines, as distances from each end of the strip. */
const GUARD = 220;

/** What a fencer is doing: on guard, lunging, stretched after a lunge, parrying, or knocked open. */
export type Stance = 'guard' | 'lunge' | 'recover' | 'parry' | 'stunned';

export interface Fencer {
  /** Position along the strip, y in the canvas. */
  readonly y: number;
  readonly stance: Stance;
  /** Seconds left in the current stance. */
  readonly timer: number;
  /** Seconds until another parry is allowed. */
  readonly parryCooldown: number;
}

export type DuelPhase = 'countdown' | 'bout' | 'touch';

export interface DuelState {
  readonly fencers: readonly [Fencer, Fencer];
  readonly phase: DuelPhase;
  readonly timer: number;
  readonly touches: readonly [number, number];
  /** Who scored the last touch, or 'double' when both hit at once. */
  readonly lastTouch: Seat | 'double' | null;
  readonly result: GameResult | null;
}

export interface DuelInput {
  /** -1 steps back, 1 steps toward the other fencer. */
  readonly step: number;
  readonly lunge: boolean;
  readonly parry: boolean;
}

export interface DuelEvents {
  lunge: [boolean, boolean];
  parried: Seat | null;
  touch: Seat | 'double' | null;
}

const onGuard = (y: number): Fencer => ({ y, stance: 'guard', timer: 0, parryCooldown: 0 });
const lines = (): readonly [Fencer, Fencer] => [onGuard(STRIP.bottom - GUARD), onGuard(STRIP.top + GUARD)];

export function newDuel(): DuelState {
  return { fencers: lines(), phase: 'countdown', timer: COUNTDOWN, touches: [0, 0], lastTouch: null, result: null };
}

/** The gap between the two fencers' bodies. */
export const gapOf = (state: DuelState): number => state.fencers[0].y - state.fencers[1].y - FENCER_RADIUS * 2;

/** How far a fencer's point reaches beyond their body right now. */
export const pointReach = (f: Fencer): number => REACH + (f.stance === 'lunge' ? LUNGE_REACH : 0);

function move(f: Fencer, input: DuelInput, seat: Seat, dt: number): Fencer {
  let { y, stance, timer } = f;
  let parryCooldown = Math.max(0, f.parryCooldown - dt);
  timer = Math.max(0, timer - dt);
  if (timer === 0) {
    if (stance === 'lunge') {
      stance = 'recover';
      timer = RECOVER_MS;
    } else if (stance !== 'guard') stance = 'guard';
  }
  if (stance === 'guard') {
    if (input.lunge) {
      stance = 'lunge';
      timer = LUNGE_MS;
    } else if (input.parry && parryCooldown === 0) {
      stance = 'parry';
      timer = PARRY_MS;
      parryCooldown = PARRY_MS + PARRY_COOLDOWN;
    } else if (input.step !== 0) {
      // Seat 0 goes up the strip toward seat 1; seat 1 comes down.
      const toward = seat === 0 ? -1 : 1;
      y += Math.max(-1, Math.min(1, input.step)) * toward * STEP_SPEED * dt;
    }
  }
  return { y, stance, timer, parryCooldown };
}

/** Advances the bout by one fixed step. Pure. */
export function stepDuel(state: DuelState, inputs: readonly [DuelInput, DuelInput], dt = DUEL_STEP): { state: DuelState; events: DuelEvents } {
  const events: DuelEvents = { lunge: [false, false], parried: null, touch: null };
  if (state.result) return { state, events };
  if (state.phase === 'countdown') {
    const timer = state.timer - dt;
    return { state: timer > 0 ? { ...state, timer } : { ...state, phase: 'bout', timer: 0 }, events };
  }
  if (state.phase === 'touch') {
    const timer = state.timer - dt;
    if (timer > 0) return { state: { ...state, timer }, events };
    return { state: { ...state, fencers: lines(), phase: 'countdown', timer: COUNTDOWN }, events };
  }

  let f0 = move(state.fencers[0], inputs[0], 0, dt);
  let f1 = move(state.fencers[1], inputs[1], 1, dt);
  events.lunge = [f0.stance === 'lunge' && state.fencers[0].stance !== 'lunge', f1.stance === 'lunge' && state.fencers[1].stance !== 'lunge'];
  // Keep to the strip, and never through each other.
  f0 = { ...f0, y: Math.min(STRIP.bottom - FENCER_RADIUS, f0.y) };
  f1 = { ...f1, y: Math.max(STRIP.top + FENCER_RADIUS, f1.y) };
  if (f0.y - f1.y < FENCER_RADIUS * 2) {
    const middle = (f0.y + f1.y) / 2;
    f0 = { ...f0, y: middle + FENCER_RADIUS };
    f1 = { ...f1, y: middle - FENCER_RADIUS };
  }

  const gap = f0.y - f1.y - FENCER_RADIUS * 2;
  const reaches = [f0.stance === 'lunge' && pointReach(f0) >= gap, f1.stance === 'lunge' && pointReach(f1) >= gap];
  // A lunge that reaches a parry is knocked aside: no touch, and the attacker is left open.
  if (reaches[0] && f1.stance === 'parry') {
    f0 = { ...f0, stance: 'stunned', timer: STUN_MS };
    events.parried = 1;
    reaches[0] = false;
  }
  if (reaches[1] && f0.stance === 'parry') {
    f1 = { ...f1, stance: 'stunned', timer: STUN_MS };
    events.parried = 0;
    reaches[1] = false;
  }
  if (!reaches[0] && !reaches[1]) return { state: { ...state, fencers: [f0, f1] }, events };

  const touches: [number, number] = [state.touches[0], state.touches[1]];
  let scorer: Seat | 'double';
  if (reaches[0] && reaches[1]) scorer = 'double';
  else {
    scorer = reaches[0] ? 0 : 1;
    touches[scorer]++;
  }
  events.touch = scorer;
  const winner = touches.findIndex((t) => t >= TOUCHES_TO_WIN);
  const result: GameResult | null = winner >= 0 ? { winners: [winner], draw: false } : null;
  return { state: { fencers: [f0, f1], phase: 'touch', timer: TOUCH_PAUSE, touches, lastTouch: scorer, result }, events };
}

export interface DuelTier {
  /** How stale its view of the other fencer is; the scene feeds it an older snapshot. */
  readonly reactionMs: number;
  /** Chance it parries a lunge it sees coming. */
  readonly parry: number;
  /** Chance it takes an opening when the other is stretched or stunned. */
  readonly punish: number;
  /** How far outside the other's lunge it likes to stand, in px. */
  readonly distance: number;
  /** Chance a step it takes is a jitter the wrong way. */
  readonly jitter: number;
  /** Share of the time it commits to an attack of its own: steps in and lunges. */
  readonly aggression: number;
}

export const DUEL_TIERS: Record<BotTier, DuelTier> = {
  easy: { reactionMs: 260, parry: 0.3, punish: 0.35, distance: 40, jitter: 0.25, aggression: 0.3 },
  medium: { reactionMs: 180, parry: 0.5, punish: 0.6, distance: 25, jitter: 0.15, aggression: 0.25 },
  hard: { reactionMs: 110, parry: 0.7, punish: 0.85, distance: 15, jitter: 0.08, aggression: 0.22 },
  expert: { reactionMs: 60, parry: 0.85, punish: 1, distance: 10, jitter: 0.03, aggression: 0.2 },
};

/**
 * Bot footwork and blade. `seen` is the other fencer a reaction delay ago, and `roll` a number in
 * [0, 1) that the scene changes only every few hundred milliseconds, so each chance is decided about
 * once per lunge rather than 120 times a second. It parries a lunge it sees coming, steps in and
 * lunges when the other is stretched or stunned, and otherwise hovers just outside their lunge.
 */
export function duelBotInput(state: DuelState, seat: Seat, tier: DuelTier, seen: Fencer, roll = 0.5): DuelInput {
  const idle: DuelInput = { step: 0, lunge: false, parry: false };
  if (state.phase !== 'bout') return idle;
  const me = state.fencers[seat];
  if (me.stance !== 'guard') return idle;
  const gap = gapOf(state);
  const lungeReach = REACH + LUNGE_REACH;
  if (seen.stance === 'lunge' && gap < lungeReach + 20) return { step: 0, lunge: false, parry: roll < tier.parry };
  const open = seen.stance === 'recover' || seen.stance === 'stunned';
  if (open && roll < tier.punish) return gap <= lungeReach - 5 ? { step: 0, lunge: true, parry: false } : { step: 1, lunge: false, parry: false };
  // A second roll from the first, for its own attacks and footwork, so they do not move in step with its parries.
  const other = (roll * 7.31) % 1;
  if (other > 1 - tier.aggression) return gap <= lungeReach - 5 ? { step: 0, lunge: true, parry: false } : { step: 1, lunge: false, parry: false };
  const want = lungeReach + tier.distance;
  let step = gap > want + 10 ? 1 : gap < want - 10 ? -1 : 0;
  if (other < tier.jitter) step = step === 0 ? (other < tier.jitter / 2 ? 1 : -1) : -step;
  return { step, lunge: false, parry: false };
}

export const swordDuel: RealtimeGameDefinition = {
  id: 'sword-duel',
  name: 'Sword Duel',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive'],
  realtime: true,
};
