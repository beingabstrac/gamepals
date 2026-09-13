import { describe, expect, it } from 'vitest';
import type { BotTier } from '../../core/types';
import {
  AIR_HOCKEY_TIERS,
  airHockeyBotTarget,
  MALLET_RADIUS,
  newAirHockeyGame,
  STEP,
  stepAirHockey,
  TABLE,
  WIN_SCORE,
  type AirHockeyState,
  type Body,
  type MalletInput,
  type StepEvents,
} from './index';

const idle: MalletInput = { target: null, maxSpeed: 0 };
const live = (patch: Partial<AirHockeyState>): AirHockeyState => ({ ...newAirHockeyGame(), freeze: 0, ...patch });
const puckAt = (x: number, y: number, vx = 0, vy = 0): Body => ({ x, y, vx, vy });

function run(
  start: AirHockeyState,
  inputs: (state: AirHockeyState) => [MalletInput, MalletInput],
  seconds: number,
): { state: AirHockeyState; events: StepEvents[] } {
  let state = start;
  const events: StepEvents[] = [];
  for (let i = 0; i < seconds / STEP && !state.result; i++) {
    const step = stepAirHockey(state, inputs(state));
    state = step.state;
    events.push(step.events);
  }
  return { state, events };
}

const botInput = (tier: BotTier, seat: 0 | 1) => (state: AirHockeyState): MalletInput => ({
  target: airHockeyBotTarget(state, seat, AIR_HOCKEY_TIERS[tier]),
  maxSpeed: AIR_HOCKEY_TIERS[tier].maxSpeed,
});

describe('air hockey physics', () => {
  it('holds the puck still while the serve is frozen', () => {
    const start = { ...newAirHockeyGame(), puck: puckAt(300, 450, 500, 500) };
    const { state } = run(start, () => [idle, idle], 0.5);
    expect(state.puck.x).toBe(300);
    expect(state.freeze).toBeGreaterThan(0);
  });

  it('bounces off the side rails', () => {
    const { state, events } = run(live({ puck: puckAt(40, 450, -800, 0) }), () => [idle, idle], 0.2);
    expect(state.puck.vx).toBeGreaterThan(0);
    expect(events.some((e) => e.wall)).toBe(true);
  });

  it('bounces off the end rail outside the goal mouth', () => {
    const { state, events } = run(live({ puck: puckAt(60, 60, 0, -800) }), () => [idle, idle], 0.2);
    expect(events.some((e) => e.goal !== null)).toBe(false);
    expect(state.puck.vy).toBeGreaterThan(0);
  });

  it('scores through the top goal for seat 0 and serves from the conceding half', () => {
    const { state, events } = run(live({ puck: puckAt(300, 60, 0, -900) }), () => [idle, idle], 0.3);
    expect(events.find((e) => e.goal !== null)?.goal).toBe(0);
    expect(state.scores).toEqual([1, 0]);
    expect(state.puck.y).toBeLessThan(TABLE.height / 2);
    expect(state.freeze).toBeGreaterThan(0);
  });

  it('keeps each mallet on its own half', () => {
    const reachForTop: MalletInput = { target: { x: 300, y: 0 }, maxSpeed: 3000 };
    const { state } = run(newAirHockeyGame(), () => [reachForTop, idle], 1);
    expect(state.mallets[0].y).toBeGreaterThanOrEqual(TABLE.height / 2 + MALLET_RADIUS);
  });

  it('sends the puck away when a moving mallet hits it', () => {
    const start = live({ puck: puckAt(300, 600), mallets: [puckAt(300, 720), puckAt(300, 110)] });
    const strike: MalletInput = { target: { x: 300, y: 480 }, maxSpeed: 2000 };
    const { state, events } = run(start, () => [strike, idle], 0.15);
    expect(events.some((e) => e.hit > 0)).toBe(true);
    expect(state.puck.vy).toBeLessThan(0);
  });

  it('ends the match at the winning score and then stops changing', () => {
    const { state } = run(live({ scores: [WIN_SCORE - 1, 3], puck: puckAt(300, 60, 0, -900) }), () => [idle, idle], 0.5);
    expect(state.result).toEqual({ winners: [0], draw: false });
    expect(stepAirHockey(state, [idle, idle]).state).toBe(state);
  });

  it('is deterministic', () => {
    const inputs = (s: AirHockeyState): [MalletInput, MalletInput] => [botInput('hard', 0)(s), botInput('medium', 1)(s)];
    expect(run(newAirHockeyGame(), inputs, 10).state).toEqual(run(newAirHockeyGame(), inputs, 10).state);
  });
});

describe('air hockey bots', () => {
  it('an expert scores against an empty goal', () => {
    const { state } = run(newAirHockeyGame(), (s) => [botInput('expert', 0)(s), idle], 30);
    expect(state.scores[0]).toBeGreaterThan(0);
  });

  it('an expert outscores an easy bot from either end', () => {
    const bottom = run(newAirHockeyGame(), (s) => [botInput('expert', 0)(s), botInput('easy', 1)(s)], 180).state;
    expect(bottom.scores[0]).toBeGreaterThan(bottom.scores[1]);
    const top = run(newAirHockeyGame(), (s) => [botInput('easy', 0)(s), botInput('expert', 1)(s)], 180).state;
    expect(top.scores[1]).toBeGreaterThan(top.scores[0]);
  });
});
