import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { rankOf, suitOf } from '../cards';
import {
  SPIDER_DEAL,
  newSpider,
  RUNS_TO_WIN,
  spider,
  SPIDER_COLUMNS,
  SPIDER_SUITS,
  SpiderState,
  spiderHint,
  spiderMove,
  spiderMoveFrom,
  SPIDER_UNDO,
  type SpiderColumn,
  type SpiderMove,
} from './index';

const card = (rank: number, suit: number) => suit * 13 + (rank - 1);
const col = (cards: number[], down = 0): SpiderColumn => ({ cards, down });
/** Ten columns, padded with a spare card so the board is never accidentally empty. */
const board = (columns: SpiderColumn[], stock: number[] = [], done = 0) =>
  new SpiderState('two', [...columns, ...Array.from({ length: SPIDER_COLUMNS - columns.length }, () => col([card(2, 0)]))], stock, done, 0, null, null, []);

describe('spider deal', () => {
  it('deals 104 cards: ten columns of 6, 6, 6, 6, 5, 5, 5, 5, 5, 5 and 50 in the stock', () => {
    const state = newSpider(4);
    expect(state.columns.map((c) => c.cards.length)).toEqual([6, 6, 6, 6, 5, 5, 5, 5, 5, 5]);
    expect(state.stock).toHaveLength(50);
    expect(state.columns.reduce((sum, c) => sum + c.cards.length, 0) + state.stock.length).toBe(104);
    // Only the bottom card of each column is face up.
    expect(state.columns.every((c) => c.down === c.cards.length - 1)).toBe(true);
  });

  it('uses the number of suits the level asks for', () => {
    for (const [level, suits] of Object.entries(SPIDER_SUITS)) {
      const state = newSpider(9, level as keyof typeof SPIDER_SUITS);
      const used = new Set([...state.columns.flatMap((c) => c.cards), ...state.stock].map(suitOf));
      expect(used.size, level).toBe(suits);
    }
  });
});

describe('spider rules', () => {
  it('moves a run only when it is one suit, descending', () => {
    const sameSuit = board([col([card(9, 0), card(8, 0)]), col([card(10, 2)])]);
    expect(sameSuit.runLength(0)).toBe(2);
    expect(sameSuit.legalMoves(0)).toContain(`${spiderMove(0, 1)}.2`);
    // The same two ranks in different suits do not travel together: only the single card moves,
    // and it still needs a card exactly one rank higher to land on.
    const mixed = board([col([card(9, 0), card(8, 1)]), col([card(9, 2)])]);
    expect(mixed.runLength(0)).toBe(1);
    expect(mixed.legalMoves(0)).not.toContain(`${spiderMove(0, 1)}.2`);
    expect(mixed.legalMoves(0)).toContain(`${spiderMove(0, 1)}.1`);
  });

  it('lands on any suit one rank higher', () => {
    const state = board([col([card(7, 3)]), col([card(8, 1)])]);
    expect(state.legalMoves(0)).toContain(`${spiderMove(0, 1)}.1`);
    const wrongRank = board([col([card(7, 3)]), col([card(10, 1)])]);
    expect(wrongRank.legalMoves(0)).not.toContain(`${spiderMove(0, 1)}.1`);
  });

  it('turns up the card it uncovers', () => {
    const state = board([col([card(5, 0), card(9, 0)], 1), col([card(10, 2)])]);
    const after = state.apply(`${spiderMove(0, 1)}.1`);
    expect(after.columns[0]!.cards).toEqual([card(5, 0)]);
    expect(after.columns[0]!.down).toBe(0);
  });

  it('deals one card onto every column, but not while a column is empty', () => {
    const ready = board([col([card(5, 0)]), col([card(6, 0)])], [card(3, 0), card(4, 0), card(5, 1), card(6, 1), card(7, 1), card(8, 1), card(9, 1), card(10, 1), card(11, 1), card(12, 1)]);
    expect(ready.legalMoves(0)).toContain(SPIDER_DEAL);
    const dealt = ready.apply(SPIDER_DEAL);
    expect(dealt.columns.every((c) => c.cards.length >= 2)).toBe(true);
    expect(dealt.stock).toHaveLength(0);

    const empty = new SpiderState('two', [col([]), ...Array.from({ length: 9 }, () => col([card(2, 0)]))], [card(3, 0)], 0, 0, null, null, []);
    expect(empty.legalMoves(0)).not.toContain(SPIDER_DEAL);
    expect(() => empty.apply(SPIDER_DEAL)).toThrow();
  });

  it('lifts a King to Ace run of one suit off the board', () => {
    const run = Array.from({ length: 12 }, (_, i) => card(13 - i, 1)); // King down to Two, hearts.
    const state = board([col([...run]), col([card(1, 1)])]);
    const after = state.apply(`${spiderMove(1, 0)}.1`);
    expect(after.columns[0]!.cards).toEqual([]);
    expect(after.done).toBe(1);
    expect(after.last).toMatchObject({ kind: 'run', completed: 1 });
  });

  it('is won when all eight runs are gone', () => {
    const run = Array.from({ length: 12 }, (_, i) => card(13 - i, 1));
    const state = board([col([...run]), col([card(1, 1)])], [], RUNS_TO_WIN - 1);
    const won = state.apply(`${spiderMove(1, 0)}.1`);
    expect(won.done).toBe(RUNS_TO_WIN);
    expect(won.result).toEqual({ winners: [0], draw: false });
  });

  it('takes moves back and rejects illegal ones', () => {
    const state = board([col([card(9, 0)]), col([card(10, 2)])]);
    const after = state.apply(`${spiderMove(0, 1)}.1`);
    expect(after.legalMoves(0)).toContain(SPIDER_UNDO);
    expect(after.apply(SPIDER_UNDO).columns[0]!.cards).toEqual([card(9, 0)]);
    expect(() => state.apply(`${spiderMove(0, 1)}.5`)).toThrow();
    expect(() => state.apply('nonsense')).toThrow();
  });
});

describe('spider play', () => {
  it('plays a long game and replays exactly', () => {
    const bot = spider.createBot('medium');
    let state = spider.newGame({ players: 1, variant: 'one' }, 11) as SpiderState;
    const moves: SpiderMove[] = [];
    while (!state.result && moves.length < 150) {
      const play = bot.chooseMove(state, 0, { next: () => 0, int: () => 0, pick: (list) => list[0]! });
      expect(state.legalMoves(0)).toContain(play);
      moves.push(play);
      state = state.apply(play);
    }
    expect(moves.length).toBeGreaterThan(20);
    const replayed = replay(spider, toMoveLog(spider, { players: 1, variant: 'one' }, 11, moves)) as SpiderState;
    expect(replayed.columns.map((c) => c.cards.length)).toEqual(state.columns.map((c) => c.cards.length));
    // Cards are conserved: on the board, in the stock, or lifted off as finished runs.
    const onBoard = replayed.columns.reduce((sum, c) => sum + c.cards.length, 0);
    expect(onBoard + replayed.stock.length + replayed.done * 13).toBe(104);
    expect(rankOf(card(13, 0))).toBe(13);
  });
});

describe('spider help', () => {
  it('gives every card its own number, even when eight of them share a face', () => {
    const state = newSpider(3, 'one');
    const all = [...state.columns.flatMap((c) => c.cards), ...state.stock];
    expect(all.length).toBe(104);
    expect(new Set(all).size).toBe(104);
    // One suit means every card reads as the same suit.
    expect(new Set(all.map(suitOf)).size).toBe(1);
  });

  it('sends a tapped run to the same suit before anywhere else', () => {
    const board = [
      col([card(7, 0)]),
      col([card(8, 1)]),
      col([card(8, 0)]),
      col([]),
      ...Array.from({ length: 6 }, () => col([card(2, 0)])),
    ];
    const state = new SpiderState('two', board, [], 0, 0, null, null);
    expect(spiderMoveFrom(state, 0, 1)).toBe('m0.2.1');
  });

  it('hints a deal when nothing on the board is worth moving', () => {
    const board = Array.from({ length: SPIDER_COLUMNS }, () => col([card(5, 0)]));
    const state = new SpiderState('two', board, [card(3, 0)], 0, 0, null, null);
    expect(spiderHint(state)).toBe(SPIDER_DEAL);
  });
});
