import { describe, expect, it } from 'vitest';
import { LAP, lapsDone, newSlotCars, SLOT_CANVAS, SLOT_LAPS, SLOT_TIERS, slotAt, slotBotInput, stepSlot, type SlotInput, type SlotState, type SlotTier } from './index';

const off: SlotInput = { held: false };
const on: SlotInput = { held: true };
const racing = (seed = 1) => {
  let s = newSlotCars(seed);
  while (s.phase === 'countdown') s = stepSlot(s, [off, off]).state;
  return s;
};
function race(seed: number, a: SlotTier, b: SlotTier, limit = 200) {
  let s = newSlotCars(seed);
  for (let i = 0; i < 120 * limit && !s.result; i++) s = stepSlot(s, [slotBotInput(s, 0, a), slotBotInput(s, 1, b)]).state;
  return s;
}

describe('slot cars', () => {
  it('both lanes are the same length a lap, and the track stays on the canvas', () => {
    const end = (lane: 0 | 1) => slotAt(lane, LAP - 0.5);
    expect(LAP).toBeGreaterThan(1500);
    for (const lane of [0, 1] as const) {
      for (let s = 0; s < LAP; s += 5) {
        const p = slotAt(lane, s);
        expect(p.x > 20 && p.x < SLOT_CANVAS.width - 20 && p.y > 20 && p.y < SLOT_CANVAS.height - 20).toBe(true);
      }
      expect(Math.hypot(end(lane).x - slotAt(lane, 0).x, end(lane).y - slotAt(lane, 0).y)).toBeLessThan(6);
    }
  });

  it('each car takes one bend on the outside and one on the inside, so the lanes cross', () => {
    const limits = (lane: 0 | 1) => [...new Set(Array.from({ length: 400 }, (_, i) => slotAt(lane, (i / 400) * LAP).limit).filter(Number.isFinite).map(Math.round))];
    expect(limits(0).sort()).toEqual(limits(1).sort());
    expect(limits(0).length).toBe(2);
  });

  it('hold and it speeds up; let go and it slows', () => {
    let s = racing();
    for (let i = 0; i < 60; i++) s = stepSlot(s, [on, off]).state;
    expect(s.cars[0].v).toBeGreaterThan(200);
    expect(s.cars[1].v).toBe(0);
    const v = s.cars[0].v;
    s = stepSlot(s, [off, off]).state;
    expect(s.cars[0].v).toBeLessThan(v);
  });

  it('flat out into a bend flies off, and the marshal puts it back where it left', () => {
    let s = racing();
    let crashed = -1;
    for (let i = 0; i < 120 * 5 && crashed < 0; i++) {
      const out = stepSlot(s, [on, off]);
      if (out.events.crashed.includes(0)) crashed = i;
      s = out.state;
    }
    expect(crashed).toBeGreaterThan(0);
    expect(s.cars[0].off).toBeGreaterThan(0);
    const where = s.cars[0].s;
    let back = false;
    for (let i = 0; i < 200 && !back; i++) {
      const out = stepSlot(s, [on, off]);
      back = out.events.back.includes(0);
      s = out.state;
    }
    expect(back).toBe(true);
    expect(s.cars[0].s).toBe(where);
    expect(s.cars[0].v).toBe(0);
  });

  it('first over the line after the last lap wins', () => {
    const base = racing();
    const s: SlotState = { ...base, cars: [{ ...base.cars[0], s: SLOT_LAPS * LAP - 5, v: 300 }, { ...base.cars[1], s: SLOT_LAPS * LAP - 50, v: 300 }] };
    let out = stepSlot(s, [on, on]);
    for (let i = 0; i < 60 && !out.state.result; i++) out = stepSlot(out.state, [on, on]);
    expect(out.state.result).toEqual({ winners: [0], draw: false });
    expect(lapsDone(out.state.cars[0])).toBe(SLOT_LAPS);
  });

  it('a careful bot never flies off, and gets round', { timeout: 30_000 }, () => {
    const safe: SlotTier = { nerve: 0.9, slip: 0 };
    let s = newSlotCars(2);
    let crashes = 0;
    for (let i = 0; i < 120 * 90 && !s.result; i++) {
      const out = stepSlot(s, [slotBotInput(s, 0, safe), off]);
      crashes += out.events.crashed.length;
      s = out.state;
    }
    expect(crashes).toBe(0);
    expect(s.result).toEqual({ winners: [0], draw: false });
  });

  it('the better bot wins, and every race ends', { timeout: 60_000 }, () => {
    let wins = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const s = race(seed, SLOT_TIERS.expert, SLOT_TIERS.easy);
      expect(s.result).not.toBeNull();
      if (s.result?.winners[0] === 0) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(5);
  });

  it('invariant, every step of bot play: cars only go forward, never past top speed', () => {
    let s = newSlotCars(6);
    for (let i = 0; i < 120 * 60 && !s.result; i++) {
      const next = stepSlot(s, [slotBotInput(s, 0, SLOT_TIERS.medium), slotBotInput(s, 1, SLOT_TIERS.hard)]).state;
      for (const seat of [0, 1] as const) {
        expect(next.cars[seat].s).toBeGreaterThanOrEqual(s.cars[seat].s);
        expect(next.cars[seat].v).toBeLessThanOrEqual(800);
      }
      s = next;
    }
  });
});
