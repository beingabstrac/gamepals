import { replay, type MoveLog } from '../core/replay';
import { createRng } from '../core/rng';
import type { BotTier, GameDefinition, Seat } from '../core/types';
import { checkers } from './checkers';
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

/** Replays the log and returns the bot's move in its encoded (string) form. */
export function chooseBotMove({ log, seat, tier, rngSeed }: BotRequest): string {
  const game = TURN_GAMES[log.gameId];
  if (!game) throw new Error(`No rules for ${log.gameId}`);
  const state = replay(game, log);
  const move = game.createBot(tier).chooseMove(state, seat, createRng(rngSeed));
  return game.encodeMove(move);
}
