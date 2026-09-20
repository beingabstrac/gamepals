import { createRng, type Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';
import { CLUES } from '../crossword/clues';
import { THEMES } from '../word-search/words';
import { BASES } from './bases';

export { BASES } from './bases';

/**
 * Anagram Hunt (docs/games/anagram-hunt.md). Seven letters, find the words hiding in them, and
 * one word uses all seven.
 *
 * Moves: `f<word>`.
 */
export type HuntMove = string;
export const findWord = (word: string): HuntMove => `f${word}`;

export const BASE_LENGTH = 7;
export const SHORTEST = 3;

/**
 * What counts as a word here: the crossword's clue dictionary and the word search's themes, all
 * of them words a person knows. Nothing obscure is ever needed, which is the difference between
 * a hunt and a dictionary test.
 */
let pool: readonly string[] | null = null;

export function huntPool(): readonly string[] {
  if (pool) return pool;
  const words = new Set<string>();
  for (const word of Object.keys(CLUES)) if (word.length >= SHORTEST) words.add(word);
  for (const theme of THEMES) {
    for (const word of theme.words) if (word.length >= SHORTEST && word.length < BASE_LENGTH) words.add(word);
  }
  return (pool = [...words].sort());
}

/** Can this word be spelled from these letters, using each no more often than it appears? */
export function spellable(word: string, letters: string): boolean {
  const have = new Map<string, number>();
  for (const letter of letters) have.set(letter, (have.get(letter) ?? 0) + 1);
  for (const letter of word) {
    const left = have.get(letter) ?? 0;
    if (left === 0) return false;
    have.set(letter, left - 1);
  }
  return true;
}

/** Every word hiding in a base, the base itself included. */
export function hiding(base: string): readonly string[] {
  return [...huntPool().filter((word) => word !== base && spellable(word, base)), base].sort();
}

/** How many have to be found. About half, so the puzzle can actually be cleared. */
export const targetFor = (total: number): number => Math.max(4, Math.min(10, Math.round(total * 0.45)));

export class HuntState implements GameState<HuntMove> {
  constructor(
    readonly base: string,
    /** The seven letters as they are shown, shuffled from the base. */
    readonly letters: string,
    /** Every word hiding in them, sorted. Not shown: this is what a find is checked against. */
    readonly words: readonly string[],
    readonly found: readonly string[],
    readonly target: number,
    readonly currentSeat: Seat,
    readonly moves: number,
    readonly result: GameResult | null,
  ) {}

  get left(): number {
    return Math.max(0, this.target - this.found.length);
  }

  /** The seven-letter one, which is the word the puzzle is built around. */
  get gotLong(): boolean {
    return this.found.includes(this.base);
  }

  legalMoves(seat: Seat): readonly HuntMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    const done = new Set(this.found);
    return this.words.filter((word) => !done.has(word)).map(findWord);
  }

  apply(move: HuntMove): HuntState {
    if (this.result) throw new Error('Game is over');
    const word = move.startsWith('f') ? move.slice(1) : '';
    if (!this.words.includes(word) || this.found.includes(word)) throw new Error(`Illegal move: ${move}`);
    const found = [...this.found, word];
    const done = found.length >= this.target;
    const result: GameResult | null = done ? { winners: [0], draw: false } : null;
    return new HuntState(this.base, this.letters, this.words, found, this.target, 0, this.moves + 1, result);
  }
}

export function newAnagramHunt(seed: number): HuntState {
  const rng = createRng(seed >>> 0);
  const base = BASES[rng.int(BASES.length)]!;
  const words = hiding(base);
  const letters = [...base];
  for (let i = letters.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [letters[i], letters[j]] = [letters[j]!, letters[i]!];
  }
  return new HuntState(base, letters.join(''), words, [], targetFor(words.length), 0, 0, null);
}

/** What a seat may know: the letters and how many are left to find. Never the list. */
export interface HuntView {
  readonly letters: string;
  readonly left: number;
}

export const huntViewFor = (state: HuntState): HuntView => ({ letters: state.letters, left: state.left });

/**
 * A solo puzzle has no opponent to be fair to, so the bot is an autoplayer. The good ones go for
 * the seven-letter word first, which is what a person does when they spot it.
 */
function createHuntBot(longFirst: boolean): Bot<HuntMove> {
  return {
    chooseMove(generic: GameState<HuntMove>, _seat: Seat, rng: Rng): HuntMove {
      const state = generic as HuntState;
      const moves = state.legalMoves(0);
      if (!moves.length) throw new Error('No legal moves');
      if (longFirst) {
        const long = moves.find((move) => move.slice(1) === state.base);
        if (long) return long;
      }
      return rng.pick(moves);
    },
  };
}

const TIERS: Record<BotTier, boolean> = { easy: false, medium: false, hard: true, expert: true };

export const anagramHuntGame: GameDefinition<HuntMove> = {
  id: 'anagram-hunt',
  name: 'Anagram Hunt',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo'],
  hiddenInfo: true,
  realtime: false,
  newGame: (_config, seed) => newAnagramHunt(seed),
  createBot: (tier) => createHuntBot(TIERS[tier]),
  encodeMove: (move) => move,
};
