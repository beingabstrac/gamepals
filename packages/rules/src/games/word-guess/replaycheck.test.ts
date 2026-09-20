import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { ANSWERS, isWord } from './words';
import { newWordGuess, wordGuess, wordGuessGame } from './index';

describe('a real guess and the referee', () => {
  it('a word a person may type replays', () => {
    const state = newWordGuess(42);
    // ZONAL is a word the rules accept but not one the answer list holds, so it is exactly what
    // somebody types on their second go and exactly what the server has to be able to verify.
    expect(isWord('zonal')).toBe(true);
    expect(ANSWERS.includes('zonal')).toBe(false);
    expect(() => state.apply(wordGuess('zonal'))).not.toThrow();
    const log = toMoveLog(wordGuessGame, { players: 1 }, 42, [wordGuess('zonal')]);
    expect(() => replay(wordGuessGame, log)).not.toThrow();
  });
});
