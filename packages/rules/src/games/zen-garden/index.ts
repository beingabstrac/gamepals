import type { Rng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Zen Garden (docs/games/zen-garden.md), a chill toy: rake patterns into a tray of sand and set
 * stones in it. The raking is drawn by the scene, like a drawing; the rules keep the stones, which
 * sit on a grid, and the moment you say it is done.
 */
export const ZEN_COLS = 6;
export const ZEN_ROWS = 8;
export const ZEN_STONES = 7;

/** `s<cell>` sets a stone there or lifts it; `done` finishes the garden. */
export type ZenMove = string;

export class ZenState implements GameState<ZenMove> {
  readonly currentSeat: Seat = 0;

  constructor(
    /** Which stone (0–6, each its own shape) sits on each cell, or -1. */
    readonly stones: readonly number[],
    readonly next: number,
    readonly last: number | null,
    readonly result: GameResult | null,
  ) {}

  get count(): number {
    return this.stones.filter((s) => s >= 0).length;
  }

  legalMoves(seat: Seat): readonly ZenMove[] {
    if (this.result || seat !== 0) return [];
    const moves = this.stones.flatMap((s, i) => (s >= 0 || this.count < ZEN_STONES ? [`s${i}`] : []));
    moves.push('done');
    return moves;
  }

  apply(move: ZenMove): ZenState {
    if (!this.legalMoves(0).includes(move)) throw new Error(`Illegal move: ${move}`);
    if (move === 'done') return new ZenState(this.stones, this.next, null, { winners: [0], draw: false });
    const i = Number(move.slice(1));
    const stones = this.stones.slice();
    if (stones[i]! >= 0) {
      stones[i] = -1;
      return new ZenState(stones, this.next, i, null);
    }
    stones[i] = this.next % ZEN_STONES;
    return new ZenState(stones, this.next + 1, i, null);
  }
}

export function newZen(): ZenState {
  return new ZenState(Array<number>(ZEN_COLS * ZEN_ROWS).fill(-1), 0, null, null);
}

/** Test play: set three stones in a loose triangle, then call it done. */
function createZenBot(): Bot<ZenMove> {
  return {
    chooseMove(generic: GameState<ZenMove>, _seat: Seat, _rng: Rng): ZenMove {
      const s = generic as ZenState;
      const plan = [13, 22, 34];
      const todo = plan.find((c) => s.stones[c]! < 0);
      return todo !== undefined ? `s${todo}` : 'done';
    },
  };
}

export const zenGarden: GameDefinition<ZenMove> = {
  id: 'zen-garden',
  name: 'Zen Garden',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo'],
  hiddenInfo: false,
  realtime: false,
  newGame: () => newZen(),
  createBot: () => createZenBot(),
  encodeMove: (move) => move,
};
