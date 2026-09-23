import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import type { BotTier } from '../../core/types';
import {
  DUEL_STEP,
  DUEL_TIERS,
  duelBotInput,
  FENCER_RADIUS,
  gapOf,
  LUNGE_REACH,
  newDuel,
  REACH,
  STRIP,
  stepDuel,
  TOUCHES_TO_WIN,
  type DuelInput,
  type DuelState,
  type Fencer,
} from './index';

const idle: DuelInput = { step: 0, lunge: false, parry: false };
const lunge: DuelInput = { step: 0, lunge: true, parry: false };
const parry: DuelInput = { step: 0, lunge: false, parry: true };
const fencer = (y: number, extra: Partial<Fencer> = {}): Fencer => ({ y, stance: 'guard', timer: 0, parryCooldown: 0, ...extra });
/** A bout under way with the bodies `gap` apart. */
const at = (gap: number, extra: Partial<DuelState> = {}): DuelState => ({
  ...newDuel(),
  phase: 'bout',
  timer: 0,
  fencers: [fencer(450 + gap / 2 + FENCER_RADIUS), fencer(450 - gap / 2 - FENCER_RADIUS)],
  ...extra,
});
const run = (state: DuelState, seconds: number, inputs: [DuelInput, DuelInput] = [idle, idle]) => {
  let s = state;
  for (let t = 0; t < seconds; t += DUEL_STEP) s = stepDuel(s, inputs).state;
  return s;
};

describe('sword duel', () => {
  it('stepping moves a fencer toward the other, and never through them', () => {
    const s = run(at(300), 0.3, [{ step: 1, lunge: false, parry: false }, idle]);
    expect(gapOf(s)).toBeLessThan(300);
    const close = run(at(300), 5, [{ step: 1, lunge: false, parry: false }, { step: 1, lunge: false, parry: false }]);
    expect(close.fencers[0].y - close.fencers[1].y).toBeGreaterThanOrEqual(FENCER_RADIUS * 2 - 1e-9);
  });

  it('a lunge in distance on an open fencer is a touch, and both go back to their lines', () => {
    const { state, events } = stepDuel(at(REACH + LUNGE_REACH - 10), [lunge, idle]);
    expect(events.touch).toBe(0);
    expect(state.touches).toEqual([1, 0]);
    expect(state.phase).toBe('touch');
    const back = run(state, 1.2);
    expect(back.fencers[0].y).toBeGreaterThan(state.fencers[0].y - 1000);
    expect(gapOf(back)).toBeGreaterThan(REACH + LUNGE_REACH);
  });

  it('a lunge out of distance misses and leaves the attacker stretched and slow', () => {
    const s = run(at(REACH + LUNGE_REACH + 60), 0.3, [lunge, idle]);
    expect(s.touches).toEqual([0, 0]);
    expect(s.fencers[0].stance).toBe('recover');
    // Stretched, it cannot step or parry until it has recovered.
    const y = s.fencers[0].y;
    const stuck = stepDuel(s, [{ step: -1, lunge: false, parry: true }, idle]).state;
    expect(stuck.fencers[0].y).toBe(y);
    expect(stuck.fencers[0].stance).toBe('recover');
  });

  it('a parried lunge scores nothing and stuns the attacker, and the riposte scores', () => {
    const start = at(REACH + LUNGE_REACH - 10);
    const guarded = stepDuel(start, [idle, parry]).state;
    const { state, events } = stepDuel(guarded, [lunge, idle]);
    expect(events.parried).toBe(1);
    expect(events.touch).toBeNull();
    expect(state.fencers[0].stance).toBe('stunned');
    // The parry runs out, then the riposte goes in on the stunned fencer.
    let s = state;
    for (let i = 0; i < 40 && s.fencers[1].stance !== 'guard'; i++) s = stepDuel(s, [idle, idle]).state;
    const riposte = stepDuel(s, [idle, lunge]);
    expect(riposte.events.touch).toBe(1);
  });

  it('two lunges landing in the same instant are a double, and nobody scores', () => {
    const { state, events } = stepDuel(at(REACH + LUNGE_REACH - 10), [lunge, lunge]);
    expect(events.touch).toBe('double');
    expect(state.touches).toEqual([0, 0]);
  });

  it('first to five touches wins', () => {
    let s = at(REACH + 20);
    for (let n = 0; n < TOUCHES_TO_WIN; n++) {
      s = stepDuel({ ...s, phase: 'bout', fencers: at(REACH + 20).fencers }, [lunge, idle]).state;
    }
    expect(s.touches[0]).toBe(TOUCHES_TO_WIN);
    expect(s.result).toEqual({ winners: [0], draw: false });
  });

  it('the same inputs always give the same bout', () => {
    const inputs: [DuelInput, DuelInput] = [{ step: 1, lunge: false, parry: false }, { step: 0.5, lunge: false, parry: false }];
    expect(run(newDuel(), 3, inputs)).toEqual(run(newDuel(), 3, inputs));
  });

  it('Expert beats Easy in most bouts, and bouts end', { timeout: 120_000 }, () => {
    const bout = (tiers: [BotTier, BotTier], seed: number) => {
      const rng = createRng(seed);
      let s = newDuel();
      const history: DuelState[] = [];
      let rolls = [0.5, 0.5];
      for (let step = 0; step < 120 * 300 && !s.result; step++) {
        if (step % 48 === 0) rolls = [rng.next(), rng.next()];
        history.push(s);
        const seen = (seat: 0 | 1) => {
          const back = Math.round((DUEL_TIERS[tiers[seat]].reactionMs / 1000) / DUEL_STEP);
          return (history[Math.max(0, history.length - 1 - back)] ?? s).fencers[seat === 0 ? 1 : 0];
        };
        s = stepDuel(s, [duelBotInput(s, 0, DUEL_TIERS[tiers[0]], seen(0), rolls[0]), duelBotInput(s, 1, DUEL_TIERS[tiers[1]], seen(1), rolls[1])]).state;
        if (history.length > 60) history.shift();
      }
      return s.result;
    };
    let expert = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const expertSeat = seed % 2;
      const result = bout(expertSeat === 0 ? ['expert', 'easy'] : ['easy', 'expert'], seed);
      expect(result, `bout ${seed} ended`).not.toBeNull();
      if (result?.winners.includes(expertSeat)) expert++;
    }
    expect(expert).toBeGreaterThanOrEqual(7);
  });
});

/** Invariant: the fencers never pass each other, stay on the strip, and touches never go down. */
describe('sword duel invariants', () => {
  it('keeps the fencers apart and on the strip, and the touches climbing', { timeout: 60_000 }, () => {
    for (let seed = 0; seed < 6; seed++) {
      const rng = createRng(seed);
      let s = newDuel();
      let inputs: [DuelInput, DuelInput] = [idle, idle];
      for (let step = 0; step < 120 * 60 && !s.result; step++) {
        if (step % 12 === 0) {
          const pick = (): DuelInput => ({ step: rng.int(3) - 1, lunge: rng.next() < 0.1, parry: rng.next() < 0.1 });
          inputs = [pick(), pick()];
        }
        const before = s.touches;
        s = stepDuel(s, inputs).state;
        const where = `seed ${seed} step ${step}`;
        const [a, b] = s.fencers;
        expect(a.y - b.y, where).toBeGreaterThanOrEqual(FENCER_RADIUS * 2 - 1e-9);
        expect(a.y, where).toBeLessThanOrEqual(STRIP.bottom - FENCER_RADIUS + 1e-9);
        expect(b.y, where).toBeGreaterThanOrEqual(STRIP.top + FENCER_RADIUS - 1e-9);
        expect(s.touches[0], where).toBeGreaterThanOrEqual(before[0]);
        expect(s.touches[1], where).toBeGreaterThanOrEqual(before[1]);
      }
    }
  });
});
