import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import { BOT_TIERS } from '../../core/types';
import { LADDERS, newSnakes, SNAKES, snakesAndLadders, snakesDie, SnakesState, type SnakesLevel } from './index';

/** A seed whose first rolls are exactly `rolls`. */
function seedFor(rolls: number[]): number {
  for (let seed = 1; seed < 2_000_000; seed++) {
    if (rolls.every((roll, i) => snakesDie(seed, i) === roll)) return seed;
  }
  throw new Error(`No seed for ${rolls.join(',')}`);
}

/** A position with the given tokens and seed, seat 0 to roll. */
const at = (positions: number[], rolls: number[], level: SnakesLevel = 'classic') =>
  new SnakesState(level, seedFor(rolls), positions, 0, 0, 0, null, null);

describe('snakes and ladders setup', () => {
  it('starts every token off the board with seat 0 to roll', () => {
    const state = newSnakes(3, 7);
    expect(state.positions).toEqual([0, 0, 0]);
    expect(state.currentSeat).toBe(0);
    expect(state.legalMoves(0)).toEqual(['roll']);
    expect(state.legalMoves(1)).toEqual([]);
  });

  it('only allows 2–4 players', () => {
    expect(() => newSnakes(1, 1)).toThrow();
    expect(() => newSnakes(5, 1)).toThrow();
  });

  it('has a fair board: nothing on 1 or 100, no square is both, no chains', () => {
    const feet = Object.keys(LADDERS).map(Number);
    const heads = Object.keys(SNAKES).map(Number);
    const ends = [...Object.values(LADDERS), ...Object.values(SNAKES)];
    for (const square of [...feet, ...heads]) {
      expect(square).toBeGreaterThan(1);
      expect(square).toBeLessThan(100);
      expect(ends).not.toContain(square);
    }
    expect(feet.filter((f) => heads.includes(f))).toEqual([]);
    for (const foot of feet) expect(LADDERS[foot]!).toBeGreaterThan(foot);
    for (const head of heads) expect(SNAKES[head]!).toBeLessThan(head);
  });

  it('rolls fair, seed-determined dice', () => {
    const counts = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 6000; i++) counts[snakesDie(99, i) - 1]!++;
    for (const count of counts) expect(count).toBeGreaterThan(850);
    expect(snakesDie(5, 3)).toBe(snakesDie(5, 3));
  });
});

describe('snakes and ladders rules', () => {
  it('moves forward by the roll, one square at a time', () => {
    const after = at([10, 0], [3]).apply('roll');
    expect(after.positions).toEqual([13, 0]);
    expect(after.last?.path).toEqual([11, 12, 13]);
    expect(after.currentSeat).toBe(1);
  });

  it('a ladder lifts the token', () => {
    const after = at([1, 0], [3]).apply('roll');
    expect(after.last?.jump).toEqual({ kind: 'ladder', to: 25 });
    expect(after.positions[0]).toBe(25);
  });

  it('a snake drops the token', () => {
    const after = at([13, 0], [4]).apply('roll');
    expect(after.last?.jump).toEqual({ kind: 'snake', to: 7 });
    expect(after.positions[0]).toBe(7);
  });

  it('classic bounces back from an overshoot', () => {
    const after = at([97, 0], [5]).apply('roll');
    expect(after.last?.bounced).toBe(true);
    expect(after.last?.path).toEqual([98, 99, 100, 99, 98]);
    // Bounced onto the snake at 98.
    expect(after.positions[0]).toBe(79);
    expect(after.result).toBeNull();
  });

  it('quick wins on any roll that reaches 100', () => {
    const after = at([97, 0], [5], 'quick').apply('roll');
    expect(after.last?.path).toEqual([98, 99, 100]);
    expect(after.positions[0]).toBe(100);
    expect(after.result).toEqual({ winners: [0], draw: false });
  });

  it('the exact roll wins in classic', () => {
    const after = at([96, 0], [4]).apply('roll');
    expect(after.result).toEqual({ winners: [0], draw: false });
    expect(after.legalMoves(0)).toEqual([]);
    expect(() => after.apply('roll')).toThrow();
  });

  it('a 6 rolls again', () => {
    const after = at([10, 0], [6]).apply('roll');
    expect(after.positions[0]).toBe(16);
    expect(after.last?.again).toBe(true);
    expect(after.currentSeat).toBe(0);
  });

  it('a third 6 in a row ends the turn without moving', () => {
    let state = at([30, 0], [6, 6, 6]);
    state = state.apply('roll').apply('roll');
    expect(state.positions[0]).toBe(42);
    state = state.apply('roll');
    expect(state.last?.lostTurn).toBe(true);
    expect(state.positions[0]).toBe(42);
    expect(state.currentSeat).toBe(1);
  });

  it('rejects out-of-turn and unknown moves', () => {
    const state = newSnakes(2, 3);
    expect(state.legalMoves(1)).toEqual([]);
    expect(() => state.apply('jump' as 'roll')).toThrow();
  });
});

describe('snakes and ladders bots', () => {
  it('play whole games with only legal moves, in both levels, and replay exactly', () => {
    for (const level of ['classic', 'quick'] as const) {
      for (const players of [2, 3, 4]) {
        const bots = BOT_TIERS.map((tier) => snakesAndLadders.createBot(tier));
        const seed = players * 31 + (level === 'quick' ? 1 : 0);
        let state = snakesAndLadders.newGame({ players, variant: level }, seed) as SnakesState;
        const moves: 'roll'[] = [];
        const rng = createRng(1);
        while (!state.result && moves.length < 5000) {
          const move = bots[state.currentSeat % bots.length]!.chooseMove(state, state.currentSeat, rng);
          expect(state.legalMoves(state.currentSeat)).toContain(move);
          moves.push(move);
          state = state.apply(move);
        }
        expect(state.result?.winners).toHaveLength(1);
        expect(state.positions[state.result!.winners[0]!]).toBe(100);
        const replayed = replay(snakesAndLadders, toMoveLog(snakesAndLadders, { players, variant: level }, seed, moves)) as SnakesState;
        expect(replayed.positions).toEqual(state.positions);
        expect(replayed.result).toEqual(state.result);
      }
    }
  });
});
