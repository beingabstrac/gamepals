import type { Rng } from './rng';
import { scoreMoves, type Evaluate } from './search';
import type { Bot, GameState, Seat } from './types';

/** Knobs for a search-based bot tier. Kept as data so tiers can be tuned remotely. */
export interface SearchTier {
  /** Plies to search. */
  readonly depth: number;
  /** Chance of playing a random legal move instead of searching (makes easy tiers beatable). */
  readonly randomMoveRate: number;
}

/**
 * Bot for perfect-information games: sometimes plays randomly, otherwise picks
 * uniformly among the best-scoring moves so play varies between games.
 */
export function createSearchBot<M>(tier: SearchTier, evaluate: Evaluate<M>): Bot<M> {
  return {
    chooseMove(state: GameState<M>, seat: Seat, rng: Rng): M {
      if (state.currentSeat !== seat) throw new Error(`Not seat ${seat}'s turn`);
      const moves = state.legalMoves(seat);
      if (moves.length === 0) throw new Error('No legal moves');
      if (rng.next() < tier.randomMoveRate) return rng.pick(moves);

      const scored = scoreMoves(state, tier.depth, evaluate);
      const best = Math.max(...scored.map((s) => s.score));
      return rng.pick(scored.filter((s) => s.score === best)).move;
    },
  };
}
