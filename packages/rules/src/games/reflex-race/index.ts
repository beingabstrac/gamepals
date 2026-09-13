import { createRng, type Rng } from '../../core/rng';
import type { BotTier, GameResult, RealtimeGameDefinition, Seat } from '../../core/types';

/** First to this many points wins (best of 5). */
export const REFLEX_WIN_SCORE = 3;
const READY_MS = 900;
const POINT_MS = 1300;
const MIN_WAIT_MS = 1500;
const MAX_WAIT_MS = 4000;

/** ready: "Round n" · wait: don't tap yet · go: first tap wins · point: showing who got it. */
export type ReflexPhase = 'ready' | 'wait' | 'go' | 'point';

export interface ReflexPoint {
  readonly seat: Seat;
  readonly reason: 'fastest' | 'falseStart';
  /** Milliseconds from "go" to the winning tap. */
  readonly reactionMs: number | null;
}

export interface ReflexState {
  readonly seed: number;
  readonly round: number;
  readonly phase: ReflexPhase;
  /** Milliseconds spent in the current phase. */
  readonly phaseMs: number;
  /** How long this round's "wait" lasts — secret, so nobody can count it. */
  readonly waitMs: number;
  readonly scores: readonly [number, number];
  readonly lastPoint: ReflexPoint | null;
  readonly result: GameResult | null;
}

/** Each round's wait is fixed by the seed, so games replay the same everywhere. */
export function waitForRound(seed: number, round: number): number {
  const rng = createRng((seed ^ Math.imul(round + 1, 0x85ebca6b)) >>> 0);
  return MIN_WAIT_MS + rng.next() * (MAX_WAIT_MS - MIN_WAIT_MS);
}

export function newReflexGame(seed: number): ReflexState {
  return {
    seed: seed >>> 0,
    round: 0,
    phase: 'ready',
    phaseMs: 0,
    waitMs: waitForRound(seed >>> 0, 0),
    scores: [0, 0],
    lastPoint: null,
    result: null,
  };
}

function award(state: ReflexState, point: ReflexPoint): ReflexState {
  const scores: [number, number] = [state.scores[0], state.scores[1]];
  scores[point.seat]++;
  const result: GameResult | null = scores[point.seat] >= REFLEX_WIN_SCORE ? { winners: [point.seat], draw: false } : null;
  return { ...state, scores, phase: 'point', phaseMs: 0, lastPoint: point, result };
}

/** A tap in "wait" is a false start (the other player scores); the first tap in "go" wins the round. */
export function reflexTap(state: ReflexState, seat: Seat): ReflexState {
  if (state.result) return state;
  if (state.phase === 'wait') return award(state, { seat: seat === 0 ? 1 : 0, reason: 'falseStart', reactionMs: null });
  if (state.phase === 'go') return award(state, { seat, reason: 'fastest', reactionMs: Math.round(state.phaseMs) });
  return state;
}

export function stepReflex(state: ReflexState, dtMs: number): ReflexState {
  if (state.result) return state;
  const phaseMs = state.phaseMs + dtMs;
  switch (state.phase) {
    case 'ready':
      return phaseMs >= READY_MS ? { ...state, phase: 'wait', phaseMs: 0 } : { ...state, phaseMs };
    case 'wait':
      // Carry the overshoot into "go" so reaction times stay accurate.
      return phaseMs >= state.waitMs ? { ...state, phase: 'go', phaseMs: phaseMs - state.waitMs } : { ...state, phaseMs };
    case 'go':
      return { ...state, phaseMs };
    case 'point': {
      if (phaseMs < POINT_MS) return { ...state, phaseMs };
      const round = state.round + 1;
      return { ...state, round, phase: 'ready', phaseMs: 0, waitMs: waitForRound(state.seed, round), lastPoint: null };
    }
  }
}

export interface ReflexTier {
  readonly meanMs: number;
  readonly jitterMs: number;
}

/** Typical people react in roughly 200–300 ms; the expert bot is right there with them. */
export const REFLEX_TIERS: Record<BotTier, ReflexTier> = {
  easy: { meanMs: 520, jitterMs: 120 },
  medium: { meanMs: 380, jitterMs: 80 },
  hard: { meanMs: 285, jitterMs: 50 },
  expert: { meanMs: 215, jitterMs: 30 },
};

export function botReactionMs(tier: ReflexTier, rng: Rng): number {
  return tier.meanMs + (rng.next() * 2 - 1) * tier.jitterMs;
}

export const reflexRace: RealtimeGameDefinition = {
  id: 'reflex-race',
  name: 'Reflex Race',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive'],
  realtime: true,
};
