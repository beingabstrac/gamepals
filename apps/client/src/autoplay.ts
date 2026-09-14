import type { BotTier } from '@gamepals/rules';
import type { Scene } from 'phaser';
import type { SeatController } from './session';

/**
 * Test mode, turned on with `?autoplay` (or `?autoplay=<speed>`): bots take every seat and games run
 * faster, so end-to-end tests can play whole games on every device. Players never see it.
 */
const params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
export const AUTOPLAY = params.has('autoplay');
export const SPEED = AUTOPLAY ? Math.max(1, Math.min(10, Number(params.get('autoplay')) || 5)) : 1;
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
