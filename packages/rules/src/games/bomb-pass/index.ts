import { createRng } from '../../core/rng';
import type { BotTier, GameResult, RealtimeGameDefinition, Seat } from '../../core/types';

/**
 * Bomb Pass (docs/games/bomb-pass.md): hot potato for two on one phone. Whoever has the bomb must
 * hit the button that lights up in their half to throw it back. Nobody knows the fuse. Let it go
 * off on your side three times and you lose. Real time, a pure fixed step like the other duels.
 */
export const BOMB_CANVAS = { width: 600, height: 900 } as const;
export const BOMB_STEP = 1 / 120;
export const BOMB_LIVES = 3;
/** How long a throw is in the air, when neither player can do anything. */
export const BOMB_FLIGHT = 0.45;
/** The button a holder has to hit, and how close a tap must be. */
export const BUTTON_R = 58;

const COUNTDOWN = 1.5;
const PAUSE = 1.1;

export type BombPhase = 'countdown' | 'held' | 'flying' | 'boom' | 'over';

export interface BombState {
  readonly seed: number;
  /** Which bomb this is, for dealing its fuse and buttons. */
  readonly bomb: number;
  readonly phase: BombPhase;
  readonly holder: Seat;
  /** Seconds of fuse left. Hidden from the players, of course. */
  readonly fuse: number;
  readonly timer: number;
  /** How many throws this bomb has had, to place each new button. */
  readonly throws: number;
  /** Where the holder's button is. */
  readonly button: { readonly x: number; readonly y: number };
  readonly lives: readonly [number, number];
  readonly result: GameResult | null;
}

export interface BombInput {
  /** A tap this step, in canvas coordinates, or null. */
  readonly tap: { readonly x: number; readonly y: number } | null;
}

export interface BombEvents {
  thrown: boolean;
  landed: boolean;
  boom: Seat | null;
  miss: boolean;
}

/** The fuse of bomb `n`: from four to eleven seconds, and nobody sees it. */
export function fuseFor(seed: number, n: number): number {
  return 4 + createRng((seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0).next() * 7;
}

/** Where the button lights up for `seat` on throw `k` of bomb `n`: somewhere in their own half. */
export function buttonFor(seed: number, n: number, k: number, seat: Seat): { x: number; y: number } {
  const rng = createRng((seed ^ Math.imul(n + 1, 0x85ebca6b) ^ Math.imul(k + 1, 0xc2b2ae35)) >>> 0);
  const { width: w, height: h } = BOMB_CANVAS;
  const x = BUTTON_R + 20 + rng.next() * (w - 2 * BUTTON_R - 40);
  const inHalf = BUTTON_R + 40 + rng.next() * (h / 2 - 2 * BUTTON_R - 100);
  return { x, y: seat === 0 ? h - inHalf : inHalf };
}

function holding(seed: number, bomb: number, throws: number, holder: Seat, fuse: number, lives: readonly [number, number]): BombState {
  return { seed, bomb, phase: 'held', holder, fuse, timer: 0, throws, button: buttonFor(seed, bomb, throws, holder), lives, result: null };
}

export function newBombPass(seed: number): BombState {
  const first: Seat = createRng(seed).int(2) as Seat;
  return { ...holding(seed, 0, 0, first, fuseFor(seed, 0), [BOMB_LIVES, BOMB_LIVES]), phase: 'countdown', timer: COUNTDOWN };
}

/** Advances the round by one fixed step. Pure. */
export function stepBomb(state: BombState, inputs: readonly [BombInput, BombInput], dt = BOMB_STEP): { state: BombState; events: BombEvents } {
  const events: BombEvents = { thrown: false, landed: false, boom: null, miss: false };
  if (state.result) return { state, events };
  if (state.phase === 'countdown') {
    const timer = state.timer - dt;
    return { state: timer > 0 ? { ...state, timer } : { ...state, phase: 'held', timer: 0 }, events };
  }
  if (state.phase === 'boom') {
    const timer = state.timer - dt;
    if (timer > 0) return { state: { ...state, timer }, events };
    // A new bomb, to whoever lost the last one.
    const bomb = state.bomb + 1;
    return { state: holding(state.seed, bomb, 0, state.holder, fuseFor(state.seed, bomb), state.lives), events };
  }
  // The fuse burns whether it is held or in the air.
  const fuse = state.fuse - dt;
  if (fuse <= 0) {
    // It goes off on whichever side it is on: in the air, that is where it was headed.
    const loser = state.holder;
    const lives: [number, number] = [state.lives[0], state.lives[1]];
    lives[loser]--;
    events.boom = loser;
    if (lives[loser] <= 0) return { state: { ...state, fuse: 0, lives, phase: 'over', result: { winners: [loser === 0 ? 1 : 0], draw: false } }, events };
    return { state: { ...state, fuse: 0, lives, phase: 'boom', timer: PAUSE }, events };
  }
  if (state.phase === 'flying') {
    const timer = state.timer - dt;
    if (timer > 0) return { state: { ...state, fuse, timer }, events };
    events.landed = true;
    return { state: holding(state.seed, state.bomb, state.throws, state.holder, fuse, state.lives), events };
  }
  const tap = inputs[state.holder].tap;
  if (tap) {
    if (Math.hypot(tap.x - state.button.x, tap.y - state.button.y) <= BUTTON_R) {
      events.thrown = true;
      const holder: Seat = state.holder === 0 ? 1 : 0;
      return { state: { ...state, fuse, phase: 'flying', timer: BOMB_FLIGHT, holder, throws: state.throws + 1 }, events };
    }
    events.miss = true;
  }
  return { state: { ...state, fuse }, events };
}

export interface BombTier {
  readonly reactionMs: number;
  /** Chance a tap lands off the button. */
  readonly miss: number;
}

export const BOMB_TIERS: Record<BotTier, BombTier> = {
  easy: { reactionMs: 900, miss: 0.3 },
  medium: { reactionMs: 650, miss: 0.15 },
  hard: { reactionMs: 450, miss: 0.06 },
  expert: { reactionMs: 330, miss: 0.02 },
};

/**
 * Bot hand: once the bomb has been with it for its reaction time, it taps for the button, now and
 * then wide. `roll` is a number in [0, 1) held for the throw, from the scene.
 */
export function bombBotInput(state: BombState, seat: Seat, tier: BombTier, heldFor: number, roll = 0.5): BombInput {
  if (state.phase !== 'held' || state.holder !== seat || heldFor < tier.reactionMs / 1000) return { tap: null };
  const off = roll < tier.miss ? BUTTON_R * 1.6 : 0;
  return { tap: { x: state.button.x + off, y: state.button.y } };
}

export const bombPass: RealtimeGameDefinition = {
  id: 'bomb-pass',
  name: 'Bomb Pass',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive'],
  realtime: true,
};
