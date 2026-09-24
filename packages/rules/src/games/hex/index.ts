import type { Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Hex (docs/games/hex.md) on 11 by 11. Red (seat 0) joins the top edge to the bottom, Blue joins
 * left to right, one stone a turn. Somebody always gets through, so there are no draws. Going
 * first is a big edge, so Blue may answer Red's first stone by swapping: the stone becomes Blue's,
 * reflected across the long diagonal, and Red plays again.
 */
export const HEX_SIZE = 11;
export const HEX_CELLS = HEX_SIZE * HEX_SIZE;

const NEIGHBORS: readonly (readonly number[])[] = Array.from({ length: HEX_CELLS }, (_, p) => {
  const x = p % HEX_SIZE;
  const y = Math.floor(p / HEX_SIZE);
  const out: number[] = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]] as const) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < HEX_SIZE && ny < HEX_SIZE) out.push(ny * HEX_SIZE + nx);
  }
  return out;
});

/** The chain joining `color`'s two edges, or null. Red (1) goes top to bottom, Blue (2) left to right. */
export function hexPath(board: ArrayLike<number>, color: number): number[] | null {
  const starts: number[] = [];
  for (let i = 0; i < HEX_SIZE; i++) {
    const p = color === 1 ? i : i * HEX_SIZE;
    if (board[p] === color) starts.push(p);
  }
  const from = new Map<number, number>();
  const queue = [...starts];
  for (const s of starts) from.set(s, -1);
  while (queue.length) {
    const p = queue.shift()!;
    const x = p % HEX_SIZE;
    const y = Math.floor(p / HEX_SIZE);
    if ((color === 1 && y === HEX_SIZE - 1) || (color === 2 && x === HEX_SIZE - 1)) {
      const path: number[] = [];
      for (let q = p; q !== -1; q = from.get(q)!) path.push(q);
      return path;
    }
    for (const n of NEIGHBORS[p]!) {
      if (board[n] === color && !from.has(n)) {
        from.set(n, p);
        queue.push(n);
      }
    }
  }
  return null;
}

/** `p<cell>` places a stone; `swap` takes Red's first stone over. */
export type HexMove = string;

export class HexState implements GameState<HexMove> {
  constructor(
    /** 0 empty, 1 red, 2 blue. */
    readonly board: readonly number[],
    readonly currentSeat: Seat,
    readonly moves: number,
    readonly swapped: boolean,
    readonly last: number | null,
    readonly path: readonly number[] | null,
    readonly result: GameResult | null,
  ) {}

  legalMoves(seat: Seat): readonly HexMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    const moves: HexMove[] = [];
    for (let p = 0; p < HEX_CELLS; p++) if (this.board[p] === 0) moves.push(`p${p}`);
    // Only Blue, only straight after Red's first stone.
    if (this.moves === 1 && seat === 1) moves.push('swap');
    return moves;
  }

  apply(move: HexMove): HexState {
    if (!this.legalMoves(this.currentSeat).includes(move)) throw new Error(`Illegal move: ${move}`);
    const seat = this.currentSeat;
    const other: Seat = seat === 0 ? 1 : 0;
    const board = this.board.slice();
    if (move === 'swap') {
      const first = board.indexOf(1);
      board[first] = 0;
      const mirror = (first % HEX_SIZE) * HEX_SIZE + Math.floor(first / HEX_SIZE);
      board[mirror] = 2;
      return new HexState(board, other, this.moves + 1, true, mirror, null, null);
    }
    const p = Number(move.slice(1));
    board[p] = seat + 1;
    const path = hexPath(board, seat + 1);
    return new HexState(board, other, this.moves + 1, this.swapped, p, path, path ? { winners: [seat], draw: false } : null);
  }
}

export function newHex(): HexState {
  return new HexState(Array<number>(HEX_CELLS).fill(0), 0, 0, false, null, null, null);
}

export interface HexTier {
  readonly playouts: number;
  readonly random: number;
}

export const HEX_TIERS: Record<BotTier, HexTier> = {
  easy: { playouts: 200, random: 0.25 },
  medium: { playouts: 1500, random: 0.05 },
  hard: { playouts: 5000, random: 0 },
  expert: { playouts: 40000, random: 0 },
};

/**
 * Monte Carlo with all-moves-as-first: fill the rest of the board at random many times (a full
 * Hex board always has exactly one winner), and score each empty cell by how often the games in
 * which it went our way were ours. Cheap, and it sees the bridges and edges Hex is about.
 */
export function chooseHexMove(state: HexState, tier: HexTier, rng: Rng): HexMove {
  const seat = state.currentSeat;
  const color = seat + 1;
  const empties: number[] = [];
  for (let p = 0; p < HEX_CELLS; p++) if (state.board[p] === 0) empties.push(p);
  if (rng.next() < tier.random) return `p${rng.pick(empties)}`;
  // A win now, or blocking theirs, needs no sampling.
  for (const who of [color, 3 - color]) {
    for (const p of empties) {
      const board = state.board.slice();
      board[p] = who;
      if (hexPath(board, who)) return `p${p}`;
    }
  }
  // Swap a strong opening: anything near the middle is worth taking over.
  if (state.moves === 1 && seat === 1) {
    const first = state.board.indexOf(1);
    const x = first % HEX_SIZE;
    const y = Math.floor(first / HEX_SIZE);
    if (Math.abs(x - 5) + Math.abs(y - 5) <= 4) return 'swap';
  }
  const wins = new Float64Array(HEX_CELLS);
  const tries = new Float64Array(HEX_CELLS);
  const board = new Int8Array(HEX_CELLS);
  const order = empties.slice();
  const mine = Math.ceil(empties.length / 2);
  for (let n = 0; n < tier.playouts; n++) {
    for (let i = order.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    for (let p = 0; p < HEX_CELLS; p++) board[p] = state.board[p]!;
    // We move first, so we get the first half of the shuffled cells.
    order.forEach((p, i) => (board[p] = i < mine ? color : 3 - color));
    const won = hexPath(board, color) !== null;
    for (let i = 0; i < mine; i++) {
      const p = order[i]!;
      tries[p]++;
      if (won) wins[p]++;
    }
  }
  let best = empties[0]!;
  let bestRate = -1;
  for (const p of empties) {
    const rate = tries[p] ? wins[p]! / tries[p]! : 0;
    if (rate > bestRate) {
      bestRate = rate;
      best = p;
    }
  }
  return `p${best}`;
}

export const hex: GameDefinition<HexMove> = {
  id: 'hex',
  name: 'Hex',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: false,
  realtime: false,
  newGame: () => newHex(),
  createBot: (tier): Bot<HexMove> => ({
    chooseMove: (state, _seat, rng) => chooseHexMove(state as HexState, HEX_TIERS[tier], rng),
  }),
  encodeMove: (move) => move,
};
