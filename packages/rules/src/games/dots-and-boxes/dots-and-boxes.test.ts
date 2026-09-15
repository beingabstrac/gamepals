import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import type { BotTier } from '../../core/types';
import { boxSides, DOTS_SIZES, dotsAndBoxes, DotsState, drawLine, hLine, lineTotal, newDotsAndBoxes, vLine, type DotsMove } from './index';

describe('dots and boxes board', () => {
  it('has the right number of lines and boxes for each size', () => {
    for (const [level, n] of Object.entries(DOTS_SIZES)) {
      const state = newDotsAndBoxes(2, level as 'small' | 'medium' | 'large');
      expect(state.lines).toHaveLength(lineTotal(n));
      expect(state.boxes).toHaveLength(n * n);
      expect(state.legalMoves(0)).toHaveLength(lineTotal(n));
    }
  });

  it('every box has four different sides', () => {
    const n = 4;
    for (let b = 0; b < n * n; b++) expect(new Set(boxSides(n, b)).size).toBe(4);
  });
});

describe('dots and boxes rules', () => {
  it('drawing a line passes the turn unless it closes a box', () => {
    const state = newDotsAndBoxes(2, 'small');
    const after = state.apply(drawLine(hLine(3, 0, 0)));
    expect(after.currentSeat).toBe(1);
    expect(after.last?.completed).toEqual([]);
  });

  it('closing a box scores it and gives another turn', () => {
    let state = newDotsAndBoxes(2, 'small');
    const [top, bottom, left, right] = boxSides(3, 0);
    // Seat 0, 1, 0 draw three sides; seat 1 closes the box.
    state = state.apply(drawLine(top)).apply(drawLine(bottom)).apply(drawLine(left));
    expect(state.currentSeat).toBe(1);
    state = state.apply(drawLine(right));
    expect(state.boxes[0]).toBe(1);
    expect(state.scores).toEqual([0, 1]);
    expect(state.currentSeat).toBe(1);
  });

  it('one line can close two boxes', () => {
    let state = newDotsAndBoxes(2, 'small');
    const shared = vLine(3, 0, 1);
    const others = [...boxSides(3, 0), ...boxSides(3, 1)].filter((s) => s !== shared);
    for (const line of new Set(others)) state = state.apply(drawLine(line));
    const seat = state.currentSeat;
    const after = state.apply(drawLine(shared));
    expect(after.last?.completed).toHaveLength(2);
    expect(after.scores[seat]).toBe(state.scores[seat]! + 2);
  });

  it("can't draw a line twice", () => {
    const state = newDotsAndBoxes(2, 'small').apply(drawLine(0));
    expect(state.legalMoves(1)).not.toContain(drawLine(0));
    expect(() => state.apply(drawLine(0))).toThrow();
    expect(() => state.apply('x1')).toThrow();
  });

  it('the game ends when every line is drawn; most boxes wins', () => {
    let state = newDotsAndBoxes(2, 'small');
    for (let line = 0; line < lineTotal(3) && !state.result; line++) state = state.apply(drawLine(line));
    expect(state.result).not.toBeNull();
    expect(state.scores.reduce((a, b) => a + b, 0)).toBe(9);
    const best = Math.max(...state.scores);
    expect(state.result!.winners).toEqual(state.scores.flatMap((s, i) => (s === best ? [i] : [])));
  });

  it('a tie between everyone is a draw', () => {
    // 4 by 4 board: every line drawn but the right side of the last box. Seat 1 is behind 7 to 8 and
    // closes the sixteenth box, so the game ends 8 to 8.
    const lines = Array(lineTotal(4)).fill(0);
    const lastLine = boxSides(4, 15)[3];
    lines[lastLine] = -1;
    const boxes = [...Array(8).fill(0), ...Array(7).fill(1), -1];
    const state = new DotsState(2, 4, lines, boxes, [8, 7], 1, null, null);
    const after = state.apply(drawLine(lastLine));
    expect(after.scores).toEqual([8, 8]);
    expect(after.result).toEqual({ winners: [], draw: true });
  });

  it('works for 3 and 4 players', () => {
    for (const players of [3, 4]) {
      let state = newDotsAndBoxes(players, 'small');
      state = state.apply(drawLine(0)).apply(drawLine(1)).apply(drawLine(2));
      expect(state.currentSeat).toBe(3 % players);
    }
  });
});

describe('dots and boxes bots', () => {
  function playBots(tiers: BotTier[], seed: number, level: 'small' | 'medium' = 'medium') {
    const rng = createRng(seed);
    const bots = tiers.map((tier) => dotsAndBoxes.createBot(tier));
    let state = dotsAndBoxes.newGame({ players: tiers.length, variant: level }, seed) as DotsState;
    const moves: DotsMove[] = [];
    while (!state.result) {
      const move = bots[state.currentSeat]!.chooseMove(state, state.currentSeat, rng);
      expect(state.legalMoves(state.currentSeat)).toContain(move);
      moves.push(move);
      state = state.apply(move);
    }
    return { state, moves };
  }

  it('play legal moves and replay exactly, with 4 players', () => {
    const { state, moves } = playBots(['easy', 'medium', 'hard', 'expert'], 2);
    const replayed = replay(dotsAndBoxes, toMoveLog(dotsAndBoxes, { players: 4, variant: 'medium' }, 2, moves)) as DotsState;
    expect(replayed.boxes).toEqual(state.boxes);
    expect(replayed.result).toEqual(state.result);
  });

  const beats = (strong: BotTier, weak: BotTier) => {
    let wins = 0;
    for (let seed = 0; seed < 10; seed++) {
      const me = seed % 2;
      const tiers: BotTier[] = me === 0 ? [strong, weak] : [weak, strong];
      if (playBots(tiers, seed).state.result?.winners.includes(me)) wins++;
    }
    return wins;
  };

  it('Bo beats Pip most of the time', { timeout: 60_000 }, () => {
    expect(beats('medium', 'easy')).toBeGreaterThanOrEqual(7);
  });

  it('Nova beats Pip most of the time', { timeout: 120_000 }, () => {
    expect(beats('expert', 'easy')).toBeGreaterThanOrEqual(8);
  });
});
