import { createRng, type Rng } from '../../core/rng';
import type { BotTier, GameResult, RealtimeGameDefinition, Seat } from '../../core/types';

/**
 * Grab It (docs/games/grab-it.md): a picture is called, pictures flash in the middle, and the first
 * to grab the called one takes the point. Real time, a pure fixed step like the other duels.
 */
export const GRAB_CANVAS = { width: 600, height: 900 } as const;
export const GRAB_STEP = 1 / 120;
export const POINTS_TO_WIN_GRAB = 5;
/** The pictures, shared with Tile Match's drawings: 0 cherry, 1 lemon, 2 leaf, 3 drop, 4 grapes, 5 donut, 6 carrot, 7 star, 8 heart, 9 moon. */
export const GRAB_PICTURES = 10;
/** Pictures that share a colour and so make you twitch: cherry and heart, lemon and star, grapes and moon. */
export const LOOK_ALIKE: Readonly<Record<number, number>> = { 0: 8, 8: 0, 1: 7, 7: 1, 4: 9, 9: 4 };
/** How long the called picture stays for a grab before the call is given up. */
export const TARGET_SECONDS = 2;
/** How long a wrong grab freezes the hand. */
export const FREEZE_SECONDS = 0.9;

const COUNTDOWN = 1.5;
/** The call is shown alone for this long before the first flash. */
const CALL_SECONDS = 1.2;
const PAUSE = 0.9;

export interface Call {
  readonly target: number;
  /** The pictures in the order they flash, the target last, and how long each decoy stays. */
  readonly flashes: readonly number[];
  readonly gaps: readonly number[];
}

export type GrabPhase = 'countdown' | 'call' | 'flashing' | 'pause' | 'over';

export interface GrabState {
  readonly seed: number;
  readonly call: Call;
  /** How many calls have been made, for dealing the next one. */
  readonly calls: number;
  /** Which flash of the call is showing, and how long it has shown. */
  readonly flash: number;
  readonly timer: number;
  readonly phase: GrabPhase;
  readonly scores: readonly [number, number];
  readonly frozen: readonly [number, number];
  /** Who took the last call, or null if it went unclaimed. */
  readonly lastWinner: Seat | null;
  readonly result: GameResult | null;
}

export interface GrabInput {
  readonly grab: boolean;
}

export interface GrabEvents {
  point: Seat | null;
  wrong: Seat[];
  missed: boolean;
  newFlash: boolean;
}

/** Call number `n` of a round: its target and its flashes, from the seed. */
export function dealCall(seed: number, n: number): Call {
  const rng: Rng = createRng((seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0);
  const target = rng.int(GRAB_PICTURES);
  const decoys = 2 + rng.int(5);
  const flashes: number[] = [];
  const gaps: number[] = [];
  for (let i = 0; i < decoys; i++) {
    const alike = LOOK_ALIKE[target];
    let pick = alike !== undefined && rng.next() < 0.4 ? alike : rng.int(GRAB_PICTURES);
    if (pick === target) pick = (pick + 1 + rng.int(GRAB_PICTURES - 1)) % GRAB_PICTURES;
    flashes.push(pick);
    gaps.push(0.6 + rng.next() * 0.6);
  }
  flashes.push(target);
  gaps.push(TARGET_SECONDS);
  return { target, flashes, gaps };
}

export function newGrab(seed: number): GrabState {
  return { seed, call: dealCall(seed, 0), calls: 1, flash: 0, timer: COUNTDOWN, phase: 'countdown', scores: [0, 0], frozen: [0, 0], lastWinner: null, result: null };
}

/** The picture in the middle right now, or null between flashes. */
export const showingPicture = (state: GrabState): number | null => (state.phase === 'flashing' ? state.call.flashes[state.flash]! : null);

/** Whether the picture showing is the one called. */
export const isTargetUp = (state: GrabState): boolean => state.phase === 'flashing' && state.flash === state.call.flashes.length - 1;

function nextCall(state: GrabState, scores: [number, number], frozen: [number, number], winner: Seat | null): GrabState {
  const done = scores.findIndex((s) => s >= POINTS_TO_WIN_GRAB);
  if (done >= 0) return { ...state, scores, frozen, lastWinner: winner, phase: 'over', timer: 0, result: { winners: [done], draw: false } };
  return { ...state, scores, frozen, lastWinner: winner, phase: 'pause', timer: PAUSE };
}

/** Advances the round by one fixed step. Pure. */
export function stepGrab(state: GrabState, inputs: readonly [GrabInput, GrabInput], dt = GRAB_STEP): { state: GrabState; events: GrabEvents } {
  const events: GrabEvents = { point: null, wrong: [], missed: false, newFlash: false };
  if (state.result) return { state, events };
  const frozen: [number, number] = [Math.max(0, state.frozen[0] - dt), Math.max(0, state.frozen[1] - dt)];
  const timer = state.timer - dt;
  if (state.phase === 'countdown' || state.phase === 'pause') {
    if (timer > 0) return { state: { ...state, timer, frozen }, events };
    const fresh = state.phase === 'pause';
    const call = fresh ? dealCall(state.seed, state.calls) : state.call;
    return { state: { ...state, call, calls: fresh ? state.calls + 1 : state.calls, phase: 'call', timer: CALL_SECONDS, flash: 0, frozen }, events };
  }
  if (state.phase === 'call') {
    if (timer > 0) return { state: { ...state, timer, frozen }, events };
    events.newFlash = true;
    return { state: { ...state, phase: 'flashing', flash: 0, timer: state.call.gaps[0]!, frozen }, events };
  }
  // Flashing: grabs first, in seat order within the step, then the clock.
  const scores: [number, number] = [state.scores[0], state.scores[1]];
  const target = isTargetUp(state);
  // Both hands down on the called picture in the same step is a tie nobody could see. Giving it to
  // nobody let two equally quick bots tie every call for ever, so it alternates by call instead.
  const both = target && inputs[0].grab && inputs[1].grab && frozen[0] === 0 && frozen[1] === 0;
  const order: Seat[] = both && state.calls % 2 === 0 ? [1, 0] : [0, 1];
  for (const seat of order) {
    if (!inputs[seat].grab || frozen[seat] > 0) continue;
    if (target) {
      scores[seat]++;
      events.point = seat;
      return { state: nextCall(state, scores, frozen, seat), events };
    }
    scores[seat] = Math.max(0, scores[seat] - 1);
    frozen[seat] = FREEZE_SECONDS;
    events.wrong.push(seat);
  }
  if (timer > 0) return { state: { ...state, timer, scores, frozen }, events };
  if (target) {
    events.missed = true;
    return { state: nextCall(state, scores, frozen, null), events };
  }
  events.newFlash = true;
  const flash = state.flash + 1;
  return { state: { ...state, flash, timer: state.call.gaps[flash]!, scores, frozen }, events };
}

export interface GrabTier {
  /** How long after the called picture shows the bot's hand comes down. */
  readonly reactionMs: number;
  /** Chance it twitches at a look-alike. */
  readonly twitch: number;
}

export const GRAB_TIERS: Record<BotTier, GrabTier> = {
  easy: { reactionMs: 720, twitch: 0.3 },
  medium: { reactionMs: 560, twitch: 0.15 },
  hard: { reactionMs: 430, twitch: 0.06 },
  expert: { reactionMs: 330, twitch: 0.02 },
};

/**
 * Bot hand: grabs the called picture once it has been up for its reaction time, and now and then
 * twitches at a look-alike. `roll` is a number in [0, 1) for this flash, from the scene.
 */
export function grabBotInput(state: GrabState, seat: Seat, tier: GrabTier, roll = 0.5): GrabInput {
  if (state.phase !== 'flashing' || state.frozen[seat] > 0) return { grab: false };
  const shownFor = state.call.gaps[state.flash]! - state.timer;
  if (isTargetUp(state)) return { grab: shownFor >= tier.reactionMs / 1000 };
  const picture = state.call.flashes[state.flash]!;
  const alike = LOOK_ALIKE[state.call.target] === picture;
  return { grab: alike && shownFor >= tier.reactionMs / 1000 && roll < tier.twitch };
}

export const grabIt: RealtimeGameDefinition = {
  id: 'grab-it',
  name: 'Grab It',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive'],
  realtime: true,
};
