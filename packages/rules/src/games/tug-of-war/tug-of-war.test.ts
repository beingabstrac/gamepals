import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import type { BotTier } from '../../core/types';
import { newTugGame, nextBotTapDelay, stepTug, TUG_COUNTDOWN, TUG_STEP, TUG_TIERS, tugTap, type TugState } from './index';

const ready = (): TugState => ({ ...newTugGame(), countdown: 0 });

function simulate(tiers: [BotTier, BotTier], seed: number, seconds = 60): TugState {
  const rng = createRng(seed);
  const next = [nextBotTapDelay(TUG_TIERS[tiers[0]], rng), nextBotTapDelay(TUG_TIERS[tiers[1]], rng)];
  let state = newTugGame();
  let clock = 0;
  for (let i = 0; i < seconds / TUG_STEP && !state.result; i++) {
    clock += TUG_STEP;
    state = stepTug(state);
    for (const seat of [0, 1] as const) {
      while (clock >= next[seat]!) {
        state = tugTap(state, seat);
        next[seat]! += nextBotTapDelay(TUG_TIERS[tiers[seat]], rng);
      }
    }
  }
  return state;
}

describe('tug of war', () => {
  it('ignores taps during the countdown', () => {
    const state = tugTap(newTugGame(), 0);
    expect(state.taps).toEqual([0, 0]);
    let s = newTugGame();
    for (let t = 0; t < TUG_COUNTDOWN + 0.05; t += TUG_STEP) s = stepTug(s);
    expect(s.countdown).toBe(0);
  });

  it('pulls the rope toward whoever taps', () => {
    let state = tugTap(tugTap(ready(), 0), 0);
    for (let i = 0; i < 60; i++) state = stepTug(state);
    expect(state.rope).toBeGreaterThan(0);
    expect(state.taps).toEqual([2, 0]);
  });

  it('slows down between taps', () => {
    const state = tugTap(ready(), 1);
    let after = state;
    for (let i = 0; i < 60; i++) after = stepTug(after);
    expect(Math.abs(after.velocity)).toBeLessThan(Math.abs(state.velocity));
  });

  it('declares a winner at the line and then freezes', () => {
    let state: TugState = { ...ready(), rope: 0.99, velocity: 2 };
    state = stepTug(state);
    expect(state.result).toEqual({ winners: [0], draw: false });
    expect(tugTap(state, 1)).toBe(state);
  });

  it('a faster tapper wins', () => {
    expect(simulate(['expert', 'easy'], 1).result?.winners).toEqual([0]);
    expect(simulate(['easy', 'expert'], 2).result?.winners).toEqual([1]);
  });
});
