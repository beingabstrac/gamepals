import { describe, expect, it } from 'vitest';
import {
  CAR_Y,
  newRoadDodge,
  ROAD_LIVES,
  ROAD_TIERS,
  ROAD_TIME,
  roadBotInput,
  rowLanes,
  rowY,
  stepRoad,
  type RoadInput,
  type RoadState,
  type RoadTier,
} from './index';

const stay: RoadInput = { steer: 0 };
const playing = (seed = 1) => {
  let s = newRoadDodge(seed);
  while (s.phase === 'countdown') s = stepRoad(s, [stay, stay]).state;
  return s;
};
function match(seed: number, a: RoadTier, b: RoadTier, limit = 150) {
  let s = newRoadDodge(seed);
  for (let i = 0; i < 120 * limit && !s.result; i++) s = stepRoad(s, [roadBotInput(s, 0, a), roadBotInput(s, 1, b)]).state;
  return s;
}

describe('road dodge', () => {
  it('every row leaves at least one lane free, and blocks at least one', () => {
    for (let k = 0; k < 2000; k++) {
      const lanes = rowLanes(9, k);
      expect(lanes.length).toBe(3);
      expect(lanes.some((b) => !b)).toBe(true);
      expect(lanes.some((b) => b)).toBe(true);
    }
  });

  it('rows come down the road toward the car as it rolls', () => {
    expect(rowY(0, 0)).toBeLessThan(0);
    expect(rowY(0, 700)).toBe(CAR_Y);
    expect(rowY(1, 700)).toBeLessThan(rowY(0, 700));
  });

  it('a tap moves one lane, never off the road', () => {
    let s = playing();
    s = stepRoad(s, [{ steer: -1 }, { steer: 1 }]).state;
    expect(s.cars[0].lane).toBe(0);
    expect(s.cars[1].lane).toBe(2);
    s = stepRoad(s, [{ steer: -1 }, { steer: 1 }]).state;
    expect(s.cars[0].lane).toBe(0);
    expect(s.cars[1].lane).toBe(2);
    for (let i = 0; i < 30; i++) s = stepRoad(s, [stay, stay]).state;
    expect(s.cars[0].x).toBe(0);
  });

  it('a car sitting in a blocked lane is bumped once by that row, and blinks safe after', () => {
    let s = playing(3);
    // Park both cars in whichever lane the first row blocks.
    const lane = rowLanes(3, 0).findIndex((b) => b);
    s = { ...s, cars: [{ ...s.cars[0], x: lane, lane }, { ...s.cars[1], x: lane, lane }] };
    let bumps = 0;
    for (let i = 0; i < 120 * 3; i++) {
      const out = stepRoad(s, [stay, stay]);
      bumps += out.events.bumped.filter((seat) => seat === 0).length;
      s = out.state;
    }
    expect(bumps).toBeGreaterThanOrEqual(1);
    expect(s.cars[0].lives).toBe(ROAD_LIVES - bumps);
  });

  it('three bumps and you are out; last one driving wins, and time up goes on lives', () => {
    const base = playing();
    const out: RoadState = { ...base, cars: [{ ...base.cars[0], lives: 1 }, base.cars[1]] };
    let s = out;
    for (let i = 0; i < 120 * 30 && !s.result; i++) s = stepRoad(s, [stay, roadBotInput(s, 1, ROAD_TIERS.expert)]).state;
    expect(s.cars[0].lives).toBe(0);
    expect(s.result).toEqual({ winners: [1], draw: false });
    const late: RoadState = { ...base, time: ROAD_TIME - 1 / 240, cars: [{ ...base.cars[0], lives: 2 }, base.cars[1]] };
    expect(stepRoad(late, [stay, stay]).state.result).toEqual({ winners: [1], draw: false });
    expect(stepRoad({ ...late, cars: [base.cars[0], base.cars[1]] }, [stay, stay]).state.result).toEqual({ winners: [], draw: true });
  });

  it('both roads carry the same traffic: two of the same bot drive alike', () => {
    let s = playing(5);
    for (let i = 0; i < 120 * 20; i++) {
      s = stepRoad(s, [roadBotInput(s, 0, ROAD_TIERS.hard), roadBotInput({ ...s, cars: [s.cars[1], s.cars[0]] }, 0, ROAD_TIERS.hard)]).state;
      expect(s.cars[0]).toEqual(s.cars[1]);
    }
  });

  it('the better bot wins, and every match ends', { timeout: 60_000 }, () => {
    let wins = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const s = match(seed, ROAD_TIERS.expert, ROAD_TIERS.easy);
      expect(s.result).not.toBeNull();
      if (s.result?.winners[0] === 0) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(5);
  });

  it('invariant, every step of bot play: lives only go down, one bump at a time, cars stay on the road', () => {
    let s = newRoadDodge(4);
    for (let i = 0; i < 120 * 120 && !s.result; i++) {
      const next = stepRoad(s, [roadBotInput(s, 0, ROAD_TIERS.medium), roadBotInput(s, 1, ROAD_TIERS.hard)]).state;
      for (const seat of [0, 1] as const) {
        const d = s.cars[seat].lives - next.cars[seat].lives;
        expect(d === 0 || d === 1).toBe(true);
        expect(next.cars[seat].x >= 0 && next.cars[seat].x <= 2).toBe(true);
      }
      s = next;
    }
  });
});
