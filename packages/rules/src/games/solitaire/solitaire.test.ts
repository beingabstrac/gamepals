import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import { rankOf, suitOf } from '../cards';
import {
  bestMoveFrom,
  DRAW_MOVE,
  newSolitaire,
  solitaire,
  SolitaireState,
  suggestMove,
  UNDO_CARD_MOVE,
  type Column,
  type SolitaireMove,
} from './index';

/** Card from rank (1–13) and suit (0 ♠, 1 ♥, 2 ♦, 3 ♣). */
const card = (rank: number, suit: number) => suit * 13 + rank - 1;

function table(tableau: Column[], extra: Partial<{ stock: number[]; waste: number[]; foundations: number[][] }> = {}): SolitaireState {
  const cols = [...tableau, ...Array.from({ length: 7 - tableau.length }, () => ({ cards: [], down: 0 }))];
  return new SolitaireState(1, extra.stock ?? [], extra.waste ?? [], extra.foundations ?? [[], [], [], []], cols, 0, 0, null, null, null);
}

describe('solitaire deal', () => {
  it('deals 7 columns of 1 to 7 cards with only the top card up, and 24 in the stock', () => {
    const state = newSolitaire(5, 1);
    state.tableau.forEach((column, c) => {
      expect(column.cards).toHaveLength(c + 1);
      expect(column.down).toBe(c);
    });
    expect(state.stock).toHaveLength(24);
    const all = [...state.stock, ...state.tableau.flatMap((c) => c.cards)].sort((a, b) => a - b);
    expect(all).toEqual(Array.from({ length: 52 }, (_, i) => i));
  });

  it('the same seed deals the same cards', () => {
    expect(newSolitaire(9, 3).tableau).toEqual(newSolitaire(9, 3).tableau);
  });
});

describe('solitaire rules', () => {
  it('builds down in alternating colors only', () => {
    const redSix = card(6, 1);
    const state = table([
      { cards: [card(7, 0)], down: 0 },
      { cards: [redSix], down: 0 },
      { cards: [card(6, 3)], down: 0 },
      { cards: [card(7, 2)], down: 0 },
    ]);
    expect(state.legalMoves(0)).toContain('t1:0>t0');
    expect(state.legalMoves(0)).not.toContain('t2:0>t0');
    expect(state.legalMoves(0)).not.toContain('t1:0>t3');
    expect(state.legalMoves(0)).toContain('t2:0>t3');
  });

  it('only a King fills an empty column, and moves a whole face-up run', () => {
    const state = table([
      { cards: [card(2, 0), card(13, 1), card(12, 0)], down: 1 },
      { cards: [card(12, 3)], down: 0 },
    ]);
    expect(state.legalMoves(0)).toContain('t0:1>t2');
    expect(state.legalMoves(0)).not.toContain('t1:0>t2');
    const after = state.apply('t0:1>t2');
    expect(after.tableau[2]!.cards).toEqual([card(13, 1), card(12, 0)]);
    // The card left behind turns face up and scores.
    expect(after.tableau[0]!.down).toBe(0);
    expect(after.flipped).toBe(card(2, 0));
    expect(after.score).toBe(5);
  });

  it('builds foundations by suit from Ace to King', () => {
    const state = table([{ cards: [card(2, 1)], down: 0 }], { waste: [card(1, 1)] });
    expect(state.legalMoves(0)).not.toContain('t0:0>f1');
    const ace = state.apply('w>f1');
    expect(ace.score).toBe(10);
    expect(ace.apply('t0:0>f1').foundations[1]).toEqual([card(1, 1), card(2, 1)]);
  });

  it('draws one or three, then turns the waste back over', () => {
    const one = newSolitaire(3, 1).apply(DRAW_MOVE);
    expect(one.waste).toHaveLength(1);
    expect(one.stock).toHaveLength(23);
    let three = newSolitaire(3, 3);
    const topThree = three.stock.slice(-3).reverse();
    three = three.apply(DRAW_MOVE);
    expect(three.waste).toEqual(topThree);
    for (let i = 0; i < 7; i++) three = three.apply(DRAW_MOVE);
    expect(three.stock).toHaveLength(0);
    const recycled = three.apply(DRAW_MOVE);
    expect(recycled.waste).toHaveLength(0);
    expect(recycled.stock).toEqual(newSolitaire(3, 3).stock);
  });

  it('undo puts everything back exactly', () => {
    const state = newSolitaire(11, 1).apply(DRAW_MOVE);
    const after = state.apply(DRAW_MOVE);
    expect(after.apply(UNDO_CARD_MOVE)).toBe(state);
  });

  it('rejects illegal moves', () => {
    const state = newSolitaire(2, 1);
    expect(() => state.apply('t6:0>f0')).toThrow();
    expect(() => state.apply(UNDO_CARD_MOVE)).toThrow();
  });

  it('tap sends a card to the foundation before a column', () => {
    const state = table([{ cards: [card(2, 0)], down: 0 }], { waste: [card(1, 1)], foundations: [[card(1, 0)], [], [], []] });
    expect(bestMoveFrom(state, 't0:0')).toBe('t0:0>f0');
    expect(bestMoveFrom(state, 'w')).toBe('w>f1');
  });

  it('winning moves every card to the foundations', () => {
    const foundations = [0, 1, 2, 3].map((s) => Array.from({ length: 12 }, (_, r) => card(r + 1, s)));
    const state = table(
      [0, 1, 2, 3].map((s) => ({ cards: [card(13, s)], down: 0 })),
      { foundations },
    );
    expect(state.canFinish()).toBe(true);
    let s = state;
    while (!s.result) s = s.apply(suggestMove(s)!);
    expect(s.result).toEqual({ winners: [0], draw: false });
    expect(s.foundations.every((pile) => pile.length === 13 && pile.every((c, i) => rankOf(c) === i + 1 && suitOf(c) === suitOf(pile[0]!)))).toBe(true);
  });
});

describe('solitaire bots', () => {
  function play(tier: 'easy' | 'expert', seed: number, draw: 'draw1' | 'draw3') {
    const bot = solitaire.createBot(tier);
    const rng = createRng(seed);
    let state = solitaire.newGame({ players: 1, variant: draw }, seed) as SolitaireState;
    const moves: SolitaireMove[] = [];
    for (let i = 0; i < 1500 && !state.result; i++) {
      const move = bot.chooseMove(state, 0, rng);
      expect(state.legalMoves(0)).toContain(move);
      moves.push(move);
      state = state.apply(move);
    }
    return { state, moves };
  }

  it('play with legal moves only, and games replay exactly', () => {
    const { state, moves } = play('expert', 4, 'draw3');
    const replayed = replay(solitaire, toMoveLog(solitaire, { players: 1, variant: 'draw3' }, 4, moves)) as SolitaireState;
    expect(replayed.foundations).toEqual(state.foundations);
    expect(replayed.score).toBe(state.score);
  });

  it('following the hints wins a good share of Draw 1 deals', () => {
    // Good human players win roughly half of Draw 1 deals; the hint logic should do about as well.
    let wins = 0;
    for (let seed = 0; seed < 20; seed++) if (play('expert', seed, 'draw1').state.result) wins++;
    expect(wins).toBeGreaterThan(8);
  });

  it('hints stop suggesting a draw once a full pass through the deck changed nothing', () => {
    let state = newSolitaire(1, 1);
    for (let i = 0; i < 60; i++) state = state.apply(DRAW_MOVE);
    const move = suggestMove(state);
    expect(move).not.toBe(DRAW_MOVE);
  });
});
