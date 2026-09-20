import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { CLUES } from './clues';
import { layPuzzle, PATTERNS, SIDE, slotsOf, wordIn } from './grid';

describe('the clue dictionary', () => {
  it('holds three, four and five letter words, each with one clue', () => {
    const words = Object.keys(CLUES);
    expect(words.length).toBeGreaterThan(1200);
    expect(words.every((word) => /^[a-z]{3,5}$/.test(word))).toBe(true);
    // Enough of each length that the filler has room to back out of a bad branch.
    for (const length of [3, 4, 5]) {
      expect(words.filter((word) => word.length === length).length, `${length} letters`).toBeGreaterThan(150);
    }
    expect(Object.values(CLUES).every((clue) => clue.length > 2 && clue.length < 70)).toBe(true);
    // A clue that says its own word gives the game away. Whole words only: "You hear with it"
    // is a fair clue for EAR, and "Not female" is a fair one for MALE.
    const tells = Object.entries(CLUES).filter(([word, clue]) => new RegExp(`\\b${word}\\b`, 'i').test(clue));
    expect(tells, `clues that contain their own word: ${tells.map(([w]) => w).join(', ')}`).toEqual([]);
  });
});

describe('block patterns', () => {
  it('are five by five and make no word of one square', () => {
    for (const pattern of PATTERNS) {
      expect(pattern.split('|')).toHaveLength(SIDE);
      expect(pattern.split('|').every((row) => row.length === SIDE)).toBe(true);
      const slots = slotsOf(pattern);
      expect(slots.every((slot) => slot.length >= 3), pattern).toBe(true);
      // Every letter square belongs to an across word and a down word, or the grid reads oddly.
      const covered = new Set<string>();
      for (const slot of slots) {
        for (let i = 0; i < slot.length; i++) {
          covered.add(`${slot.row + (slot.down ? i : 0)},${slot.col + (slot.down ? 0 : i)}`);
        }
      }
      const letters = pattern.split('|').join('').split('').filter((cell) => cell !== '#').length;
      expect(covered.size, pattern).toBe(letters);
    }
  });
});

describe('laying a puzzle', () => {
  it('fills a grid where every word has a clue', { timeout: 120_000 }, () => {
    for (let seed = 0; seed < 25; seed++) {
      const puzzle = layPuzzle(createRng(seed));
      expect(puzzle.rows).toHaveLength(SIDE);
      for (const slot of puzzle.slots) {
        const word = wordIn(puzzle.rows, slot);
        expect(word).toHaveLength(slot.length);
        expect(CLUES[word], `seed ${seed} laid ${word} with no clue`).toBeDefined();
      }
      // A word twice in one grid reads like a mistake.
      const words = puzzle.slots.map((slot) => wordIn(puzzle.rows, slot));
      expect(new Set(words).size, `seed ${seed} repeated a word`).toBe(words.length);
    }
  });

  it('gives a different puzzle most days, which is what the daily needs', { timeout: 120_000 }, () => {
    // Found the hard way: patterns with six five-letter words have so few fills that forty seeds
    // gave the same grid five times over. This is the check that says so.
    const grids = new Set<string>();
    for (let seed = 0; seed < 40; seed++) grids.add(layPuzzle(createRng(seed)).rows.join('|'));
    // Measured at 34 of 40. The floor is lower so an honest change does not fail, but nothing
    // near the old behaviour could pass it.
    expect(grids.size, `40 seeds gave ${grids.size} different grids`).toBeGreaterThanOrEqual(30);
  });

  it('lays one quickly enough to open a game with', { timeout: 120_000 }, () => {
    const started = Date.now();
    for (let seed = 100; seed < 120; seed++) layPuzzle(createRng(seed));
    const each = (Date.now() - started) / 20;
    // A phone is slower than this, so leave plenty of room under a noticeable pause.
    expect(each, `${each.toFixed(0)}ms a puzzle`).toBeLessThan(250);
  });

  it('gives the same grid for the same seed, and different ones for different seeds', () => {
    expect(layPuzzle(createRng(8)).rows).toEqual(layPuzzle(createRng(8)).rows);
    const grids = new Set([1, 2, 3, 4, 5, 6].map((seed) => layPuzzle(createRng(seed)).rows.join('|')));
    expect(grids.size).toBeGreaterThan(3);
  });
});
