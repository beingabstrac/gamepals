import { describe, expect, it } from 'vitest';
import type { BotTier } from '../../core/types';
import {
  BALL_RADIUS,
  newPongGame,
  paddleY,
  PADDLE_HEIGHT,
  PONG_STEP,
  PONG_TABLE,
  PONG_TIERS,
  PONG_WIN_SCORE,
  pongBotTarget,
  predictLandingX,
  stepPong,
  type PaddleInput,
  type PongEvents,
  type PongState,
} from './index';

const idle: PaddleInput = { targetX: null, maxSpeed: 0 };
const live = (patch: Partial<PongState>): PongState => ({ ...newPongGame(), freeze: 0, ...patch });

function run(start: PongState, inputs: (s: PongState) => [PaddleInput, PaddleInput], seconds: number) {
  let state = start;
  const events: PongEvents[] = [];
  for (let i = 0; i < seconds / PONG_STEP && !state.result; i++) {
    const step = stepPong(state, inputs(state));
    state = step.state;
    events.push(step.events);
  }
  return { state, events };
}

const bot = (tier: BotTier, seat: 0 | 1) => (s: PongState): PaddleInput => ({
  targetX: pongBotTarget(s, seat, PONG_TIERS[tier]),
  maxSpeed: PONG_TIERS[tier].maxSpeed,
});

describe('ping pong physics', () => {
  it('holds a served ball still, then launches it toward the receiver', () => {
    const start = newPongGame();
    const frozen = run(start, () => [idle, idle], 0.4).state;
    expect(frozen.ball.y).toBe(PONG_TABLE.height / 2);
    const moving = run(start, () => [idle, idle], 1).state;
    expect(moving.ball.y).toBeGreaterThan(PONG_TABLE.height / 2);
  });

  it('bounces off the side walls', () => {
    const { state, events } = run(live({ ball: { x: 30, y: 450, vx: -600, vy: 0 } }), () => [idle, idle], 0.1);
    expect(state.ball.vx).toBeGreaterThan(0);
    expect(events.some((e) => e.wall)).toBe(true);
  });

  it('returns the ball off a paddle, faster, at an angle set by where it hits', () => {
    const y = paddleY(0) - PADDLE_HEIGHT / 2 - BALL_RADIUS - 20;
    const center = run(live({ ball: { x: 300, y, vx: 0, vy: 600 } }), () => [idle, idle], 0.1);
    expect(center.events.some((e) => e.hit)).toBe(true);
    expect(center.state.ball.vy).toBeLessThan(0);
    expect(Math.hypot(center.state.ball.vx, center.state.ball.vy)).toBeGreaterThan(600);
    expect(Math.abs(center.state.ball.vx)).toBeLessThan(1);

    const rightEdge = run(live({ ball: { x: 350, y, vx: 0, vy: 600 } }), () => [idle, idle], 0.1).state;
    expect(rightEdge.ball.vx).toBeGreaterThan(100);
  });

  it('scores a missed ball for the other side and serves to the player who missed', () => {
    const { state, events } = run(live({ ball: { x: 40, y: 880, vx: 0, vy: 800 } }), () => [idle, idle], 0.2);
    expect(events.find((e) => e.point !== null)?.point).toBe(1);
    expect(state.scores).toEqual([0, 1]);
    expect(state.freeze).toBeGreaterThan(0);
    expect(state.ball.vy).toBeGreaterThan(0);
  });

  it('ends at the winning score and then stops changing', () => {
    const { state } = run(live({ scores: [3, PONG_WIN_SCORE - 1], ball: { x: 40, y: 880, vx: 0, vy: 800 } }), () => [idle, idle], 0.2);
    expect(state.result).toEqual({ winners: [1], draw: false });
    expect(stepPong(state, [idle, idle]).state).toBe(state);
  });

  it('predicts where the ball lands, including wall bounces', () => {
    expect(predictLandingX({ x: 300, y: 450, vx: 0, vy: 500 }, 800)).toBeCloseTo(300);
    const bounced = predictLandingX({ x: 500, y: 450, vx: 800, vy: 400 }, 850);
    expect(bounced).toBeGreaterThanOrEqual(BALL_RADIUS);
    expect(bounced).toBeLessThanOrEqual(PONG_TABLE.width - BALL_RADIUS);
  });
});

describe('ping pong bots', () => {
  it('an expert scores against a paddle that never moves', () => {
    const { state } = run(newPongGame(), (s) => [bot('expert', 0)(s), idle], 60);
    expect(state.scores[0]).toBeGreaterThan(0);
  });

  it('an expert outscores an easy bot from either end', () => {
    const bottom = run(newPongGame(), (s) => [bot('expert', 0)(s), bot('easy', 1)(s)], 120).state;
    expect(bottom.scores[0]).toBeGreaterThan(bottom.scores[1]);
    const top = run(newPongGame(), (s) => [bot('easy', 0)(s), bot('expert', 1)(s)], 120).state;
    expect(top.scores[1]).toBeGreaterThan(top.scores[0]);
  });
});
