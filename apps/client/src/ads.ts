import { pro } from './pro';

/**
 * Where ads would go, and the rules they live under (docs/08 M10/M11b). Nothing shows anything
 * yet: there is no AdMob account, and the provider here is a stub that resolves immediately.
 * What matters is that the rules exist and are testable now.
 *
 * The rules come from the reviews of every app in this category, where ad frequency is the
 * loudest complaint there is: "2 ads every 30 seconds", "30 seconds unskippable", ads after every
 * round. So:
 *   - rewarded ads are always optional and always asked for by the person,
 *   - one interstitial at most between games, never inside a turn,
 *   - a hard gap and a daily cap on top of that,
 *   - and Pro turns the lot off.
 */

/** At most one interstitial this often, however many games are finished in between. */
export const AD_GAP_MS = 4 * 60 * 1000;
/** And no more than this many in a day, whatever else happens. */
export const AD_DAILY_CAP = 6;
/** Not before somebody has actually played a few games. */
export const AD_AFTER_GAMES = 3;

export interface AdProvider {
  readonly name: string;
  /** Resolves true when the reward was earned. */
  rewarded(reason: string): Promise<boolean>;
  interstitial(): Promise<void>;
}

const STUB: AdProvider = {
  name: 'stub',
  async rewarded(): Promise<boolean> {
    return true;
  },
  async interstitial(): Promise<void> {
    // Nothing to show until there is an account behind it.
  },
};

const PROVIDER: AdProvider = STUB;

interface AdState {
  games: number;
  shownAt: number;
  today: string;
  todayCount: number;
}

const state: AdState = { games: 0, shownAt: 0, today: '', todayCount: 0 };

const dayKey = (): string => new Date().toISOString().slice(0, 10);

/** A game ended. Returns true if this is a moment an interstitial is allowed to appear. */
export function gameFinished(now = Date.now()): boolean {
  if (pro.isPro()) return false;
  const today = dayKey();
  if (state.today !== today) {
    state.today = today;
    state.todayCount = 0;
  }
  state.games += 1;
  if (state.games < AD_AFTER_GAMES) return false;
  if (state.todayCount >= AD_DAILY_CAP) return false;
  if (now - state.shownAt < AD_GAP_MS) return false;
  state.shownAt = now;
  state.todayCount += 1;
  return true;
}

/** Between games only, and only when the rules above allow it. */
export async function maybeInterstitial(now = Date.now()): Promise<boolean> {
  if (!gameFinished(now)) return false;
  await PROVIDER.interstitial();
  return true;
}

/**
 * The person asked for something and is willing to watch for it: a hint, an undo, another go at
 * today's puzzle. Pro skips the watching and grants it.
 */
export async function watchFor(reason: string): Promise<boolean> {
  if (pro.isPro()) return true;
  return PROVIDER.rewarded(reason);
}

/** Tests only: forget what has been shown. */
export function resetAds(): void {
  state.games = 0;
  state.shownAt = 0;
  state.today = '';
  state.todayCount = 0;
}
