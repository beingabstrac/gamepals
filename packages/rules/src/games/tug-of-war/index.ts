import type { Rng } from '../../core/rng';
import type { BotTier, GameResult, RealtimeGameDefinition, Seat } from '../../core/types';

/**
 * The rope's marker sits at -1…1: +1 is seat 0's win line (bottom), -1 is seat 1's (top).
 * Every tap adds pull; drag bleeds speed away, so equal tapping stalls in tension.
 */
export const TUG_IMPULSE = 0.12;
export const TUG_DRAG = 3;
export const TUG_STEP = 1 / 120;
export const TUG_COUNTDOWN = 1.6;

export interface TugState {
  readonly rope: number;
  readonly velocity: number;
  readonly taps: readonly [number, number];
  /** Seconds of "Ready… Pull!" left; taps don't count until it reaches 0. */
  readonly countdown: number;
  readonly result: GameResult | null;
}

export function newTugGame(): TugState {
  return { rope: 0, velocity: 0, taps: [0, 0], countdown: TUG_COUNTDOWN, result: null };
}

export function tugTap(state: TugState, seat: Seat): TugState {
  if (state.result || state.countdown > 0) return state;
  const taps: [number, number] = [state.taps[0], state.taps[1]];
  taps[seat]++;
  return { ...state, taps, velocity: state.velocity + (seat === 0 ? TUG_IMPULSE : -TUG_IMPULSE) };
}

export function stepTug(state: TugState, dt = TUG_STEP): TugState {
  if (state.result) return state;
  if (state.countdown > 0) return { ...state, countdown: Math.max(0, state.countdown - dt) };
  const velocity = state.velocity * Math.exp(-TUG_DRAG * dt);
  const rope = state.rope + velocity * dt;
  if (rope >= 1) return { ...state, rope: 1, velocity: 0, result: { winners: [0], draw: false } };
  if (rope <= -1) return { ...state, rope: -1, velocity: 0, result: { winners: [1], draw: false } };
  return { ...state, rope, velocity };
}

export interface TugTier {
  readonly tapsPerSecond: number;
  /** ± fraction of randomness in the gap between taps. */
  readonly jitter: number;
}

export const TUG_TIERS: Record<BotTier, TugTier> = {
  easy: { tapsPerSecond: 4.5, jitter: 0.35 },
  medium: { tapsPerSecond: 6.5, jitter: 0.25 },
  hard: { tapsPerSecond: 8.5, jitter: 0.18 },
  expert: { tapsPerSecond: 10.5, jitter: 0.12 },
};

/** Seconds until a bot's next tap. */
export function nextBotTapDelay(tier: TugTier, rng: Rng): number {
  return (1 / tier.tapsPerSecond) * (1 + (rng.next() * 2 - 1) * tier.jitter);
}

export const tugOfWar: RealtimeGameDefinition = {
  id: 'tug-of-war',
  name: 'Tug of War',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive'],
  realtime: true,
};
