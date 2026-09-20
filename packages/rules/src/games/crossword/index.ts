import { createRng, type Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';
import { CLUES } from './clues';
import { layPuzzle, SIDE, type Slot, wordIn } from './grid';

export { CLUES } from './clues';
export { PATTERNS, SIDE, slotsOf, wordIn, type Puzzle, type Slot } from './grid';

/**
 * Mini Crossword (docs/games/mini-crossword.md). A 5x5 laid fresh from the clue dictionary, so
 * there is no puzzle count to run out of.
 *
 * Moves: `w<r><c><letter>` writes a letter, `w<r><c>-` rubs one out, `?` asks to be told which
 * letters are wrong. Asking is a move so it lands in the log and the result can say it happened.
 */
export type CrossMove = string;
export const writeIn = (row: number, col: number, letter: string): CrossMove => `w${row}${col}${letter}`;
export const rubOut = (row: number, col: number): CrossMove => `w${row}${col}-`;
export const CHECK: CrossMove = '?';

export const BLOCK = '#';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

export class CrossState implements GameState<CrossMove> {
  constructor(
    /** The answer, one string per row, '#' for a black square. */
    readonly answer: readonly string[],
    readonly slots: readonly Slot[],
    /** What has been written so far, same shape, ' ' for an empty square. */
    readonly filled: readonly string[],
    readonly checked: boolean,
    readonly currentSeat: Seat,
    readonly moves: number,
    readonly result: GameResult | null,
  ) {}

  blockAt(row: number, col: number): boolean {
    return this.answer[row]?.[col] === BLOCK;
  }

  letterAt(row: number, col: number): string {
    const letter = this.filled[row]?.[col] ?? ' ';
    return letter === ' ' ? '' : letter;
  }

  /** Right letter in a square somebody has filled. Only used once they have asked. */
  rightAt(row: number, col: number): boolean {
    return this.letterAt(row, col) === this.answer[row]?.[col];
  }

  clueFor(slot: Slot): string {
    return CLUES[wordIn(this.answer, slot)] ?? '';
  }

  get left(): number {
    let left = 0;
    for (let r = 0; r < SIDE; r++) {
      for (let c = 0; c < SIDE; c++) if (!this.blockAt(r, c) && !this.letterAt(r, c)) left++;
    }
    return left;
  }

  get done(): boolean {
    return this.filled.join('|') === this.answer.join('|');
  }

  /**
   * Every letter in every open square, rubbing out, and asking. It has to be everything `apply`
   * takes: `replay` is the server referee and checks each move against this, and a crossword
   * where only the right letter is listed cannot verify a single real game, because typing a
   * wrong letter and fixing it is the game.
   */
  legalMoves(seat: Seat): readonly CrossMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    const moves: CrossMove[] = [CHECK];
    for (let r = 0; r < SIDE; r++) {
      for (let c = 0; c < SIDE; c++) {
        if (this.blockAt(r, c)) continue;
        for (const letter of LETTERS) moves.push(writeIn(r, c, letter));
        if (this.letterAt(r, c)) moves.push(rubOut(r, c));
      }
    }
    return moves;
  }

  /** The answer for one square. What the autoplayer writes, since a solo puzzle has no opponent. */
  rightAtSquare(row: number, col: number): string {
    return this.answer[row]?.[col] ?? '';
  }

  apply(move: CrossMove): CrossState {
    if (this.result) throw new Error('Game is over');
    if (move === CHECK) {
      return new CrossState(this.answer, this.slots, this.filled, true, 0, this.moves + 1, null);
    }
    const match = /^w([0-4])([0-4])([a-z]|-)$/.exec(move);
    if (!match) throw new Error(`Illegal move: ${move}`);
    const row = Number(match[1]);
    const col = Number(match[2]);
    const letter = match[3]!;
    if (this.blockAt(row, col)) throw new Error(`Illegal move: ${move}`);
    const rows = this.filled.map((line, r) =>
      r === row ? line.slice(0, col) + (letter === '-' ? ' ' : letter) + line.slice(col + 1) : line,
    );
    const next = new CrossState(this.answer, this.slots, rows, this.checked, 0, this.moves + 1, null);
    if (!next.done) return next;
    return new CrossState(this.answer, this.slots, rows, this.checked, 0, this.moves + 1, {
      winners: [0],
      draw: false,
    });
  }
}

export function newCrossword(seed: number): CrossState {
  const puzzle = layPuzzle(createRng(seed >>> 0));
  const filled = puzzle.rows.map((row) => [...row].map((cell) => (cell === BLOCK ? BLOCK : ' ')).join(''));
  return new CrossState(puzzle.rows, puzzle.slots, filled, false, 0, 0, null);
}

/** What a seat may know: the shape, the clues and what is written. Never the answer. */
export interface CrossView {
  readonly blocks: readonly string[];
  readonly clues: readonly { readonly slot: Slot; readonly clue: string }[];
  readonly filled: readonly string[];
}

export const crossViewFor = (state: CrossState): CrossView => ({
  blocks: state.answer.map((row) => [...row].map((cell) => (cell === BLOCK ? BLOCK : '.')).join('')),
  clues: state.slots.map((slot) => ({ slot, clue: state.clueFor(slot) })),
  filled: state.filled,
});

/**
 * A solo puzzle has no opponent to be fair to, so the bot is an autoplayer: it fills squares so a
 * test build can finish a game. The tiers differ in the order they go, which is all that is
 * visible from outside.
 */
function createCrossBot(tidy: boolean): Bot<CrossMove> {
  return {
    chooseMove(generic: GameState<CrossMove>, _seat: Seat, rng: Rng): CrossMove {
      const state = generic as CrossState;
      // The list of moves is every letter in every square now, so the autoplayer picks the right
      // one itself rather than leaning on the list to have done the thinking.
      const empty: { row: number; col: number }[] = [];
      for (let row = 0; row < SIDE; row++) {
        for (let col = 0; col < SIDE; col++) {
          if (!state.blockAt(row, col) && !state.letterAt(row, col)) empty.push({ row, col });
        }
      }
      if (!empty.length) throw new Error('No legal moves');
      const square = tidy ? empty[0]! : empty[rng.int(empty.length)]!;
      return writeIn(square.row, square.col, state.rightAtSquare(square.row, square.col));
    },
  };
}

const TIERS: Record<BotTier, boolean> = { easy: false, medium: false, hard: true, expert: true };

export const crosswordGame: GameDefinition<CrossMove> = {
  id: 'mini-crossword',
  name: 'Mini Crossword',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo'],
  hiddenInfo: false,
  realtime: false,
  newGame: (_config, seed) => newCrossword(seed),
  createBot: (tier) => createCrossBot(TIERS[tier]),
  encodeMove: (move) => move,
};
