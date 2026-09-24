import { describe, expect, it } from 'vitest';
import {
  BOARD,
  COURT,
  FLOOR_Y,
  HOOPS_BALL_R,
  HOOPS_TIERS,
  HOOPS_TIME,
  hoopsBotInput,
  newHoops,
  perfectThrow,
  RIM,
  spotFor,
  stepHoops,
  type HoopsInput,
  type HoopsState,
  type HoopsTier,
} from './index';

const none: HoopsInput = { throw: null };
const playing = (seed = 1) => {
  let s = newHoops(seed);
  while (s.phase === 'countdown') s = stepHoops(s, [none, none]).state;
  return s;
};
/** Throws for seat 0 and runs until that ball is done; returns what happened. */
function shoot(s: HoopsState, t: { vx: number; vy: number }) {
  let out = stepHoops(s, [{ throw: t }, none]);
  let scored = false;
  let swish = false;
  let rim = 0;
  for (let i = 0; i < 120 * 5 && out.state.courts[0].phase !== 'done'; i++) {
    out = stepHoops(out.state, [none, none]);
    for (const e of out.events.scored) if (e.seat === 0) (scored = true), (swish = e.swish);
    rim += out.events.rim.filter((seat) => seat === 0).length;
  }
  return { state: out.state, scored, swish, rim };
}
function match(seed: number, a: HoopsTier, b: HoopsTier) {
  let s = newHoops(seed);
  for (let i = 0; i < 120 * 200 && !s.result; i++) s = stepHoops(s, [hoopsBotInput(s, 0, a), hoopsBotInput(s, 1, b)]).state;
  return s;
}

describe('basketball hoops', () => {
  it('every spot is on the court, left of the hoop and below it, and both players get the same ones', () => {
    for (let n = 0; n < 200; n++) {
      const p = spotFor(7, n);
      expect(p.x > HOOPS_BALL_R && p.x < RIM.front - 100).toBe(true);
      expect(p.y > RIM.y + 60 && p.y < FLOOR_Y - HOOPS_BALL_R).toBe(true);
    }
    const s = newHoops(3);
    expect(s.courts[0].spot).toEqual(s.courts[1].spot);
  });

  it('the perfect throw from any spot drops through the hoop, clean', () => {
    for (let n = 0; n < 30; n++) {
      let s = playing(n + 1);
      s = { ...s, courts: [{ ...s.courts[0], spot: spotFor(n + 1, n), ball: { ...spotFor(n + 1, n), vx: 0, vy: 0 } }, s.courts[1]] };
      const shot = shoot(s, perfectThrow(s.courts[0].spot));
      expect(shot.scored).toBe(true);
      expect(shot.swish).toBe(true);
      expect(shot.state.scores[0]).toBe(1);
    }
  });

  it('a throw too soft misses, and the next ball waits at a new spot', () => {
    const s = playing();
    const t = perfectThrow(s.courts[0].spot);
    const shot = shoot(s, { vx: t.vx * 0.8, vy: t.vy * 0.8 });
    expect(shot.scored).toBe(false);
    let after = shot.state;
    for (let i = 0; i < 120 && after.courts[0].phase !== 'ready'; i++) after = stepHoops(after, [none, none]).state;
    expect(after.courts[0].phase).toBe('ready');
    expect(after.courts[0].shots).toBe(1);
    expect(after.courts[0].spot).toEqual(spotFor(1, 1));
  });

  it('a throw a little long clangs off the rim or the board, and it is not a swish if it goes in', () => {
    let rims = 0;
    for (let n = 1; n <= 12; n++) {
      const s = playing(n);
      const t = perfectThrow(s.courts[0].spot);
      const shot = shoot(s, { vx: t.vx * 1.06, vy: t.vy * 1.06 });
      if (shot.rim) rims++;
      if (shot.scored) expect(shot.swish).toBe(false);
    }
    expect(rims).toBeGreaterThan(0);
  });

  it('only an upward flick is a throw', () => {
    const s = playing();
    expect(stepHoops(s, [{ throw: { vx: 400, vy: 300 } }, none]).state.courts[0].phase).toBe('ready');
    expect(stepHoops(s, [{ throw: { vx: 5, vy: -40 } }, none]).state.courts[0].phase).toBe('ready');
    expect(stepHoops(s, [{ throw: { vx: 300, vy: -700 } }, none]).state.courts[0].phase).toBe('flying');
  });

  it('a ball never leaves its own court through the middle of the phone, nor goes through the board', () => {
    const s = playing();
    let out = stepHoops(s, [{ throw: { vx: 900, vy: -1400 } }, none]);
    for (let i = 0; i < 400; i++) {
      out = stepHoops(out.state, [none, none]);
      const b = out.state.courts[0].ball;
      expect(b.y).toBeGreaterThanOrEqual(HOOPS_BALL_R - 1e-9);
      if (b.y > BOARD.top && b.y < BOARD.bottom) expect(b.x).toBeLessThan(BOARD.x + 8 + HOOPS_BALL_R + 1e-6);
    }
    expect(COURT.height).toBe(450);
  });

  it('most baskets at the buzzer wins; level, the next basket wins', () => {
    const s = playing();
    const late: HoopsState = { ...s, clock: 1 / 240, scores: [4, 3] };
    expect(stepHoops(late, [none, none]).state.result).toEqual({ winners: [0], draw: false });
    const level = stepHoops({ ...late, scores: [3, 3] }, [none, none]);
    expect(level.events.buzzer).toBe(true);
    expect(level.state.phase).toBe('golden');
    expect(level.state.result).toBeNull();
    const golden = shoot({ ...level.state, courts: [{ ...level.state.courts[0] }, level.state.courts[1]] }, perfectThrow(level.state.courts[0].spot));
    expect(golden.state.result).toEqual({ winners: [0], draw: false });
    expect(HOOPS_TIME).toBe(60);
  });

  it('the better bot wins, and every match ends', { timeout: 60_000 }, () => {
    let wins = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const s = match(seed, HOOPS_TIERS.expert, HOOPS_TIERS.easy);
      expect(s.result).not.toBeNull();
      if (s.result?.winners[0] === 0) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(5);
  });

  it('invariant, every step of bot play: scores climb one basket at a time, balls stay in their courts', { timeout: 30_000 }, () => {
    let s = newHoops(4);
    for (let i = 0; i < 120 * 90 && !s.result; i++) {
      const next = stepHoops(s, [hoopsBotInput(s, 0, HOOPS_TIERS.medium), hoopsBotInput(s, 1, HOOPS_TIERS.hard)]).state;
      for (const seat of [0, 1] as const) {
        expect(next.scores[seat] - s.scores[seat] === 0 || next.scores[seat] - s.scores[seat] === 1).toBe(true);
        const b = next.courts[seat].ball;
        expect(b.y >= HOOPS_BALL_R - 1e-9 && b.y <= FLOOR_Y - HOOPS_BALL_R + 1e-9).toBe(true);
      }
      s = next;
    }
  });
});
