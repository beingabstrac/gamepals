import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import type { BotTier } from '../../core/types';
import { BALL_R, simulate, TABLE_H, TABLE_W, type TablePoint } from './physics';
import { encodeShot, HEAD_STRING, newPool, parseShot, pool, POCKETS, PoolState, type InHand, type PoolShot } from './index';

/** A table with only the balls given (ball number to position), for shots worked out by hand. */
function tableOf(spots: Record<number, TablePoint>, options: { solids?: number | null; seat?: number; inHand?: InHand; broken?: boolean } = {}): PoolState {
  const balls: (TablePoint | null)[] = Array.from({ length: 16 }, (_, i) => spots[i] ?? null);
  return new PoolState(balls, options.solids ?? null, options.seat ?? 0, options.inHand ?? 'none', options.broken ?? true, null, null);
}

const shot = (dx: number, dy: number, power: number, extra: Partial<PoolShot> = {}): string => encodeShot({ dx, dy, power, place: null, call: null, ...extra });

/** Straight up the table from the cue ball through the object ball into the top-left corner. */
const cornerShot = () => {
  const pocket = POCKETS[0]!;
  const ball = { x: 300, y: 300 };
  const d = Math.sqrt((ball.x - pocket.x) ** 2 + (ball.y - pocket.y) ** 2);
  const ux = (ball.x - pocket.x) / d;
  const uy = (ball.y - pocket.y) / d;
  const cue = { x: Math.round(ball.x + ux * 500), y: Math.round(ball.y + uy * 500) };
  return { ball, cue, dx: Math.round((ball.x - cue.x) * 100), dy: Math.round((ball.y - cue.y) * 100) };
};

describe('pool physics', () => {
  it('racks fifteen with the 8 in the middle and a solid and a stripe in the back corners', () => {
    for (let seed = 0; seed < 20; seed++) {
      const state = newPool(seed);
      expect(state.balls.filter(Boolean)).toHaveLength(16);
      const rows = state.balls.slice(1).map((b, i) => ({ ball: i + 1, y: b!.y, x: b!.x }));
      const apex = Math.max(...rows.map((r) => r.y));
      const back = Math.min(...rows.map((r) => r.y));
      const middleRow = rows.filter((r) => Math.abs(r.y - (apex - (apex - back) / 2)) < 1);
      const middle = middleRow.sort((a, b) => a.x - b.x)[1]!;
      expect(middle.ball, `seed ${seed}`).toBe(8);
      const corners = rows.filter((r) => Math.abs(r.y - back) < 1).sort((a, b) => a.x - b.x);
      const kinds = [corners[0]!.ball, corners[corners.length - 1]!.ball].map((b) => (b < 8 ? 'solid' : 'stripe')).sort();
      expect(kinds, `seed ${seed}`).toEqual(['solid', 'stripe']);
      expect(state.inHand).toBe('kitchen');
    }
  });

  it('the same shot on the same table always ends the same way', () => {
    const start = newPool(3).balls;
    const a = simulate(start, 0.3, -8.8, false);
    const b = simulate(start, 0.3, -8.8, false);
    expect(a.balls).toEqual(b.balls);
    expect(a.events.length).toBe(b.events.length);
  });

  it('a straight shot sends the ball into the pocket', () => {
    const { ball, cue } = cornerShot();
    const d = Math.sqrt((ball.x - cue.x) ** 2 + (ball.y - cue.y) ** 2);
    const out = simulate([cue, ball], ((ball.x - cue.x) / d) * 2.5, ((ball.y - cue.y) / d) * 2.5, false);
    expect(out.balls[1]).toBeNull();
    expect(out.events.some((e) => e.kind === 'pocket' && e.ball === 1 && e.pocket === 0)).toBe(true);
  });

  it('balls never end up inside each other or outside the cushions', () => {
    for (let seed = 0; seed < 12; seed++) {
      const rng = createRng(seed);
      const out = simulate(newPool(seed).balls, (rng.next() - 0.5) * 3, -6 - rng.next() * 3, false);
      const on = out.balls.flatMap((b) => (b ? [b] : []));
      for (const b of on) {
        expect(b.x).toBeGreaterThanOrEqual(BALL_R - 1e-9);
        expect(b.x).toBeLessThanOrEqual(TABLE_W - BALL_R + 1e-9);
        expect(b.y).toBeGreaterThanOrEqual(BALL_R - 1e-9);
        expect(b.y).toBeLessThanOrEqual(TABLE_H - BALL_R + 1e-9);
      }
      for (let i = 0; i < on.length; i++) {
        for (let j = i + 1; j < on.length; j++) {
          const d = Math.sqrt((on[i]!.x - on[j]!.x) ** 2 + (on[i]!.y - on[j]!.y) ** 2);
          expect(d, `seed ${seed} balls ${i} and ${j}`).toBeGreaterThan(2 * BALL_R - 0.5);
        }
      }
    }
  });

  it('a harder hit sends a lone ball further', () => {
    const soft = simulate([{ x: 635, y: 2000 }], 0, -1, false).balls[0]!;
    const hard = simulate([{ x: 635, y: 2000 }], 0, -1.6, false).balls[0]!;
    expect(2000 - hard.y).toBeGreaterThan(2000 - soft.y);
  });
});

describe('pool rules', () => {
  it('allows a shot exactly when it is well formed and fits the table', () => {
    const state = newPool(1);
    const place = state.defaultSpot()!;
    expect(state.allows(shot(0, -1000, 90, { place }))).toBe(true);
    expect(state.allows(shot(0, -1000, 90))).toBe(false);
    expect(state.allows(shot(0, 0, 90, { place }))).toBe(false);
    expect(state.allows(shot(0, -1000, 0, { place }))).toBe(false);
    expect(state.allows(shot(0, -1000, 101, { place }))).toBe(false);
    expect(state.allows(shot(0, -1000, 50, { place: { x: 635, y: HEAD_STRING - 100 } }))).toBe(false);
    expect(state.allows(shot(0, -1000, 50, { place, call: 2 }))).toBe(false);
    expect(state.allows('nonsense')).toBe(false);
    expect(state.allows(shot(50_000, 1, 50, { place }))).toBe(false);
    for (const move of state.legalMoves(0)) expect(state.allows(move), move).toBe(true);
    expect(state.legalMoves(1)).toEqual([]);
  });

  it('a scratch gives the other player ball in hand', () => {
    // The cue ball runs straight into the bottom-left corner.
    const state = tableOf({ 0: { x: 200, y: 2340 }, 1: { x: 900, y: 500 } }, { solids: 0 });
    const after = state.apply(shot(-100, 100, 40));
    expect(after.last?.foul).toBe('scratch');
    expect(after.balls[0]).toBeNull();
    expect(after.currentSeat).toBe(1);
    expect(after.inHand).toBe('anywhere');
  });

  it('hitting the wrong group first is a foul', () => {
    const state = tableOf({ 0: { x: 635, y: 1800 }, 9: { x: 635, y: 1200 }, 1: { x: 200, y: 400 } }, { solids: 0 });
    const after = state.apply(shot(0, -1000, 40));
    expect(after.last?.firstHit).toBe(9);
    expect(after.last?.foul).toBe('wrong-ball');
    expect(after.inHand).toBe('anywhere');
  });

  it('nothing reaching a cushion after contact is a foul', () => {
    const state = tableOf({ 0: { x: 635, y: 1300 }, 1: { x: 635, y: 1200 } }, { solids: 0 });
    const after = state.apply(shot(0, -1000, 3));
    expect(after.last?.firstHit).toBe(1);
    expect(after.last?.foul).toBe('no-rail');
  });

  it('the first ball legally pocketed after the break picks the groups, and keeps the turn', () => {
    const { ball, cue, dx, dy } = cornerShot();
    const state = tableOf({ 0: cue, 12: ball, 3: { x: 1000, y: 2000 } });
    const after = state.apply(shot(dx, dy, 30));
    expect(after.last?.pocketed).toEqual([12]);
    expect(after.groupOf(0)).toBe('stripes');
    expect(after.groupOf(1)).toBe('solids');
    expect(after.currentSeat).toBe(0);
    expect(after.last?.kept).toBe(true);
  });

  it('the 8 in the called pocket after your group wins; early or in the wrong pocket loses', () => {
    const { ball, cue, dx, dy } = cornerShot();
    const onEight = tableOf({ 0: cue, 8: ball, 9: { x: 1000, y: 2000 } }, { solids: 0 });
    expect(onEight.onEight(0)).toBe(true);
    expect(onEight.allows(shot(dx, dy, 30))).toBe(false);
    expect(onEight.apply(shot(dx, dy, 30, { call: 0 })).result).toEqual({ winners: [0], draw: false });
    expect(onEight.apply(shot(dx, dy, 30, { call: 5 })).result).toEqual({ winners: [1], draw: false });
    const early = tableOf({ 0: cue, 8: ball, 2: { x: 1000, y: 2000 } }, { solids: 0 });
    expect(early.apply(shot(dx, dy, 30)).result).toEqual({ winners: [1], draw: false });
  });

  it('the 8 going down on the break is put back on the foot spot, and the game goes on', () => {
    const { ball, cue, dx, dy } = cornerShot();
    const breaking = tableOf({ 0: cue, 8: ball, 5: { x: 1000, y: 2000 } }, { broken: false });
    const after = breaking.apply(shot(dx, dy, 30));
    expect(after.last?.pocketed).toEqual([8]);
    expect(after.last?.respotted).toBe(true);
    expect(after.balls[8]).toEqual({ x: TABLE_W / 2, y: TABLE_H * 0.25 });
    expect(after.result).toBeNull();
    // Nothing else went down, so the break passes the turn.
    expect(after.currentSeat).toBe(1);
  });

  it('replays a game from its log', { timeout: 120_000 }, () => {
    const rng = createRng(4);
    let state = newPool(11);
    const moves: string[] = [];
    for (let n = 0; n < 40 && !state.result; n++) {
      const move = rng.pick(state.legalMoves(state.currentSeat));
      moves.push(move);
      state = state.apply(move);
    }
    const again = replay(pool, toMoveLog(pool, { players: 2 }, 11, moves)) as PoolState;
    expect(again.balls).toEqual(state.balls);
    expect(again.currentSeat).toBe(state.currentSeat);
    const shotParsed = parseShot(moves[0]!)!;
    expect(encodeShot(shotParsed)).toBe(moves[0]);
  });

  it('bots only play shots the table accepts, and Expert beats Easy', { timeout: 300_000 }, () => {
    const play = (a: BotTier, b: BotTier, seed: number) => {
      const bots = [pool.createBot(a), pool.createBot(b)];
      const rng = createRng(seed);
      let state = newPool(seed);
      for (let n = 0; n < 150 && !state.result; n++) {
        const move = bots[state.currentSeat]!.chooseMove(state, state.currentSeat, rng);
        expect(state.allows(move), move).toBe(true);
        state = state.apply(move);
      }
      return state.result;
    };
    let expert = 0;
    let finished = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const expertSeat = seed % 2;
      const result = expertSeat === 0 ? play('expert', 'easy', seed) : play('easy', 'expert', seed);
      if (result) finished++;
      if (result?.winners.includes(expertSeat)) expert++;
    }
    expect(finished).toBeGreaterThanOrEqual(7);
    expect(expert).toBeGreaterThanOrEqual(6);
  });
});

/**
 * Invariant: sixteen balls, each on the table or down, never two on the table overlapping, never one
 * outside the cushions, and a cue ball that is down always means ball in hand.
 */
describe('pool invariants', () => {
  it('keeps every ball accounted for and on the cloth', { timeout: 120_000 }, () => {
    for (let seed = 0; seed < 6; seed++) {
      const rng = createRng(seed + 20);
      let state = newPool(seed);
      for (let n = 0; n < 60 && !state.result; n++) {
        state = state.apply(rng.pick(state.legalMoves(state.currentSeat)));
        const where = `seed ${seed} shot ${n}`;
        expect(state.balls, where).toHaveLength(16);
        if (!state.result && state.balls[0] === null) expect(state.inHand, where).not.toBe('none');
        const on = state.balls.flatMap((b, i) => (b ? [{ ...b, i }] : []));
        for (const b of on) {
          const inside = b.x >= BALL_R - 1e-9 && b.x <= TABLE_W - BALL_R + 1e-9 && b.y >= BALL_R - 1e-9 && b.y <= TABLE_H - BALL_R + 1e-9;
          expect(inside, `${where}: ball ${b.i} at ${b.x.toFixed(1)},${b.y.toFixed(1)}`).toBe(true);
        }
        for (let i = 0; i < on.length; i++) {
          for (let j = i + 1; j < on.length; j++) {
            const d = Math.sqrt((on[i]!.x - on[j]!.x) ** 2 + (on[i]!.y - on[j]!.y) ** 2);
            expect(d, `${where}: balls ${on[i]!.i} and ${on[j]!.i}`).toBeGreaterThan(2 * BALL_R - 0.5);
          }
        }
      }
    }
  });
});
