import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import { BOT_TIERS } from '../../core/types';
import { rankOf, suitOf } from '../cards';
import {
  crazyEights,
  EIGHTS_DRAW,
  EIGHTS_PASS,
  EightsState,
  eightsValue,
  newEights,
  playMove,
  viewFor,
  WILD_RANK,
  type EightsMove,
} from './index';

/** Card number from rank and suit: suits are 0 spades, 1 hearts, 2 diamonds, 3 clubs. */
const card = (rank: number, suit: number) => suit * 13 + rank - 1;
const at = (hands: number[][], top: number, stock: number[] = [], suit = suitOf(top), seat = 0) =>
  new EightsState(hands, stock, [top], suit, seat, 0, null, null);

describe('crazy eights deal', () => {
  it('gives seven cards each to two players and five to more', () => {
    expect(newEights(3, 2).counts).toEqual([7, 7]);
    expect(newEights(3, 3).counts).toEqual([5, 5, 5]);
    expect(newEights(3, 4).counts).toEqual([5, 5, 5, 5]);
  });

  it('turns one card up and keeps the rest, never starting on an eight', () => {
    for (let seed = 0; seed < 40; seed++) {
      const state = newEights(seed, 2);
      expect(rankOf(state.top)).not.toBe(WILD_RANK);
      expect(state.hands.flat().length + state.stock.length + 1).toBe(52);
      expect(state.suit).toBe(suitOf(state.top));
    }
  });

  it('gives the same deal for the same seed', () => {
    expect(newEights(9, 3).hands).toEqual(newEights(9, 3).hands);
  });
});

describe('crazy eights playing', () => {
  it('takes a card of the same suit or the same rank, and nothing else', () => {
    const state = at([[card(4, 0), card(9, 1), card(5, 2)], [card(2, 3)]], card(9, 0));
    expect(state.legalMoves(0)).toContain(playMove(card(4, 0))); // same suit
    expect(state.legalMoves(0)).toContain(playMove(card(9, 1))); // same rank
    expect(state.legalMoves(0)).not.toContain(playMove(card(5, 2)));
    expect(() => state.apply(playMove(card(5, 2)))).toThrow();
  });

  it('plays an eight on anything, and the eight says what comes next', () => {
    const state = at([[card(8, 3)], [card(2, 1)]], card(9, 0));
    for (let suit = 0; suit < 4; suit++) expect(state.legalMoves(0)).toContain(playMove(card(8, 3), suit));
    const after = state.apply(playMove(card(8, 3), 1));
    expect(after.suit).toBe(1);
    expect(after.last).toMatchObject({ kind: 'play', named: 1 });
  });

  it('follows the named suit, not the card that was put down', () => {
    const state = new EightsState([[card(3, 1)], [card(3, 2)]], [], [card(8, 3)], 1, 0, 0, null, null);
    expect(state.legalMoves(0)).toContain(playMove(card(3, 1)));
    expect(new EightsState([[card(4, 2)], [card(3, 2)]], [card(2, 0)], [card(8, 3)], 1, 0, 0, null, null).legalMoves(0)).toEqual([EIGHTS_DRAW]);
  });

  it('is won when a hand runs out, and counts what the others are holding', () => {
    const state = at([[card(4, 0)], [card(8, 1), card(13, 2), card(3, 3)]], card(9, 0));
    const after = state.apply(playMove(card(4, 0)));
    expect(after.result).toEqual({ winners: [0], draw: false });
    // An eight is 50, a picture is 10, and a three is three.
    expect(after.score).toBe(63);
    expect(eightsValue(card(1, 0))).toBe(1);
  });
});

describe('crazy eights drawing', () => {
  it('draws only when nothing fits, and keeps the turn', () => {
    const state = at([[card(4, 2)], [card(2, 1)]], card(9, 0), [card(7, 3), card(4, 0)]);
    expect(state.legalMoves(0)).toEqual([EIGHTS_DRAW]);
    const after = state.apply(EIGHTS_DRAW);
    expect(after.currentSeat).toBe(0);
    expect(after.counts[0]).toBe(2);
    expect(after.legalMoves(0)).toContain(playMove(card(4, 0)));
  });

  it('turns the pile back into a stock when the stock runs out', () => {
    const state = new EightsState([[card(4, 2)], [card(2, 1)]], [], [card(6, 1), card(7, 1), card(9, 0)], 0, 0, 0, null, null);
    const after = state.apply(EIGHTS_DRAW);
    expect(after.discard).toEqual([card(9, 0)]);
    // Two cards came back as stock, one of which is now in the hand.
    expect(after.stock.length + 1).toBe(2);
    expect(after.counts[0]).toBe(2);
  });

  it('passes when there is nothing to draw and nothing to play', () => {
    const state = at([[card(4, 2)], [card(2, 1)]], card(9, 0));
    expect(state.legalMoves(0)).toEqual([EIGHTS_PASS]);
    expect(state.apply(EIGHTS_PASS).currentSeat).toBe(1);
  });
});

describe('crazy eights bots', () => {
  it('cannot see anybody else, which shuffling their cards behind it proves', () => {
    for (const tier of BOT_TIERS) {
      const bot = crazyEights.createBot(tier);
      for (let seed = 0; seed < 25; seed++) {
        const state = newEights(seed, 3);
        const chosen = bot.chooseMove(state, 0, createRng(seed + 1));
        // Same seat, same hand, same pile: everything this seat can see is untouched.
        const swapped = new EightsState(
          [state.hands[0]!, state.hands[2]!, state.hands[1]!],
          [...state.stock].reverse(),
          state.discard,
          state.suit,
          0,
          state.moves,
          null,
          null,
        );
        expect(bot.chooseMove(swapped, 0, createRng(seed + 1)), `${tier} changed its mind when other hands moved`).toBe(chosen);
      }
    }
  });

  it('is handed only what the seat can see', () => {
    const state = newEights(4, 3);
    const view = viewFor(state, 1);
    expect(view.hand).toEqual(state.hands[1]);
    expect(view.counts).toEqual([5, 5, 5]);
    expect(Object.values(view).flat()).not.toContain(state.hands[0]![0]);
  });

  it('holds on to an eight while it has another card to play', () => {
    const state = at([[card(8, 3), card(4, 0)], [card(2, 1)]], card(9, 0));
    for (const tier of ['medium', 'hard', 'expert'] as const) {
      const move = crazyEights.createBot(tier).chooseMove(state, 0, createRng(7));
      expect(move, tier).toBe(playMove(card(4, 0)));
    }
  });

  it('plays whole games with only legal moves, and replays exactly', () => {
    for (const players of [2, 3, 4]) {
      const bots = BOT_TIERS.map((tier) => crazyEights.createBot(tier));
      let state = crazyEights.newGame({ players }, 31 + players) as EightsState;
      const moves: EightsMove[] = [];
      while (!state.result && moves.length < 600) {
        const move = bots[state.currentSeat % bots.length]!.chooseMove(state, state.currentSeat, createRng(moves.length + 1));
        expect(state.legalMoves(state.currentSeat)).toContain(move);
        moves.push(move);
        state = state.apply(move);
      }
      expect(state.result, `${players} players never finished`).not.toBe(null);
      const replayed = replay(crazyEights, toMoveLog(crazyEights, { players }, 31 + players, moves)) as EightsState;
      expect(replayed.hands).toEqual(state.hands);
      expect(replayed.discard).toEqual(state.discard);
    }
  });
});
