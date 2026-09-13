import type { Rng } from '../../core/rng';
import { createRng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/** 2048 (docs/games/2048.md). Tiles keep an id so views can animate each slide, merge and spawn. */
export const BOARD_SIZE = 4;
export const WIN_TILE = 2048;

export type Slide = 'up' | 'down' | 'left' | 'right';
export const SLIDES: readonly Slide[] = ['up', 'down', 'left', 'right'];

export interface Tile {
  readonly id: number;
  readonly value: number;
  /** Cell index 0–15, row by row. */
  readonly index: number;
}

export interface SlideChange {
  readonly moved: readonly { readonly id: number; readonly from: number; readonly to: number }[];
  readonly merged: readonly { readonly id: number; readonly value: number; readonly at: number; readonly from: readonly [number, number] }[];
  readonly spawned: Tile | null;
}

/** Cell indices of each line, ordered from the edge the tiles slide toward. */
function lines(direction: Slide): number[][] {
  const result: number[][] = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    const line: number[] = [];
    for (let j = 0; j < BOARD_SIZE; j++) {
      if (direction === 'left') line.push(i * BOARD_SIZE + j);
      if (direction === 'right') line.push(i * BOARD_SIZE + (BOARD_SIZE - 1 - j));
      if (direction === 'up') line.push(j * BOARD_SIZE + i);
      if (direction === 'down') line.push((BOARD_SIZE - 1 - j) * BOARD_SIZE + i);
    }
    result.push(line);
  }
  return result;
}

interface SlideOutcome {
  readonly tiles: Tile[];
  readonly changed: boolean;
  readonly gained: number;
  readonly nextId: number;
  readonly moved: SlideChange['moved'][number][];
  readonly merged: SlideChange['merged'][number][];
}

function slide(tiles: readonly Tile[], direction: Slide, nextId: number): SlideOutcome {
  const at = new Map(tiles.map((t) => [t.index, t]));
  const out: Tile[] = [];
  const moved: SlideOutcome['moved'] = [];
  const merged: SlideOutcome['merged'] = [];
  let gained = 0;
  let id = nextId;
  let changed = false;

  for (const line of lines(direction)) {
    let slot = 0;
    let last: { tile: Tile; cell: number; merged: boolean } | null = null;
    for (const cell of line) {
      const tile = at.get(cell);
      if (!tile) continue;
      if (last && !last.merged && last.tile.value === tile.value) {
        // Merge into the tile already sitting in the previous slot.
        const value = tile.value * 2;
        const mergedTile: Tile = { id: id++, value, index: last.cell };
        out.splice(out.indexOf(last.tile), 1, mergedTile);
        moved.push({ id: tile.id, from: tile.index, to: last.cell });
        merged.push({ id: mergedTile.id, value, at: last.cell, from: [last.tile.id, tile.id] });
        gained += value;
        changed = true;
        last = { tile: mergedTile, cell: last.cell, merged: true };
        continue;
      }
      const target = line[slot++]!;
      const placed: Tile = { ...tile, index: target };
      if (target !== tile.index) changed = true;
      moved.push({ id: tile.id, from: tile.index, to: target });
      out.push(placed);
      last = { tile: placed, cell: target, merged: false };
    }
  }
  return { tiles: out, changed, gained, nextId: id, moved, merged };
}

function spawn(tiles: readonly Tile[], seed: number, count: number, id: number): Tile | null {
  const taken = new Set(tiles.map((t) => t.index));
  const empty: number[] = [];
  for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) if (!taken.has(i)) empty.push(i);
  if (empty.length === 0) return null;
  const rng = createRng((seed ^ Math.imul(count + 1, 0x9e3779b1)) >>> 0);
  const index = empty[rng.int(empty.length)]!;
  return { id, value: rng.next() < 0.9 ? 2 : 4, index };
}

export class Twenty48State implements GameState<Slide> {
  readonly currentSeat: Seat = 0;

  constructor(
    readonly tiles: readonly Tile[],
    readonly score: number,
    readonly seed: number,
    readonly spawns: number,
    readonly nextId: number,
    readonly result: GameResult | null,
    readonly lastChange: SlideChange | null,
  ) {}

  get best(): number {
    return this.tiles.reduce((max, t) => Math.max(max, t.value), 0);
  }

  legalMoves(seat: Seat): readonly Slide[] {
    if (this.result || seat !== 0) return [];
    return SLIDES.filter((d) => slide(this.tiles, d, this.nextId).changed);
  }

  apply(move: Slide): Twenty48State {
    if (this.result) throw new Error('Game is over');
    const outcome = slide(this.tiles, move, this.nextId);
    if (!outcome.changed) throw new Error(`Illegal move: ${move} changes nothing`);
    const spawned = spawn(outcome.tiles, this.seed, this.spawns, outcome.nextId);
    const tiles = spawned ? [...outcome.tiles, spawned] : outcome.tiles;
    const next = new Twenty48State(
      tiles,
      this.score + outcome.gained,
      this.seed,
      this.spawns + 1,
      outcome.nextId + 1,
      null,
      { moved: outcome.moved, merged: outcome.merged, spawned },
    );
    if (next.legalMoves(0).length > 0) return next;
    const reached = next.best >= WIN_TILE;
    return new Twenty48State(tiles, next.score, this.seed, next.spawns, next.nextId, { winners: reached ? [0] : [], draw: false }, next.lastChange);
  }
}

export function newTwenty48(seed: number): Twenty48State {
  const s = seed >>> 0;
  const first = spawn([], s, 0, 0)!;
  const second = spawn([first], s, 1, 1)!;
  return new Twenty48State([first, second], 0, s, 2, 2, null, { moved: [], merged: [], spawned: null });
}

/** Board quality for bots: empty cells, merges available, and keeping the big tile in a corner. */
function evaluate(state: Twenty48State): number {
  const empty = BOARD_SIZE * BOARD_SIZE - state.tiles.length;
  const corner = state.tiles.find((t) => t.value === state.best);
  const cornerBonus = corner && [0, 3, 12, 15].includes(corner.index) ? state.best : 0;
  return state.score + empty * 30 + cornerBonus;
}

const DEPTH: Record<BotTier, number> = { easy: 0, medium: 1, hard: 1, expert: 2 };

function createTwenty48Bot(tier: BotTier): Bot<Slide> {
  const search = (state: Twenty48State, depth: number): number => {
    if (depth === 0 || state.result) return evaluate(state);
    const moves = state.legalMoves(0);
    if (moves.length === 0) return evaluate(state) - 10_000;
    return Math.max(...moves.map((m) => search(state.apply(m), depth - 1)));
  };
  return {
    chooseMove(generic: GameState<Slide>, _seat: Seat, rng: Rng): Slide {
      const state = generic as Twenty48State;
      const moves = state.legalMoves(0);
      if (moves.length === 0) throw new Error('No legal moves');
      if (DEPTH[tier] === 0) return rng.pick(moves);
      const scored = moves.map((m) => ({ m, score: search(state.apply(m), DEPTH[tier] - 1) }));
      const best = Math.max(...scored.map((s) => s.score));
      return rng.pick(scored.filter((s) => s.score === best)).m;
    },
  };
}

export const twenty48: GameDefinition<Slide> = {
  id: '2048',
  name: '2048',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo', 'race'],
  hiddenInfo: false,
  realtime: false,
  newGame: (_config, seed) => newTwenty48(seed),
  createBot: (tier) => createTwenty48Bot(tier),
  encodeMove: (move) => move,
};
