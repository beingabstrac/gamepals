import { describe, expect, it } from 'vitest';
import { bumpKick, FLIP, newWheelie, PX_PER_M, stepWheelie, wheelieTotal, WHEELIE_RIDES, WHEELIE_TIERS, wheelieBotInput, type WheelieInput, type WheelieState, type WheelieTier } from './index';

const off: WheelieInput = { held: false };
const on: WheelieInput = { held: true };
const riding = (seed = 1) => {
  let s = newWheelie(seed);
  while (s.phase === 'countdown') s = stepWheelie(s, [off, off]).state;
  return s;
};
function match(seed: number, a: WheelieTier, b: WheelieTier) {
  let s = newWheelie(seed);
  for (let i = 0; i < 120 * 300 && !s.result; i++) s = stepWheelie(s, [wheelieBotInput(s, 0, a), wheelieBotInput(s, 1, b)]).state;
  return s;
}

describe('wheelie', () => {
  it('hold and the front lifts; let go and it comes down and the ride is banked', () => {
    let s = riding();
    let lifted = false;
    for (let i = 0; i < 60; i++) {
      const out = stepWheelie(s, [on, off]);
      lifted ||= out.events.lifted.includes(0);
      s = out.state;
    }
    expect(lifted).toBe(true);
    expect(s.riders[0].angle).toBeGreaterThan(0.12);
    let landed = false;
    for (let i = 0; i < 240 && !landed; i++) {
      const out = stepWheelie(s, [off, off]);
      landed = out.events.landed.includes(0);
      s = out.state;
    }
    expect(landed).toBe(true);
    expect(s.riders[0].scores.length).toBe(1);
    expect(s.riders[0].scores[0]!).toBeGreaterThan(0);
  });

  it('hold on too long and it goes over backwards, and that ride scores nothing', () => {
    let s = riding();
    let flipped = false;
    for (let i = 0; i < 600 && !flipped; i++) {
      const out = stepWheelie(s, [on, off]);
      flipped = out.events.flipped.includes(0);
      s = out.state;
    }
    expect(flipped).toBe(true);
    expect(s.riders[0].angle).toBe(FLIP);
    expect(s.riders[0].scores).toEqual([0]);
  });

  it('a rider who never lifts scores nothing that ride, and the next ride starts fresh', () => {
    let s = riding();
    for (let i = 0; i < 120 * 7; i++) s = stepWheelie(s, [off, off]).state;
    expect(s.riders[0].scores).toEqual([0]);
    expect(s.riders[0].ride).toBe(1);
    expect(s.riders[0].phase).toBe('rolling');
  });

  it('the bumps are the same for both riders and grow along the road', () => {
    expect(bumpKick(3, 0, 5)).toBe(bumpKick(3, 0, 5));
    const early = Math.max(...Array.from({ length: 50 }, (_, i) => Math.abs(bumpKick(3, i, 1))));
    const late = Math.max(...Array.from({ length: 50 }, (_, i) => Math.abs(bumpKick(3, i, 40))));
    expect(late).toBeGreaterThan(early * 2);
  });

  it('after three rides each, the longest total wins', () => {
    const base = riding();
    const done = (scores: number[]) => ({ ...base.riders[0], phase: 'done' as const, ride: WHEELIE_RIDES - 1, scores });
    const s: WheelieState = { ...base, riders: [done([10, 0, 12]), { ...done([8, 9]), phase: 'landed', timer: 1 / 240, scores: [8, 9, 6] }] };
    const out = stepWheelie(s, [off, off]).state;
    expect(out.result).toEqual({ winners: [1], draw: false });
    expect(wheelieTotal(out.riders[1])).toBe(23);
    expect(PX_PER_M).toBe(100);
  });

  it('the better bot wins, and every match ends', { timeout: 60_000 }, () => {
    let wins = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const s = match(seed, WHEELIE_TIERS.hard, WHEELIE_TIERS.easy);
      expect(s.result).not.toBeNull();
      if (s.result?.winners[0] === 0) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(5);
  });

  it('invariant, every step of bot play: the lean stays between the ground and the flip, rides only add up', () => {
    let s = newWheelie(4);
    for (let i = 0; i < 120 * 120 && !s.result; i++) {
      const next = stepWheelie(s, [wheelieBotInput(s, 0, WHEELIE_TIERS.medium), wheelieBotInput(s, 1, WHEELIE_TIERS.expert)]).state;
      for (const seat of [0, 1] as const) {
        const r = next.riders[seat];
        expect(r.angle >= 0 && r.angle <= FLIP).toBe(true);
        expect(r.scores.length).toBeGreaterThanOrEqual(s.riders[seat].scores.length);
        expect(r.scores.length).toBeLessThanOrEqual(WHEELIE_RIDES);
      }
      s = next;
    }
  });
});
