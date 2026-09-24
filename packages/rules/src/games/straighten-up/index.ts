import { createRng, type Rng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Straighten Up (docs/games/straighten-up.md), a chill toy: a wall of picture frames, every one
 * hanging crooked. Turn each until it is level; within a degree it clicks straight. When the
 * whole wall is straight, it is done.
 */
export type WallSize = 'small' | 'medium' | 'large';
export const WALL_FRAMES: Record<WallSize, number> = { small: 3, medium: 5, large: 7 };
/** How far a frame can be turned either way, in degrees, and how close to level counts as level. */
export const TILT_MAX = 30;
export const LEVEL = 1;

/** `r2.-4` turns frame 2 to four degrees anticlockwise. */
export type StraightenMove = string;

export const turnMove = (frame: number, deg: number): StraightenMove => `r${frame}.${Math.round(deg)}`;

export class StraightenState implements GameState<StraightenMove> {
  readonly currentSeat: Seat = 0;

  constructor(
    readonly tilts: readonly number[],
    /** Which little picture each frame holds. */
    readonly pictures: readonly number[],
    readonly turns: number,
    readonly last: number | null,
    readonly result: GameResult | null,
  ) {}

  get straight(): number {
    return this.tilts.filter((t) => Math.abs(t) <= LEVEL).length;
  }

  legalMoves(seat: Seat): readonly StraightenMove[] {
    if (this.result || seat !== 0) return [];
    const out: StraightenMove[] = [];
    this.tilts.forEach((t, i) => {
      for (let d = -TILT_MAX; d <= TILT_MAX; d++) if (d !== t) out.push(turnMove(i, d));
    });
    return out;
  }

  apply(move: StraightenMove): StraightenState {
    if (!this.legalMoves(0).includes(move)) throw new Error(`Illegal move: ${move}`);
    const [i, d] = move.slice(1).split('.').map(Number) as [number, number];
    // Within a degree of level it clicks straight.
    const tilts = this.tilts.map((t, k) => (k === i ? (Math.abs(d) <= LEVEL ? 0 : d) : t));
    const done = tilts.every((t) => t === 0);
    return new StraightenState(tilts, this.pictures, this.turns + 1, i, done ? { winners: [0], draw: false } : null);
  }
}

export function newStraighten(seed: number, size: WallSize = 'small'): StraightenState {
  const rng = createRng(seed >>> 0);
  const n = WALL_FRAMES[size];
  // Every frame starts properly crooked: at least six degrees off, either way.
  const tilts = Array.from({ length: n }, () => (6 + rng.int(TILT_MAX - 10)) * (rng.next() < 0.5 ? -1 : 1));
  const pictures = Array.from({ length: n }, (_, i) => (i + rng.int(8)) % 8);
  return new StraightenState(tilts, pictures, 0, null, null);
}

/** Test play: straighten the frames one by one, nudging each a little way first. */
function createStraightenBot(): Bot<StraightenMove> {
  return {
    chooseMove(generic: GameState<StraightenMove>, _seat: Seat, _rng: Rng): StraightenMove {
      const s = generic as StraightenState;
      const i = s.tilts.findIndex((t) => t !== 0);
      const t = s.tilts[i]!;
      return turnMove(i, Math.abs(t) > 6 ? Math.round(t / 2) : 0);
    },
  };
}

export const straightenUp: GameDefinition<StraightenMove> = {
  id: 'straighten-up',
  name: 'Straighten Up',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo'],
  hiddenInfo: false,
  realtime: false,
  newGame: (config, seed) => newStraighten(seed, (config.variant as WallSize | undefined) ?? 'small'),
  createBot: () => createStraightenBot(),
  encodeMove: (move) => move,
};
