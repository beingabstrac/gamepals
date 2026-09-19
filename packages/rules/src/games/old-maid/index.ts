import { createRng, type Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';
import { rankOf, shuffledDeck, suitOf } from '../cards';

/**
 * Old Maid (docs/games/old-maid.md). One queen is taken out, so the third one has no partner.
 * Take a card from the hand on your left; pairs go down; whoever is left holding the odd queen
 * loses. 2 to 4 players. Moves: `t<index>` takes the card at that place in the offered fan.
 */
export type MaidMove = string;
export const takeMove = (index: number): MaidMove => `t${index}`;
/** Queens are rank 12, and the one that is left over is the old maid. */
export const MAID_QUEEN = 12;

export interface MaidEvent {
  readonly from: Seat;
  readonly to: Seat;
  readonly card: number;
  /** The rank paired off by that card, if any. */
  readonly paired?: number;
  /** Seats that ran out of cards and are safe. */
  readonly out: readonly Seat[];
}

/** Throws away every pair in a hand, keeping the odd one out of a triplet. */
function pairOff(hand: number[]): number[] {
  const paired: number[] = [];
  for (let rank = 1; rank <= 13; rank++) {
    const of = hand.filter((card) => rankOf(card) === rank);
    const pairs = Math.floor(of.length / 2);
    for (let i = 0; i < pairs * 2; i++) {
      hand.splice(hand.indexOf(of[i]!), 1);
      paired.push(of[i]!);
    }
  }
  return paired;
}

export class MaidState implements GameState<MaidMove> {
  private cached?: MaidMove[];

  constructor(
    /** Every seat's cards. A seat may only ever be shown its own. */
    readonly hands: readonly (readonly number[])[],
    /** How many pairs each seat has thrown away. */
    readonly pairs: readonly number[],
    readonly currentSeat: Seat,
    readonly moves: number,
    readonly result: GameResult | null,
    readonly last: MaidEvent | null,
  ) {}

  get counts(): readonly number[] {
    return this.hands.map((hand) => hand.length);
  }

  /** Whose hand is being offered to the player whose turn it is: the one on their left. */
  get offering(): Seat {
    const seats = this.hands.length;
    for (let step = 1; step <= seats; step++) {
      const seat = ((this.currentSeat + step) % seats) as Seat;
      if (this.hands[seat]!.length) return seat;
    }
    return this.currentSeat;
  }

  /** A seat with nothing left is out, and safe. */
  out(seat: Seat): boolean {
    return this.hands[seat]!.length === 0;
  }

  legalMoves(seat: Seat): readonly MaidMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    this.cached ??= this.build();
    return this.cached;
  }

  private build(): MaidMove[] {
    const from = this.offering;
    if (from === this.currentSeat) return [];
    return this.hands[from]!.map((_, index) => takeMove(index));
  }

  /** The next seat still holding cards, so an empty hand is skipped rather than stuck. */
  private nextPlayer(hands: readonly (readonly number[])[], from: Seat): Seat {
    const seats = hands.length;
    for (let step = 1; step <= seats; step++) {
      const seat = ((from + step) % seats) as Seat;
      if (hands[seat]!.length) return seat;
    }
    return from;
  }

  apply(play: MaidMove): MaidState {
    if (this.result) throw new Error('Game is over');
    if (!this.legalMoves(this.currentSeat).includes(play)) throw new Error(`Illegal move: ${play}`);
    const seat = this.currentSeat;
    const from = this.offering;
    const hands = this.hands.map((hand) => [...hand]);
    const pairs = [...this.pairs];
    const index = Number(play.slice(1));
    const card = hands[from]![index]!;
    hands[from]!.splice(index, 1);
    hands[seat]!.push(card);
    // A card that meets its partner takes both of them off the table.
    const partner = hands[seat]!.find((held) => held !== card && rankOf(held) === rankOf(card));
    let paired: number | undefined;
    if (partner !== undefined) {
      hands[seat] = hands[seat]!.filter((held) => held !== card && held !== partner);
      pairs[seat]!++;
      paired = rankOf(card);
    }
    const out = hands.flatMap((hand, i) => (hand.length === 0 && this.hands[i]!.length > 0 ? [i as Seat] : []));
    // One card left in the game, and it can only be the odd queen.
    const left = hands.reduce((sum, hand) => sum + hand.length, 0);
    const loser = hands.findIndex((hand) => hand.length);
    const result: GameResult | null =
      left <= 1 ? { winners: hands.flatMap((_, i) => (i === loser ? [] : [i as Seat])), draw: false } : null;
    return new MaidState(hands, pairs, this.nextPlayer(hands, seat), this.moves + 1, result, { from, to: seat, card, paired, out });
  }
}

/** The deal: one queen out, 51 cards round the table, and the pairs thrown away at once. */
export function newMaid(seed: number, players = 2): MaidState {
  const rng = createRng(seed >>> 0);
  // Taking out the club queen leaves three, and the third one has nobody to pair with.
  const deck = shuffledDeck(rng).filter((card) => !(rankOf(card) === MAID_QUEEN && suitOf(card) === 3));
  const hands: number[][] = Array.from({ length: players }, () => []);
  deck.forEach((card, i) => hands[i % players]!.push(card));
  const pairs = hands.map((hand) => pairOff(hand).length / 2);
  return new MaidState(hands, pairs, 0, 0, null, null);
}

/** What a seat may know: its own cards, how big the offered fan is, and who is out. */
export interface MaidView {
  readonly hand: readonly number[];
  readonly offered: number;
  readonly counts: readonly number[];
  readonly pairs: readonly number[];
  readonly seat: Seat;
}

export const maidViewFor = (state: MaidState, seat: Seat): MaidView => ({
  hand: state.hands[seat]!,
  offered: state.hands[state.offering]!.length,
  counts: state.counts,
  pairs: state.pairs,
  seat,
});

/** Nothing to know and nothing to weigh: every level picks blind, because the fan is face down. */
function createMaidBot(_tier: BotTier): Bot<MaidMove> {
  return {
    chooseMove(generic: GameState<MaidMove>, seat: Seat, rng: Rng): MaidMove {
      const state = generic as MaidState;
      const moves = state.legalMoves(seat);
      if (!moves.length) throw new Error('No legal moves');
      // Handed only the size of the fan, so there is no card it could be aiming for.
      const view = maidViewFor(state, seat);
      return takeMove(rng.int(view.offered));
    },
  };
}

export const oldMaid: GameDefinition<MaidMove> = {
  id: 'old-maid',
  name: 'Old Maid',
  minPlayers: 2,
  maxPlayers: 4,
  modes: ['bot', 'sameDevice', 'onlineLive'],
  hiddenInfo: true,
  realtime: false,
  newGame: (config, seed) => newMaid(seed, config.players),
  createBot: (tier) => createMaidBot(tier),
  encodeMove: (move) => move,
};
