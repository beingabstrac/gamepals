import type { GameState, Seat } from './types';

export const WIN_SCORE = 1_000_000;

/** Heuristic value of a non-terminal position from `seat`'s point of view. */
export type Evaluate<M> = (state: GameState<M>, seat: Seat) => number;

export interface ScoredMove<M> {
  readonly move: M;
  readonly score: number;
}

function terminalScore<M>(state: GameState<M>, seat: Seat, ply: number): number {
  const result = state.result!;
  if (result.draw) return 0;
  // Prefer faster wins and slower losses.
  return result.winners.includes(seat) ? WIN_SCORE - ply : -WIN_SCORE + ply;
}

/**
 * Negamax with alpha-beta pruning for two-player, zero-sum, perfect-information games.
 * Returns the score from the side to move. Handles games where a player can move twice
 * in a row (the score is only negated when the turn actually passes).
 */
function negamax<M>(
  state: GameState<M>,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  evaluate: Evaluate<M>,
): number {
  const seat = state.currentSeat;
  if (state.result) return terminalScore(state, seat, ply);
  if (depth <= 0) return evaluate(state, seat);

  let best = -Infinity;
  for (const move of state.legalMoves(seat)) {
    const child = state.apply(move);
    const score =
      child.currentSeat === seat
        ? negamax(child, depth - 1, alpha, beta, ply + 1, evaluate)
        : -negamax(child, depth - 1, -beta, -alpha, ply + 1, evaluate);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** Exact score (up to `depth`) of every legal move for the side to move. */
export function scoreMoves<M>(state: GameState<M>, depth: number, evaluate: Evaluate<M>): ScoredMove<M>[] {
  const seat = state.currentSeat;
  return state.legalMoves(seat).map((move) => {
    const child = state.apply(move);
    const score =
      child.currentSeat === seat
        ? negamax(child, depth - 1, -Infinity, Infinity, 1, evaluate)
        : -negamax(child, depth - 1, -Infinity, Infinity, 1, evaluate);
    return { move, score };
  });
}
