import { describe, expect, it } from 'vitest';
import { BOT_TIERS } from '../../core/types';
import { createRng } from '../../core/rng';
import {
  ANSWER_COUNT,
  ASK_MS,
  botAnswerMs,
  botChoice,
  newQuickMaths,
  QUICK_TIERS,
  QUICK_WIN_SCORE,
  quickAnswer,
  questionFor,
  stepQuick,
  type QuickState,
} from './index';

/** Runs the clock until the question is up, which is where the game actually happens. */
const asking = (state: QuickState): QuickState => {
  let now = state;
  while (now.phase !== 'ask' && !now.result) now = stepQuick(now, 100);
  return now;
};

describe('the sums', () => {
  it('come from the seed and the round, with one right answer among four', () => {
    for (let round = 0; round < 12; round++) {
      const question = questionFor(42, round);
      expect(questionFor(42, round)).toEqual(question);
      expect(question.choices).toHaveLength(ANSWER_COUNT);
      expect(new Set(question.choices).size, `round ${round} repeats an answer`).toBe(ANSWER_COUNT);
      expect(question.choices.filter((choice) => choice === question.answer)).toHaveLength(1);
      expect(question.choices.every((choice) => choice > 0)).toBe(true);
      const worked = question.op === '+' ? question.a + question.b : question.op === '-' ? question.a - question.b : question.a * question.b;
      expect(question.answer).toBe(worked);
      // Never a negative answer: a take-away always takes the smaller from the bigger.
      expect(question.answer).toBeGreaterThan(0);
    }
  });

  it('get harder as the rounds go by', () => {
    const early = [0, 1].map((round) => questionFor(42, round));
    expect(early.every((question) => question.op === '+'), 'round one should be an addition').toBe(true);
    // By the later rounds there is multiplication about.
    const later = Array.from({ length: 20 }, (_, i) => questionFor(42, i + 5));
    expect(later.some((question) => question.op === '*')).toBe(true);
  });
});

describe('racing to answer', () => {
  it('gives the point to the first right tap', () => {
    const state = asking(newQuickMaths(3));
    const after = quickAnswer(state, 1, state.question.answer);
    expect(after.scores).toEqual([0, 1]);
    expect(after.phase).toBe('point');
    expect(after.lastPoint).toEqual({ seat: 1, reason: 'right' });
  });

  it('locks out a wrong tap and leaves the other player to it', () => {
    const state = asking(newQuickMaths(3));
    const wrong = state.question.choices.find((choice) => choice !== state.question.answer)!;
    const after = quickAnswer(state, 0, wrong);
    expect(after.locked).toEqual([true, false]);
    expect(after.scores).toEqual([0, 0]);
    expect(after.phase).toBe('ask');
    // A locked player tapping again does nothing at all, right answer or not.
    expect(quickAnswer(after, 0, after.question.answer)).toEqual(after);
    // And the other player can still take it.
    expect(quickAnswer(after, 1, after.question.answer).scores).toEqual([0, 1]);
  });

  it('ends the question when both are locked out, with no point', () => {
    let state = asking(newQuickMaths(3));
    const wrong = state.question.choices.find((choice) => choice !== state.question.answer)!;
    state = quickAnswer(state, 0, wrong);
    state = quickAnswer(state, 1, wrong);
    expect(state.scores).toEqual([0, 0]);
    expect(state.phase).toBe('point');
    expect(state.lastPoint).toEqual({ seat: null, reason: 'nobody' });
  });

  it('ends the question when nobody answers in time', () => {
    const state = stepQuick(asking(newQuickMaths(3)), ASK_MS);
    expect(state.phase).toBe('point');
    expect(state.lastPoint?.seat).toBe(null);
    expect(state.scores).toEqual([0, 0]);
  });

  it('moves on to a new sum after a point', () => {
    const state = asking(newQuickMaths(3));
    const scored = quickAnswer(state, 0, state.question.answer);
    let next = scored;
    while (next.phase !== 'ask') next = stepQuick(next, 200);
    expect(next.round).toBe(1);
    expect(next.locked).toEqual([false, false]);
    expect(next.question).toEqual(questionFor(state.seed, 1));
  });

  it('is won at five points, and nothing happens after that', () => {
    let state = newQuickMaths(3);
    for (let point = 0; point < QUICK_WIN_SCORE; point++) {
      state = asking(state);
      state = quickAnswer(state, 0, state.question.answer);
    }
    expect(state.scores[0]).toBe(QUICK_WIN_SCORE);
    expect(state.result?.winners).toEqual([0]);
    expect(stepQuick(state, 5000)).toEqual(state);
    expect(quickAnswer(state, 1, state.question.answer)).toEqual(state);
  });
});

describe('quick maths bots', () => {
  it('answer faster and more accurately the better they are', () => {
    const rng = createRng(1);
    const times = BOT_TIERS.map((tier) => botAnswerMs(QUICK_TIERS[tier], rng));
    for (let i = 1; i < times.length; i++) {
      expect(times[i]!, `${BOT_TIERS[i]} should be quicker than ${BOT_TIERS[i - 1]}`).toBeLessThan(times[i - 1]!);
    }
    // The expert almost always picks the right one; the easy bot does not.
    const question = questionFor(7, 3);
    const count = (tier: (typeof BOT_TIERS)[number]) =>
      Array.from({ length: 200 }, (_, i) => botChoice(question, QUICK_TIERS[tier], createRng(i + 1)))
        .filter((choice) => choice === question.answer).length;
    expect(count('expert')).toBeGreaterThan(count('easy'));
    expect(count('expert')).toBeGreaterThan(180);
  });
});
