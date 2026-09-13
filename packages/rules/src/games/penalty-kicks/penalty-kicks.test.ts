import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import type { BotTier, Seat } from '../../core/types';
import {
  GOAL_CENTER_X,
  keeperFor,
  kickerFor,
  newPenaltyGame,
  PENALTY_TIERS,
  penaltyBotDive,
  penaltyBotShot,
  penaltyDive,
  penaltyShoot,
  PK_STEP,
  shootoutWinner,
  stepPenalty,
  type Kick,
  type KickOutcome,
  type PenaltyState,
} from './index';

function resolve(state: PenaltyState): { state: PenaltyState; outcome: KickOutcome } {
  let s = state;
  for (let i = 0; i < 10 / PK_STEP; i++) {
    const step = stepPenalty(s);
    s = step.state;
    if (step.events.outcome) return { state: s, outcome: step.events.outcome };
  }
  throw new Error('Kick never resolved');
}

const kicks = (outcomes: [Seat, KickOutcome][]): Kick[] => outcomes.map(([kicker, outcome]) => ({ kicker, outcome }));

function shootout(tiers: [BotTier, BotTier], seed: number): PenaltyState {
  const rng = createRng(seed);
  let state = newPenaltyGame();
  for (let kick = 0; kick < 40 && !state.result; kick++) {
    const kicker = kickerFor(state.kicks.length);
    const keeper = keeperFor(state.kicks.length);
    const shot = penaltyBotShot(PENALTY_TIERS[tiers[kicker]], [rng.next() * 2 - 1, rng.next() * 2 - 1, rng.next() * 2 - 1]);
    const read = rng.next();
    state = penaltyShoot(state, kicker, shot);
    let since = 0;
    while (state.phase === 'flight') {
      const dive = penaltyBotDive(state, PENALTY_TIERS[tiers[keeper]], read, since);
      if (dive !== 0) state = penaltyDive(state, keeper, dive);
      state = stepPenalty(state).state;
      since += PK_STEP;
    }
    while (state.phase === 'result' && !state.result) state = stepPenalty(state).state;
  }
  return state;
}

describe('penalty kicks', () => {
  it('seat 0 kicks first and roles alternate', () => {
    expect([kickerFor(0), kickerFor(1), kickerFor(2)]).toEqual([0, 1, 0]);
    expect(keeperFor(0)).toBe(1);
    expect(penaltyShoot(newPenaltyGame(), 1, { aim: 0, power: 0.5, curl: 0 }).phase).toBe('aim');
  });

  it('a corner shot beats a keeper who stays in the middle', () => {
    expect(resolve(penaltyShoot(newPenaltyGame(), 0, { aim: 0.8, power: 0.6, curl: 0 })).outcome).toBe('goal');
  });

  it('a shot straight at the keeper is saved', () => {
    expect(resolve(penaltyShoot(newPenaltyGame(), 0, { aim: 0, power: 0.6, curl: 0 })).outcome).toBe('saved');
  });

  it('diving the right way saves a low shot; the wrong way lets it in', () => {
    const shot = penaltyShoot(newPenaltyGame(), 0, { aim: 0.6, power: 0.5, curl: 0 });
    expect(resolve(penaltyDive(shot, 1, 1)).outcome).toBe('saved');
    expect(resolve(penaltyDive(shot, 1, -1)).outcome).toBe('goal');
  });

  it('too much power clears the bar; the edge of the goal hits the post; beyond is wide', () => {
    expect(resolve(penaltyShoot(newPenaltyGame(), 0, { aim: 0.5, power: 1, curl: 0 })).outcome).toBe('over');
    expect(resolve(penaltyShoot(newPenaltyGame(), 0, { aim: 0.97, power: 0.5, curl: 0 })).outcome).toBe('post');
    expect(resolve(penaltyShoot(newPenaltyGame(), 0, { aim: 1.2, power: 0.5, curl: 0 })).outcome).toBe('wide');
  });

  it('waiting too long misses the kick', () => {
    expect(resolve(newPenaltyGame()).outcome).toBe('too-slow');
  });

  it('the keeper can only dive once', () => {
    const dived = penaltyDive(newPenaltyGame(), 1, -1);
    expect(penaltyDive(dived, 1, 1)).toBe(dived);
    expect(dived.keeperX).toBe(GOAL_CENTER_X);
  });

  it('ends early when a side can no longer catch up, otherwise goes to sudden death', () => {
    // After 3 each: 3–0. Seat 1 has 2 left and can reach at most 2 → seat 0 wins.
    const early = kicks([[0, 'goal'], [1, 'saved'], [0, 'goal'], [1, 'wide'], [0, 'goal'], [1, 'over']]);
    expect(shootoutWinner(early)).toBe(0);
    const level = kicks(Array.from({ length: 10 }, (_, i) => [(i % 2) as Seat, 'goal'] as [Seat, KickOutcome]));
    expect(shootoutWinner(level)).toBeNull();
    expect(shootoutWinner([...level, { kicker: 0, outcome: 'goal' }])).toBeNull();
    expect(shootoutWinner([...level, { kicker: 0, outcome: 'goal' }, { kicker: 1, outcome: 'saved' }])).toBe(0);
  });

  it('a shootout between bots always finishes, and Nova beats Pip more often than not', () => {
    let novaWins = 0;
    for (let seed = 0; seed < 30; seed++) {
      const novaSeat: Seat = seed % 2 === 0 ? 0 : 1;
      const tiers: [BotTier, BotTier] = novaSeat === 0 ? ['expert', 'easy'] : ['easy', 'expert'];
      const state = shootout(tiers, seed);
      expect(state.result).not.toBeNull();
      if (state.result?.winners[0] === novaSeat) novaWins++;
    }
    expect(novaWins).toBeGreaterThan(18);
  });
});
