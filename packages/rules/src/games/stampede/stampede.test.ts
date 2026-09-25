import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import type { BotTier } from '../../core/types';
import {
  canSend,
  FIELD,
  laneX,
  newStampede,
  STAMPEDE_SECONDS,
  STAMPEDE_ROUNDS,
  STAMPEDE_STEP,
  STAMPEDE_TIERS,
  stampedeBotInput,
  stepStampede,
  type StampedeEvents,
  type StampedeInput,
  type StampedeState,
} from './index';

const idle: StampedeInput = { run: null, send: null };
const live = (): StampedeState => ({ ...newStampede(), phase: 'run', timer: 0 });

function run(start: StampedeState, inputs: (s: StampedeState) => [StampedeInput, StampedeInput], seconds: number, until?: (s: StampedeState, e: StampedeEvents) => boolean) {
  let state = start;
  for (let i = 0; i < seconds / STAMPEDE_STEP && !state.result; i++) {
    const step = stepStampede(state, inputs(state));
    state = step.state;
    if (until?.(state, step.events)) break;
  }
  return state;
}

/** A whole match; each bot sees the field as it was its reaction time ago. */
function match(tiers: [BotTier, BotTier], seed: number): StampedeState {
  const rng = createRng(seed);
  let noise = [0, 0];
  let tick = 0;
  const history: StampedeState[] = [];
  return run(newStampede(), (s) => {
    history.push(s);
    if (history.length > 60) history.shift();
    if (tick++ % 20 === 0) noise = [rng.next() * 2 - 1, rng.next() * 2 - 1];
    return [0, 1].map((seat) => {
      const tier = STAMPEDE_TIERS[tiers[seat]!];
      const back = Math.min(history.length - 1, Math.round(tier.reactionMs / 1000 / STAMPEDE_STEP));
      const seen = history[history.length - 1 - back]!;
      // The runner knows where it is; it sees the herd late.
      const view = seat === s.runner ? { ...seen, x: s.x, vx: s.vx, phase: s.phase, cooldown: s.cooldown } : { ...s, x: seen.x, vx: seen.vx };
      return stampedeBotInput(view, seat as 0 | 1, tier, noise[seat]!);
    }) as [StampedeInput, StampedeInput];
  }, 200);
}

describe('stampede', () => {
  it('nothing moves in the countdown', () => {
    const s = run(newStampede(), () => [{ run: 1, send: null }, { run: null, send: 0 }], 0.5);
    expect(s.x).toBe(laneX(2));
    expect(s.animals.length).toBe(0);
  });

  it('the runner runs; the herder sends an animal down a lane, then must wait', () => {
    const s = run(live(), () => [{ run: 1, send: null }, idle], 0.3);
    expect(s.x).toBeGreaterThan(laneX(2) + 40);
    const sent = stepStampede(live(), [idle, { run: null, send: 1 }]).state;
    expect(sent.animals.length).toBe(1);
    expect(canSend(sent, 3)).toBe(false);
  });

  it('an animal in the runner lane catches it and the herder wins the round; lasting the round wins it for the runner', () => {
    let caught: boolean | null = null;
    const s = run(live(), () => [idle, { run: null, send: 2 }], 5, (_s, e) => ((caught = e.roundOver), e.roundOver !== null));
    expect(caught).toBe(false);
    expect(s.points).toEqual([0, 1]);
    const safe = run(live(), () => [idle, { run: null, send: 0 }], STAMPEDE_SECONDS + 1, (_s, e) => e.roundOver !== null);
    expect(safe.points).toEqual([1, 0]);
    expect(safe.lastRound?.survived).toBe(true);
  });

  it('roles swap each round and four rounds end it', { timeout: 60_000 }, () => {
    const s = match(['medium', 'medium'], 1);
    expect(s.result).not.toBeNull();
    expect(s.round).toBe(STAMPEDE_ROUNDS);
    expect(FIELD.bottom).toBeGreaterThan(0);
  });

  it('bot tiers line up: each beats the one below', { timeout: 120_000 }, () => {
    const tiers: BotTier[] = ['easy', 'medium', 'hard', 'expert'];
    for (let i = 0; i < 3; i++) {
      let wins = 0;
      let losses = 0;
      for (let g = 0; g < 12; g++) {
        const high = g % 2;
        const seats: [BotTier, BotTier] = high ? [tiers[i]!, tiers[i + 1]!] : [tiers[i + 1]!, tiers[i]!];
        const s = match(seats, 40 + g);
        if (!s.result || s.result.draw) continue;
        if (s.result.winners[0] === high) wins++;
        else losses++;
      }
      expect(wins, `${tiers[i + 1]} over ${tiers[i]}: ${wins} to ${losses}`).toBeGreaterThan(losses * 2);
    }
  });
});
