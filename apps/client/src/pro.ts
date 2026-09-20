import { storage } from './platform';

/**
 * Pro, and the shop that sells it (docs/08 M11/M11b). Everything here works with no accounts and
 * no store: a stub seller stands in for RevenueCat so the paywall, the entitlement and everything
 * gated behind it can be built and tested now. When the real keys arrive, only `SELLER` changes.
 */

export type Plan = 'monthly' | 'yearly' | 'lifetime';

export interface Offer {
  readonly plan: Plan;
  readonly title: string;
  /** What it says on the button. Provisional until the owner sets real prices. */
  readonly price: string;
  readonly note: string;
  /** The one we lead with: both rivals sell a one-off and this audience buys it. */
  readonly hero?: boolean;
}

/**
 * Provisional. When the owner sets real prices, the evidence points down: JindoBlu sells Remove
 * Ads at $6.99 against 413K ratings, with a brand and years of reviews behind it, and we have
 * none of that. $14.99 is more than double a proven price from a position of no strength.
 */
export const OFFERS: readonly Offer[] = [
  { plan: 'monthly', title: 'Monthly', price: '$2.99', note: 'every month' },
  { plan: 'yearly', title: 'Yearly', price: '$11.99', note: 'every year, saves a third' },
  { plan: 'lifetime', title: 'One payment', price: '$14.99', note: 'yours for good, no subscription', hero: true },
];

/**
 * What Pro actually turns on. Every line here has to be something the app really does. It used
 * to list five things of which one was true: nothing gated a level, there was no archive, and
 * there were no stats, and a paywall that promises what it does not do is how refunds and
 * one-star reviews are earned. Levels stay free for everybody, because taking away what people
 * already have is worse than not charging for it. Stats go back on this list in D3b.
 */
export const PRO_GIVES: readonly string[] = [
  'No ads, ever',
  'Hints and undo without watching anything',
  "Every day's puzzle, all the way back",
];

export interface ProState {
  readonly pro: boolean;
  readonly plan: Plan | null;
  /** When a subscription would lapse, as a date key. Null for lifetime and for nobody. */
  readonly until: string | null;
}

const KEY = 'gamepals.pro';
const NOBODY: ProState = { pro: false, plan: null, until: null };

let current: ProState | null = null;
const listeners = new Set<(state: ProState) => void>();

function load(): ProState {
  try {
    return { ...NOBODY, ...(JSON.parse(storage.get(KEY) ?? '{}') as Partial<ProState>) };
  } catch {
    return NOBODY;
  }
}

function save(next: ProState): void {
  current = next;
  storage.set(KEY, JSON.stringify(next));
  listeners.forEach((listener) => listener(next));
}

/** A seller: the stub now, RevenueCat later. The app only knows this shape. */
export interface Seller {
  readonly name: string;
  buy(plan: Plan): Promise<ProState>;
  restore(): Promise<ProState>;
}

/** Sells nothing and grants everything, so the paywall can be walked through with no accounts. */
const STUB: Seller = {
  name: 'stub',
  async buy(plan: Plan): Promise<ProState> {
    const until = plan === 'lifetime' ? null : new Date(Date.now() + (plan === 'yearly' ? 365 : 30) * 86_400_000).toISOString().slice(0, 10);
    const next: ProState = { pro: true, plan, until };
    save(next);
    return next;
  },
  async restore(): Promise<ProState> {
    return pro.get();
  },
};

/** Swapped for the real one in M11, which is the only line that has to change. */
const SELLER: Seller = STUB;

export const pro = {
  get: (): ProState => (current ??= load()),
  isPro: (): boolean => pro.get().pro,
  seller: (): string => SELLER.name,
  async buy(plan: Plan): Promise<ProState> {
    return SELLER.buy(plan);
  },
  async restore(): Promise<ProState> {
    return SELLER.restore();
  },
  /** Only for tests and for the owner's own device: hand it back. */
  clear(): void {
    save(NOBODY);
  },
  subscribe(listener: (state: ProState) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
