import { storage } from './platform';

/**
 * The daily (docs/08 D2). One puzzle a day, the same one for everybody, with no server involved:
 * the seed is the date, so two people on opposite sides of the world open the app and get the
 * same board without anybody storing anything. The streak lives on the device.
 *
 * Ponder Club runs its whole product on this, and it is the only retention machinery we can build
 * with no accounts and no backend.
 */

/** The games that suit a daily: one person, one sitting, and a result worth comparing. */
export const DAILY_GAMES: readonly string[] = [
  'word-guess',
  '2048',
  'sudoku',
  'classic-snake',
  'sliding-puzzle',
  'color-sort',
  'shut-the-box',
  'yatzy',
  'solitaire',
  'freecell',
  'pyramid',
  'tripeaks',
  'memory',
  'word-search',
  'mini-crossword',
];

/** Today, as the person's own calendar sees it: `2026-09-20`. */
export function todayKey(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Days since the start of 2026, which is all the rota needs to count. */
function dayNumber(key: string): number {
  const [year, month, day] = key.split('-').map(Number);
  return Math.floor(Date.UTC(year!, (month ?? 1) - 1, day ?? 1) / 86_400_000);
}

/** Whose turn it is to be today's game. */
export function dailyGameId(key = todayKey()): string {
  return DAILY_GAMES[dayNumber(key) % DAILY_GAMES.length]!;
}

/**
 * The seed for today's puzzle. Everybody gets the same one, and it is a different board for each
 * game, so the rota does not repeat a layout when it comes round again.
 */
export function dailySeed(key = todayKey(), gameId = dailyGameId(key)): number {
  let hash = 2166136261;
  for (const char of `${key}:${gameId}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** How long until the next one, in the words a countdown uses. */
export function timeToNext(now = new Date()): string {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const left = Math.max(0, midnight.getTime() - now.getTime());
  const hours = Math.floor(left / 3_600_000);
  const minutes = Math.floor((left % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  const seconds = Math.floor((left % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export interface DailyState {
  /** The last day finished, or null. */
  readonly last: string | null;
  readonly streak: number;
  readonly best: number;
}

const KEY = 'gamepals.daily';
const EMPTY: DailyState = { last: null, streak: 0, best: 0 };

export function loadDaily(): DailyState {
  try {
    return { ...EMPTY, ...(JSON.parse(storage.get(KEY) ?? '{}') as Partial<DailyState>) };
  } catch {
    return EMPTY;
  }
}

/** Yesterday, so a streak can tell "kept going" from "came back after a gap". */
function dayBefore(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year!, (month ?? 1) - 1, (day ?? 1) - 1));
  return todayKey(new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Today is done. Finishing the same day twice changes nothing, and a missed day starts the
 * streak again at one rather than pretending it carried on.
 */
export function finishDaily(key = todayKey()): DailyState {
  const now = loadDaily();
  if (now.last === key) return now;
  const streak = now.last === dayBefore(key) ? now.streak + 1 : 1;
  const next: DailyState = { last: key, streak, best: Math.max(now.best, streak) };
  storage.set(KEY, JSON.stringify(next));
  return next;
}

export const doneToday = (state: DailyState, key = todayKey()): boolean => state.last === key;
