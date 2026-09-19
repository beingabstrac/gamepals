import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import type { BotTier } from '../../core/types';
import {
  bonusOf,
  newYatzy,
  scoreBox,
  totalOf,
  YATZY_BOXES,
  YATZY_FIRST_ROLL,
  yatzy,
  yatzyRoll,
  yatzyScore,
  YatzyState,
  type YatzyMove,
} from './index';

describe('yatzy scoring', () => {
  it('scores the upper boxes as the sum of that number', () => {
    expect(scoreBox('ones', [1, 1, 3, 1, 6])).toBe(3);
    expect(scoreBox('sixes', [1, 1, 3, 1, 6])).toBe(6);
    expect(scoreBox('twos', [1, 1, 3, 1, 6])).toBe(0);
  });

  it('pairs take the highest pair, and two pairs need two different numbers', () => {
    expect(scoreBox('pair', [3, 3, 5, 5, 6])).toBe(10);
    expect(scoreBox('twoPairs', [3, 3, 5, 5, 6])).toBe(16);
    expect(scoreBox('twoPairs', [2, 2, 2, 2, 5])).toBe(0);
    expect(scoreBox('pair', [2, 2, 2, 2, 5])).toBe(4);
    expect(scoreBox('three', [3, 3, 5, 5, 6])).toBe(0);
  });

  it('scores kinds, straights, full house, chance and Yatzy', () => {
    expect(scoreBox('three', [2, 2, 2, 2, 5])).toBe(6);
    expect(scoreBox('four', [2, 2, 2, 2, 5])).toBe(8);
    expect(scoreBox('smallStraight', [5, 3, 1, 2, 4])).toBe(15);
    expect(scoreBox('largeStraight', [5, 3, 1, 2, 4])).toBe(0);
    expect(scoreBox('largeStraight', [6, 2, 3, 5, 4])).toBe(20);
    expect(scoreBox('fullHouse', [4, 4, 4, 6, 6])).toBe(24);
    expect(scoreBox('twoPairs', [4, 4, 4, 6, 6])).toBe(20);
    expect(scoreBox('fullHouse', [2, 2, 2, 2, 5])).toBe(0);
    expect(scoreBox('chance', [5, 3, 1, 2, 4])).toBe(15);
    expect(scoreBox('yatzy', [5, 5, 5, 5, 5])).toBe(50);
    expect(scoreBox('fullHouse', [5, 5, 5, 5, 5])).toBe(0);
    expect(scoreBox('four', [5, 5, 5, 5, 5])).toBe(20);
  });

  it('gives the 50 bonus at 63 in the upper boxes', () => {
    const card = (upper: number[]) => [...upper, ...Array<number | null>(9).fill(null)];
    expect(bonusOf(card([3, 6, 9, 12, 15, 18]))).toBe(50);
    expect(totalOf(card([3, 6, 9, 12, 15, 18]))).toBe(63 + 50);
    expect(bonusOf(card([3, 6, 9, 12, 15, 17]))).toBe(0);
  });
});

describe('yatzy turns', () => {
  it('starts with one roll of all five dice', () => {
    const state = newYatzy(2, 5);
    expect(state.legalMoves(0)).toEqual([YATZY_FIRST_ROLL]);
    expect(state.legalMoves(1)).toEqual([]);
    const rolled = state.apply(YATZY_FIRST_ROLL);
    expect(rolled.dice.every((d) => d >= 1 && d <= 6)).toBe(true);
    // 32 ways to keep dice, plus 15 boxes.
    expect(rolled.legalMoves(0)).toHaveLength(32 + 15);
  });

  it('kept dice stay the same, and three rolls is the most', () => {
    let state = newYatzy(1, 9).apply(YATZY_FIRST_ROLL);
    const first = state.dice;
    state = state.apply(yatzyRoll([true, false, true, false, false]));
    expect(state.dice[0]).toBe(first[0]);
    expect(state.dice[2]).toBe(first[2]);
    state = state.apply(yatzyRoll([false, false, false, false, false]));
    expect(state.rollsUsed).toBe(3);
    expect(state.legalMoves(0)).toHaveLength(15);
    expect(state.legalMoves(0).every((m) => m.startsWith('s'))).toBe(true);
  });

  it('each box is used once, then the turn passes', () => {
    const state = newYatzy(2, 3).apply(YATZY_FIRST_ROLL).apply(yatzyScore('chance'));
    expect(state.currentSeat).toBe(1);
    expect(state.cards[0]![YATZY_BOXES.indexOf('chance')]).toBe(state.dice.reduce((a, b) => a + b, 0));
    const back = state.apply(YATZY_FIRST_ROLL).apply(yatzyScore('ones')).apply(YATZY_FIRST_ROLL);
    expect(back.legalMoves(0)).not.toContain(yatzyScore('chance'));
    expect(() => back.apply(yatzyScore('chance'))).toThrow();
  });

  it('ends after 15 turns each, highest total wins', () => {
    let state = newYatzy(2, 11);
    let turns = 0;
    while (!state.result) {
      state = state.apply(YATZY_FIRST_ROLL);
      state = state.apply(yatzyScore(state.openBoxes(state.currentSeat)[0]!));
      turns++;
    }
    expect(turns).toBe(30);
    const [a, b] = [state.total(0), state.total(1)];
    if (a === b) expect(state.result).toEqual({ winners: [], draw: true });
    else expect(state.result).toEqual({ winners: [a > b ? 0 : 1], draw: false });
  });

  it('rejects out-of-turn and unknown moves', () => {
    const state = newYatzy(2, 1);
    expect(() => state.apply(yatzyScore('ones'))).toThrow();
    expect(() => state.apply('r111' as YatzyMove)).toThrow();
    expect(() => newYatzy(5, 1)).toThrow();
  });
});

function playSolo(tier: BotTier, seed: number): { state: YatzyState; moves: YatzyMove[] } {
  const bot = yatzy.createBot(tier);
  const rng = createRng(seed * 7 + 1);
  let state = yatzy.newGame({ players: 1 }, seed) as YatzyState;
  const moves: YatzyMove[] = [];
  while (!state.result) {
    const move = bot.chooseMove(state, 0, rng);
    expect(state.legalMoves(0)).toContain(move);
    moves.push(move);
    state = state.apply(move);
  }
  return { state, moves };
}

describe('yatzy bots', () => {
  it('play whole games with only legal moves, and replay exactly', () => {
    for (const tier of ['easy', 'medium', 'hard', 'expert'] as const) {
      const { state, moves } = playSolo(tier, 21);
      const replayed = replay(yatzy, toMoveLog(yatzy, { players: 1 }, 21, moves)) as YatzyState;
      expect(replayed.cards).toEqual(state.cards);
      expect(replayed.result).toEqual({ winners: [0], draw: false });
    }
  });

  it('Nova scores more than Pip on average', { timeout: 120_000 }, () => {
    let pip = 0;
    let nova = 0;
    // Over 20 games Pip averages about 177 and Nova about 219.
    for (let seed = 1; seed <= 12; seed++) {
      pip += playSolo('easy', seed).state.total(0);
      nova += playSolo('expert', seed).state.total(0);
    }
    expect(nova).toBeGreaterThan(pip + 12 * 10);
  });
});
