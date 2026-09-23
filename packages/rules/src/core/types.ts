import type { Rng } from './rng';

/** Seat index in a game: 0 = first player. */
export type Seat = number;

export type BotTier = 'easy' | 'medium' | 'hard' | 'expert';
export const BOT_TIERS: readonly BotTier[] = ['easy', 'medium', 'hard', 'expert'];

export type PlayMode = 'solo' | 'bot' | 'sameDevice' | 'onlineLive' | 'async' | 'race';

/** A finished game. A draw has no winners. */
export interface GameResult {
  readonly winners: readonly Seat[];
  readonly draw: boolean;
}

export interface GameConfig {
  readonly players: number;
  readonly variant?: string;
}

/**
 * Immutable game state. `apply` returns a new state and never mutates this one,
 * so the same rules run in the client, in bots (search) and on the server (referee).
 */
export interface GameState<M> {
  readonly currentSeat: Seat;
  readonly result: GameResult | null;
  /**
   * Legal moves for `seat`; empty when it isn't that seat's turn or the game is over.
   *
   * **This must list everything `apply` accepts, not the shorter list a bot would pick from.**
   * `replay` is the server referee and checks each move against this, so anything `apply` takes
   * and this leaves out is a move a person can really make and the server will then refuse to
   * verify. Four of the word games shipped or nearly shipped that way: Word Guess listed only
   * answers while taking any real word, the crossword listed only the right letter while the
   * whole game is typing wrong ones. Where a bot needs a shorter list, give it its own method
   * (`candidates`, `right`) rather than narrowing this one.
   */
  legalMoves(seat: Seat): readonly M[];
  /**
   * For games whose moves are points in a space too big to list: a pool shot is a direction, a power
   * and sometimes a placement, millions of them. When a state answers this, it is the authority on
   * what `apply` takes, and `legalMoves` is a spread of moves for bots and tests rather than all of
   * them. Every other game leaves it out and `legalMoves` stays the whole list. Look moves up with
   * `moveFor` and `isLegalMove` (core/moves.ts), which know the difference.
   */
  accepts?(move: M): boolean;
  /** Throws on an illegal move. */
  apply(move: M): GameState<M>;
}

export interface Bot<M> {
  chooseMove(state: GameState<M>, seat: Seat, rng: Rng): M;
}

/**
 * Real-time games (e.g. Air Hockey) run a fixed-step simulation instead of discrete moves;
 * their rules module exports a pure `step` function next to this definition.
 */
export interface RealtimeGameDefinition {
  readonly id: string;
  readonly name: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  readonly modes: readonly PlayMode[];
  readonly realtime: true;
}

export interface GameDefinition<M> {
  readonly id: string;
  readonly name: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  readonly modes: readonly PlayMode[];
  readonly hiddenInfo: boolean;
  readonly realtime: boolean;
  /** All randomness (shuffles, dice) must come from `seed` so games replay identically everywhere. */
  newGame(config: GameConfig, seed: number): GameState<M>;
  createBot(tier: BotTier): Bot<M>;
  /** Stable string form of a move, used in move logs and network messages. */
  encodeMove(move: M): string;
  /** The move a string stands for, for games whose states answer `accepts`; null if it is not one. */
  decodeMove?(key: string): M | null;
}
