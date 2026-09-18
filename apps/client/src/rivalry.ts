import type { GameResult } from '@gamepals/rules';
import { storage } from './platform';
import type { SeatController } from './session';

/**
 * The running score between the same players at the same game, kept on this device.
 * Seats rotate between games so a different side starts, so the tally follows the player's
 * name (You, Player 2, Pip, Bo, Zed, Nova), never the chair they happen to be sitting in.
 */
export interface Rivalry {
  readonly wins: Readonly<Record<string, number>>;
  readonly draws: number;
  readonly games: number;
  /** Who has won every game since somebody else did, and how many that is. */
  readonly streakName: string | null;
  readonly streak: number;
}

const EMPTY: Rivalry = { wins: {}, draws: 0, games: 0, streakName: null, streak: 0 };

/** One key per game and set of players, whichever order they sat down in. */
export function keyFor(gameId: string, seats: readonly SeatController[]): string | null {
  // A solo puzzle has nobody to keep score against.
  if (seats.length < 2) return null;
  const names = seats.map((seat) => seat.label).sort();
  return `gamepals.rivalry.${gameId}.${names.join('|')}`;
}

export function load(key: string | null): Rivalry {
  if (!key) return EMPTY;
  try {
    const saved = JSON.parse(storage.get(key) ?? 'null') as Rivalry | null;
    if (saved && typeof saved.games === 'number' && saved.wins) return saved;
  } catch {
    // Unreadable storage: start the score again rather than lose the game.
  }
  return EMPTY;
}

/** Adds a finished game to the score and saves it. */
export function record(key: string | null, seats: readonly SeatController[], result: GameResult): Rivalry {
  if (!key) return EMPTY;
  const before = load(key);
  const wins = { ...before.wins };
  for (const name of seats.map((seat) => seat.label)) wins[name] ??= 0;
  const winners = result.draw ? [] : result.winners.map((seat) => seats[seat]?.label).filter((name): name is string => !!name);
  for (const name of winners) wins[name] = (wins[name] ?? 0) + 1;
  // A run is one player winning on their own, again and again. A draw or a shared win ends it.
  const alone = winners.length === 1 ? winners[0]! : null;
  const streak = alone ? (before.streakName === alone ? before.streak + 1 : 1) : 0;
  const next: Rivalry = {
    wins,
    draws: before.draws + (winners.length ? 0 : 1),
    games: before.games + 1,
    streakName: alone,
    streak,
  };
  storage.set(key, JSON.stringify(next));
  return next;
}

/** "You 3 · Bo 1 · 2 draws", in the order the players are sitting. */
export function scoreLine(rivalry: Rivalry, seats: readonly SeatController[]): string | null {
  if (rivalry.games === 0) return null;
  const parts = seats.map((seat) => `${seat.label} ${rivalry.wins[seat.label] ?? 0}`);
  if (rivalry.draws) parts.push(rivalry.draws === 1 ? '1 draw' : `${rivalry.draws} draws`);
  return parts.join(' · ');
}

/** "Bo has won 3 in a row", once a run is worth mentioning. */
export function streakLine(rivalry: Rivalry): string | null {
  if (!rivalry.streakName || rivalry.streak < 2) return null;
  const who = rivalry.streakName === 'You' ? 'You have' : `${rivalry.streakName} has`;
  return `${who} won ${rivalry.streak} in a row`;
}
