import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import type { BotTier, Seat } from '../../core/types';
import {
  hitQuality,
  isHittable,
  NET_Y,
  newPingPongGame,
  PING_PONG_TIERS,
  pingPongBotSwing,
  PP_STEP,
  serverFor,
  stepPingPong,
  swing,
  type BotNoise,
  type PingPongEvents,
  type PingPongState,
} from './index';

function run(state: PingPongState, seconds: number, until?: (s: PingPongState, e: PingPongEvents) => boolean) {
  let s = state;
  const events: PingPongEvents[] = [];
  for (let i = 0; i < seconds / PP_STEP; i++) {
    const step = stepPingPong(s);
    s = step.state;
    events.push(step.events);
    if (until?.(s, step.events)) break;
  }
  return { state: s, events };
}

/** Serve from seat 0 and step until the receiver may hit. */
function servedToReceiver(): PingPongState {
  const served = swing(newPingPongGame(), 0, { aim: 0, power: 0.5 });
  return run(served, 3, (s) => isHittable(s, 1)).state;
}

function playMatch(tiers: [BotTier, BotTier], seed: number): PingPongState {
  const rng = createRng(seed);
  const roll = (): BotNoise => [rng.next() * 2 - 1, rng.next() * 2 - 1, rng.next() * 2 - 1, rng.next() * 2 - 1];
  let noise: [BotNoise, BotNoise] = [roll(), roll()];
  let state = newPingPongGame();
  let lastHitter = state.lastHitter;
  for (let i = 0; i < 600 / PP_STEP && !state.result; i++) {
    for (const seat of [0, 1] as Seat[]) {
      const s = pingPongBotSwing(state, seat, PING_PONG_TIERS[tiers[seat]], noise[seat]);
      if (s) state = swing(state, seat, s);
    }
    state = stepPingPong(state).state;
    if (state.lastHitter !== lastHitter) {
      lastHitter = state.lastHitter;
      noise = [roll(), roll()];
    }
  }
  return state;
}

describe('table tennis rules', () => {
  it('waits for the server, and only the server can serve', () => {
    const start = newPingPongGame();
    expect(run(start, 1).state.ball).toEqual(start.ball);
    expect(swing(start, 1, { aim: 0, power: 0.5 })).toBe(start);
  });

  it('a serve bounces on the server side, then the receiver side, then the receiver may hit', () => {
    const served = swing(newPingPongGame(), 0, { aim: 0, power: 0.5 });
    const { state, events } = run(served, 3, (s) => isHittable(s, 1));
    expect(events.filter((e) => e.bounce)).toHaveLength(2);
    expect(state.ball.y).toBeLessThan(NET_Y);
    expect(isHittable(state, 1)).toBe(true);
    expect(isHittable(state, 0)).toBe(false);
  });

  it('gives the point to the server if the receiver lets it bounce twice', () => {
    const { state } = run(servedToReceiver(), 3, (s) => s.phase === 'point');
    expect(state.scores).toEqual([1, 0]);
    expect(state.lastPoint?.winner).toBe(0);
  });

  it('a clean return lands on the other side and makes the server the one to hit', () => {
    const ready = servedToReceiver();
    const returned = swing(ready, 1, { aim: 0, power: 0.5 });
    expect(returned.lastHitter).toBe(1);
    const { state } = run(returned, 3, (s) => isHittable(s, 0) || s.phase === 'point');
    expect(isHittable(state, 0)).toBe(true);
  });

  it('a mistimed full-power shot flies long and loses the point', () => {
    const ready = { ...servedToReceiver() };
    const low: PingPongState = { ...ready, ball: { ...ready.ball, z: 1, vz: -10 } };
    expect(hitQuality(1)).toBeLessThan(0.3);
    const { state } = run(swing(low, 1, { aim: 1, power: 1 }), 3, (s) => s.phase === 'point');
    expect(state.lastPoint?.winner).toBe(0);
  });

  it('swinging when the ball is not yours does nothing', () => {
    const ready = servedToReceiver();
    expect(swing(ready, 0, { aim: 0, power: 1 })).toBe(ready);
  });

  it('scores to 11, win by 2, with serve changing every 2 points and every point at deuce', () => {
    expect(serverFor([0, 0])).toBe(0);
    expect(serverFor([1, 0])).toBe(0);
    expect(serverFor([1, 1])).toBe(1);
    expect(serverFor([10, 10])).toBe(0);
    expect(serverFor([11, 10])).toBe(1);
    expect(serverFor([11, 11])).toBe(0);

    let state: PingPongState = { ...servedToReceiver(), scores: [10, 10] };
    state = run(state, 3, (s) => s.phase === 'point').state;
    expect(state.scores).toEqual([11, 10]);
    expect(state.result).toBeNull();
    state = run({ ...servedToReceiver(), scores: [11, 10] }, 3, (s) => s.phase === 'point').state;
    expect(state.result).toEqual({ winners: [0], draw: false });
  });
});

describe('table tennis bots', () => {
  it('play complete matches that end in a win by 2', () => {
    const state = playMatch(['medium', 'medium'], 1);
    expect(state.result).not.toBeNull();
    const [a, b] = state.scores;
    expect(Math.max(a, b)).toBeGreaterThanOrEqual(11);
    expect(Math.abs(a - b)).toBeGreaterThanOrEqual(2);
  });

  it('Nova (expert) beats Pip (easy) from either end', () => {
    expect(playMatch(['expert', 'easy'], 2).result?.winners).toEqual([0]);
    expect(playMatch(['easy', 'expert'], 3).result?.winners).toEqual([1]);
  });
});
