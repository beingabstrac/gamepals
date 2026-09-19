import { createRng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';
import { rankOf, shuffledDeck } from '../cards';

/**
 * War (docs/games/war.md). Both turn a card over; the higher one takes both. Equal cards mean
 * war: one down, one up, and the higher of those takes the lot. Two players, no decisions.
 * The only move is `f`, to turn the cards over, and either player may be the one to do it.
 */
export type WarMove = string;
export const WAR_FLIP: WarMove = 'f';
/** Aces are high, so an ace counts 14 rather than 1. */
export const warRank = (card: number): number => (rankOf(card) === 1 ? 14 : rankOf(card));
/** Wikipedia says a game might theoretically never end, so ours stops and counts the cards. */
export const WAR_BATTLES = 300;
/** A war puts one card face down and one face up. */
const WAR_DOWN = 1;

export interface WarEvent {
  /** What each side turned over this round, in the order they were laid. */
  readonly shown: readonly (readonly number[])[];
  /** How many wars it took to settle, 0 for an ordinary battle. */
  readonly wars: number;
  readonly winner: Seat | null;
  readonly taken: number;
}

export class WarState implements GameState<WarMove> {
  constructor(
    /** Each side's stack, the next card to turn at the end. */
    readonly stacks: readonly (readonly number[])[],
    readonly currentSeat: Seat,
    readonly battles: number,
    readonly result: GameResult | null,
    readonly last: WarEvent | null,
  ) {}

  get counts(): readonly number[] {
    return this.stacks.map((stack) => stack.length);
  }

  legalMoves(seat: Seat): readonly WarMove[] {
    return this.result || seat !== this.currentSeat ? [] : [WAR_FLIP];
  }

  /** Who is out of cards, if anybody. */
  private over(stacks: readonly (readonly number[])[], battles: number): GameResult | null {
    const empty = stacks.flatMap((stack, seat) => (stack.length === 0 ? [seat as Seat] : []));
    if (empty.length) {
      const winners = stacks.flatMap((stack, seat) => (stack.length ? [seat as Seat] : []));
      return { winners, draw: winners.length !== 1 };
    }
    if (battles < WAR_BATTLES) return null;
    // Time called: the bigger stack wins, and level is a draw.
    const most = Math.max(...stacks.map((stack) => stack.length));
    const winners = stacks.flatMap((stack, seat) => (stack.length === most ? [seat as Seat] : []));
    return { winners, draw: winners.length > 1 };
  }

  apply(play: WarMove): WarState {
    if (this.result) throw new Error('Game is over');
    if (!this.legalMoves(this.currentSeat).includes(play)) throw new Error(`Illegal move: ${play}`);
    const stacks = this.stacks.map((stack) => [...stack]);
    const shown: number[][] = stacks.map(() => []);
    let wars = 0;
    let winner: Seat | null = null;

    for (;;) {
      const cards = stacks.map((stack) => stack.pop());
      cards.forEach((card, seat) => {
        if (card !== undefined) shown[seat]!.push(card);
      });
      // A side that cannot turn a card over has lost, whatever is on the table.
      const out = cards.flatMap((card, seat) => (card === undefined ? [seat as Seat] : []));
      if (out.length) {
        winner = out.length === 1 ? ((1 - out[0]!) as Seat) : null;
        break;
      }
      const top = cards.map((card) => warRank(card!));
      if (top[0]! !== top[1]!) {
        winner = (top[0]! > top[1]! ? 0 : 1) as Seat;
        break;
      }
      // Equal: war. One card face down each, then round again for the one that decides it.
      wars++;
      let short = false;
      for (let seat = 0; seat < 2; seat++) {
        for (let i = 0; i < WAR_DOWN; i++) {
          const card = stacks[seat]!.pop();
          if (card === undefined) short = true;
          else shown[seat]!.push(card);
        }
      }
      if (short) {
        const left = stacks.map((stack) => stack.length);
        winner = left[0]! === left[1]! ? null : ((left[0]! > left[1]! ? 0 : 1) as Seat);
        break;
      }
    }

    // The winner takes the table: their own cards first, then the other side's, at the bottom.
    const taken = shown[0]!.length + shown[1]!.length;
    if (winner !== null) {
      const other = (1 - winner) as Seat;
      stacks[winner]!.unshift(...shown[winner]!, ...shown[other]!);
    } else {
      // Nobody could settle it: each side keeps what it laid, so the game can still end.
      stacks.forEach((stack, seat) => stack.unshift(...shown[seat]!));
    }
    const battles = this.battles + 1;
    return new WarState(stacks, ((this.currentSeat + 1) % 2) as Seat, battles, this.over(stacks, battles), {
      shown,
      wars,
      winner,
      taken,
    });
  }
}

/** The deal: 26 cards each, face down. */
export function newWar(seed: number): WarState {
  const deck = shuffledDeck(createRng(seed >>> 0));
  return new WarState([deck.slice(0, 26), deck.slice(26)], 0, 0, null, null);
}

export const war: GameDefinition<WarMove> = {
  id: 'war',
  name: 'War',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive'],
  hiddenInfo: false,
  realtime: false,
  newGame: (_config, seed) => newWar(seed),
  // Nothing to choose: a bot turns cards over the same as anybody else.
  createBot: (): Bot<WarMove> => ({ chooseMove: () => WAR_FLIP }),
  encodeMove: (move) => move,
};
