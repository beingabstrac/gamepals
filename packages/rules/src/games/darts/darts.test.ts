import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { replay } from '../../core/replay';
import type { BotTier } from '../../core/types';
import { dartAim, dartCheckout, dartMove, dartScore, darts, DartsState, newDarts } from './index';

const at = (base: number, mult: 1 | 2 | 3) => {
  const p = dartAim({ base, mult });
  return dartMove(p.x, p.y);
};

describe('darts', () => {
  it('scores the board the way it is drawn', () => {
    expect(dartScore(0, 0).points).toBe(50);
    expect(dartScore(0, -10).points).toBe(25);
    expect(dartScore(0, -103)).toEqual({ base: 20, mult: 3, points: 60 });
    expect(dartScore(0, -166)).toEqual({ base: 20, mult: 2, points: 40 });
    expect(dartScore(0, -175).points).toBe(0);
    expect(dartScore(0, 103).base).toBe(3);
    expect(dartScore(103, 0).base).toBe(6);
    expect(dartScore(-103, 0).base).toBe(11);
    for (const base of [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5])
      for (const mult of [1, 2, 3] as const) {
        const p = dartAim({ base, mult });
        expect(dartScore(p.x, p.y)).toEqual({ base, mult, points: base * mult });
      }
  });

  it('every score to 170 has a checkout except the seven that cannot be done', () => {
    const none = [169, 168, 166, 165, 163, 162, 159];
    for (let s = 2; s <= 170; s++) {
      const route = dartCheckout(s, 3);
      if (none.includes(s)) expect(route, `${s}`).toBeNull();
      else {
        expect(route, `${s}`).not.toBeNull();
        expect(route!.reduce((n, t) => n + t.base * t.mult, 0)).toBe(s);
        expect(route![route!.length - 1]!.mult).toBe(2);
      }
    }
    expect(dartCheckout(40, 1)).toEqual([{ base: 20, mult: 2 }]);
    expect(dartCheckout(41, 1)).toBeNull();
  });

  it('three darts a turn, then the next player', () => {
    let s = newDarts(2, '501');
    for (let k = 0; k < 3; k++) s = s.apply(at(20, 3));
    expect(s.scores).toEqual([321, 501]);
    expect(s.currentSeat).toBe(1);
    expect(s.last?.turnEnd).toBe(true);
  });

  it('below zero, one left and zero on a single are busts back to the start of the turn', () => {
    const on = (score: number) => new DartsState(301, [score, 301], 0, score, 0, [0, 0], [], null);
    const b1 = on(50).apply(at(20, 1)).apply(at(20, 3));
    expect(b1.scores[0]).toBe(50);
    expect(b1.currentSeat).toBe(1);
    expect(b1.last?.bust).toBe(true);
    expect(on(21).apply(at(20, 1)).scores[0]).toBe(21);
    expect(on(20).apply(at(20, 1)).scores[0]).toBe(20);
  });

  it('a double to zero wins at once, the bull counts as a double', () => {
    const on = (score: number) => new DartsState(301, [score, 301], 0, score, 0, [0, 0], [], null);
    expect(on(40).apply(at(20, 2)).result?.winners).toEqual([0]);
    expect(on(50).apply(dartMove(0, 0)).result?.winners).toEqual([0]);
    expect(() => on(40).apply(at(20, 2)).apply(at(20, 1))).toThrow();
    expect(() => on(40).apply('400,0')).toThrow();
  });

  it('bot tiers line up: each beats the one below over many legs', { timeout: 120_000 }, () => {
    const tiers: BotTier[] = ['easy', 'medium', 'hard', 'expert'];
    for (let i = 0; i < 3; i++) {
      const [low, high] = [tiers[i]!, tiers[i + 1]!];
      let wins = 0;
      const legs = 200;
      for (let g = 0; g < legs; g++) {
        const seats = g % 2 === 0 ? [high, low] : [low, high];
        const bots = seats.map((t) => darts.createBot(t));
        const rng = createRng(1000 + g);
        let s = newDarts(2, '301');
        while (!s.result) s = s.apply(bots[s.currentSeat]!.chooseMove(s, s.currentSeat, rng));
        if (seats[s.result.winners[0]!] === high) wins++;
      }
      expect(wins / legs, `${high} over ${low}`).toBeGreaterThan(0.7);
    }
  });

  it('solo test play finishes 301 and the referee replays it', () => {
    let s = darts.newGame({ players: 1, variant: '301' }, 4);
    const bot = darts.createBot('medium');
    const rng = createRng(4);
    const moves: string[] = [];
    while (!s.result && moves.length < 400) {
      const m = bot.chooseMove(s, 0, rng);
      moves.push(m);
      s = s.apply(m);
    }
    expect(s.result?.winners).toEqual([0]);
    expect(replay(darts, { gameId: 'darts', seed: 4, config: { players: 1, variant: '301' }, moves }).result).toEqual(s.result);
  });
});
