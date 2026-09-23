import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import type { BotTier } from '../../core/types';
import {
  PAINT_COLS,
  countOf,
  newPaint,
  PAINT_CANVAS,
  PAINT_SECONDS,
  PAINT_STEP,
  PAINT_TIERS,
  paintBotInput,
  ROLLER_R,
  PAINT_ROWS,
  stepPaint,
  PAINT_TILE,
  tileAt,
  type PaintInput,
  type PaintState,
} from './index';

const straight: PaintInput = { steer: null };
const going = (seed = 1): PaintState => ({ ...newPaint(seed), phase: 'round', clock: 0 });
const run = (state: PaintState, seconds: number, inputs: [PaintInput, PaintInput] = [straight, straight]) => {
  let s = state;
  for (let t = 0; t < seconds; t += PAINT_STEP) s = stepPaint(s, inputs).state;
  return s;
};

describe('paint fight', () => {
  it('a roller paints the tile under it, over the other colour too', () => {
    const start = going();
    const s = stepPaint(start, [straight, straight]).state;
    expect(s.floor[tileAt(s.rollers[0].x, s.rollers[0].y)]).toBe(0);
    expect(s.floor[tileAt(s.rollers[1].x, s.rollers[1].y)]).toBe(1);
    // Paint a tile blue, then drive red over it.
    const tile = tileAt(300, 450);
    const painted = { ...start, floor: start.floor.map((o, i) => (i === tile ? 0 : o)), rollers: [start.rollers[0], { x: 300, y: 450, dx: 0, dy: 1 }] as PaintState['rollers'] };
    expect(stepPaint(painted, [straight, straight]).state.floor[tile]).toBe(1);
  });

  it('a pot splats the tiles round it and is gone', () => {
    const start = going();
    const pot = { col: 6, row: 9, at: 0 };
    const s0: PaintState = { ...start, pots: [pot], taken: [false], rollers: [{ x: 6 * PAINT_TILE + 25, y: 9 * PAINT_TILE + 25, dx: 0, dy: -1 }, start.rollers[1]] };
    const { state, events } = stepPaint(s0, [straight, straight]);
    expect(events.splat).toEqual({ seat: 0, col: 6, row: 9 });
    expect(state.taken).toEqual([true]);
    expect(countOf(state, 0)).toBeGreaterThan(9);
    // Rolling back over the spot does not splat again.
    expect(stepPaint(state, [straight, straight]).events.splat).toBeNull();
  });

  it('rollers stay on the floor and never pass through each other', () => {
    const s = run(going(), 6, [{ steer: { x: 1, y: 0 } }, { steer: { x: -1, y: 0.2 } }]);
    for (const r of s.rollers) {
      expect(r.x).toBeGreaterThanOrEqual(ROLLER_R);
      expect(r.x).toBeLessThanOrEqual(PAINT_CANVAS.width - ROLLER_R);
    }
    const head: PaintState = { ...going(), rollers: [{ x: 300, y: 470, dx: 0, dy: -1 }, { x: 300, y: 430, dx: 0, dy: 1 }] };
    const bumped = stepPaint(head, [straight, straight]);
    expect(bumped.events.bump).toBe(true);
    expect(Math.hypot(bumped.state.rollers[0].x - bumped.state.rollers[1].x, bumped.state.rollers[0].y - bumped.state.rollers[1].y)).toBeGreaterThanOrEqual(ROLLER_R * 2 - 1e-9);
  });

  it('ends at sixty seconds with the most tiles winning, or a draw', () => {
    const s = run(going(), PAINT_SECONDS + 0.1);
    expect(s.phase).toBe('over');
    const a = countOf(s, 0);
    const b = countOf(s, 1);
    expect(s.result).toEqual(a === b ? { winners: [0, 1], draw: true } : { winners: [a > b ? 0 : 1], draw: false });
  });

  it('the same inputs always give the same round', () => {
    const inputs: [PaintInput, PaintInput] = [{ steer: { x: 0.3, y: -1 } }, { steer: { x: -0.5, y: 0.4 } }];
    expect(run(going(3), 8, inputs)).toEqual(run(going(3), 8, inputs));
  });

  it('Expert beats Easy in most rounds', { timeout: 60_000 }, () => {
    const round = (tiers: [BotTier, BotTier], seed: number) => {
      const rng = createRng(seed);
      let s = going(seed);
      let noise: [number, number] = [0, 0];
      for (let step = 0; !s.result; step++) {
        if (step % 30 === 0) noise = [rng.next() * 2 - 1, rng.next() * 2 - 1];
        s = stepPaint(s, [paintBotInput(s, 0, PAINT_TIERS[tiers[0]], noise[0]), paintBotInput(s, 1, PAINT_TIERS[tiers[1]], noise[1])]).state;
      }
      return s.result;
    };
    let expert = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const seat = seed % 2;
      const result = round(seat === 0 ? ['expert', 'easy'] : ['easy', 'expert'], seed);
      if (result?.winners.length === 1 && result.winners[0] === seat) expert++;
    }
    expect(expert).toBeGreaterThanOrEqual(7);
  });
});

/** Invariant: every tile is one colour or bare, the counts add up to the floor, and the clock only runs forward. */
describe('paint fight invariants', () => {
  it('keeps the floor adding up and the clock moving on', { timeout: 60_000 }, () => {
    for (let seed = 0; seed < 4; seed++) {
      const rng = createRng(seed);
      let s = newPaint(seed);
      let inputs: [PaintInput, PaintInput] = [straight, straight];
      for (let step = 0; !s.result; step++) {
        if (step % 20 === 0) inputs = [{ steer: { x: rng.next() * 2 - 1, y: rng.next() * 2 - 1 } }, { steer: { x: rng.next() * 2 - 1, y: rng.next() * 2 - 1 } }];
        const before = s;
        s = stepPaint(s, inputs).state;
        const bare = s.floor.filter((o) => o === -1).length;
        expect(countOf(s, 0) + countOf(s, 1) + bare, `seed ${seed} step ${step}`).toBe(PAINT_COLS * PAINT_ROWS);
        expect(s.floor.every((o) => o === -1 || o === 0 || o === 1)).toBe(true);
        if (before.phase === 'round' && s.phase === 'round') expect(s.clock).toBeGreaterThan(before.clock);
      }
    }
  });
});
