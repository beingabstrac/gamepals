import { createRng, type Rng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';
import { THEMES } from '../word-search/words';

/**
 * Hangman (docs/games/hangman.md), drawn kindly: guess the hidden word a letter at a time, and each
 * wrong letter pops one of your balloons. Get the word before the last one goes. The word comes
 * from our own themed lists, and the theme is shown as a clue.
 */
export interface HangLevel {
  readonly balloons: number;
  readonly min: number;
  readonly max: number;
}

export const HANG_LEVELS: Readonly<Record<string, HangLevel>> = {
  easy: { balloons: 8, min: 4, max: 6 },
  classic: { balloons: 7, min: 5, max: 8 },
  hard: { balloons: 5, min: 7, max: 9 },
};

export const HANG_LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/** `g<letter>` guesses a letter. */
export type HangMove = string;

export class HangState implements GameState<HangMove> {
  readonly currentSeat: Seat = 0;

  constructor(
    readonly levelId: string,
    readonly word: string,
    readonly theme: string,
    readonly guessed: readonly string[],
    readonly result: GameResult | null,
  ) {}

  get level(): HangLevel {
    return HANG_LEVELS[this.levelId]!;
  }

  get wrong(): number {
    return this.guessed.filter((l) => !this.word.includes(l)).length;
  }

  get left(): number {
    return this.level.balloons - this.wrong;
  }

  /** The word as shown: letters guessed so far, blanks for the rest. */
  get shown(): string[] {
    return [...this.word].map((l) => (this.guessed.includes(l) ? l : ''));
  }

  legalMoves(seat: Seat): readonly HangMove[] {
    if (this.result || seat !== 0) return [];
    return [...HANG_LETTERS].filter((l) => !this.guessed.includes(l)).map((l) => `g${l}`);
  }

  apply(move: HangMove): HangState {
    if (!this.legalMoves(0).includes(move)) throw new Error(`Illegal move: ${move}`);
    const guessed = [...this.guessed, move[1]!];
    const next = new HangState(this.levelId, this.word, this.theme, guessed, null);
    if ([...this.word].every((l) => guessed.includes(l))) return new HangState(this.levelId, this.word, this.theme, guessed, { winners: [0], draw: false });
    if (next.left <= 0) return new HangState(this.levelId, this.word, this.theme, guessed, { winners: [], draw: false });
    return next;
  }
}

/** Every word the level allows, with its theme. */
export function hangWords(levelId: string): { word: string; theme: string }[] {
  const level = HANG_LEVELS[levelId] ?? HANG_LEVELS.classic!;
  return THEMES.flatMap((t) => t.words.filter((w) => w.length >= level.min && w.length <= level.max && /^[a-z]+$/.test(w)).map((word) => ({ word, theme: t.name })));
}

export function newHangman(seed: number, levelId = 'classic'): HangState {
  const id = HANG_LEVELS[levelId] ? levelId : 'classic';
  const pick = createRng(seed).pick(hangWords(id));
  return new HangState(id, pick.word, pick.theme, [], null);
}

/** Test play: guess the commonest letters first, as a person would. */
function createHangBot(): Bot<HangMove> {
  const order = 'eaoirtnslcudpmhgbfywkvxzjq';
  return {
    chooseMove(generic: GameState<HangMove>, _seat: Seat, _rng: Rng): HangMove {
      const s = generic as HangState;
      const letter = [...order].find((l) => !s.guessed.includes(l))!;
      return `g${letter}`;
    },
  };
}

export const hangman: GameDefinition<HangMove> = {
  id: 'hangman',
  name: 'Hangman',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo', 'race'],
  hiddenInfo: true,
  realtime: false,
  newGame: (config, seed) => newHangman(seed, config.variant ?? 'classic'),
  createBot: () => createHangBot(),
  encodeMove: (move) => move,
};
