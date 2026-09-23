import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import type { BotTier } from '../../core/types';
import {
  CAR_RADIUS,
  checkpointAt,
  GRASS_SPEED,
  LAPS,
  newRace,
  onRoad,
  RACE_STEP,
  RACE_TIERS,
  raceBotInput,
  stepRace,
  TOP_SPEED,
  TRACK_WIDTH,
  TRACKS,
  type RaceInput,
  type RaceState,
} from './index';

const straight: RaceInput = { turn: 0 };
const racing = (seed = 0): RaceState => ({ ...newRace(seed), phase: 'race', timer: 0 });
const run = (state: RaceState, seconds: number, inputs: [RaceInput, RaceInput] = [straight, straight]) => {
  let s = state;
  for (let t = 0; t < seconds; t += RACE_STEP) s = stepRace(s, inputs).state;
  return s;
};

describe('racing', () => {
  it('every track starts both cars on the road, clear of each other', () => {
    TRACKS.forEach((_, i) => {
      const s = newRace(i);
      expect(s.track).toBe(i);
      for (const car of s.cars) expect(onRoad(TRACKS[i]!, car.x, car.y), `track ${i}`).toBe(true);
      expect(Math.hypot(s.cars[0].x - s.cars[1].x, s.cars[0].y - s.cars[1].y)).toBeGreaterThanOrEqual(CAR_RADIUS * 2);
    });
  });

  it('no track runs its road over itself: separate parts stay a road width and more apart', () => {
    TRACKS.forEach((track, t) => {
      const n = track.line.length;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const apart = Math.min(j - i, n - (j - i));
          if (apart < n / 6) continue;
          const a = track.line[i]!;
          const b = track.line[j]!;
          expect(Math.hypot(a.x - b.x, a.y - b.y), `track ${t} samples ${i} and ${j}`).toBeGreaterThan(TRACK_WIDTH * 1.25);
        }
      }
    });
  });

  it('a car left to drive goes straight and speeds up', () => {
    const start = racing(0);
    const s = run(start, 0.5);
    expect(s.cars[0].speed).toBeGreaterThan(start.cars[0].speed);
    expect(s.cars[0].angle).toBe(start.cars[0].angle);
    expect(s.cars[0].speed).toBeLessThanOrEqual(TOP_SPEED);
  });

  it('steering turns it, and on the grass it slows to grass speed', () => {
    const s = run(racing(0), 0.5, [{ turn: 1 }, straight]);
    expect(s.cars[0].angle).toBeGreaterThan(racing(0).cars[0].angle);
    // Straight on for a long while leaves the oval for the grass.
    const off = run(racing(0), 4);
    expect(onRoad(TRACKS[0]!, off.cars[0].x, off.cars[0].y)).toBe(false);
    expect(off.cars[0].speed).toBeLessThanOrEqual(GRASS_SPEED + 1);
  });

  it('a lap counts only after every checkpoint in order, and three laps wins', { timeout: 60_000 }, () => {
    // Drive a car along the centre line by hand: teleporting it to the start line early is no lap.
    const track = TRACKS[0]!;
    let s = racing(0);
    const at = track.line[checkpointAt(0)]!;
    s = { ...s, cars: [{ ...s.cars[0], x: at.x, y: at.y }, s.cars[1]] };
    s = stepRace(s, [straight, straight]).state;
    expect(s.cars[0].laps).toBe(0);
    // The expert bot laps properly.
    let race = racing(0);
    let laps = 0;
    for (let step = 0; step < 120 * 120 && !race.result; step++) {
      const r = stepRace(race, [raceBotInput(race, 0, RACE_TIERS.expert), straight]);
      if (r.events.lap[0]) laps++;
      race = r.state;
    }
    expect(laps).toBe(LAPS);
    expect(race.result).toEqual({ winners: [0], draw: false });
  });

  it('the same inputs always give the same race', () => {
    const a = run(racing(2), 3, [{ turn: 1 }, { turn: -1 }]);
    const b = run(racing(2), 3, [{ turn: 1 }, { turn: -1 }]);
    expect(a).toEqual(b);
  });

  it('Expert beats Easy in most races on every track', { timeout: 120_000 }, () => {
    const race = (tiers: [BotTier, BotTier], seed: number) => {
      const rng = createRng(seed);
      let s: RaceState = { ...newRace(seed), phase: 'race', timer: 0 };
      let noise: [number, number] = [0, 0];
      for (let step = 0; step < 120 * 180 && !s.result; step++) {
        if (step % 36 === 0) noise = [rng.next() * 2 - 1, rng.next() * 2 - 1];
        s = stepRace(s, [raceBotInput(s, 0, RACE_TIERS[tiers[0]], noise[0]), raceBotInput(s, 1, RACE_TIERS[tiers[1]], noise[1])]).state;
      }
      return s.result;
    };
    for (let track = 0; track < TRACKS.length; track++) {
      let expert = 0;
      for (let k = 0; k < 6; k++) {
        const seed = track + TRACKS.length * k;
        const expertSeat = k % 2;
        const result = race(expertSeat === 0 ? ['expert', 'easy'] : ['easy', 'expert'], seed);
        expect(result, `track ${track} race ${k} finished`).not.toBeNull();
        if (result?.winners.length === 1 && result.winners[0] === expertSeat) expert++;
      }
      expect(expert, `track ${track}`).toBeGreaterThanOrEqual(4);
    }
  });
});

/** Invariant: laps never go down, the next checkpoint only moves on by one, speed never passes top speed. */
describe('racing invariants', () => {
  it('keeps laps climbing, checkpoints in order and speed under the top', { timeout: 60_000 }, () => {
    for (let seed = 0; seed < 6; seed++) {
      const rng = createRng(seed);
      let s = racing(seed);
      let inputs: [RaceInput, RaceInput] = [straight, straight];
      for (let step = 0; step < 120 * 40 && !s.result; step++) {
        if (step % 20 === 0) inputs = [{ turn: rng.int(3) - 1 }, raceBotInput(s, 1, RACE_TIERS.hard)];
        const before = s.cars;
        s = stepRace(s, inputs).state;
        s.cars.forEach((car, i) => {
          const was = before[i]!;
          const where = `seed ${seed} step ${step} car ${i}`;
          expect(car.laps, where).toBeGreaterThanOrEqual(was.laps);
          expect(car.next === was.next || car.next === (was.next + 1) % 8, where).toBe(true);
          expect(car.speed, where).toBeLessThanOrEqual(TOP_SPEED + 1e-9);
        });
      }
    }
  });
});

