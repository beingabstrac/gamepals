import { createRng, type Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';
import { rankOf, shuffledDeck } from '../cards';

/**
 * Go Fish (docs/games/go-fish.md). Ask a player for a rank you already hold; they hand over all
 * of them and you ask again, or you go fishing. Four of a rank is a book. 2 to 4 players.
 * Moves: `a<seat>.<rank>` asks that seat for that rank, `d` draws when your hand is empty.
 */
export type FishMove = string;
export const FISH_DRAW: FishMove = 'd';
/** Nothing to ask for and nothing to draw: the turn moves on. */
export const FISH_PASS: FishMove = 'x';
export const BOOK_SIZE = 4;
export const BOOKS_IN_A_DECK = 13;
export const askMove = (seat: Seat, rank: number): FishMove => `a${seat}.${rank}`;

/** Every ask is said out loud, so everybody can remember it. */
export interface FishAsk {
  readonly from: Seat;
  readonly to: Seat;
  readonly rank: number;
  /** How many cards changed hands: 0 means they went fishing. */
  readonly got: number;
}

export interface FishEvent {
  readonly kind: 'ask' | 'draw';
  readonly ask?: FishAsk;
  /** Books laid down as a result, by rank. */
  readonly books: readonly number[];
}

/** Lays down every book a hand has completed, taking those cards out of it. */
function layBooks(hand: number[], books: number[]): number[] {
  const made: number[] = [];
  for (let rank = 1; rank <= BOOKS_IN_A_DECK; rank++) {
    if (hand.filter((card) => rankOf(card) === rank).length < BOOK_SIZE) continue;
    made.push(rank);
    books.push(rank);
  }
  for (const rank of made) {
    for (let i = hand.length - 1; i >= 0; i--) if (rankOf(hand[i]!) === rank) hand.splice(i, 1);
  }
  return made;
}

export class FishState implements GameState<FishMove> {
  private cached?: FishMove[];

  constructor(
    /** Every seat's cards. A seat may only ever be shown its own. */
    readonly hands: readonly (readonly number[])[],
    /** The ranks each seat has laid down. */
    readonly books: readonly (readonly number[])[],
    readonly pool: readonly number[],
    readonly currentSeat: Seat,
    /** Everything anybody has asked for, oldest first. Public, and the whole skill of the game. */
    readonly asks: readonly FishAsk[],
    readonly moves: number,
    readonly result: GameResult | null,
    readonly last: FishEvent | null,
  ) {}

  get counts(): readonly number[] {
    return this.hands.map((hand) => hand.length);
  }

  /** The ranks this seat holds, which are the only ones it may ask for. */
  ranksIn(seat: Seat): number[] {
    return [...new Set(this.hands[seat]!.map(rankOf))].sort((a, b) => a - b);
  }

  legalMoves(seat: Seat): readonly FishMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    this.cached ??= this.build();
    return this.cached;
  }

  private build(): FishMove[] {
    const seat = this.currentSeat;
    const mine = this.ranksIn(seat);
    if (!mine.length) return this.pool.length ? [FISH_DRAW] : [FISH_PASS];
    const list: FishMove[] = [];
    for (let other = 0; other < this.hands.length; other++) {
      if (other === seat) continue;
      // Asking somebody with no cards is not a move, it is a waste of a turn.
      if (!this.hands[other]!.length) continue;
      for (const rank of mine) list.push(askMove(other as Seat, rank));
    }
    // Everybody else is out of cards: fish instead, or let the turn move on.
    return list.length ? list : this.pool.length ? [FISH_DRAW] : [FISH_PASS];
  }

  /**
   * Over when all thirteen books are down, and also when nobody can move: with the pool empty
   * and only one player still holding cards there is nobody left to ask, and 41% of games
   * reached exactly that before this was handled.
   */
  private finished(books: readonly (readonly number[])[], hands: readonly (readonly number[])[], pool: readonly number[]): GameResult | null {
    const down = books.reduce((sum, list) => sum + list.length, 0);
    const holders = hands.filter((hand) => hand.length).length;
    if (down < BOOKS_IN_A_DECK && (pool.length || holders > 1)) return null;
    const most = Math.max(...books.map((list) => list.length));
    const winners = books.flatMap((list, seat) => (list.length === most ? [seat as Seat] : []));
    return { winners, draw: winners.length > 1 };
  }

  apply(play: FishMove): FishState {
    if (this.result) throw new Error('Game is over');
    if (!this.legalMoves(this.currentSeat).includes(play)) throw new Error(`Illegal move: ${play}`);
    const seat = this.currentSeat;
    const hands = this.hands.map((hand) => [...hand]);
    const books = this.books.map((list) => [...list]);
    const pool = [...this.pool];
    const next = ((seat + 1) % this.hands.length) as Seat;

    if (play === FISH_PASS) {
      return new FishState(hands, books, pool, next, this.asks, this.moves + 1, this.finished(books, hands, pool), { kind: 'draw', books: [] });
    }
    if (play === FISH_DRAW) {
      const card = pool.pop();
      if (card !== undefined) hands[seat]!.push(card);
      const made = layBooks(hands[seat]!, books[seat]!);
      return new FishState(hands, books, pool, next, this.asks, this.moves + 1, this.finished(books, hands, pool), { kind: 'draw', books: made });
    }

    const [toText, rankText] = play.slice(1).split('.');
    const to = Number(toText) as Seat;
    const rank = Number(rankText);
    const taken = hands[to]!.filter((card) => rankOf(card) === rank);
    hands[to] = hands[to]!.filter((card) => rankOf(card) !== rank);
    hands[seat]!.push(...taken);
    let fished: number | undefined;
    if (!taken.length) {
      // Go fish: one card from the pool, and the turn passes.
      fished = pool.pop();
      if (fished !== undefined) hands[seat]!.push(fished);
    }
    const made = layBooks(hands[seat]!, books[seat]!);
    const ask: FishAsk = { from: seat, to, rank, got: taken.length };
    // A hand that has run dry refills from the pool, so a player is never stuck holding nothing.
    if (!hands[seat]!.length && pool.length) hands[seat]!.push(pool.pop()!);
    return new FishState(
      hands,
      books,
      pool,
      taken.length ? seat : next,
      [...this.asks, ask],
      this.moves + 1,
      this.finished(books, hands, pool),
      { kind: 'ask', ask, books: made },
    );
  }
}

/** The deal: seven cards each for two or three players, five for four. */
export function newFish(seed: number, players = 2): FishState {
  const deck = shuffledDeck(createRng(seed >>> 0));
  const each = players <= 3 ? 7 : 5;
  const hands: number[][] = [];
  const books: number[][] = [];
  for (let seat = 0; seat < players; seat++) {
    hands.push(deck.slice(seat * each, (seat + 1) * each));
    books.push([]);
  }
  // A hand dealt with four of a rank already in it lays that book down before anybody plays.
  hands.forEach((hand, seat) => layBooks(hand, books[seat]!));
  return new FishState(hands, books, deck.slice(players * each), 0, [], 0, null, null);
}

/** What a seat may know: its own cards, what is on the table, and what everybody has asked for. */
export interface FishView {
  readonly hand: readonly number[];
  readonly books: readonly (readonly number[])[];
  readonly counts: readonly number[];
  readonly pool: number;
  readonly asks: readonly FishAsk[];
  readonly seat: Seat;
}

export const fishViewFor = (state: FishState, seat: Seat): FishView => ({
  hand: state.hands[seat]!,
  books: state.books,
  counts: state.counts,
  pool: state.pool.length,
  asks: state.asks,
  seat,
});

interface FishStyle {
  /** Remembers who asked for what, which is the whole skill of the game. */
  readonly remembers: boolean;
  /** Asks for the rank it holds most of, so a book is closer. */
  readonly closesBooks: boolean;
}

const TIERS: Record<BotTier, FishStyle> = {
  easy: { remembers: false, closesBooks: false },
  medium: { remembers: false, closesBooks: true },
  hard: { remembers: true, closesBooks: true },
  expert: { remembers: true, closesBooks: true },
};

function chooseAsk(view: FishView, style: FishStyle, rng: Rng, moves: readonly FishMove[]): FishMove {
  if (moves.length === 1) return moves[0]!;
  const score = (move: FishMove): number => {
    const [toText, rankText] = move.slice(1).split('.');
    const to = Number(toText);
    const rank = Number(rankText);
    let points = 0;
    if (style.closesBooks) points += view.hand.filter((card) => rankOf(card) === rank).length;
    if (style.remembers) {
      // Somebody who asked for this rank had one; somebody who was asked and said no did not.
      for (const ask of view.asks) {
        if (ask.rank !== rank) continue;
        if (ask.from === to) points += 3;
        if (ask.to === to && ask.got === 0) points -= 4;
      }
    }
    return points;
  };
  const best = Math.max(...moves.map(score));
  return rng.pick(moves.filter((move) => score(move) === best));
}

function createFishBot(style: FishStyle): Bot<FishMove> {
  return {
    chooseMove(generic: GameState<FishMove>, seat: Seat, rng: Rng): FishMove {
      const state = generic as FishState;
      const moves = state.legalMoves(seat);
      if (!moves.length) throw new Error('No legal moves');
      // Handed a seat's view, never the state: a bot cannot see a hand it should not.
      return chooseAsk(fishViewFor(state, seat), style, rng, moves);
    },
  };
}

export const goFish: GameDefinition<FishMove> = {
  id: 'go-fish',
  name: 'Go Fish',
  minPlayers: 2,
  maxPlayers: 4,
  modes: ['bot', 'sameDevice', 'onlineLive'],
  hiddenInfo: true,
  realtime: false,
  newGame: (config, seed) => newFish(seed, config.players),
  createBot: (tier) => createFishBot(TIERS[tier]),
  encodeMove: (move) => move,
};
