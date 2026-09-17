import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import type { BotTier, Seat } from '../../core/types';
import {
  backgammon,
  BackgammonState,
  bearOffMove,
  canBearOff,
  die,
  enterMove,
  newBackgammon,
  PASS,
  pipCount,
  ROLL,
  startingBoard,
  stepMove,
  type BackgammonMove,
  type Board,
} from './index';

/** A board from a sparse map of point → signed count (positive is seat 0). */
function board(points: Record<number, number>, bar: [number, number] = [0, 0], off: [number, number] = [0, 0]): Board {
  const list = Array<number>(24).fill(0);
  for (const [point, count] of Object.entries(points)) list[Number(point)] = count;
  return { points: list, bar: [...bar], off: [...off] };
}

const waiting = (b: Board, dice: number[], seat: Seat = 0) => new BackgammonState(b, 1, seat, 'move', dice, dice, 0, null, null);

/** A seed whose first two dice are what the test needs. */
function seedFor(test: (a: number, b: number) => boolean): number {
  for (let seed = 1; seed < 200_000; seed++) if (test(die(seed, 0), die(seed, 1))) return seed;
  throw new Error('No seed');
}

describe('backgammon setup', () => {
  it('starts in the standard position, 15 checkers and 167 pips each', () => {
    const start = startingBoard();
    const count = (seat: Seat) => start.points.filter((c) => (seat === 0 ? c > 0 : c < 0)).reduce((sum, c) => sum + Math.abs(c), 0);
    expect(count(0)).toBe(15);
    expect(count(1)).toBe(15);
    expect(pipCount(start, 0)).toBe(167);
    expect(pipCount(start, 1)).toBe(167);
    expect(newBackgammon(4).legalMoves(0)).toEqual([ROLL]);
    expect(newBackgammon(4).legalMoves(1)).toEqual([]);
  });

  it('rolls two dice, and doubles give four moves', () => {
    const doubles = seedFor((a, b) => a === b);
    expect(newBackgammon(doubles).apply(ROLL).dice).toHaveLength(4);
    const mixed = seedFor((a, b) => a !== b);
    const after = newBackgammon(mixed).apply(ROLL);
    expect(after.dice).toHaveLength(2);
    expect(after.phase).toBe('move');
  });
});

describe('backgammon rules', () => {
  it('must bring a checker in from the bar first, and passes when it cannot', () => {
    // Seat 0 comes in on 24 - die, so a 3 lands on 21 and a 4 on 20.
    const blockedBoth = waiting(board({ 21: -2, 20: -2, 5: 3 }, [1, 0]), [3, 4]);
    expect(blockedBoth.legalMoves(0)).toEqual([PASS]);
    const oneOpen = waiting(board({ 21: -2, 5: 3 }, [1, 0]), [3, 4]);
    expect(oneOpen.legalMoves(0)).toEqual([enterMove(20)]);
    const came = oneOpen.apply(enterMove(20));
    expect(came.board.bar[0]).toBe(0);
    expect(came.board.points[20]).toBe(1);
  });

  it('hits a lone checker and sends it to the bar', () => {
    const state = waiting(board({ 10: 1, 7: -1 }), [3, 6]);
    const after = state.apply(stepMove(10, 7));
    expect(after.board.points[7]).toBe(1);
    expect(after.board.bar[1]).toBe(1);
    expect(after.last).toMatchObject({ kind: 'move', hit: true });
  });

  it('never lands on a point held by two or more of the other side', () => {
    const state = waiting(board({ 10: 1, 7: -2, 4: -3 }), [3, 6]);
    expect(state.legalMoves(0)).toEqual([PASS]);
  });

  it('plays the higher die when only one of the two can be used', () => {
    // From 8 a 2 reaches 6 and a 5 reaches 3, but point 1 is shut, so the second die can never follow.
    const state = waiting(board({ 8: 1, 1: -2 }), [2, 5]);
    expect(state.legalMoves(0)).toEqual([stepMove(8, 3)]);
    const after = state.apply(stepMove(8, 3));
    expect(after.dice).toEqual([2]);
    expect(after.legalMoves(0)).toEqual([PASS]);
    expect(after.apply(PASS).currentSeat).toBe(1);
  });

  it('keeps both dice playable when a choice would waste one', () => {
    const state = waiting(board({ 8: 1, 6: -2, 3: -2 }), [2, 5]);
    // A 2 to point 6 and a 5 to point 3 are both shut, so only 8 → 1 (die 5... ) stays open.
    expect(state.legalMoves(0)).not.toContain(stepMove(8, 6));
    expect(state.legalMoves(0)).not.toContain(stepMove(8, 3));
  });

  it('bears off with an exact roll, or a bigger one from the furthest point', () => {
    const home = waiting(board({ 2: 2, 0: 1 }, [0, 0], [12, 0]), [3, 1]);
    expect(canBearOff(home.board, 0)).toBe(true);
    const moves = home.legalMoves(0);
    expect(moves).toContain(bearOffMove(2));
    expect(moves).toContain(bearOffMove(0));
    // A 3 cannot take the checker off point 0 while one sits further back on point 2.
    expect(moves.filter((m) => m === bearOffMove(0))).toHaveLength(1);
    const last = waiting(board({ 0: 1 }, [0, 0], [14, 0]), [5, 5, 5, 5]);
    expect(last.legalMoves(0)).toEqual([bearOffMove(0)]);
    const won = last.apply(bearOffMove(0));
    expect(won.board.off[0]).toBe(15);
    expect(won.result).toEqual({ winners: [0], draw: false });
  });

  it('rejects out-of-turn and illegal moves', () => {
    const state = waiting(board({ 10: 1 }), [3, 6]);
    expect(state.legalMoves(1)).toEqual([]);
    expect(() => state.apply(stepMove(10, 2))).toThrow();
    expect(() => state.apply(ROLL)).toThrow();
  });
});

function playGame(tiers: BotTier[], seed: number): { state: BackgammonState; moves: BackgammonMove[] } {
  const bots = tiers.map((tier) => backgammon.createBot(tier));
  const rng = createRng(seed * 13 + 5);
  let state = backgammon.newGame({ players: 2 }, seed) as BackgammonState;
  const moves: BackgammonMove[] = [];
  while (!state.result && moves.length < 3000) {
    const move = bots[state.currentSeat]!.chooseMove(state, state.currentSeat, rng);
    expect(state.legalMoves(state.currentSeat)).toContain(move);
    moves.push(move);
    state = state.apply(move);
  }
  return { state, moves };
}

describe('backgammon bots', () => {
  it('play whole games with only legal moves, and replay exactly', () => {
    for (const seed of [3, 9]) {
      const { state, moves } = playGame(['medium', 'hard'], seed);
      expect(state.result?.winners).toHaveLength(1);
      const replayed = replay(backgammon, toMoveLog(backgammon, { players: 2 }, seed, moves)) as BackgammonState;
      expect(replayed.board.off).toEqual(state.board.off);
    }
  });

  it('Nova beats Pip', () => {
    let wins = 0;
    for (let game = 0; game < 6; game++) {
      const novaSeat = game % 2;
      const { state } = playGame(novaSeat === 0 ? ['expert', 'easy'] : ['easy', 'expert'], 40 + game);
      if (state.result?.winners[0] === novaSeat) wins++;
    }
    expect(wins).toBeGreaterThan(3);
  });
});
