import { storage } from './platform';

export interface Settings {
  readonly sound: boolean;
  readonly haptics: boolean;
  /** Ponder Club ships a switch for this, and they are right: a hook you cannot turn off is a trap. */
  readonly streaks: boolean;
}

const KEY = 'gamepals.settings';
const DEFAULTS: Settings = { sound: true, haptics: true, streaks: true };

// Native Preferences in the apps, localStorage on the web (platform.ts).
function load(): Settings {
  try {
    return { ...DEFAULTS, ...(JSON.parse(storage.get(KEY) ?? '{}') as Partial<Settings>) };
  } catch {
    return DEFAULTS;
  }
}

/** Loaded on first use, after storage.init() has read the saved values. */
let current: Settings | null = null;
const listeners = new Set<(settings: Settings) => void>();

export const settings = {
  get: (): Settings => (current ??= load()),
  set(patch: Partial<Settings>): void {
    const next = { ...settings.get(), ...patch };
    current = next;
    storage.set(KEY, JSON.stringify(next));
    listeners.forEach((listener) => listener(next));
  },
  subscribe(listener: (settings: Settings) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
