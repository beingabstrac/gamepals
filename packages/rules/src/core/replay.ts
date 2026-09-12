import type { GameConfig, GameDefinition, GameState } from './types';

/** Canonical record of a game: everything needed to reproduce it exactly. */
export interface MoveLog {
  readonly gameId: string;
  readonly seed: number;
  readonly config: GameConfig;
  readonly moves: readonly string[];
}

/**
 * Rebuilds a game from its move log, rejecting any illegal move.
 * Used by the server referee to verify results and by clients to resume games.
 */
export function replay<M>(definition: GameDefinition<M>, log: MoveLog): GameState<M> {
  if (log.gameId !== definition.id) {
    throw new Error(`Move log is for ${log.gameId}, not ${definition.id}`);
  }
  let state = definition.newGame(log.config, log.seed);
  log.moves.forEach((key, index) => {
    if (state.result) throw new Error(`Move ${index} (${key}) played after the game ended`);
    const move = state.legalMoves(state.currentSeat).find((m) => definition.encodeMove(m) === key);
    if (move === undefined) throw new Error(`Move ${index} (${key}) is illegal`);
    state = state.apply(move);
  });
  return state;
}

export function toMoveLog<M>(
  definition: GameDefinition<M>,
  config: GameConfig,
  seed: number,
  moves: readonly M[],
): MoveLog {
  return { gameId: definition.id, seed, config, moves: moves.map((m) => definition.encodeMove(m)) };
}
