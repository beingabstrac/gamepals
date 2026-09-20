import type { Rng } from '../../core/rng';
import { CLUES } from './clues';

/**
 * Laying a 5x5 mini crossword (docs/games/mini-crossword.md). The puzzles are not written, the
 * words are: a backtracking filler lays a fresh grid out of the clue dictionary, so every across
 * and down word in it already has a clue and the date can pick a grid nobody has seen.
 */
export const SIDE = 5;

/** A block pattern, read as rows of '.' for a letter and '#' for a black square. */
export const PATTERNS: readonly string[] = [
  // Chosen by measurement, not by eye. A 5x5 with six five-letter words needs a far bigger
  // vocabulary than a clue dictionary can hold: those patterns failed half the time, took half a
  // second when they worked, and landed on the same two grids over and over. These six always
  // fill, in under two hundred milliseconds, and twenty seeds give sixteen or more different
  // grids. They are also the shape a mini crossword really has: blocked corners, short outer
  // words, one long word through the middle.
  '##...|#....|.....|....#|...##',
  '...##|....#|.....|#....|##...',
  '##...|##...|.....|...##|...##',
  '...##|...##|.....|##...|##...',
  '##...|#....|.....|#....|##...',
  '...##|....#|.....|....#|...##',
];
export interface Slot {
  readonly row: number;
  readonly col: number;
  readonly down: boolean;
  readonly length: number;
  /** 1-based, the way a crossword numbers its clues. */
  readonly number: number;
}

export interface Puzzle {
  /** One string per row; '#' is a black square. */
  readonly rows: readonly string[];
  readonly slots: readonly Slot[];
  readonly pattern: string;
}

const blank = (pattern: string): string[][] =>
  pattern.split('|').map((row) => row.split('').map((cell) => (cell === '#' ? '#' : '')));

/**
 * The slots a pattern makes, numbered the way a crossword numbers them: a square starts a word
 * when the square before it in that direction is a block or off the grid, and a run of one square
 * is not a word at all.
 */
export function slotsOf(pattern: string): Slot[] {
  const cells = blank(pattern);
  const black = (r: number, c: number) => r < 0 || c < 0 || r >= SIDE || c >= SIDE || cells[r]![c] === '#';
  const slots: Slot[] = [];
  let number = 0;
  for (let r = 0; r < SIDE; r++) {
    for (let c = 0; c < SIDE; c++) {
      if (black(r, c)) continue;
      const startsAcross = black(r, c - 1) && !black(r, c + 1);
      const startsDown = black(r - 1, c) && !black(r + 1, c);
      if (!startsAcross && !startsDown) continue;
      number++;
      if (startsAcross) {
        let length = 0;
        while (!black(r, c + length)) length++;
        slots.push({ row: r, col: c, down: false, length, number });
      }
      if (startsDown) {
        let length = 0;
        while (!black(r + length, c)) length++;
        slots.push({ row: r, col: c, down: true, length, number });
      }
    }
  }
  return slots;
}

/** Words we have a clue for, in buckets by length, so the filler never picks one we cannot clue. */
const byLength = new Map<number, string[]>();
for (const word of Object.keys(CLUES)) {
  const bucket = byLength.get(word.length) ?? [];
  bucket.push(word);
  byLength.set(word.length, bucket);
}

/** Words of a length grouped by what sits at one position, so a crossing narrows the list fast. */
const atPosition = new Map<string, string[]>();
for (const [length, words] of byLength) {
  for (const word of words) {
    for (let i = 0; i < length; i++) {
      const key = `${length}:${i}:${word[i]}`;
      const bucket = atPosition.get(key) ?? [];
      bucket.push(word);
      atPosition.set(key, bucket);
    }
  }
}

const cellsOf = (slot: Slot): { r: number; c: number }[] =>
  Array.from({ length: slot.length }, (_, i) => ({
    r: slot.row + (slot.down ? i : 0),
    c: slot.col + (slot.down ? 0 : i),
  }));

/**
 * What the grid already says this slot must be: its letters so far, with a dot for a square
 * still empty. The dot matters. An empty square is the empty string, and joining those together
 * loses them, which is a whole afternoon if you do not notice.
 */
function shapeOf(cells: string[][], slot: Slot): string {
  return cellsOf(slot)
    .map(({ r, c }) => cells[r]![c] || '.')
    .join('');
}

/**
 * Worked-out candidate lists, kept between calls. The same shape comes up again and again as the
 * filler backs out and tries another branch, and working one out from scratch every time is the
 * difference between a puzzle laid in a blink and one laid in two seconds.
 */
const known = new Map<string, readonly string[]>();

function candidates(slot: Slot, shape: string): readonly string[] {
  const cached = known.get(shape);
  if (cached) return cached;
  const worked = workOut(slot, shape);
  // One game can lay many puzzles, so the cache is emptied rather than left to grow all session.
  if (known.size > 40_000) known.clear();
  known.set(shape, worked);
  return worked;
}

function workOut(slot: Slot, shape: string): readonly string[] {
  const fixed = [...shape].map((letter, i) => ({ letter, i })).filter((one) => one.letter !== '.');
  if (!fixed.length) return byLength.get(slot.length) ?? [];
  // Start from the rarest crossing letter, then sieve with the rest.
  const lists = fixed.map((one) => atPosition.get(`${slot.length}:${one.i}:${one.letter}`) ?? []);
  lists.sort((a, b) => a.length - b.length);
  const [first, ...rest] = lists;
  if (!rest.length) return first ?? [];
  const sieves = rest.map((list) => new Set(list));
  return (first ?? []).filter((word) => sieves.every((sieve) => sieve.has(word)));
}

/**
 * Fills the slots one at a time, always taking the slot with the fewest words left, which is what
 * keeps a 5x5 from wandering down a branch that cannot finish. Words are tried in the order the
 * seed shuffles them, so the same seed lays the same grid.
 */
function fill(cells: string[][], slots: readonly Slot[], rng: Rng, budget: { left: number }): boolean {
  if (budget.left-- <= 0) return false;
  const open = slots.filter((slot) => shapeOf(cells, slot).includes('.'));
  if (!open.length) return true;
  let best = open[0]!;
  let bestWords: readonly string[] = candidates(best, shapeOf(cells, best));
  for (const slot of open.slice(1)) {
    const words = candidates(slot, shapeOf(cells, slot));
    if (words.length < bestWords.length) {
      best = slot;
      bestWords = words;
    }
  }
  const spots = cellsOf(best);
  for (const word of shuffled(bestWords, rng)) {
    const before = spots.map(({ r, c }) => cells[r]![c]!);
    spots.forEach(({ r, c }, i) => (cells[r]![c] = word[i]!));
    if (sound(cells, slots) && fill(cells, slots, rng, budget)) return true;
    spots.forEach(({ r, c }, i) => (cells[r]![c] = before[i]!));
  }
  return false;
}

/**
 * Is the grid still worth carrying on with? A slot that is not finished must have something it
 * could still become, and one that is finished must be a word we can clue. A crossing can finish
 * a slot the filler never chose, and without this check those come out as whatever the letters
 * happened to spell.
 */
function sound(cells: string[][], slots: readonly Slot[]): boolean {
  const done: string[] = [];
  for (const slot of slots) {
    const shape = shapeOf(cells, slot);
    if (shape.includes('.')) {
      if (!candidates(slot, shape).length) return false;
    } else {
      if (!CLUES[shape]) return false;
      done.push(shape);
    }
  }
  // The same word twice in one grid reads like a mistake.
  return new Set(done).size === done.length;
}

function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Lays a puzzle for this seed, trying each block pattern in the order the seed shuffles them. */
export function layPuzzle(rng: Rng): Puzzle {
  for (const pattern of shuffled(PATTERNS, rng)) {
    const slots = slotsOf(pattern);
    const cells = blank(pattern);
    // Enough steps to finish a 5x5 and few enough that a bad pattern gives up rather than hangs.
    if (fill(cells, slots, rng, { left: 20_000 })) {
      return { rows: cells.map((row) => row.join('')), slots, pattern };
    }
  }
  throw new Error('Could not lay a crossword');
}

/** The word a slot holds in a laid grid. */
export const wordIn = (rows: readonly string[], slot: Slot): string =>
  cellsOf(slot)
    .map(({ r, c }) => rows[r]![c]!)
    .join('');
