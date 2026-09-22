import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import type { BotTier, GameState } from '../../core/types';
import { cellIndex, COLS, fourInARow, FourInARowState, ROWS, type FourInARowMove } from './index';

const config = { players: 2 };

function drop(columns: FourInARowMove[]): GameState<FourInARowMove> {
  return columns.reduce<GameState<FourInARowMove>>((state, col) => state.apply(col), fourInARow.newGame(config, 1));
}

function playBots(tiers: [BotTier, BotTier], seed: number): GameState<FourInARowMove> {
  const rng = createRng(seed);
  const bots = tiers.map((tier) => fourInARow.createBot(tier));
  let state = fourInARow.newGame(config, seed);
  while (!state.result) {
    const seat = state.currentSeat;
    state = state.apply(bots[seat]!.chooseMove(state, seat, rng));
  }
  return state;
}

describe('four-in-a-row rules', () => {
  it('starts with 7 open columns and seat 0 to move', () => {
    const state = fourInARow.newGame(config, 1);
    expect(state.currentSeat).toBe(0);
    expect([...state.legalMoves(0)].sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('detects a vertical win', () => {
    expect(drop([0, 1, 0, 1, 0, 1, 0]).result).toEqual({ winners: [0], draw: false });
  });

  it('detects a horizontal win', () => {
    expect(drop([0, 0, 1, 1, 2, 2, 3]).result).toEqual({ winners: [0], draw: false });
  });

  it('detects a rising diagonal win', () => {
    const state = drop([0, 1, 1, 2, 6, 2, 2, 3, 6, 3, 6, 3, 3]) as FourInARowState;
    expect(state.result).toEqual({ winners: [0], draw: false });
    expect(state.winLine).toHaveLength(4);
  });

  it('closes a full column', () => {
    const state = drop([0, 0, 0, 0, 0, 0]);
    expect(state.result).toBeNull();
    expect(state.legalMoves(state.currentSeat)).not.toContain(0);
    expect(() => state.apply(0)).toThrow();
    expect(() => state.apply(7)).toThrow();
  });

  it('replays a move log', () => {
    const moves = [3, 3, 2, 4, 1];
    const replayed = replay(fourInARow, toMoveLog(fourInARow, config, 1, moves)) as FourInARowState;
    expect(replayed.board).toEqual((drop(moves) as FourInARowState).board);
  });
});

describe('four-in-a-row bots', () => {
  it('takes an immediate win', () => {
    // Seat 0 has the bottom row 0–2; column 3 wins.
    const state = drop([0, 0, 1, 1, 2, 2]);
    for (const tier of ['hard', 'expert'] as const) {
      const rng = createRng(1);
      expect(fourInARow.createBot(tier).chooseMove(state, 0, rng)).toBe(3);
    }
  });

  it('blocks an immediate loss', () => {
    // Seat 1 has the bottom row 0–2; seat 0 must block column 3.
    const state = drop([6, 0, 6, 1, 5, 2]);
    const rng = createRng(1);
    expect(fourInARow.createBot('expert').chooseMove(state, 0, rng)).toBe(3);
  });

  it('expert does not lose to easy', { timeout: 120_000 }, () => {
    for (let seed = 0; seed < 2; seed++) {
      expect(playBots(['expert', 'easy'], seed).result?.winners).not.toContain(1);
      expect(playBots(['easy', 'expert'], seed).result?.winners).not.toContain(0);
    }
  });
});

/**
 * Gravity: a disc rests on the one below it or on the floor, and `heights` counts what is in each
 * column. A gallery picture showed a disc hanging over two empty cells, which turned out to be one
 * caught in mid-drop by a camera that could not see it was still falling. The board itself can say
 * whether that is ever true of the state, which the picture never could.
 */
describe('four in a row gravity', () => {
  it('never leaves a disc hanging, and heights always match the board', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = createRng(seed);
      let state = fourInARow.newGame({ players: 2 }, seed) as FourInARowState;
      for (let move = 0; move < 60 && !state.result; move++) {
        for (let col = 0; col < COLS; col++) {
          let filled = 0;
          let seenGap = false;
          for (let row = 0; row < ROWS; row++) {
            const here = state.board[cellIndex(col, row)];
            if (here === null) seenGap = true;
            else {
              filled++;
              expect(seenGap, `seed ${seed}, move ${move}: a disc hangs over a gap in column ${col}`).toBe(false);
            }
          }
          expect(state.heights[col], `seed ${seed}, move ${move}, column ${col}`).toBe(filled);
        }
        const moves = state.legalMoves(state.currentSeat);
        if (moves.length === 0) break;
        state = state.apply(rng.pick(moves)) as FourInARowState;
      }
    }
  });
});
