import type { Seat } from '../core/types';
import { rankOf, suitOf } from './cards';

/**
 * The bones of a trick-taking game, shared by the games that play them
 * (docs/games/hearts.md). Nothing here knows about points, bidding or trumps beyond being
 * told which suit is trump, so Hearts, Spades and Callbreak can all sit on it.
 */

/** Aces are high everywhere these games are played, so an ace counts 14. */
export const trickRank = (card: number): number => (rankOf(card) === 1 ? 14 : rankOf(card));

/** One card played by one seat, in the order they were played. */
export interface Played {
  readonly seat: Seat;
  readonly card: number;
}

/** The suit everybody must follow: whatever was led. */
export const ledSuit = (trick: readonly Played[]): number | null => (trick.length ? suitOf(trick[0]!.card) : null);

/** Can this seat play this card, given what is in their hand and what was led? */
export function follows(hand: readonly number[], trick: readonly Played[], card: number): boolean {
  const led = ledSuit(trick);
  if (led === null) return true;
  if (suitOf(card) === led) return true;
  // Playing off-suit is only allowed when the suit that was led is not in the hand.
  return !hand.some((held) => suitOf(held) === led);
}

/**
 * Who wins: the highest trump if any were played, otherwise the highest card of the suit led.
 * `trump` is -1 for a game without one.
 */
export function trickWinner(trick: readonly Played[], trump = -1): Seat {
  const led = ledSuit(trick)!;
  const suit = trump >= 0 && trick.some((play) => suitOf(play.card) === trump) ? trump : led;
  let best = trick.find((play) => suitOf(play.card) === suit)!;
  for (const play of trick) {
    if (suitOf(play.card) !== suit) continue;
    if (trickRank(play.card) > trickRank(best.card)) best = play;
  }
  return best.seat;
}

/** Which suits a seat has shown it has none of, from the tricks everybody watched. */
export function voidsFrom(tricks: readonly (readonly Played[])[]): Map<Seat, Set<number>> {
  const voids = new Map<Seat, Set<number>>();
  for (const trick of tricks) {
    const led = ledSuit(trick);
    if (led === null) continue;
    for (const play of trick) {
      if (suitOf(play.card) === led) continue;
      // They did not follow, so everybody at the table knows that suit is gone from their hand.
      const known = voids.get(play.seat) ?? new Set<number>();
      known.add(led);
      voids.set(play.seat, known);
    }
  }
  return voids;
}
