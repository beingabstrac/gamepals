import type { GameDefinition, GameState } from './types';

/**
 * The move a logged string stands for in this position, or undefined if it is not legal here.
 * Every place a move arrives from outside (a move log, the bot worker, the server) goes through this,
 * so a game that answers `accepts` is checked by it and every other game by its list.
 */
export function moveFor<M>(definition: GameDefinition<M>, state: GameState<M>, key: string): M | undefined {
  if (state.accepts && definition.decodeMove) {
    const move = definition.decodeMove(key);
    return move !== null && state.accepts(move) ? move : undefined;
  }
  return state.legalMoves(state.currentSeat).find((m) => definition.encodeMove(m) === key);
}

/** Whether the side to move may play `move` here. */
export function isLegalMove<M>(state: GameState<M>, move: M): boolean {
  return state.accepts ? state.accepts(move) : state.legalMoves(state.currentSeat).includes(move);
}
