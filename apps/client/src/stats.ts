import type { GameResult } from '@gamepals/rules';
import { todayKey } from './daily';
import { storage } from './platform';
import type { SeatController } from './session';

/**
 * What this player has actually done (docs/08 D3b). Kept on the device, like everything else
 * here: no accounts, no server, nothing leaves the phone.
 *
 * This only knows what every game can answer, which is whether a game was finished and whether
 * the person won it. Per-game best scores need each game to say what its score is, and that hook
 * belongs with M14, where the server has to check the same number by replaying the move log.
 */
export interface GameStat {
  readonly played: number;
  readonly won: number;
  readonly drawn: number;
  /** Day key of the last finished game, for "last played". */
  readonly last: string;
}

export interface Stats {
  readonly games: Readonly<Record<string, GameStat>>;
  /** Day keys on which anything at all was finished, newest first. */
  readonly days: readonly string[];
}

const KEY = 'gamepals.stats';
const EMPTY: Stats = { games: {}, days: [] };
const NOTHING: GameStat = { played: 0, won: 0, drawn: 0, last: '' };
/** About a year of days is plenty to draw a history from, and it stays small. */
const MAX_DAYS = 400;

let current: Stats | null = null;
const listeners = new Set<(stats: Stats) => void>();

export function loadStats(): Stats {
  if (current) return current;
  try {
    const saved = JSON.parse(storage.get(KEY) ?? 'null') as Partial<Stats> | null;
    current = { ...EMPTY, ...(saved ?? {}) };
  } catch {
    current = EMPTY;
  }
  return current;
}

/**
 * A finished game goes on the record, but only when a person played it. A build with bots in
 * every seat is a test run, and counting those would have every number in here come from CI
 * rather than from anybody.
 */
export function recordGame(
  gameId: string,
  seats: readonly SeatController[],
  result: GameResult,
  today = todayKey(),
): Stats {
  if (!seats.some((seat) => seat.kind === 'human')) return loadStats();
  const stats = loadStats();
  const was = stats.games[gameId] ?? NOTHING;
  const humanWon = result.winners.some((seat) => seats[seat]?.kind === 'human');
  const game: GameStat = {
    played: was.played + 1,
    won: was.won + (humanWon ? 1 : 0),
    drawn: was.drawn + (result.draw ? 1 : 0),
    last: today,
  };
  const days = stats.days[0] === today ? stats.days : [today, ...stats.days].slice(0, MAX_DAYS);
  const next: Stats = { games: { ...stats.games, [gameId]: game }, days };
  current = next;
  storage.set(KEY, JSON.stringify(next));
  listeners.forEach((listener) => listener(next));
  return next;
}

export interface Totals {
  readonly played: number;
  readonly won: number;
  readonly days: number;
  /** How many different games have been finished at least once. */
  readonly tried: number;
}

export function totals(stats: Stats): Totals {
  const all = Object.values(stats.games);
  return {
    played: all.reduce((sum, game) => sum + game.played, 0),
    won: all.reduce((sum, game) => sum + game.won, 0),
    days: stats.days.length,
    tried: all.length,
  };
}

/** Games most played first, which is the order a person recognises their own list in. */
export function byPlayed(stats: Stats): { id: string; stat: GameStat }[] {
  return Object.entries(stats.games)
    .map(([id, stat]) => ({ id, stat }))
    .sort((a, b) => b.stat.played - a.stat.played || a.id.localeCompare(b.id));
}

export function subscribeStats(listener: (stats: Stats) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Tests only. */
export function clearStats(): void {
  current = EMPTY;
  storage.set(KEY, JSON.stringify(EMPTY));
  listeners.forEach((listener) => listener(EMPTY));
}
