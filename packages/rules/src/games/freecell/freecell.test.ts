import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { rankOf, suitOf } from '../cards';
import {
  freecell,
  FREECELL_CELLS,
  FREECELL_COLUMNS,
  freeCellHint,
  freeCellMoveFrom,
  freeCellPlay,
  FreeCellState,
  FREECELL_UNDO,
  newFreeCell,
  type FreeCellMove,
} from './index';

/** A position from columns, free cells and foundations, for testing one rule at a time. */
const at = (columns: number[][], cells: (number | null)[] = [null, null, null, null], foundations = [0, 0, 0, 0]) =>
  new FreeCellState(columns, cells, foundations, 0, null, null, []);

/** Card number from rank and suit: suits are 0 spades, 1 hearts, 2 diamonds, 3 clubs. */
const card = (rank: number, suit: number) => suit * 13 + (rank - 1);

describe('freecell deal', () => {
  it('deals all 52 cards into 8 columns of 7, 7, 7, 7, 6, 6, 6, 6', () => {
    const state = newFreeCell(7);
    expect(state.columns).toHaveLength(FREECELL_COLUMNS);
    expect(state.columns.map((c) => c.length)).toEqual([7, 7, 7, 7, 6, 6, 6, 6]);
    expect(state.columns.flat()).toHaveLength(52);
    expect(new Set(state.columns.flat()).size).toBe(52);
    expect(state.cells).toEqual(Array<number | null>(FREECELL_CELLS).fill(null));
    expect(state.foundations).toEqual([0, 0, 0, 0]);
  });
});

describe('freecell rules', () => {
  it('stacks down in rank and alternating colour', () => {
    // Red 7 of hearts onto black 8 of spades is fine; onto the red 8 of diamonds is not.
    const state = at([[card(8, 0)], [card(8, 2)], [card(7, 1)], [], [], [], [], []]);
    expect(state.legalMoves(0)).toContain(freeCellPlay('t2', 't0'));
    expect(state.legalMoves(0)).not.toContain(freeCellPlay('t2', 't1'));
  });

  it('puts one card in a free cell and takes it back out', () => {
    const state = at([[card(5, 0)], [], [], [], [], [], [], []]);
    const parked = state.apply(freeCellPlay('t0', 'f0'));
    expect(parked.cells[0]).toBe(card(5, 0));
    expect(parked.columns[0]).toEqual([]);
    // That cell is full now, so nothing else may go in it.
    const second = at([[card(5, 0)], [card(6, 1)], [], [], [], [], [], []], [card(9, 3), null, null, null]);
    expect(second.legalMoves(0)).not.toContain(freeCellPlay('t0', 'f0'));
    expect(second.legalMoves(0)).toContain(freeCellPlay('t0', 'f1'));
  });

  it('sends cards home in suit order, starting with the Ace', () => {
    const state = at([[card(1, 0)], [card(2, 0)], [], [], [], [], [], []]);
    expect(state.legalMoves(0)).toContain(freeCellPlay('t0', 'h0'));
    // The two cannot go home before the Ace.
    expect(state.legalMoves(0)).not.toContain(freeCellPlay('t1', 'h0'));
    const ace = state.apply(freeCellPlay('t0', 'h0'));
    expect(ace.foundations[0]).toBe(1);
    expect(ace.legalMoves(0)).toContain(freeCellPlay('t1', 'h0'));
    // A spade never goes onto the hearts foundation.
    expect(ace.legalMoves(0)).not.toContain(freeCellPlay('t1', 'h1'));
  });

  it('moves a run only as far as the free cells allow', () => {
    // A four-card run with every free cell open and no empty column: (4 + 1) = 5 allowed.
    const run = [card(9, 0), card(8, 1), card(7, 0), card(6, 1)];
    const roomy = at([run, [card(10, 2)], [card(2, 0)], [card(3, 0)], [card(4, 0)], [card(5, 0)], [card(6, 0)], [card(7, 0)]]);
    expect(roomy.runLength(0)).toBe(4);
    expect(roomy.maxMove(false)).toBe(5);
    expect(roomy.legalMoves(0)).toContain(`${freeCellPlay('t0', 't1')}.4`);
    // With three cells full only two cards may travel, so the four-card run cannot.
    const tight = at(
      [run, [card(10, 2)], [card(2, 0)], [card(3, 0)], [card(4, 0)], [card(5, 0)], [card(6, 0)], [card(7, 0)]],
      [card(13, 0), card(13, 1), card(13, 2), null],
    );
    expect(tight.maxMove(false)).toBe(2);
    expect(tight.legalMoves(0)).not.toContain(`${freeCellPlay('t0', 't1')}.4`);
    expect(() => tight.apply(`${freeCellPlay('t0', 't1')}.4`)).toThrow();
  });

  it('counts empty columns, and halves the run onto an empty one', () => {
    const run = [card(9, 0), card(8, 1), card(7, 0), card(6, 1)];
    const state = at([run, [], [], [card(3, 0)], [card(4, 0)], [card(5, 0)], [card(6, 0)], [card(7, 0)]]);
    // Two empty columns, four cells: (4 + 1) x 2^2 = 20, but onto an empty column only half.
    expect(state.maxMove(false)).toBe(20);
    expect(state.maxMove(true)).toBe(10);
  });

  it('is won when every card is home', () => {
    const state = at([[card(13, 0)], [], [], [], [], [], [], []], [null, null, null, null], [12, 13, 13, 13]);
    const won = state.apply(freeCellPlay('t0', 'h0'));
    expect(won.result).toEqual({ winners: [0], draw: false });
    expect(won.legalMoves(0)).toEqual([]);
  });

  it('takes moves back, one at a time', () => {
    const start = newFreeCell(3);
    const first = start.legalMoves(0).find((m) => m !== FREECELL_UNDO)!;
    const after = start.apply(first);
    expect(after.moves).toBe(1);
    expect(after.legalMoves(0)).toContain(FREECELL_UNDO);
    const back = after.apply(FREECELL_UNDO);
    expect(back.columns).toEqual(start.columns);
    expect(back.cells).toEqual(start.cells);
    // Nothing to undo at the start of the game.
    expect(start.legalMoves(0)).not.toContain(FREECELL_UNDO);
  });

  it('rejects moves that are not legal', () => {
    const state = at([[card(5, 0)], [card(5, 1)], [], [], [], [], [], []]);
    expect(() => state.apply(freeCellPlay('t0', 't1'))).toThrow();
    expect(() => state.apply('nonsense')).toThrow();
  });
});

describe('freecell play', () => {
  it('plays a long game and replays exactly', () => {
    const bot = freecell.createBot('medium');
    let state = freecell.newGame({ players: 1 }, 5) as FreeCellState;
    const moves: FreeCellMove[] = [];
    while (!state.result && moves.length < 120) {
      const play = bot.chooseMove(state, 0, { next: () => 0, int: () => 0, pick: (list) => list[0]! });
      expect(state.legalMoves(0)).toContain(play);
      moves.push(play);
      state = state.apply(play);
    }
    expect(moves.length).toBeGreaterThan(20);
    const replayed = replay(freecell, toMoveLog(freecell, { players: 1 }, 5, moves)) as FreeCellState;
    expect(replayed.columns).toEqual(state.columns);
    expect(replayed.foundations).toEqual(state.foundations);
    // Cards are conserved: everything is in a column, a cell or home.
    const inPlay = replayed.columns.flat().length + replayed.cells.filter((c) => c !== null).length;
    const home = replayed.foundations.reduce((sum, rank) => sum + rank, 0);
    expect(inPlay + home).toBe(52);
    expect(suitOf(card(1, 2))).toBe(2);
    expect(rankOf(card(11, 0))).toBe(11);
  });
});

describe('freecell help', () => {
  it('sends a tapped card home before it puts it anywhere else', () => {
    const state = at([[card(1, 0)], [card(2, 1)], [], [], [], [], [], []]);
    expect(freeCellMoveFrom(state, 't0')).toBe(freeCellPlay('t0', 'h0'));
  });

  it('puts a tapped card on a column that takes it before an empty column or a cell', () => {
    const state = at([[card(9, 0)], [card(10, 1)], [], [], [], [], [], []]);
    expect(freeCellMoveFrom(state, 't0')).toBe(freeCellPlay('t0', 't1'));
  });

  it('hints the move home, and stops hinting when only a cell is left', () => {
    expect(freeCellHint(at([[card(1, 0)], [card(10, 1)], [], [], [], [], [], []]))).toBe(freeCellPlay('t0', 'h0'));
    // All one colour, so nothing stacks and nothing is home yet: parking a card in a cell is not worth suggesting.
    const black = [13, 12, 11, 10, 9, 8, 7, 6].map((rank) => [card(rank, 0)]);
    const stuck = at(black);
    expect(freeCellHint(stuck)).toBe(null);
  });
});
