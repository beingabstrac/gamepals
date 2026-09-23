import type { Rng } from '../../core/rng';
import { createRng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/** Tile Match: take free tiles into a tray of seven, three alike clear (docs/games/tile-match.md). */
export type TileLevel = 'easy' | 'medium' | 'hard';
export const TILE_LEVELS: readonly TileLevel[] = ['easy', 'medium', 'hard'];

/**
 * Tiles in each layer, bottom up, how many pictures, and how many threes the dealt winning order
 * may hold in the tray at once. Every layer above the first is even, since it has no middle column.
 */
export const TILE_SPECS: Record<TileLevel, { readonly layers: readonly number[]; readonly kinds: number; readonly open: number }> = {
  easy: { layers: [26, 12, 4], kinds: 6, open: 2 },
  medium: { layers: [30, 18, 8, 4], kinds: 8, open: 2 },
  hard: { layers: [34, 22, 12, 6, 4], kinds: 10, open: 3 },
};

/** Columns and rows of the bottom layer; each layer above sits half a tile in and has one fewer. */
export const TILE_COLS = 7;
export const TILE_ROWS = 7;
export const TRAY_SIZE = 7;
export const TILE_UNDOS = 3;
/** Tiles below that one above has to rest on, of the four it overlaps. */
export const REST_ON = 2;
/** Tries at a layout before one that is short of its counts is accepted; they are a safety net. */
const MAX_LAYOUTS = 200;

/** Where a tile sits, in half tiles, and its layer. */
export interface PileTile {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Take a tile (`t<index>`) or undo the last take (`u`). */
export type TileMove = string;
export const takeTileMove = (tile: number): TileMove => `t${tile}`;
export const UNDO_TILE_MOVE: TileMove = 'u';

/** Whether `a` lies on top of `b`: higher, and closer than a whole tile both ways. */
export const covers = (a: PileTile, b: PileTile): boolean => a.z > b.z && Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;

/**
 * A layout from the seed: layer by layer, each tile above the first resting on at least two below,
 * and mirrored left to right so it looks laid out by hand. `exact` says whether every count was met.
 */
function tryLayout(rng: Rng, layers: readonly number[]): { tiles: PileTile[]; exact: boolean } {
  const tiles: PileTile[] = [];
  const at = new Set<string>();
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
  const right = 2 * (TILE_COLS - 1);
  for (let z = 0; z < layers.length; z++) {
    const off = z % 2;
    const units: PileTile[][] = [];
    for (let row = 0; row < TILE_ROWS - off; row++) {
      for (let col = 0; col < TILE_COLS - off; col++) {
        const x = 2 * col + off;
        const y = 2 * row + off;
        if (right - x < x) continue;
        const rests = (tx: number) => z === 0 || [[-1, -1], [1, -1], [-1, 1], [1, 1]].filter(([dx, dy]) => at.has(key(tx + dx!, y + dy!, z - 1))).length >= REST_ON;
        if (!rests(x) || !rests(right - x)) continue;
        units.push(right - x === x ? [{ x, y, z }] : [{ x, y, z }, { x: right - x, y, z }]);
      }
    }
    for (let i = units.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [units[i], units[j]] = [units[j]!, units[i]!];
    }
    let count = 0;
    for (const unit of units) {
      if (count + unit.length > layers[z]!) continue;
      for (const tile of unit) {
        tiles.push(tile);
        at.add(key(tile.x, tile.y, tile.z));
      }
      count += unit.length;
      if (count === layers[z]) break;
    }
    if (count !== layers[z]) return { tiles, exact: false };
  }
  return { tiles, exact: true };
}

/**
 * Pictures dealt along a real way of taking the board apart: a random order that only ever takes a
 * free tile, with the pictures handed out in threes along it and at most `open` threes started and
 * not finished at any time. Playing that order back clears the board and never leaves more than
 * `2 * open` tiles in the tray (six at most, on Hard), so every board dealt this way can be won.
 */
function dealAlong(rng: Rng, tiles: readonly PileTile[], kinds: number, open: number): { symbols: number[]; plan: number[] } {
  const gone = tiles.map(() => false);
  const plan: number[] = [];
  while (plan.length < tiles.length) {
    const free = tiles.flatMap((tile, i) => (!gone[i] && !tiles.some((other, j) => !gone[j] && covers(other, tile)) ? [i] : []));
    const pick = rng.pick(free);
    gone[pick] = true;
    plan.push(pick);
  }
  const bag = Array.from({ length: tiles.length / 3 }, (_, i) => i % kinds);
  for (let i = bag.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [bag[i], bag[j]] = [bag[j]!, bag[i]!];
  }
  const symbols = tiles.map(() => -1);
  const started: { symbol: number; dealt: number }[] = [];
  let next = 0;
  for (const tile of plan) {
    const canStart = started.length < open && next < bag.length;
    const three = canStart && (started.length === 0 || rng.next() < 0.5) ? { symbol: bag[next++]!, dealt: 0 } : rng.pick(started);
    if (!started.includes(three)) started.push(three);
    symbols[tile] = three.symbol;
    three.dealt++;
    if (three.dealt === 3) started.splice(started.indexOf(three), 1);
  }
  return { symbols, plan };
}

export class TileMatchState implements GameState<TileMove> {
  readonly currentSeat: Seat = 0;

  constructor(
    readonly level: TileLevel,
    readonly tiles: readonly PileTile[],
    readonly symbols: readonly number[],
    /** The order the pictures were dealt along: a way to win, and what autoplay follows. */
    readonly plan: readonly number[],
    readonly onBoard: readonly boolean[],
    /** Tiles in the tray, left to right. */
    readonly tray: readonly number[],
    /** Tiles cleared in threes, in the order they went. */
    readonly cleared: readonly number[],
    readonly undos: number,
    readonly previous: TileMatchState | null,
    /** The tile whose take made this position, which is the one an undo puts back. */
    readonly taken: number | null,
    readonly result: GameResult | null,
    /**
     * For the animation: the tile the last move took (or put back), the place in the tray it landed
     * in before any three cleared (-1 for an undo), and the three it cleared, if it did.
     */
    readonly last: { readonly tile: number; readonly slot: number; readonly cleared: readonly number[]; readonly undo: boolean } | null,
  ) {}

  /** Free: on the board with nothing on top of it. */
  isFree(tile: number): boolean {
    if (!this.onBoard[tile]) return false;
    const me = this.tiles[tile]!;
    return !this.tiles.some((other, i) => this.onBoard[i] && covers(other, me));
  }

  get left(): number {
    return this.onBoard.filter(Boolean).length;
  }

  legalMoves(seat: Seat): readonly TileMove[] {
    if (this.result || seat !== 0) return [];
    const moves: TileMove[] = [];
    for (let tile = 0; tile < this.tiles.length; tile++) if (this.isFree(tile)) moves.push(takeTileMove(tile));
    if (this.previous && this.undos > 0) moves.push(UNDO_TILE_MOVE);
    return moves;
  }

  apply(move: TileMove): TileMatchState {
    if (this.result) throw new Error('Game is over');
    if (!this.legalMoves(0).includes(move)) throw new Error(`Illegal move: ${move}`);
    if (move === UNDO_TILE_MOVE) {
      const back = this.previous!;
      return new TileMatchState(this.level, this.tiles, this.symbols, this.plan, back.onBoard, back.tray, back.cleared, this.undos - 1, back.previous, back.taken, null, {
        tile: this.taken!,
        slot: -1,
        cleared: [],
        undo: true,
      });
    }
    const tile = Number(move.slice(1));
    const symbol = this.symbols[tile]!;
    const onBoard = this.onBoard.slice();
    onBoard[tile] = false;
    // It lands just after the last of its own kind already in the tray, or at the end.
    const tray = this.tray.slice();
    let place = tray.length;
    for (let i = tray.length - 1; i >= 0; i--) {
      if (this.symbols[tray[i]!] === symbol) {
        place = i + 1;
        break;
      }
    }
    tray.splice(place, 0, tile);
    const alike = tray.filter((t) => this.symbols[t] === symbol);
    let cleared = this.cleared;
    let gone: number[] = [];
    if (alike.length === 3) {
      gone = alike;
      cleared = [...this.cleared, ...alike];
      tray.splice(0, tray.length, ...tray.filter((t) => this.symbols[t] !== symbol));
    }
    let result: GameResult | null = null;
    if (onBoard.every((on) => !on) && tray.length === 0) result = { winners: [0], draw: false };
    else if (tray.length >= TRAY_SIZE) result = { winners: [], draw: false };
    return new TileMatchState(this.level, this.tiles, this.symbols, this.plan, onBoard, tray, cleared, this.undos, this, tile, result, { tile, slot: place, cleared: gone, undo: false });
  }
}

export function newTileMatch(seed: number, level: TileLevel): TileMatchState {
  const rng = createRng(seed);
  const spec = TILE_SPECS[level];
  let layout = tryLayout(rng, spec.layers);
  for (let attempt = 1; attempt < MAX_LAYOUTS && !layout.exact; attempt++) layout = tryLayout(rng, spec.layers);
  // A layout short of its counts is kept, trimmed to whole threes from the top down.
  const tiles = layout.tiles.slice(0, layout.tiles.length - (layout.tiles.length % 3));
  const { symbols, plan } = dealAlong(rng, tiles, spec.kinds, spec.open);
  return new TileMatchState(level, tiles, symbols, plan, tiles.map(() => true), [], [], TILE_UNDOS, null, null, null, null);
}

/** Autoplay: the order the board was dealt along, so it always clears. */
function createTileBot(): Bot<TileMove> {
  return {
    chooseMove(generic: GameState<TileMove>, _seat: Seat, rng: Rng): TileMove {
      const state = generic as TileMatchState;
      const next = state.plan.find((tile) => state.isFree(tile));
      return next !== undefined ? takeTileMove(next) : rng.pick(state.legalMoves(0));
    },
  };
}

const isLevel = (value: string | undefined): value is TileLevel => TILE_LEVELS.includes(value as TileLevel);

export const tileMatch: GameDefinition<TileMove> = {
  id: 'tile-match',
  name: 'Tile Match',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo', 'race'],
  // Tiles buried under others cannot be seen, and the deal comes from the seed like a shuffled
  // deck, so a server keeping score has to be the one holding it.
  hiddenInfo: true,
  realtime: false,
  newGame: (config, seed) => newTileMatch(seed, isLevel(config.variant) ? config.variant : 'easy'),
  createBot: () => createTileBot(),
  encodeMove: (move) => move,
};
