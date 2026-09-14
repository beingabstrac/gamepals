import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import type { BotTier } from '../../core/types';
import { discOf, flipsFor, newReversi, placeDisc, REVERSI_EMPTY as E, REVERSI_PASS, reversi, ReversiState, type ReversiMove } from './index';

const sq = (r: number, c: number) => r * 8 + c;
const D = discOf(0);
const L = discOf(1);
function board(discs: [number, number, number][]): number[] {
  const b = Array<number>(64).fill(E);
  for (const [r, c, disc] of discs) b[sq(r, c)] = disc;
  return b;
}

describe('reversi setup', () => {
  it('starts with four crossed discs and dark to move with 4 moves', () => {
    const state = newReversi();
    expect(state.count(0)).toBe(2);
    expect(state.count(1)).toBe(2);
    expect(state.board[sq(3, 4)]).toBe(D);
    expect(state.board[sq(4, 3)]).toBe(D);
    expect([...state.legalMoves(0)].sort()).toEqual([placeDisc(sq(2, 3)), placeDisc(sq(3, 2)), placeDisc(sq(4, 5)), placeDisc(sq(5, 4))].sort());
    expect(state.legalMoves(1)).toEqual([]);
  });
});

describe('reversi rules', () => {
  it('a move flips the trapped line, and only up to your own disc', () => {
    const state = newReversi().apply(placeDisc(sq(2, 3)));
    expect(state.board[sq(3, 3)]).toBe(D);
    expect(state.last?.flipped).toEqual([sq(3, 3)]);
    expect(state.count(0)).toBe(4);
    expect(state.count(1)).toBe(1);
  });

  it('flips in several directions at once', () => {
    // Dark plays the corner (0,0): light lines run right and down toward dark discs.
    const b = board([[0, 1, L], [0, 2, D], [1, 0, L], [2, 0, D], [1, 1, L], [2, 2, D]]);
    const flips = flipsFor(b, sq(0, 0), 0).sort((x, y) => x - y);
    expect(flips).toEqual([sq(0, 1), sq(1, 0), sq(1, 1)].sort((x, y) => x - y));
  });

  it('a square that flips nothing is not a move', () => {
    const state = newReversi();
    expect(state.legalMoves(0)).not.toContain(placeDisc(sq(0, 0)));
    expect(() => state.apply(placeDisc(sq(0, 0)))).toThrow();
  });

  it('with no legal move you must pass, and play passes on', () => {
    // Light has no move (dark has the only discs but can still move through the light one).
    const b = board([[0, 0, D], [0, 1, L], [7, 7, D]]);
    const lightStuck = new ReversiState(b, 1, null, null);
    expect(lightStuck.legalMoves(1)).toEqual([REVERSI_PASS]);
    const after = lightStuck.apply(REVERSI_PASS);
    expect(after.currentSeat).toBe(0);
    expect(after.last).toEqual({ seat: 1, square: null, flipped: [] });
  });

  it('the game ends when neither side can move; most discs wins', () => {
    // Dark takes the last light disc: nobody can move after that.
    const b = board([[0, 0, D], [0, 1, L]]);
    const state = new ReversiState(b, 0, null, null);
    const after = state.apply(placeDisc(sq(0, 2)));
    expect(after.result).toEqual({ winners: [0], draw: false });
  });

  it('equal counts at the end are a draw', () => {
    // Dark takes the last light disc at the top: 3 dark there, 3 stranded light at the bottom, and
    // neither side can trap anything, so the game ends 3 to 3.
    const b = board([[0, 0, D], [0, 1, L], [7, 5, L], [7, 6, L], [7, 7, L]]);
    const after = new ReversiState(b, 0, null, null).apply(placeDisc(sq(0, 2)));
    expect(after.count(0)).toBe(3);
    expect(after.count(1)).toBe(3);
    expect(after.result).toEqual({ winners: [], draw: true });
  });
});

describe('reversi bots', () => {
  function playBots(tiers: [BotTier, BotTier], seed: number) {
    const rng = createRng(seed);
    const bots = tiers.map((tier) => reversi.createBot(tier));
    let state = reversi.newGame({ players: 2 }, seed) as ReversiState;
    const moves: ReversiMove[] = [];
    while (!state.result && moves.length < 200) {
      const move = bots[state.currentSeat]!.chooseMove(state, state.currentSeat, rng);
      expect(state.legalMoves(state.currentSeat)).toContain(move);
      moves.push(move);
      state = state.apply(move);
    }
    return { state, moves };
  }

  it('play legal moves to the end and replay exactly', () => {
    const { state, moves } = playBots(['easy', 'medium'], 5);
    expect(state.result).not.toBeNull();
    const replayed = replay(reversi, toMoveLog(reversi, { players: 2 }, 5, moves)) as ReversiState;
    expect(replayed.board).toEqual(state.board);
    expect(replayed.result).toEqual(state.result);
  });

  it('Zed (4 ahead, counts mobility) beats Pip most of the time', { timeout: 120_000 }, () => {
    let zedWins = 0;
    for (let seed = 0; seed < 8; seed++) {
      const zed = seed % 2;
      const tiers: [BotTier, BotTier] = zed === 0 ? ['hard', 'easy'] : ['easy', 'hard'];
      if (playBots(tiers, seed).state.result?.winners.includes(zed)) zedWins++;
    }
    expect(zedWins).toBeGreaterThanOrEqual(6);
  });
});
