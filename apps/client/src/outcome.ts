import type { GameResult } from '@gamepals/rules';
import type { SeatController } from './session';

export type Outcome = 'win' | 'lose' | 'draw';

/** A win against bots is "yours" only if a person won; a people-only (or bots-only) game is always celebrated. */
export function outcomeOf(result: GameResult, seats: readonly SeatController[]): Outcome {
  if (result.draw) return 'draw';
  const vsBot = seats.some((seat) => seat.kind === 'bot');
  const humans = seats.filter((seat) => seat.kind === 'human').length;
  if (!vsBot || humans === 0) return 'win';
  return seats[result.winners[0] ?? 0]?.kind === 'human' ? 'win' : 'lose';
}

/** Headline for the result sheet, e.g. "You win! 🎉" or "Hard bot (O) wins. Rematch?". */
export function resultTitle(result: GameResult, seats: readonly SeatController[], sideName: (seat: number) => string): string {
  const outcome = outcomeOf(result, seats);
  const winner = result.winners[0] ?? 0;
  const humans = seats.filter((s) => s.kind === 'human').length;
  if (outcome === 'draw') return "It's a draw 🤝";
  if (outcome === 'lose') return `${sideName(winner)} wins. Rematch?`;
  if (humans === 1 && seats[winner]?.kind === 'human') return 'You win! 🎉';
  return `${sideName(winner)} wins! 🎉`;
}
