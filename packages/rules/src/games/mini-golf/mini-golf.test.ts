import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import { GOLF_R, HOLES, inside, roll, type Hole } from './course';
import { GOLF_ROUNDS, GolfState, miniGolf, newGolf, STROKE_CAP, strokeMove } from './index';

/** A plain box of green with nothing on it, for strokes worked out by hand. */
const box = (extra: Partial<Hole> = {}): Hole => ({
  name: 'test',
  par: 2,
  green: [
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
    { x: 1000, y: 2000 },
    { x: 0, y: 2000 },
  ],
  blocks: [],
  slopes: [],
  sand: [],
  water: [],
  tee: { x: 500, y: 1800 },
  cup: { x: 500, y: 100 },
  ...extra,
});

describe('mini golf physics', () => {
  it('rolls straight on the flat and stops', () => {
    const out = roll(box(), { x: 500, y: 1800 }, 0, -0.8, false);
    expect(out.end).toBe('rest');
    expect(Math.abs(out.at.x - 500)).toBeLessThan(1e-6);
    expect(out.at.y).toBeLessThan(1800);
  });

  it('bounces off a wall at the angle it came in, a little slower', () => {
    const out = roll(box(), { x: 900, y: 1800 }, 1, -1, false);
    const wall = out.events.find((e) => e.kind === 'wall');
    expect(wall).toBeDefined();
    // Off the right wall it comes back leftwards and keeps going up.
    expect(out.at.x).toBeLessThan(1000 - GOLF_R);
    expect(out.at.y).toBeLessThan(1800);
  });

  it('a slope curves the ball, and sand stops it sooner', () => {
    const flat = roll(box(), { x: 500, y: 1800 }, 0, -1, false).at;
    const sloped = roll(box({ slopes: [{ area: box().green, ax: 0.0004, ay: 0 }] }), { x: 500, y: 1800 }, 0, -1, false).at;
    expect(sloped.x).toBeGreaterThan(flat.x + 20);
    const sandy = roll(box({ sand: [box().green] }), { x: 500, y: 1800 }, 0, -1, false).at;
    expect(1800 - sandy.y).toBeLessThan(1800 - flat.y);
  });

  it('a slow ball over the cup drops, and a fast one runs over it', () => {
    const cup = { x: 500, y: 1300 };
    const slow = roll(box({ cup }), { x: 500, y: 1800 }, 0, -1.05, false);
    expect(slow.end).toBe('cup');
    const fast = roll(box({ cup }), { x: 500, y: 1800 }, 0, -3.3, false);
    expect(fast.end).not.toBe('cup');
  });

  it('water ends the roll', () => {
    const water = [
      [
        { x: 0, y: 900 },
        { x: 1000, y: 900 },
        { x: 1000, y: 1100 },
        { x: 0, y: 1100 },
      ],
    ];
    expect(roll(box({ water }), { x: 500, y: 1800 }, 0, -2, false).end).toBe('water');
  });

  it('the same stroke always ends the same way', () => {
    const hole = HOLES[6]!;
    const a = roll(hole, hole.tee, 0.7, -2.1, false);
    const b = roll(hole, hole.tee, 0.7, -2.1, false);
    expect(a.at).toEqual(b.at);
  });

  it('every hole has its tee and cup on the green, clear of blocks and water', () => {
    HOLES.forEach((hole, i) => {
      for (const spot of [hole.tee, hole.cup]) {
        expect(inside(hole.green, spot.x, spot.y), `hole ${i + 1}`).toBe(true);
        for (const block of hole.blocks) expect(inside(block, spot.x, spot.y), `hole ${i + 1}`).toBe(false);
        for (const water of hole.water) expect(inside(water, spot.x, spot.y), `hole ${i + 1}`).toBe(false);
      }
      expect(hole.par).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('mini golf rules', () => {
  it('allows well-formed strokes only, and every stroke it lists', () => {
    const state = newGolf('short', 2);
    expect(state.allows(strokeMove(0, -1000, 50))).toBe(true);
    expect(state.allows(strokeMove(0, 0, 50))).toBe(false);
    expect(state.allows(strokeMove(0, -1000, 0))).toBe(false);
    expect(state.allows(strokeMove(0, -1000, 101))).toBe(false);
    expect(state.allows(strokeMove(50_000, 1, 50))).toBe(false);
    expect(state.allows('putt')).toBe(false);
    for (const move of state.legalMoves(0)) expect(state.allows(move)).toBe(true);
    expect(state.legalMoves(1)).toEqual([]);
  });

  it('water costs a stroke and puts the ball back where it was hit', () => {
    const bridge = GOLF_ROUNDS.short.indexOf(5);
    let state = newGolf('short', 1);
    // Play the first holes out with the bot to reach the bridge.
    const bot = miniGolf.createBot('expert');
    const rng = createRng(2);
    while (state.holeIndex < bridge) state = state.apply(bot.chooseMove(state, 0, rng)) as GolfState;
    const tee = state.ball;
    // Straight up the left side runs into the left pond.
    const wet = state.apply(strokeMove(-2000, -8000, 70));
    expect(wet.last?.penalty).toBe(true);
    expect(wet.ball).toEqual(tee);
    expect(wet.strokes).toBe(2);
  });

  it('picks up at the cap and scores one more', () => {
    let state = newGolf('short', 1);
    for (let i = 0; i < STROKE_CAP; i++) state = state.apply(strokeMove(0, 1000, 1));
    expect(state.cards[0]![0]).toBe(STROKE_CAP + 1);
    expect(state.holeIndex).toBe(1);
    expect(state.last?.pickedUp).toBe(true);
  });

  it('players play each hole in turn, and fewest strokes wins', () => {
    let state = newGolf('short', 2);
    const bot = miniGolf.createBot('expert');
    const rng = createRng(5);
    const order: number[] = [];
    while (!state.result) {
      if (order[order.length - 1] !== state.currentSeat) order.push(state.currentSeat);
      state = state.apply(bot.chooseMove(state, state.currentSeat, rng)) as GolfState;
    }
    expect(order.slice(0, 4)).toEqual([0, 1, 0, 1]);
    const totals = [state.total(0), state.total(1)];
    const best = Math.min(...totals);
    expect(state.result.winners).toEqual(totals.flatMap((t, i) => (t === best ? [i] : [])));
    expect(state.result.draw).toBe(totals[0] === totals[1]);
  });

  it('the expert bot holes every hole within par plus two', { timeout: 120_000 }, () => {
    for (let hole = 0; hole < HOLES.length; hole++) {
      const state0 = new GolfState('full', 1, hole, 0, HOLES[hole]!.tee, [GOLF_ROUNDS.full.map(() => 0)], 0, null, null);
      const bot = miniGolf.createBot('expert');
      const rng = createRng(hole + 1);
      let state: GolfState = state0;
      while (state.holeIndex === hole && !state.result) state = state.apply(bot.chooseMove(state, 0, rng)) as GolfState;
      expect(state.cards[0]![hole], `hole ${hole + 1} "${HOLES[hole]!.name}"`).toBeLessThanOrEqual(HOLES[hole]!.par + 2);
    }
  });

  it('replays a round from its log', () => {
    const rng = createRng(9);
    let state = miniGolf.newGame({ players: 2, variant: 'short' }, 1) as GolfState;
    const moves: string[] = [];
    while (!state.result && moves.length < 60) {
      const move = rng.pick(state.legalMoves(state.currentSeat));
      moves.push(move);
      state = state.apply(move);
    }
    const again = replay(miniGolf, toMoveLog(miniGolf, { players: 2, variant: 'short' }, 1, moves)) as GolfState;
    expect(again.cards).toEqual(state.cards);
    expect(again.ball).toEqual(state.ball);
  });
});

/** Invariant: the ball stays on the green, strokes on a hole never go down, and a total is its card's sum. */
describe('mini golf invariants', () => {
  it('keeps the ball on the green and the scores straight', { timeout: 120_000 }, () => {
    for (let seed = 0; seed < 4; seed++) {
      const rng = createRng(seed + 30);
      let state = newGolf('full', 2);
      for (let n = 0; n < 200 && !state.result; n++) {
        const before = state;
        state = state.apply(rng.pick(state.legalMoves(state.currentSeat)));
        const where = `seed ${seed} stroke ${n}`;
        const hole = state.hole;
        expect(inside(hole.green, state.ball.x, state.ball.y), `${where}: ball at ${state.ball.x.toFixed(1)},${state.ball.y.toFixed(1)}`).toBe(true);
        if (state.holeIndex === before.holeIndex && state.currentSeat === before.currentSeat) expect(state.strokes, where).toBeGreaterThan(before.strokes);
        for (let p = 0; p < 2; p++) expect(state.total(p)).toBe(state.cards[p]!.reduce((a, b) => a + b, 0));
      }
    }
  });
});

