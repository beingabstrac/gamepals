import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import {
  coveredBy,
  newTriPeaks,
  nextTo,
  rowOfPlace,
  TRIPEAKS_CARDS,
  TRIPEAKS_DRAW,
  TRIPEAKS_ROWS,
  TriPeaksState,
  TRIPEAKS_UNDO,
  tripeaks,
  triPeaksHint,
  type TriPeaksMove,
} from './index';

const card = (rank: number, suit: number) => suit * 13 + rank - 1;
/** A board where only the listed places hold a card, everything face up. */
const only = (cards: Record<number, number>) => Array.from({ length: TRIPEAKS_CARDS }, (_, i) => cards[i] ?? null);
const at = (cards: Record<number, number>, waste: number[], stock: number[] = []) =>
  new TriPeaksState(only(cards), Array<boolean>(TRIPEAKS_CARDS).fill(false), stock, waste, 0, 0, 0, null, null, []);

describe('tripeaks deal', () => {
  it('deals 28 cards in rows of 3, 6, 9 and 10, with one card already turned', () => {
    const state = newTriPeaks(4);
    expect(TRIPEAKS_ROWS.reduce((a, b) => a + b, 0)).toBe(TRIPEAKS_CARDS);
    expect(state.board.every((c) => c !== null)).toBe(true);
    expect(state.stock).toHaveLength(23);
    expect(state.waste).toHaveLength(1);
    const all = [...state.board, ...state.stock, ...state.waste] as number[];
    expect(new Set(all).size).toBe(52);
  });

  it('starts with only the base row face up', () => {
    const state = newTriPeaks(4);
    expect(state.down.filter(Boolean)).toHaveLength(18);
    for (let i = 18; i < TRIPEAKS_CARDS; i++) expect(state.down[i]).toBe(false);
    expect(rowOfPlace(0)).toBe(0);
    expect(rowOfPlace(9)).toBe(2);
    expect(rowOfPlace(27)).toBe(3);
  });

  it('knows which two cards sit over each place, with the peaks sharing base cards', () => {
    expect(coveredBy(0)).toEqual([3, 4]);
    expect(coveredBy(3)).toEqual([9, 10]);
    expect(coveredBy(9)).toEqual([18, 19]);
    // The last card of one peak and the first of the next lean on the same base card.
    expect(coveredBy(11)).toEqual([20, 21]);
    expect(coveredBy(12)).toEqual([21, 22]);
    expect(coveredBy(27)).toBe(null);
  });
});

describe('tripeaks taking cards', () => {
  it('takes a card one rank above or below the waste top', () => {
    const state = at({ 18: card(6, 0), 19: card(9, 1) }, [card(7, 2)]);
    expect(state.legalMoves(0)).toContain('t18');
    expect(state.legalMoves(0)).not.toContain('t19');
    const after = state.apply('t18');
    expect(after.wasteTop).toBe(card(6, 0));
    expect(after.run).toBe(1);
  });

  it('wraps the ring, so an Ace takes a King or a two', () => {
    expect(nextTo(card(1, 0), card(13, 1))).toBe(true);
    expect(nextTo(card(1, 0), card(2, 1))).toBe(true);
    expect(nextTo(card(13, 0), card(2, 1))).toBe(false);
  });

  it('will not take a card that is still covered', () => {
    const state = at({ 9: card(6, 0), 18: card(8, 1) }, [card(7, 2)]);
    expect(state.free(9)).toBe(false);
    expect(() => state.apply('t9')).toThrow();
    // Clearing what sits over it frees it.
    const open = state.apply('t18');
    expect(open.free(9)).toBe(true);
  });

  it('turns up a card as it is freed', () => {
    const board = new TriPeaksState(
      only({ 9: card(6, 0), 18: card(7, 1) }),
      Array.from({ length: TRIPEAKS_CARDS }, (_, i) => i < 18),
      [],
      [card(6, 3)],
      0,
      0,
      0,
      null,
      null,
      [],
    );
    expect(board.down[9]).toBe(true);
    expect(board.apply('t18').down[9]).toBe(false);
  });

  it('is won when the board is empty', () => {
    const state = at({ 27: card(6, 0) }, [card(7, 2)]);
    expect(state.apply('t27').result).toEqual({ winners: [0], draw: false });
  });
});

describe('tripeaks the deck and the run', () => {
  it('turns one card and ends the run', () => {
    // A queen on the base that no run can reach, so the board is not cleared along the way.
    const state = at({ 18: card(6, 0), 19: card(5, 1), 20: card(12, 3) }, [card(7, 2)], [card(10, 0), card(9, 0)]);
    const two = state.apply('t18').apply('t19');
    expect(two.run).toBe(2);
    const drawn = two.apply(TRIPEAKS_DRAW);
    expect(drawn.run).toBe(0);
    expect(drawn.best).toBe(2);
    expect(drawn.wasteTop).toBe(card(9, 0));
    expect(drawn.stock).toHaveLength(1);
  });

  it('takes a move back, and hints the card highest up the peaks', () => {
    const state = at({ 3: card(6, 0), 18: card(6, 1), 19: card(8, 2) }, [card(7, 3)]);
    expect(triPeaksHint(state)).toBe('t3');
    const after = state.apply('t18');
    expect(after.legalMoves(0)).toContain(TRIPEAKS_UNDO);
    expect(after.apply(TRIPEAKS_UNDO).left).toBe(3);
  });

  it('plays a long game and replays exactly', () => {
    const bot = tripeaks.createBot('medium');
    let state = tripeaks.newGame({ players: 1 }, 17) as TriPeaksState;
    const moves: TriPeaksMove[] = [];
    const rng = { next: () => 0, int: () => 0, pick: <T,>(list: readonly T[]) => list[0]! };
    while (!state.result && moves.length < 200) {
      const play = bot.chooseMove(state, 0, rng);
      expect(state.legalMoves(0)).toContain(play);
      moves.push(play);
      state = state.apply(play);
    }
    expect(moves.length).toBeGreaterThan(20);
    const replayed = replay(tripeaks, toMoveLog(tripeaks, { players: 1 }, 17, moves)) as TriPeaksState;
    expect(replayed.board).toEqual(state.board);
    expect(replayed.best).toBe(state.best);
  });
});
