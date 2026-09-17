import type { Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Sea Battle (docs/games/sea-battle.md). Two hidden fleets on 10 by 10 grids.
 * Moves: `p<row><col><H|V>` puts the next ship down, `f<row><col>` fires.
 * Ships may touch, and a hit does not give another shot.
 */
export const SEA_SIZE = 10;
export const FLEET: readonly { readonly id: string; readonly name: string; readonly size: number }[] = [
  { id: 'carrier', name: 'carrier', size: 5 },
  { id: 'battleship', name: 'battleship', size: 4 },
  { id: 'cruiser', name: 'cruiser', size: 3 },
  { id: 'submarine', name: 'submarine', size: 3 },
  { id: 'destroyer', name: 'destroyer', size: 2 },
];
export const FLEET_CELLS = FLEET.reduce((sum, ship) => sum + ship.size, 0);

export type SeaMove = string;
export const placeMove = (row: number, col: number, horizontal: boolean): SeaMove => `p${row}${col}${horizontal ? 'H' : 'V'}`;
export const fireMove = (row: number, col: number): SeaMove => `f${row}${col}`;
export const cellOf = (row: number, col: number): number => row * SEA_SIZE + col;
export const rowOf = (cell: number): number => Math.floor(cell / SEA_SIZE);
export const colOf = (cell: number): number => cell % SEA_SIZE;

export interface Placement {
  readonly ship: number;
  readonly row: number;
  readonly col: number;
  readonly horizontal: boolean;
}

/** What a shot found: 0 not fired at, 1 miss, 2 hit. */
export const UNKNOWN = 0;
export const MISS = 1;
export const HIT = 2;

export const cellsOf = (placement: Placement): number[] =>
  Array.from({ length: FLEET[placement.ship]!.size }, (_, i) =>
    placement.horizontal ? cellOf(placement.row, placement.col + i) : cellOf(placement.row + i, placement.col),
  );

export interface SeaEvent {
  readonly kind: 'place' | 'fire';
  readonly seat: Seat;
  readonly cell?: number;
  readonly hit?: boolean;
  /** The ship that just went down, if any. */
  readonly sunk?: number;
  readonly ship?: number;
}

export class SeaBattleState implements GameState<SeaMove> {
  private cached?: SeaMove[];

  constructor(
    /** Each seat's ships, in fleet order; a seat is still placing while this is short. */
    readonly fleets: readonly (readonly Placement[])[],
    /** What each seat's own shots found, on the other seat's grid. */
    readonly shots: readonly (readonly number[])[],
    readonly currentSeat: Seat,
    readonly phase: 'place' | 'fire',
    readonly result: GameResult | null,
    readonly last: SeaEvent | null,
  ) {}

  /** Ships of `seat` that are completely hit (public knowledge: sinking is announced). */
  sunkShips(seat: Seat): number[] {
    const other: Seat = seat === 0 ? 1 : 0;
    const shots = this.shots[other]!;
    return this.fleets[seat]!.flatMap((placement) => (cellsOf(placement).every((cell) => shots[cell] === HIT) ? [placement.ship] : []));
  }

  /** Squares of `seat`'s fleet, for drawing your own grid (never the opponent's). */
  occupied(seat: Seat): Set<number> {
    return new Set(this.fleets[seat]!.flatMap(cellsOf));
  }

  legalMoves(seat: Seat): readonly SeaMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    this.cached ??= this.phase === 'place' ? this.placements() : this.targets();
    return this.cached;
  }

  private placements(): SeaMove[] {
    const seat = this.currentSeat;
    const next = this.fleets[seat]!.length;
    const size = FLEET[next]!.size;
    const taken = this.occupied(seat);
    const moves: SeaMove[] = [];
    for (let row = 0; row < SEA_SIZE; row++) {
      for (let col = 0; col < SEA_SIZE; col++) {
        for (const horizontal of [true, false]) {
          if (horizontal ? col + size > SEA_SIZE : row + size > SEA_SIZE) continue;
          const cells = cellsOf({ ship: next, row, col, horizontal });
          if (cells.some((cell) => taken.has(cell))) continue;
          moves.push(placeMove(row, col, horizontal));
        }
      }
    }
    return moves;
  }

  private targets(): SeaMove[] {
    const shots = this.shots[this.currentSeat]!;
    const moves: SeaMove[] = [];
    for (let cell = 0; cell < SEA_SIZE * SEA_SIZE; cell++) {
      if (shots[cell] === UNKNOWN) moves.push(fireMove(rowOf(cell), colOf(cell)));
    }
    return moves;
  }

  apply(move: SeaMove): SeaBattleState {
    if (this.result) throw new Error('Game is over');
    if (!this.legalMoves(this.currentSeat).includes(move)) throw new Error(`Illegal move: ${move}`);
    const seat = this.currentSeat;
    const other: Seat = seat === 0 ? 1 : 0;
    if (move[0] === 'p') {
      const ship = this.fleets[seat]!.length;
      const placement: Placement = { ship, row: Number(move[1]), col: Number(move[2]), horizontal: move[3] === 'H' };
      const fleets = this.fleets.map((list, s) => (s === seat ? [...list, placement] : list));
      const done = fleets[seat]!.length === FLEET.length;
      const bothReady = done && fleets[other]!.length === FLEET.length;
      const event: SeaEvent = { kind: 'place', seat, ship };
      return new SeaBattleState(fleets, this.shots, done && !bothReady ? other : bothReady ? 0 : seat, bothReady ? 'fire' : 'place', null, event);
    }

    const cell = cellOf(Number(move[1]), Number(move[2]));
    const hitShip = this.fleets[other]!.find((placement) => cellsOf(placement).includes(cell));
    const shots = this.shots.map((list, s) => (s === seat ? list.map((value, i) => (i === cell ? (hitShip ? HIT : MISS) : value)) : list));
    const sunk = hitShip && cellsOf(hitShip).every((c) => shots[seat]![c] === HIT) ? hitShip.ship : undefined;
    const event: SeaEvent = { kind: 'fire', seat, cell, hit: Boolean(hitShip), ...(sunk === undefined ? {} : { sunk }) };
    const allDown = this.fleets[other]!.flatMap(cellsOf).every((c) => shots[seat]![c] === HIT);
    if (allDown) return new SeaBattleState(this.fleets, shots, seat, 'fire', { winners: [seat], draw: false }, event);
    return new SeaBattleState(this.fleets, shots, other, 'fire', null, event);
  }
}

export function newSeaBattle(): SeaBattleState {
  const empty = Array<number>(SEA_SIZE * SEA_SIZE).fill(UNKNOWN);
  return new SeaBattleState([[], []], [empty, [...empty]], 0, 'place', null, null);
}

// ---- Bots. They see their own shot grid and which enemy ships have sunk, never the hidden fleet.

/** Cells next to a cell, for finishing off a wounded ship. */
function neighbours(cell: number): number[] {
  const row = rowOf(cell);
  const col = colOf(cell);
  const list: number[] = [];
  if (row > 0) list.push(cellOf(row - 1, col));
  if (row < SEA_SIZE - 1) list.push(cellOf(row + 1, col));
  if (col > 0) list.push(cellOf(row, col - 1));
  if (col < SEA_SIZE - 1) list.push(cellOf(row, col + 1));
  return list;
}

/** Hits that are not part of a sunk ship: a ship is still wounded there. */
function liveHits(state: SeaBattleState, seat: Seat): number[] {
  const other: Seat = seat === 0 ? 1 : 0;
  const shots = state.shots[seat]!;
  const sunkCells = new Set(
    state.fleets[other]!.filter((placement) => state.sunkShips(other).includes(placement.ship)).flatMap(cellsOf),
  );
  return shots.flatMap((value, cell) => (value === HIT && !sunkCells.has(cell) ? [cell] : []));
}

/**
 * How many ways the ships still afloat could cover each square, given the answers so far.
 * This is the honest way to play well: it uses only misses, hits and sinkings.
 */
function density(state: SeaBattleState, seat: Seat): number[] {
  const other: Seat = seat === 0 ? 1 : 0;
  const shots = state.shots[seat]!;
  const sunk = new Set(state.sunkShips(other));
  const wounded = liveHits(state, seat);
  const counts = Array<number>(SEA_SIZE * SEA_SIZE).fill(0);
  for (const ship of FLEET) {
    const index = FLEET.indexOf(ship);
    if (sunk.has(index)) continue;
    for (let row = 0; row < SEA_SIZE; row++) {
      for (let col = 0; col < SEA_SIZE; col++) {
        for (const horizontal of [true, false]) {
          if (horizontal ? col + ship.size > SEA_SIZE : row + ship.size > SEA_SIZE) continue;
          const cells = cellsOf({ ship: index, row, col, horizontal });
          // A placement is possible only if it avoids known misses and sunk ships.
          if (cells.some((cell) => shots[cell] === MISS)) continue;
          if (cells.some((cell) => shots[cell] === HIT && !wounded.includes(cell))) continue;
          // While a ship is wounded, only placements that explain a wounded square matter.
          const weight = wounded.length > 0 ? (cells.some((cell) => wounded.includes(cell)) ? 12 : 0) : 1;
          if (weight === 0) continue;
          for (const cell of cells) if (shots[cell] === UNKNOWN) counts[cell]! += weight;
        }
      }
    }
  }
  return counts;
}

type SeaStyle = 'random' | 'finish' | 'parity' | 'density';
const TIERS: Record<BotTier, SeaStyle> = { easy: 'random', medium: 'finish', hard: 'parity', expert: 'density' };

function createSeaBot(style: SeaStyle): Bot<SeaMove> {
  return {
    chooseMove(generic: GameState<SeaMove>, seat: Seat, rng: Rng): SeaMove {
      const state = generic as SeaBattleState;
      const moves = state.legalMoves(seat);
      if (moves.length === 0) throw new Error('No legal moves');
      // Placing: anywhere legal. Nobody can see it, so random is as good as it gets.
      if (state.phase === 'place') return rng.pick(moves);
      const open = new Set(moves);
      const pick = (cell: number) => fireMove(rowOf(cell), colOf(cell));
      if (style === 'density') {
        const counts = density(state, seat);
        const best = Math.max(...counts.map((count, cell) => (open.has(pick(cell)) ? count : -1)));
        const cells = counts.flatMap((count, cell) => (count === best && open.has(pick(cell)) ? [cell] : []));
        if (cells.length) return pick(rng.pick(cells));
      }
      if (style !== 'random') {
        // Finish off a wounded ship first.
        const next = liveHits(state, seat).flatMap(neighbours).filter((cell) => open.has(pick(cell)));
        if (next.length) return pick(rng.pick(next));
      }
      if (style === 'parity') {
        // A ship of two cannot hide from a checkerboard, so it halves the hunting.
        const checker = [...open].filter((move) => (Number(move[1]) + Number(move[2])) % 2 === 0);
        if (checker.length) return rng.pick(checker);
      }
      return rng.pick([...open]);
    },
  };
}

export const seaBattle: GameDefinition<SeaMove> = {
  id: 'sea-battle',
  name: 'Sea Battle',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: true,
  realtime: false,
  newGame: () => newSeaBattle(),
  createBot: (tier) => createSeaBot(TIERS[tier]),
  encodeMove: (move) => move,
};
