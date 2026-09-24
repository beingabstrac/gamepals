import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { hangman, HANG_LEVELS, HangState, hangWords, newHangman } from './index';

describe('hangman', () => {
  it('every level has plenty of words of the right length', () => {
    for (const [id, level] of Object.entries(HANG_LEVELS)) {
      const words = hangWords(id);
      expect(words.length, id).toBeGreaterThan(20);
      for (const { word } of words) expect(word.length >= level.min && word.length <= level.max).toBe(true);
    }
  });

  it('a right letter shows everywhere it is; a wrong one pops a balloon', () => {
    const s = new HangState('classic', 'banana', 'Food', [], null).apply('ga');
    expect(s.shown).toEqual(['', 'a', '', 'a', '', 'a']);
    expect(s.left).toBe(7);
    expect(s.apply('gz').left).toBe(6);
  });

  it('the whole word wins; the last balloon going loses', () => {
    const win = ['gb', 'ga', 'gn'].reduce((s, m) => s.apply(m), new HangState('classic', 'banana', 'Food', [], null));
    expect(win.result).toEqual({ winners: [0], draw: false });
    let lose = new HangState('hard', 'banana', 'Food', [], null);
    for (const l of 'cdefg') lose = lose.apply(`g${l}`);
    expect(lose.result).toEqual({ winners: [], draw: false });
  });

  it('a letter cannot be guessed twice', () => {
    const s = newHangman(1).apply('ge');
    expect(() => s.apply('ge')).toThrow();
  });

  it('the same seed hides the same word, and test play finishes', () => {
    expect(newHangman(4, 'easy')).toEqual(newHangman(4, 'easy'));
    const bot = hangman.createBot('medium');
    let s = newHangman(4) as HangState;
    const rng = createRng(1);
    while (!s.result) s = s.apply(bot.chooseMove(s, 0, rng)) as HangState;
    expect(s.result).not.toBeNull();
  });
});

/** Invariant: balloons only ever go down, and only for a letter not in the word. */
describe('hangman invariants', () => {
  it('counts honestly', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = createRng(seed);
      let s = newHangman(seed, ['easy', 'classic', 'hard'][seed % 3]);
      while (!s.result) {
        const move = rng.pick(s.legalMoves(0));
        const before = s.left;
        s = s.apply(move);
        expect(before - s.left).toBe(s.word.includes(move[1]!) ? 0 : 1);
      }
    }
  });
});
