import { createRng, type Rng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Pointers (docs/games/pointers.md): a grid of arrows. Tap one and it flies off the board the way
 * it points, if nothing is in its way. If something is, it bumps and you lose a life. Clear every
 * arrow to win. Boards are built by placing arrows one at a time, each only where its road out is
 * clear, so taking them off in the reverse order always works: every board can be cleared.
 */
export const POINTER_SIZES: Readonly<Record<string, number>> = { small: 5, medium: 7, large: 9 };
export const POINTER_LIVES = 3;
/** 0 up, 1 right, 2 down, 3 left. */
export const POINTER_DIRS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/** `t<cell>` taps the arrow there. */
export type PointerMove = string;

export class PointerState implements GameState<PointerMove> {
  readonly currentSeat: Seat = 0;

  constructor(
    readonly size: number,
    /** The direction of the arrow on each cell, or -1. */
    readonly arrows: readonly number[],
    readonly lives: number,
    readonly last: { cell: number; out: boolean } | null,
    readonly result: GameResult | null,
  ) {}

  /** Whether the arrow on `cell` has a clear road off the board. */
  clear(cell: number): boolean {
    const dir = this.arrows[cell]!;
    if (dir < 0) return false;
    const [dx, dy] = POINTER_DIRS[dir]!;
    let x = (cell % this.size) + dx;
    let y = Math.floor(cell / this.size) + dy;
    while (x >= 0 && y >= 0 && x < this.size && y < this.size) {
      if (this.arrows[y * this.size + x]! >= 0) return false;
      x += dx;
      y += dy;
    }
    return true;
  }

  get left(): number {
    return this.arrows.filter((a) => a >= 0).length;
  }

  legalMoves(seat: Seat): readonly PointerMove[] {
    if (this.result || seat !== 0) return [];
    return this.arrows.flatMap((a, i) => (a >= 0 ? [`t${i}`] : []));
  }

  apply(move: PointerMove): PointerState {
    if (!this.legalMoves(0).includes(move)) throw new Error(`Illegal move: ${move}`);
    const cell = Number(move.slice(1));
    if (!this.clear(cell)) {
      const lives = this.lives - 1;
      return new PointerState(this.size, this.arrows, lives, { cell, out: false }, lives <= 0 ? { winners: [], draw: false } : null);
    }
    const arrows = this.arrows.slice();
    arrows[cell] = -1;
    const done = arrows.every((a) => a < 0);
    return new PointerState(this.size, arrows, this.lives, { cell, out: true }, done ? { winners: [0], draw: false } : null);
  }
}

/** A board of arrows, about two thirds full, built so it can always be cleared. */
export function dealPointers(seed: number, size: number): number[] {
  const rng = createRng(seed);
  const arrows = Array<number>(size * size).fill(-1);
  const state = () => new PointerState(size, arrows, POINTER_LIVES, null, null);
  const target = Math.round(size * size * 0.68);
  let placed = 0;
  for (let tries = 0; placed < target && tries < size * size * 40; tries++) {
    const cell = rng.int(size * size);
    if (arrows[cell]! >= 0) continue;
    const dirs = [0, 1, 2, 3].filter((d) => {
      arrows[cell] = d;
      const ok = state().clear(cell);
      arrows[cell] = -1;
      return ok;
    });
    if (!dirs.length) continue;
    arrows[cell] = rng.pick(dirs);
    placed++;
  }
  return arrows;
}

export function newPointers(seed: number, level = 'small'): PointerState {
  const size = POINTER_SIZES[level] ?? 5;
  return new PointerState(size, dealPointers(seed, size), POINTER_LIVES, null, null);
}

/** Test play: tap any arrow with a clear road. */
function createPointerBot(): Bot<PointerMove> {
  return {
    chooseMove(generic: GameState<PointerMove>, _seat: Seat, rng: Rng): PointerMove {
      const s = generic as PointerState;
      const free = s.arrows.flatMap((a, i) => (a >= 0 && s.clear(i) ? [i] : []));
      return `t${free.length ? rng.pick(free) : s.arrows.findIndex((a) => a >= 0)}`;
    },
  };
}

export const pointers: GameDefinition<PointerMove> = {
  id: 'pointers',
  name: 'Pointers',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo', 'race'],
  hiddenInfo: false,
  realtime: false,
  newGame: (config, seed) => newPointers(seed, config.variant ?? 'small'),
  createBot: () => createPointerBot(),
  encodeMove: (move) => move,
};
