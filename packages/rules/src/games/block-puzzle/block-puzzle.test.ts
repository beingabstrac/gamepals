import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { BLOCK_CELLS, BLOCK_SHAPES, blockPuzzle, BlockState, dealHand, newBlockPuzzle } from './index';

const withBoard = (filled: number[], hand: (number | null)[]) => {
  const board = Array<number>(BLOCK_CELLS).fill(0);
  for (const c of filled) board[c] = 1;
  return new BlockState(1, board, hand, 1, 0, 0, null, null);
};

describe('block puzzle', () => {
  it('shapes start at their top-left and never repeat a cell', () => {
    for (const shape of BLOCK_SHAPES) {
      expect(new Set(shape.map(([x, y]) => `${x},${y}`)).size).toBe(shape.length);
      expect(Math.min(...shape.map(([x]) => x))).toBe(0);
      expect(Math.min(...shape.map(([, y]) => y))).toBe(0);
    }
  });

  it('a piece fits only on empty cells inside the grid', () => {
    const s = withBoard([1], [3, null, null]);
    expect(s.fits(3, 0)).toBe(false);
    expect(s.fits(3, 2)).toBe(true);
    expect(s.fits(3, 6)).toBe(false);
  });

  it('a full row clears, a full column clears, and both at once count once each cell', () => {
    // Row 0 has seven filled; a single finishes it.
    const row = withBoard([0, 1, 2, 3, 4, 5, 6], [0, 0, 0]).apply('m0-7');
    expect(row.board.slice(0, 8)).toEqual(Array(8).fill(0));
    expect(row.last?.lines).toBe(1);
    // Row 0 missing cell 0 and column 0 missing cell 0: one single clears both.
    const cross = withBoard([1, 2, 3, 4, 5, 6, 7, 8, 16, 24, 32, 40, 48, 56], [0, 0, 0]).apply('m0-0');
    expect(cross.last?.lines).toBe(2);
    expect(cross.board.every((c) => c === 0)).toBe(true);
  });

  it('three placed deals three more', () => {
    let s = newBlockPuzzle(4);
    for (let k = 0; k < 3; k++) s = s.apply(s.legalMoves(0).find((m) => m.startsWith(`m${k}-`))!);
    expect(s.hand.every((p) => p !== null)).toBe(true);
    expect(s.hand).toEqual(dealHand(s.seed, 1));
  });

  it('the game ends when nothing in hand fits', () => {
    // A checkerboard: no line is full, and no 3 by 3 gap anywhere, holding a single and the big square.
    const filled = Array.from({ length: BLOCK_CELLS }, (_, i) => i).filter((i) => ((i % 8) + Math.floor(i / 8)) % 2 === 0);
    const s = withBoard(filled, [0, 24, null]);
    const end = s.apply('m0-1');
    expect(end.last?.lines).toBe(0);
    expect(end.result).toEqual({ winners: [], draw: false });
  });

  it('test play goes on a long time, and the same seed deals the same pieces', { timeout: 60_000 }, () => {
    const bot = blockPuzzle.createBot('medium');
    const rng = createRng(2);
    let s = newBlockPuzzle(2) as BlockState;
    let moves = 0;
    while (!s.result && moves < 300) {
      s = s.apply(bot.chooseMove(s, 0, rng)) as BlockState;
      moves++;
    }
    expect(moves).toBeGreaterThan(30);
    expect(newBlockPuzzle(5)).toEqual(newBlockPuzzle(5));
  });
});

/** Invariant: the board only ever holds what was placed less what was cleared, and scores only go up. */
describe('block puzzle invariants', () => {
  it('keeps the count', () => {
    for (let seed = 0; seed < 15; seed++) {
      const rng = createRng(seed);
      let s = newBlockPuzzle(seed);
      while (!s.result) {
        const before = s.board.filter(Boolean).length;
        const move = rng.pick(s.legalMoves(0));
        const k = Number(move.slice(1).split('-')[0]);
        const size = BLOCK_SHAPES[s.hand[k]!]!.length;
        const score = s.score;
        s = s.apply(move);
        expect(s.board.filter(Boolean).length).toBe(before + size - s.last!.cleared.length);
        expect(s.score).toBeGreaterThan(score);
      }
    }
  });
});
