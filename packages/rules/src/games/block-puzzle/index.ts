import { createRng, type Rng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Block Puzzle (docs/games/block-puzzle.md): drop the three pieces you are dealt onto an 8 by 8
 * grid; a full row or column clears. When all three are down you get three more. The game ends
 * when none of the pieces in hand fits anywhere. Pieces never turn, and nothing falls.
 */
export const BLOCK_SIZE = 8;
export const BLOCK_CELLS = BLOCK_SIZE * BLOCK_SIZE;
/** Reaching this many points counts as a win, like reaching 2048. */
export const BLOCK_GOAL = 500;

/** Each shape as (x, y) cells from its top-left corner. */
export const BLOCK_SHAPES: readonly (readonly (readonly [number, number])[])[] = [
  [[0, 0]],
  [[0, 0], [1, 0]],
  [[0, 0], [0, 1]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [0, 1], [0, 2]],
  [[0, 0], [1, 0], [0, 1]],
  [[0, 0], [1, 0], [1, 1]],
  [[0, 0], [0, 1], [1, 1]],
  [[1, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [0, 1], [0, 2], [0, 3]],
  [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
  [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
  [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]],
  [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2]],
  [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]],
  [[2, 0], [2, 1], [0, 2], [1, 2], [2, 2]],
  [[0, 0], [1, 0], [2, 0], [1, 1]],
  [[1, 0], [0, 1], [1, 1], [2, 1]],
  [[0, 0], [0, 1], [1, 1], [0, 2]],
  [[1, 0], [0, 1], [1, 1], [1, 2]],
  [[0, 0], [1, 0], [1, 1], [2, 1]],
  [[1, 0], [2, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
];

/** `m<k>-<cell>`: put hand piece k with its top-left corner on that cell. */
export type BlockMove = string;

export class BlockState implements GameState<BlockMove> {
  readonly currentSeat: Seat = 0;

  constructor(
    readonly seed: number,
    /** Which piece color is on each cell, 0 for empty (the color is just the shape's index + 1). */
    readonly board: readonly number[],
    /** The pieces in hand, as shape indexes; null once placed. */
    readonly hand: readonly (number | null)[],
    readonly deals: number,
    readonly score: number,
    /** Lines cleared on the last move, in a row, for the combo. */
    readonly streak: number,
    readonly last: { cells: readonly number[]; cleared: readonly number[]; lines: number } | null,
    readonly result: GameResult | null,
  ) {}

  fits(shape: number, at: number): boolean {
    const x0 = at % BLOCK_SIZE;
    const y0 = Math.floor(at / BLOCK_SIZE);
    return BLOCK_SHAPES[shape]!.every(([dx, dy]) => {
      const x = x0 + dx;
      const y = y0 + dy;
      return x < BLOCK_SIZE && y < BLOCK_SIZE && this.board[y * BLOCK_SIZE + x] === 0;
    });
  }

  legalMoves(seat: Seat): readonly BlockMove[] {
    if (this.result || seat !== 0) return [];
    const moves: BlockMove[] = [];
    this.hand.forEach((shape, k) => {
      if (shape === null) return;
      for (let at = 0; at < BLOCK_CELLS; at++) if (this.fits(shape, at)) moves.push(`m${k}-${at}`);
    });
    return moves;
  }

  apply(move: BlockMove): BlockState {
    if (!this.legalMoves(0).includes(move)) throw new Error(`Illegal move: ${move}`);
    const [k, at] = move.slice(1).split('-').map(Number) as [number, number];
    const shape = this.hand[k]!;
    const board = this.board.slice();
    const cells = BLOCK_SHAPES[shape]!.map(([dx, dy]) => at + dy * BLOCK_SIZE + dx);
    for (const c of cells) board[c] = shape + 1;
    // Full rows and columns clear together, so a cell on both counts once.
    const full = new Set<number>();
    let lines = 0;
    for (let i = 0; i < BLOCK_SIZE; i++) {
      const rowCells = Array.from({ length: BLOCK_SIZE }, (_, x) => i * BLOCK_SIZE + x);
      const colCells = Array.from({ length: BLOCK_SIZE }, (_, y) => y * BLOCK_SIZE + i);
      if (rowCells.every((c) => board[c])) {
        lines++;
        rowCells.forEach((c) => full.add(c));
      }
      if (colCells.every((c) => board[c])) {
        lines++;
        colCells.forEach((c) => full.add(c));
      }
    }
    for (const c of full) board[c] = 0;
    const streak = lines ? this.streak + 1 : 0;
    // A point a cell placed; lines score more the more at once, and more again on a streak.
    const score = this.score + cells.length + (lines ? 10 * lines * lines * Math.min(streak, 3) : 0);
    let hand = this.hand.map((s, i) => (i === k ? null : s));
    let deals = this.deals;
    if (hand.every((s) => s === null)) {
      hand = dealHand(this.seed, deals);
      deals++;
    }
    const last = { cells, cleared: [...full], lines };
    const next = new BlockState(this.seed, board, hand, deals, score, streak, last, null);
    if (next.legalMoves(0).length === 0) return new BlockState(this.seed, board, hand, deals, score, streak, last, { winners: score >= BLOCK_GOAL ? [0] : [], draw: false });
    return next;
  }
}

/** The three pieces of deal number `n`, from the seed. */
export function dealHand(seed: number, n: number): number[] {
  const rng = createRng((seed ^ Math.imul(n + 1, 0x7feb352d)) >>> 0);
  return [0, 1, 2].map(() => rng.int(BLOCK_SHAPES.length));
}

export function newBlockPuzzle(seed: number): BlockState {
  return new BlockState(seed >>> 0, Array<number>(BLOCK_CELLS).fill(0), dealHand(seed >>> 0, 0), 1, 0, 0, null, null);
}

/** Test play: the placement that clears most, else the one that leaves the board most open. */
function createBlockBot(): Bot<BlockMove> {
  return {
    chooseMove(generic: GameState<BlockMove>, _seat: Seat, rng: Rng): BlockMove {
      const s = generic as BlockState;
      const moves = s.legalMoves(0);
      let best = -Infinity;
      let picks: BlockMove[] = [];
      for (const m of moves) {
        const next = s.apply(m);
        const open = next.result ? -1000 : next.legalMoves(0).length;
        const value = (next.last?.lines ?? 0) * 100 + open;
        if (value > best) {
          best = value;
          picks = [m];
        } else if (value === best) picks.push(m);
      }
      return rng.pick(picks);
    },
  };
}

export const blockPuzzle: GameDefinition<BlockMove> = {
  id: 'block-puzzle',
  name: 'Block Puzzle',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo', 'race'],
  hiddenInfo: false,
  realtime: false,
  newGame: (_config, seed) => newBlockPuzzle(seed),
  createBot: () => createBlockBot(),
  encodeMove: (move) => move,
};
