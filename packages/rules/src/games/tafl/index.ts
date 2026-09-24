import { createSearchBot, type SearchTier } from '../../core/bots';
import type { BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Hnefatafl (docs/games/tafl.md), the Viking board game, on the Copenhagen rules: 11 by 11, the
 * attackers (seat 0, moving first) against the king and his defenders (seat 1). Every piece moves
 * like a rook. Trap a piece between two of yours to take it. The king escapes to a corner; the
 * attackers win by surrounding him.
 */
export const TAFL_SIZE = 11;
export const TAFL_SQUARES = TAFL_SIZE * TAFL_SIZE;
export const THRONE = 60;
export const TAFL_CORNERS: readonly number[] = [0, 10, 110, 120];
/** Plies with no end before it is called a draw. */
export const TAFL_MOVE_LIMIT = 300;

/** 0 empty, 1 attacker, 2 defender, 3 king. */
export const TAFL_ATTACKER = 1;
export const TAFL_DEFENDER = 2;
export const TAFL_KING = 3;

const sq = (x: number, y: number) => y * TAFL_SIZE + x;
const isRestricted = (p: number) => p === THRONE || TAFL_CORNERS.includes(p);
const onEdge = (p: number) => {
  const x = p % TAFL_SIZE;
  const y = Math.floor(p / TAFL_SIZE);
  return x === 0 || y === 0 || x === TAFL_SIZE - 1 || y === TAFL_SIZE - 1;
};
const DIRS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
function step(p: number, dx: number, dy: number): number | null {
  const x = (p % TAFL_SIZE) + dx;
  const y = Math.floor(p / TAFL_SIZE) + dy;
  return x < 0 || y < 0 || x >= TAFL_SIZE || y >= TAFL_SIZE ? null : sq(x, y);
}

export function taflStart(): number[] {
  const board = Array<number>(TAFL_SQUARES).fill(0);
  for (const i of [3, 4, 5, 6, 7]) {
    board[sq(i, 0)] = TAFL_ATTACKER;
    board[sq(i, 10)] = TAFL_ATTACKER;
    board[sq(0, i)] = TAFL_ATTACKER;
    board[sq(10, i)] = TAFL_ATTACKER;
  }
  for (const p of [sq(5, 1), sq(5, 9), sq(1, 5), sq(9, 5)]) board[p] = TAFL_ATTACKER;
  for (const [x, y] of [[5, 3], [4, 4], [5, 4], [6, 4], [3, 5], [4, 5], [6, 5], [7, 5], [4, 6], [5, 6], [6, 6], [5, 7]] as const) board[sq(x, y)] = TAFL_DEFENDER;
  board[THRONE] = TAFL_KING;
  return board;
}

const sideOf = (piece: number): Seat | null => (piece === TAFL_ATTACKER ? 0 : piece === TAFL_DEFENDER || piece === TAFL_KING ? 1 : null);

/** `m<from>-<to>`. */
export type TaflMove = string;

export class TaflState implements GameState<TaflMove> {
  constructor(
    readonly board: readonly number[],
    readonly currentSeat: Seat,
    readonly plies: number,
    /** The position before this one, for the repetition rule; a capture cuts the chain, since nothing before it can come back. */
    readonly prev: TaflState | null,
    readonly last: { from: number; to: number; captured: readonly number[] } | null,
    readonly result: GameResult | null,
  ) {}

  get king(): number {
    return this.board.indexOf(TAFL_KING);
  }

  /** Where the piece on `from` can go: any empty run of squares along its row or column. */
  destinations(from: number): number[] {
    const piece = this.board[from]!;
    const out: number[] = [];
    for (const [dx, dy] of DIRS) {
      let p = step(from, dx, dy);
      while (p !== null && this.board[p] === 0) {
        // Only the king may stop on the throne or a corner; anyone may pass over the empty throne.
        if (!isRestricted(p) || piece === TAFL_KING) out.push(p);
        p = step(p, dx, dy);
      }
    }
    return out;
  }

  legalMoves(seat: Seat): readonly TaflMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    const moves: TaflMove[] = [];
    this.board.forEach((piece, from) => {
      if (sideOf(piece) !== seat) return;
      for (const to of this.destinations(from)) moves.push(`m${from}-${to}`);
    });
    return moves;
  }

  apply(move: TaflMove): TaflState {
    if (!this.legalMoves(this.currentSeat).includes(move)) throw new Error(`Illegal move: ${move}`);
    const seat = this.currentSeat;
    const [from, to] = move.slice(1).split('-').map(Number) as [number, number];
    const board = this.board.slice();
    board[to] = board[from]!;
    board[from] = 0;
    const captured = captures(board, to, seat);
    for (const p of captured) board[p] = 0;
    const other: Seat = seat === 0 ? 1 : 0;
    const last = { from, to, captured };
    const plies = this.plies + 1;
    const prev = captured.length ? null : this;
    const done = (result: GameResult) => new TaflState(board, other, plies, prev, last, result);
    if (TAFL_CORNERS.includes(to) && board[to] === TAFL_KING) return done({ winners: [1], draw: false });
    if (seat === 0 && kingTaken(board)) return done({ winners: [0], draw: false });
    // Going round in circles is on the defenders: a third time the same position is theirs to lose.
    if (repeats(board, other, prev) >= 2) return done({ winners: [0], draw: false });
    const next = new TaflState(board, other, plies, prev, last, null);
    if (next.legalMoves(other).length === 0) return done({ winners: [seat], draw: false });
    if (plies >= TAFL_MOVE_LIMIT) return done({ winners: [], draw: true });
    return next;
  }
}

/** Is `p` hostile to a piece of `side`: a friend of the other side, a corner, or the throne (empty, or always for attackers)? */
function hostile(board: readonly number[], p: number, side: Seat): boolean {
  const piece = board[p]!;
  if (piece !== 0) return sideOf(piece) !== side;
  if (TAFL_CORNERS.includes(p)) return true;
  if (p === THRONE) return true;
  return false;
}

/** The pieces the move to `to` traps. The king cannot be trapped this way; he is surrounded instead. */
function captures(board: readonly number[], to: number, seat: Seat): number[] {
  const enemy: Seat = seat === 0 ? 1 : 0;
  const taken: number[] = [];
  for (const [dx, dy] of DIRS) {
    const n = step(to, dx, dy);
    if (n === null) continue;
    const piece = board[n]!;
    if (sideOf(piece) !== enemy || piece === TAFL_KING) continue;
    const far = step(n, dx, dy);
    if (far === null) continue;
    // The king on his throne does not make it hostile to his own men; an empty throne is.
    if (far === THRONE && board[far] === TAFL_KING && enemy === 1) continue;
    if (hostile(board, far, enemy)) taken.push(n);
  }
  return taken;
}

/** Surrounded on four sides by attackers, or three and the throne; never on the edge. */
function kingTaken(board: readonly number[]): boolean {
  const k = board.indexOf(TAFL_KING);
  if (k < 0) return true;
  if (onEdge(k)) return false;
  return DIRS.every(([dx, dy]) => {
    const n = step(k, dx, dy)!;
    return board[n] === TAFL_ATTACKER || n === THRONE;
  });
}

export function newTafl(): TaflState {
  return new TaflState(taflStart(), 0, 0, null, null, null);
}

/** How many earlier positions, back to the last capture, match this one with the same side to move. */
function repeats(board: readonly number[], toMove: Seat, prev: TaflState | null): number {
  let count = 0;
  for (let s = prev; s; s = s.prev) {
    if (s.currentSeat !== toMove) continue;
    let same = true;
    for (let i = 0; i < TAFL_SQUARES; i++) {
      if (s.board[i] !== board[i]) {
        same = false;
        break;
      }
    }
    if (same) count++;
  }
  return count;
}

/**
 * The diagonal of three that seals each corner: (2,0), (1,1), (0,2) and their mirrors. Pieces there
 * cannot be trapped against the corner, which is why attackers build it.
 */
const CORNER_SEALS: readonly (readonly number[])[] = [
  [2, 12, 22],
  [8, 20, 32],
  [88, 100, 112],
  [98, 108, 118],
];

/** Squares the king could reach a corner from in one move along a clear line. */
function clearToCorner(board: readonly number[], k: number): number {
  let lines = 0;
  for (const [dx, dy] of DIRS) {
    let p = step(k, dx, dy);
    while (p !== null && board[p] === 0) {
      if (TAFL_CORNERS.includes(p)) lines++;
      p = step(p, dx, dy);
    }
    if (p !== null && TAFL_CORNERS.includes(p) && board[p] === 0) lines++;
  }
  return lines;
}

/** From the defenders' side: the king's open roads and nearness to a corner, material, and attackers close round him. */
function evaluate(state: GameState<TaflMove>, seat: Seat): number {
  const board = (state as TaflState).board;
  const k = board.indexOf(TAFL_KING);
  let attackers = 0;
  let defenders = 0;
  for (const piece of board) {
    if (piece === TAFL_ATTACKER) attackers++;
    else if (piece === TAFL_DEFENDER) defenders++;
  }
  const kx = k % TAFL_SIZE;
  const ky = Math.floor(k / TAFL_SIZE);
  const nearest = Math.min(kx + ky, 10 - kx + ky, kx + 10 - ky, 20 - kx - ky);
  let pressed = 0;
  for (const [dx, dy] of DIRS) {
    const n = step(k, dx, dy);
    if (n !== null && board[n] === TAFL_ATTACKER) pressed++;
  }
  const open = clearToCorner(board, k);
  // Attackers on the squares beside a corner shut it: the whole of their early game.
  let guards = 0;
  for (const seal of CORNER_SEALS) {
    const held = seal.filter((p) => board[p] === TAFL_ATTACKER).length;
    guards += held + (held === 3 ? 3 : 0);
  }
  // Roads one move away: squares the king can reach that have a clear line to a corner.
  let near = 0;
  for (const [dx, dy] of DIRS) {
    let p = step(k, dx, dy);
    while (p !== null && board[p] === 0) {
      if (clearToCorner(board, p) > 0) near++;
      p = step(p, dx, dy);
    }
  }
  // Whose turn it is decides what an open road means: on his own turn the king just goes, and on
  // the attackers' turn two roads are a fork they cannot block both of. A shallow search cannot see
  // that coming, so the evaluation says it.
  const toMove = (state as TaflState).currentSeat;
  const gone = (toMove === 1 && open >= 1) || (toMove === 0 && open >= 2);
  const score = (gone ? 5000 : 0) + open * 80 + near * 12 + (20 - nearest) * 2 + defenders * 12 - attackers * 7 - pressed * 10 - guards * 22;
  return seat === 1 ? score : -score;
}

/**
 * With a hundred-odd moves a side, a third ply costs twenty seconds a move, so the top two tiers
 * both look two plies ahead and Hard slips now and then where Expert never does.
 */
const TIERS: Record<BotTier, SearchTier> = {
  easy: { depth: 1, randomMoveRate: 0.35 },
  medium: { depth: 1, randomMoveRate: 0.05 },
  hard: { depth: 2, randomMoveRate: 0.12 },
  expert: { depth: 2, randomMoveRate: 0 },
};

export const tafl: GameDefinition<TaflMove> = {
  id: 'tafl',
  name: 'Hnefatafl',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: false,
  realtime: false,
  newGame: () => newTafl(),
  createBot: (tier) => createSearchBot(TIERS[tier], evaluate),
  encodeMove: (move) => move,
};
