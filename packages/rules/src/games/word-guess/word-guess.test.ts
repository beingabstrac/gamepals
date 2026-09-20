import { describe, expect, it } from 'vitest';
import { BOT_TIERS } from '../../core/types';
import { createRng } from '../../core/rng';
import { replay, toMoveLog } from '../../core/replay';
import { ALLOWED, ANSWERS, isWord } from './words';
import { fits, markGuess, newWordGuess, TRIES, WordState, wordGuess, wordGuessGame, type WordMove } from './index';

describe('word guess marking', () => {
  it('marks right letters in the right place, and the rest', () => {
    expect(markGuess('crane', 'crane')).toEqual(['right', 'right', 'right', 'right', 'right']);
    // BRICK against CRANE: the R is in its place, the C is in the word somewhere else.
    expect(markGuess('brick', 'crane')).toEqual(['gone', 'right', 'gone', 'near', 'gone']);
  });

  it('only marks a letter near while the secret has a spare', () => {
    // ERASE really does have two Es, so both of SPEED's are near, and so is the S.
    expect(markGuess('speed', 'erase')).toEqual(['near', 'gone', 'near', 'near', 'gone']);
    // CRANE has one E and it is already in its place, so EERIE's other two Es have nothing left
    // to point at. This is the rule everybody gets wrong, mine included, twice.
    expect(markGuess('eerie', 'crane')).toEqual(['gone', 'gone', 'near', 'gone', 'right']);
  });

  it('keeps only the words that fit what has been said', () => {
    const guesses = [{ word: 'crane', marks: markGuess('crane', 'blame') }];
    expect(fits('blame', guesses)).toBe(true);
    expect(fits('crane', guesses)).toBe(false);
    expect(fits('stoic', guesses)).toBe(false);
  });
});

describe('word guess rules', () => {
  it('gives six goes and ends when the word is found', () => {
    const state = new WordState('crane', [], 0, 0, null);
    expect(state.left).toBe(TRIES);
    const after = state.apply(wordGuess('crane'));
    expect(after.won).toBe(true);
    expect(after.result?.winners).toEqual([0]);
  });

  it('ends without a win when the goes run out', () => {
    let state = new WordState('crane', [], 0, 0, null);
    for (const word of ['stoic', 'bluff', 'dodge', 'jumpy', 'whelp', 'vixen']) state = state.apply(wordGuess(word));
    expect(state.guesses).toHaveLength(TRIES);
    expect(state.won).toBe(false);
    expect(state.result?.winners).toEqual([]);
  });

  it('takes any real word, and refuses anything else', () => {
    const state = new WordState('crane', [], 0, 0, null);
    // Not in the answer list, but a person may certainly type it.
    expect(isWord('zonal')).toBe(true);
    expect(() => state.apply(wordGuess('zonal'))).not.toThrow();
    expect(() => state.apply(wordGuess('xxxxx'))).toThrow(/Illegal/);
    expect(() => state.apply(wordGuess('cat'))).toThrow(/Illegal/);
  });

  it('says what each letter of the alphabet is known to be', () => {
    const state = new WordState('crane', [], 0, 0, null).apply(wordGuess('brick'));
    const letters = state.letters;
    expect(letters.get('r')).toBe('right');
    expect(letters.get('c')).toBe('near');
    expect(letters.get('b')).toBe('gone');
    // A letter that turns out right later beats what an earlier guess said about it.
    const next = state.apply(wordGuess('crane'));
    expect(next.letters.get('c')).toBe('right');
  });
});

describe('word guess words', () => {
  it('has a list to answer from and a bigger one to type from', () => {
    expect(ANSWERS.length).toBeGreaterThan(1500);
    expect(ALLOWED.length).toBeGreaterThan(8000);
    expect(ANSWERS.every((word) => word.length === 5)).toBe(true);
    expect(ALLOWED.every((word) => /^[a-z]{5}$/.test(word))).toBe(true);
    // Every answer is a word somebody is allowed to guess.
    expect(ANSWERS.every(isWord)).toBe(true);
  });

  it('gives the same word for the same seed, so a daily is the same for everybody', () => {
    expect(newWordGuess(42).secret).toBe(newWordGuess(42).secret);
    const words = new Set([1, 2, 3, 4, 5].map((seed) => newWordGuess(seed).secret));
    expect(words.size).toBeGreaterThan(1);
  });
});

describe('word guess bots', () => {
  it('never sees the secret, only what the guesses said', () => {
    const state = newWordGuess(7).apply(wordGuess('crane'));
    // Swapping the secret for another word that fits the same marks changes nothing.
    const same = ANSWERS.find((word) => word !== state.secret && fits(word, state.guesses));
    if (!same) return;
    const swapped = new WordState(same, state.guesses, 0, state.moves, null);
    for (const tier of BOT_TIERS) {
      const bot = wordGuessGame.createBot(tier);
      expect(bot.chooseMove(swapped, 0, createRng(3))).toBe(bot.chooseMove(state, 0, createRng(3)));
    }
  });

  it('solves most of the time, and replays exactly', { timeout: 120_000 }, () => {
    const bot = wordGuessGame.createBot('expert');
    let solved = 0;
    for (let seed = 0; seed < 20; seed++) {
      let state = wordGuessGame.newGame({ players: 1 }, seed) as WordState;
      const moves: WordMove[] = [];
      while (!state.result) {
        const move = bot.chooseMove(state, 0, createRng(moves.length + 1));
        moves.push(move);
        state = state.apply(move);
      }
      if (state.won) solved++;
      const replayed = replay(wordGuessGame, toMoveLog(wordGuessGame, { players: 1 }, seed, moves)) as WordState;
      expect(replayed.guesses.map((guess) => guess.word)).toEqual(state.guesses.map((guess) => guess.word));
    }
    // A solver that listens to its own guesses should be getting most of these.
    expect(solved, `expert solved ${solved} of 20`).toBeGreaterThanOrEqual(14);
  });
});
