import { settings } from './settings';
import { playSound, type SoundName } from './sfx';

/** Vibration pattern per cue, in milliseconds. */
const HAPTICS: Partial<Record<SoundName, number | number[]>> = {
  tap: 8,
  place: 14,
  win: [20, 50, 20, 50, 70],
  lose: 90,
  roll: 10,
  capture: [30, 40, 30],
};

/**
 * Plays the sound and haptic for a moment in the game, honoring the player's settings.
 * Native haptics (@capacitor/haptics) replace navigator.vibrate in the app builds.
 */
export function cue(name: SoundName): void {
  const { sound, haptics } = settings.get();
  if (sound) playSound(name);
  const pattern = HAPTICS[name];
  if (haptics && pattern !== undefined && typeof navigator.vibrate === 'function') {
    navigator.vibrate(pattern);
  }
}
