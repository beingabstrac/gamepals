import { createRng, type Rng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Code Breaker (docs/games/code-breaker.md): the phone hides a row of colored pegs; you guess, and
 * each guess is marked with how many pegs are the right color in the right place (full dots) and
 * how many are the right color in the wrong place (open dots). Crack it before the rows run out.
 */
export interface CodeLevel {
  readonly pegs: number;
  readonly colors: number;
  /** Can a color come up more than once in the code? */
  readonly repeats: boolean;
  readonly rows: number;
}

export const CODE_LEVELS: Readonly<Record<string, CodeLevel>> = {
  easy: { pegs: 4, colors: 6, repeats: false, rows: 10 },
  classic: { pegs: 4, colors: 6, repeats: true, rows: 10 },
  hard: { pegs: 5, colors: 8, repeats: true, rows: 12 },
};

/** A guess as a move: `g` and one digit per peg, colors counted from 0. */
export type CodeMove = string;

export interface Marked {
  readonly guess: readonly number[];
  /** Right color, right place. */
  readonly exact: number;
  /** Right color, wrong place. */
  readonly near: number;
}

/** How a guess scores against a code. */
export function mark(code: readonly number[], guess: readonly number[]): { exact: number; near: number } {
  let exact = 0;
  const left: number[] = [];
  const tried: number[] = [];
  code.forEach((c, i) => {
    if (guess[i] === c) exact++;
    else {
      left.push(c);
      tried.push(guess[i]!);
    }
  });
  let near = 0;
  for (const g of tried) {
    const at = left.indexOf(g);
    if (at >= 0) {
      near++;
      left.splice(at, 1);
    }
  }
  return { exact, near };
}

export const parseGuess = (move: string, level: CodeLevel): number[] | null => {
  if (!/^g\d+$/.test(move) || move.length !== level.pegs + 1) return null;
  const guess = [...move.slice(1)].map(Number);
  return guess.every((c) => c < level.colors) ? guess : null;
};

export class CodeState implements GameState<CodeMove> {
  readonly currentSeat: Seat = 0;

  constructor(
    readonly levelId: string,
    readonly code: readonly number[],
    readonly rows: readonly Marked[],
    readonly result: GameResult | null,
  ) {}

  get level(): CodeLevel {
    return CODE_LEVELS[this.levelId]!;
  }

  /** Any row of the right length and colors is a guess, even one the clues already rule out. */
  allows(move: CodeMove): boolean {
    return !this.result && parseGuess(move, this.level) !== null;
  }

  /**
   * Every guess is thousands of moves (32,768 on Hard), so `allows` is the authority and this is a
   * spread for bots and tests: the codes still possible from the clues so far.
   */
  legalMoves(seat: Seat): readonly CodeMove[] {
    if (this.result || seat !== 0) return [];
    return possibleCodes(this.level, this.rows).map((c) => `g${c.join('')}`);
  }

  apply(move: CodeMove): CodeState {
    const guess = this.allows(move) ? parseGuess(move, this.level)! : null;
    if (!guess) throw new Error(`Illegal move: ${move}`);
    const { exact, near } = mark(this.code, guess);
    const rows = [...this.rows, { guess, exact, near }];
    if (exact === this.level.pegs) return new CodeState(this.levelId, this.code, rows, { winners: [0], draw: false });
    if (rows.length >= this.level.rows) return new CodeState(this.levelId, this.code, rows, { winners: [], draw: false });
    return new CodeState(this.levelId, this.code, rows, null);
  }
}

/** Every code of this level, in order. */
function allCodes(level: CodeLevel): number[][] {
  const out: number[][] = [];
  const total = Math.pow(level.colors, level.pegs);
  for (let n = 0; n < total; n++) {
    const code: number[] = [];
    let k = n;
    for (let i = 0; i < level.pegs; i++) {
      code.push(k % level.colors);
      k = Math.floor(k / level.colors);
    }
    if (!level.repeats && new Set(code).size !== code.length) continue;
    out.push(code.reverse());
  }
  return out;
}

/** The codes that would have given every clue so far. */
export function possibleCodes(level: CodeLevel, rows: readonly Marked[]): number[][] {
  return allCodes(level).filter((c) =>
    rows.every((r) => {
      const m = mark(c, r.guess);
      return m.exact === r.exact && m.near === r.near;
    }),
  );
}

export function newCodeBreaker(seed: number, levelId = 'classic'): CodeState {
  const level = CODE_LEVELS[levelId] ?? CODE_LEVELS.classic!;
  const rng = createRng(seed);
  const code: number[] = [];
  while (code.length < level.pegs) {
    const c = rng.int(level.colors);
    if (level.repeats || !code.includes(c)) code.push(c);
  }
  return new CodeState(CODE_LEVELS[levelId] ? levelId : 'classic', code, [], null);
}

/** Test play: always guess a code the clues still allow. Solves in about five. */
function createCodeBot(): Bot<CodeMove> {
  return {
    chooseMove(generic: GameState<CodeMove>, _seat: Seat, rng: Rng): CodeMove {
      return rng.pick((generic as CodeState).legalMoves(0));
    },
  };
}

export const codeBreaker: GameDefinition<CodeMove> = {
  id: 'code-breaker',
  name: 'Code Breaker',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo', 'race'],
  hiddenInfo: true,
  realtime: false,
  newGame: (config, seed) => newCodeBreaker(seed, config.variant ?? 'classic'),
  createBot: () => createCodeBot(),
  encodeMove: (move) => move,
  decodeMove: (key) => (/^g\d+$/.test(key) ? key : null),
};
