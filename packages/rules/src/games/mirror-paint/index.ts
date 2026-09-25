import type { Rng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Mirror Paint (docs/games/mirror-paint.md), a chill toy: paint and every stroke is copied round
 * the middle, mirrored into each slice. The paint is the scene's; the rules keep the settings and
 * count strokes, and it is done when you say.
 */
export const MIRROR_WAYS = [2, 4, 6, 8] as const;
export const MIRROR_COLORS = 7;
export const MIRROR_BRUSHES = [6, 12, 22] as const;

/** `w2` picks the third mirror, `k4` a color, `b1` a brush; `s` is a stroke; `clear`; `done`. */
export type MirrorMove = string;

export class MirrorState implements GameState<MirrorMove> {
  readonly currentSeat: Seat = 0;

  constructor(
    readonly ways: number,
    readonly color: number,
    readonly brush: number,
    readonly strokes: number,
    readonly last: MirrorMove | null,
    readonly result: GameResult | null,
  ) {}

  legalMoves(seat: Seat): readonly MirrorMove[] {
    if (this.result || seat !== 0) return [];
    const pick = (prefix: string, count: number, now: number) => Array.from({ length: count }, (_, i) => i).flatMap((i) => (i === now ? [] : [`${prefix}${i}`]));
    return [...pick('w', MIRROR_WAYS.length, this.ways), ...pick('k', MIRROR_COLORS, this.color), ...pick('b', MIRROR_BRUSHES.length, this.brush), 's', 'clear', 'done'];
  }

  apply(move: MirrorMove): MirrorState {
    if (!this.legalMoves(0).includes(move)) throw new Error(`Illegal move: ${move}`);
    const { ways, color, brush, strokes } = this;
    if (move === 'done') return new MirrorState(ways, color, brush, strokes, move, { winners: [0], draw: false });
    if (move === 's') return new MirrorState(ways, color, brush, strokes + 1, move, null);
    if (move === 'clear') return new MirrorState(ways, color, brush, strokes, move, null);
    const i = Number(move.slice(1));
    if (move[0] === 'w') return new MirrorState(i, color, brush, strokes, move, null);
    if (move[0] === 'k') return new MirrorState(ways, i, brush, strokes, move, null);
    return new MirrorState(ways, color, i, strokes, move, null);
  }
}

/** Six ways (the third choice), sky, the middle brush. */
export const newMirror = () => new MirrorState(2, 4, 1, 0, null, null);

/** Test play: a handful of strokes in a few colors, then done. */
function createMirrorBot(): Bot<MirrorMove> {
  return {
    chooseMove(generic: GameState<MirrorMove>, _seat: Seat, _rng: Rng): MirrorMove {
      const s = generic as MirrorState;
      if (s.strokes >= 8) return 'done';
      if (s.last === 's' && s.strokes % 2 === 0) return `k${(s.color + 2) % MIRROR_COLORS}`;
      return 's';
    },
  };
}

export const mirrorPaint: GameDefinition<MirrorMove> = {
  id: 'mirror-paint',
  name: 'Mirror Paint',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo'],
  hiddenInfo: false,
  realtime: false,
  newGame: () => newMirror(),
  createBot: () => createMirrorBot(),
  encodeMove: (move) => move,
};
