import { createRng, type Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';
import { rankOf, shuffledDeck, suitOf } from '../cards';

/**
 * Crazy Eights (docs/games/crazy-eights.md). Match the top card by suit or rank, or play an
 * eight and name the suit. 2 to 4 players, hands are private.
 * Moves: `p<card>` plays a card, `p<card>.<suit>` plays an eight and names a suit,
 * `d` draws one, `x` passes when the stock is gone and nothing fits.
 */
export type EightsMove = string;
export const EIGHTS_DRAW: EightsMove = 'd';
export const EIGHTS_PASS: EightsMove = 'x';
export const WILD_RANK = 8;
/** What a card left in a hand is worth to the winner: an eight 50, a picture 10, an ace 1. */
export const eightsValue = (card: number): number => {
  const rank = rankOf(card);
  if (rank === WILD_RANK) return 50;
  return rank > 10 ? 10 : rank;
};
export const playMove = (card: number, suit?: number): EightsMove => (suit === undefined ? `p${card}` : `p${card}.${suit}`);

export interface EightsEvent {
  readonly kind: 'play' | 'draw' | 'pass' | 'refill';
  readonly seat: Seat;
  readonly card?: number;
  /** The suit named after an eight. */
  readonly named?: number;
}

export class EightsState implements GameState<EightsMove> {
  private cached?: EightsMove[];

  constructor(
    /** Every seat's cards. A seat may only ever be shown its own. */
    readonly hands: readonly (readonly number[])[],
    readonly stock: readonly number[],
    /** Face up, most recent last. */
    readonly discard: readonly number[],
    /** The suit in force: the top card's own, unless an eight named another. */
    readonly suit: number,
    readonly currentSeat: Seat,
    readonly moves: number,
    readonly result: GameResult | null,
    readonly last: EightsEvent | null,
  ) {}

  get top(): number {
    return this.discard[this.discard.length - 1]!;
  }

  /** How many cards each seat holds. Everybody can see this; it is half the game. */
  get counts(): readonly number[] {
    return this.hands.map((hand) => hand.length);
  }

  /** Can this card go on the pile right now? */
  playable(card: number): boolean {
    return rankOf(card) === WILD_RANK || suitOf(card) === this.suit || rankOf(card) === rankOf(this.top);
  }

  legalMoves(seat: Seat): readonly EightsMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    this.cached ??= this.build();
    return this.cached;
  }

  private build(): EightsMove[] {
    const hand = this.hands[this.currentSeat]!;
    const list: EightsMove[] = [];
    for (const card of hand) {
      if (!this.playable(card)) continue;
      // An eight says what comes next, so it is four moves rather than one.
      if (rankOf(card) === WILD_RANK) for (let suit = 0; suit < 4; suit++) list.push(playMove(card, suit));
      else list.push(playMove(card));
    }
    // The rule is that you draw until you can play, so drawing is offered only when nothing fits.
    if (!list.length) {
      if (this.stock.length || this.discard.length > 1) list.push(EIGHTS_DRAW);
      else list.push(EIGHTS_PASS);
    }
    return list;
  }

  /** The discard comes back as a new stock, all but the card on top. */
  private refill(stock: number[], discard: number[], rng: Rng): void {
    if (stock.length || discard.length <= 1) return;
    const top = discard.pop()!;
    const rest = discard.splice(0, discard.length);
    for (let i = rest.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [rest[i], rest[j]] = [rest[j]!, rest[i]!];
    }
    stock.push(...rest);
    discard.push(top);
  }

  apply(play: EightsMove): EightsState {
    if (this.result) throw new Error('Game is over');
    if (!this.legalMoves(this.currentSeat).includes(play)) throw new Error(`Illegal move: ${play}`);
    const seat = this.currentSeat;
    const hands = this.hands.map((hand) => [...hand]);
    const stock = [...this.stock];
    const discard = [...this.discard];
    const next = ((seat + 1) % this.hands.length) as Seat;
    // Shuffling the pile back is the only chance in the game, so it is seeded from the position.
    const rng = createRng((this.moves * 2654435761 + this.discard.length) >>> 0);

    if (play === EIGHTS_PASS) {
      return new EightsState(hands, stock, discard, this.suit, next, this.moves + 1, null, { kind: 'pass', seat });
    }
    if (play === EIGHTS_DRAW) {
      this.refill(stock, discard, rng);
      const card = stock.pop();
      if (card === undefined) throw new Error('Nothing left to draw');
      hands[seat]!.push(card);
      // Still this seat's turn: you draw until something fits.
      return new EightsState(hands, stock, discard, this.suit, seat, this.moves + 1, null, { kind: 'draw', seat, card });
    }

    const [cardText, suitText] = play.slice(1).split('.');
    const card = Number(cardText);
    hands[seat]!.splice(hands[seat]!.indexOf(card), 1);
    discard.push(card);
    const suit = suitText === undefined ? suitOf(card) : Number(suitText);
    const won = hands[seat]!.length === 0;
    return new EightsState(
      hands,
      stock,
      discard,
      suit,
      won ? seat : next,
      this.moves + 1,
      won ? { winners: [seat], draw: false } : null,
      { kind: 'play', seat, card, ...(suitText === undefined ? {} : { named: suit }) },
    );
  }

  /** What every other hand is worth to the winner, once somebody is out. */
  get score(): number {
    return this.hands.reduce((sum, hand) => sum + hand.reduce((cards, card) => cards + eightsValue(card), 0), 0);
  }
}

/** The deal: seven cards each for two players, five for three or four. */
export function newEights(seed: number, players = 2): EightsState {
  const deck = shuffledDeck(createRng(seed >>> 0));
  const each = players === 2 ? 7 : 5;
  const hands = Array.from({ length: players }, (_, seat) => deck.slice(seat * each, (seat + 1) * each));
  const rest = deck.slice(players * each);
  // A game that starts on an eight would start with somebody naming a suit, so turn again.
  let first = 0;
  while (rankOf(rest[first]!) === WILD_RANK && first < rest.length - 1) first++;
  const top = rest[first]!;
  const stock = rest.filter((_, i) => i !== first).reverse();
  return new EightsState(hands, stock, [top], suitOf(top), 0, 0, null, null);
}

/**
 * What a seat is allowed to know: its own cards, the pile, the suit in force, how many cards
 * everybody else holds, and how deep the stock is. Bots are handed this and nothing else.
 */
export interface EightsView {
  readonly hand: readonly number[];
  readonly top: number;
  readonly suit: number;
  readonly counts: readonly number[];
  readonly stock: number;
  readonly seat: Seat;
}

export const viewFor = (state: EightsState, seat: Seat): EightsView => ({
  hand: state.hands[seat]!,
  top: state.top,
  suit: state.suit,
  counts: state.counts,
  stock: state.stock.length,
  seat,
});

/** How each level plays, as data: whether it saves its eights, and how well it picks a suit. */
interface EightsStyle {
  readonly keepEights: boolean;
  readonly bestSuit: boolean;
  readonly dumpHigh: boolean;
}

const TIERS: Record<BotTier, EightsStyle> = {
  easy: { keepEights: false, bestSuit: false, dumpHigh: false },
  medium: { keepEights: true, bestSuit: false, dumpHigh: false },
  hard: { keepEights: true, bestSuit: true, dumpHigh: true },
  expert: { keepEights: true, bestSuit: true, dumpHigh: true },
};

/** The suit this hand is strongest in, for naming one after an eight. */
function longestSuit(hand: readonly number[], rng: Rng): number {
  const counts = [0, 0, 0, 0];
  for (const card of hand) if (rankOf(card) !== WILD_RANK) counts[suitOf(card)]!++;
  const best = Math.max(...counts);
  return rng.pick(counts.flatMap((count, suit) => (count === best ? [suit] : [])));
}

function chooseFromView(view: EightsView, style: EightsStyle, rng: Rng, moves: readonly EightsMove[]): EightsMove {
  if (moves.length === 1) return moves[0]!;
  const eights = moves.filter((move) => move.includes('.'));
  const plain = moves.filter((move) => !move.includes('.'));
  // An eight is the card that gets you out of trouble, so the better levels hold on to it.
  const pool = style.keepEights && plain.length ? plain : eights.length ? eights : plain;
  if (pool === eights || !plain.length) {
    const suit = style.bestSuit ? longestSuit(view.hand, rng) : rng.int(4);
    const wanted = eights.filter((move) => Number(move.split('.')[1]) === suit);
    return wanted.length ? rng.pick(wanted) : rng.pick(eights);
  }
  if (style.dumpHigh) {
    // Get rid of what would cost the most if somebody else goes out first.
    const worth = (move: EightsMove) => eightsValue(Number(move.slice(1).split('.')[0]));
    const most = Math.max(...pool.map(worth));
    return rng.pick(pool.filter((move) => worth(move) === most));
  }
  return rng.pick(pool);
}

function createEightsBot(style: EightsStyle): Bot<EightsMove> {
  return {
    chooseMove(generic: GameState<EightsMove>, seat: Seat, rng: Rng): EightsMove {
      const state = generic as EightsState;
      const moves = state.legalMoves(seat);
      if (!moves.length) throw new Error('No legal moves');
      // The bot is handed a seat's view, never the state, so it cannot read another hand.
      return chooseFromView(viewFor(state, seat), style, rng, moves);
    },
  };
}

export const crazyEights: GameDefinition<EightsMove> = {
  id: 'crazy-eights',
  name: 'Crazy Eights',
  minPlayers: 2,
  maxPlayers: 4,
  modes: ['bot', 'sameDevice', 'onlineLive'],
  hiddenInfo: true,
  realtime: false,
  newGame: (config, seed) => newEights(seed, config.players),
  createBot: (tier) => createEightsBot(TIERS[tier]),
  encodeMove: (move) => move,
};
