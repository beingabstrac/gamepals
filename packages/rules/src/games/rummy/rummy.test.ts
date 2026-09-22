import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import { BOT_TIERS, type Seat } from '../../core/types';
import {
  handSizeFor,
  helps,
  newRummy,
  RUMMY_TARGET,
  rummy,
  rummyDiscard,
  rummyDrawDiscard,
  rummyDrawStock,
  rummyLayOff,
  rummyMeld,
  RummyState,
  rummyViewFor,
  type RummyMove,
} from './index';

const card = (rank: number, suit: number) => suit * 13 + rank - 1;
const SPADES = 0;
const HEARTS = 1;
const DIAMONDS = 2;
const CLUBS = 3;

/** A seat that has drawn and is deciding what to do, with the table as given. */
const playing = (
  hands: number[][],
  table: { seat: Seat; cards: number[] }[] = [],
  stock: number[] = [1, 2, 3, 4, 5],
  discard: number[] = [card(13, CLUBS)],
  target: 'hand' | '100' = 'hand',
) =>
  new RummyState(hands, stock, discard, table, hands.map(() => 0), hands.map(() => false), 0, 'play',
    (hands.length - 1) as Seat, 0, 0, target, 0, null, null);

describe('rummy deal and turns', () => {
  it('deals ten each with two players and seven with three or four', () => {
    expect(handSizeFor(2)).toBe(10);
    expect(handSizeFor(3)).toBe(7);
    expect(handSizeFor(4)).toBe(7);
    expect(newRummy(5, 2).counts).toEqual([10, 10]);
    expect(newRummy(5, 4).counts).toEqual([7, 7, 7, 7]);
    expect(newRummy(5, 2).discard).toHaveLength(1);
  });

  it('draws first, then melds and throws', () => {
    const start = newRummy(5, 2);
    expect(start.phase).toBe('draw');
    expect(start.legalMoves(0)).toEqual([rummyDrawStock, rummyDrawDiscard]);
    expect(() => start.apply(rummyDiscard(start.hands[0]![0]!))).toThrow(/Illegal/);
    const drawn = start.apply(rummyDrawStock);
    expect(drawn.phase).toBe('play');
    expect(drawn.counts[0]).toBe(11);
    expect(() => drawn.apply(rummyDrawStock)).toThrow(/Illegal/);
    // Throwing one away passes the turn on.
    const thrown = drawn.apply(rummyDiscard(drawn.hands[0]![0]!));
    expect(thrown.currentSeat).toBe(1);
    expect(thrown.phase).toBe('draw');
  });

  it('never makes you put a meld down', () => {
    const hand = [card(5, SPADES), card(6, SPADES), card(7, SPADES), card(13, CLUBS)];
    const state = playing([hand, [card(2, HEARTS)]]);
    expect(state.legalMoves(0)).toContain(rummyMeld([card(5, SPADES), card(6, SPADES), card(7, SPADES)]));
    // Throwing a card away instead is always allowed.
    expect(state.legalMoves(0)).toContain(rummyDiscard(card(13, CLUBS)));
  });

  it('only lays a card off where it leaves the meld legal', () => {
    const table = [{ seat: 1 as Seat, cards: [card(5, SPADES), card(6, SPADES), card(7, SPADES)] }];
    const hand = [card(8, SPADES), card(8, HEARTS), card(13, CLUBS)];
    const state = playing([hand, []], table);
    expect(state.legalMoves(0)).toContain(rummyLayOff(0, card(8, SPADES)));
    expect(state.legalMoves(0)).not.toContain(rummyLayOff(0, card(8, HEARTS)));
    const after = state.apply(rummyLayOff(0, card(8, SPADES)));
    expect(after.table[0]!.cards).toHaveLength(4);
    expect(after.counts[0]).toBe(2);
  });
});

describe('rummy going out', () => {
  it('takes everything the others are holding', () => {
    const mine = [card(5, SPADES), card(6, SPADES), card(7, SPADES), card(13, CLUBS)];
    const theirs = [card(13, SPADES), card(12, HEARTS), card(2, DIAMONDS)];
    let state = playing([mine, theirs]);
    state = state.apply(rummyMeld([card(5, SPADES), card(6, SPADES), card(7, SPADES)]));
    expect(state.result).toBe(null);
    state = state.apply(rummyDiscard(card(13, CLUBS)));
    // Out by throwing the last card: 10 + 10 + 2 against them, and no doubling.
    expect(state.last?.rummy).toBe(false);
    expect(state.scores[0]).toBe(22);
    expect(state.result?.winners).toEqual([0]);
  });

  it('doubles the score for putting a whole hand down in one turn', () => {
    const mine = [card(5, SPADES), card(6, SPADES), card(7, SPADES)];
    const theirs = [card(13, SPADES), card(12, HEARTS), card(2, DIAMONDS)];
    const state = playing([mine, theirs]).apply(rummyMeld(mine));
    expect(state.last?.rummy).toBe(true);
    expect(state.scores[0]).toBe(22 * 2);
  });

  it('does not count as rummy when the seat already had melds down', () => {
    const mine = [card(5, SPADES), card(6, SPADES), card(7, SPADES)];
    const theirs = [card(13, SPADES), card(12, HEARTS), card(2, DIAMONDS)];
    const table = [{ seat: 0 as Seat, cards: [card(9, SPADES), card(9, HEARTS), card(9, CLUBS)] }];
    const laid = new RummyState([mine, theirs], [1, 2, 3], [card(13, CLUBS)], table, [0, 0], [true, false], 0, 'play',
      1, 0, 0, 'hand', 0, null, null);
    const state = laid.apply(rummyMeld(mine));
    expect(state.last?.rummy).toBe(false);
    expect(state.scores[0]).toBe(22);
  });

  it('deals again in a match until somebody reaches the target', () => {
    const mine = [card(5, SPADES), card(6, SPADES), card(7, SPADES)];
    const theirs = [card(13, SPADES), card(12, HEARTS), card(11, DIAMONDS)];
    const state = playing([mine, theirs], [], [1, 2, 3], [card(13, CLUBS)], '100').apply(rummyMeld(mine));
    // Thirty doubled is sixty, which is short of a hundred, so the next hand is dealt.
    expect(state.scores[0]).toBe(60);
    expect(state.result).toBe(null);
    expect(state.hand).toBe(1);
    expect(state.counts).toEqual([10, 10]);
    expect(state.table).toEqual([]);
  });
});

describe('rummy when the cards run out', () => {
  it('turns the pile over to make a new stock', () => {
    const mine = [card(2, HEARTS), card(3, HEARTS), card(13, CLUBS)];
    const pile = [card(4, CLUBS), card(5, CLUBS), card(6, CLUBS)];
    const state = new RummyState([mine, [card(9, SPADES)]], [], pile, [], [0, 0], [false, false], 0, 'draw',
      1, 0, 0, 'hand', 0, null, null);
    expect(state.legalMoves(0)).toContain(rummyDrawStock);
    const drawn = state.apply(rummyDrawStock);
    // The pile is turned over without shuffling: its top card stays put and the rest becomes stock.
    expect(drawn.discard).toEqual([card(6, CLUBS)]);
    expect(drawn.stock).toHaveLength(1);
    expect(drawn.hands[0]).toContain(card(4, CLUBS));
    expect(drawn.reshuffles).toBe(1);
  });

  it('throws the hand in when even that runs out', () => {
    const mine = [card(2, HEARTS), card(13, CLUBS)];
    const state = new RummyState([mine, [card(9, SPADES)]], [], [card(4, CLUBS)], [], [0, 0], [false, false], 1, 'play',
      1, 0, 0, 'hand', 0, null, null);
    const thrown = state.apply(rummyDiscard(card(13, CLUBS)));
    expect(thrown.result).not.toBe(null);
    expect(thrown.scores).toEqual([0, 0]);
    expect(thrown.last?.scored).toEqual([0, 0]);
  });
});

describe('rummy bots and matches', () => {
  it('knows which cards take a hand closer to a meld', () => {
    const hand = [card(5, SPADES), card(6, SPADES), card(9, HEARTS), card(9, DIAMONDS), card(2, CLUBS)];
    expect(helps(hand, card(7, SPADES))).toBeGreaterThan(0);
    expect(helps(hand, card(13, CLUBS))).toBe(0);
  });

  it('cannot see the stock or anybody else"s hand, which shuffling them behind it proves', () => {
    for (const tier of BOT_TIERS) {
      const bot = rummy.createBot(tier);
      for (let seed = 0; seed < 8; seed++) {
        let state = newRummy(seed, 3) as RummyState;
        for (let step = 0; step < 8 && !state.result; step++) {
          const seat = state.currentSeat;
          const chosen = bot.chooseMove(state, seat, createRng(seed + 1));
          const swapped = new RummyState(
            state.hands.map((hand, i) => (i === seat ? hand : [...hand].reverse())),
            [...state.stock].reverse(), state.discard, state.table, state.scores, state.laidBefore,
            state.reshuffles, state.phase, state.dealer, state.hand, seat, state.target, state.moves, null, state.last,
          );
          expect(bot.chooseMove(swapped, seat, createRng(seed + 1)), `${tier} changed its mind`).toBe(chosen);
          state = state.apply(chosen);
        }
      }
    }
  });

  it('is handed only what the seat can see', () => {
    const view = rummyViewFor(newRummy(3, 3), 1);
    expect(view.hand).toEqual(newRummy(3, 3).hands[1]);
    expect(Object.keys(view).sort()).toEqual(['counts', 'discard', 'hand', 'phase', 'scores', 'seat', 'stockLeft', 'table']);
  });

  it('plays whole games with only legal moves, and replays exactly', { timeout: 120_000 }, () => {
    const bots = BOT_TIERS.map((tier) => rummy.createBot(tier));
    for (const players of [2, 4]) {
      for (const target of ['hand', '100'] as const) {
        let state = rummy.newGame({ players, variant: target }, 9) as RummyState;
        const moves: RummyMove[] = [];
        while (!state.result && moves.length < 4000) {
          const seat = state.currentSeat;
          const legal = state.legalMoves(seat);
          expect(legal, `nobody could move at move ${moves.length}`).not.toEqual([]);
          const move = bots[seat % bots.length]!.chooseMove(state, seat, createRng(moves.length + 1));
          expect(legal).toContain(move);
          moves.push(move);
          state = state.apply(move);
        }
        expect(state.result, `${players} players to ${target} never finished`).not.toBe(null);
        if (target === '100' && state.scores.some((score) => score > 0)) {
          expect(Math.max(...state.scores)).toBeGreaterThanOrEqual(RUMMY_TARGET);
        }
        const replayed = replay(rummy, toMoveLog(rummy, { players, variant: target }, 9, moves)) as RummyState;
        expect(replayed.scores).toEqual(state.scores);
      }
    }
  });

  it('ends most hands with somebody actually going out', { timeout: 120_000 }, () => {
    // Bots that threw cards away at random went out in none of thirty-one hands: every one died
    // of the cards running out. A hand nobody wins is a real Rummy outcome, but it is not what
    // most hands should look like, and no other test could see the difference.
    for (const players of [2, 4]) {
      let out = 0;
      for (let seed = 0; seed < 20; seed++) {
        const bots = BOT_TIERS.map((tier) => rummy.createBot(tier));
        let state = rummy.newGame({ players, variant: 'hand' }, seed) as RummyState;
        let moves = 0;
        while (!state.result && moves < 1000) {
          const seat = state.currentSeat;
          state = state.apply(bots[seat % bots.length]!.chooseMove(state, seat, createRng(moves + 1)));
          moves++;
        }
        if (state.scores.some((score) => score > 0)) out++;
      }
      expect(out, `${players} players: only ${out} of 20 hands ended with somebody out`).toBeGreaterThanOrEqual(12);
    }
  });

  it('takes the upcard when it finishes something', () => {
    const hand = [card(5, SPADES), card(6, SPADES), card(2, CLUBS)];
    const state = new RummyState([hand, [card(9, HEARTS)]], [1, 2, 3], [card(7, SPADES)], [], [0, 0], [false, false], 0,
      'draw', 1, 0, 0, 'hand', 0, null, null);
    const expert = rummy.createBot('expert');
    expect(expert.chooseMove(state, 0, createRng(1))).toBe(rummyDrawDiscard);
  });
});

/**
 * Cards are moved, never made and never destroyed, so every one of them is somewhere at every
 * point in a game. Mancala's seeds had the same invariant written for them after a picture made
 * it look as though forty-two had gone missing; they had not, but the test was worth having
 * whatever the picture meant. This is the same question asked of the deck.
 */
describe('rummy conservation', () => {
  it('never loses a card while a hand is played out', () => {
    for (let seed = 0; seed < 8; seed++) {
      const rng = createRng(seed);
      let state = newRummy(seed, 2 + (seed % 3));
      for (let move = 0; move < 200 && !state.result; move++) {
        const all = [...state.hands.flat(), ...state.stock, ...state.discard, ...state.table.flatMap((m) => m.cards)];
        expect(all.length, `seed ${seed}, move ${move}`).toBe(52);
        expect(new Set(all).size, `seed ${seed}, move ${move}`).toBe(52);
        const moves = state.legalMoves(state.currentSeat);
        if (moves.length === 0) break;
        state = state.apply(rng.pick(moves));
      }
    }
  });
});
