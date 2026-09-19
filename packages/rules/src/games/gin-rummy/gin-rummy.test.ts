import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import { BOT_TIERS, type Seat } from '../../core/types';
import {
  cardUse,
  GIN_BONUS,
  GIN_TARGET,
  ginDiscard,
  ginDrawDiscard,
  ginDrawStock,
  ginKnock,
  ginPass,
  ginRummy,
  GinState,
  ginTake,
  ginViewFor,
  HAND_SIZE,
  newGin,
  STOCK_FLOOR,
  UNDERCUT_BONUS,
  type GinMove,
} from './index';

const card = (rank: number, suit: number) => suit * 13 + rank - 1;
const SPADES = 0;
const HEARTS = 1;
const DIAMONDS = 2;
const CLUBS = 3;

/** A seat holding eleven cards, about to throw one. */
const throwing = (hands: number[][], stock: number[], discard: number[], seat: Seat = 0, target: 'hand' | '100' = 'hand') =>
  new GinState(hands, stock, discard, [0, 0], [0, 0], 'throw', 1, 0, seat, target, null, 0, null, null);

describe('gin rummy deal and the first turn', () => {
  it('deals ten each and turns the twenty-first card face up', () => {
    const state = newGin(7);
    expect(state.counts).toEqual([HAND_SIZE, HAND_SIZE]);
    expect(state.discard).toHaveLength(1);
    expect(state.stock).toHaveLength(52 - 2 * HAND_SIZE - 1);
    expect(state.phase).toBe('offer');
    // Seat 1 dealt, so seat 0 is offered the upcard first.
    expect(state.currentSeat).toBe(0);
  });

  it('offers the upcard to one seat, then the other, then gives up and draws from the stock', () => {
    const start = newGin(7);
    const up = start.upcard;
    const passed = start.apply(ginPass);
    expect(passed.currentSeat).toBe(1);
    expect(passed.upcard).toBe(up);
    const both = passed.apply(ginPass);
    // Neither wanted it, so seat 0 has drawn from the stock and the upcard is still there.
    expect(both.currentSeat).toBe(0);
    expect(both.phase).toBe('throw');
    expect(both.counts).toEqual([HAND_SIZE + 1, HAND_SIZE]);
    expect(both.upcard).toBe(up);
    expect(both.stock).toHaveLength(start.stock.length - 1);
  });

  it('will not let a card taken from the pile go straight back', () => {
    const start = newGin(7);
    const took = start.apply(ginTake);
    expect(took.legalMoves(0)).not.toContain(ginDiscard(start.upcard));
    expect(took.legalMoves(0).length).toBeGreaterThan(0);
  });
});

describe('gin rummy turns', () => {
  it('is draw one, throw one, and then the other seat', () => {
    let state = newGin(7).apply(ginPass).apply(ginPass);
    const mine = [...state.hands[0]!];
    state = state.apply(ginDiscard(mine[0]!));
    expect(state.phase).toBe('draw');
    expect(state.currentSeat).toBe(1);
    expect(state.upcard).toBe(mine[0]);
    state = state.apply(ginDrawDiscard);
    expect(state.hands[1]).toContain(mine[0]);
    expect(state.legalMoves(1)).not.toContain(ginDiscard(mine[0]!));
    const other = state.hands[1]!.find((card) => card !== mine[0])!;
    expect(state.legalMoves(1)).toContain(ginDiscard(other));
  });

  it('refuses a throw during the draw, and a draw during the throw', () => {
    const state = newGin(7).apply(ginPass).apply(ginPass);
    expect(() => state.apply(ginDrawStock)).toThrow(/Illegal/);
    const next = state.apply(ginDiscard(state.hands[0]![0]!));
    expect(() => next.apply(ginDiscard(next.hands[1]![0]!))).toThrow(/Illegal/);
  });

  it('only offers a knock when what is left over comes to ten or less', () => {
    const big = [card(13, SPADES), card(12, HEARTS), card(10, CLUBS), card(9, DIAMONDS), card(8, SPADES),
      card(7, HEARTS), card(5, CLUBS), card(4, DIAMONDS), card(3, SPADES), card(2, HEARTS), card(13, CLUBS)];
    const state = throwing([big, []], [1, 2, 3, 4, 5], [40]);
    expect(state.legalMoves(0).some((move) => move[0] === 'k')).toBe(false);

    const tidy = [card(5, SPADES), card(6, SPADES), card(7, SPADES), card(9, HEARTS), card(9, DIAMONDS),
      card(9, CLUBS), card(1, SPADES), card(2, HEARTS), card(3, CLUBS), card(4, DIAMONDS), card(13, CLUBS)];
    // Two melds and 1+2+3+4 = 10 left over once the king goes.
    expect(throwing([tidy, []], [1, 2, 3, 4, 5], [40]).legalMoves(0)).toContain(ginKnock(card(13, CLUBS)));
  });
});

describe('gin rummy scoring', () => {
  const knockerWins = () => {
    const mine = [card(5, SPADES), card(6, SPADES), card(7, SPADES), card(9, HEARTS), card(9, DIAMONDS),
      card(9, CLUBS), card(1, SPADES), card(2, HEARTS), card(3, CLUBS), card(4, DIAMONDS), card(13, CLUBS)];
    const theirs = [card(13, SPADES), card(12, HEARTS), card(11, CLUBS), card(10, DIAMONDS), card(8, SPADES),
      card(7, HEARTS), card(6, CLUBS), card(5, DIAMONDS), card(3, HEARTS), card(2, CLUBS)];
    return throwing([mine, theirs], [1, 2, 3, 4, 5], [40]).apply(ginKnock(card(13, CLUBS)));
  };

  it('scores the difference between the two counts', () => {
    const state = knockerWins();
    // Their hand is 71 of loose cards, but the 8♠ lays off onto the knocker's 5♠6♠7♠, so it is
    // 63 against the knocker's 10. Laying off is easy to forget when working an answer out by hand.
    expect(state.showdown?.gin).toBe(false);
    expect(state.showdown?.against).toBe(63);
    expect(state.showdown?.scored[0]).toBe(63 - 10);
    expect(state.result?.winners).toEqual([0]);
  });

  it('pays twenty for gin, plus everything the other player is holding', () => {
    const mine = [card(5, SPADES), card(6, SPADES), card(7, SPADES), card(9, HEARTS), card(9, DIAMONDS),
      card(9, CLUBS), card(1, CLUBS), card(2, CLUBS), card(3, CLUBS), card(4, CLUBS), card(13, HEARTS)];
    const theirs = [card(13, SPADES), card(12, HEARTS), card(11, CLUBS), card(4, DIAMONDS), card(8, SPADES),
      card(7, HEARTS), card(6, DIAMONDS), card(5, HEARTS), card(3, HEARTS), card(2, DIAMONDS)];
    const state = throwing([mine, theirs], [1, 2, 3, 4, 5], [40]).apply(ginKnock(card(13, HEARTS)));
    expect(state.showdown?.gin).toBe(true);
    expect(state.showdown?.scored[0]).toBe(GIN_BONUS + 10 + 10 + 10 + 4 + 8 + 7 + 6 + 5 + 3 + 2);
  });

  it('lets the other player lay off, and pays them for an undercut', () => {
    // The knocker keeps eight left over. The other hand is three melds and a loose 2♠, and that
    // two goes straight onto the knocker's 3♠4♠5♠, leaving them holding nothing at all.
    const mine = [card(3, SPADES), card(4, SPADES), card(5, SPADES), card(10, HEARTS), card(10, DIAMONDS),
      card(10, CLUBS), card(1, HEARTS), card(2, DIAMONDS), card(2, HEARTS), card(3, CLUBS), card(13, CLUBS)];
    const theirs = [card(11, DIAMONDS), card(12, DIAMONDS), card(13, DIAMONDS), card(5, HEARTS), card(6, HEARTS),
      card(7, HEARTS), card(8, SPADES), card(8, CLUBS), card(8, DIAMONDS), card(2, SPADES)];
    const state = throwing([mine, theirs], [1, 2, 3, 4, 5], [40]).apply(ginKnock(card(13, CLUBS)));
    expect(state.showdown?.undercut).toBe(true);
    expect(state.showdown?.against).toBe(0);
    expect(state.showdown?.scored[1]).toBe(UNDERCUT_BONUS + 8);
    expect(state.result?.winners).toEqual([1]);
  });

  it('cancels the hand when the stock runs down to two', () => {
    const mine = [card(13, SPADES), card(12, HEARTS), card(10, CLUBS), card(9, DIAMONDS), card(8, SPADES),
      card(7, HEARTS), card(5, CLUBS), card(4, DIAMONDS), card(3, SPADES), card(2, HEARTS), card(13, CLUBS)];
    const state = throwing([mine, []], [1, 2], [40]).apply(ginDiscard(card(13, CLUBS)));
    expect(state.stock).toHaveLength(STOCK_FLOOR);
    expect(state.showdown?.dead).toBe(true);
    expect(state.showdown?.scored).toEqual([0, 0]);
    expect(state.result?.draw).toBe(true);
  });

  it('deals the next hand in a match, and the deal changes seats', () => {
    const mine = [card(5, SPADES), card(6, SPADES), card(7, SPADES), card(9, HEARTS), card(9, DIAMONDS),
      card(9, CLUBS), card(1, SPADES), card(2, HEARTS), card(3, CLUBS), card(4, DIAMONDS), card(13, CLUBS)];
    const theirs = [card(13, SPADES), card(12, HEARTS), card(11, CLUBS), card(10, DIAMONDS), card(8, SPADES),
      card(7, HEARTS), card(6, CLUBS), card(5, DIAMONDS), card(3, HEARTS), card(2, CLUBS)];
    const state = throwing([mine, theirs], [1, 2, 3, 4, 5], [40], 0, '100').apply(ginKnock(card(13, CLUBS)));
    expect(state.result).toBe(null);
    expect(state.hand).toBe(1);
    expect(state.dealer).toBe(0);
    expect(state.phase).toBe('offer');
    expect(state.counts).toEqual([HAND_SIZE, HAND_SIZE]);
    expect(state.scores[0]).toBe(53);
  });
});

describe('gin rummy bots and matches', () => {
  it('knows which cards do something for a hand', () => {
    const hand = [card(5, SPADES), card(6, SPADES), card(9, HEARTS), card(9, DIAMONDS), card(2, CLUBS)];
    // The seven finishes a run, the nine finishes a set, and the king does nothing at all.
    expect(cardUse(hand, card(7, SPADES))).toBeGreaterThan(cardUse(hand, card(13, CLUBS)));
    expect(cardUse(hand, card(9, CLUBS))).toBeGreaterThan(cardUse(hand, card(13, CLUBS)));
  });

  it('cannot see the stock or the other hand, which shuffling them behind it proves', () => {
    for (const tier of BOT_TIERS) {
      const bot = ginRummy.createBot(tier);
      for (let seed = 0; seed < 8; seed++) {
        let state = newGin(seed) as GinState;
        for (let step = 0; step < 6 && !state.result; step++) {
          const seat = state.currentSeat;
          const chosen = bot.chooseMove(state, seat, createRng(seed + 1));
          const other = ((seat + 1) % 2) as Seat;
          const swapped = new GinState(
            state.hands.map((hand, i) => (i === other ? [...hand].reverse() : hand)),
            [...state.stock].reverse(), state.discard, state.scores, state.won, state.phase, state.dealer,
            state.hand, seat, state.target, state.showdown, state.moves, null, state.last,
          );
          expect(bot.chooseMove(swapped, seat, createRng(seed + 1)), `${tier} changed its mind`).toBe(chosen);
          state = state.apply(chosen);
        }
      }
    }
  });

  it('is handed only what the seat can see', () => {
    const view = ginViewFor(newGin(3), 1);
    expect(view.hand).toEqual(newGin(3).hands[1]);
    expect(Object.keys(view).sort()).toEqual(['discard', 'hand', 'phase', 'scores', 'seat', 'stockLeft', 'theirCount']);
  });

  it('plays whole games with only legal moves, and replays exactly', { timeout: 120_000 }, () => {
    const bots = BOT_TIERS.map((tier) => ginRummy.createBot(tier));
    for (const target of ['hand', '100'] as const) {
      let state = ginRummy.newGame({ players: 2, variant: target }, 21) as GinState;
      const moves: GinMove[] = [];
      while (!state.result && moves.length < 3000) {
        const seat = state.currentSeat;
        const legal = state.legalMoves(seat);
        expect(legal, `nobody could move at move ${moves.length}`).not.toEqual([]);
        const move = bots[(seat + moves.length) % bots.length]!.chooseMove(state, seat, createRng(moves.length + 1));
        expect(legal).toContain(move);
        moves.push(move);
        state = state.apply(move);
      }
      expect(state.result, `${target} never finished`).not.toBe(null);
      if (target === '100') expect(Math.max(...state.scores)).toBeGreaterThanOrEqual(GIN_TARGET);
      const replayed = replay(ginRummy, toMoveLog(ginRummy, { players: 2, variant: target }, 21, moves)) as GinState;
      expect(replayed.scores).toEqual(state.scores);
    }
  });
});
