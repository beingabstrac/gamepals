import { describe, expect, it } from 'vitest';
import { isLegalMove, moveFor } from './moves';
import type { GameDefinition, GameState } from './types';

/** A game with one move, a number from 1 to a million, too many to list: only even numbers are taken. */
class Big implements GameState<number> {
  readonly currentSeat = 0;
  readonly result = null;
  legalMoves(): readonly number[] {
    return [2, 4];
  }
  allows(move: number): boolean {
    return Number.isInteger(move) && move >= 1 && move <= 1_000_000 && move % 2 === 0;
  }
  apply(): GameState<number> {
    return this;
  }
}

/** The same shape of game with no `allows`: its list is the whole truth. */
class Small implements GameState<number> {
  readonly currentSeat = 0;
  readonly result = null;
  legalMoves(): readonly number[] {
    return [2, 4];
  }
  apply(): GameState<number> {
    return this;
  }
}

const definition = (state: GameState<number>, decode: boolean): GameDefinition<number> => ({
  id: 'x',
  name: 'x',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo'],
  hiddenInfo: false,
  realtime: false,
  newGame: () => state,
  createBot: () => ({ chooseMove: () => 2 }),
  encodeMove: (move) => String(move),
  ...(decode ? { decodeMove: (key: string) => (/^\d+$/.test(key) ? Number(key) : null) } : {}),
});

describe('moves', () => {
  it('asks allows when a game answers it, and the list when it does not', () => {
    const big = new Big();
    expect(moveFor(definition(big, true), big, '777778')).toBe(777778);
    expect(moveFor(definition(big, true), big, '777777')).toBeUndefined();
    expect(moveFor(definition(big, true), big, 'nope')).toBeUndefined();
    expect(isLegalMove(big, 999_998)).toBe(true);
    expect(isLegalMove(big, 3)).toBe(false);

    const small = new Small();
    expect(moveFor(definition(small, false), small, '4')).toBe(4);
    expect(moveFor(definition(small, false), small, '6')).toBeUndefined();
    expect(isLegalMove(small, 6)).toBe(false);
  });
});
