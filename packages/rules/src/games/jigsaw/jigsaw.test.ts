import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import { jigsaw, JIGSAW_LEVELS, JIGSAW_PICTURES, JIGSAW_SIZES, JigsawState, newJigsaw, placePieceMove } from './index';

describe('jigsaw', () => {
  it('starts with every piece in the tray, and finishes exactly when the last goes in', () => {
    let state = newJigsaw(3, 'easy');
    expect(state.pieces).toBe(12);
    expect(state.placed.every((done) => !done)).toBe(true);
    expect([...state.trayOrder].sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, i) => i));
    for (let piece = 0; piece < 11; piece++) {
      state = state.apply(placePieceMove(piece));
      expect(state.result).toBeNull();
      expect(state.last).toBe(piece);
    }
    expect(state.left).toBe(1);
    state = state.apply(placePieceMove(11));
    expect(state.result).toEqual({ winners: [0], draw: false });
  });

  it('refuses a piece twice, a piece that is not there, and a finished puzzle', () => {
    const state = newJigsaw(1, 'easy').apply(placePieceMove(4));
    expect(() => state.apply(placePieceMove(4))).toThrow();
    expect(() => state.apply(placePieceMove(12))).toThrow();
    expect(() => state.apply('x')).toThrow();
    let done = newJigsaw(1, 'easy');
    for (let piece = 0; piece < done.pieces; piece++) done = done.apply(placePieceMove(piece));
    expect(() => done.apply(placePieceMove(0))).toThrow();
    expect(done.legalMoves(0)).toEqual([]);
  });

  it('lists exactly what apply accepts', () => {
    const state = newJigsaw(5, 'medium').apply(placePieceMove(2)).apply(placePieceMove(7));
    const listed = new Set(state.legalMoves(0));
    for (let piece = 0; piece < state.pieces + 2; piece++) {
      const move = placePieceMove(piece);
      if (listed.has(move)) expect(() => state.apply(move)).not.toThrow();
      else expect(() => state.apply(move)).toThrow();
    }
    expect(state.legalMoves(1)).toEqual([]);
  });

  it('gives every join a knob on one side and a hole on the other, and flat outsides', () => {
    for (const level of JIGSAW_LEVELS) {
      for (let seed = 0; seed < 30; seed++) {
        const state = newJigsaw(seed, level);
        const { cols, rows } = JIGSAW_SIZES[level];
        expect(state.picture).toBeGreaterThanOrEqual(0);
        expect(state.picture).toBeLessThan(JIGSAW_PICTURES);
        for (let piece = 0; piece < state.pieces; piece++) {
          const col = piece % cols;
          const row = Math.floor(piece / cols);
          const s = state.sides(piece);
          const where = `${level} seed ${seed} piece ${piece}`;
          expect(s.top === 0, `${where} top`).toBe(row === 0);
          expect(s.left === 0, `${where} left`).toBe(col === 0);
          expect(s.right === 0, `${where} right`).toBe(col === cols - 1);
          expect(s.bottom === 0, `${where} bottom`).toBe(row === rows - 1);
          if (col < cols - 1) expect(state.sides(piece + 1).left, `${where} right join`).toBe(-s.right);
          if (row < rows - 1) expect(state.sides(piece + cols).top, `${where} bottom join`).toBe(-s.bottom);
          expect(state.isEdge(piece)).toBe(row === 0 || col === 0 || row === rows - 1 || col === cols - 1);
        }
      }
    }
  });

  it('the same seed is the same puzzle', () => {
    const a = newJigsaw(42, 'hard');
    const b = newJigsaw(42, 'hard');
    expect([a.picture, a.rightJoins, a.bottomJoins, a.trayOrder]).toEqual([b.picture, b.rightJoins, b.bottomJoins, b.trayOrder]);
    const pictures = new Set(Array.from({ length: 60 }, (_, seed) => newJigsaw(seed, 'easy').picture));
    expect(pictures.size).toBe(JIGSAW_PICTURES);
  });

  it('autoplay does the edges first, finishes, and a game replays', () => {
    const bot = jigsaw.createBot('medium');
    const rng = createRng(1);
    let state = jigsaw.newGame({ players: 1, variant: 'hard' }, 8) as JigsawState;
    const order: number[] = [];
    while (!state.result) {
      const move = bot.chooseMove(state, 0, rng);
      order.push(Number(move.slice(1)));
      state = state.apply(move);
    }
    const edges = order.filter((piece) => state.isEdge(piece)).length;
    expect(order.slice(0, edges).every((piece) => state.isEdge(piece))).toBe(true);
    const again = replay(jigsaw, toMoveLog(jigsaw, { players: 1, variant: 'hard' }, 8, order.map(placePieceMove)));
    expect(again.result).toEqual(state.result);
  });
});

/** Invariant: every piece is in exactly one place, the tray or the board, and a placed piece stays placed. */
describe('jigsaw invariants', () => {
  it('never loses a piece or takes one back out', () => {
    for (const level of JIGSAW_LEVELS) {
      for (let seed = 0; seed < 10; seed++) {
        const rng = createRng(seed + 9);
        let state = newJigsaw(seed, level);
        while (!state.result) {
          const before = [...state.placed];
          state = state.apply(rng.pick(state.legalMoves(0)));
          before.forEach((done, piece) => {
            if (done) expect(state.placed[piece], `${level} seed ${seed} piece ${piece}`).toBe(true);
          });
          expect(state.placed.filter(Boolean).length + state.left).toBe(state.pieces);
        }
      }
    }
  });
});
