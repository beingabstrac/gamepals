import type { Rng } from '../../core/rng';
import { createRng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/** Sliding Puzzle, the 15 puzzle and its 3×3 and 5×5 cousins (docs/games/sliding-puzzle.md). */
export type SlidingLevel = '3x3' | '4x4' | '5x5';
export const SLIDING_LEVELS: readonly SlidingLevel[] = ['3x3', '4x4', '5x5'];
const SIDE: Record<SlidingLevel, number> = { '3x3': 3, '4x4': 4, '5x5': 5 };
/** Random real slides used to shuffle; bigger boards need more to mix well. */
const SHUFFLE_STEPS: Record<number, number> = { 3: 150, 4: 300, 5: 500 };

/** Tap the tile in this cell (`t<cell>`); it and any tiles between it and the space slide toward the space. */
export type SlidingMove = string;
export const slideMove = (cell: number): SlidingMove => `t${cell}`;

export interface SlidingStep {
  readonly tile: number;
  readonly from: number;
  readonly to: number;
}

export class SlidingState implements GameState<SlidingMove> {
  readonly currentSeat: Seat = 0;

  constructor(
    /** Tiles per side. */
    readonly n: number,
    /** Tile number in each cell, row by row; 0 is the empty space. */
    readonly tiles: readonly number[],
    readonly gap: number,
    /** Single-tile moves so far (the usual way to count). */
    readonly moves: number,
    /**
     * Where the space has been since the puzzle was solved, with immediate back-and-forth removed.
     * Walking it backwards always solves the puzzle (used only by the autoplay bot).
     */
    readonly trail: readonly number[],
    readonly result: GameResult | null,
    /** Tiles moved by the last slide, for the animation. */
    readonly last: readonly SlidingStep[],
  ) {}

  get solved(): boolean {
    return this.tiles.every((tile, cell) => tile === (cell === this.tiles.length - 1 ? 0 : cell + 1));
  }

  legalMoves(seat: Seat): readonly SlidingMove[] {
    if (this.result || seat !== 0) return [];
    const row = Math.floor(this.gap / this.n);
    const col = this.gap % this.n;
    const moves: SlidingMove[] = [];
    for (let i = 0; i < this.n; i++) {
      if (i !== col) moves.push(slideMove(row * this.n + i));
      if (i !== row) moves.push(slideMove(i * this.n + col));
    }
    return moves;
  }

  apply(move: SlidingMove): SlidingState {
    if (this.result) throw new Error('Game is over');
    if (!this.legalMoves(0).includes(move)) throw new Error(`Illegal move: ${move}`);
    const target = Number(move.slice(1));
    const { n } = this;
    const step = Math.floor(target / n) === Math.floor(this.gap / n) ? Math.sign(target - this.gap) : Math.sign(target - this.gap) * n;
    const tiles = this.tiles.slice();
    const trail = this.trail.slice();
    const last: SlidingStep[] = [];
    let gap = this.gap;
    // The tile next to the space moves in first, then the next, until the tapped tile has moved.
    while (gap !== target) {
      const next = gap + step;
      last.push({ tile: tiles[next]!, from: next, to: gap });
      tiles[gap] = tiles[next]!;
      tiles[next] = 0;
      gap = next;
      if (trail[trail.length - 2] === gap) trail.pop();
      else trail.push(gap);
    }
    const next = new SlidingState(n, tiles, gap, this.moves + last.length, trail, null, last);
    return next.solved ? new SlidingState(n, tiles, gap, next.moves, trail, { winners: [0], draw: false }, last) : next;
  }
}

/** Neighbours of a cell (up, down, left, right). */
function neighbours(n: number, cell: number): number[] {
  const row = Math.floor(cell / n);
  const col = cell % n;
  const out: number[] = [];
  if (row > 0) out.push(cell - n);
  if (row < n - 1) out.push(cell + n);
  if (col > 0) out.push(cell - 1);
  if (col < n - 1) out.push(cell + 1);
  return out;
}

export function newSliding(seed: number, level: SlidingLevel): SlidingState {
  const n = SIDE[level];
  const rng = createRng(seed >>> 0);
  const tiles = Array.from({ length: n * n }, (_, i) => (i === n * n - 1 ? 0 : i + 1));
  let gap = n * n - 1;
  const trail = [gap];
  let previous = -1;
  // Shuffle with real slides from the solved puzzle, so it is always solvable (like a physical puzzle).
  for (let i = 0; i < SHUFFLE_STEPS[n]! || tiles.every((t, c) => t === (c === n * n - 1 ? 0 : c + 1)); i++) {
    const options = neighbours(n, gap).filter((cell) => cell !== previous);
    const next = rng.pick(options);
    tiles[gap] = tiles[next]!;
    tiles[next] = 0;
    previous = gap;
    gap = next;
    if (trail[trail.length - 2] === gap) trail.pop();
    else trail.push(gap);
  }
  return new SlidingState(n, tiles, gap, 0, trail, null, []);
}

/** Parity test from the real puzzle: can this layout be solved at all? */
export function isSolvableLayout(tiles: readonly number[], n: number): boolean {
  const seq = tiles.filter((t) => t !== 0);
  let inversions = 0;
  for (let i = 0; i < seq.length; i++) for (let j = i + 1; j < seq.length; j++) if (seq[i]! > seq[j]!) inversions++;
  if (n % 2 === 1) return inversions % 2 === 0;
  const gapRowFromBottom = n - Math.floor(tiles.indexOf(0) / n);
  return (inversions + gapRowFromBottom) % 2 === 1;
}

/** Autoplay only: walks the space back along its trail, one tile at a time, which always solves it. */
function createSlidingBot(): Bot<SlidingMove> {
  return {
    chooseMove(generic: GameState<SlidingMove>, _seat: Seat, rng: Rng): SlidingMove {
      const state = generic as SlidingState;
      const back = state.trail[state.trail.length - 2];
      return back === undefined ? rng.pick(state.legalMoves(0)) : slideMove(back);
    },
  };
}

const isLevel = (value: string | undefined): value is SlidingLevel => SLIDING_LEVELS.includes(value as SlidingLevel);

export const slidingPuzzle: GameDefinition<SlidingMove> = {
  id: 'sliding-puzzle',
  name: 'Sliding Puzzle',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo', 'race'],
  hiddenInfo: false,
  realtime: false,
  newGame: (config, seed) => newSliding(seed, isLevel(config.variant) ? config.variant : '3x3'),
  createBot: () => createSlidingBot(),
  encodeMove: (move) => move,
};
