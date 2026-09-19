import type { BotTier } from '@gamepals/rules';
import type { Scene } from 'phaser';
import type { SeatController } from './session';

/**
 * Test mode, turned on with `?autoplay` (or `?autoplay=<speed>`): bots take every seat and games run
 * faster, so end-to-end tests can play whole games on every device. Players never see it.
 */
const params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
/** Native test builds (`VITE_SELFTEST=1`) play every game by themselves; see selftest.ts. */
export const SELFTEST = import.meta.env.VITE_SELFTEST === '1';
export const AUTOPLAY = params.has('autoplay') || SELFTEST;
/**
 * `?inspect` opens the same test seam as autoplay without putting bots in the seats, so a test
 * can set a table up by hand and then ask a scene what it is showing. Players never see it.
 */
export const INSPECT = params.has('inspect');
export const SPEED = AUTOPLAY ? Math.max(1, Math.min(10, Number(params.get('autoplay')) || 6)) : 1;
/** Bot pause between turns in test mode. */
export const AUTOPLAY_BOT_DELAY_MS = 40;

/** Speeds up a scene's tweens and timers (its fixed-step simulation multiplies frame time by SPEED). */
export function applySpeed(scene: Scene): void {
  if (SPEED === 1) return;
  scene.tweens.timeScale = SPEED;
  scene.time.timeScale = SPEED;
}

const TIERS: readonly BotTier[] = ['expert', 'easy', 'hard', 'medium'];
const NAMES: Record<BotTier, string> = { easy: 'Pip', medium: 'Bo', hard: 'Zed', expert: 'Nova' };

/** Mixed levels so matches between bots actually finish. */
export const autoplaySeats = (count: number): SeatController[] =>
  Array.from({ length: count }, (_, i) => {
    const tier = TIERS[i % TIERS.length]!;
    return { kind: 'bot', tier, label: NAMES[tier] };
  });
