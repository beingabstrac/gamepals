import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import type { BotTier } from '../../core/types';
import {
  BOWL,
  canDash,
  FULL_SPIN,
  fromMiddle,
  newSpinnerGame,
  POINTS_TO_WIN,
  SPINNER_STEP,
  SPINNER_TIERS,
  spinnerBotInput,
  stepSpinner,
  TOP_RADIUS,
  type SpinnerInput,
  type SpinnerState,
  type Top,
} from './index';

const idle: SpinnerInput = { steer: null, dash: false };
const top = (x: number, y: number, extra: Partial<Top> = {}): Top => ({ x, y, vx: 0, vy: 0, spin: FULL_SPIN, cooldown: 0, ...extra });
const round = (a: Top, b: Top, extra: Partial<SpinnerState> = {}): SpinnerState => ({
  tops: [a, b],
  phase: 'round',
  timer: 0,
  points: [0, 0],
  lastRound: null,
  result: null,
  ...extra,
});

const run = (state: SpinnerState, seconds: number, inputs: [SpinnerInput, SpinnerInput] = [idle, idle]) => {
  let s = state;
  for (let t = 0; t < seconds; t += SPINNER_STEP) s = stepSpinner(s, inputs).state;
  return s;
};

describe('spinner war', () => {
  it('a top left alone slides down into the middle of the bowl', () => {
    const s = run(round(top(BOWL.x + 200, BOWL.y), top(BOWL.x - 200, BOWL.y)), 0.3);
    expect(s.tops[0].vx).toBeLessThan(0);
    expect(s.tops[1].vx).toBeGreaterThan(0);
    expect(fromMiddle(s.tops[0])).toBeLessThan(200);
  });

  it('a slow top reaching the rim is turned back in by the lip', () => {
    const s = stepSpinner(round(top(BOWL.x, BOWL.y + BOWL.radius - 1, { vy: 150 }), top(BOWL.x, BOWL.y - 100)), [idle, idle]);
    expect(s.events.roundOver).toBeNull();
    expect(s.state.tops[0].vy).toBeLessThan(0);
  });

  it('a top thrown hard over the rim is out, and that is two points', () => {
    const s = stepSpinner(round(top(BOWL.x, BOWL.y + BOWL.radius - 1, { vy: 900 }), top(BOWL.x, BOWL.y - 100)), [idle, idle]);
    expect(s.events.roundOver).toEqual({ winner: 1, how: 'ring-out' });
    expect(s.state.points).toEqual([0, 2]);
  });

  it('spin runs down on its own, and a top at zero loses by spin finish for one point', () => {
    const s = run(round(top(BOWL.x - 100, BOWL.y), top(BOWL.x + 100, BOWL.y)), 1);
    expect(s.tops[0].spin).toBeLessThan(FULL_SPIN);
    const out = stepSpinner(round(top(BOWL.x - 100, BOWL.y, { spin: 0.001 }), top(BOWL.x + 100, BOWL.y)), [idle, idle]);
    expect(out.events.roundOver).toEqual({ winner: 1, how: 'spin-finish' });
    expect(out.state.points).toEqual([0, 1]);
  });

  it('in a clash both lose spin, and the slower one loses more', () => {
    const fast = top(BOWL.x - TOP_RADIUS + 2, BOWL.y, { vx: 400 });
    const slow = top(BOWL.x + TOP_RADIUS - 2, BOWL.y, { vx: -40 });
    const { state, events } = stepSpinner(round(fast, slow), [idle, idle]);
    expect(events.clash).toBeGreaterThan(0);
    const lost = [FULL_SPIN - state.tops[0].spin, FULL_SPIN - state.tops[1].spin];
    expect(lost[0]).toBeGreaterThan(0);
    expect(lost[1]).toBeGreaterThan(lost[0]);
    expect(Math.hypot(state.tops[0].x - state.tops[1].x, state.tops[0].y - state.tops[1].y)).toBeGreaterThanOrEqual(TOP_RADIUS * 2 - 1e-9);
  });

  it('a dash costs spin and is refused when low or cooling down', () => {
    const start = round(top(BOWL.x - 100, BOWL.y, { vx: 50 }), top(BOWL.x + 150, BOWL.y + 100));
    const { state, events } = stepSpinner(start, [{ steer: { x: 1, y: 0 }, dash: true }, idle]);
    expect(events.dash).toEqual([true, false]);
    expect(state.tops[0].vx).toBeGreaterThan(300);
    expect(state.tops[0].spin).toBeLessThan(FULL_SPIN - 5);
    expect(canDash(state.tops[0])).toBe(false);
    expect(canDash(top(0, 0, { spin: 5 }))).toBe(false);
  });

  it('the same inputs always give the same round', () => {
    const inputs: [SpinnerInput, SpinnerInput] = [{ steer: { x: 0.5, y: -1 }, dash: false }, { steer: { x: -0.2, y: 0.7 }, dash: false }];
    const a = run(newSpinnerGame(), 3, inputs);
    const b = run(newSpinnerGame(), 3, inputs);
    expect(a).toEqual(b);
  });

  it('bots win matches in tier order: Expert beats Easy most matches, and rounds end', { timeout: 120_000 }, () => {
    const match = (tiers: [BotTier, BotTier], seed: number) => {
      const rng = createRng(seed);
      let s = newSpinnerGame();
      let noise: [number, number] = [0, 0];
      for (let step = 0; step < 120 * 240 && !s.result; step++) {
        if (step % 48 === 0) noise = [rng.next() * 2 - 1, rng.next() * 2 - 1];
        const inputs: [SpinnerInput, SpinnerInput] = [
          spinnerBotInput(s, 0, SPINNER_TIERS[tiers[0]], noise[0]),
          spinnerBotInput(s, 1, SPINNER_TIERS[tiers[1]], noise[1]),
        ];
        s = stepSpinner(s, inputs).state;
      }
      return s.result;
    };
    let expert = 0;
    let finished = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const expertSeat = seed % 2;
      const result = match(expertSeat === 0 ? ['expert', 'easy'] : ['easy', 'expert'], seed);
      if (result) finished++;
      if (result?.winners.includes(expertSeat)) expert++;
    }
    expect(finished).toBe(12);
    expect(expert).toBeGreaterThanOrEqual(8);
  });
});

/** Invariant: spin stays between 0 and 100, the tops never overlap, and points never go down. */
describe('spinner war invariants', () => {
  it('keeps spin in range, the tops apart and the points climbing', { timeout: 60_000 }, () => {
    for (let seed = 0; seed < 6; seed++) {
      const rng = createRng(seed);
      let s = newSpinnerGame();
      let inputs: [SpinnerInput, SpinnerInput] = [idle, idle];
      for (let step = 0; step < 120 * 90 && !s.result; step++) {
        if (step % 30 === 0) {
          const pick = (): SpinnerInput => ({ steer: { x: rng.next() * 2 - 1, y: rng.next() * 2 - 1 }, dash: rng.next() < 0.1 });
          inputs = [pick(), pick()];
        }
        const before = s.points;
        s = stepSpinner(s, inputs).state;
        const where = `seed ${seed} step ${step}`;
        for (const t of s.tops) {
          expect(t.spin, where).toBeGreaterThanOrEqual(0);
          expect(t.spin, where).toBeLessThanOrEqual(FULL_SPIN);
        }
        if (s.phase === 'round') {
          const [a, b] = s.tops;
          expect(Math.hypot(a.x - b.x, a.y - b.y), where).toBeGreaterThanOrEqual(TOP_RADIUS * 2 - 1e-6);
        }
        expect(s.points[0], where).toBeGreaterThanOrEqual(before[0]);
        expect(s.points[1], where).toBeGreaterThanOrEqual(before[1]);
        expect(Math.max(...s.points)).toBeLessThanOrEqual(POINTS_TO_WIN + 1);
      }
    }
  });
});

