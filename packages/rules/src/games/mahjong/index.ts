import { createRng, type Rng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Mahjong Solitaire (docs/games/mahjong.md): take tiles off a stacked layout two at a time, a
 * matching pair of free tiles each go. A tile is free when nothing lies on it and its left or its
 * right side is open. Every deal is built by playing a removal backwards, so it can be cleared.
 *
 * Positions are in half-tile units: a tile covers [x, x + 2) by [y, y + 2) on layer z.
 */
export interface TileSlot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

function grid(x0: number, y0: number, cols: number, rows: number, z: number): TileSlot[] {
  const out: TileSlot[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push({ x: x0 + c * 2, y: y0 + r * 2, z });
  return out;
}

function row(x0: number, x1: number, y: number, z: number): TileSlot[] {
  const out: TileSlot[] = [];
  for (let x = x0; x <= x1; x += 2) out.push({ x, y, z });
  return out;
}

export const MAHJONG_LAYOUTS: Readonly<Record<string, readonly TileSlot[]>> = {
  // A small pyramid with two wings: 36 tiles.
  small: [...grid(0, 0, 6, 4, 0), ...grid(2, 2, 4, 2, 1), ...grid(4, 3, 2, 1, 2), { x: -2, y: 3, z: 0 }, { x: 12, y: 3, z: 0 }],
  // A wider pyramid: 72 tiles.
  medium: [
    ...grid(0, 0, 8, 5, 0),
    ...grid(2, 1, 6, 3, 1),
    ...grid(4, 2, 4, 2, 2),
    ...grid(6, 3, 2, 1, 3),
    { x: -2, y: 2, z: 0 },
    { x: -2, y: 6, z: 0 },
    { x: 16, y: 2, z: 0 },
    { x: 16, y: 6, z: 0 },
  ],
  // The classic turtle: 144 tiles.
  large: [
    ...row(2, 24, 0, 0),
    ...row(6, 20, 2, 0),
    ...row(4, 22, 4, 0),
    ...row(2, 24, 6, 0),
    ...row(2, 24, 8, 0),
    ...row(4, 22, 10, 0),
    ...row(6, 20, 12, 0),
    ...row(2, 24, 14, 0),
    { x: 0, y: 7, z: 0 },
    { x: 26, y: 7, z: 0 },
    { x: 28, y: 7, z: 0 },
    ...grid(8, 2, 6, 6, 1),
    ...grid(10, 4, 4, 4, 2),
    ...grid(12, 6, 2, 2, 3),
    { x: 13, y: 7, z: 4 },
  ],
};

/**
 * Tile faces: 0–8 dots, 9–17 sticks, 18–26 numbers, 27–30 winds, 31–33 the three symbols,
 * 34 the flowers and 35 the seasons. A flower matches any flower and a season any season; `looks`
 * says which of the four each one is, for drawing.
 */
export const MAHJONG_FACES = 36;
export const FLOWER = 34;
export const SEASON = 35;

/** How many different faces a layout uses: its tiles come four of each. */
const facesFor = (tiles: number) => Math.min(MAHJONG_FACES, tiles / 4);

/** `m<a>-<b>` takes the pair of tiles at those slots; `shuffle` deals the rest again. */
export type MahjongMove = string;

export class MahjongState implements GameState<MahjongMove> {
  readonly currentSeat: Seat = 0;

  constructor(
    readonly levelId: string,
    readonly seed: number,
    /** The face on each slot, or -1 once it is taken. */
    readonly faces: readonly number[],
    /** For flowers and seasons, which of the four pictures; 0 otherwise. */
    readonly looks: readonly number[],
    readonly shuffles: number,
    readonly last: readonly [number, number] | null,
    readonly result: GameResult | null,
  ) {}

  get slots(): readonly TileSlot[] {
    return MAHJONG_LAYOUTS[this.levelId]!;
  }

  get left(): number {
    return this.faces.filter((f) => f >= 0).length;
  }

  /** Free: nothing on top of it, and nothing touching its left side or nothing touching its right. */
  isFree(i: number): boolean {
    return freeIn(this.slots, (j) => this.faces[j]! >= 0, i);
  }

  /** Every matching pair of free tiles. */
  pairs(): [number, number][] {
    const free = this.faces.flatMap((f, i) => (f >= 0 && this.isFree(i) ? [i] : []));
    const out: [number, number][] = [];
    for (let a = 0; a < free.length; a++) for (let b = a + 1; b < free.length; b++) if (this.faces[free[a]!] === this.faces[free[b]!]) out.push([free[a]!, free[b]!]);
    return out;
  }

  legalMoves(seat: Seat): readonly MahjongMove[] {
    if (this.result || seat !== 0) return [];
    const moves = this.pairs().map(([a, b]) => `m${a}-${b}`);
    if (this.shuffles > 0) moves.push('shuffle');
    return moves;
  }

  apply(move: MahjongMove): MahjongState {
    if (!this.legalMoves(0).includes(move)) throw new Error(`Illegal move: ${move}`);
    if (move === 'shuffle') {
      const remaining = this.faces.flatMap((f, i) => (f >= 0 ? [i] : []));
      const dealt = dealInto(this.slots, remaining, this.faces.filter((f) => f >= 0), createRng((this.seed ^ Math.imul(this.shuffles + 7, 0x9e3779b1)) >>> 0));
      const faces = this.faces.slice();
      for (const [slot, face] of dealt) faces[slot] = face;
      return this.settle(faces, this.shuffles - 1, null);
    }
    const [a, b] = move.slice(1).split('-').map(Number) as [number, number];
    const faces = this.faces.slice();
    faces[a] = -1;
    faces[b] = -1;
    return this.settle(faces, this.shuffles, [a, b]);
  }

  /** Cleared wins; no pair left and no shuffle left loses. */
  private settle(faces: number[], shuffles: number, last: readonly [number, number] | null): MahjongState {
    const next = new MahjongState(this.levelId, this.seed, faces, this.looks, shuffles, last, null);
    if (next.left === 0) return new MahjongState(this.levelId, this.seed, faces, this.looks, shuffles, last, { winners: [0], draw: false });
    if (next.pairs().length === 0 && shuffles === 0) return new MahjongState(this.levelId, this.seed, faces, this.looks, shuffles, last, { winners: [], draw: false });
    return next;
  }
}

function freeIn(slots: readonly TileSlot[], present: (j: number) => boolean, i: number): boolean {
  const s = slots[i]!;
  let left = false;
  let right = false;
  for (let j = 0; j < slots.length; j++) {
    if (j === i || !present(j)) continue;
    const t = slots[j]!;
    const overlapY = t.y < s.y + 2 && s.y < t.y + 2;
    if (t.z === s.z + 1 && overlapY && t.x < s.x + 2 && s.x < t.x + 2) return false;
    if (t.z === s.z && overlapY) {
      if (t.x === s.x - 2) left = true;
      if (t.x === s.x + 2) right = true;
    }
  }
  return !left || !right;
}

/**
 * Deal `faces` (in pairs) onto `positions` so the result can be cleared: play a removal
 * backwards, taking two free slots at a time from the full set and giving them a matching pair.
 * Returns slot to face, or tries again if it paints itself into a corner.
 */
function dealInto(slots: readonly TileSlot[], positions: readonly number[], faces: readonly number[], rng: Rng): [number, number][] {
  const bag = faces.slice().sort((a, b) => a - b);
  const pairs: [number, number][] = [];
  for (let i = 0; i < bag.length; i += 2) pairs.push([bag[i]!, bag[i + 1]!]);
  for (let attempt = 0; attempt < 500; attempt++) {
    const order = pairs.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    const present = new Set(positions);
    const out: [number, number][] = [];
    let stuck = false;
    for (const [fa, fb] of order) {
      const free = [...present].filter((i) => freeIn(slots, (j) => present.has(j), i));
      if (free.length < 2) {
        stuck = true;
        break;
      }
      const a = free.splice(rng.int(free.length), 1)[0]!;
      const b = free[rng.int(free.length)]!;
      present.delete(a);
      present.delete(b);
      out.push([a, fa], [b, fb]);
    }
    if (!stuck) return out;
  }
  throw new Error('Could not deal');
}

export function newMahjong(seed: number, levelId = 'small'): MahjongState {
  const id = MAHJONG_LAYOUTS[levelId] ? levelId : 'small';
  const slots = MAHJONG_LAYOUTS[id]!;
  const rng = createRng(seed);
  const kinds = facesFor(slots.length);
  // Four of each face. The turtle uses all 36; smaller layouts draw theirs from the whole set, so
  // a small game still has dots, sticks, numbers and the rest rather than one suit.
  const pool = Array.from({ length: MAHJONG_FACES }, (_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const chosen = pool.slice(0, kinds).sort((a, b) => a - b);
  const faces: number[] = [];
  const looks = Array<number>(slots.length).fill(0);
  for (const face of chosen) for (let c = 0; c < 4; c++) faces.push(face);
  const dealt = dealInto(slots, slots.map((_, i) => i), faces, rng);
  const board = Array<number>(slots.length).fill(-1);
  const seenGroup = new Map<number, number>();
  for (const [slot, face] of dealt) {
    board[slot] = face;
    if (face === FLOWER || face === SEASON) {
      const n = seenGroup.get(face) ?? 0;
      looks[slot] = n;
      seenGroup.set(face, n + 1);
    }
  }
  return new MahjongState(id, seed >>> 0, board, looks, 2, null, null);
}

/** Test play: take the pair that frees the most, else the first. */
function createMahjongBot(): Bot<MahjongMove> {
  return {
    chooseMove(generic: GameState<MahjongMove>, _seat: Seat, rng: Rng): MahjongMove {
      const s = generic as MahjongState;
      const moves = s.legalMoves(0).filter((m) => m !== 'shuffle');
      if (!moves.length) return 'shuffle';
      // Prefer pairs on high layers, which uncover the most.
      const height = (m: string) => {
        const [a, b] = m.slice(1).split('-').map(Number) as [number, number];
        return s.slots[a]!.z + s.slots[b]!.z;
      };
      const best = Math.max(...moves.map(height));
      return rng.pick(moves.filter((m) => height(m) === best));
    },
  };
}

export const mahjong: GameDefinition<MahjongMove> = {
  id: 'mahjong',
  name: 'Mahjong Solitaire',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo', 'race'],
  hiddenInfo: false,
  realtime: false,
  newGame: (config, seed) => newMahjong(seed, config.variant ?? 'small'),
  createBot: () => createMahjongBot(),
  encodeMove: (move) => move,
};
