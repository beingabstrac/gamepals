import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { replay } from '../../core/replay';
import type { BotTier } from '../../core/types';
import { flickFootball, flickMove, flickRoll, FlickState, kickOff, newFlick, PITCH } from './index';

const ball = (bodies: readonly { x: number; y: number }[]) => bodies[bodies.length - 1]!;

describe('flick football', () => {
  it('a flicked man rolls and stops; one that misses the ball leaves it', () => {
    const r = flickRoll(kickOff(), 1, 180, 20);
    expect(r.end[1]!.x).toBeLessThan(kickOff()[1]!.x);
    expect(ball(r.end)).toEqual(ball(kickOff()));
    expect(r.touched).toBe(false);
  });

  it('a man flicked into the ball moves it', () => {
    const r = flickRoll(kickOff(), 0, 270, 70);
    expect(r.touched).toBe(true);
    expect(ball(r.end).y).toBeLessThan(PITCH.h / 2);
  });

  it('the ball through the top goal scores for seat 0, the bottom one for seat 1; men cannot go in', () => {
    const near = kickOff().map((b, i) => (i === 6 ? { x: PITCH.w / 2, y: 60 } : i === 0 ? { x: PITCH.w / 2, y: 110 } : b));
    const clear = near.map((b, i) => (i >= 3 && i < 6 ? { x: 40 + i * 10, y: 500 } : b));
    expect(flickRoll(clear, 0, 270, 70).goal).toBe(0);
    const low = kickOff().map((b, i) => (i === 6 ? { x: PITCH.w / 2, y: PITCH.h - 60 } : i === 3 ? { x: PITCH.w / 2, y: PITCH.h - 110 } : i < 3 ? { x: 40 + i * 10, y: 300 } : b));
    expect(flickRoll(low, 3, 90, 70).goal).toBe(1);
    const man = flickRoll(kickOff().map((b, i) => (i === 6 ? { x: 30, y: 400 } : b)), 0, 270, 100);
    expect(man.end[0]!.y).toBeGreaterThanOrEqual(26 - 0.001);
  });

  it('a goal resets the pitch and the side that let it in kicks off; turns alternate otherwise', () => {
    const s = newFlick().apply(flickMove(1, 180, 50));
    expect(s.currentSeat).toBe(1);
    const near = kickOff().map((b, i) => (i === 6 ? { x: PITCH.w / 2, y: 60 } : i === 0 ? { x: PITCH.w / 2, y: 110 } : i >= 3 && i < 6 ? { x: 40 + i * 10, y: 500 } : b));
    const scored = new FlickState(near, 0, [0, 0], [0, 0], null, null).apply(flickMove(0, 270, 70));
    expect(scored.goals).toEqual([1, 0]);
    expect(scored.currentSeat).toBe(1);
    expect(scored.bodies).toEqual(kickOff());
    expect(() => s.apply('m3a0p50')).toThrow();
    expect(() => s.apply('m0a0p0')).toThrow();
  });

  it('bot tiers line up: each beats the one below', { timeout: 120_000 }, () => {
    const tiers: BotTier[] = ['easy', 'medium', 'hard', 'expert'];
    for (let i = 0; i < 3; i++) {
      let wins = 0;
      let losses = 0;
      for (let g = 0; g < 10; g++) {
        const high = g % 2;
        const seats = high ? [tiers[i]!, tiers[i + 1]!] : [tiers[i + 1]!, tiers[i]!];
        const bots = seats.map((t) => flickFootball.createBot(t));
        const rng = createRng(20 + g);
        let s = flickFootball.newGame({ players: 2 }, 20 + g);
        while (!s.result) s = s.apply(bots[s.currentSeat]!.chooseMove(s, s.currentSeat, rng));
        if (s.result.draw) continue;
        if (s.result.winners[0] === high) wins++;
        else losses++;
      }
      expect(wins, `${tiers[i + 1]} over ${tiers[i]}: ${wins} to ${losses}`).toBeGreaterThan(losses);
    }
  });

  it('the referee replays a match', { timeout: 60_000 }, () => {
    let s = flickFootball.newGame({ players: 2 }, 3);
    const bot = flickFootball.createBot('easy');
    const rng = createRng(3);
    const moves: string[] = [];
    while (!s.result) {
      const m = bot.chooseMove(s, s.currentSeat, rng);
      moves.push(m);
      s = s.apply(m);
    }
    expect(replay(flickFootball, { gameId: 'flick-football', seed: 3, config: { players: 2 }, moves }).result).toEqual(s.result);
  });
});
