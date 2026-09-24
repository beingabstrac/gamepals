import { createRng } from '../../core/rng';
import type { BotTier, GameResult, RealtimeGameDefinition, Seat } from '../../core/types';
import { rankOf, shuffledDeck } from '../cards';

/**
 * Speed (docs/games/speed.md): the card race for two. Both play at once, no turns. Each has five
 * cards in hand and fifteen to draw; two piles sit in the middle. A card goes on a pile if it is
 * one above or below the top card (a king and an ace are next to each other). Play one and your
 * hand fills up again from your cards. When neither of you can play, a card from each side stack
 * turns over onto the piles. First with no cards left wins. Real time, a pure fixed step.
 */
export const SPEED_HAND = 5;
export const SPEED_STEP = 1 / 120;

const COUNTDOWN = 1.5;
/** How long nobody can play before the side stacks turn over. */
const STALL = 1.2;
/** A card on its way to a pile: it lands, and the next one can go on it, this much later. */
const LAND = 0.12;

export interface SpeedState {
  readonly seed: number;
  readonly phase: 'countdown' | 'play' | 'over';
  readonly timer: number;
  /** Five places in each hand; null where the draw pile has run out. */
  readonly hands: readonly [readonly (number | null)[], readonly (number | null)[]];
  readonly draws: readonly [readonly number[], readonly number[]];
  /** The two piles in the middle, bottom first. */
  readonly piles: readonly [readonly number[], readonly number[]];
  /** The side stacks that turn over when nobody can play. */
  readonly sides: readonly [readonly number[], readonly number[]];
  /** Seconds nobody has been able to play. */
  readonly stuck: number;
  /** Seconds each pile is still busy with a card landing on it. */
  readonly busy: readonly [number, number];
  readonly flips: number;
  readonly steps: number;
  readonly result: GameResult | null;
}

export interface SpeedPlay {
  /** Which of the five places in the hand. */
  readonly slot: number;
  readonly pile: 0 | 1;
}

export interface SpeedInput {
  readonly play: SpeedPlay | null;
}

export interface SpeedEvents {
  played: { seat: Seat; slot: number; pile: 0 | 1; card: number }[];
  /** A play that missed: the pile had changed, or the card did not fit. */
  missed: Seat[];
  flipped: boolean;
  /** The side stacks were empty, so the piles were shuffled back into them. */
  reshuffled: boolean;
}

/** Are these two cards next to each other in rank (king and ace count as next to each other)? */
export function speedNext(a: number, b: number): boolean {
  const d = Math.abs(rankOf(a) - rankOf(b));
  return d === 1 || d === 12;
}

const top = (pile: readonly number[]) => pile[pile.length - 1]!;

/** Every play `seat` could make right now. */
export function playsFor(state: SpeedState, seat: Seat): SpeedPlay[] {
  const out: SpeedPlay[] = [];
  state.hands[seat].forEach((card, slot) => {
    if (card === null) return;
    for (const pile of [0, 1] as const) if (speedNext(card, top(state.piles[pile]))) out.push({ slot, pile });
  });
  return out;
}

export const cardsLeft = (state: SpeedState, seat: Seat) => state.hands[seat].filter((c) => c !== null).length + state.draws[seat].length;

export function newSpeed(seed: number): SpeedState {
  const deck = shuffledDeck(createRng(seed >>> 0));
  const take = (n: number) => deck.splice(0, n);
  const hands: [number[], number[]] = [take(SPEED_HAND), take(SPEED_HAND)];
  const draws: [number[], number[]] = [take(15), take(15)];
  const sides: [number[], number[]] = [take(5), take(5)];
  const piles: [number[], number[]] = [take(1), take(1)];
  return { seed: seed >>> 0, phase: 'countdown', timer: COUNTDOWN, hands, draws, piles, sides, stuck: 0, busy: [0, 0], flips: 0, steps: 0, result: null };
}

/** Advances the race by one fixed step. Pure. */
export function stepSpeed(state: SpeedState, inputs: readonly [SpeedInput, SpeedInput], dt = SPEED_STEP): { state: SpeedState; events: SpeedEvents } {
  const events: SpeedEvents = { played: [], missed: [], flipped: false, reshuffled: false };
  if (state.result) return { state, events };
  if (state.phase === 'countdown') {
    const timer = state.timer - dt;
    return { state: { ...state, timer: Math.max(timer, 0), phase: timer > 0 ? 'countdown' : 'play' }, events };
  }
  const hands = state.hands.map((h) => [...h]) as [(number | null)[], (number | null)[]];
  const draws = state.draws.map((d) => [...d]) as [number[], number[]];
  const piles = state.piles.map((p) => [...p]) as [number[], number[]];
  let sides = state.sides.map((s) => [...s]) as [number[], number[]];
  const busy: [number, number] = [Math.max(state.busy[0] - dt, 0), Math.max(state.busy[1] - dt, 0)];
  // Two hands on the same pile in the same instant: whoever goes first swaps every step.
  const order: Seat[] = state.steps % 2 === 0 ? [0, 1] : [1, 0];
  for (const seat of order) {
    const play = inputs[seat].play;
    if (!play) continue;
    const card = hands[seat][play.slot];
    if (card === undefined || card === null || busy[play.pile] > 0 || !speedNext(card, top(piles[play.pile]))) {
      events.missed.push(seat);
      continue;
    }
    piles[play.pile].push(card);
    busy[play.pile] = LAND;
    hands[seat][play.slot] = draws[seat].length ? draws[seat].shift()! : null;
    events.played.push({ seat, slot: play.slot, pile: play.pile, card });
  }
  const next: SpeedState = { ...state, hands, draws, piles, sides, busy, steps: state.steps + 1 };
  const out = ([0, 1] as const).map((seat) => cardsLeft(next, seat) === 0);
  if (out[0] || out[1]) {
    const result: GameResult = out[0] && out[1] ? { winners: [], draw: true } : { winners: [out[0] ? 0 : 1], draw: false };
    return { state: { ...next, phase: 'over', result }, events };
  }
  // Nobody can play: after a moment, a card from each side stack turns over onto the piles.
  const blocked = events.played.length === 0 && playsFor(next, 0).length === 0 && playsFor(next, 1).length === 0;
  let stuck = blocked ? state.stuck + dt : 0;
  let flips = state.flips;
  if (stuck >= STALL) {
    if (!sides[0].length || !sides[1].length) {
      // Out of side cards: everything under the two top cards is shuffled and split into new stacks.
      const under = [...piles[0].slice(0, -1), ...piles[1].slice(0, -1)];
      piles[0] = [top(piles[0])];
      piles[1] = [top(piles[1])];
      const rng = createRng((state.seed ^ Math.imul(flips + 1, 0x9e3779b1)) >>> 0);
      for (let i = under.length - 1; i > 0; i--) {
        const j = rng.int(i + 1);
        [under[i], under[j]] = [under[j]!, under[i]!];
      }
      const half = Math.ceil(under.length / 2);
      sides = [under.slice(0, half), under.slice(half)];
      events.reshuffled = true;
    }
    for (const s of [0, 1] as const) {
      const card = sides[s].pop();
      if (card !== undefined) piles[s].push(card);
    }
    flips++;
    stuck = 0;
    events.flipped = true;
  }
  return { state: { ...next, piles, sides, stuck, flips }, events };
}

export interface SpeedTier {
  /** Seconds from a play being there to making it. */
  readonly react: number;
  /** Chance, each time something new turns up, that it is slow to see it (twice as long). */
  readonly dozy: number;
}

export const SPEED_TIERS: Record<BotTier, SpeedTier> = {
  easy: { react: 1.5, dozy: 0.4 },
  medium: { react: 1.0, dozy: 0.25 },
  hard: { react: 0.7, dozy: 0.12 },
  expert: { react: 0.45, dozy: 0.05 },
};

/** Something that changes whenever a new play might have turned up for `seat`. */
export function speedView(state: SpeedState, seat: Seat): string {
  return `${top(state.piles[0])}.${top(state.piles[1])}.${state.hands[seat].join(',')}`;
}

/**
 * Bot hand: once a play has been there for its reaction time (the scene counts `waited` since the
 * table last changed for it), it plays one of them. It only ever looks at its own hand and the two
 * piles, never at the other player's cards.
 */
export function speedBotInput(state: SpeedState, seat: Seat, tier: SpeedTier, waited: number, roll: number): SpeedInput {
  if (state.phase !== 'play') return { play: null };
  const plays = playsFor(state, seat).filter((p) => state.busy[p.pile] <= 0);
  if (!plays.length) return { play: null };
  const react = roll < tier.dozy ? tier.react * 2 : tier.react;
  if (waited < react) return { play: null };
  return { play: plays[Math.floor(roll * 1000) % plays.length]! };
}

export const speed: RealtimeGameDefinition = {
  id: 'speed',
  name: 'Speed',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive'],
  realtime: true,
};
