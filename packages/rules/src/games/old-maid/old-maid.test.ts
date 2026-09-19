import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import { BOT_TIERS, type Seat } from '../../core/types';
import { rankOf, suitOf } from '../cards';
import { MaidState, maidViewFor, newMaid, oldMaid, MAID_QUEEN, takeMove, type MaidMove } from './index';

const card = (rank: number, suit: number) => suit * 13 + rank - 1;
const at = (hands: number[][], seat: Seat = 0) => new MaidState(hands, hands.map(() => 0), seat, 0, null, null);

describe('old maid deal', () => {
  it('takes one queen out and deals all 51 cards', () => {
    const state = newMaid(6, 3);
    const held = state.hands.flat();
    const thrown = state.pairs.reduce((sum, n) => sum + n, 0) * 2;
    expect(held.length + thrown).toBe(51);
    expect(held.filter((c) => rankOf(c) === MAID_QUEEN && suitOf(c) === 3)).toHaveLength(0);
  });

  it('throws away the pairs it was dealt before anybody plays', () => {
    for (let seed = 0; seed < 30; seed++) {
      for (const hand of newMaid(seed, 4).hands) {
        const counts = new Map<number, number>();
        for (const c of hand) counts.set(rankOf(c), (counts.get(rankOf(c)) ?? 0) + 1);
        expect([...counts.values()].every((n) => n === 1), 'a pair was left in a hand').toBe(true);
      }
    }
  });

  it('keeps one of a triplet rather than throwing all three', () => {
    // No hand keeping a duplicate would also be true if three of a rank went away together,
    // so count the cards: every one of the 51 is either still held or in a pair that was thrown.
    for (let seed = 0; seed < 30; seed++) {
      for (const players of [2, 3, 4]) {
        const state = newMaid(seed, players);
        const held = state.hands.flat().length;
        const thrown = state.pairs.reduce((sum, n) => sum + n, 0) * 2;
        expect(held + thrown, `seed ${seed} with ${players} players lost a card`).toBe(51);
      }
    }
  });

  it('gives the same deal for the same seed', () => {
    expect(newMaid(4, 3).hands).toEqual(newMaid(4, 3).hands);
  });
});

describe('old maid taking cards', () => {
  it('offers the hand on the left, one place per card', () => {
    const state = at([[card(2, 0)], [card(7, 1), card(9, 2)]]);
    expect(state.offering).toBe(1);
    expect(state.legalMoves(0)).toEqual([takeMove(0), takeMove(1)]);
    expect(() => state.apply(takeMove(2))).toThrow();
  });

  it('puts a pair down the moment the taken card meets its partner', () => {
    const state = at([[card(7, 0), card(3, 1)], [card(7, 2), card(9, 3)]]);
    const after = state.apply(takeMove(0));
    expect(after.counts).toEqual([1, 1]);
    expect(after.pairs[0]).toBe(1);
    expect(after.last).toMatchObject({ from: 1, to: 0, paired: 7 });
  });

  it('keeps a card that has no partner', () => {
    const state = at([[card(3, 1)], [card(7, 2), card(9, 3)]]);
    const after = state.apply(takeMove(0));
    expect(after.counts).toEqual([2, 1]);
    expect(after.pairs[0]).toBe(0);
  });

  it('skips a player who has run out, and says they are out', () => {
    const state = at([[card(3, 1)], [card(3, 2)], [card(9, 0), card(5, 0)]]);
    const after = state.apply(takeMove(0));
    // Seat 0 paired its three away, so both it and seat 1 are empty and seat 2 plays next.
    expect(after.counts[0]).toBe(0);
    expect(after.last?.out).toContain(1 as Seat);
    expect(after.currentSeat).toBe(2);
  });

  it('is lost by whoever is holding the odd queen at the end', () => {
    // Seat 0 takes the four it is missing, pairs it off, and is left holding only the queen.
    const state = at([[card(MAID_QUEEN, 0), card(4, 1)], [card(4, 2)]]);
    const after = state.apply(takeMove(0));
    expect(after.counts).toEqual([1, 0]);
    expect(after.hands[0]).toEqual([card(MAID_QUEEN, 0)]);
    // Everybody but the old maid has won.
    expect(after.result).toEqual({ winners: [1], draw: false });
  });
});

describe('old maid bots', () => {
  it('cannot see the fan it is picking from, which shuffling it proves', () => {
    for (const tier of BOT_TIERS) {
      const bot = oldMaid.createBot(tier);
      for (let seed = 0; seed < 25; seed++) {
        const state = newMaid(seed, 3);
        const chosen = bot.chooseMove(state, 0, createRng(seed + 1));
        const offered = state.offering;
        const shuffled = state.hands.map((hand, i) => (i === offered ? [...hand].reverse() : hand));
        const swapped = new MaidState(shuffled, state.pairs, 0, state.moves, null, null);
        expect(bot.chooseMove(swapped, 0, createRng(seed + 1)), `${tier} changed its mind`).toBe(chosen);
      }
    }
  });

  it('is handed the size of the fan and nothing else about it', () => {
    const state = newMaid(3, 3);
    const view = maidViewFor(state, 0);
    expect(view.offered).toBe(state.hands[state.offering]!.length);
    expect(Object.values(view).flat()).not.toContain(state.hands[state.offering]![0]);
  });

  it('plays whole games to a loser, and replays exactly', () => {
    for (const players of [2, 3, 4]) {
      const bot = oldMaid.createBot('medium');
      let state = oldMaid.newGame({ players }, 23 + players) as MaidState;
      const moves: MaidMove[] = [];
      while (!state.result && moves.length < 400) {
        const legal = state.legalMoves(state.currentSeat);
        expect(legal, `${players} players: nobody could move and the game had not ended`).not.toEqual([]);
        const move = bot.chooseMove(state, state.currentSeat, createRng(moves.length + 1));
        moves.push(move);
        state = state.apply(move);
      }
      expect(state.result, `${players} players never finished`).not.toBe(null);
      // Everybody wins except the one left holding the queen.
      expect(state.result!.winners).toHaveLength(players - 1);
      const left = state.hands.flat();
      expect(left).toHaveLength(1);
      expect(rankOf(left[0]!)).toBe(MAID_QUEEN);
      const replayed = replay(oldMaid, toMoveLog(oldMaid, { players }, 23 + players, moves)) as MaidState;
      expect(replayed.hands).toEqual(state.hands);
    }
  });
});
