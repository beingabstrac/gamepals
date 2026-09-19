import { createRng, type Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';
import { rankOf, shuffledDeck, suitOf } from '../cards';
import { bestArrangement, deadwoodOf, deadwoodValue, layOff } from '../melds';

/**
 * Gin Rummy (docs/games/gin-rummy.md). Two players, ten cards each, draw one and throw one,
 * and knock when what is left over comes to ten or less.
 * Moves: `t` takes the upcard on the first turn, `n` refuses it, `ds`/`dd` draws from the stock
 * or the discard pile, `x<card>` throws a card away, `k<card>` knocks with it.
 */
export type GinMove = string;
export const ginTake: GinMove = 't';
export const ginPass: GinMove = 'n';
export const ginDrawStock: GinMove = 'ds';
export const ginDrawDiscard: GinMove = 'dd';
export const ginDiscard = (card: number): GinMove => `x${card}`;
export const ginKnock = (card: number): GinMove => `k${card}`;

export const HAND_SIZE = 10;
/** Knock with this much left over or less. */
export const KNOCK_AT = 10;
export const GIN_BONUS = 20;
export const UNDERCUT_BONUS = 10;
export const HAND_BONUS = 20;
export const GAME_BONUS = 100;
export const GIN_TARGET = 100;
/** With two cards left in the stock the hand is dead, and nobody scores. */
export const STOCK_FLOOR = 2;

export type GinTarget = 'hand' | '100';
/** `offer` is the first-turn dance over the upcard; `draw` and `throw` are an ordinary turn. */
export type GinPhase = 'offer' | 'draw' | 'throw';

export interface GinEvent {
  readonly kind: 'take' | 'pass' | 'draw' | 'throw' | 'hand';
  readonly seat?: Seat;
  readonly card?: number;
  readonly fromDiscard?: boolean;
  readonly gin?: boolean;
  readonly undercut?: boolean;
  readonly dead?: boolean;
  /** What each seat scored for the hand that just ended. */
  readonly scored?: readonly number[];
}

/** Both hands as they stood when a hand ended, kept so the screen can lay them out. */
export interface GinShowdown {
  readonly knocker: Seat | null;
  readonly gin: boolean;
  readonly undercut: boolean;
  readonly dead: boolean;
  readonly scored: readonly number[];
  readonly hands: readonly (readonly number[])[];
  /** What the other player was left holding once they had laid off. */
  readonly against: number;
}

export class GinState implements GameState<GinMove> {
  private cached?: GinMove[];

  constructor(
    readonly hands: readonly (readonly number[])[],
    readonly stock: readonly number[],
    readonly discard: readonly number[],
    /** Match scores, and how many hands each seat has won. */
    readonly scores: readonly number[],
    readonly won: readonly number[],
    readonly phase: GinPhase,
    /** Whose deal it is; the other seat is offered the upcard first. */
    readonly dealer: Seat,
    readonly hand: number,
    readonly currentSeat: Seat,
    readonly target: GinTarget,
    /** The hand that just finished, for the screen. Null until one has. */
    readonly showdown: GinShowdown | null,
    readonly moves: number,
    readonly result: GameResult | null,
    readonly last: GinEvent | null,
  ) {}

  get counts(): readonly number[] {
    return this.hands.map((hand) => hand.length);
  }

  /** The top of the discard pile, or -1 when it is empty. */
  get upcard(): number {
    return this.discard.length ? this.discard[this.discard.length - 1]! : -1;
  }

  /** What this seat has left over once its hand is arranged as well as it can be. */
  deadwood(seat: Seat): number {
    return deadwoodOf(this.hands[seat]!);
  }

  legalMoves(seat: Seat): readonly GinMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    if (this.phase === 'offer') return (this.cached ??= [ginTake, ginPass]);
    if (this.phase === 'draw') {
      const moves: GinMove[] = [];
      // The stock is never played out: two cards left ends the hand instead.
      if (this.stock.length > STOCK_FLOOR) moves.push(ginDrawStock);
      if (this.discard.length) moves.push(ginDrawDiscard);
      return (this.cached ??= moves);
    }
    return (this.cached ??= this.throws(seat));
  }

  /** What can be thrown away, and which of those throws can be a knock. */
  private throws(seat: Seat): GinMove[] {
    const hand = this.hands[seat]!;
    const drawn = this.last;
    // A card just taken from the discard pile cannot go straight back.
    const taken = drawn?.kind === 'take' || (drawn?.kind === 'draw' && drawn.fromDiscard) ? drawn.card : undefined;
    const moves: GinMove[] = [];
    for (const card of hand) {
      if (card === taken) continue;
      moves.push(ginDiscard(card));
      if (deadwoodOf(hand.filter((held) => held !== card)) <= KNOCK_AT) moves.push(ginKnock(card));
    }
    return moves;
  }

  apply(move: GinMove): GinState {
    if (this.result) throw new Error('Game is over');
    if (!this.legalMoves(this.currentSeat).includes(move)) throw new Error(`Illegal move: ${move}`);
    if (move === ginTake || move === ginPass) return this.applyOffer(move === ginTake);
    if (move === ginDrawStock || move === ginDrawDiscard) return this.applyDraw(move === ginDrawDiscard);
    return this.applyThrow(Number(move.slice(1)), move[0] === 'k');
  }

  /** The first-turn offer: the seat that did not deal, then the dealer, then the stock. */
  private applyOffer(take: boolean): GinState {
    const seat = this.currentSeat;
    const other = ((seat + 1) % 2) as Seat;
    if (take) {
      const card = this.upcard;
      const hands = this.hands.map((hand, i) => (i === seat ? [...hand, card] : hand));
      return this.with({ hands, discard: this.discard.slice(0, -1), phase: 'throw', last: { kind: 'take', seat, card } });
    }
    if (seat !== this.dealer) return this.with({ currentSeat: other, last: { kind: 'pass', seat } });
    // Both said no, so the seat that was offered it first draws from the stock there and then.
    const card = this.stock[this.stock.length - 1]!;
    const hands = this.hands.map((hand, i) => (i === other ? [...hand, card] : hand));
    return this.with({
      hands,
      stock: this.stock.slice(0, -1),
      currentSeat: other,
      phase: 'throw',
      last: { kind: 'draw', seat: other, card, fromDiscard: false },
    });
  }

  private applyDraw(fromDiscard: boolean): GinState {
    const seat = this.currentSeat;
    const card = fromDiscard ? this.upcard : this.stock[this.stock.length - 1]!;
    const hands = this.hands.map((hand, i) => (i === seat ? [...hand, card] : hand));
    return this.with({
      hands,
      stock: fromDiscard ? this.stock : this.stock.slice(0, -1),
      discard: fromDiscard ? this.discard.slice(0, -1) : this.discard,
      phase: 'throw',
      last: { kind: 'draw', seat, card, fromDiscard },
    });
  }

  private applyThrow(card: number, knocking: boolean): GinState {
    const seat = this.currentSeat;
    const hands = this.hands.map((hand, i) => (i === seat ? hand.filter((held) => held !== card) : hand));
    const discard = [...this.discard, card];
    if (knocking) return this.endHand(hands, discard, seat, card);
    // Two cards left in the stock and nobody knocked: the hand is dead.
    if (this.stock.length <= STOCK_FLOOR) return this.deadHand(hands, card, seat);
    return this.with({ hands, discard, phase: 'draw', currentSeat: ((seat + 1) % 2) as Seat, last: { kind: 'throw', seat, card } });
  }

  private deadHand(hands: readonly (readonly number[])[], card: number, seat: Seat): GinState {
    const showdown: GinShowdown = {
      knocker: null, gin: false, undercut: false, dead: true, scored: [0, 0], against: 0,
      hands: hands.map((hand) => [...hand]),
    };
    const event: GinEvent = { kind: 'hand', seat, card, dead: true, scored: [0, 0] };
    // Nobody scored, so one hand on its own is a draw and a match simply deals again.
    if (this.target === 'hand') return this.finish(this.scores, this.won, showdown, event, { winners: [0, 1], draw: true });
    return this.deal(this.scores, this.won, showdown, event);
  }

  /** Count the hand up: gin, a plain knock, or an undercut. */
  private endHand(hands: readonly (readonly number[])[], discard: readonly number[], knocker: Seat, card: number): GinState {
    const other = ((knocker + 1) % 2) as Seat;
    const mine = bestArrangement(hands[knocker]!);
    const theirs = bestArrangement(hands[other]!);
    const gin = mine.value === 0;
    // Only a knock that is not gin can be laid off against.
    const left = gin ? theirs.deadwood : layOff(theirs.deadwood, mine.melds);
    const against = left.reduce((sum, held) => sum + deadwoodValue(held), 0);
    const scored = [0, 0];
    let undercut = false;
    if (gin) {
      scored[knocker] = GIN_BONUS + against;
    } else if (against <= mine.value) {
      // Level counts as an undercut: the knocker has to beat them, not match them.
      undercut = true;
      scored[other] = UNDERCUT_BONUS + (mine.value - against);
    } else {
      scored[knocker] = against - mine.value;
    }
    const scores = this.scores.map((score, seat) => score + scored[seat]!);
    const won = this.won.map((count, seat) => count + (scored[seat]! > 0 ? 1 : 0));
    const showdown: GinShowdown = { knocker, gin, undercut, dead: false, scored, against, hands: hands.map((hand) => [...hand]) };
    const event: GinEvent = { kind: 'hand', seat: knocker, card, gin, undercut, scored };
    if (this.target !== 'hand' && !scores.some((score) => score >= GIN_TARGET)) {
      return this.deal(scores, won, showdown, event);
    }
    // The twenty a hand and the hundred for the game only land when somebody has finished.
    const final = [...scores];
    if (this.target !== 'hand') {
      const front = final[0]! >= final[1]! ? 0 : 1;
      final[front] = final[front]! + won[front]! * HAND_BONUS + (final[1 - front] === 0 ? GAME_BONUS * 2 : GAME_BONUS);
      final[1 - front] = final[1 - front]! + won[1 - front]! * HAND_BONUS;
    }
    const best = Math.max(...final);
    const winners = ([0, 1] as Seat[]).filter((seat) => final[seat] === best);
    return this.finish(final, won, showdown, event, { winners, draw: winners.length > 1 }, hands, discard);
  }

  /** The next hand: a fresh deal, with the deal passing to the other seat. */
  private deal(scores: readonly number[], won: readonly number[], showdown: GinShowdown, event: GinEvent): GinState {
    const dealer = ((this.dealer + 1) % 2) as Seat;
    const next = dealHand(this.hand + 1, this.moves);
    return new GinState(next.hands, next.stock, next.discard, scores, won, 'offer', dealer, this.hand + 1,
      ((dealer + 1) % 2) as Seat, this.target, showdown, this.moves + 1, null, event);
  }

  private finish(
    scores: readonly number[],
    won: readonly number[],
    showdown: GinShowdown,
    event: GinEvent,
    result: GameResult,
    hands: readonly (readonly number[])[] = this.hands,
    discard: readonly number[] = this.discard,
  ): GinState {
    return new GinState(hands, this.stock, discard, scores, won, this.phase, this.dealer, this.hand,
      this.currentSeat, this.target, showdown, this.moves + 1, result, event);
  }

  private with(changes: Partial<GinFields>): GinState {
    return new GinState(
      changes.hands ?? this.hands,
      changes.stock ?? this.stock,
      changes.discard ?? this.discard,
      this.scores,
      this.won,
      changes.phase ?? this.phase,
      this.dealer,
      this.hand,
      changes.currentSeat ?? this.currentSeat,
      this.target,
      this.showdown,
      this.moves + 1,
      null,
      changes.last ?? this.last,
    );
  }
}

interface GinFields {
  hands: readonly (readonly number[])[];
  stock: readonly number[];
  discard: readonly number[];
  phase: GinPhase;
  currentSeat: Seat;
  last: GinEvent | null;
}

function dealHand(hand: number, salt: number) {
  const deck = shuffledDeck(createRng(((hand + 1) * 2891336453 + salt) >>> 0));
  const hands = [0, 1].map((seat) => deck.slice(seat * HAND_SIZE, (seat + 1) * HAND_SIZE).sort((a, b) => a - b));
  const rest = deck.slice(2 * HAND_SIZE);
  return { hands, stock: rest.slice(1), discard: [rest[0]!] };
}

export function newGin(seed: number, target: GinTarget = 'hand'): GinState {
  const deal = dealHand(0, seed >>> 0);
  // Seat 1 deals the first hand, so seat 0 is offered the upcard first.
  return new GinState(deal.hands, deal.stock, deal.discard, [0, 0], [0, 0], 'offer', 1, 0, 0, target, null, 0, null, null);
}

/** What a seat may know: its own hand, the discard pile, the size of the stock and the scores. */
export interface GinView {
  readonly hand: readonly number[];
  readonly discard: readonly number[];
  readonly stockLeft: number;
  readonly theirCount: number;
  readonly scores: readonly number[];
  readonly phase: GinPhase;
  readonly seat: Seat;
}

export const ginViewFor = (state: GinState, seat: Seat): GinView => ({
  hand: state.hands[seat]!,
  discard: state.discard,
  stockLeft: state.stock.length,
  theirCount: state.hands[((seat + 1) % 2) as Seat]!.length,
  scores: state.scores,
  phase: state.phase,
  seat,
});

/** How much a card does for a hand: what it takes off the count, and whether it is near a meld. */
export function cardUse(hand: readonly number[], card: number): number {
  const rest = hand.filter((held) => held !== card);
  const drop = deadwoodOf(rest) + deadwoodValue(card) - deadwoodOf([...rest, card]);
  const near = rest.some(
    (held) =>
      (rankOf(held) === rankOf(card) && held !== card) ||
      (suitOf(held) === suitOf(card) && Math.abs(rankOf(held) - rankOf(card)) === 1),
  );
  return drop + (near ? 1 : 0);
}

interface GinStyle {
  /** Takes the upcard when it does something for the hand. */
  readonly reads: boolean;
  /** Throws away the card that costs the most and does the least. */
  readonly counts: boolean;
  /** Waits for gin when the hand is one card away from it. */
  readonly waits: boolean;
}

const TIERS: Record<BotTier, GinStyle> = {
  easy: { reads: false, counts: false, waits: false },
  medium: { reads: false, counts: true, waits: false },
  hard: { reads: true, counts: true, waits: false },
  expert: { reads: true, counts: true, waits: true },
};

const leftAfter = (hand: readonly number[], card: number): number => deadwoodOf(hand.filter((held) => held !== card));

function chooseGin(view: GinView, style: GinStyle, rng: Rng, moves: readonly GinMove[]): GinMove {
  if (moves.length === 1) return moves[0]!;
  const up = view.discard.length ? view.discard[view.discard.length - 1]! : -1;
  if (view.phase === 'offer') {
    if (!style.reads) return rng.pick(moves);
    return cardUse(view.hand, up) > 1 ? ginTake : ginPass;
  }
  if (view.phase === 'draw') {
    if (!style.reads) return rng.pick(moves);
    if (up >= 0 && cardUse(view.hand, up) > 1 && moves.includes(ginDrawDiscard)) return ginDrawDiscard;
    return moves.includes(ginDrawStock) ? ginDrawStock : ginDrawDiscard;
  }
  const knocks = moves.filter((move) => move[0] === 'k').map((move) => Number(move.slice(1)));
  if (knocks.length) {
    const best = knocks.reduce((low, card) => (leftAfter(view.hand, card) < leftAfter(view.hand, low) ? card : low));
    const left = leftAfter(view.hand, best);
    // Gin is worth twenty on its own, so a hand at one or two is worth another turn.
    if (!style.waits || left === 0 || left > 2) return ginKnock(best);
  }
  const throwable = moves.filter((move) => move[0] === 'x').map((move) => Number(move.slice(1)));
  if (!style.counts) return ginDiscard(rng.pick(throwable));
  // Throw the card that costs the most and does the least for the hand.
  const cost = (card: number): number => deadwoodValue(card) - cardUse(view.hand, card) * 3;
  const worst = throwable.reduce((high, card) => (cost(card) > cost(high) ? card : high));
  return ginDiscard(worst);
}

function createGinBot(style: GinStyle): Bot<GinMove> {
  return {
    chooseMove(generic: GameState<GinMove>, seat: Seat, rng: Rng): GinMove {
      const state = generic as GinState;
      const moves = state.legalMoves(seat);
      if (!moves.length) throw new Error('No legal moves');
      return chooseGin(ginViewFor(state, seat), style, rng, moves);
    },
  };
}

const isTarget = (value: string | undefined): value is GinTarget => value === 'hand' || value === '100';

export const ginRummy: GameDefinition<GinMove> = {
  id: 'gin-rummy',
  name: 'Gin Rummy',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive'],
  hiddenInfo: true,
  realtime: false,
  newGame: (config, seed) => newGin(seed, isTarget(config.variant) ? config.variant : 'hand'),
  createBot: (tier) => createGinBot(TIERS[tier]),
  encodeMove: (move) => move,
};
