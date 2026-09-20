import { createRng, type Rng } from '../../core/rng';
import type { BotTier, GameResult, RealtimeGameDefinition, Seat } from '../../core/types';

/**
 * Quick Maths (docs/games/quick-maths.md). Two people, one device, one sum at a time, first
 * right answer takes the point. A real-time duel like Reflex Race, so it steps rather than
 * taking turns.
 */
export const QUICK_WIN_SCORE = 5;
export const ANSWER_COUNT = 4;
const READY_MS = 900;
/** How long a question stays up before it goes away with nobody scoring. */
export const ASK_MS = 7000;
const POINT_MS = 1400;

/** ready: "Round n" · ask: the sum is up · point: showing who got it. */
export type QuickPhase = 'ready' | 'ask' | 'point';

export type QuickOp = '+' | '-' | '*';

export interface Question {
  readonly a: number;
  readonly b: number;
  readonly op: QuickOp;
  readonly answer: number;
  /** Four answers, one of them right, in the order they are shown. */
  readonly choices: readonly number[];
}

export interface QuickPoint {
  readonly seat: Seat | null;
  readonly reason: 'right' | 'nobody';
}

export interface QuickState {
  readonly seed: number;
  readonly round: number;
  readonly phase: QuickPhase;
  readonly phaseMs: number;
  readonly question: Question;
  /** A player who answered wrongly is out of this question. */
  readonly locked: readonly [boolean, boolean];
  readonly scores: readonly [number, number];
  readonly lastPoint: QuickPoint | null;
  readonly result: GameResult | null;
}

/**
 * The sum for a round. It gets harder as the game goes on, which is why there are no levels to
 * pick: round one is a small addition and by round seven there is multiplication in it.
 */
export function questionFor(seed: number, round: number): Question {
  const rng = createRng((seed ^ Math.imul(round + 1, 0x9e3779b9)) >>> 0);
  const hard = Math.min(round, 8);
  const ops: QuickOp[] = hard < 2 ? ['+'] : hard < 4 ? ['+', '-'] : ['+', '-', '*'];
  const op = ops[rng.int(ops.length)]!;
  let a: number;
  let b: number;
  if (op === '*') {
    a = 2 + rng.int(Math.min(9, 3 + hard));
    b = 2 + rng.int(Math.min(9, 3 + hard));
  } else {
    const top = 10 + hard * 8;
    a = 2 + rng.int(top);
    b = 2 + rng.int(top);
    // Never a negative answer: a take-away always takes the smaller from the bigger.
    if (op === '-' && b > a) [a, b] = [b, a];
  }
  const answer = op === '+' ? a + b : op === '-' ? a - b : a * b;
  return { a, b, op, answer, choices: choicesFor(answer, rng) };
}

/** Four answers, one right and three near enough to make you read them. */
function choicesFor(answer: number, rng: Rng): number[] {
  const out = new Set<number>([answer]);
  const spread = Math.max(2, Math.round(Math.abs(answer) * 0.2));
  let guard = 0;
  while (out.size < ANSWER_COUNT && guard++ < 200) {
    const off = 1 + rng.int(spread);
    const wrong = rng.int(2) === 0 ? answer + off : answer - off;
    if (wrong > 0 && wrong !== answer) out.add(wrong);
  }
  // A very small answer can run out of room below it, so fill upwards.
  let next = answer + spread + 1;
  while (out.size < ANSWER_COUNT) out.add(next++);
  const list = [...out];
  for (let i = list.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [list[i], list[j]] = [list[j]!, list[i]!];
  }
  return list;
}

export function newQuickMaths(seed: number): QuickState {
  return {
    seed: seed >>> 0,
    round: 0,
    phase: 'ready',
    phaseMs: 0,
    question: questionFor(seed >>> 0, 0),
    locked: [false, false],
    scores: [0, 0],
    lastPoint: null,
    result: null,
  };
}

function award(state: QuickState, point: QuickPoint): QuickState {
  const scores: [number, number] = [state.scores[0], state.scores[1]];
  if (point.seat !== null) scores[point.seat]++;
  const won = point.seat !== null && scores[point.seat]! >= QUICK_WIN_SCORE;
  return {
    ...state,
    scores,
    phase: 'point',
    phaseMs: 0,
    lastPoint: point,
    result: won ? { winners: [point.seat!], draw: false } : null,
  };
}

/**
 * A tap on an answer. The right one takes the point; a wrong one puts that player out of this
 * question, because without a cost the best play is to hit all four buttons.
 */
export function quickAnswer(state: QuickState, seat: Seat, choice: number): QuickState {
  if (state.result || state.phase !== 'ask' || state.locked[seat]) return state;
  if (choice === state.question.answer) return award(state, { seat, reason: 'right' });
  const locked: [boolean, boolean] = [state.locked[0], state.locked[1]];
  locked[seat] = true;
  if (locked[0] && locked[1]) return award({ ...state, locked }, { seat: null, reason: 'nobody' });
  return { ...state, locked };
}

export function stepQuick(state: QuickState, dtMs: number): QuickState {
  if (state.result) return state;
  const phaseMs = state.phaseMs + dtMs;
  switch (state.phase) {
    case 'ready':
      return phaseMs >= READY_MS ? { ...state, phase: 'ask', phaseMs: 0 } : { ...state, phaseMs };
    case 'ask':
      // Time runs out and the question goes away with nobody scoring.
      return phaseMs >= ASK_MS ? award({ ...state, phaseMs }, { seat: null, reason: 'nobody' }) : { ...state, phaseMs };
    case 'point': {
      if (phaseMs < POINT_MS) return { ...state, phaseMs };
      const round = state.round + 1;
      return {
        ...state,
        round,
        phase: 'ready',
        phaseMs: 0,
        question: questionFor(state.seed, round),
        locked: [false, false],
        lastPoint: null,
      };
    }
  }
}

export interface QuickTier {
  /** Roughly how long this bot takes to read a sum and answer it. */
  readonly meanMs: number;
  readonly jitterMs: number;
  /** How often it picks a wrong answer, which is what makes it beatable rather than just slow. */
  readonly wrongRate: number;
}

export const QUICK_TIERS: Record<BotTier, QuickTier> = {
  easy: { meanMs: 3400, jitterMs: 700, wrongRate: 0.35 },
  medium: { meanMs: 2500, jitterMs: 500, wrongRate: 0.2 },
  hard: { meanMs: 1700, jitterMs: 350, wrongRate: 0.08 },
  expert: { meanMs: 1150, jitterMs: 220, wrongRate: 0.02 },
};

export function botAnswerMs(tier: QuickTier, rng: Rng): number {
  return tier.meanMs + (rng.next() * 2 - 1) * tier.jitterMs;
}

/** What this bot taps: the answer, or one of the wrong ones when it is having a bad one. */
export function botChoice(question: Question, tier: QuickTier, rng: Rng): number {
  if (rng.next() >= tier.wrongRate) return question.answer;
  const wrong = question.choices.filter((choice) => choice !== question.answer);
  return wrong.length ? wrong[rng.int(wrong.length)]! : question.answer;
}

export const quickMaths: RealtimeGameDefinition = {
  id: 'quick-maths',
  name: 'Quick Maths',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive'],
  realtime: true,
};
