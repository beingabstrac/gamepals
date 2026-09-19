import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import { BOT_TIERS, type Seat } from '../../core/types';
import { rankOf } from '../cards';
import { askMove, BOOKS_IN_A_DECK, FISH_DRAW, FISH_PASS, FishState, fishViewFor, goFish, newFish, type FishMove } from './index';

const card = (rank: number, suit: number) => suit * 13 + rank - 1;
const at = (hands: number[][], pool: number[] = [], books: number[][] = hands.map(() => []), seat: Seat = 0) =>
  new FishState(hands, books, pool, seat, [], 0, null, null);

describe('go fish deal', () => {
  it('gives seven cards each to two or three players and five to four', () => {
    expect(newFish(5, 2).counts).toEqual([7, 7]);
    expect(newFish(5, 3).counts).toEqual([7, 7, 7]);
    expect(newFish(5, 4).counts).toEqual([5, 5, 5, 5]);
  });

  it('lays down a book that was dealt, before anybody plays', () => {
    const state = newFish(5, 2);
    const cards = state.hands.flat().length + state.pool.length + state.books.flat().length * 4;
    expect(cards).toBe(52);
    for (const hand of state.hands) {
      const counts = new Map<number, number>();
      for (const c of hand) counts.set(rankOf(c), (counts.get(rankOf(c)) ?? 0) + 1);
      expect([...counts.values()].every((n) => n < 4), 'a dealt book is still in a hand').toBe(true);
    }
  });

  it('gives the same deal for the same seed', () => {
    expect(newFish(8, 3).hands).toEqual(newFish(8, 3).hands);
  });
});

describe('go fish asking', () => {
  it('only offers ranks you are holding', () => {
    const state = at([[card(4, 0), card(9, 1)], [card(7, 2), card(4, 3)]]);
    expect(state.legalMoves(0)).toContain(askMove(1, 4));
    expect(state.legalMoves(0)).toContain(askMove(1, 9));
    expect(state.legalMoves(0)).not.toContain(askMove(1, 7));
    expect(() => state.apply(askMove(1, 7))).toThrow();
  });

  it('hands over every card of that rank, and the asker goes again', () => {
    const state = at([[card(4, 0)], [card(4, 1), card(4, 2), card(9, 3)]]);
    const after = state.apply(askMove(1, 4));
    expect(after.counts).toEqual([3, 1]);
    expect(after.currentSeat).toBe(0);
    expect(after.last?.ask).toMatchObject({ from: 0, to: 1, rank: 4, got: 2 });
  });

  it('sends you fishing when they have none, and the turn passes', () => {
    const state = at([[card(4, 0)], [card(9, 1)]], [card(2, 2)]);
    const after = state.apply(askMove(1, 4));
    expect(after.currentSeat).toBe(1);
    expect(after.counts[0]).toBe(2);
    expect(after.last?.ask).toMatchObject({ got: 0 });
  });

  it('lays a book down the moment four of a rank are together', () => {
    const state = at([[card(4, 0), card(4, 1), card(4, 2)], [card(4, 3), card(9, 0)]]);
    const after = state.apply(askMove(1, 4));
    expect(after.books[0]).toEqual([4]);
    expect(after.counts[0]).toBe(0);
    expect(after.last?.books).toEqual([4]);
  });

  it('is over when all thirteen books are down, and the most books wins', () => {
    const books = [Array.from({ length: 7 }, (_, i) => i + 1), Array.from({ length: 5 }, (_, i) => i + 8)];
    const state = at([[card(13, 0), card(13, 1), card(13, 2)], [card(13, 3)]], [], books);
    const after = state.apply(askMove(1, 13));
    expect(after.books[0]).toHaveLength(8);
    expect(after.books.flat()).toHaveLength(BOOKS_IN_A_DECK);
    expect(after.result).toEqual({ winners: [0], draw: false });
  });
});

describe('go fish bots', () => {
  it('cannot see anybody else, which shuffling their cards behind it proves', () => {
    for (const tier of BOT_TIERS) {
      const bot = goFish.createBot(tier);
      for (let seed = 0; seed < 25; seed++) {
        const state = newFish(seed, 3);
        const chosen = bot.chooseMove(state, 0, createRng(seed + 1));
        const swapped = new FishState(
          [state.hands[0]!, state.hands[2]!, state.hands[1]!],
          state.books,
          [...state.pool].reverse(),
          0,
          state.asks,
          state.moves,
          null,
          null,
        );
        // The counts change when hands swap, so only ask about seats holding the same number.
        if (state.counts[1] !== state.counts[2]) continue;
        expect(bot.chooseMove(swapped, 0, createRng(seed + 1)), `${tier} changed its mind`).toBe(chosen);
      }
    }
  });

  it('remembers who asked for what, at the levels that are meant to', () => {
    const hands = [[card(5, 0), card(9, 1)], [card(3, 2), card(6, 2)], [card(3, 3), card(7, 3)]];
    // Seat 2 asked for nines earlier, so seat 2 is the one holding them.
    const asks = [{ from: 2 as Seat, to: 1 as Seat, rank: 9, got: 0 }];
    const state = new FishState(hands, [[], [], []], [], 0, asks, 0, null, null);
    expect(goFish.createBot('hard').chooseMove(state, 0, createRng(3))).toBe(askMove(2, 9));
  });

  it('plays whole games with only legal moves, and replays exactly', () => {
    for (const players of [2, 3, 4]) {
      const bots = BOT_TIERS.map((tier) => goFish.createBot(tier));
      let state = goFish.newGame({ players }, 41 + players) as FishState;
      const moves: FishMove[] = [];
      while (!state.result && moves.length < 500) {
        const legal = state.legalMoves(state.currentSeat);
        expect(legal, `${players} players: nobody could move and the game had not ended`).not.toEqual([]);
        const move = bots[state.currentSeat % bots.length]!.chooseMove(state, state.currentSeat, createRng(moves.length + 1));
        expect(legal).toContain(move);
        moves.push(move);
        state = state.apply(move);
      }
      expect(state.result, `${players} players never finished`).not.toBe(null);
      const replayed = replay(goFish, toMoveLog(goFish, { players }, 41 + players, moves)) as FishState;
      expect(replayed.books).toEqual(state.books);
      expect(replayed.hands).toEqual(state.hands);
      expect(fishViewFor(state, 0).pool).toBe(state.pool.length);
    }
  });

  it('draws when its hand is empty and the pool still has cards', () => {
    const state = at([[], [card(9, 1)]], [card(2, 2)]);
    expect(state.legalMoves(0)).toEqual([FISH_DRAW]);
    expect(state.apply(FISH_DRAW).counts[0]).toBe(1);
  });

  it('ends when the pool is empty and only one player is left holding cards', () => {
    // Nobody to ask and nothing to draw: the game is over on books, not stuck.
    const books = [[1, 2, 3, 4, 5, 6, 7], [8, 9, 10, 11]];
    const state = at([[card(12, 0)], []], [], books);
    expect(state.result ?? state.apply(state.legalMoves(0)[0]!).result).toEqual({ winners: [0], draw: false });
  });

  it('lets the turn move on when a player has nothing at all', () => {
    const state = at([[], [card(9, 1)], [card(3, 2)]], []);
    expect(state.legalMoves(0)).toEqual([FISH_PASS]);
    expect(state.apply(FISH_PASS).currentSeat).toBe(1);
  });
});
