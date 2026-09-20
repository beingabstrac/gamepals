import { createRng, type Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';
import { PUZZLES, type Group } from './puzzles';

export { PUZZLES, type Group, type GroupPuzzle } from './puzzles';

/**
 * Word Groups (docs/games/word-groups.md). Sixteen words, four secret groups of four, four wrong
 * guesses.
 *
 * Moves: `g<word>,<word>,<word>,<word>` guesses a group, sorted so the same four are the same
 * move whichever order they were tapped in. `x` shuffles the board.
 */
export type GroupMove = string;
export const guess = (words: readonly string[]): GroupMove => `g${[...words].sort().join(',')}`;
export const SHUFFLE: GroupMove = 'x';

export const LIVES = 4;
export const GROUP_SIZE = 4;

export class GroupsState implements GameState<GroupMove> {
  private cached?: GroupMove[];

  constructor(
    readonly puzzle: number,
    /** The sixteen words in the order they are laid out. */
    readonly board: readonly string[],
    /** Which of the puzzle's groups have been found, in the order they were found. */
    readonly found: readonly number[],
    readonly lives: number,
    /** The last guess that was wrong, for saying how close it was. */
    readonly lastWrong: readonly string[] | null,
    readonly currentSeat: Seat,
    readonly moves: number,
    readonly result: GameResult | null,
  ) {}

  get groups(): readonly Group[] {
    return PUZZLES[this.puzzle]!.groups;
  }

  /** The words still in play, in board order. */
  get left(): readonly string[] {
    const done = new Set(this.found.flatMap((index) => this.groups[index]!.words));
    return this.board.filter((word) => !done.has(word));
  }

  get won(): boolean {
    return this.found.length === this.groups.length;
  }

  /** How many of the last wrong guess belonged to one group. Three is "one away". */
  get away(): number {
    if (!this.lastWrong) return 0;
    return Math.max(...this.groups.map((group) => this.lastWrong!.filter((word) => group.words.includes(word)).length));
  }

  private groupOf(words: readonly string[]): number {
    const sorted = [...words].sort().join(',');
    return this.groups.findIndex((group) => [...group.words].sort().join(',') === sorted);
  }

  /**
   * Every four of the words still in play, plus the shuffle. That is 1,820 at the start and it
   * has to be, because `replay` is the server referee and checks each move against this list: a
   * list holding only the right four could not verify a single real game, since guessing wrong
   * is how the game is played. `right()` is the short list a bot picks from.
   */
  legalMoves(seat: Seat): readonly GroupMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    if (this.cached) return this.cached;
    const left = this.left;
    const moves: GroupMove[] = [SHUFFLE];
    for (let a = 0; a < left.length; a++) {
      for (let b = a + 1; b < left.length; b++) {
        for (let c = b + 1; c < left.length; c++) {
          for (let d = c + 1; d < left.length; d++) {
            moves.push(guess([left[a]!, left[b]!, left[c]!, left[d]!]));
          }
        }
      }
    }
    return (this.cached = moves);
  }

  /** The groups still to find. What an autoplayer picks from, not what the referee allows. */
  right(): readonly GroupMove[] {
    const done = new Set(this.found);
    return this.groups
      .map((group, index) => ({ group, index }))
      .filter(({ index }) => !done.has(index))
      .map(({ group }) => guess(group.words));
  }

  apply(move: GroupMove): GroupsState {
    if (this.result) throw new Error('Game is over');
    if (move === SHUFFLE) {
      const rng = createRng((this.puzzle + 1) * 7919 + this.moves);
      const board = [...this.board];
      for (let i = board.length - 1; i > 0; i--) {
        const j = rng.int(i + 1);
        [board[i], board[j]] = [board[j]!, board[i]!];
      }
      return new GroupsState(this.puzzle, board, this.found, this.lives, this.lastWrong, 0, this.moves + 1, null);
    }
    const words = move.startsWith('g') ? move.slice(1).split(',') : [];
    const left = new Set(this.left);
    if (words.length !== GROUP_SIZE || new Set(words).size !== GROUP_SIZE) throw new Error(`Illegal move: ${move}`);
    if (!words.every((word) => left.has(word))) throw new Error(`Illegal move: ${move}`);
    const index = this.groupOf(words);
    if (index >= 0) {
      const found = [...this.found, index];
      const won = found.length === this.groups.length;
      const result: GameResult | null = won ? { winners: [0], draw: false } : null;
      return new GroupsState(this.puzzle, this.board, found, this.lives, null, 0, this.moves + 1, result);
    }
    const lives = this.lives - 1;
    // Out of lives: the game ends and the groups not found are there to be read.
    const result: GameResult | null = lives <= 0 ? { winners: [], draw: false } : null;
    return new GroupsState(this.puzzle, this.board, this.found, lives, words, 0, this.moves + 1, result);
  }
}

export function newWordGroups(seed: number): GroupsState {
  const rng = createRng(seed >>> 0);
  const puzzle = rng.int(PUZZLES.length);
  const board = PUZZLES[puzzle]!.groups.flatMap((group) => group.words);
  for (let i = board.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [board[i], board[j]] = [board[j]!, board[i]!];
  }
  return new GroupsState(puzzle, board, [], LIVES, null, 0, 0, null);
}

/** What a seat may know: the words and how many lives are left. Never which group is which. */
export interface GroupsView {
  readonly left: readonly string[];
  readonly lives: number;
}

export const groupsViewFor = (state: GroupsState): GroupsView => ({ left: state.left, lives: state.lives });

/**
 * A solo puzzle has no opponent to be fair to, so the bot is an autoplayer. The weak tiers throw
 * a wrong four in first, which is what the lives are for and what a test build should exercise.
 */
function createGroupsBot(wrongFirst: number): Bot<GroupMove> {
  return {
    chooseMove(generic: GameState<GroupMove>, _seat: Seat, rng: Rng): GroupMove {
      const state = generic as GroupsState;
      const right = state.right();
      if (!right.length) throw new Error('No legal moves');
      // A deliberate wrong guess: four of the words still in play that are not a group.
      if (wrongFirst > 0 && state.lives > LIVES - wrongFirst && state.left.length > GROUP_SIZE) {
        const left = state.left;
        for (let attempt = 0; attempt < 30; attempt++) {
          const picked = new Set<string>();
          while (picked.size < GROUP_SIZE) picked.add(left[rng.int(left.length)]!);
          const move = guess([...picked]);
          if (!right.includes(move)) return move;
        }
      }
      return right[rng.int(right.length)]!;
    },
  };
}

const TIERS: Record<BotTier, number> = { easy: 2, medium: 1, hard: 0, expert: 0 };

export const wordGroupsGame: GameDefinition<GroupMove> = {
  id: 'word-groups',
  name: 'Word Groups',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo'],
  hiddenInfo: true,
  realtime: false,
  newGame: (_config, seed) => newWordGroups(seed),
  createBot: (tier) => createGroupsBot(TIERS[tier]),
  encodeMove: (move) => move,
};
