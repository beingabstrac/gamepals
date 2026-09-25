import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import type { BotTier } from '../../core/types';
import {
  ARENA,
  balloonOf,
  wallsIn,
  BUMPER_STEP,
  BUMPER_TIERS,
  bumperBotInput,
  CAR_R,
  newBumpers,
  POPS_TO_WIN,
  stepBumpers,
  type BumperEvents,
  type BumperInput,
  type BumperState,
} from './index';

const idle: BumperInput = { steer: null, dash: false };
const live = (): BumperState => ({ ...newBumpers(), phase: 'play', timer: 0 });

function run(start: BumperState, inputs: (s: BumperState) => [BumperInput, BumperInput], seconds: number, until?: (s: BumperState, e: BumperEvents) => boolean) {
  let state = start;
  for (let i = 0; i < seconds / BUMPER_STEP && !state.result; i++) {
    const step = stepBumpers(state, inputs(state));
    state = step.state;
    if (until?.(state, step.events)) break;
  }
  return state;
}

/** A whole match between two tiers, each seeing the other as it was its reaction time ago. */
function bumperMatch(tiers: [BotTier, BotTier], seed: number): BumperState {
  const rng = createRng(seed);
  let noise = [0, 0];
  let tick = 0;
  const history: BumperState[] = [];
  return run(newBumpers(), (s) => {
    history.push(s);
    if (history.length > 60) history.shift();
    if (tick++ % 40 === 0) noise = [rng.next() * 2 - 1, rng.next() * 2 - 1];
    return [0, 1].map((seat) => {
      const tier = BUMPER_TIERS[tiers[seat]!];
      const back = Math.min(history.length - 1, Math.round(tier.reactionMs / 1000 / BUMPER_STEP));
      const seen = history[history.length - 1 - back]!;
      const view: BumperState = { ...s, cars: seat === 0 ? [s.cars[0], seen.cars[1]] : [seen.cars[0], s.cars[1]] };
      return bumperBotInput(view, seat as 0 | 1, tier, noise[seat]!);
    }) as [BumperInput, BumperInput];
  }, 400);
}

describe('balloon bumpers', () => {
  it('nothing moves in the countdown', () => {
    const s = run(newBumpers(), () => [{ steer: { x: 1, y: 0 }, dash: true }, idle], 0.5);
    expect(s.cars[0].y).toBe(newBumpers().cars[0].y);
    expect(s.cars[0].x).toBe(newBumpers().cars[0].x);
  });

  it('a car turns to face the way it goes, its balloon behind it', () => {
    const s = run(live(), () => [{ steer: { x: 1, y: 0 }, dash: false }, idle], 0.6);
    expect(Math.abs(s.cars[0].heading)).toBeLessThan(0.2);
    expect(balloonOf(s.cars[0]).x).toBeLessThan(s.cars[0].x);
  });

  it('the walls close in once a round has gone on a while', () => {
    expect(wallsIn(15)).toBe(0);
    expect(wallsIn(40)).toBeGreaterThan(100);
    // Late in a round a car cannot get back to where the wall was.
    const late = { ...live(), timer: 60 };
    const s = run(late, () => [{ steer: { x: -1, y: 0 }, dash: false }, idle], 2);
    expect(s.cars[0].x).toBeGreaterThanOrEqual(ARENA.left + wallsIn(60) + CAR_R - 0.001);
  });

  it('walls bounce a car back in', () => {
    const s = run(live(), () => [{ steer: { x: -1, y: 0 }, dash: true }, idle], 3);
    expect(s.cars[0].x).toBeGreaterThanOrEqual(ARENA.left + CAR_R - 0.001);
  });

  it('driving hard into the balloon pops it; a gentle touch does not', () => {
    // Seat 1 parked facing up (balloon below it), seat 0 right below, driving up into the balloon.
    const base = live();
    const parked = { ...base.cars[1], x: 300, y: 400, heading: -Math.PI / 2, vx: 0, vy: 0 };
    const hard = { ...base, cars: [{ ...base.cars[0], x: 300, y: 560, heading: -Math.PI / 2, vx: 0, vy: -300 }, parked] as const };
    let popped: number | null = null;
    run(hard, () => [{ steer: { x: 0, y: -1 }, dash: false }, idle], 2, (_s, e) => ((popped = e.pop), e.pop !== null));
    expect(popped).toBe(0);
    // Coming at it slowly from the side, only just touching, is not enough.
    const soft = { ...base, cars: [{ ...base.cars[0], x: 300 - 54, y: 456, heading: 0, vx: 20, vy: 0 }, { ...parked, vx: 0, vy: 0 }] as const };
    const one = stepBumpers(soft, [idle, idle]);
    expect(one.events.pop).toBeNull();
  });

  it('bot tiers line up: each beats the one below', { timeout: 120_000 }, () => {
    const tiers: BotTier[] = ['easy', 'medium', 'hard', 'expert'];
    for (let i = 0; i < 3; i++) {
      let wins = 0;
      let losses = 0;
      for (let g = 0; g < 12; g++) {
        const high = g % 2;
        const seats: [BotTier, BotTier] = high ? [tiers[i]!, tiers[i + 1]!] : [tiers[i + 1]!, tiers[i]!];
        const s = bumperMatch(seats, 50 + g);
        if (!s.result || s.result.draw) continue;
        if (s.result.winners[0] === high) wins++;
        else losses++;
      }
      expect(wins, `${tiers[i + 1]} over ${tiers[i]}: ${wins} to ${losses}`).toBeGreaterThan(losses * 2);
    }
  });

  it(`${POPS_TO_WIN} pops wins the match, and bots finish matches`, { timeout: 120_000 }, () => {
    const s = bumperMatch(['expert', 'easy'], 3);
    expect(s.result).not.toBeNull();
    expect(s.pops[s.result!.winners[0]!]).toBe(POPS_TO_WIN);
  });
});
