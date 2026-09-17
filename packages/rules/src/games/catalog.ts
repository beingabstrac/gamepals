import type { MoveLog } from '../core/replay';
import { createRng } from '../core/rng';
import type { BotTier, GameDefinition, GameState, Seat } from '../core/types';
import { checkers } from './checkers';
import { chess } from './chess';
import { colorSort } from './color-sort';
import { dominoes } from './dominoes';
import { dotsAndBoxes } from './dots-and-boxes';
import { echo } from './echo';
import { fourInARow } from './four-in-a-row';
import { ludo } from './ludo';
import { mancala } from './mancala';
import { memory } from './memory';
import { reversi } from './reversi';
import { shutTheBox } from './shut-the-box';
import { slidingPuzzle } from './sliding-puzzle';
import { snakesAndLadders } from './snakes-and-ladders';
import { solitaire } from './solitaire';
import { sudoku } from './sudoku';
import { ticTacToe } from './tic-tac-toe';
import { twenty48 } from './twenty48';
import { ultimateTtt } from './ultimate-ttt';
import { yatzy } from './yatzy';

/** A game looked up by id, where the kind of move no longer matters. */
export type AnyTurnGame = GameDefinition<unknown>;

/** Every turn-based game by id. Real-time games run their own simulation and aren't here. */
export const TURN_GAMES: Readonly<Record<string, AnyTurnGame>> = Object.fromEntries(
  (
    [
      ticTacToe,
      fourInARow,
      ludo,
      twenty48,
      sudoku,
      solitaire,
      memory,
      slidingPuzzle,
      colorSort,
      echo,
      checkers,
      chess,
      reversi,
      dotsAndBoxes,
      mancala,
      snakesAndLadders,
      ultimateTtt,
      yatzy,
      shutTheBox,
      dominoes,
    ] as unknown as AnyTurnGame[]
  ).map((game) => [game.id, game]),
);

/**
 * Games whose bots search deep or run playouts, so a move can take long enough to be felt.
 * These are the ones worth handing to a worker; the rest decide in well under a millisecond,
 * where a message round trip would cost far more than the thinking it saves.
 */
export const HEAVY_BOTS: ReadonlySet<string> = new Set(['chess', 'checkers', 'reversi', 'ultimate-ttt', 'mancala', 'dominoes', 'yatzy', 'shut-the-box']);

/**
 * Everything a bot needs to pick a move away from the screen (in a Web Worker, or on a server).
 * Only the move log crosses over: the rules are pure, so the game is rebuilt exactly.
 */
export interface BotRequest {
  readonly log: MoveLog;
  readonly seat: Seat;
  readonly tier: BotTier;
  /** Seeds the bot's own random stream, so the same request always gives the same move. */
  readonly rngSeed: number;
}

/**
 * Games in progress, so a bot asked move after move doesn't replay the whole log each time.
 * Without this, one decision costs as much as the game so far, and long games (2048 runs to
 * hundreds of moves) crawl. Keyed by game, seed and config; a few games are kept for hot seats.
 */
interface Resumed {
  readonly key: string;
  readonly moves: readonly string[];
  readonly state: GameState<unknown>;
}
const RESUME_LIMIT = 4;
const resumable: Resumed[] = [];

const logKey = (log: MoveLog) => `${log.gameId}|${log.seed}|${log.config.players}|${log.config.variant ?? ''}`;

/** The state after `log.moves`, continuing a kept game when the log extends it. */
function stateFor(game: AnyTurnGame, log: MoveLog): GameState<unknown> {
  const key = logKey(log);
  const kept = resumable.find((r) => r.key === key && r.moves.length <= log.moves.length && r.moves.every((m, i) => m === log.moves[i]));
  let state = kept ? kept.state : game.newGame(log.config, log.seed);
  for (let i = kept ? kept.moves.length : 0; i < log.moves.length; i++) {
    const encoded = log.moves[i]!;
    if (state.result) throw new Error(`Move ${i} (${encoded}) played after the game ended`);
    const move = state.legalMoves(state.currentSeat).find((m) => game.encodeMove(m) === encoded);
    if (move === undefined) throw new Error(`Move ${i} (${encoded}) is illegal`);
    state = state.apply(move);
  }
  const at = resumable.findIndex((r) => r.key === key);
  if (at >= 0) resumable.splice(at, 1);
  resumable.unshift({ key, moves: [...log.moves], state });
  resumable.length = Math.min(resumable.length, RESUME_LIMIT);
  return state;
}

/** Rebuilds the game from the log and returns the bot's move in its encoded (string) form. */
export function chooseBotMove({ log, seat, tier, rngSeed }: BotRequest): string {
  const game = TURN_GAMES[log.gameId];
  if (!game) throw new Error(`No rules for ${log.gameId}`);
  const state = stateFor(game, log);
  const move = game.createBot(tier).chooseMove(state, seat, createRng(rngSeed));
  return game.encodeMove(move);
}
