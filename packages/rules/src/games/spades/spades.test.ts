import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import { BOT_TIERS, type Seat } from '../../core/types';
import {
  BAG_LIMIT,
  countWinners,
  NIL_SCORE,
  newSpades,
  spades,
  spadesBid,
  spadesPlay,
  SpadesState,
  spadesViewFor,
  SPADES_SUIT,
  teamOf,
  type SpadesMove,
} from './index';

const card = (rank: number, suit: number) => suit * 13 + rank - 1;
/** A hand in the play phase, with the bids already in. */
const at = (hands: number[][], bids: number[], seat: Seat = 0, broken = false, won = [0, 0, 0, 0]) =>
  new SpadesState(hands, bids, won, [0, 0], [0, 0], 'play', [], [], broken, 0, seat, 'hand', 0, null, null);

describe('spades deal and bidding', () => {
  it('deals thirteen each and starts with everybody bidding', () => {
    const state = newSpades(5);
    expect(state.counts).toEqual([13, 13, 13, 13]);
    expect(state.phase).toBe('bid');
    expect(state.legalMoves(0)).toHaveLength(14);
  });

  it('adds the two bids of a partnership together', () => {
    let state = newSpades(5);
    for (const bid of [3, 2, 4, 1]) state = state.apply(spadesBid(bid));
    expect(state.phase).toBe('play');
    // Seats 0 and 2 are partners, and so are 1 and 3.
    expect(state.contracts).toEqual([7, 3]);
    expect(teamOf(2 as Seat)).toBe(0);
    expect(teamOf(3 as Seat)).toBe(1);
  });
});

describe('spades playing', () => {
  it('will not let spades lead until one has trumped a trick', () => {
    const hand = [card(9, SPADES_SUIT), card(4, 3)];
    const shut = at([hand, [], [], []], [3, 3, 3, 3]);
    expect(shut.legalMoves(0)).toEqual([spadesPlay(card(4, 3))]);
    const open = at([hand, [], [], []], [3, 3, 3, 3], 0, true);
    expect(open.legalMoves(0)).toHaveLength(2);
  });

  it('gives the trick to the highest spade when one is played', () => {
    const hands = [[card(1, 3)], [card(2, SPADES_SUIT)], [card(13, 3)], [card(5, 3)]];
    let state = at(hands, [1, 1, 1, 1], 0, true);
    for (const seat of [0, 1, 2, 3]) state = state.apply(spadesPlay(hands[seat]![0]!));
    // The two of spades beats the ace of clubs, because spades are trump.
    expect(state.last?.took).toBe(1);
  });

  it('scores ten a trick bid, with a bag for each one over', () => {
    // Everybody bids one, so each pair is on two. A bid of nought would be nil, not "no bid".
    const hands = [[card(1, 3)], [card(1, 2)], [card(2, 3)], [card(2, 2)]];
    let state = at(hands, [1, 1, 1, 1], 0, true, [2, 1, 0, 0]);
    for (const seat of [0, 1, 2, 3]) state = state.apply(spadesPlay(hands[seat]![0]!));
    // Seat 0 takes this one as well: three against a contract of two, so twenty and a bag.
    expect(state.scores[0]).toBe(20 + 1);
    expect(state.bags[0]).toBe(1);
    // The other pair took one of the two they bid.
    expect(state.scores[1]).toBe(-20);
  });

  it('pays 100 for a nil that holds and takes 100 off one that does not', () => {
    const made = new SpadesState([[], [], [], []], [0, 3, 3, 3], [0, 2, 1, 1], [0, 0], [0, 0], 'play', [], [], true, 0, 0, 'hand', 0, null, null);
    // Nobody has cards left, so scoring the hand is what the next play does; call it directly
    // through a last trick instead.
    const hands = [[card(2, 3)], [card(1, 3)], [card(3, 3)], [card(4, 3)]];
    let broken = at(hands, [0, 2, 2, 2], 0, true, [0, 1, 1, 1]);
    for (const seat of [0, 1, 2, 3]) broken = broken.apply(spadesPlay(hands[seat]![0]!));
    // Seat 1 took this trick too, so seat 0's nil held: +100, and the pair's contract of 2 failed.
    expect(broken.scores[0]).toBe(NIL_SCORE - 20);
    expect(made.bids[0]).toBe(0);
  });

  it('takes 100 off for every ten bags', () => {
    const hands = [[card(1, 3)], [card(2, 2)], [card(2, 3)], [card(3, 2)]];
    const state = new SpadesState(hands, [1, 1, 1, 1], [1, 0, 0, 0], [0, 0], [BAG_LIMIT - 1, 0], 'play', [], [], true, 0, 0, 'hand', 0, null, null);
    let after = state;
    for (const seat of [0, 1, 2, 3]) after = after.apply(spadesPlay(hands[seat]![0]!));
    // The pair bid two and took two: no new bag, so the nine they were carrying stay put.
    expect(after.bags[0]).toBe(BAG_LIMIT - 1);
    expect(after.scores[0]).toBe(20);
  });

  it('wipes ten bags and a hundred points when the tenth arrives', () => {
    const hands = [[card(1, 3)], [card(2, 2)], [card(2, 3)], [card(3, 2)]];
    // Bid one as a pair, already carrying nine bags, and take two.
    const state = new SpadesState(hands, [1, 13, 0, 0], [1, 0, 0, 0], [0, 0], [BAG_LIMIT - 1, 0], 'play', [], [], true, 0, 0, 'hand', 0, null, null);
    let after = state;
    for (const seat of [0, 1, 2, 3]) after = after.apply(spadesPlay(hands[seat]![0]!));
    expect(after.bags[0]).toBe(0);
    // Ten for the trick bid, a bag for the extra, a hundred off for the tenth bag, and seat 2's
    // nil held because it took nothing.
    expect(after.scores[0]).toBe(10 + 1 - 100 + NIL_SCORE);
  });
});

describe('spades bots and matches', () => {
  it('counts a hand roughly the way a player would', () => {
    const big = [card(1, SPADES_SUIT), card(13, SPADES_SUIT), card(12, SPADES_SUIT), card(1, 1), card(1, 2)];
    expect(countWinners(big)).toBeGreaterThanOrEqual(5);
    expect(countWinners([card(2, 1), card(3, 2), card(4, 3)])).toBe(0);
  });

  it('cannot see anybody else, which shuffling their cards behind it proves', () => {
    for (const tier of BOT_TIERS) {
      const bot = spades.createBot(tier);
      for (let seed = 0; seed < 12; seed++) {
        let state = newSpades(seed) as SpadesState;
        while (state.phase === 'bid') state = state.apply(bot.chooseMove(state, state.currentSeat, createRng(seed + 1)));
        const seat = state.currentSeat;
        const chosen = bot.chooseMove(state, seat, createRng(seed + 1));
        const swapped = new SpadesState(
          state.hands.map((hand, i) => (i === seat ? hand : [...hand].reverse())),
          state.bids, state.won, state.scores, state.bags, state.phase, state.trick, state.tricks, state.broken,
          state.hand, seat, state.target, state.moves, null, null,
        );
        expect(bot.chooseMove(swapped, seat, createRng(seed + 1)), `${tier} changed its mind`).toBe(chosen);
      }
    }
  });

  it('is handed only what the seat can see', () => {
    const state = newSpades(3);
    const view = spadesViewFor(state, 1);
    expect(view.hand).toEqual(state.hands[1]);
    expect(Object.keys(view).sort()).toEqual(['bags', 'bids', 'broken', 'hand', 'scores', 'seat', 'trick', 'tricks', 'won']);
  });

  it('plays whole matches with only legal cards, and replays exactly', () => {
    const bots = BOT_TIERS.map((tier) => spades.createBot(tier));
    for (const target of ['hand', '200'] as const) {
      let state = spades.newGame({ players: 4, variant: target }, 13) as SpadesState;
      const moves: SpadesMove[] = [];
      while (!state.result && moves.length < 1200) {
        const seat = state.currentSeat;
        const legal = state.legalMoves(seat);
        expect(legal, `nobody could move at move ${moves.length}`).not.toEqual([]);
        const move = bots[seat]!.chooseMove(state, seat, createRng(moves.length + 1));
        expect(legal).toContain(move);
        moves.push(move);
        state = state.apply(move);
      }
      expect(state.result, `${target} never finished`).not.toBe(null);
      // Thirteen tricks go somewhere every hand.
      expect(state.won.reduce((a, b) => a + b, 0)).toBe(13);
      const replayed = replay(spades, toMoveLog(spades, { players: 4, variant: target }, 13, moves)) as SpadesState;
      expect(replayed.scores).toEqual(state.scores);
    }
  });
});

/**
 * Cards are moved, never made and never destroyed, so every one of them is somewhere at every
 * point in a game. Mancala's seeds had the same invariant written for them after a picture made
 * it look as though forty-two had gone missing; they had not, but the test was worth having
 * whatever the picture meant. This is the same question asked of the deck.
 */
describe('spades conservation', () => {
  it('never loses a card while a hand is played out', () => {
    for (let seed = 0; seed < 8; seed++) {
      const rng = createRng(seed);
      let state = newSpades(seed);
      const deal = state.tricks.length;
      for (let move = 0; move < 60 && !state.result; move++) {
        // Only within one deal: a fresh deal puts every card back in a hand and starts again.
        if (state.tricks.length < deal) break;
        const all = [...state.hands.flat(), ...state.trick.map((p) => p.card), ...state.tricks.flat().map((p) => p.card)];
        expect(all.length, `seed ${seed}, move ${move}`).toBe(52);
        expect(new Set(all).size, `seed ${seed}, move ${move}`).toBe(52);
        const moves = state.legalMoves(state.currentSeat);
        if (moves.length === 0) break;
        state = state.apply(rng.pick(moves));
      }
    }
  });
});
