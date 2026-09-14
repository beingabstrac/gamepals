import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import type { BotTier } from '../../core/types';
import { echo, ECHO_GOALS, ECHO_PARTY_CAP, EchoState, newEcho, pressMove, TIMEOUT_MOVE, type EchoMove } from './index';

/** Repeat the current sequence correctly. */
const repeatAll = (state: EchoState) => state.sequence.slice(state.progress).reduce((s, pad) => s.apply(pressMove(pad)), state);

describe('echo solo', () => {
  it('starts with one step, and each finished round adds one step from the seed', () => {
    let state = newEcho(1, 5, 'classic');
    expect(state.sequence).toHaveLength(1);
    const first = state.sequence.slice();
    state = repeatAll(state);
    expect(state.sequence).toHaveLength(2);
    expect(state.sequence.slice(0, 1)).toEqual(first);
    expect(state.progress).toBe(0);
    expect(newEcho(1, 5, 'classic').sequence).toEqual(first);
  });

  it('a wrong press or running out of time ends the game', () => {
    const state = newEcho(1, 3, 'short');
    const wrong = (state.sequence[0]! + 1) % 4;
    expect(state.apply(pressMove(wrong)).result).toEqual({ winners: [], draw: false });
    expect(state.apply(TIMEOUT_MOVE).result).toEqual({ winners: [], draw: false });
  });

  it('reaching the goal wins', () => {
    let state = newEcho(1, 8, 'short');
    while (!state.result) state = repeatAll(state);
    expect(state.result).toEqual({ winners: [0], draw: false });
    expect(state.sequence).toHaveLength(ECHO_GOALS.short);
  });
});

describe('echo party', () => {
  it('each player repeats the sequence, then adds one step, and play passes on', () => {
    let state = newEcho(3, 1, 'classic');
    state = repeatAll(state);
    expect(state.phase).toBe('add');
    expect(state.currentSeat).toBe(0);
    state = state.apply(pressMove(2));
    expect(state.sequence).toHaveLength(2);
    expect(state.sequence[1]).toBe(2);
    expect(state.currentSeat).toBe(1);
    expect(state.phase).toBe('repeat');
  });

  it('a mistake knocks you out, and the last player in wins', () => {
    let state = newEcho(2, 1, 'classic');
    state = state.apply(TIMEOUT_MOVE);
    expect(state.result).toEqual({ winners: [1], draw: false });

    let three = newEcho(3, 1, 'classic');
    three = three.apply(pressMove((three.sequence[0]! + 1) % 4));
    expect(three.alive).toEqual([false, true, true]);
    expect(three.currentSeat).toBe(1);
    expect(three.result).toBeNull();
  });

  it('a party that reaches the cap is shared by everyone still in', () => {
    let state = newEcho(2, 2, 'classic');
    while (!state.result) state = repeatAll(state).apply(pressMove(0));
    expect(state.sequence).toHaveLength(ECHO_PARTY_CAP);
    expect(state.result).toEqual({ winners: [0, 1], draw: false });
  });

  it('rejects out-of-turn and unknown moves', () => {
    const state = newEcho(2, 1, 'classic');
    expect(state.legalMoves(1)).toEqual([]);
    expect(() => state.apply('p9')).toThrow();
  });
});

describe('echo bots', () => {
  function soloLength(tier: BotTier, seed: number): number {
    const bot = echo.createBot(tier);
    const rng = createRng(seed);
    let state = echo.newGame({ players: 1, variant: 'marathon' }, seed) as EchoState;
    while (!state.result) state = state.apply(bot.chooseMove(state, 0, rng));
    return state.result.winners.length ? state.sequence.length : state.sequence.length - 1;
  }

  it('Nova lasts longer than Pip', () => {
    let nova = 0;
    let pip = 0;
    for (let seed = 0; seed < 30; seed++) {
      nova += soloLength('expert', seed);
      pip += soloLength('easy', seed);
    }
    expect(nova).toBeGreaterThan(pip * 1.5);
  });

  it('party bots press legal pads, and games replay exactly', () => {
    const tiers: BotTier[] = ['easy', 'medium', 'hard', 'expert'];
    const bots = tiers.map((tier) => echo.createBot(tier));
    const rng = createRng(4);
    let state = echo.newGame({ players: 4, variant: 'classic' }, 4) as EchoState;
    const moves: EchoMove[] = [];
    while (!state.result) {
      const move = bots[state.currentSeat]!.chooseMove(state, state.currentSeat, rng);
      expect(state.legalMoves(state.currentSeat)).toContain(move);
      moves.push(move);
      state = state.apply(move);
    }
    const replayed = replay(echo, toMoveLog(echo, { players: 4, variant: 'classic' }, 4, moves)) as EchoState;
    expect(replayed.sequence).toEqual(state.sequence);
    expect(replayed.result).toEqual(state.result);
  });
});
