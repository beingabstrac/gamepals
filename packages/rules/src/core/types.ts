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
  /** Legal moves for `seat`; empty when it isn't that seat's turn or the game is over. */
  legalMoves(seat: Seat): readonly M[];
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
}
