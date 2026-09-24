import type { Rng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Sand Fall (docs/games/sand-fall.md), a chill toy: pour colored sand into a jar and watch it
 * tumble and pile up in stripes. The falling sand is drawn by the scene, like the raking in Zen
 * Garden; the rules only count the pours and the shakes, and know when you are done.
 */
export const SAND_COLORS = 7;

/** `p3` pours color 3 (sent a few times a second while pouring); `shake` empties the jar; `done`. */
export type SandMove = string;

export class SandState implements GameState<SandMove> {
  readonly currentSeat: Seat = 0;

  constructor(
    readonly pours: number,
    readonly shakes: number,
    readonly last: SandMove | null,
    readonly result: GameResult | null,
  ) {}

  legalMoves(seat: Seat): readonly SandMove[] {
    if (this.result || seat !== 0) return [];
    return [...Array.from({ length: SAND_COLORS }, (_, i) => `p${i}`), 'shake', 'done'];
  }

  apply(move: SandMove): SandState {
    if (!this.legalMoves(0).includes(move)) throw new Error(`Illegal move: ${move}`);
    if (move === 'done') return new SandState(this.pours, this.shakes, move, { winners: [0], draw: false });
    if (move === 'shake') return new SandState(this.pours, this.shakes + 1, move, null);
    return new SandState(this.pours + 1, this.shakes, move, null);
  }
}

export const newSandFall = () => new SandState(0, 0, null, null);

/** Test play: pour a stripe of each color, then call it done. */
function createSandBot(): Bot<SandMove> {
  return {
    chooseMove(generic: GameState<SandMove>, _seat: Seat, _rng: Rng): SandMove {
      const s = generic as SandState;
      return s.pours < SAND_COLORS * 3 ? `p${Math.floor(s.pours / 3) % SAND_COLORS}` : 'done';
    },
  };
}

export const sandFall: GameDefinition<SandMove> = {
  id: 'sand-fall',
  name: 'Sand Fall',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo'],
  hiddenInfo: false,
  realtime: false,
  newGame: () => newSandFall(),
  createBot: () => createSandBot(),
  encodeMove: (move) => move,
};
