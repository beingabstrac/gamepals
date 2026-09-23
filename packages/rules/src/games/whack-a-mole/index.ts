import { createRng } from '../../core/rng';
import type { BotTier, GameResult, RealtimeGameDefinition, Seat } from '../../core/types';

/**
 * Whack-a-Mole (docs/games/whack-a-mole.md): nine holes each, the same moles popping up on both
 * boards at the same moments, 45 seconds. Real time, a pure fixed step like the other duels.
 */
export const WHACK_CANVAS = { width: 600, height: 900 } as const;
export const WHACK_STEP = 1 / 120;
export const WHACK_HOLES = 9;
export const ROUND_SECONDS = 45;
export const MOLE_POINTS = 1;
export const GOLD_POINTS = 3;
export const BOMB_POINTS = -2;
/** A bomb leaves the mallet dizzy this long. */
export const STUN_SECONDS = 0.8;

const COUNTDOWN = 1.5;

export type Popper = 'mole' | 'gold' | 'bomb';

/** One pop: something comes up in a hole at `at` seconds and goes down `for` seconds later. */
export interface Pop {
  readonly at: number;
  readonly hole: number;
  readonly kind: Popper;
  readonly for: number;
}

export type WhackPhase = 'countdown' | 'round' | 'over';

export interface WhackState {
  /** Every pop of the round, in time order, dealt from the seed; the same for both boards. */
  readonly pops: readonly Pop[];
  readonly phase: WhackPhase;
  /** Seconds into the round (or left of the countdown). */
  readonly clock: number;
  readonly scores: readonly [number, number];
  /** Which pops each player has already whacked, by index. */
  readonly whacked: readonly [readonly number[], readonly number[]];
  /** Seconds each mallet is still dizzy for. */
  readonly stun: readonly [number, number];
  readonly result: GameResult | null;
}

/** A hole to whack this step, or null. */
export interface WhackInput {
  readonly hole: number | null;
}

export interface WhackEvents {
  hits: { seat: Seat; hole: number; kind: Popper }[];
  misses: { seat: Seat; hole: number }[];
}

/**
 * The round's moles: they come every 0.9 seconds at first and every 0.4 by the end, and stay up for
 * 1.2 seconds at first and 0.65 by the end. About one in seven is a bomb and one in fourteen golden.
 */
export function dealPops(seed: number): Pop[] {
  const rng = createRng(seed);
  const pops: Pop[] = [];
  let t = 0.6;
  while (t < ROUND_SECONDS - 0.5) {
    const late = t / ROUND_SECONDS;
    const roll = rng.next();
    const kind: Popper = roll < 0.14 ? 'bomb' : roll < 0.21 ? 'gold' : 'mole';
    const stay = (1.2 - 0.55 * late) * (kind === 'gold' ? 0.75 : 1);
    // A new pop never lands on a hole that is still busy.
    const busy = new Set(pops.filter((p) => p.at + p.for > t).map((p) => p.hole));
    const free = Array.from({ length: WHACK_HOLES }, (_, i) => i).filter((i) => !busy.has(i));
    if (free.length > 0) pops.push({ at: t, hole: rng.pick(free), kind, for: stay });
    t += (0.9 - 0.5 * late) * (0.75 + rng.next() * 0.5);
  }
  return pops;
}

export function newWhack(seed: number): WhackState {
  return { pops: dealPops(seed), phase: 'countdown', clock: COUNTDOWN, scores: [0, 0], whacked: [[], []], stun: [0, 0], result: null };
}

/** The pop showing in `hole` on `seat`'s board, if any: up now, and not already whacked there. */
export function showing(state: WhackState, seat: Seat, hole: number): number | null {
  if (state.phase !== 'round') return null;
  const t = state.clock;
  const index = state.pops.findIndex((p) => p.hole === hole && p.at <= t && t < p.at + p.for);
  if (index < 0 || state.whacked[seat].includes(index)) return null;
  return index;
}

const POINTS: Record<Popper, number> = { mole: MOLE_POINTS, gold: GOLD_POINTS, bomb: BOMB_POINTS };

/** Advances the round by one fixed step. Pure. */
export function stepWhack(state: WhackState, inputs: readonly [WhackInput, WhackInput], dt = WHACK_STEP): { state: WhackState; events: WhackEvents } {
  const events: WhackEvents = { hits: [], misses: [] };
  if (state.result) return { state, events };
  if (state.phase === 'countdown') {
    const clock = state.clock - dt;
    return { state: clock > 0 ? { ...state, clock } : { ...state, phase: 'round', clock: 0 }, events };
  }
  const scores: [number, number] = [state.scores[0], state.scores[1]];
  const whacked: [number[], number[]] = [[...state.whacked[0]], [...state.whacked[1]]];
  const stun: [number, number] = [Math.max(0, state.stun[0] - dt), Math.max(0, state.stun[1] - dt)];
  for (const seat of [0, 1] as const) {
    const hole = inputs[seat].hole;
    if (hole === null || hole < 0 || hole >= WHACK_HOLES || stun[seat] > 0) continue;
    const index = showing(state, seat, hole);
    if (index === null) {
      events.misses.push({ seat, hole });
      continue;
    }
    const kind = state.pops[index]!.kind;
    whacked[seat].push(index);
    scores[seat] += POINTS[kind];
    if (kind === 'bomb') stun[seat] = STUN_SECONDS;
    events.hits.push({ seat, hole, kind });
  }
  const clock = state.clock + dt;
  if (clock < ROUND_SECONDS) return { state: { ...state, clock, scores, whacked, stun }, events };
  const winners: Seat[] = scores[0] === scores[1] ? [0, 1] : [scores[0] > scores[1] ? 0 : 1];
  return { state: { ...state, clock: ROUND_SECONDS, scores, whacked, stun, phase: 'over', result: { winners, draw: winners.length === 2 } }, events };
}

export interface WhackTier {
  /** How long a pop has to be up before the bot sees it. */
  readonly reactionMs: number;
  /** Chance it swings at a bomb it sees, by mistake. */
  readonly bombSlip: number;
  /** Chance it lets a mole go by, looking elsewhere. */
  readonly miss: number;
}

export const WHACK_TIERS: Record<BotTier, WhackTier> = {
  easy: { reactionMs: 520, bombSlip: 0.25, miss: 0.35 },
  medium: { reactionMs: 400, bombSlip: 0.12, miss: 0.2 },
  hard: { reactionMs: 300, bombSlip: 0.05, miss: 0.1 },
  expert: { reactionMs: 220, bombSlip: 0.01, miss: 0.04 },
};

/**
 * Bot whacks: the first thing that has been up long enough to see, skipping bombs (mostly). `roll`
 * is a number in [0, 1) for this pop, from the scene, so each pop is decided once.
 */
export function whackBotInput(state: WhackState, seat: Seat, tier: WhackTier, roll: (pop: number) => number): WhackInput {
  if (state.phase !== 'round' || state.stun[seat] > 0) return { hole: null };
  for (let hole = 0; hole < WHACK_HOLES; hole++) {
    const index = showing(state, seat, hole);
    if (index === null) continue;
    const pop = state.pops[index]!;
    if (state.clock - pop.at < tier.reactionMs / 1000) continue;
    const r = roll(index);
    if (pop.kind === 'bomb' ? r >= tier.bombSlip : r < tier.miss) continue;
    return { hole };
  }
  return { hole: null };
}

export const whackAMole: RealtimeGameDefinition = {
  id: 'whack-a-mole',
  name: 'Whack-a-Mole',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive'],
  realtime: true,
};
