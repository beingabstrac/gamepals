import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { BOMB_CANVAS, BOMB_LIVES, BOMB_TIERS, bombBotInput, BUTTON_R, buttonFor, fuseFor, newBombPass, stepBomb, type BombInput, type BombState } from './index';

const none: BombInput = { tap: null };
const run = (s: BombState, steps: number, inputs: (s: BombState) => [BombInput, BombInput] = () => [none, none]) => {
  for (let i = 0; i < steps && !s.result; i++) s = stepBomb(s, inputs(s)).state;
  return s;
};
const held = (seed = 1) => run(newBombPass(seed), 200);

describe('bomb pass', () => {
  it('after the countdown someone is holding it, with a button in their own half', () => {
    const s = held();
    expect(s.phase).toBe('held');
    const half = s.holder === 0 ? s.button.y > BOMB_CANVAS.height / 2 : s.button.y < BOMB_CANVAS.height / 2;
    expect(half).toBe(true);
  });

  it('a tap on the button throws it; a tap beside it does not', () => {
    const s = held();
    const on: BombInput = { tap: s.button };
    const inputs: [BombInput, BombInput] = s.holder === 0 ? [on, none] : [none, on];
    const next = stepBomb(s, inputs);
    expect(next.events.thrown).toBe(true);
    expect(next.state.phase).toBe('flying');
    const wide: BombInput = { tap: { x: s.button.x + BUTTON_R * 2, y: s.button.y } };
    const miss = stepBomb(s, s.holder === 0 ? [wide, none] : [none, wide]);
    expect(miss.events.miss).toBe(true);
    expect(miss.state.phase).toBe('held');
  });

  it('only the holder can throw', () => {
    const s = held();
    const on: BombInput = { tap: s.button };
    const next = stepBomb(s, s.holder === 0 ? [none, on] : [on, none]);
    expect(next.state.phase).toBe('held');
  });

  it('the fuse goes off on the holder, and three times loses', () => {
    let s = held(3);
    const loser = s.holder;
    // Step to the first bang: it goes off on whoever was left holding it.
    while (s.lives[0] + s.lives[1] === 2 * BOMB_LIVES) s = stepBomb(s, [none, none]).state;
    expect(s.lives[loser]).toBe(BOMB_LIVES - 1);
    // Nobody throws: it keeps going off on the same player.
    s = run(s, 120 * 40);
    expect(s.result).toEqual({ winners: [loser === 0 ? 1 : 0], draw: false });
  });

  it('fuses are four to eleven seconds and every button sits on the canvas', () => {
    for (let n = 0; n < 200; n++) {
      const f = fuseFor(9, n);
      expect(f >= 4 && f <= 11).toBe(true);
      for (const seat of [0, 1] as const) {
        const b = buttonFor(9, n, n % 7, seat);
        expect(b.x - BUTTON_R >= 0 && b.x + BUTTON_R <= BOMB_CANVAS.width).toBe(true);
        expect(b.y - BUTTON_R >= 0 && b.y + BUTTON_R <= BOMB_CANVAS.height).toBe(true);
      }
    }
  });

  it('the quicker bot wins', { timeout: 60_000 }, () => {
    let expert = 0;
    for (let seed = 0; seed < 20; seed++) {
      const rng = createRng(seed);
      const strong = seed % 2;
      let s = newBombPass(seed);
      let since = 0;
      let lastHolder = -1;
      let roll = 0.5;
      while (!s.result) {
        if (s.phase !== 'held' || s.holder !== lastHolder) {
          since = 0;
          lastHolder = s.phase === 'held' ? s.holder : -1;
          roll = rng.next();
        } else since += 1 / 120;
        const tiers = [strong === 0 ? BOMB_TIERS.expert : BOMB_TIERS.easy, strong === 1 ? BOMB_TIERS.expert : BOMB_TIERS.easy];
        const inputs: [BombInput, BombInput] = [bombBotInput(s, 0, tiers[0]!, since, roll), bombBotInput(s, 1, tiers[1]!, since, roll)];
        s = stepBomb(s, inputs).state;
      }
      if (s.result.winners[0] === strong) expert++;
    }
    expect(expert).toBeGreaterThanOrEqual(14);
  });
});

/** Invariant: lives only ever go down one at a time, and never below nothing. */
describe('bomb pass invariants', () => {
  it('counts lives honestly', () => {
    for (let seed = 0; seed < 10; seed++) {
      const rng = createRng(seed);
      let s = newBombPass(seed);
      for (let i = 0; i < 120 * 90 && !s.result; i++) {
        const before = s.lives;
        const tap = rng.next() < 0.02 ? { x: rng.next() * 600, y: rng.next() * 900 } : null;
        s = stepBomb(s, [{ tap }, { tap }]).state;
        const lost = before[0] - s.lives[0] + (before[1] - s.lives[1]);
        expect(lost === 0 || lost === 1).toBe(true);
        expect(Math.min(...s.lives)).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
