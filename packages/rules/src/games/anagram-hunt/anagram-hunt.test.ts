import { describe, expect, it } from 'vitest';
import { BOT_TIERS } from '../../core/types';
import { createRng } from '../../core/rng';
import { replay, toMoveLog } from '../../core/replay';
import {
  anagramHuntGame,
  BASES,
  BASE_LENGTH,
  findWord,
  hiding,
  huntPool,
  HuntState,
  newAnagramHunt,
  SHORTEST,
  spellable,
  targetFor,
  type HuntMove,
} from './index';

describe('the letters', () => {
  it('spells a word only from what is there, and only as often', () => {
    expect(spellable('cat', 'tactic')).toBe(true);
    expect(spellable('tat', 'tactic')).toBe(true);
    // Three Ts needs three Ts.
    expect(spellable('tttt', 'tactic')).toBe(false);
    expect(spellable('dog', 'tactic')).toBe(false);
  });

  it('every base is seven letters and hides enough to be worth playing', () => {
    expect(BASES.length).toBeGreaterThan(300);
    expect(new Set(BASES).size).toBe(BASES.length);
    expect(BASES.every((base) => base.length === BASE_LENGTH && /^[a-z]+$/.test(base))).toBe(true);
    // The generator filtered for this; check it again rather than trusting that it did.
    const thin = BASES.filter((base) => hiding(base).length < 8);
    expect(thin, `bases hiding fewer than eight words: ${thin.slice(0, 5).join(', ')}`).toEqual([]);
  });

  it('only offers words people know, of three letters or more', () => {
    const words = huntPool();
    expect(words.length).toBeGreaterThan(1500);
    expect(words.every((word) => word.length >= SHORTEST && /^[a-z]+$/.test(word))).toBe(true);
  });
});

describe('hunting', () => {
  it('takes a word that is there and refuses one that is not', () => {
    const state = newAnagramHunt(5);
    const word = state.words.find((one) => one !== state.base)!;
    const after = state.apply(findWord(word));
    expect(after.found).toEqual([word]);
    // The same word twice, a word not hiding here, and nonsense.
    expect(() => after.apply(findWord(word))).toThrow(/Illegal/);
    expect(() => state.apply(findWord('zzzz'))).toThrow(/Illegal/);
    expect(() => state.apply('nonsense')).toThrow(/Illegal/);
  });

  it('knows the seven-letter one when it turns up', () => {
    const state = newAnagramHunt(5);
    expect(state.gotLong).toBe(false);
    expect(state.apply(findWord(state.base)).gotLong).toBe(true);
  });

  it('ends at the target, which is reachable', () => {
    let state = newAnagramHunt(5);
    expect(state.target).toBeLessThanOrEqual(state.words.length);
    expect(state.target).toBeGreaterThanOrEqual(4);
    while (!state.result) state = state.apply(state.legalMoves(0)[0]!);
    expect(state.found.length).toBe(state.target);
    expect(state.result?.winners).toEqual([0]);
    expect(state.left).toBe(0);
    expect(() => state.apply(state.legalMoves(0)[0] ?? findWord(state.base))).toThrow(/over/);
  });

  it('shuffles the letters without changing what hides in them', () => {
    const state = newAnagramHunt(5);
    expect([...state.letters].sort().join('')).toBe([...state.base].sort().join(''));
    expect(state.words).toEqual(hiding(state.base));
  });

  it('gives the same letters for the same seed', () => {
    expect(newAnagramHunt(9).letters).toBe(newAnagramHunt(9).letters);
    const seen = new Set([1, 2, 3, 4, 5].map((seed) => newAnagramHunt(seed).base));
    expect(seen.size).toBeGreaterThan(3);
  });

  it('asks for about half of what is there', () => {
    expect(targetFor(4)).toBe(4);
    expect(targetFor(15)).toBe(7);
    expect(targetFor(40)).toBe(10);
  });
});

describe('anagram hunt bots', () => {
  it('clear it, and the good ones take the long word first', { timeout: 120_000 }, () => {
    for (const tier of BOT_TIERS) {
      const bot = anagramHuntGame.createBot(tier);
      let state = anagramHuntGame.newGame({ players: 1 }, 8) as HuntState;
      const moves: HuntMove[] = [];
      while (!state.result) {
        const move = bot.chooseMove(state, 0, createRng(moves.length + 1));
        moves.push(move);
        state = state.apply(move);
      }
      expect(state.found.length, tier).toBe(state.target);
      if (tier === 'hard' || tier === 'expert') expect(moves[0]!.slice(1), tier).toBe(state.base);
      const replayed = replay(anagramHuntGame, toMoveLog(anagramHuntGame, { players: 1 }, 8, moves)) as HuntState;
      expect(replayed.found).toEqual(state.found);
    }
  });
});
