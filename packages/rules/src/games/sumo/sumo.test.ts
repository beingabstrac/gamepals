import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import type { BotTier } from '../../core/types';
import {
  isOut,
  newSumoGame,
  RING,
  stepSumo,
  SUMO_STEP,
  SUMO_TIERS,
  sumoBotInput,
  type SumoEvents,
  type SumoInput,
  type SumoState,
} from './index';

const idle: SumoInput = { steer: null, shove: false };
const live = (): SumoState => ({ ...newSumoGame(), phase: 'bout', timer: 0 });

function run(start: SumoState, inputs: (s: SumoState) => [SumoInput, SumoInput], seconds: number, until?: (s: SumoState, e: SumoEvents) => boolean) {
  let state = start;
  const events: SumoEvents[] = [];
  for (let i = 0; i < seconds / SUMO_STEP && !state.result; i++) {
    const step = stepSumo(state, inputs(state));
    state = step.state;
    events.push(step.events);
    if (until?.(state, step.events)) break;
  }
  return { state, events };
}

function match(tiers: [BotTier, BotTier], seed: number): SumoState {
  const rng = createRng(seed);
  let noise = [0, 0];
  let tick = 0;
  return run(newSumoGame(), (s) => {
    if (tick++ % 30 === 0) noise = [rng.next() * 2 - 1, rng.next() * 2 - 1];
    return [sumoBotInput(s, 0, SUMO_TIERS[tiers[0]], noise[0]), sumoBotInput(s, 1, SUMO_TIERS[tiers[1]], noise[1])];
  }, 300).state;
}

describe('sumo physics', () => {
  it('ignores input during the countdown', () => {
    const start = newSumoGame();
    const push: SumoInput = { steer: { x: 1, y: 0 }, shove: true };
    const { state } = run(start, () => [push, push], 0.5);
    expect(state.wrestlers).toEqual(start.wrestlers);
  });

  it('steering accelerates and drag slows you down again', () => {
    const moving = run(live(), () => [{ steer: { x: 1, y: 0 }, shove: false }, idle], 0.3).state;
    expect(moving.wrestlers[0].vx).toBeGreaterThan(100);
    const coasting = run(moving, () => [idle, idle], 0.5).state;
    expect(coasting.wrestlers[0].vx).toBeLessThan(moving.wrestlers[0].vx);
  });

  it('a shove is a burst with a cooldown', () => {
    const shove: SumoInput = { steer: { x: -1, y: 0 }, shove: true };
    const after = stepSumo(live(), [shove, idle]);
    expect(after.events.shove[0]).toBe(true);
    expect(after.state.wrestlers[0].vx).toBeLessThan(-500);
    expect(stepSumo(after.state, [shove, idle]).events.shove[0]).toBe(false);
  });

  it('a shove into the opponent pushes them away', () => {
    const shoveUp: SumoInput = { steer: { x: 0, y: -1 }, shove: true };
    const { events, state } = run(live(), (s) => [s.wrestlers[0].cooldown === 0 ? shoveUp : { steer: { x: 0, y: -1 }, shove: false }, idle], 0.4);
    expect(events.some((e) => e.clash > 0)).toBe(true);
    expect(state.wrestlers[1].vy).toBeLessThan(0);
  });

  it('pushing someone out of the ring wins the bout, best of 3 wins the match', () => {
    const pushUp = (s: SumoState): [SumoInput, SumoInput] => [{ steer: { x: 0, y: -1 }, shove: s.wrestlers[0].cooldown === 0 }, idle];
    const first = run(live(), pushUp, 10, (_s, e) => e.boutOver !== null).state;
    expect(first.bouts).toEqual([1, 0]);
    expect(isOut(first.wrestlers[1])).toBe(true);
    const done = run(first, pushUp, 30).state;
    expect(done.result).toEqual({ winners: [0], draw: false });
  });

  it('walking yourself out loses', () => {
    const { state } = run(live(), () => [{ steer: { x: 1, y: 0 }, shove: false }, idle], 5, (_s, e) => e.boutOver !== null);
    expect(state.bouts).toEqual([0, 1]);
    expect(isOut(state.wrestlers[0])).toBe(true);
    expect(state.wrestlers[0].x).toBeGreaterThan(RING.x);
  });
});

describe('sumo bots', () => {
  it('Nova (expert) beats Pip (easy) from either side', () => {
    expect(match(['expert', 'easy'], 1).result?.winners).toEqual([0]);
    expect(match(['easy', 'expert'], 2).result?.winners).toEqual([1]);
  });

  it('an expert pushes a wrestler who stands still out of the ring', () => {
    const { state } = run(live(), (s) => [sumoBotInput(s, 0, SUMO_TIERS.expert), idle], 20, (_s, e) => e.boutOver !== null);
    expect(state.bouts).toEqual([1, 0]);
  });
});
