import { describe, expect, it } from 'vitest';
import {
  clearLine,
  newTankDuel,
  SHELL_R,
  startTanks,
  stepTank,
  TANK_CANVAS,
  TANK_R,
  TANK_TIERS,
  TANK_WALLS,
  TANK_WIN,
  tankBotInput,
  type TankInput,
  type TankState,
  type TankTier,
} from './index';

const up: TankInput = { held: false };
const down: TankInput = { held: true };
const playing = (seed = 1) => {
  let s = newTankDuel(seed);
  while (s.phase === 'countdown') s = stepTank(s, [up, up]).state;
  return s;
};
const inWall = (x: number, y: number, r: number) =>
  TANK_WALLS.some((w) => Math.hypot(x - Math.min(Math.max(x, w.x), w.x + w.w), y - Math.min(Math.max(y, w.y), w.y + w.h)) < r - 0.5);
function match(seed: number, a: TankTier, b: TankTier) {
  let s = newTankDuel(seed);
  for (let i = 0; i < 120 * 400 && !s.result; i++) s = stepTank(s, [tankBotInput(s, 0, a), tankBotInput(s, 1, b)]).state;
  return s;
}

describe('tank duel', () => {
  it('the arena is the same turned round, and both tanks start clear of it', () => {
    const { width: W, height: H } = TANK_CANVAS;
    for (const w of TANK_WALLS) expect(TANK_WALLS.some((v) => Math.abs(v.x - (W - w.x - w.w)) < 1e-9 && Math.abs(v.y - (H - w.y - w.h)) < 1e-9 && v.w === w.w && v.h === w.h)).toBe(true);
    for (const t of newTankDuel(1).tanks) expect(inWall(t.x, t.y, TANK_R)).toBe(false);
  });

  it('let go and a tank spins on the spot; hold and it drives the way it faces', () => {
    const base = playing();
    const s: TankState = { ...base, tanks: [{ ...base.tanks[0], angle: -Math.PI / 2 }, base.tanks[1]] };
    const spun = stepTank(s, [up, up]).state.tanks[0];
    expect(spun.x).toBe(s.tanks[0].x);
    expect(spun.angle).not.toBe(s.tanks[0].angle);
    let d = s;
    for (let i = 0; i < 60; i++) d = stepTank(d, [down, up]).state;
    expect(d.tanks[0].angle).toBe(s.tanks[0].angle);
    expect(d.tanks[0].y).toBeLessThan(s.tanks[0].y - 60);
  });

  it('each press fires one shell, only three out at once, and holding does not keep firing', () => {
    let s = playing();
    let fired = 0;
    for (let i = 0; i < 120; i++) {
      const out = stepTank(s, [i % 40 === 0 ? down : up, up]);
      fired += out.events.fired.length;
      s = out.state;
    }
    expect(fired).toBe(3);
    s = playing();
    let held = 0;
    for (let i = 0; i < 120; i++) {
      const out = stepTank(s, [down, up]);
      held += out.events.fired.length;
      s = out.state;
    }
    expect(held).toBe(1);
    s = playing();
    let many = 0;
    for (let i = 0; i < 240; i++) {
      const out = stepTank(s, [i % 2 === 0 ? down : up, up]);
      many += out.events.fired.length;
      s = out.state;
      expect(s.shells.filter((sh) => sh.owner === 0).length).toBeLessThanOrEqual(3);
    }
    expect(many).toBeGreaterThanOrEqual(3);
  });

  it('holding through the countdown is not a press', () => {
    let s = newTankDuel(1);
    let fired = 0;
    for (let i = 0; i < 200; i++) {
      const out = stepTank(s, [down, up]);
      fired += out.events.fired.length;
      s = out.state;
    }
    expect(s.phase).toBe('play');
    expect(fired).toBe(0);
  });

  it('a shell fired straight at the other tank wins the round', () => {
    const base = playing();
    const s: TankState = { ...base, tanks: [{ ...base.tanks[0], x: 100, y: 800, angle: 0 }, { ...base.tanks[1], x: 500, y: 800, angle: 0 }] };
    let out = stepTank(s, [down, up]);
    let hit: number[] = [];
    for (let i = 0; i < 200 && !hit.length; i++) {
      out = stepTank(out.state, [up, up]);
      hit = out.events.hit;
    }
    expect(hit).toEqual([1]);
    expect(out.state.scores).toEqual([1, 0]);
    expect(out.state.phase).toBe('hit');
  });

  it('shells bounce off walls, and your own never hurt you', () => {
    const base = playing();
    // Straight at the left edge from close by: it bounces and comes back.
    const s: TankState = { ...base, tanks: [{ ...base.tanks[0], x: 120, y: 820, angle: Math.PI }, { ...base.tanks[1], x: 500, y: 80, angle: 0 }] };
    let out = stepTank(s, [down, up]);
    let bounced = 0;
    let hit: number[] = [];
    for (let i = 0; i < 300 && !hit.length; i++) {
      out = stepTank(out.state, [down, up]);
      bounced += out.events.bounced;
      hit = out.events.hit;
    }
    expect(bounced).toBeGreaterThan(0);
    expect(hit).toEqual([]);
    expect(out.state.scores).toEqual([0, 0]);
  });

  it('first to five rounds wins, and the round after a hit starts fresh', () => {
    const base = playing();
    const s: TankState = { ...base, scores: [TANK_WIN - 1, 2], tanks: [{ ...base.tanks[0], x: 100, y: 800, angle: 0 }, { ...base.tanks[1], x: 300, y: 800 }] };
    let out = stepTank(s, [down, up]);
    for (let i = 0; i < 200 && !out.state.result; i++) out = stepTank(out.state, [up, up]);
    expect(out.state.result).toEqual({ winners: [0], draw: false });
    let next = stepTank({ ...s, scores: [1, 1] }, [down, up]).state;
    for (let i = 0; i < 400 && next.phase !== 'countdown'; i++) next = stepTank(next, [up, up]).state;
    expect(next.tanks).toEqual(startTanks(1, 1));
    expect(next.rounds).toBe(1);
    expect(next.shells).toEqual([]);
  });

  it('sees through the open and not through a block', () => {
    const w = TANK_WALLS[0]!;
    expect(clearLine(w.x - 40, w.y + w.h / 2, w.x + w.w + 40, w.y + w.h / 2)).toBe(false);
    expect(clearLine(30, 30, 30, 870)).toBe(true);
  });

  it('the better bot wins, and every match ends', { timeout: 60_000 }, () => {
    let wins = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const s = match(seed, TANK_TIERS.expert, TANK_TIERS.easy);
      expect(s.result).not.toBeNull();
      if (s.result?.winners[0] === 0) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(5);
  });

  it('invariant, every step of bot play: tanks and shells never inside a block or off the arena', { timeout: 30_000 }, () => {
    let s = newTankDuel(8);
    for (let i = 0; i < 120 * 120 && !s.result; i++) {
      s = stepTank(s, [tankBotInput(s, 0, TANK_TIERS.hard), tankBotInput(s, 1, TANK_TIERS.medium)]).state;
      for (const t of s.tanks) {
        expect(inWall(t.x, t.y, TANK_R)).toBe(false);
        expect(t.x >= TANK_R - 1e-6 && t.x <= TANK_CANVAS.width - TANK_R + 1e-6 && t.y >= TANK_R - 1e-6 && t.y <= TANK_CANVAS.height - TANK_R + 1e-6).toBe(true);
      }
      for (const sh of s.shells) expect(inWall(sh.x, sh.y, SHELL_R)).toBe(false);
    }
  });
});
