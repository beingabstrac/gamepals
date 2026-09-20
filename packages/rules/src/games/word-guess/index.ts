import { createRng, type Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';
import { ALLOWED, ANSWERS, isWord } from './words';

// The dictionary travels with the game: the scene asks it whether a typed word is real.
export { isWord } from './words';

/**
 * Word Guess (docs/games/word-guess.md). Six goes at a five-letter word. Every guess says which
 * letters are right and in the right place, which are in the word somewhere else, and which are
 * not there at all.
 * Moves: `g<word>`, five letters.
 */
export type WordMove = string;
export const wordGuess = (word: string): WordMove => `g${word}`;

export const WORD_LENGTH = 5;
export const TRIES = 6;

/** What a guessed letter turns out to be. */
export type Mark = 'right' | 'near' | 'gone';

export interface Guess {
  readonly word: string;
  readonly marks: readonly Mark[];
}

/**
 * Marking a guess, which is the one part everybody gets wrong. A letter is only "near" if the
 * secret still has one spare: guessing SPEED against ERASE marks the first E near, the second
 * gone, because the secret's two Es are already spoken for.
 */
export function markGuess(guess: string, secret: string): Mark[] {
  const marks: Mark[] = Array.from({ length: WORD_LENGTH }, () => 'gone');
  const spare = new Map<string, number>();
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === secret[i]) marks[i] = 'right';
    else spare.set(secret[i]!, (spare.get(secret[i]!) ?? 0) + 1);
  }
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (marks[i] === 'right') continue;
    const left = spare.get(guess[i]!) ?? 0;
    if (left > 0) {
      marks[i] = 'near';
      spare.set(guess[i]!, left - 1);
    }
  }
  return marks;
}

/** Does this word fit everything the guesses have said? Used by the bots and by the hint. */
export function fits(word: string, guesses: readonly Guess[]): boolean {
  return guesses.every((guess) => markGuess(guess.word, word).join() === guess.marks.join());
}

export class WordState implements GameState<WordMove> {
  private cached?: WordMove[];

  constructor(
    readonly secret: string,
    readonly guesses: readonly Guess[],
    readonly currentSeat: Seat,
    readonly moves: number,
    readonly result: GameResult | null,
  ) {}

  get won(): boolean {
    return this.guesses.some((guess) => guess.word === this.secret);
  }

  get left(): number {
    return TRIES - this.guesses.length;
  }

  /** What each letter of the alphabet is known to be, for the keyboard. */
  get letters(): ReadonlyMap<string, Mark> {
    const known = new Map<string, Mark>();
    const rank: Record<Mark, number> = { gone: 0, near: 1, right: 2 };
    for (const guess of this.guesses) {
      guess.word.split('').forEach((letter, i) => {
        const mark = guess.marks[i]!;
        const had = known.get(letter);
        if (!had || rank[mark] > rank[had]) known.set(letter, mark);
      });
    }
    return known;
  }

  /**
   * Every word that may be typed. This has to be everything `apply` takes, not the shorter list a
   * bot would pick from: `replay` is the server referee and checks each move against this, so a
   * narrower list means a person guessing a perfectly good word produces a game the server then
   * refuses to verify. It shipped that way and ZONAL was the word that proved it.
   */
  legalMoves(seat: Seat): readonly WordMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    const already = new Set(this.guesses.map((guess) => guess.word));
    return (this.cached ??= ALLOWED.filter((word) => !already.has(word)).map(wordGuess));
  }

  /** The shorter list: answers that still fit everything the guesses said. What a bot picks from. */
  candidates(): readonly string[] {
    return ANSWERS.filter((word) => fits(word, this.guesses));
  }

  apply(move: WordMove): WordState {
    if (this.result) throw new Error('Game is over');
    const word = move.startsWith('g') ? move.slice(1) : '';
    // Anything in the dictionary may be guessed, not only the words a bot would pick.
    if (word.length !== WORD_LENGTH || !isWord(word)) throw new Error(`Illegal move: ${move}`);
    const guesses = [...this.guesses, { word, marks: markGuess(word, this.secret) }];
    const won = word === this.secret;
    const over = won || guesses.length >= TRIES;
    const result: GameResult | null = over ? { winners: won ? [0] : [], draw: false } : null;
    return new WordState(this.secret, guesses, 0, this.moves + 1, result);
  }
}

export function newWordGuess(seed: number): WordState {
  const rng = createRng(seed >>> 0);
  return new WordState(ANSWERS[rng.int(ANSWERS.length)]!, [], 0, 0, null);
}

/** What a seat may know: the guesses and what they turned out to be. Never the secret. */
export interface WordView {
  readonly guesses: readonly Guess[];
  readonly left: number;
}

export const wordViewFor = (state: WordState): WordView => ({ guesses: state.guesses, left: state.left });

interface WordStyle {
  /** Starts with a word that covers common letters rather than any old word. */
  readonly opens: boolean;
  /** Only guesses words that still fit everything it has been told. */
  readonly listens: boolean;
}

const TIERS: Record<BotTier, WordStyle> = {
  easy: { opens: false, listens: false },
  medium: { opens: false, listens: true },
  hard: { opens: true, listens: true },
  expert: { opens: true, listens: true },
};

/** Five common letters, no repeats: the opening most solvers use. */
const OPENERS = ['slate', 'crane', 'raise', 'adieu', 'roast'];

function createWordBot(style: WordStyle): Bot<WordMove> {
  return {
    chooseMove(generic: GameState<WordMove>, _seat: Seat, rng: Rng): WordMove {
      const state = generic as WordState;
      const view = wordViewFor(state);
      if (style.opens && view.guesses.length === 0) return wordGuess(OPENERS[rng.int(OPENERS.length)]!);
      if (!style.listens) return wordGuess(ALLOWED[rng.int(ALLOWED.length)]!);
      const words = state.candidates();
      if (!words.length) throw new Error('No legal moves');
      // Expert takes the word that splits what is left most evenly; the rest take any that fits.
      if (!style.opens || words.length <= 2) return wordGuess(rng.pick(words));
      let best = words[0]!;
      let bestWorst = Infinity;
      // A sample, because scoring eight thousand against two thousand on a phone is not free.
      for (const candidate of words.slice(0, 60)) {
        const buckets = new Map<string, number>();
        for (const answer of words.slice(0, 200)) {
          const key = markGuess(candidate, answer).join();
          buckets.set(key, (buckets.get(key) ?? 0) + 1);
        }
        const worst = Math.max(...buckets.values());
        if (worst < bestWorst) {
          bestWorst = worst;
          best = candidate;
        }
      }
      return wordGuess(best);
    },
  };
}

export const wordGuessGame: GameDefinition<WordMove> = {
  id: 'word-guess',
  name: 'Word Guess',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo'],
  hiddenInfo: true,
  realtime: false,
  newGame: (_config, seed) => newWordGuess(seed),
  createBot: (tier) => createWordBot(TIERS[tier]),
  encodeMove: (move) => move,
};
