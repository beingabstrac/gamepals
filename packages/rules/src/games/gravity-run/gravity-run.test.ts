import { describe, expect, it } from 'vitest';
import {
  RUN_BLOCK,
  blockAt,
  blocksNear,
  CORRIDOR,
  GRAVITY_TIERS,
  gravityBotInput,
  newGravityRun,
  RUN_LIVES,
  RUN_TIME,
  RUNNER,
  standing,
  stepGravity,
  type GravityInput,
  type GravityState,
  type GravityTier,
} from './index';

const stay: GravityInput = { flip: false };
const tap: GravityInput = { flip: true };
const running = (seed = 1) => {
  let s = newGravityRun(seed);
  while (s.phase === 'countdown') s = stepGravity(s, [stay, stay]).state;
  return s;
};
function match(seed: number, a: GravityTier, b: GravityTier) {
  let s = newGravityRun(seed);
  for (let i = 0; i < 120 * 200 && !s.result; i++) s = stepGravity(s, [gravityBotInput(s, 0, a), gravityBotInput(s, 1, b)]).state;
  return s;
}

describe('gravity run', () => {
  it('a tap flips gravity: the runner falls to the ceiling and stands there', () => {
    let s = running();
    expect(standing(s.runners[0])).toBe(true);
    s = stepGravity(s, [tap, stay]).state;
    expect(s.runners[0].down).toBe(-1);
    for (let i = 0; i < 120; i++) s = stepGravity(s, [stay, stay]).state;
    expect(standing(s.runners[0])).toBe(true);
    expect(s.runners[0].y).toBe(CORRIDOR.ceiling + RUNNER.h / 2);
  });

  it('a tap in mid-air does nothing', () => {
    let s = running();
    s = stepGravity(s, [tap, stay]).state;
    const mid = stepGravity(stepGravity(s, [stay, stay]).state, [tap, stay]).state;
    expect(mid.runners[0].down).toBe(-1);
  });

  it('blocks stand further and further along, and a close pair is always on opposite sides', () => {
    let last = -Infinity;
    for (let k = 0; k < 300; k++) {
      const b = blockAt(3, k);
      expect(b.at).toBeGreaterThan(last + RUN_BLOCK.w);
      last = b.at;
    }
    for (let k = 1; k < 300; k++) if (blockAt(3, k).at - blockAt(3, k - 1).at < 330) expect(blockAt(3, k).top).not.toBe(blockAt(3, k - 1).top);
    const near = blocksNear(3, blockAt(3, 40).at, 400);
    expect(near.some((b) => b.k === 40)).toBe(true);
  });

  it('staying on the floor runs into a floor block and costs a heart, once', () => {
    let s = running(2);
    const first = [0, 1, 2, 3].map((k) => blockAt(2, k)).find((b) => !b.top)!;
    let bumps = 0;
    for (let i = 0; i < 120 * 30 && s.distance < first.at + 200; i++) {
      const out = stepGravity(s, [stay, stay]);
      bumps += out.events.bumped.filter((seat) => seat === 0).length;
      s = out.state;
    }
    expect(bumps).toBeGreaterThanOrEqual(1);
    expect(s.runners[0].lives).toBe(RUN_LIVES - bumps);
  });

  it('three bumps and you are out; last one running wins, and time up goes on hearts', () => {
    const base = running();
    const worn: GravityState = { ...base, runners: [{ ...base.runners[0], lives: 1 }, base.runners[1]] };
    let s = worn;
    for (let i = 0; i < 120 * 60 && !s.result; i++) s = stepGravity(s, [stay, gravityBotInput(s, 1, GRAVITY_TIERS.expert)]).state;
    expect(s.result).toEqual({ winners: [1], draw: false });
    const late: GravityState = { ...base, time: RUN_TIME - 1 / 240, runners: [{ ...base.runners[0], lives: 2 }, base.runners[1]] };
    expect(stepGravity(late, [stay, stay]).state.result).toEqual({ winners: [1], draw: false });
    expect(stepGravity({ ...late, runners: base.runners }, [stay, stay]).state.result).toEqual({ winners: [], draw: true });
  });

  it('the better bot wins, and every match ends', { timeout: 60_000 }, () => {
    let wins = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const s = match(seed, GRAVITY_TIERS.expert, GRAVITY_TIERS.easy);
      expect(s.result).not.toBeNull();
      if (s.result?.winners[0] === 0) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(5);
  });

  it('invariant, every step of bot play: runners stay in the corridor, hearts only go down one at a time', () => {
    let s = newGravityRun(5);
    for (let i = 0; i < 120 * 90 && !s.result; i++) {
      const next = stepGravity(s, [gravityBotInput(s, 0, GRAVITY_TIERS.medium), gravityBotInput(s, 1, GRAVITY_TIERS.hard)]).state;
      for (const seat of [0, 1] as const) {
        const r = next.runners[seat];
        expect(r.y - RUNNER.h / 2 >= CORRIDOR.ceiling - 1e-6 && r.y + RUNNER.h / 2 <= CORRIDOR.floor + 1e-6).toBe(true);
        const d = s.runners[seat].lives - r.lives;
        expect(d === 0 || d === 1).toBe(true);
      }
      s = next;
    }
  });
});
