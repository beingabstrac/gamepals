import { storage } from './platform';

/** Games this player has opened before, so the coaching line only shows the first time. */
const KEY = 'gamepals.played';

function load(): Set<string> {
  try {
    const saved = JSON.parse(storage.get(KEY) ?? '[]') as unknown;
    return new Set(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

let played: Set<string> | null = null;

export function isFirstPlay(id: string): boolean {
  played ??= load();
  return !played.has(id);
}

export function markPlayed(id: string): void {
  played ??= load();
  if (played.has(id)) return;
  played.add(id);
  storage.set(KEY, JSON.stringify([...played]));
}

/** The one line to try first: the game's own words, cut to the first thing to do. */
export function tryItLine(controls: string, own?: string): string {
  if (own) return own;
  const stop = controls.indexOf('. ');
  return stop === -1 ? controls : controls.slice(0, stop + 1);
}
