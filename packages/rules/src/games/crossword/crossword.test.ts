import { describe, expect, it } from 'vitest';
import { BOT_TIERS } from '../../core/types';
import { createRng } from '../../core/rng';
import { replay, toMoveLog } from '../../core/replay';
import { CHECK, crossViewFor, crosswordGame, CrossState, newCrossword, rubOut, writeIn, type CrossMove } from './index';
import { SIDE, wordIn } from './grid';

const game = (seed: number): CrossState => newCrossword(seed);

describe('the mini crossword', () => {
  it('starts empty, with the blocks in place and a clue for every word', () => {
    const state = game(3);
    expect(state.left).toBeGreaterThan(10);
    expect(state.done).toBe(false);
    for (let r = 0; r < SIDE; r++) {
      for (let c = 0; c < SIDE; c++) {
        if (!state.blockAt(r, c)) expect(state.letterAt(r, c)).toBe('');
      }
    }
    for (const slot of state.slots) expect(state.clueFor(slot).length, wordIn(state.answer, slot)).toBeGreaterThan(2);
  });

  it('takes a letter, takes it back, and refuses a black square', () => {
    const state = game(3);
    const open = firstOpen(state);
    const after = state.apply(writeIn(open.r, open.c, 'q'));
    expect(after.letterAt(open.r, open.c)).toBe('q');
    expect(after.apply(rubOut(open.r, open.c)).letterAt(open.r, open.c)).toBe('');
    const block = firstBlock(state);
    if (block) expect(() => state.apply(writeIn(block.r, block.c, 'a'))).toThrow(/Illegal/);
    expect(() => state.apply('w55a')).toThrow(/Illegal/);
    expect(() => state.apply('nonsense')).toThrow(/Illegal/);
  });

  it('says nothing about a wrong letter until it is asked', () => {
    const state = game(3);
    const open = firstOpen(state);
    const wrong = state.answer[open.r]![open.c] === 'z' ? 'q' : 'z';
    const after = state.apply(writeIn(open.r, open.c, wrong));
    expect(after.checked).toBe(false);
    expect(after.rightAt(open.r, open.c)).toBe(false);
    expect(after.apply(CHECK).checked).toBe(true);
  });

  it('is over the moment the grid matches, and not before', () => {
    let state = game(3);
    // The right letter for every open square, worked out here rather than taken from
    // legalMoves, which lists every letter because a person may type any of them.
    const right: string[] = [];
    for (let r = 0; r < SIDE; r++) {
      for (let c = 0; c < SIDE; c++) if (!state.blockAt(r, c)) right.push(writeIn(r, c, state.answer[r]![c]!));
    }
    for (const move of right.slice(0, right.length - 1)) state = state.apply(move);
    expect(state.result).toBe(null);
    state = state.apply(right[right.length - 1]!);
    expect(state.done).toBe(true);
    expect(state.result?.winners).toEqual([0]);
    expect(() => state.apply(right[0]!)).toThrow(/over/);
  });

  it('never shows the answer to a seat', () => {
    const state = game(3);
    const view = crossViewFor(state);
    expect(view.blocks.join('')).not.toMatch(/[a-y]/);
    expect(view.blocks.join('|')).toMatch(/^[.#|]+$/);
    expect(view.clues).toHaveLength(state.slots.length);
    expect(view.filled.join('')).not.toMatch(/[a-z]/);
  });

  it('is filled in by every tier, and replays exactly', { timeout: 120_000 }, () => {
    for (const tier of BOT_TIERS) {
      const bot = crosswordGame.createBot(tier);
      let state = crosswordGame.newGame({ players: 1 }, 12) as CrossState;
      const moves: CrossMove[] = [];
      while (!state.result) {
        const move = bot.chooseMove(state, 0, createRng(moves.length + 1));
        moves.push(move);
        state = state.apply(move);
      }
      expect(state.done, tier).toBe(true);
      const replayed = replay(crosswordGame, toMoveLog(crosswordGame, { players: 1 }, 12, moves)) as CrossState;
      expect(replayed.filled).toEqual(state.filled);
    }
  });
});

function firstOpen(state: CrossState): { r: number; c: number } {
  for (let r = 0; r < SIDE; r++) for (let c = 0; c < SIDE; c++) if (!state.blockAt(r, c)) return { r, c };
  throw new Error('no open square');
}

function firstBlock(state: CrossState): { r: number; c: number } | undefined {
  for (let r = 0; r < SIDE; r++) for (let c = 0; c < SIDE; c++) if (state.blockAt(r, c)) return { r, c };
  return undefined;
}
