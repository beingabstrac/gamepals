import { describe, expect, it } from 'vitest';
import { BOT_TIERS } from '../../core/types';
import { createRng } from '../../core/rng';
import { replay, toMoveLog } from '../../core/replay';
import { THEMES } from './words';
import { newWordSearch, searchLine, SearchState, SIZES, sizeFor, wordSearchGame, type SearchMove } from './index';

const game = (variant: string, seed: number): SearchState => newWordSearch({ players: 1, variant }, seed) as SearchState;

const ALL = [
  [0, 1],
  [1, 0],
  [1, 1],
  [-1, 1],
  [0, -1],
  [-1, 0],
  [-1, -1],
  [1, -1],
] as const;
/** Only the four a word may be laid along when backwards is off. */
const FORWARD = ALL.slice(0, 4);

/** Where a word really sits, worked out by reading the grid rather than by asking the rules. */
function findIn(state: SearchState, word: string, ways: readonly (readonly [number, number])[] = ALL) {
  for (let r = 0; r < state.side; r++) {
    for (let c = 0; c < state.side; c++) {
      for (const [dr, dc] of ways) {
        const r2 = r + dr * (word.length - 1);
        const c2 = c + dc * (word.length - 1);
        if (state.read(r, c, r2, c2) === word) return { r, c, r2, c2 };
      }
    }
  }
  return undefined;
}

describe('word search grids', () => {
  it('hides every word on the list where it can be read', () => {
    for (const variant of Object.keys(SIZES)) {
      const size = sizeFor(variant);
      for (let seed = 0; seed < 12; seed++) {
        const state = game(variant, seed);
        expect(state.grid).toHaveLength(size.side);
        expect(state.grid.every((row) => row.length === size.side)).toBe(true);
        expect(state.words).toHaveLength(size.words);
        for (const word of state.words) {
          expect(findIn(state, word), `${variant} seed ${seed} lost ${word}`).toBeDefined();
        }
      }
    }
  });

  it('takes its words from one theme and fills the rest with that theme letters', () => {
    const state = game('medium', 5);
    const theme = THEMES.find((one) => one.name === state.theme);
    expect(theme).toBeDefined();
    expect(state.words.every((word) => theme!.words.includes(word))).toBe(true);
    const used = new Set(theme!.words.join(''));
    expect(state.grid.join('').split('').every((letter) => used.has(letter))).toBe(true);
  });

  it('only lays words backwards on the big grid', () => {
    // On the small and medium grids every word was laid along one of the four forward lines.
    // A word may still read backwards by accident; what matters is that one of them was put there.
    for (const variant of ['small', 'medium']) {
      for (let seed = 0; seed < 8; seed++) {
        const state = game(variant, seed);
        for (const word of state.words) {
          expect(findIn(state, word, FORWARD), `${word} only reads backwards on ${variant}`).toBeDefined();
        }
      }
    }
  });

  it('gives the same grid for the same seed', () => {
    expect(game('medium', 9).grid).toEqual(game('medium', 9).grid);
    const grids = new Set([1, 2, 3, 4, 5].map((seed) => game('medium', seed).grid.join('|')));
    expect(grids.size).toBeGreaterThan(1);
  });
});

describe('word search play', () => {
  it('takes a line that spells a word, either way round', () => {
    const state = game('medium', 3);
    const word = state.words[0]!;
    const at = findIn(state, word)!;
    const forwards = state.apply(searchLine(at.r, at.c, at.r2, at.c2));
    expect(forwards.found.map((one) => one.word)).toEqual([word]);
    // The same line drawn from the other end is the same find.
    const backwards = state.apply(searchLine(at.r2, at.c2, at.r, at.c));
    expect(backwards.found.map((one) => one.word)).toEqual([word]);
    expect(backwards.found[0]!.r).toBe(at.r);
    expect(backwards.found[0]!.c).toBe(at.c);
  });

  it('refuses a line that spells nothing, a bent line, and a word already found', () => {
    const state = game('medium', 3);
    const word = state.words[0]!;
    const at = findIn(state, word)!;
    expect(() => state.apply(searchLine(0, 0, 9, 3))).toThrow(/Illegal/);
    expect(() => state.apply('nonsense')).toThrow(/Illegal/);
    const after = state.apply(searchLine(at.r, at.c, at.r2, at.c2));
    expect(() => after.apply(searchLine(at.r, at.c, at.r2, at.c2))).toThrow(/Illegal/);
  });

  it('ends when the list is empty', () => {
    let state = game('small', 4);
    while (!state.result) state = state.apply(state.legalMoves(0)[0]!);
    expect(state.left).toEqual([]);
    expect(state.result?.winners).toEqual([0]);
    expect(() => state.apply(state.legalMoves(0)[0] ?? 'f0,0,0,1')).toThrow(/over/);
  });
});

describe('word search bots', () => {
  it('clears every size, at every tier, and replays exactly', { timeout: 120_000 }, () => {
    for (const variant of Object.keys(SIZES)) {
      for (const tier of BOT_TIERS) {
        const bot = wordSearchGame.createBot(tier);
        const config = { players: 1, variant };
        let state = wordSearchGame.newGame(config, 11) as SearchState;
        const moves: SearchMove[] = [];
        while (!state.result) {
          const move = bot.chooseMove(state, 0, createRng(moves.length + 1));
          moves.push(move);
          state = state.apply(move);
        }
        expect(state.left, `${tier} left words on ${variant}`).toEqual([]);
        const replayed = replay(wordSearchGame, toMoveLog(wordSearchGame, config, 11, moves)) as SearchState;
        expect(replayed.found.map((one) => one.word)).toEqual(state.found.map((one) => one.word));
      }
    }
  });

  it('takes the shortest word left at the top tiers', () => {
    const state = game('large', 6);
    const shortest = state.left.reduce((a, b) => (b.length < a.length ? b : a));
    const move = wordSearchGame.createBot('expert').chooseMove(state, 0, createRng(1));
    expect(state.apply(move).found[0]!.word).toBe(shortest);
  });
});
