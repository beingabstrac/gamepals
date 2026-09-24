import { describe, expect, it } from 'vitest';
import {
  canGrab,
  countOn,
  MAX_SHOT,
  newSlingPuck,
  shotVelocity,
  slingSide,
  SLING_CANVAS,
  SLING_PUCKS,
  SLING_R,
  SLING_TIERS,
  SLING_TIME,
  SLING_WALL,
  slingBotInput,
  stepSling,
  type SlingInput,
  type SlingPuck,
  type SlingState,
  type SlingTier,
} from './index';

const none: SlingInput = { shot: null };
const playing = (seed = 1) => {
  let s = newSlingPuck(seed);
  while (s.phase === 'countdown') s = stepSling(s, [none, none]).state;
  return s;
};
const still = (s: SlingState, steps = 1200) => {
  for (let i = 0; i < steps && !s.result; i++) s = stepSling(s, [none, none]).state;
  return s;
};
/** Plays two bots against each other; returns the end state and how many seconds it took. */
function match(seed: number, a: SlingTier, b: SlingTier, limit = 200) {
  let s = newSlingPuck(seed);
  const since = [0, 0];
  const shots = [0, 0];
  let t = 0;
  while (!s.result && t < limit) {
    const inputs = [slingBotInput(s, 0, a, since[0]!, shots[0]!), slingBotInput(s, 1, b, since[1]!, shots[1]!)] as [SlingInput, SlingInput];
    const out = stepSling(s, inputs);
    for (const seat of [0, 1]) since[seat]! += 1 / 120;
    for (const seat of out.events.shots) {
      since[seat] = 0;
      shots[seat]!++;
    }
    s = out.state;
    t += 1 / 120;
  }
  return { s, t };
}

describe('sling puck', () => {
  it('five pucks start on each side, clear of the wall and of each other', () => {
    const s = newSlingPuck(1);
    expect(countOn(s, 0)).toBe(SLING_PUCKS);
    expect(countOn(s, 1)).toBe(SLING_PUCKS);
    expect(still(playing()).pucks).toEqual(s.pucks);
  });

  it('a pull fires the puck back the way it was pulled, capped, and only toward the wall', () => {
    expect(shotVelocity(0, { x: 0, y: 100 })!.vy).toBeLessThan(0);
    expect(shotVelocity(1, { x: 0, y: -100 })!.vy).toBeGreaterThan(0);
    expect(shotVelocity(0, { x: 0, y: -100 })).toBeNull();
    expect(shotVelocity(0, { x: 2, y: 3 })).toBeNull();
    const v = shotVelocity(0, { x: 0, y: 900 })!;
    expect(Math.abs(Math.hypot(v.vx, v.vy) - MAX_SHOT)).toBeLessThan(1e-6);
  });

  it('you can only shoot your own pucks, and only once they are nearly still', () => {
    const s = playing();
    const mine = s.pucks.findIndex((p) => slingSide(p) === 0);
    const theirs = s.pucks.findIndex((p) => slingSide(p) === 1);
    expect(canGrab(s, 0, mine)).toBe(true);
    expect(canGrab(s, 0, theirs)).toBe(false);
    const shot = stepSling(s, [{ shot: { puck: theirs, pull: { x: 0, y: 100 } } }, none]);
    expect(shot.events.shots).toEqual([]);
    const fired = stepSling(s, [{ shot: { puck: mine, pull: { x: 0, y: 100 } } }, none]).state;
    expect(canGrab(fired, 0, mine)).toBe(false);
  });

  it('a straight shot through the slot crosses to the other side and stays there', () => {
    const lone: SlingPuck = { x: SLING_CANVAS.width / 2, y: 700, vx: 0, vy: 0 };
    let s: SlingState = { ...playing(), pucks: [lone, { x: 100, y: 850, vx: 0, vy: 0 }, { x: 500, y: 60, vx: 0, vy: 0 }] };
    s = stepSling(s, [{ shot: { puck: 0, pull: { x: 0, y: 120 } } }, none]).state;
    s = still(s);
    expect(slingSide(s.pucks[0]!)).toBe(1);
  });

  it('the wall stops a puck fired at it away from the slot', () => {
    const lone: SlingPuck = { x: 100, y: 700, vx: 0, vy: 0 };
    let s: SlingState = { ...playing(), pucks: [lone, { x: 500, y: 850, vx: 0, vy: 0 }, { x: 500, y: 60, vx: 0, vy: 0 }] };
    s = stepSling(s, [{ shot: { puck: 0, pull: { x: 0, y: 150 } } }, none]).state;
    let lowest = Infinity;
    for (let i = 0; i < 600; i++) {
      s = stepSling(s, [none, none]).state;
      lowest = Math.min(lowest, s.pucks[0]!.y);
    }
    expect(lowest).toBeGreaterThanOrEqual(SLING_WALL.y + SLING_WALL.half + SLING_R - 1);
    expect(slingSide(s.pucks[0]!)).toBe(0);
  });

  it('two pucks never end up inside each other', () => {
    let s: SlingState = { ...playing(), pucks: [{ x: 300, y: 700, vx: 0, vy: -1200 }, { x: 300, y: 560, vx: 0, vy: 0 }, { x: 60, y: 60, vx: 0, vy: 0 }] };
    let hits = 0;
    for (let i = 0; i < 400; i++) {
      const out = stepSling(s, [none, none]);
      hits += out.events.clack;
      s = out.state;
      const [a, b] = s.pucks;
      expect(Math.hypot(a!.x - b!.x, a!.y - b!.y)).toBeGreaterThan(2 * SLING_R - 1);
    }
    expect(hits).toBeGreaterThan(0);
  });

  it('empty your side and you win; when the clock runs out, fewer pucks on your side wins', () => {
    const base = playing();
    const up: SlingPuck = { x: 300, y: 200, vx: 0, vy: 0 };
    const won = stepSling({ ...base, pucks: [up, { ...up, x: 100 }] }, [none, none]).state;
    expect(won.result).toEqual({ winners: [0], draw: false });
    const late: SlingState = { ...base, clock: 1 / 240, pucks: [up, { x: 100, y: 800, vx: 0, vy: 0 }, { x: 200, y: 800, vx: 0, vy: 0 }, { x: 500, y: 800, vx: 0, vy: 0 }] };
    const timeUp = stepSling(late, [none, none]).state;
    expect(timeUp.result).toEqual({ winners: [1], draw: false });
    const level = stepSling({ ...late, pucks: late.pucks.slice(0, 2) }, [none, none]).state;
    expect(level.result).toEqual({ winners: [], draw: true });
    expect(SLING_TIME).toBe(120);
  });

  it('bot shots land: an expert empties its side against nobody', { timeout: 30_000 }, () => {
    const idle: SlingTier = { pace: 1e9, aim: 0, choosy: false };
    const { s, t } = match(3, SLING_TIERS.expert, idle, 60);
    expect(s.result?.winners).toEqual([0]);
    expect(t).toBeLessThan(30);
  });

  it('the better bot wins', { timeout: 60_000 }, () => {
    let wins = 0;
    for (let seed = 1; seed <= 6; seed++) if (match(seed, SLING_TIERS.expert, SLING_TIERS.easy).s.result?.winners[0] === 0) wins++;
    expect(wins).toBeGreaterThanOrEqual(5);
  });

  it('invariant, every step of bot play: ten pucks, all on the board, none inside the wall', { timeout: 30_000 }, () => {
    let s = newSlingPuck(5);
    const since = [0, 0];
    for (let i = 0; i < 120 * 60 && !s.result; i++) {
      const out = stepSling(s, [slingBotInput(s, 0, SLING_TIERS.hard, since[0]!, i), slingBotInput(s, 1, SLING_TIERS.medium, since[1]!, i)]);
      since[0]! += 1 / 120;
      since[1]! += 1 / 120;
      for (const seat of out.events.shots) since[seat] = 0;
      s = out.state;
      expect(s.pucks.length).toBe(2 * SLING_PUCKS);
      for (const p of s.pucks) {
        expect(p.x >= SLING_R - 1e-6 && p.x <= SLING_CANVAS.width - SLING_R + 1e-6 && p.y >= SLING_R - 1e-6 && p.y <= SLING_CANVAS.height - SLING_R + 1e-6).toBe(true);
        for (const [x0, x1] of [[0, SLING_WALL.slot0], [SLING_WALL.slot1, SLING_CANVAS.width]] as const) {
          const nx = Math.min(Math.max(p.x, x0), x1);
          const ny = Math.min(Math.max(p.y, SLING_WALL.y - SLING_WALL.half), SLING_WALL.y + SLING_WALL.half);
          expect(Math.hypot(p.x - nx, p.y - ny)).toBeGreaterThan(SLING_R - 1);
        }
      }
    }
  });
});
