import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import type { BotTier } from '../../core/types';
import { AIM_LIMIT, aimMove, archery, ArcheryState, ENDS, ARROWS_PER_END, FACE_R, newArchery, RING_W, ringScore, type Wind } from './index';

/** A match where every arrow has the wind given. */
const calm = (players = 1, wind: Wind = { x: 0, y: 0 }, range: 'near' | 'mid' | 'far' = 'near') =>
  new ArcheryState(range, players, Array.from({ length: ENDS * ARROWS_PER_END * players }, () => wind), [], null);

describe('archery', () => {
  it('scores each ring by its number, a line takes the higher, and off the face is nothing', () => {
    expect(ringScore(0)).toBe(10);
    expect(ringScore(RING_W)).toBe(10);
    expect(ringScore(RING_W + 0.1)).toBe(9);
    expect(ringScore(RING_W * 5.5)).toBe(5);
    expect(ringScore(FACE_R)).toBe(1);
    expect(ringScore(FACE_R + 0.1)).toBe(0);
  });

  it('a shot in the middle is a 10 and an X', () => {
    const after = calm().apply(aimMove(0, 0));
    expect(after.hits[0]).toMatchObject({ score: 10, x10: true, at: { x: 0, y: 0 } });
    const inner = calm().apply(aimMove(40, 0));
    expect(inner.hits[0]).toMatchObject({ score: 10, x10: false });
  });

  it('the wind carries the arrow the way it blows, and further at longer range', () => {
    const near = calm(1, { x: 3, y: -1 }, 'near').apply(aimMove(0, 0)).hits[0]!.at;
    const far = calm(1, { x: 3, y: -1 }, 'far').apply(aimMove(0, 0)).hits[0]!.at;
    expect(near.x).toBeGreaterThan(0);
    expect(near.y).toBeLessThan(0);
    expect(far.x).toBeGreaterThan(near.x);
    // Aiming off by the drift lands in the middle.
    const state = calm(1, { x: 3, y: -1 }, 'mid');
    const d = state.drift();
    expect(state.apply(aimMove(-d.x, -d.y)).hits[0]!.score).toBe(10);
  });

  it('allows aims inside the square and nothing else', () => {
    const state = calm();
    expect(state.allows(aimMove(AIM_LIMIT, -AIM_LIMIT))).toBe(true);
    expect(state.allows(aimMove(AIM_LIMIT + 1, 0))).toBe(false);
    expect(state.allows('1.5,2')).toBe(false);
    expect(state.allows('middle')).toBe(false);
    for (const move of state.legalMoves(0)) expect(state.allows(move)).toBe(true);
    expect(() => state.apply(aimMove(0, AIM_LIMIT + 5))).toThrow();
  });

  it('players take turns an arrow at a time, and the match ends after its last end', () => {
    let state = calm(2);
    const seats: number[] = [];
    while (!state.result) {
      seats.push(state.currentSeat);
      state = state.apply(aimMove(0, 0));
    }
    expect(seats.slice(0, 4)).toEqual([0, 1, 0, 1]);
    expect(state.hits).toHaveLength(ENDS * ARROWS_PER_END * 2);
    expect(state.legalMoves(0)).toEqual([]);
    expect(state.allows(aimMove(0, 0))).toBe(false);
  });

  it('highest total wins, then most 10s, then most Xs, and a full tie is a draw', () => {
    const play = (aims: [number, number][]) => {
      let state = calm(2);
      for (const [x, y] of aims) state = state.apply(aimMove(x, y));
      return state;
    };
    const n = ENDS * ARROWS_PER_END;
    const both = (a: [number, number], b: [number, number]) => Array.from({ length: n }, () => [a, b]).flat() as [number, number][];
    expect(play(both([0, 0], [100, 0])).result).toEqual({ winners: [0], draw: false });
    expect(play(both([0, 0], [0, 0])).result).toEqual({ winners: [0, 1], draw: true });
    // Same totals and 10s, but one player's are all Xs.
    expect(play(both([50, 0], [0, 0])).result).toEqual({ winners: [1], draw: false });
  });

  it('deals the same winds from the same seed, never stronger than 6 m/s across', () => {
    const a = newArchery(9, 'far', 3);
    expect(a.winds).toEqual(newArchery(9, 'far', 3).winds);
    expect(a.winds).toHaveLength(ENDS * ARROWS_PER_END * 3);
    for (const w of a.winds) {
      expect(Math.abs(w.x)).toBeLessThanOrEqual(6);
      expect(Math.abs(w.y)).toBeLessThanOrEqual(2);
    }
  });

  it('replays a match from its log', () => {
    const rng = createRng(3);
    let state = archery.newGame({ players: 2, variant: 'mid' }, 44) as ArcheryState;
    const moves: string[] = [];
    while (!state.result) {
      const move = rng.pick(state.legalMoves(state.currentSeat));
      moves.push(move);
      state = state.apply(move);
    }
    const again = replay(archery, toMoveLog(archery, { players: 2, variant: 'mid' }, 44, moves)) as ArcheryState;
    expect(again.hits).toEqual(state.hits);
    expect(again.result).toEqual(state.result);
  });

  it('bots only shoot aims the rules allow, and Expert outscores Easy', () => {
    const score = (tier: BotTier) => {
      let total = 0;
      for (let seed = 1; seed <= 20; seed++) {
        const bot = archery.createBot(tier);
        const rng = createRng(seed);
        let state = newArchery(seed, 'far', 1);
        while (!state.result) {
          const move = bot.chooseMove(state, 0, rng);
          expect(state.allows(move)).toBe(true);
          state = state.apply(move);
        }
        total += state.total(0);
      }
      return total;
    };
    const easy = score('easy');
    const expert = score('expert');
    expect(expert).toBeGreaterThan(easy * 1.3);
  });
});

/** Invariant: every score is 0 to 10, a total is the sum of its arrows, and nobody gets two arrows ahead. */
describe('archery invariants', () => {
  it('keeps every score in range and the turns even', () => {
    for (const players of [1, 2, 4]) {
      for (let seed = 0; seed < 6; seed++) {
        const rng = createRng(seed);
        let state = newArchery(seed, 'far', players);
        while (!state.result) {
          state = state.apply(rng.pick(state.legalMoves(state.currentSeat)));
          const counts = Array.from({ length: players }, (_, p) => state.hits.filter((h) => h.player === p).length);
          expect(Math.max(...counts) - Math.min(...counts), `${players}p seed ${seed}`).toBeLessThanOrEqual(1);
          for (const hit of state.hits) {
            expect(hit.score).toBeGreaterThanOrEqual(0);
            expect(hit.score).toBeLessThanOrEqual(10);
          }
          for (let p = 0; p < players; p++) expect(state.total(p)).toBe(state.hits.filter((h) => h.player === p).reduce((s, h) => s + h.score, 0));
        }
      }
    }
  });
});
