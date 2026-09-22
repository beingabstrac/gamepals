import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import { BOT_TIERS, type Seat } from '../../core/types';
import type { Played } from '../tricks';
import {
  callbreak,
  callbreakCall,
  callbreakPlay,
  CallbreakState,
  callbreakViewFor,
  CALLBREAK_TRUMP,
  countCalls,
  newCallbreak,
  showScore,
  TENTH,
  type CallbreakMove,
} from './index';

const card = (rank: number, suit: number) => suit * 13 + rank - 1;
const HEARTS = 1;
const CLUBS = 3;
/** A seat about to play, with the calls already in. */
const at = (
  hands: number[][],
  calls: number[],
  trick: Played[] = [],
  seat: Seat = 0,
  won = [0, 0, 0, 0],
  target: 'one' | 'five' = 'one',
) => new CallbreakState(hands, calls, won, [0, 0, 0, 0], 'play', trick, [], 0, seat, target, 0, null, null);

describe('callbreak deal and calling', () => {
  it('deals thirteen each and the smallest call is one', () => {
    const state = newCallbreak(5);
    expect(state.counts).toEqual([13, 13, 13, 13]);
    expect(state.phase).toBe('call');
    expect(state.legalMoves(0)).toHaveLength(13);
    expect(state.legalMoves(0)[0]).toBe(callbreakCall(1));
    expect(state.legalMoves(0)).not.toContain(callbreakCall(0));
  });

  it('goes round the table once and then plays', () => {
    let state = newCallbreak(5);
    for (const call of [3, 2, 4, 1]) state = state.apply(callbreakCall(call));
    expect(state.phase).toBe('play');
    expect(state.calls).toEqual([3, 2, 4, 1]);
    expect(state.currentSeat).toBe(0);
  });

  it('refuses a card during calling and a call during play', () => {
    const state = newCallbreak(5);
    expect(() => state.apply(callbreakPlay(state.hands[0]![0]!))).toThrow(/Illegal/);
    const playing = at([[card(1, CLUBS)], [], [], []], [1, 1, 1, 1]);
    expect(() => playing.apply(callbreakCall(1))).toThrow(/Illegal/);
  });
});

describe('callbreak playing', () => {
  it('makes you beat the highest card of the suit led when you hold one', () => {
    const trick: Played[] = [{ seat: 3, card: card(10, HEARTS) }];
    const hand = [card(13, HEARTS), card(3, HEARTS), card(5, CLUBS)];
    const state = at([hand, [], [], []], [1, 1, 1, 1], trick);
    // The king is the only card that beats the ten, so it is the only legal play.
    expect(state.legalMoves(0)).toEqual([callbreakPlay(card(13, HEARTS))]);
  });

  it('lets you play any card of the suit when nothing of yours beats it', () => {
    const trick: Played[] = [{ seat: 3, card: card(10, HEARTS) }];
    const hand = [card(3, HEARTS), card(2, HEARTS), card(5, CLUBS)];
    const state = at([hand, [], [], []], [1, 1, 1, 1], trick);
    expect(state.legalMoves(0)).toEqual([callbreakPlay(card(3, HEARTS)), callbreakPlay(card(2, HEARTS))]);
  });

  it('makes a player with none of the suit trump it', () => {
    const trick: Played[] = [{ seat: 3, card: card(10, HEARTS) }];
    const hand = [card(2, CALLBREAK_TRUMP), card(9, CALLBREAK_TRUMP), card(5, CLUBS)];
    const state = at([hand, [], [], []], [1, 1, 1, 1], trick);
    expect(state.legalMoves(0)).toEqual([callbreakPlay(card(2, CALLBREAK_TRUMP)), callbreakPlay(card(9, CALLBREAK_TRUMP))]);
  });

  it('makes the trump beat the trumps already there, and frees the hand when none can', () => {
    const trick: Played[] = [
      { seat: 2, card: card(10, HEARTS) },
      { seat: 3, card: card(7, CALLBREAK_TRUMP) },
    ];
    const over = [card(5, CALLBREAK_TRUMP), card(9, CALLBREAK_TRUMP), card(5, CLUBS)];
    expect(at([over, [], [], []], [1, 1, 1, 1], trick).legalMoves(0)).toEqual([callbreakPlay(card(9, CALLBREAK_TRUMP))]);
    const under = [card(2, CALLBREAK_TRUMP), card(3, CALLBREAK_TRUMP), card(5, CLUBS)];
    // Nothing beats the seven, so everything in the hand is allowed, low trumps included.
    expect(at([under, [], [], []], [1, 1, 1, 1], trick).legalMoves(0)).toHaveLength(3);
  });

  it('lets spades be led whenever, unlike Spades', () => {
    const hand = [card(9, CALLBREAK_TRUMP), card(4, CLUBS)];
    expect(at([hand, [], [], []], [1, 1, 1, 1]).legalMoves(0)).toHaveLength(2);
  });

  it('gives the trick to the highest spade, otherwise the highest card of the suit led', () => {
    const trumped = [[card(1, CLUBS)], [card(2, CALLBREAK_TRUMP)], [card(13, CLUBS)], [card(5, CLUBS)]];
    let state = at(trumped, [1, 1, 1, 1]);
    for (const seat of [0, 1, 2, 3]) state = state.apply(callbreakPlay(trumped[seat]![0]!));
    // The two of spades beats the ace of clubs, because spades are trump.
    expect(state.last?.took).toBe(1);

    const plain = [[card(5, CLUBS)], [card(13, CLUBS)], [card(1, CLUBS)], [card(2, CLUBS)]];
    let flat = at(plain, [1, 1, 1, 1]);
    for (const seat of [0, 1, 2, 3]) flat = flat.apply(callbreakPlay(plain[seat]![0]!));
    expect(flat.last?.took).toBe(2);
  });
});

describe('callbreak scoring', () => {
  it('scores the call, a tenth for each trick over, and the call off for falling short', () => {
    const hands = [[card(1, CLUBS)], [card(2, CLUBS)], [card(3, CLUBS)], [card(4, CLUBS)]];
    let state = at(hands, [1, 1, 1, 1], [], 0, [1, 0, 0, 0]);
    for (const seat of [0, 1, 2, 3]) state = state.apply(callbreakPlay(hands[seat]![0]!));
    // Seat 0 called one and took two: one point and a tenth. Everybody else took none of their one.
    expect(state.scores[0]).toBe(TENTH + 1);
    expect(state.scores[1]).toBe(-TENTH);
    expect(state.result?.winners).toEqual([0]);
  });

  it('writes points in tenths the way people say them', () => {
    expect(showScore(41)).toBe('4.1');
    expect(showScore(20)).toBe('2');
    expect(showScore(-30)).toBe('-3');
    expect(showScore(-21)).toBe('-2.1');
  });

  it('deals again for the next round and moves who starts', () => {
    const hands = [[card(1, CLUBS)], [card(2, CLUBS)], [card(3, CLUBS)], [card(4, CLUBS)]];
    let state = at(hands, [1, 1, 1, 1], [], 0, [0, 0, 0, 0], 'five');
    for (const seat of [0, 1, 2, 3]) state = state.apply(callbreakPlay(hands[seat]![0]!));
    expect(state.result).toBe(null);
    expect(state.round).toBe(1);
    expect(state.phase).toBe('call');
    expect(state.counts).toEqual([13, 13, 13, 13]);
    expect(state.currentSeat).toBe(1);
    expect(state.rounds).toBe(5);
  });
});

describe('callbreak bots and matches', () => {
  it('counts a hand roughly the way a player would, and never calls less than one', () => {
    const big = [card(1, CALLBREAK_TRUMP), card(13, CALLBREAK_TRUMP), card(12, CALLBREAK_TRUMP), card(1, HEARTS), card(1, 2)];
    expect(countCalls(big)).toBeGreaterThanOrEqual(5);
    expect(countCalls([card(2, HEARTS), card(3, 2), card(4, CLUBS)])).toBe(1);
  });

  it('cannot see anybody else, which shuffling their cards behind it proves', () => {
    for (const tier of BOT_TIERS) {
      const bot = callbreak.createBot(tier);
      for (let seed = 0; seed < 12; seed++) {
        let state = newCallbreak(seed) as CallbreakState;
        while (state.phase === 'call') state = state.apply(bot.chooseMove(state, state.currentSeat, createRng(seed + 1)));
        const seat = state.currentSeat;
        const chosen = bot.chooseMove(state, seat, createRng(seed + 1));
        const swapped = new CallbreakState(
          state.hands.map((hand, i) => (i === seat ? hand : [...hand].reverse())),
          state.calls, state.won, state.scores, state.phase, state.trick, state.tricks,
          state.round, seat, state.target, state.moves, null, null,
        );
        expect(bot.chooseMove(swapped, seat, createRng(seed + 1)), `${tier} changed its mind`).toBe(chosen);
      }
    }
  });

  it('is handed only what the seat can see', () => {
    const state = newCallbreak(3);
    const view = callbreakViewFor(state, 1);
    expect(view.hand).toEqual(state.hands[1]);
    expect(Object.keys(view).sort()).toEqual(['calls', 'hand', 'scores', 'seat', 'trick', 'tricks', 'won']);
  });

  it('plays whole matches with only legal cards, and replays exactly', { timeout: 120_000 }, () => {
    const bots = BOT_TIERS.map((tier) => callbreak.createBot(tier));
    for (const target of ['one', 'five'] as const) {
      let state = callbreak.newGame({ players: 4, variant: target }, 13) as CallbreakState;
      const moves: CallbreakMove[] = [];
      while (!state.result && moves.length < 400) {
        const seat = state.currentSeat;
        const legal = state.legalMoves(seat);
        expect(legal, `nobody could move at move ${moves.length}`).not.toEqual([]);
        const move = bots[seat]!.chooseMove(state, seat, createRng(moves.length + 1));
        expect(legal).toContain(move);
        moves.push(move);
        state = state.apply(move);
      }
      expect(state.result, `${target} never finished`).not.toBe(null);
      // Thirteen tricks go somewhere every round.
      expect(state.won.reduce((a, b) => a + b, 0)).toBe(13);
      const replayed = replay(callbreak, toMoveLog(callbreak, { players: 4, variant: target }, 13, moves)) as CallbreakState;
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
describe('callbreak conservation', () => {
  it('never loses a card while a hand is played out', () => {
    for (let seed = 0; seed < 8; seed++) {
      const rng = createRng(seed);
      let state = newCallbreak(seed);
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
