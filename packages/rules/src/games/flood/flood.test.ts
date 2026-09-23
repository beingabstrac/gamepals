import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import type { BotTier } from '../../core/types';
import { flood, FLOOD_IDLE_LIMIT, FLOOD_LEVELS, FLOOD_SIZES, floodPlan, FloodState, newFlood, sidesOf } from './index';

/** A board drawn by hand, one digit a colour. Solo boards own the corner's patch; duels own the corners. */
function boardOf(rows: string[], players = 1, limit = 30): FloodState {
  const size = rows.length;
  const colours = rows.join('').split('').map(Number);
  const owner = colours.map(() => -1);
  if (players === 1) {
    const stack = [0];
    owner[0] = 0;
    while (stack.length) {
      const at = stack.pop()!;
      for (const side of sidesOf(size, at)) {
        if (owner[side] === -1 && colours[side] === colours[0]) {
          owner[side] = 0;
          stack.push(side);
        }
      }
    }
  } else {
    owner[size * size - size] = 0;
    owner[size - 1] = 1;
  }
  return new FloodState('small', players, size, colours, owner, 0, 0, players === 1 ? limit : 0, 0, null, []);
}

/** Each seat's squares are one joined patch of one colour, and no free square of that colour touches it. */
function checkPatches(state: FloodState, where: string): void {
  for (let seat = 0; seat < state.players; seat++) {
    const mine = state.owner.flatMap((who, cell) => (who === seat ? [cell] : []));
    const colour = state.colourOf(seat);
    for (const cell of mine) expect(state.colours[cell], `${where}: seat ${seat} square ${cell} colour`).toBe(colour);
    const seen = new Set([state.home(seat)]);
    const stack = [state.home(seat)];
    while (stack.length) {
      for (const side of sidesOf(state.size, stack.pop()!)) {
        if (state.owner[side] === seat && !seen.has(side)) {
          seen.add(side);
          stack.push(side);
        }
        if (state.owner[side] === -1) expect(state.colours[side] === colour, `${where}: free square ${side} left beside seat ${seat}`).toBe(false);
      }
    }
    expect(seen.size, `${where}: seat ${seat} patch is joined`).toBe(mine.length);
  }
}

describe('flood', () => {
  it('floods every joined square of the new colour and stops at other colours', () => {
    const state = boardOf(['0011', '1122', '2221', '0001']);
    expect(state.held(0)).toBe(2);
    const next = state.apply('1');
    // The 1s beside the corner join, and the ones beyond them; the 1s in the bottom right do not touch.
    expect([...next.last].sort((a, b) => a - b)).toEqual([2, 3, 4, 5]);
    expect(next.held(0)).toBe(6);
    expect(next.colourOf(0)).toBe(1);
    checkPatches(next, 'after one move');
  });

  it('starts solo owning the whole joined corner, and the duel owning one square each', () => {
    for (const level of FLOOD_LEVELS) {
      for (let seed = 1; seed <= 20; seed++) {
        const solo = newFlood(seed, level, 1);
        checkPatches(solo, `solo ${level} seed ${seed}`);
        const duel = newFlood(seed, level, 2);
        expect(duel.held(0)).toBe(1);
        expect(duel.held(1)).toBe(1);
        expect(duel.colourOf(0)).not.toBe(duel.colourOf(1));
        for (let cell = 0; cell < duel.cells; cell++) {
          for (const side of sidesOf(duel.size, cell)) expect(duel.colours[side], `duel ${level} seed ${seed} square ${cell}`).not.toBe(duel.colours[cell]);
        }
      }
    }
  });

  it('lists every colour but your own, and in the duel not the other side’s either', () => {
    const solo = boardOf(['01', '23']);
    expect(solo.legalMoves(0)).toEqual(['1', '2', '3', '4', '5']);
    expect(solo.legalMoves(1)).toEqual([]);
    const duel = boardOf(['010', '232', '414'], 2);
    // Seat 0 is bottom left wearing 4, seat 1 top right wearing 0.
    expect(duel.legalMoves(0)).toEqual(['1', '2', '3', '5']);
    expect(duel.legalMoves(1)).toEqual([]);
    const after = duel.apply('1');
    expect(after.currentSeat).toBe(1);
    expect(after.legalMoves(1)).toEqual(['2', '3', '4', '5']);
  });

  it('throws on a barred colour, a wrong seat and a finished game', () => {
    const duel = boardOf(['010', '232', '414'], 2);
    expect(() => duel.apply('4')).toThrow();
    expect(() => duel.apply('0')).toThrow();
    expect(() => duel.apply('9')).toThrow();
    const won = boardOf(['01', '11']).apply('1');
    expect(won.result).toEqual({ winners: [0], draw: false });
    expect(() => won.apply('2')).toThrow();
  });

  it('wins solo with the whole board and loses on the last move without it', () => {
    const state = boardOf(['012', '120', '201'], 1, 2);
    const one = state.apply('1');
    expect(one.result).toBeNull();
    expect(one.movesLeft).toBe(1);
    const two = one.apply('2');
    expect(two.result).toEqual({ winners: [], draw: false });
    // The same board with room to finish.
    let roomy = boardOf(['012', '120', '201'], 1, 10);
    for (const move of floodPlan(roomy.size, roomy.colours, roomy.owner)) roomy = roomy.apply(String(move));
    expect(roomy.result).toEqual({ winners: [0], draw: false });
  });

  it('a wasted colour is allowed and costs a move', () => {
    const state = boardOf(['00', '01']);
    const wasted = state.apply('4');
    expect(wasted.last).toEqual([]);
    expect(wasted.moves).toBe(1);
    expect(wasted.held(0)).toBe(3);
  });

  it('ends a duel as soon as one side holds more than half, and an even fill is a draw', () => {
    // Bottom left takes the whole left column of 1s and more; 9 squares, so 5 wins.
    const duel = boardOf(['123', '121', '010'], 2);
    // Seat 0 wears 0 at bottom left, seat 1 wears 3 at top right.
    const a = duel.apply('1');
    expect(a.held(0)).toBe(4);
    expect(a.result).toBeNull();
    const b = a.apply('0');
    const c = b.apply('2');
    expect(c.held(0)).toBeGreaterThan(4);
    expect(c.result).toEqual({ winners: [0], draw: false });

    // Two by two: each side takes one free square and the board is full at two each.
    const even = boardOf(['01', '23'], 2).apply('0');
    expect(even.result).toBeNull();
    expect(even.apply('3').result).toEqual({ winners: [], draw: true });
  });

  it('ends a duel after twenty turns in a row that claim nothing', () => {
    // A lone corner square has two neighbours and four colours to pick from, so a colour that claims
    // nothing is always there while nobody has moved.
    let state = newFlood(1, 'small', 2);
    const idleMove = (s: FloodState) => s.legalMoves(s.currentSeat).find((m) => s.apply(m).last.length === 0);
    let turns = 0;
    while (!state.result) {
      const move = idleMove(state);
      if (!move) break;
      state = state.apply(move);
      turns++;
    }
    expect(turns).toBe(FLOOD_IDLE_LIMIT);
    expect(state.result).toEqual({ winners: [], draw: true });
  });

  it('replays a game from its move log', () => {
    for (const players of [1, 2]) {
      const rng = createRng(7);
      let state = flood.newGame({ players, variant: 'medium' }, 99) as FloodState;
      const moves: string[] = [];
      while (!state.result) {
        const move = rng.pick(state.legalMoves(state.currentSeat));
        moves.push(move);
        state = state.apply(move);
      }
      const log = toMoveLog(flood, { players, variant: 'medium' }, 99, moves);
      expect(replay(flood, log).result).toEqual(state.result);
    }
  });

  it('the autoplayer wins every board of every size inside its limit', { timeout: 120_000 }, () => {
    for (const level of FLOOD_LEVELS) {
      for (let seed = 1; seed <= 60; seed++) {
        let state = newFlood(seed, level, 1);
        expect(state.limit, `${level} seed ${seed}`).toBe(floodPlan(state.size, state.colours, state.owner).length + FLOOD_SIZES[level].spare);
        const bot = flood.createBot('medium');
        const rng = createRng(seed);
        while (!state.result) state = state.apply(bot.chooseMove(state, 0, rng)) as FloodState;
        expect(state.result, `${level} seed ${seed}`).toEqual({ winners: [0], draw: false });
        expect(state.movesLeft, `${level} seed ${seed}`).toBe(FLOOD_SIZES[level].spare);
      }
    }
  });

  it('bots only play legal colours, and Expert beats Easy in most duels', { timeout: 120_000 }, () => {
    const play = (a: BotTier, b: BotTier, seed: number) => {
      const bots = [flood.createBot(a), flood.createBot(b)];
      const rng = createRng(seed);
      let state = newFlood(seed, 'small', 2);
      while (!state.result) {
        const move = bots[state.currentSeat]!.chooseMove(state, state.currentSeat, rng);
        expect(state.legalMoves(state.currentSeat)).toContain(move);
        state = state.apply(move);
      }
      return state.result;
    };
    let expert = 0;
    const games = 20;
    for (let seed = 1; seed <= games; seed++) {
      // Swap seats every game so going first is not what decides it.
      const expertSeat = seed % 2;
      const result = expertSeat === 0 ? play('expert', 'easy', seed) : play('easy', 'expert', seed);
      if (result.winners.includes(expertSeat)) expert++;
    }
    expect(expert).toBeGreaterThanOrEqual(15);
  });
});

/**
 * Invariant: each player's squares are one joined patch of one colour with no free square of that
 * colour beside it, and a square once owned never changes hands.
 */
describe('flood invariants', () => {
  it('keeps every patch joined, one colour and complete, and never gives a square back', () => {
    for (const players of [1, 2]) {
      for (const level of FLOOD_LEVELS) {
        for (let seed = 0; seed < 8; seed++) {
          const rng = createRng(seed + 100);
          let state = newFlood(seed, level, players);
          for (let move = 0; move < 400 && !state.result; move++) {
            const before = [...state.owner];
            state = state.apply(rng.pick(state.legalMoves(state.currentSeat)));
            const where = `${players}p ${level} seed ${seed} move ${move}`;
            before.forEach((who, cell) => {
              if (who >= 0) expect(state.owner[cell], `${where} square ${cell}`).toBe(who);
            });
            checkPatches(state, where);
          }
        }
      }
    }
  });
});
