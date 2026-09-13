import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import {
  botReactionMs,
  newReflexGame,
  REFLEX_TIERS,
  REFLEX_WIN_SCORE,
  reflexTap,
  stepReflex,
  waitForRound,
  type ReflexState,
} from './index';

function advanceTo(state: ReflexState, phase: ReflexState['phase']): ReflexState {
  let s = state;
  for (let i = 0; i < 10_000 && s.phase !== phase; i++) s = stepReflex(s, 10);
  return s;
}

describe('reflex race', () => {
  it('picks a secret wait of 1.5–4 s per round, the same for the same seed', () => {
    for (let round = 0; round < 50; round++) {
      const wait = waitForRound(7, round);
      expect(wait).toBeGreaterThanOrEqual(1500);
      expect(wait).toBeLessThanOrEqual(4000);
      expect(waitForRound(7, round)).toBe(wait);
    }
  });

  it('goes ready → wait → go', () => {
    const go = advanceTo(newReflexGame(1), 'go');
    expect(go.phase).toBe('go');
    expect(go.phaseMs).toBeLessThan(10);
  });

  it('gives the point to the other player on a false start', () => {
    const waiting = advanceTo(newReflexGame(1), 'wait');
    const after = reflexTap(waiting, 0);
    expect(after.scores).toEqual([0, 1]);
    expect(after.lastPoint).toMatchObject({ seat: 1, reason: 'falseStart' });
  });

  it('gives the point to the first tap after go, with the reaction time', () => {
    const go = stepReflex(advanceTo(newReflexGame(1), 'go'), 240);
    const after = reflexTap(reflexTap(go, 1), 0);
    expect(after.scores).toEqual([0, 1]);
    expect(after.lastPoint?.reactionMs).toBeGreaterThanOrEqual(240);
  });

  it('ignores taps while showing the round or the point', () => {
    const ready = newReflexGame(1);
    expect(reflexTap(ready, 0)).toBe(ready);
  });

  it('starts the next round after a point and ends at the winning score', () => {
    let state = newReflexGame(3);
    for (let i = 0; i < REFLEX_WIN_SCORE; i++) {
      state = reflexTap(advanceTo(state, 'go'), 0);
      if (!state.result) state = advanceTo(state, 'ready');
    }
    expect(state.scores[0]).toBe(REFLEX_WIN_SCORE);
    expect(state.result).toEqual({ winners: [0], draw: false });
    expect(stepReflex(state, 1000)).toBe(state);
  });

  it('bot levels react in order: expert fastest, easy slowest', () => {
    const rng = createRng(9);
    const mean = (tier: keyof typeof REFLEX_TIERS) => {
      let total = 0;
      for (let i = 0; i < 500; i++) total += botReactionMs(REFLEX_TIERS[tier], rng);
      return total / 500;
    };
    expect(mean('expert')).toBeLessThan(mean('hard'));
    expect(mean('hard')).toBeLessThan(mean('medium'));
    expect(mean('medium')).toBeLessThan(mean('easy'));
  });
});
