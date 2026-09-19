import { createRng, type Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';
import { shuffledDeck, suitOf } from '../cards';
import { ledSuit, trickRank, trickWinner, type Played } from '../tricks';

/**
 * Callbreak (docs/games/callbreak.md). Four players, each for themselves, spades always trump,
 * everybody calls at least one trick, and nobody is allowed to hold a winner back.
 * Moves: `c<n>` calls that many tricks, `p<card>` plays a card.
 */
export type CallbreakMove = string;
export const callbreakCall = (tricks: number): CallbreakMove => `c${tricks}`;
export const callbreakPlay = (card: number): CallbreakMove => `p${card}`;
export const CALLBREAK_TRUMP = 0;
/** Scores are kept in tenths, because a trick over a call is worth a tenth of a point. */
export const TENTH = 10;
export type CallbreakTarget = 'one' | 'five';
const ROUNDS: Record<CallbreakTarget, number> = { one: 1, five: 5 };

export type CallbreakPhase = 'call' | 'play';

export interface CallbreakEvent {
  readonly kind: 'call' | 'play' | 'trick' | 'round';
  readonly seat?: Seat;
  readonly card?: number;
  readonly call?: number;
  readonly took?: Seat;
  /** What each seat scored for the round that just ended, in tenths. */
  readonly scored?: readonly number[];
}

/** Points in tenths written the way people say them: 41 is "4.1", -20 is "-2". */
export function showScore(tenths: number): string {
  const sign = tenths < 0 ? '-' : '';
  const whole = Math.floor(Math.abs(tenths) / TENTH);
  const rest = Math.abs(tenths) % TENTH;
  return rest === 0 ? `${sign}${whole}` : `${sign}${whole}.${rest}`;
}

export class CallbreakState implements GameState<CallbreakMove> {
  private cached?: CallbreakMove[];

  constructor(
    readonly hands: readonly (readonly number[])[],
    /** What each seat said it would take; -1 before it has said. */
    readonly calls: readonly number[],
    /** Tricks each seat has taken this round. */
    readonly won: readonly number[],
    /** Match scores in tenths, one per seat. */
    readonly scores: readonly number[],
    readonly phase: CallbreakPhase,
    readonly trick: readonly Played[],
    readonly tricks: readonly (readonly Played[])[],
    readonly round: number,
    readonly currentSeat: Seat,
    readonly target: CallbreakTarget,
    readonly moves: number,
    readonly result: GameResult | null,
    readonly last: CallbreakEvent | null,
  ) {}

  get counts(): readonly number[] {
    return this.hands.map((hand) => hand.length);
  }

  /** How many rounds this game lasts. */
  get rounds(): number {
    return ROUNDS[this.target];
  }

  /**
   * The cards this seat is allowed to play. Callbreak asks more than following suit: hold a higher
   * card of the suit led and you must play one, and with none of that suit you must trump if a
   * spade of yours beats the spades already there.
   */
  playable(seat: Seat): number[] {
    const hand = this.hands[seat]!;
    const led = ledSuit(this.trick);
    if (led === null) return [...hand];
    const inSuit = hand.filter((card) => suitOf(card) === led);
    if (inSuit.length) {
      const high = Math.max(...this.trick.filter((play) => suitOf(play.card) === led).map((play) => trickRank(play.card)));
      const better = inSuit.filter((card) => trickRank(card) > high);
      // Nothing higher in the suit, so any card of it will do.
      return better.length ? better : inSuit;
    }
    const played = this.trick.filter((play) => suitOf(play.card) === CALLBREAK_TRUMP).map((play) => trickRank(play.card));
    const toBeat = played.length ? Math.max(...played) : 0;
    const winning = hand.filter((card) => suitOf(card) === CALLBREAK_TRUMP && trickRank(card) > toBeat);
    // No trump that beats what is there: the hand is free.
    return winning.length ? winning : [...hand];
  }

  legalMoves(seat: Seat): readonly CallbreakMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    this.cached ??= this.phase === 'call'
      ? Array.from({ length: 13 }, (_, n) => callbreakCall(n + 1))
      : this.playable(seat).map(callbreakPlay);
    return this.cached;
  }

  apply(play: CallbreakMove): CallbreakState {
    if (this.result) throw new Error('Game is over');
    if (!this.legalMoves(this.currentSeat).includes(play)) throw new Error(`Illegal move: ${play}`);
    return play[0] === 'c' ? this.applyCall(Number(play.slice(1))) : this.applyPlay(Number(play.slice(1)));
  }

  private applyCall(call: number): CallbreakState {
    const seat = this.currentSeat;
    const calls = this.calls.map((old, i) => (i === seat ? call : old));
    const next = ((seat + 1) % 4) as Seat;
    const calling = calls.some((n) => n < 0);
    return new CallbreakState(this.hands, calls, this.won, this.scores, calling ? 'call' : 'play', [], [],
      this.round, next, this.target, this.moves + 1, null, { kind: 'call', seat, call });
  }

  private applyPlay(card: number): CallbreakState {
    const seat = this.currentSeat;
    const hands = this.hands.map((hand, i) => (i === seat ? hand.filter((held) => held !== card) : hand));
    const trick = [...this.trick, { seat, card }];

    if (trick.length < 4) {
      return new CallbreakState(hands, this.calls, this.won, this.scores, 'play', trick, this.tricks,
        this.round, ((seat + 1) % 4) as Seat, this.target, this.moves + 1, null, { kind: 'play', seat, card });
    }
    const took = trickWinner(trick, CALLBREAK_TRUMP);
    const won = this.won.map((n, i) => (i === took ? n + 1 : n));
    const tricks = [...this.tricks, trick];
    if (hands.some((hand) => hand.length)) {
      return new CallbreakState(hands, this.calls, won, this.scores, 'play', [], tricks,
        this.round, took, this.target, this.moves + 1, null, { kind: 'trick', took, card, seat });
    }
    return this.endRound(won, tricks, took);
  }

  /** Score the round: the call made, a tenth for each trick over it, the call off for falling short. */
  private endRound(won: readonly number[], tricks: readonly (readonly Played[])[], took: Seat): CallbreakState {
    const scored = ([0, 1, 2, 3] as Seat[]).map((seat) => {
      const call = this.calls[seat]!;
      const taken = won[seat]!;
      return taken >= call ? call * TENTH + (taken - call) : -call * TENTH;
    });
    const scores = this.scores.map((score, seat) => score + scored[seat]!);
    if (this.round + 1 < this.rounds) {
      const next = deal(this.round + 1, this.moves + 1);
      const leads = ((this.round + 1) % 4) as Seat;
      return new CallbreakState(next.hands, [-1, -1, -1, -1], [0, 0, 0, 0], scores, 'call', [], [],
        this.round + 1, leads, this.target, this.moves + 1, null, { kind: 'round', took, scored });
    }
    const best = Math.max(...scores);
    const winners = ([0, 1, 2, 3] as Seat[]).filter((seat) => scores[seat] === best);
    return new CallbreakState(this.hands, this.calls, won, scores, 'play', [], tricks, this.round,
      this.currentSeat, this.target, this.moves + 1, { winners, draw: winners.length > 1 }, { kind: 'round', took, scored });
  }
}

function deal(round: number, salt: number) {
  const deck = shuffledDeck(createRng(((round + 1) * 2654435761 + salt) >>> 0));
  return { hands: [0, 1, 2, 3].map((seat) => deck.slice(seat * 13, (seat + 1) * 13).sort((a, b) => a - b)) };
}

export function newCallbreak(seed: number, target: CallbreakTarget = 'five'): CallbreakState {
  const start = deal(0, seed >>> 0);
  return new CallbreakState(start.hands, [-1, -1, -1, -1], [0, 0, 0, 0], [0, 0, 0, 0], 'call', [], [], 0, 0, target, 0, null, null);
}

/** What a seat may know: its own cards, the calls, the trick, what has gone and the scores. */
export interface CallbreakView {
  readonly hand: readonly number[];
  readonly calls: readonly number[];
  readonly won: readonly number[];
  readonly trick: readonly Played[];
  readonly tricks: readonly (readonly Played[])[];
  readonly scores: readonly number[];
  readonly seat: Seat;
}

export const callbreakViewFor = (state: CallbreakState, seat: Seat): CallbreakView => ({
  hand: state.hands[seat]!,
  calls: state.calls,
  won: state.won,
  trick: state.trick,
  tricks: state.tricks,
  scores: state.scores,
  seat,
});

/**
 * Roughly how many tricks a hand is worth here. Trumps count for more than they do in Spades,
 * because a void suit lets them in whenever their holder likes.
 */
export function countCalls(hand: readonly number[]): number {
  let tricks = 0;
  const trumps = hand.filter((card) => suitOf(card) === CALLBREAK_TRUMP);
  for (const card of trumps) if (trickRank(card) >= 12) tricks++;
  if (trumps.length > 3) tricks += trumps.length - 3;
  for (const card of hand) {
    if (suitOf(card) === CALLBREAK_TRUMP) continue;
    if (trickRank(card) === 14) tricks++;
    else if (trickRank(card) === 13 && hand.filter((held) => suitOf(held) === suitOf(card)).length > 1) tricks += 0.5;
  }
  return Math.max(1, Math.min(13, Math.round(tricks)));
}

interface CallbreakStyle {
  /** Counts the hand rather than guessing at a call. */
  readonly counts: boolean;
  /** Takes a trick with the cheapest card that takes it. */
  readonly cheap: boolean;
  /** Stops spending winners once its call is safe. */
  readonly ducks: boolean;
}

const TIERS: Record<BotTier, CallbreakStyle> = {
  easy: { counts: false, cheap: false, ducks: false },
  medium: { counts: true, cheap: false, ducks: false },
  hard: { counts: true, cheap: true, ducks: false },
  expert: { counts: true, cheap: true, ducks: true },
};

function chooseCall(view: CallbreakView, style: CallbreakStyle, rng: Rng, moves: readonly CallbreakMove[]): CallbreakMove {
  if (!style.counts) return rng.pick(moves.slice(0, 4));
  const wanted = callbreakCall(countCalls(view.hand));
  return moves.includes(wanted) ? wanted : rng.pick(moves);
}

function choosePlay(view: CallbreakView, style: CallbreakStyle, rng: Rng, moves: readonly CallbreakMove[]): CallbreakMove {
  if (moves.length === 1) return moves[0]!;
  const cards = moves.map((move) => Number(move.slice(1)));
  const need = view.calls[view.seat]! - view.won[view.seat]!;
  const lowest = (pool: readonly number[]): CallbreakMove => {
    const low = Math.min(...pool.map(trickRank));
    return callbreakPlay(rng.pick(pool.filter((card) => trickRank(card) === low)));
  };

  if (ledSuit(view.trick) === null) {
    // Leading. Trumps are worth more held back, so lead the best card outside them.
    if (style.ducks && need <= 0) return lowest(cards);
    const off = cards.filter((card) => suitOf(card) !== CALLBREAK_TRUMP);
    const pool = off.length ? off : cards;
    const high = Math.max(...pool.map(trickRank));
    return callbreakPlay(rng.pick(pool.filter((card) => trickRank(card) === high)));
  }
  const beating = (card: number): boolean => trickWinner([...view.trick, { seat: view.seat, card }], CALLBREAK_TRUMP) === view.seat;
  const winners = cards.filter(beating);
  if (style.ducks && need <= 0) {
    const safe = cards.filter((card) => !beating(card));
    return lowest(safe.length ? safe : cards);
  }
  if (winners.length && style.cheap) {
    // Win it with the least that will do, counting a trump as dearer than any plain card.
    const cost = (card: number): number => trickRank(card) + (suitOf(card) === CALLBREAK_TRUMP ? 20 : 0);
    const cheapest = Math.min(...winners.map(cost));
    return callbreakPlay(rng.pick(winners.filter((card) => cost(card) === cheapest)));
  }
  if (winners.length) return callbreakPlay(rng.pick(winners));
  return lowest(cards);
}

function createCallbreakBot(style: CallbreakStyle): Bot<CallbreakMove> {
  return {
    chooseMove(generic: GameState<CallbreakMove>, seat: Seat, rng: Rng): CallbreakMove {
      const state = generic as CallbreakState;
      const moves = state.legalMoves(seat);
      if (!moves.length) throw new Error('No legal moves');
      const view = callbreakViewFor(state, seat);
      return state.phase === 'call' ? chooseCall(view, style, rng, moves) : choosePlay(view, style, rng, moves);
    },
  };
}

const isTarget = (value: string | undefined): value is CallbreakTarget => value === 'one' || value === 'five';

export const callbreak: GameDefinition<CallbreakMove> = {
  id: 'callbreak',
  name: 'Callbreak',
  minPlayers: 4,
  maxPlayers: 4,
  modes: ['bot', 'sameDevice', 'onlineLive'],
  hiddenInfo: true,
  realtime: false,
  newGame: (config, seed) => newCallbreak(seed, isTarget(config.variant) ? config.variant : 'five'),
  createBot: (tier) => createCallbreakBot(TIERS[tier]),
  encodeMove: (move) => move,
};
