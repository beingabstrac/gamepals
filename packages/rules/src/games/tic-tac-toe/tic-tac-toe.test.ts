import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import type { BotTier, GameState } from '../../core/types';
import { ticTacToe, TicTacToeState, type TicTacToeMove } from './index';

const config = { players: 2 };

function play(moves: TicTacToeMove[]): GameState<TicTacToeMove> {
  return moves.reduce<GameState<TicTacToeMove>>((state, move) => state.apply(move), ticTacToe.newGame(config, 1));
}

function playBots(tiers: [BotTier, BotTier], seed: number): GameState<TicTacToeMove> {
  const rng = createRng(seed);
  const bots = tiers.map((tier) => ticTacToe.createBot(tier));
  let state = ticTacToe.newGame(config, seed);
  while (!state.result) {
    const seat = state.currentSeat;
    state = state.apply(bots[seat]!.chooseMove(state, seat, rng));
  }
  return state;
}

describe('tic-tac-toe rules', () => {
  it('starts empty with X (seat 0) to move', () => {
    const state = ticTacToe.newGame(config, 1);
    expect(state.currentSeat).toBe(0);
    expect(state.legalMoves(0)).toHaveLength(9);
    expect(state.legalMoves(1)).toHaveLength(0);
  });

  it('detects a row win', () => {
    expect(play([0, 3, 1, 4, 2]).result).toEqual({ winners: [0], draw: false });
  });

  it('detects a diagonal win for O', () => {
    expect(play([1, 0, 2, 4, 3, 8]).result).toEqual({ winners: [1], draw: false });
  });

  it('detects a draw', () => {
    expect(play([0, 1, 2, 4, 3, 5, 7, 6, 8]).result).toEqual({ winners: [], draw: true });
  });

  it('rejects illegal moves', () => {
    const state = play([4]);
    expect(() => state.apply(4)).toThrow();
    expect(() => state.apply(9)).toThrow();
    expect(() => state.apply(1.5)).toThrow();
    expect(() => play([0, 3, 1, 4, 2]).apply(5)).toThrow();
  });

  it('never mutates the previous state', () => {
    const before = ticTacToe.newGame(config, 1) as TicTacToeState;
    before.apply(0);
    expect(before.board.every((cell) => cell === null)).toBe(true);
  });

  it('replays a move log to the same position', () => {
    const moves = [4, 0, 8, 2, 1];
    const log = toMoveLog(ticTacToe, config, 1, moves);
    const replayed = replay(ticTacToe, log) as TicTacToeState;
    expect(replayed.board).toEqual((play(moves) as TicTacToeState).board);
    expect(() => replay(ticTacToe, { ...log, moves: ['4', '4'] })).toThrow(/illegal/);
  });
});

describe('tic-tac-toe bots', () => {
  it('expert vs expert always draws', () => {
    for (let seed = 0; seed < 20; seed++) {
      expect(playBots(['expert', 'expert'], seed).result?.draw).toBe(true);
    }
  });

  it('expert never loses to easy, from either seat', { timeout: 120_000 }, () => {
    for (let seed = 0; seed < 100; seed++) {
      expect(playBots(['expert', 'easy'], seed).result?.winners).not.toContain(1);
      expect(playBots(['easy', 'expert'], seed).result?.winners).not.toContain(0);
    }
  });

  it('expert beats easy regularly', { timeout: 120_000 }, () => {
    let wins = 0;
    for (let seed = 0; seed < 100; seed++) {
      if (playBots(['expert', 'easy'], seed).result?.winners.includes(0)) wins++;
    }
    expect(wins).toBeGreaterThan(25);
  });

  it('takes an immediate win at every tier above easy', () => {
    // X at 0 and 1, O at 3 and 4, X to move: 2 wins.
    const state = play([0, 3, 1, 4]);
    for (const tier of ['medium', 'hard', 'expert'] as const) {
      const rng = createRng(0);
      const bot = ticTacToe.createBot(tier);
      // Lower tiers sometimes play randomly on purpose; require the win in most samples.
      let wins = 0;
      for (let i = 0; i < 20; i++) if (bot.chooseMove(state, 0, rng) === 2) wins++;
      expect(wins).toBeGreaterThanOrEqual(tier === 'expert' ? 20 : 14);
    }
  });
});
