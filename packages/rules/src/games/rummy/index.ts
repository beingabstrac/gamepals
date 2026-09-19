import { createRng, type Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';
import { rankOf, shuffledDeck, suitOf } from '../cards';
import { deadwoodValue, fitsMeld, handValue, meldsIn } from '../melds';

/**
 * Rummy (docs/games/rummy.md). Two to four players: draw one, put melds down if you want to,
 * add to melds already on the table if you want to, then throw one away. First one out wins the
 * hand and takes what everybody else is still holding.
 * Moves: `ds`/`dd` draws, `m<a.b.c>` puts a meld down, `l<meld>.<card>` lays a card off,
 * `x<card>` throws a card away.
 */
export type RummyMove = string;
export const rummyDrawStock: RummyMove = 'ds';
export const rummyDrawDiscard: RummyMove = 'dd';
export const rummyMeld = (cards: readonly number[]): RummyMove => `m${[...cards].sort((a, b) => a - b).join('.')}`;
export const rummyLayOff = (meld: number, card: number): RummyMove => `l${meld}.${card}`;
export const rummyDiscard = (card: number): RummyMove => `x${card}`;

export const RUMMY_TARGET = 100;
/** Ten cards each with two players, seven with three or four. */
export const handSizeFor = (players: number): number => (players === 2 ? 10 : 7);

export type RummyTarget = 'hand' | '100';
export type RummyPhase = 'draw' | 'play';

/** A meld on the table, and who put it there. */
export interface TableMeld {
  readonly seat: Seat;
  readonly cards: readonly number[];
}

export interface RummyEvent {
  readonly kind: 'draw' | 'meld' | 'layoff' | 'discard' | 'hand';
  readonly seat?: Seat;
  readonly card?: number;
  readonly fromDiscard?: boolean;
  readonly cards?: readonly number[];
  readonly rummy?: boolean;
  /** What each seat scored for the hand that just ended. */
  readonly scored?: readonly number[];
}

export class RummyState implements GameState<RummyMove> {
  private cached?: RummyMove[];

  constructor(
    readonly hands: readonly (readonly number[])[],
    readonly stock: readonly number[],
    readonly discard: readonly number[],
    readonly table: readonly TableMeld[],
    readonly scores: readonly number[],
    /**
     * Whether each seat already had melds on the table when its turn began. Going rummy means
     * laying a whole hand down in one turn, so what matters is what was there before this turn.
     */
    readonly laidBefore: readonly boolean[],
    /** How many times the discard pile has been turned over to make a new stock. */
    readonly reshuffles: number,
    readonly phase: RummyPhase,
    readonly dealer: Seat,
    readonly hand: number,
    readonly currentSeat: Seat,
    readonly target: RummyTarget,
    readonly moves: number,
    readonly result: GameResult | null,
    readonly last: RummyEvent | null,
  ) {}

  get counts(): readonly number[] {
    return this.hands.map((hand) => hand.length);
  }

  get upcard(): number {
    return this.discard.length ? this.discard[this.discard.length - 1]! : -1;
  }

  /** What a seat is still holding, in points. */
  held(seat: Seat): number {
    return handValue(this.hands[seat]!);
  }

  legalMoves(seat: Seat): readonly RummyMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    if (this.phase === 'draw') {
      const moves: RummyMove[] = [];
      if (this.stock.length || this.canTurnOver()) moves.push(rummyDrawStock);
      if (this.discard.length) moves.push(rummyDrawDiscard);
      return (this.cached ??= moves);
    }
    return (this.cached ??= this.plays(seat));
  }

  private plays(seat: Seat): RummyMove[] {
    const hand = this.hands[seat]!;
    const moves: RummyMove[] = [];
    for (const meld of meldsIn(hand)) moves.push(rummyMeld(meld));
    this.table.forEach((meld, i) => {
      for (const card of hand) if (fitsMeld(meld.cards, card)) moves.push(rummyLayOff(i, card));
    });
    // Throwing a card away ends the turn, and throwing your last one ends the hand.
    for (const card of hand) moves.push(rummyDiscard(card));
    return moves;
  }

  apply(move: RummyMove): RummyState {
    if (this.result) throw new Error('Game is over');
    if (!this.legalMoves(this.currentSeat).includes(move)) throw new Error(`Illegal move: ${move}`);
    if (move === rummyDrawStock || move === rummyDrawDiscard) return this.applyDraw(move === rummyDrawDiscard);
    if (move[0] === 'm') return this.applyMeld(move.slice(1).split('.').map(Number));
    if (move[0] === 'l') {
      const [meld, card] = move.slice(1).split('.').map(Number);
      return this.applyLayOff(meld!, card!);
    }
    return this.applyDiscard(Number(move.slice(1)));
  }

  /** The pile can be turned over into a new stock once, and only if there is a pile to turn. */
  private canTurnOver(): boolean {
    return this.reshuffles < 1 && this.discard.length > 1;
  }

  private applyDraw(fromDiscard: boolean): RummyState {
    const seat = this.currentSeat;
    let stock = this.stock;
    let discard = this.discard;
    let reshuffles = this.reshuffles;
    let card: number;
    if (fromDiscard) {
      card = this.upcard;
      discard = discard.slice(0, -1);
    } else {
      if (!stock.length) {
        // The stock has run out, so the pile is turned over, without shuffling, and used again.
        const top = discard[discard.length - 1]!;
        stock = [...discard.slice(0, -1)].reverse();
        discard = [top];
        reshuffles += 1;
      }
      card = stock[stock.length - 1]!;
      stock = stock.slice(0, -1);
    }
    const hands = this.hands.map((hand, i) => (i === seat ? [...hand, card].sort((a, b) => a - b) : hand));
    // Who laid melds down before this turn is what going rummy is measured against.
    const laidBefore = this.hands.map((_, i) => this.table.some((meld) => meld.seat === i));
    return this.with({ hands, stock, discard, reshuffles, laidBefore, phase: 'play', last: { kind: 'draw', seat, card, fromDiscard } });
  }

  private applyMeld(cards: readonly number[]): RummyState {
    const seat = this.currentSeat;
    const hands = this.hands.map((hand, i) => (i === seat ? hand.filter((card) => !cards.includes(card)) : hand));
    const table = [...this.table, { seat, cards: [...cards] }];
    // A whole hand laid down in one turn, having had nothing on the table, is going rummy.
    if (!hands[seat]!.length) return this.goOut(hands, this.discard, table, seat, !this.laidBefore[seat]);
    return this.with({ hands, table, last: { kind: 'meld', seat, cards } });
  }

  private applyLayOff(index: number, card: number): RummyState {
    const seat = this.currentSeat;
    const hands = this.hands.map((hand, i) => (i === seat ? hand.filter((held) => held !== card) : hand));
    const table = this.table.map((meld, i) => (i === index ? { seat: meld.seat, cards: [...meld.cards, card] } : meld));
    if (!hands[seat]!.length) return this.goOut(hands, this.discard, table, seat, false);
    return this.with({ hands, table, last: { kind: 'layoff', seat, card } });
  }

  private applyDiscard(card: number): RummyState {
    const seat = this.currentSeat;
    const hands = this.hands.map((hand, i) => (i === seat ? hand.filter((held) => held !== card) : hand));
    const discard = [...this.discard, card];
    if (!hands[seat]!.length) return this.goOut(hands, discard, this.table, seat, false);
    const next = ((seat + 1) % this.hands.length) as Seat;
    // The pile is turned over once. When that stock runs out too, the hand is thrown in: the
    // rules say what to do the first time and nothing about the second, and two players who
    // keep taking each other's discards would otherwise sit there forever.
    if (!this.stock.length && this.reshuffles >= 1) return this.deadHand(hands, discard, this.table);
    return this.with({ hands, discard, phase: 'draw', currentSeat: next, last: { kind: 'discard', seat, card } });
  }

  /** Nobody could go out before the cards ran out, so the hand is thrown in. */
  private deadHand(
    hands: readonly (readonly number[])[],
    discard: readonly number[],
    table: readonly TableMeld[],
  ): RummyState {
    const scored = hands.map(() => 0);
    const event: RummyEvent = { kind: 'hand', scored };
    if (this.target !== 'hand') {
      const dealer = ((this.dealer + 1) % hands.length) as Seat;
      const next = deal(hands.length, this.hand + 1, this.moves);
      return new RummyState(next.hands, next.stock, next.discard, [], this.scores, hands.map(() => false), 0, 'draw',
        dealer, this.hand + 1, ((dealer + 1) % hands.length) as Seat, this.target, this.moves + 1, null, event);
    }
    const best = Math.max(...this.scores);
    const winners = hands.map((_, seat) => seat as Seat).filter((seat) => this.scores[seat] === best);
    return new RummyState(hands, this.stock, discard, table, this.scores, this.laidBefore, this.reshuffles, this.phase,
      this.dealer, this.hand, this.currentSeat, this.target, this.moves + 1, { winners, draw: winners.length > 1 }, event);
  }

  /** Somebody is out: they take what everybody else is holding, doubled if they went rummy. */
  private goOut(
    hands: readonly (readonly number[])[],
    discard: readonly number[],
    table: readonly TableMeld[],
    winner: Seat,
    rummy: boolean,
  ): RummyState {
    const caught = hands.reduce((sum, hand) => sum + handValue(hand), 0);
    const scored = hands.map((_, seat) => (seat === winner ? caught * (rummy ? 2 : 1) : 0));
    const scores = this.scores.map((score, seat) => score + scored[seat]!);
    const event: RummyEvent = { kind: 'hand', seat: winner, rummy, scored };
    if (this.target !== 'hand' && !scores.some((score) => score >= RUMMY_TARGET)) {
      const dealer = ((this.dealer + 1) % hands.length) as Seat;
      const next = deal(hands.length, this.hand + 1, this.moves);
      return new RummyState(next.hands, next.stock, next.discard, [], scores, hands.map(() => false), 0, 'draw',
        dealer, this.hand + 1, ((dealer + 1) % hands.length) as Seat, this.target, this.moves + 1, null, event);
    }
    const best = Math.max(...scores);
    const winners = hands.map((_, seat) => seat as Seat).filter((seat) => scores[seat] === best);
    return new RummyState(hands, this.stock, discard, table, scores, this.laidBefore, this.reshuffles, this.phase,
      this.dealer, this.hand, this.currentSeat, this.target, this.moves + 1, { winners, draw: winners.length > 1 }, event);
  }

  private with(changes: Partial<RummyFields>): RummyState {
    return new RummyState(
      changes.hands ?? this.hands,
      changes.stock ?? this.stock,
      changes.discard ?? this.discard,
      changes.table ?? this.table,
      this.scores,
      changes.laidBefore ?? this.laidBefore,
      changes.reshuffles ?? this.reshuffles,
      changes.phase ?? this.phase,
      this.dealer,
      this.hand,
      changes.currentSeat ?? this.currentSeat,
      this.target,
      this.moves + 1,
      null,
      changes.last ?? this.last,
    );
  }
}

interface RummyFields {
  hands: readonly (readonly number[])[];
  stock: readonly number[];
  discard: readonly number[];
  table: readonly TableMeld[];
  laidBefore: readonly boolean[];
  reshuffles: number;
  phase: RummyPhase;
  currentSeat: Seat;
  last: RummyEvent | null;
}

function deal(players: number, hand: number, salt: number) {
  const deck = shuffledDeck(createRng(((hand + 1) * 2246822507 + salt) >>> 0));
  const size = handSizeFor(players);
  const hands = Array.from({ length: players }, (_, seat) => deck.slice(seat * size, (seat + 1) * size).sort((a, b) => a - b));
  const rest = deck.slice(players * size);
  return { hands, stock: rest.slice(1), discard: [rest[0]!] };
}

export function newRummy(seed: number, players = 2, target: RummyTarget = 'hand'): RummyState {
  const start = deal(players, 0, seed >>> 0);
  const dealer = (players - 1) as Seat;
  return new RummyState(start.hands, start.stock, start.discard, [], Array(players).fill(0), Array(players).fill(false),
    0, 'draw', dealer, 0, 0, target, 0, null, null);
}

/** What a seat may know: its own hand, the table, the discard pile, the counts and the scores. */
export interface RummyView {
  readonly hand: readonly number[];
  readonly table: readonly TableMeld[];
  readonly discard: readonly number[];
  readonly stockLeft: number;
  readonly counts: readonly number[];
  readonly scores: readonly number[];
  readonly phase: RummyPhase;
  readonly seat: Seat;
}

export const rummyViewFor = (state: RummyState, seat: Seat): RummyView => ({
  hand: state.hands[seat]!,
  table: state.table,
  discard: state.discard,
  stockLeft: state.stock.length,
  counts: state.counts,
  scores: state.scores,
  phase: state.phase,
  seat,
});

/**
 * How much closer to a meld this card takes a hand: two for finishing one, and one for each
 * card it is already next to, because a pair or two in sequence is a meld waiting for one card.
 */
export function helps(hand: readonly number[], card: number): number {
  const rest = hand.filter((held) => held !== card);
  const melded = (cards: readonly number[]): number => meldsIn(cards).reduce((most, meld) => Math.max(most, meld.length), 0);
  const finishes = melded([...rest, card]) - melded(rest);
  const near = rest.filter(
    (held) =>
      rankOf(held) === rankOf(card) ||
      (suitOf(held) === suitOf(card) && Math.abs(rankOf(held) - rankOf(card)) <= 2),
  ).length;
  return finishes * 2 + Math.min(2, near);
}

interface RummyStyle {
  /** Throws away any of the three worst cards rather than the worst one. */
  readonly sloppy: boolean;
  /** Puts the biggest meld down rather than whichever it happens to see first. */
  readonly big: boolean;
  /** Hunts for cards to add to melds on the table rather than only when it is down to one. */
  readonly offs: boolean;
  /** Takes the upcard when it finishes something. */
  readonly reads: boolean;
}

/**
 * Every tier melds, lays off and throws away something it can spare. Bots that threw at random
 * never once went out in thirty-one hands of a test match, and bots that would not lay off got
 * stuck holding four cards that no meld could take. Neither is a hard opponent; both are a broken
 * game. The tiers differ in how well they choose, not in whether they play the game at all.
 */
const TIERS: Record<BotTier, RummyStyle> = {
  easy: { sloppy: true, big: false, offs: true, reads: false },
  medium: { sloppy: false, big: true, offs: true, reads: false },
  hard: { sloppy: false, big: true, offs: true, reads: true },
  expert: { sloppy: false, big: true, offs: true, reads: true },
};

function chooseRummy(view: RummyView, style: RummyStyle, rng: Rng, moves: readonly RummyMove[]): RummyMove {
  if (moves.length === 1) return moves[0]!;
  if (view.phase === 'draw') {
    const up = view.discard[view.discard.length - 1]!;
    if (style.reads && helps(view.hand, up) > 0 && moves.includes(rummyDrawDiscard)) return rummyDrawDiscard;
    return moves.includes(rummyDrawStock) ? rummyDrawStock : rummyDrawDiscard;
  }
  const melds = moves.filter((move) => move[0] === 'm');
  const layoffs = moves.filter((move) => move[0] === 'l');
  // Going out beats everything, and going out in one turn doubles the score.
  const empties = melds.find((move) => move.slice(1).split('.').length === view.hand.length);
  if (empties) return empties;
  if (view.hand.length === 1 && layoffs.length) return layoffs[0]!;
  if (melds.length) {
    if (!style.big) return rng.pick(melds);
    // The biggest meld first: it gets the most out of the hand.
    return melds.reduce((big, move) => (move.split('.').length > big.split('.').length ? move : big));
  }
  if (style.offs && layoffs.length) return rng.pick(layoffs);
  const throwable = moves.filter((move) => move[0] === 'x').map((move) => Number(move.slice(1)));
  const cost = (card: number): number => deadwoodValue(card) - helps(view.hand, card) * 9;
  const ranked = [...throwable].sort((a, b) => cost(b) - cost(a));
  return rummyDiscard(style.sloppy ? rng.pick(ranked.slice(0, 3)) : ranked[0]!);
}

function createRummyBot(style: RummyStyle): Bot<RummyMove> {
  return {
    chooseMove(generic: GameState<RummyMove>, seat: Seat, rng: Rng): RummyMove {
      const state = generic as RummyState;
      const moves = state.legalMoves(seat);
      if (!moves.length) throw new Error('No legal moves');
      return chooseRummy(rummyViewFor(state, seat), style, rng, moves);
    },
  };
}

const isTarget = (value: string | undefined): value is RummyTarget => value === 'hand' || value === '100';

export const rummy: GameDefinition<RummyMove> = {
  id: 'rummy',
  name: 'Rummy',
  minPlayers: 2,
  maxPlayers: 4,
  modes: ['bot', 'sameDevice', 'onlineLive'],
  hiddenInfo: true,
  realtime: false,
  newGame: (config, seed) => newRummy(seed, config.players, isTarget(config.variant) ? config.variant : 'hand'),
  createBot: (tier) => createRummyBot(TIERS[tier]),
  encodeMove: (move) => move,
};
