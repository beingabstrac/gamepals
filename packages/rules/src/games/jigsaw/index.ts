import type { Rng } from '../../core/rng';
import { createRng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/** Jigsaw: a picture cut into pieces and put back (docs/games/jigsaw.md). */
export type JigsawLevel = 'easy' | 'medium' | 'hard';
export const JIGSAW_LEVELS: readonly JigsawLevel[] = ['easy', 'medium', 'hard'];

/** Pieces across and down: 12, 20 and 35, as small as a thumb can place with care. */
export const JIGSAW_SIZES: Record<JigsawLevel, { readonly cols: number; readonly rows: number }> = {
  easy: { cols: 4, rows: 3 },
  medium: { cols: 5, rows: 4 },
  hard: { cols: 7, rows: 5 },
};

/** How many pictures there are to cut; the scene draws them. */
export const JIGSAW_PICTURES = 8;

/** Put piece `index` in its place. */
export type JigsawMove = string;
export const placePieceMove = (piece: number): JigsawMove => `p${piece}`;

/** A side of a piece: a knob sticking out (1), a hole (-1), or flat on the outside (0). */
export type Side = -1 | 0 | 1;

export interface PieceSides {
  readonly top: Side;
  readonly right: Side;
  readonly bottom: Side;
  readonly left: Side;
}

export class JigsawState implements GameState<JigsawMove> {
  readonly currentSeat: Seat = 0;

  constructor(
    readonly level: JigsawLevel,
    readonly cols: number,
    readonly rows: number,
    readonly picture: number,
    /** The side each piece shows to its right-hand neighbour; the neighbour gets the opposite. */
    readonly rightJoins: readonly Side[],
    /** The side each piece shows to the piece below it. */
    readonly bottomJoins: readonly Side[],
    /** Pieces in the tray's order, shuffled from the seed. */
    readonly trayOrder: readonly number[],
    readonly placed: readonly boolean[],
    readonly result: GameResult | null,
    /** The piece the last move put in. */
    readonly last: number | null,
  ) {}

  get pieces(): number {
    return this.cols * this.rows;
  }

  get left(): number {
    return this.placed.filter((done) => !done).length;
  }

  sides(piece: number): PieceSides {
    const col = piece % this.cols;
    const row = Math.floor(piece / this.cols);
    const flip = (side: Side): Side => (side === 0 ? 0 : (-side as Side));
    return {
      top: row === 0 ? 0 : flip(this.bottomJoins[piece - this.cols]!),
      right: this.rightJoins[piece]!,
      bottom: this.bottomJoins[piece]!,
      left: col === 0 ? 0 : flip(this.rightJoins[piece - 1]!),
    };
  }

  /** A piece with a flat side: a corner or an edge. */
  isEdge(piece: number): boolean {
    const s = this.sides(piece);
    return s.top === 0 || s.right === 0 || s.bottom === 0 || s.left === 0;
  }

  legalMoves(seat: Seat): readonly JigsawMove[] {
    if (this.result || seat !== 0) return [];
    return this.placed.flatMap((done, piece) => (done ? [] : [placePieceMove(piece)]));
  }

  apply(move: JigsawMove): JigsawState {
    if (this.result) throw new Error('Game is over');
    if (!this.legalMoves(0).includes(move)) throw new Error(`Illegal move: ${move}`);
    const piece = Number(move.slice(1));
    const placed = this.placed.slice();
    placed[piece] = true;
    const result = placed.every(Boolean) ? { winners: [0], draw: false } : null;
    return new JigsawState(this.level, this.cols, this.rows, this.picture, this.rightJoins, this.bottomJoins, this.trayOrder, placed, result, piece);
  }
}

export function newJigsaw(seed: number, level: JigsawLevel): JigsawState {
  const rng = createRng(seed);
  const { cols, rows } = JIGSAW_SIZES[level];
  const picture = rng.int(JIGSAW_PICTURES);
  const knob = (): Side => (rng.next() < 0.5 ? 1 : -1);
  const rightJoins: Side[] = [];
  const bottomJoins: Side[] = [];
  for (let piece = 0; piece < cols * rows; piece++) {
    rightJoins.push(piece % cols === cols - 1 ? 0 : knob());
    bottomJoins.push(Math.floor(piece / cols) === rows - 1 ? 0 : knob());
  }
  const trayOrder = Array.from({ length: cols * rows }, (_, i) => i);
  for (let i = trayOrder.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [trayOrder[i], trayOrder[j]] = [trayOrder[j]!, trayOrder[i]!];
  }
  return new JigsawState(level, cols, rows, picture, rightJoins, bottomJoins, trayOrder, trayOrder.map(() => false), null, null);
}

/** Autoplay does what people do: the corners and edges first, then the rest row by row. */
function createJigsawBot(): Bot<JigsawMove> {
  return {
    chooseMove(generic: GameState<JigsawMove>, _seat: Seat, rng: Rng): JigsawMove {
      const state = generic as JigsawState;
      const open = state.placed.flatMap((done, piece) => (done ? [] : [piece]));
      const edge = open.find((piece) => state.isEdge(piece));
      const piece = edge ?? open[0];
      return piece !== undefined ? placePieceMove(piece) : rng.pick(state.legalMoves(0));
    },
  };
}

const isLevel = (value: string | undefined): value is JigsawLevel => JIGSAW_LEVELS.includes(value as JigsawLevel);

export const jigsaw: GameDefinition<JigsawMove> = {
  id: 'jigsaw',
  name: 'Jigsaw',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo', 'race'],
  hiddenInfo: false,
  realtime: false,
  newGame: (config, seed) => newJigsaw(seed, isLevel(config.variant) ? config.variant : 'easy'),
  createBot: () => createJigsawBot(),
  encodeMove: (move) => move,
};
