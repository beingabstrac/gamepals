import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import { BOT_TIERS, type Seat } from '../../core/types';
import { suitOf } from '../cards';
import type { Played } from '../tricks';
import {
  hearts,
  HeartsState,
  heartsPass,
  heartsPlay,
  heartsValue,
  heartsViewFor,
  MOON,
  newHearts,
  PASS_ROUND,
  QUEEN_RANK,
  SPADES,
  TWO_OF_CLUBS,
  type HeartsMove,
} from './index';

const card = (rank: number, suit: number) => suit * 13 + rank - 1;
const QUEEN = card(QUEEN_RANK, SPADES);
const play = (seat: number, c: number): Played => ({ seat: seat as Seat, card: c });
/** A hand in the play phase, with everything else empty. */
const at = (hands: number[][], seat: Seat = 0, trick: Played[] = [], broken = false, tricks: Played[][] = []) =>
  new HeartsState(hands, [0, 0, 0, 0], [0, 0, 0, 0], 'play', hands.map(() => []), 0, trick, tricks, broken, seat, 'hand', 0, null, null);

describe('hearts deal and passing', () => {
  it('deals thirteen each and passes left, right, across, then nobody', () => {
    const state = newHearts(7);
    expect(state.counts).toEqual([13, 13, 13, 13]);
    expect(PASS_ROUND).toEqual([1, 3, 2, 0]);
    expect(state.phase).toBe('pass');
    expect(state.passTo).toBe(1);
  });

  it('moves three cards from each hand to the next, all at the same moment', () => {
    let state = newHearts(9);
    const before = state.hands.map((hand) => [...hand]);
    for (let seat = 0; seat < 4; seat++) {
      const three = state.hands[state.currentSeat]!.slice(0, 3);
      state = state.apply(heartsPass(three));
    }
    expect(state.phase).toBe('play');
    expect(state.counts).toEqual([13, 13, 13, 13]);
    // Seat 1 is now holding the three that seat 0 passed on.
    for (const card2 of before[0]!.slice(0, 3)) expect(state.hands[1]).toContain(card2);
  });

  it('starts the play with whoever holds the two of clubs', () => {
    let state = newHearts(11);
    while (state.phase === 'pass') state = state.apply(heartsPass(state.hands[state.currentSeat]!.slice(0, 3)));
    expect(state.hands[state.currentSeat]).toContain(TWO_OF_CLUBS);
    expect(state.legalMoves(state.currentSeat)).toEqual([heartsPlay(TWO_OF_CLUBS)]);
  });
});

describe('hearts playing a trick', () => {
  it('makes you follow the suit that was led', () => {
    const state = at([[card(5, 3), card(9, 1)], [], [], []], 0, [play(3, card(7, 3))], false, [[]]);
    expect(state.legalMoves(0)).toEqual([heartsPlay(card(5, 3))]);
    expect(() => state.apply(heartsPlay(card(9, 1)))).toThrow();
  });

  it('will not let a heart lead until they are broken', () => {
    const hand = [card(9, 1), card(4, 3)];
    const shut = at([hand, [], [], []], 0, [], false, [[]]);
    expect(shut.legalMoves(0)).toEqual([heartsPlay(card(4, 3))]);
    const open = at([hand, [], [], []], 0, [], true, [[]]);
    expect(open.legalMoves(0)).toHaveLength(2);
    // Nothing but hearts left, so a heart leads whatever the state of play.
    const only = at([[card(9, 1)], [], [], []], 0, [], false, [[]]);
    expect(only.legalMoves(0)).toEqual([heartsPlay(card(9, 1))]);
  });

  it('keeps points off the first trick', () => {
    const hand = [card(9, 1), QUEEN, card(4, 3)];
    const state = at([hand, [], [], []], 0, [play(3, card(7, 3))]);
    expect(state.legalMoves(0)).toEqual([heartsPlay(card(4, 3))]);
  });

  it('gives the trick and the lead to the highest card of the suit led', () => {
    const hands = [[card(3, 3)], [card(13, 3)], [card(5, 3)], [card(2, 3)]];
    let state = at(hands, 0, [], false, [[]]);
    for (const seat of [0, 1, 2, 3]) state = state.apply(heartsPlay(hands[seat]![0]!));
    expect(state.last).toMatchObject({ kind: 'hand', took: 1 });
  });

  it('counts a heart as one and the queen as thirteen', () => {
    expect(heartsValue(card(9, 1))).toBe(1);
    expect(heartsValue(QUEEN)).toBe(13);
    expect(heartsValue(card(9, 3))).toBe(0);
    const hands = [[card(3, 3)], [QUEEN], [card(5, 1)], [card(2, 3)]];
    let state = at(hands, 0, [], true, [[]]);
    for (const seat of [0, 1, 2, 3]) state = state.apply(heartsPlay(hands[seat]![0]!));
    // Seat 0 led the three of clubs and nobody beat it, so it took the queen and a heart.
    expect(state.scores[0]).toBe(14);
  });

  it('turns all 26 on one player into 26 for everybody else', () => {
    const taken = [MOON, 0, 0, 0];
    const state = new HeartsState([[card(3, 3)], [card(4, 3)], [card(5, 3)], [card(6, 3)]], [0, 0, 0, 0], taken, 'play',
      [[], [], [], []], 0, [], [[]], true, 0, 'hand', 0, null, null);
    let after = state;
    for (const seat of [0, 1, 2, 3]) after = after.apply(heartsPlay(after.hands[seat]![0]!));
    expect(after.scores).toEqual([0, MOON, MOON, MOON]);
    expect(after.last?.moon).toBe(0);
  });
});

describe('hearts matches and bots', () => {
  it('is won by the lowest score when somebody passes the target', () => {
    // Seat 0 leads the queen; nobody else holds a spade, so they throw hearts and seat 0 takes 16.
    const state = new HeartsState([[QUEEN], [card(4, 1)], [card(5, 1)], [card(6, 1)]], [48, 10, 20, 30], [0, 0, 0, 0],
      'play', [[], [], [], []], 0, [], [[]], true, 0, '50', 0, null, null);
    let after = state;
    for (const seat of [0, 1, 2, 3]) after = after.apply(heartsPlay(after.hands[seat]![0]!));
    expect(after.scores[0]).toBe(64);
    expect(after.result).toEqual({ winners: [1], draw: false });
  });

  it('cannot see anybody else, which shuffling their cards behind it proves', () => {
    for (const tier of BOT_TIERS) {
      const bot = hearts.createBot(tier);
      for (let seed = 0; seed < 12; seed++) {
        let state = newHearts(seed) as HeartsState;
        while (state.phase === 'pass') state = state.apply(heartsPass(state.hands[state.currentSeat]!.slice(0, 3)));
        const seat = state.currentSeat;
        const chosen = bot.chooseMove(state, seat, createRng(seed + 1));
        const swapped = new HeartsState(
          state.hands.map((hand, i) => (i === seat ? hand : [...hand].reverse())),
          state.scores, state.taken, state.phase, state.passing, state.hand, state.trick, state.tricks, state.broken,
          seat, state.target, state.moves, null, null,
        );
        expect(bot.chooseMove(swapped, seat, createRng(seed + 1)), `${tier} changed its mind`).toBe(chosen);
      }
    }
  });

  it('is handed only what the seat can see', () => {
    let state = newHearts(3);
    while (state.phase === 'pass') state = state.apply(heartsPass(state.hands[state.currentSeat]!.slice(0, 3)));
    const view = heartsViewFor(state, 1);
    expect(view.hand).toEqual(state.hands[1]);
    // The shape is the promise: there is no field here that could hold another hand.
    expect(Object.keys(view).sort()).toEqual(['broken', 'hand', 'scores', 'seat', 'taken', 'trick', 'tricks']);
  });

  it('plays whole hands with only legal cards, and replays exactly', () => {
    const bots = BOT_TIERS.map((tier) => hearts.createBot(tier));
    for (const target of ['hand', '50'] as const) {
      let state = hearts.newGame({ players: 4, variant: target }, 17) as HeartsState;
      const moves: HeartsMove[] = [];
      while (!state.result && moves.length < 900) {
        const seat = state.currentSeat;
        const legal = state.legalMoves(seat);
        expect(legal, `nobody could move at move ${moves.length}`).not.toEqual([]);
        const move = bots[seat]!.chooseMove(state, seat, createRng(moves.length + 1));
        expect(legal).toContain(move);
        moves.push(move);
        state = state.apply(move);
      }
      expect(state.result, `${target} never finished`).not.toBe(null);
      // Every point in the deck is accounted for, hand after hand.
      expect(state.scores.reduce((a, b) => a + b, 0) % 26).toBe(0);
      const replayed = replay(hearts, toMoveLog(hearts, { players: 4, variant: target }, 17, moves)) as HeartsState;
      expect(replayed.scores).toEqual(state.scores);
    }
  });

  it('never lets a heart or the queen onto the first trick of a hand', () => {
    const bot = hearts.createBot('hard');
    for (let seed = 0; seed < 8; seed++) {
      let state = newHearts(seed) as HeartsState;
      while (state.phase === 'pass') state = state.apply(bot.chooseMove(state, state.currentSeat, createRng(seed + 1)));
      for (let i = 0; i < 4; i++) {
        const move = bot.chooseMove(state, state.currentSeat, createRng(i + 1));
        const card2 = Number(move.slice(1));
        expect(heartsValue(card2), `seed ${seed} put points on the first trick`).toBe(0);
        state = state.apply(move);
      }
      expect(suitOf(state.tricks[0]![0]!.card)).toBe(3);
    }
  });
});
