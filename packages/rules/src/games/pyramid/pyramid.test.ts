import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { rankOf } from '../cards';
import {
  newPyramid,
  PAIR_TO,
  pyramid,
  PYRAMID_CARDS,
  PYRAMID_DRAW,
  pyramidHint,
  PYRAMID_PASSES,
  PYRAMID_REDEAL,
  PYRAMID_ROWS,
  PyramidState,
  PYRAMID_UNDO,
  PYRAMID_WASTE,
  rowOfIndex,
  rowStart,
  type PyramidMove,
} from './index';

/** Card number from rank and suit: suits are 0 spades, 1 hearts, 2 diamonds, 3 clubs. */
const card = (rank: number, suit: number) => suit * 13 + rank - 1;
/** A pyramid where only the listed places hold a card. */
const only = (cards: Record<number, number>) => Array.from({ length: PYRAMID_CARDS }, (_, i) => cards[i] ?? null);
const at = (cards: Record<number, number>, stock: number[] = [], waste: number[] = [], pass = 1) =>
  new PyramidState(only(cards), stock, waste, pass, 0, null, null, []);

describe('pyramid deal', () => {
  it('deals 28 cards in rows of 1 to 7, and keeps 24 in the stock', () => {
    const state = newPyramid(5);
    expect(state.pyramid).toHaveLength(PYRAMID_CARDS);
    expect(state.pyramid.every((c) => c !== null)).toBe(true);
    expect(state.stock).toHaveLength(24);
    expect(state.waste).toHaveLength(0);
    expect(rowStart(PYRAMID_ROWS - 1)).toBe(21);
    expect(rowOfIndex(21)).toBe(6);
    expect(rowOfIndex(0)).toBe(0);
    const all = [...state.pyramid, ...state.stock] as number[];
    expect(new Set(all).size).toBe(52);
  });

  it('gives the same deal for the same seed', () => {
    expect(newPyramid(9).pyramid).toEqual(newPyramid(9).pyramid);
  });
});

describe('pyramid taking cards', () => {
  it('frees a card only when both cards below it are gone', () => {
    const covered = at({ 0: card(6, 0), 1: card(4, 1), 2: card(9, 2) });
    expect(covered.free(0)).toBe(false);
    // Taking the pair below opens the card above.
    const open = covered.apply('p1.2');
    expect(open.free(0)).toBe(true);
  });

  it('takes two uncovered cards that add up to 13', () => {
    const state = at({ 1: card(4, 0), 2: card(9, 1) });
    expect(state.legalMoves(0)).toContain('p1.2');
    expect(state.apply('p1.2').left).toBe(0);
  });

  it('will not take a pair that adds up to anything else', () => {
    const state = at({ 1: card(4, 0), 2: card(8, 1) });
    expect(state.legalMoves(0)).not.toContain('p1.2');
    expect(() => state.apply('p1.2')).toThrow();
  });

  it('takes a King on its own', () => {
    const state = at({ 1: card(13, 0), 2: card(5, 1) });
    expect(state.legalMoves(0)).toContain('p1');
    expect(state.apply('p1').left).toBe(1);
    expect(rankOf(card(13, 0))).toBe(PAIR_TO);
  });

  it('pairs a pyramid card with the top of the waste, and takes a King off the waste', () => {
    const state = at({ 1: card(4, 0), 2: card(2, 1) }, [], [card(9, 2)]);
    expect(state.legalMoves(0)).toContain('p1.w');
    const after = state.apply('p1.w');
    expect(after.left).toBe(1);
    expect(after.waste).toHaveLength(0);
    const king = at({ 1: card(4, 0), 2: card(2, 1) }, [], [card(13, 3)]);
    expect(king.apply(PYRAMID_WASTE).waste).toHaveLength(0);
  });

  it('is won when the pyramid is empty', () => {
    const state = at({ 1: card(4, 0), 2: card(9, 1) });
    expect(state.apply('p1.2').result).toEqual({ winners: [0], draw: false });
  });
});

describe('pyramid the deck', () => {
  it('turns one card at a time onto the waste', () => {
    const state = at({ 1: card(2, 0), 2: card(3, 1) }, [card(5, 0), card(6, 0)]);
    const after = state.apply(PYRAMID_DRAW);
    expect(after.stock).toHaveLength(1);
    expect(after.wasteTop).toBe(card(6, 0));
  });

  it('gathers the waste back up, three passes in all', () => {
    const spent = at({ 1: card(2, 0), 2: card(3, 1) }, [], [card(5, 0), card(6, 0)], 1);
    expect(spent.legalMoves(0)).toContain(PYRAMID_REDEAL);
    const again = spent.apply(PYRAMID_REDEAL);
    expect(again.pass).toBe(2);
    expect(again.stock).toHaveLength(2);
    expect(again.waste).toHaveLength(0);
    // On the last pass the deck stays where it is.
    const last = at({ 1: card(2, 0), 2: card(3, 1) }, [], [card(5, 0), card(6, 0)], PYRAMID_PASSES);
    expect(last.legalMoves(0)).not.toContain(PYRAMID_REDEAL);
  });
});

describe('pyramid help and play', () => {
  it('takes a move back, and refuses moves that are not legal', () => {
    // A spare card at the top, so taking the pair does not end the game.
    const state = at({ 0: card(2, 0), 21: card(4, 1), 22: card(9, 2) });
    const after = state.apply('p21.22');
    expect(after.left).toBe(1);
    expect(after.legalMoves(0)).toContain(PYRAMID_UNDO);
    expect(after.apply(PYRAMID_UNDO).left).toBe(3);
    expect(() => state.apply('p0.21')).toThrow();
  });

  it('hints a pair off the pyramid before anything else, and a draw when there is none', () => {
    const state = at({ 1: card(4, 0), 2: card(9, 1) }, [card(3, 0)], [card(9, 3)]);
    expect(pyramidHint(state)).toBe('p1.2');
    const stuck = at({ 1: card(4, 0), 2: card(2, 1) }, [card(3, 0)]);
    expect(pyramidHint(stuck)).toBe(PYRAMID_DRAW);
  });

  it('plays a long game and replays exactly', () => {
    const bot = pyramid.createBot('medium');
    let state = pyramid.newGame({ players: 1 }, 21) as PyramidState;
    const moves: PyramidMove[] = [];
    const rng = { next: () => 0, int: () => 0, pick: <T,>(list: readonly T[]) => list[0]! };
    while (!state.result && moves.length < 200) {
      const play = bot.chooseMove(state, 0, rng);
      expect(state.legalMoves(0)).toContain(play);
      moves.push(play);
      state = state.apply(play);
    }
    expect(moves.length).toBeGreaterThan(20);
    const replayed = replay(pyramid, toMoveLog(pyramid, { players: 1 }, 21, moves)) as PyramidState;
    expect(replayed.pyramid).toEqual(state.pyramid);
    expect(replayed.waste).toEqual(state.waste);
  });
});
