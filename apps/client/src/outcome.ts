import type { GameResult } from '@gamepals/rules';
import type { SeatController } from './session';

export type Outcome = 'win' | 'lose' | 'draw';

const isPerson = (seats: readonly SeatController[], seat: number) => seats[seat]?.kind === 'human';

/**
 * A win against bots is "yours" when any person is among the winners (ties for first count);
 * a people-only (or bots-only) game is always celebrated.
 */
export function outcomeOf(result: GameResult, seats: readonly SeatController[]): Outcome {
  // Solo puzzles: celebrate reaching the goal; otherwise it's just "game over".
  if (seats.length === 1) return result.winners.includes(0) ? 'win' : 'draw';
  if (result.draw || result.winners.length === 0) return 'draw';
  const vsBot = seats.some((seat) => seat.kind === 'bot');
  const humans = seats.filter((seat) => seat.kind === 'human').length;
  if (!vsBot || humans === 0) return 'win';
  return result.winners.some((seat) => isPerson(seats, seat)) ? 'win' : 'lose';
}

/** "Red", "Red and Blue", "Red, Blue and Green". */
function joinNames(names: readonly string[]): string {
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : (names[0] ?? '');
}

/** Headline for the result sheet, e.g. "You win! 🎉", "Bo (O) wins. Rematch?" or "You and Bo share the win! 🎉". */
export function resultTitle(result: GameResult, seats: readonly SeatController[], sideName: (seat: number) => string): string {
  const outcome = outcomeOf(result, seats);
  if (outcome === 'draw') return "It's a draw 🤝";
  const shared = result.winners.length > 1;
  const humans = seats.filter((s) => s.kind === 'human').length;
  const you = humans === 1;
  const names = result.winners.map((seat) => (you && isPerson(seats, seat) ? 'You' : sideName(seat)));
  const who = joinNames(names);
  if (outcome === 'lose') return `${who} ${shared ? 'share the win' : 'wins'}. Rematch?`;
  if (you && !shared && isPerson(seats, result.winners[0]!)) return 'You win! 🎉';
  return `${who} ${shared ? 'share the win' : names[0] === 'You' ? 'win' : 'wins'}! 🎉`;
}
