import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import {
  countSolutions,
  eraseMove,
  generateSudoku,
  HINT_MOVE,
  logicLevel,
  newSudoku,
  noteMove,
  PEERS,
  placeMove,
  sudoku,
  SUDOKU_HINTS,
  SUDOKU_LEVELS,
  UNDO_MOVE,
  UNITS,
  type SudokuMove,
  type SudokuState,
} from './index';

const isValidSolution = (grid: readonly number[]) =>
  UNITS.every((unit) => [...unit.map((c) => grid[c])].sort().join('') === '123456789');

const firstEmpty = (state: SudokuState) => state.values.findIndex((v) => v === 0);

describe('sudoku puzzles', () => {
  it('counts answers', () => {
    const { solution } = generateSudoku(1, 'easy');
    expect(countSolutions(solution)).toBe(1);
    expect(countSolutions(Array(81).fill(0))).toBe(2);
    const broken = solution.slice();
    broken[0] = broken[1]!;
    expect(countSolutions(broken)).toBe(0);
  });

  for (const level of SUDOKU_LEVELS) {
    it(`${level} puzzles have exactly one answer and match their solution`, () => {
      for (const seed of [3, 17]) {
        const { givens, solution } = generateSudoku(seed, level);
        expect(isValidSolution(solution)).toBe(true);
        expect(countSolutions(givens)).toBe(1);
        givens.forEach((v, i) => {
          if (v) expect(v).toBe(solution[i]);
        });
        // Mirrored like printed puzzles.
        givens.forEach((v, i) => expect(v === 0).toBe(givens[80 - i] === 0));
      }
    });
  }

  it('the same seed makes the same puzzle', () => {
    expect(generateSudoku(99, 'medium')).toEqual(generateSudoku(99, 'medium'));
  });

  it('levels get harder: fewer givens and harder tricks', () => {
    const avg = (level: (typeof SUDOKU_LEVELS)[number]) => {
      let givens = 0;
      let rating = 0;
      for (let seed = 0; seed < 4; seed++) {
        const p = generateSudoku(seed, level);
        givens += p.givens.filter(Boolean).length;
        rating += p.rating;
      }
      return { givens: givens / 4, rating: rating / 4 };
    };
    const [easy, medium, hard, expert] = SUDOKU_LEVELS.map(avg) as [ReturnType<typeof avg>, ReturnType<typeof avg>, ReturnType<typeof avg>, ReturnType<typeof avg>];
    expect(easy.givens).toBeGreaterThan(medium.givens);
    expect(medium.givens).toBeGreaterThan(expert.givens);
    expect(easy.rating).toBeLessThanOrEqual(2);
    expect(medium.rating).toBeLessThanOrEqual(2);
    expect(hard.rating).toBeGreaterThan(medium.rating);
    expect(expert.rating).toBeGreaterThanOrEqual(hard.rating);
  });

  it('easy and medium puzzles are solvable with simple tricks only', () => {
    for (const seed of [5, 6]) {
      expect(logicLevel(generateSudoku(seed, 'easy').givens, 2)).toBeLessThanOrEqual(2);
      expect(logicLevel(generateSudoku(seed, 'medium').givens, 2)).toBeLessThanOrEqual(2);
    }
  });
});

describe('sudoku play', () => {
  it('given numbers can never change', () => {
    const state = newSudoku(4, 'easy');
    const given = state.givens.findIndex(Boolean);
    expect(state.legalMoves(0).some((m) => m.startsWith(`p${given}:`) || m === eraseMove(given))).toBe(false);
    expect(() => state.apply(placeMove(given, 1))).toThrow();
  });

  it('filling in the whole answer wins', () => {
    let state = newSudoku(8, 'medium');
    for (let i = 0; i < 81; i++) if (!state.values[i]) state = state.apply(placeMove(i, state.solution[i]!));
    expect(state.result).toEqual({ winners: [0], draw: false });
    expect(state.legalMoves(0)).toEqual([]);
  });

  it('shows repeats as conflicts', () => {
    const state = newSudoku(2, 'easy');
    const cell = firstEmpty(state);
    const peerValue = PEERS[cell]!.map((p) => state.values[p]).find(Boolean)!;
    const after = state.apply(placeMove(cell, peerValue));
    expect(after.conflicts().has(cell)).toBe(true);
  });

  it('notes toggle, and a placed number clears that note from its row, column and box', () => {
    const state = newSudoku(5, 'easy');
    const a = firstEmpty(state);
    const b = PEERS[a]!.find((p) => !state.values[p])!;
    const noted = state.apply(noteMove(b, 7)).apply(noteMove(b, 3));
    expect(noted.notes[b]).toBe((1 << 7) | (1 << 3));
    const placed = noted.apply(placeMove(a, 7));
    expect(placed.notes[b]).toBe(1 << 3);
    expect(placed.apply(noteMove(b, 3)).notes[b]).toBe(0);
  });

  it('undo takes back the last move but hints stay used', () => {
    const state = newSudoku(6, 'easy');
    const cell = firstEmpty(state);
    const placed = state.apply(placeMove(cell, 5));
    expect(placed.apply(UNDO_MOVE).values).toEqual(state.values);
    const hinted = state.apply(HINT_MOVE);
    const undone = hinted.apply(UNDO_MOVE);
    expect(undone.values).toEqual(state.values);
    expect(undone.hintsLeft).toBe(SUDOKU_HINTS - 1);
    expect(state.legalMoves(0)).not.toContain(UNDO_MOVE);
  });

  it('hints are always right, fix mistakes first, and run out after three', () => {
    let state = newSudoku(10, 'hard');
    const cell = firstEmpty(state);
    const wrong = state.solution[cell]! % 9 + 1;
    state = state.apply(placeMove(cell, wrong));
    state = state.apply(HINT_MOVE);
    expect(state.lastHint?.cell).toBe(cell);
    expect(state.values[cell]).toBe(state.solution[cell]);
    for (let i = 1; i < SUDOKU_HINTS; i++) {
      state = state.apply(HINT_MOVE);
      expect(state.values[state.lastHint!.cell]).toBe(state.solution[state.lastHint!.cell]);
      expect(state.lastHint!.reason).not.toContain('—');
    }
    expect(state.legalMoves(0)).not.toContain(HINT_MOVE);
  });

  it('a bot solves every level with legal moves, and games replay exactly', () => {
    for (const level of SUDOKU_LEVELS) {
      const bot = sudoku.createBot('expert');
      const rng = createRng(1);
      let state = sudoku.newGame({ players: 1, variant: level }, 21) as SudokuState;
      const moves: SudokuMove[] = [];
      while (!state.result) {
        const move = bot.chooseMove(state, 0, rng);
        expect(state.legalMoves(0)).toContain(move);
        moves.push(move);
        state = state.apply(move);
      }
      const replayed = replay(sudoku, toMoveLog(sudoku, { players: 1, variant: level }, 21, moves)) as SudokuState;
      expect(replayed.values).toEqual(state.values);
      expect(replayed.result).toEqual(state.result);
    }
  });
});
