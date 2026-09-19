import { createRng, type Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';
import { shuffledDeck, suitOf } from '../cards';
import { follows, ledSuit, trickRank, trickWinner, type Played } from '../tricks';

/**
 * Spades (docs/games/spades.md). Four players in two partnerships, spades always trump, and
 * everybody says how many tricks they will take before a card is played.
 * Moves: `b<n>` bids that many (0 is nil), `p<card>` plays a card.
 */
export type SpadesMove = string;
export const spadesBid = (tricks: number): SpadesMove => `b${tricks}`;
export const spadesPlay = (card: number): SpadesMove => `p${card}`;
export const SPADES_SUIT = 0;
export const NIL_SCORE = 100;
/** Ten bags cost a partnership a hundred. */
export const BAG_LIMIT = 10;
export const BAG_PENALTY = 100;
export type SpadesTarget = 'hand' | '200' | '500';
const TARGETS: Record<SpadesTarget, number> = { hand: 0, '200': 200, '500': 500 };
/** Partners sit across: seats 0 and 2 against seats 1 and 3. */
export const teamOf = (seat: Seat): 0 | 1 => ((seat % 2) as 0 | 1);

export type SpadesPhase = 'bid' | 'play';

export interface SpadesEvent {
  readonly kind: 'bid' | 'play' | 'trick' | 'hand';
  readonly seat?: Seat;
  readonly card?: number;
  readonly bid?: number;
  readonly took?: Seat;
  /** What each partnership scored for the hand that just ended. */
  readonly scored?: readonly number[];
  readonly broke?: boolean;
}

export class SpadesState implements GameState<SpadesMove> {
  private cached?: SpadesMove[];

  constructor(
    readonly hands: readonly (readonly number[])[],
    /** What each seat said they would take; -1 before they have said. */
    readonly bids: readonly number[],
    /** Tricks each seat has taken this hand. */
    readonly won: readonly number[],
    /** Match scores and bags, one per partnership. */
    readonly scores: readonly number[],
    readonly bags: readonly number[],
    readonly phase: SpadesPhase,
    readonly trick: readonly Played[],
    readonly tricks: readonly (readonly Played[])[],
    readonly broken: boolean,
    readonly hand: number,
    readonly currentSeat: Seat,
    readonly target: SpadesTarget,
    readonly moves: number,
    readonly result: GameResult | null,
    readonly last: SpadesEvent | null,
  ) {}

  get counts(): readonly number[] {
    return this.hands.map((hand) => hand.length);
  }

  /** What each partnership said it would take, its two bids added together. */
  get contracts(): readonly number[] {
    return [0, 1].map((team) => this.bids.filter((_, seat) => teamOf(seat as Seat) === team).reduce((sum, bid) => sum + Math.max(0, bid), 0));
  }

  /** Tricks each partnership has taken so far this hand. */
  get teamWon(): readonly number[] {
    return [0, 1].map((team) => this.won.filter((_, seat) => teamOf(seat as Seat) === team).reduce((sum, n) => sum + n, 0));
  }

  playable(seat: Seat): number[] {
    const hand = this.hands[seat]!;
    const allowed = hand.filter((card) => follows(hand, this.trick, card));
    if (this.trick.length || this.broken) return allowed;
    // Spades cannot be led until one has trumped a trick, unless that is all there is.
    const others = allowed.filter((card) => suitOf(card) !== SPADES_SUIT);
    return others.length ? others : allowed;
  }

  legalMoves(seat: Seat): readonly SpadesMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    this.cached ??= this.phase === 'bid'
      ? Array.from({ length: 14 }, (_, n) => spadesBid(n))
      : this.playable(seat).map(spadesPlay);
    return this.cached;
  }

  apply(play: SpadesMove): SpadesState {
    if (this.result) throw new Error('Game is over');
    if (!this.legalMoves(this.currentSeat).includes(play)) throw new Error(`Illegal move: ${play}`);
    return play[0] === 'b' ? this.applyBid(Number(play.slice(1))) : this.applyPlay(Number(play.slice(1)));
  }

  private applyBid(bid: number): SpadesState {
    const seat = this.currentSeat;
    const bids = this.bids.map((old, i) => (i === seat ? bid : old));
    const next = ((seat + 1) % 4) as Seat;
    const bidding = bids.some((n) => n < 0);
    return new SpadesState(this.hands, bids, this.won, this.scores, this.bags, bidding ? 'bid' : 'play', [], [], false,
      this.hand, next, this.target, this.moves + 1, null, { kind: 'bid', seat, bid });
  }

  private applyPlay(card: number): SpadesState {
    const seat = this.currentSeat;
    const hands = this.hands.map((hand, i) => (i === seat ? hand.filter((held) => held !== card) : hand));
    const trick = [...this.trick, { seat, card }];
    // A spade played on somebody else's suit is what breaks them.
    const broke = !this.broken && suitOf(card) === SPADES_SUIT && ledSuit(this.trick) !== SPADES_SUIT && this.trick.length > 0;
    const broken = this.broken || broke;

    if (trick.length < 4) {
      return new SpadesState(hands, this.bids, this.won, this.scores, this.bags, 'play', trick, this.tricks, broken,
        this.hand, ((seat + 1) % 4) as Seat, this.target, this.moves + 1, null, { kind: 'play', seat, card, broke });
    }
    const took = trickWinner(trick, SPADES_SUIT);
    const won = this.won.map((n, i) => (i === took ? n + 1 : n));
    const tricks = [...this.tricks, trick];
    if (hands.some((hand) => hand.length)) {
      return new SpadesState(hands, this.bids, won, this.scores, this.bags, 'play', [], tricks, broken,
        this.hand, took, this.target, this.moves + 1, null, { kind: 'trick', took, card, seat });
    }
    return this.endHand(won, tricks, took);
  }

  /** Score the hand: ten a trick bid, a bag for each one over, and nil paid either way. */
  private endHand(won: readonly number[], tricks: readonly (readonly Played[])[], took: Seat): SpadesState {
    const scored = [0, 0];
    const bags = [...this.bags];
    for (const team of [0, 1] as const) {
      const seats = ([0, 1, 2, 3] as Seat[]).filter((seat) => teamOf(seat) === team);
      let points = 0;
      // Nil is settled on its own, before the partnership's contract.
      for (const seat of seats) {
        if (this.bids[seat] !== 0) continue;
        points += won[seat] === 0 ? NIL_SCORE : -NIL_SCORE;
      }
      const contract = seats.reduce((sum, seat) => sum + Math.max(0, this.bids[seat]!), 0);
      const taken = seats.reduce((sum, seat) => sum + won[seat]!, 0);
      // A nil bidder's tricks still count towards what the partnership took.
      if (contract > 0) {
        if (taken >= contract) {
          points += contract * 10 + (taken - contract);
          bags[team] = bags[team]! + (taken - contract);
        } else points -= contract * 10;
      }
      // Ten bags is a hundred off, and the count starts again.
      while (bags[team]! >= BAG_LIMIT) {
        points -= BAG_PENALTY;
        bags[team] = bags[team]! - BAG_LIMIT;
      }
      scored[team] = points;
    }
    const scores = this.scores.map((score, team) => score + scored[team]!);
    const limit = TARGETS[this.target];
    const over = limit === 0 || scores.some((score) => score >= limit);
    if (!over) {
      const next = deal(this.hand + 1, this.moves + 1);
      return new SpadesState(next.hands, [-1, -1, -1, -1], [0, 0, 0, 0], scores, bags, 'bid', [], [], false,
        this.hand + 1, 0, this.target, this.moves + 1, null, { kind: 'hand', took, scored });
    }
    const best = Math.max(...scores);
    const winners = ([0, 1, 2, 3] as Seat[]).filter((seat) => scores[teamOf(seat)] === best);
    return new SpadesState(this.hands, this.bids, won, scores, bags, 'play', [], tricks, this.broken, this.hand,
      this.currentSeat, this.target, this.moves + 1, { winners, draw: scores[0] === scores[1] }, { kind: 'hand', took, scored });
  }
}

function deal(hand: number, salt: number) {
  const deck = shuffledDeck(createRng(((hand + 1) * 2246822519 + salt) >>> 0));
  return { hands: [0, 1, 2, 3].map((seat) => deck.slice(seat * 13, (seat + 1) * 13).sort((a, b) => a - b)) };
}

export function newSpades(seed: number, target: SpadesTarget = 'hand'): SpadesState {
  const start = deal(0, seed >>> 0);
  return new SpadesState(start.hands, [-1, -1, -1, -1], [0, 0, 0, 0], [0, 0], [0, 0], 'bid', [], [], false, 0, 0, target, 0, null, null);
}

/** What a seat may know: its own cards, the bids, the trick, the scores and the bags. */
export interface SpadesView {
  readonly hand: readonly number[];
  readonly bids: readonly number[];
  readonly won: readonly number[];
  readonly trick: readonly Played[];
  readonly tricks: readonly (readonly Played[])[];
  readonly scores: readonly number[];
  readonly bags: readonly number[];
  readonly broken: boolean;
  readonly seat: Seat;
}

export const spadesViewFor = (state: SpadesState, seat: Seat): SpadesView => ({
  hand: state.hands[seat]!,
  bids: state.bids,
  won: state.won,
  trick: state.trick,
  tricks: state.tricks,
  scores: state.scores,
  bags: state.bags,
  broken: state.broken,
  seat,
});

/** Roughly how many tricks a hand is worth: high spades, aces and kings, and short suits. */
export function countWinners(hand: readonly number[]): number {
  let tricks = 0;
  const spades = hand.filter((card) => suitOf(card) === SPADES_SUIT);
  for (const card of spades) if (trickRank(card) >= 12) tricks++;
  // Length in trumps wins tricks by itself once the high ones are gone.
  if (spades.length > 4) tricks += spades.length - 4;
  for (const card of hand) {
    if (suitOf(card) === SPADES_SUIT) continue;
    if (trickRank(card) === 14) tricks++;
    else if (trickRank(card) === 13 && hand.filter((c) => suitOf(c) === suitOf(card)).length > 1) tricks += 0.5;
  }
  return Math.round(tricks);
}

interface SpadesStyle {
  /** Counts the hand rather than guessing at a bid. */
  readonly counts: boolean;
  /** Ducks when its partner is already winning the trick. */
  readonly helps: boolean;
  /** Will go nil on a hand that has nothing in it. */
  readonly goesNil: boolean;
}

const TIERS: Record<BotTier, SpadesStyle> = {
  easy: { counts: false, helps: false, goesNil: false },
  medium: { counts: true, helps: false, goesNil: false },
  hard: { counts: true, helps: true, goesNil: false },
  expert: { counts: true, helps: true, goesNil: true },
};

function chooseBid(view: SpadesView, style: SpadesStyle, rng: Rng, moves: readonly SpadesMove[]): SpadesMove {
  if (!style.counts) return rng.pick(moves.slice(1, 6));
  const tricks = countWinners(view.hand);
  // Nothing worth a trick and no high spades: nil is worth more than a bid of one.
  const risky = view.hand.some((card) => suitOf(card) === SPADES_SUIT && trickRank(card) >= 12) || view.hand.some((card) => trickRank(card) === 14);
  if (style.goesNil && tricks === 0 && !risky) return spadesBid(0);
  const wanted = spadesBid(Math.max(1, Math.min(13, tricks)));
  return moves.includes(wanted) ? wanted : rng.pick(moves);
}

function choosePlay(view: SpadesView, style: SpadesStyle, rng: Rng, moves: readonly SpadesMove[]): SpadesMove {
  if (moves.length === 1) return moves[0]!;
  const cards = moves.map((move) => Number(move.slice(1)));
  const led = ledSuit(view.trick);
  const nil = view.bids[view.seat] === 0;
  const beating = (card: number): boolean => trickWinner([...view.trick, { seat: view.seat, card }], SPADES_SUIT) === view.seat;

  if (nil) {
    // Bid nothing, so take nothing: the lowest card that cannot win.
    const safe = cards.filter((card) => !beating(card));
    const pool = safe.length ? safe : cards;
    const low = Math.min(...pool.map(trickRank));
    return spadesPlay(rng.pick(pool.filter((card) => trickRank(card) === low)));
  }
  if (led === null) {
    // Leading: the highest card outside trumps, which is what wins tricks here.
    const off = cards.filter((card) => suitOf(card) !== SPADES_SUIT);
    const pool = off.length ? off : cards;
    const high = Math.max(...pool.map(trickRank));
    return spadesPlay(rng.pick(pool.filter((card) => trickRank(card) === high)));
  }
  const partnerWinning = view.trick.length > 0 && teamOf(trickWinner(view.trick, SPADES_SUIT)) === teamOf(view.seat) && view.trick.length >= 2;
  if (style.helps && partnerWinning) {
    const low = Math.min(...cards.map(trickRank));
    return spadesPlay(rng.pick(cards.filter((card) => trickRank(card) === low)));
  }
  const winners = cards.filter(beating);
  if (winners.length) {
    // Win it with the least that will do.
    const cheap = Math.min(...winners.map((card) => trickRank(card) + (suitOf(card) === SPADES_SUIT ? 20 : 0)));
    return spadesPlay(rng.pick(winners.filter((card) => trickRank(card) + (suitOf(card) === SPADES_SUIT ? 20 : 0) === cheap)));
  }
  const low = Math.min(...cards.map(trickRank));
  return spadesPlay(rng.pick(cards.filter((card) => trickRank(card) === low)));
}

function createSpadesBot(style: SpadesStyle): Bot<SpadesMove> {
  return {
    chooseMove(generic: GameState<SpadesMove>, seat: Seat, rng: Rng): SpadesMove {
      const state = generic as SpadesState;
      const moves = state.legalMoves(seat);
      if (!moves.length) throw new Error('No legal moves');
      const view = spadesViewFor(state, seat);
      return state.phase === 'bid' ? chooseBid(view, style, rng, moves) : choosePlay(view, style, rng, moves);
    },
  };
}

const isTarget = (value: string | undefined): value is SpadesTarget => value === 'hand' || value === '200' || value === '500';

export const spades: GameDefinition<SpadesMove> = {
  id: 'spades',
  name: 'Spades',
  minPlayers: 4,
  maxPlayers: 4,
  modes: ['bot', 'sameDevice', 'onlineLive'],
  hiddenInfo: true,
  realtime: false,
  newGame: (config, seed) => newSpades(seed, isTarget(config.variant) ? config.variant : 'hand'),
  createBot: (tier) => createSpadesBot(TIERS[tier]),
  encodeMove: (move) => move,
};
