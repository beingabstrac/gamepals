import { createRng, type Rng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Pop It (docs/games/pop-it.md), a chill toy: a squashy sheet of bubbles in rainbow rows. Press
 * them all down, flip it over, and they are all up again on the other side. Both sides done and the
 * sheet is finished. Nothing to win or lose; it is there to fiddle with.
 */
export const POP_SHAPES: Readonly<Record<string, readonly string[]>> = {
  // Each row a string: 'o' a bubble, '.' nothing. Rows are rainbow bands, top to bottom.
  heart: ['.oo...oo.', 'oooo.oooo', 'ooooooooo', 'ooooooooo', '.ooooooo.', '..ooooo..', '...ooo...', '....o....'],
  star: ['....o....', '...ooo...', 'ooooooooo', '.ooooooo.', '..ooooo..', '.ooo.ooo.', 'oo.....oo'],
  circle: ['..ooooo..', '.ooooooo.', 'ooooooooo', 'ooooooooo', 'ooooooooo', '.ooooooo.', '..ooooo..'],
  square: ['oooooooo', 'oooooooo', 'oooooooo', 'oooooooo', 'oooooooo', 'oooooooo'],
};

export const POP_SHAPE_IDS = Object.keys(POP_SHAPES);

/** The bubble cells of a shape, as (col, row), in reading order. */
export function popCells(shape: string): { col: number; row: number }[] {
  const rows = POP_SHAPES[shape] ?? POP_SHAPES.heart!;
  return rows.flatMap((line, row) => [...line].flatMap((c, col) => (c === 'o' ? [{ col, row }] : [])));
}

/** `p<i>` presses bubble i down on the side facing up; `flip` turns the sheet over. */
export type PopMove = string;

export class PopState implements GameState<PopMove> {
  readonly currentSeat: Seat = 0;

  constructor(
    readonly shape: string,
    /** Which bubbles are pressed down on the side facing up. */
    readonly down: readonly boolean[],
    /** 0 the first side, 1 the second. */
    readonly side: number,
    readonly pops: number,
    readonly last: number | null,
    readonly result: GameResult | null,
  ) {}

  get allDown(): boolean {
    return this.down.every(Boolean);
  }

  legalMoves(seat: Seat): readonly PopMove[] {
    if (this.result || seat !== 0) return [];
    const moves = this.down.flatMap((d, i) => (d ? [] : [`p${i}`]));
    if (this.allDown) moves.push('flip');
    return moves;
  }

  apply(move: PopMove): PopState {
    if (!this.legalMoves(0).includes(move)) throw new Error(`Illegal move: ${move}`);
    if (move === 'flip') {
      // Turned over, every bubble is up again; the second side done finishes the sheet.
      return new PopState(this.shape, this.down.map(() => false), this.side + 1, this.pops, null, null);
    }
    const i = Number(move.slice(1));
    const down = this.down.slice();
    down[i] = true;
    const done = this.side === 1 && down.every(Boolean);
    return new PopState(this.shape, down, this.side, this.pops + 1, i, done ? { winners: [0], draw: false } : null);
  }
}

export function newPopIt(seed: number, shape?: string): PopState {
  const id = shape && POP_SHAPES[shape] ? shape : POP_SHAPE_IDS[createRng(seed).int(POP_SHAPE_IDS.length)]!;
  return new PopState(id, popCells(id).map(() => false), 0, 0, null, null);
}

/** Test play: press them in reading order, then flip. */
function createPopBot(): Bot<PopMove> {
  return {
    chooseMove(generic: GameState<PopMove>, _seat: Seat, _rng: Rng): PopMove {
      return (generic as PopState).legalMoves(0)[0]!;
    },
  };
}

export const popIt: GameDefinition<PopMove> = {
  id: 'pop-it',
  name: 'Pop It',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo'],
  hiddenInfo: false,
  realtime: false,
  newGame: (config, seed) => newPopIt(seed, config.variant),
  createBot: () => createPopBot(),
  encodeMove: (move) => move,
};
