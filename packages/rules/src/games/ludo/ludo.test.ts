import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import type { BotTier } from '../../core/types';
import { dieValue, HOME, ludo, LudoState, YARD, type LudoMove } from './index';

const Y = YARD;

/** Two-player state (seat 0 = red, seat 1 = yellow) waiting for seat 0 to move with `dice`. */
function twoPlayer(tokens: number[][], dice: number): LudoState {
  return new LudoState(2, 1, tokens, 0, 'move', dice, 1, null, null);
}

function playBots(tiers: BotTier[], seed: number): { state: LudoState; moves: LudoMove[] } {
  const rng = createRng(seed);
  const bots = tiers.map((tier) => ludo.createBot(tier));
  let state = ludo.newGame({ players: tiers.length }, seed) as LudoState;
  const moves: LudoMove[] = [];
  while (!state.result) {
    if (moves.length > 5000) throw new Error('Game did not finish');
    const seat = state.currentSeat;
    const move = bots[seat]!.chooseMove(state, seat, rng);
    expect(state.legalMoves(seat)).toContain(move);
    state = state.apply(move);
    moves.push(move);
  }
  return { state, moves };
}

describe('ludo rules', () => {
  it('starts with every token in the yard and seat 0 to roll', () => {
    const state = ludo.newGame({ players: 4 }, 7) as LudoState;
    expect(state.tokens).toEqual(Array.from({ length: 4 }, () => [Y, Y, Y, Y]));
    expect(state.legalMoves(0)).toEqual(['roll']);
    expect(state.legalMoves(1)).toEqual([]);
  });

  it('only allows 2–4 players', () => {
    expect(() => ludo.newGame({ players: 1 }, 1)).toThrow();
    expect(() => ludo.newGame({ players: 5 }, 1)).toThrow();
  });

  it('rolls fair, seed-determined dice', () => {
    const counts = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 6000; i++) counts[dieValue(42, i) - 1]!++;
    for (const count of counts) expect(Math.abs(count - 1000)).toBeLessThan(150);
    expect(dieValue(42, 3)).toBe(dieValue(42, 3));
  });

  it('passes the turn when a roll leaves no legal move', () => {
    let seed = 0;
    while (dieValue(seed, 0) === 6) seed++;
    const after = (ludo.newGame({ players: 2 }, seed) as LudoState).apply('roll');
    expect(after.currentSeat).toBe(1);
    expect(after.phase).toBe('roll');
  });

  it('needs a six to leave the yard, and a six rolls again', () => {
    const state = twoPlayer([[Y, Y, Y, Y], [Y, Y, Y, Y]], 6);
    expect(state.legalMoves(0)).toEqual([0, 1, 2, 3]);
    const after = state.apply(0);
    expect(after.tokens[0]).toEqual([0, Y, Y, Y]);
    expect(after.currentSeat).toBe(0);
    expect(after.phase).toBe('roll');
    expect(twoPlayer([[Y, Y, Y, Y], [Y, Y, Y, Y]], 5).legalMoves(0)).toEqual([]);
  });

  it('captures a token on an unsafe square and earns another roll', () => {
    // Red token 3 → 5 (square 5). Yellow token at progress 31 is also on square 5.
    const after = twoPlayer([[3, Y, Y, Y], [31, Y, Y, Y]], 2).apply(0);
    expect(after.tokens[1]![0]).toBe(Y);
    expect(after.lastEvent?.captured).toEqual([{ seat: 1, token: 0, from: 31 }]);
    expect(after.currentSeat).toBe(0);
  });

  it('never captures on a safe square', () => {
    // Red token 6 → 8 (star square 8). Yellow token at progress 34 is also on square 8.
    const after = twoPlayer([[6, Y, Y, Y], [34, Y, Y, Y]], 2).apply(0);
    expect(after.tokens[1]![0]).toBe(34);
    expect(after.currentSeat).toBe(1);
  });

  it('needs an exact roll to reach home', () => {
    expect(twoPlayer([[53, HOME, HOME, HOME], [Y, Y, Y, Y]], 4).legalMoves(0)).toEqual([]);
    const after = twoPlayer([[53, Y, Y, Y], [Y, Y, Y, Y]], 3).apply(0);
    expect(after.tokens[0]![0]).toBe(HOME);
    expect(after.currentSeat).toBe(0);
  });

  it('wins when all four tokens are home', () => {
    const after = twoPlayer([[HOME, HOME, HOME, 53], [Y, Y, Y, Y]], 3).apply(3);
    expect(after.result).toEqual({ winners: [0], draw: false });
  });

  it('a third six in a row ends the turn without moving', () => {
    // Find a seed whose first roll is a 6, then pretend two sixes were already rolled this turn.
    let seed = 0;
    while (dieValue(seed, 0) !== 6) seed++;
    const twoSixes = new LudoState(2, seed, [[0, Y, Y, Y], [Y, Y, Y, Y]], 0, 'roll', 6, 0, null, null, 2);
    const after = twoSixes.apply('roll');
    expect(after.currentSeat).toBe(1);
    expect(after.phase).toBe('roll');
    expect(after.tokens[0]).toEqual([0, Y, Y, Y]);
    expect(after.threeSixes).toBe(true);
    // The next roll clears the flag.
    expect(after.apply('roll').threeSixes).toBe(false);
  });

  it('rejects out-of-turn and illegal actions', () => {
    const state = twoPlayer([[3, Y, Y, Y], [Y, Y, Y, Y]], 2);
    expect(() => state.apply('roll')).toThrow();
    expect(() => state.apply(1)).toThrow();
    expect(() => state.apply(9)).toThrow();
  });
});

describe('ludo bots', () => {
  it('play complete 2–4 player games with only legal moves, and replay exactly', () => {
    for (const players of [2, 3, 4]) {
      const tiers = (['easy', 'medium', 'hard', 'expert'] as const).slice(0, players);
      const { state, moves } = playBots([...tiers], players * 11);
      const replayed = replay(ludo, toMoveLog(ludo, { players }, players * 11, moves)) as LudoState;
      expect(replayed.tokens).toEqual(state.tokens);
      expect(replayed.result).toEqual(state.result);
    }
  });

  it('expert beats easy most of the time', () => {
    let expertWins = 0;
    const games = 60;
    for (let seed = 0; seed < games; seed++) {
      const expertSeat = seed % 2;
      const tiers: BotTier[] = expertSeat === 0 ? ['expert', 'easy'] : ['easy', 'expert'];
      if (playBots(tiers, seed).state.result?.winners[0] === expertSeat) expertWins++;
    }
    expect(expertWins).toBeGreaterThan(games * 0.55);
  });
});
