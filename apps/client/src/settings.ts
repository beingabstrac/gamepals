export interface Settings {
  readonly sound: boolean;
  readonly haptics: boolean;
}

const KEY = 'gamepals.settings';
const DEFAULTS: Settings = { sound: true, haptics: true };

// Web storage is fine for preferences on the web build; the Capacitor build
// switches this to @capacitor/preferences (see docs/04 §1, local saves).
function load(): Settings {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>) };
  } catch {
    return DEFAULTS;
  }
}

let current = load();
const listeners = new Set<(settings: Settings) => void>();

export const settings = {
  get: (): Settings => current,
  set(patch: Partial<Settings>): void {
    current = { ...current, ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(current));
    } catch {
      // Private mode or storage blocked: keep the in-memory value.
    }
    listeners.forEach((listener) => listener(current));
  },
  subscribe(listener: (settings: Settings) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
