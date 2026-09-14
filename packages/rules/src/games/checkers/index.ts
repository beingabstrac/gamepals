import { createSearchBot, type SearchTier } from '../../core/bots';
import type { BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Checkers, English draughts rules (docs/games/checkers.md). The board is 64 squares, row by row
 * (row 0 at the top); pieces sit on dark squares, where row + column is odd.
 * Seat 0 is black: starts at the bottom and moves first, upward. Seat 1 is red: starts at the top.
 */
export const CheckerPiece = { empty: 0, blackMan: 1, blackKing: 2, redMan: 3, redKing: 4 } as const;
/** 40 moves each with no capture and no man moving is a draw. */
export const NO_PROGRESS_PLIES = 80;

const DIRS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

export const ownerOf = (piece: number): Seat | -1 => (piece === 0 ? -1 : piece <= 2 ? 0 : 1);
export const isKing = (piece: number): boolean => piece === CheckerPiece.blackKing || piece === CheckerPiece.redKing;
const forward = (seat: Seat) => (seat === 0 ? -1 : 1);
const crownRow = (seat: Seat) => (seat === 0 ? 0 : 7);
const inside = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;

/** A move is the path of squares a piece visits, e.g. `42-33` or `42-28-14` for a double jump. */
export type CheckersMove = string;

export interface CheckersEvent {
  readonly seat: Seat;
  readonly path: readonly number[];
  readonly captured: readonly number[];
  readonly crowned: boolean;
}

export function initialCheckersBoard(): number[] {
  return Array.from({ length: 64 }, (_, sq) => {
    const r = Math.floor(sq / 8);
    const c = sq % 8;
    if ((r + c) % 2 === 0) return CheckerPiece.empty;
    if (r <= 2) return CheckerPiece.redMan;
    if (r >= 5) return CheckerPiece.blackMan;
    return CheckerPiece.empty;
  });
}

/** Every full capture path for the piece on `from` (captures must continue until no jump is left). */
function capturePaths(board: readonly number[], from: number, seat: Seat): number[][] {
  const king = isKing(board[from]!);
  const dirs = king ? DIRS : DIRS.filter(([dr]) => dr === forward(seat));
  const results: number[][] = [];
  const walk = (square: number, path: number[], taken: Set<number>) => {
    let extended = false;
    const r = Math.floor(square / 8);
    const c = square % 8;
    for (const [dr, dc] of dirs) {
      if (!inside(r + 2 * dr, c + 2 * dc)) continue;
      const mid = (r + dr) * 8 + (c + dc);
      const land = (r + 2 * dr) * 8 + (c + 2 * dc);
      if (ownerOf(board[mid]!) !== 1 - seat || taken.has(mid)) continue;
      // The landing square must be empty (the square the piece started from counts as empty).
      if (board[land] !== CheckerPiece.empty && land !== from) continue;
      extended = true;
      // A man that reaches the far row is crowned and its move ends there.
      if (!king && Math.floor(land / 8) === crownRow(seat)) results.push([...path, land]);
      else walk(land, [...path, land], new Set(taken).add(mid));
    }
    if (!extended && path.length > 1) results.push(path);
  };
  walk(from, [from], new Set());
  return results;
}

function stepMoves(board: readonly number[], from: number, seat: Seat): number[][] {
  const dirs = isKing(board[from]!) ? DIRS : DIRS.filter(([dr]) => dr === forward(seat));
  const r = Math.floor(from / 8);
  const c = from % 8;
  const out: number[][] = [];
  for (const [dr, dc] of dirs) {
    if (!inside(r + dr, c + dc)) continue;
    const to = (r + dr) * 8 + (c + dc);
    if (board[to] === CheckerPiece.empty) out.push([from, to]);
  }
  return out;
}

/** Legal moves for `seat`: only captures when any capture exists. */
function movesFor(board: readonly number[], seat: Seat): CheckersMove[] {
  const captures: number[][] = [];
  const steps: number[][] = [];
  board.forEach((piece, sq) => {
    if (ownerOf(piece) !== seat) return;
    captures.push(...capturePaths(board, sq, seat));
    steps.push(...stepMoves(board, sq, seat));
  });
  return (captures.length ? captures : steps).map((path) => path.join('-'));
}

const keyOf = (board: readonly number[], toMove: Seat) => `${board.join('')}${toMove}`;

export class CheckersState implements GameState<CheckersMove> {
  private cachedMoves: CheckersMove[] | null = null;

  constructor(
    readonly board: readonly number[],
    readonly currentSeat: Seat,
    /** Plies since the last capture or man move. */
    readonly quiet: number,
    /** How often each position has come up since the last capture or man move. */
    readonly seen: ReadonlyMap<string, number>,
    readonly result: GameResult | null,
    readonly last: CheckersEvent | null,
  ) {}

  legalMoves(seat: Seat): readonly CheckersMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    this.cachedMoves ??= movesFor(this.board, seat);
    return this.cachedMoves;
  }

  /** Squares holding pieces that can move now (all of them must capture if any can). */
  movablePieces(): number[] {
    return [...new Set(this.legalMoves(this.currentSeat).map((m) => Number(m.split('-')[0])))];
  }

  apply(move: CheckersMove): CheckersState {
    if (this.result) throw new Error('Game is over');
    if (!this.legalMoves(this.currentSeat).includes(move)) throw new Error(`Illegal move: ${move}`);
    const seat = this.currentSeat;
    const path = move.split('-').map(Number);
    const board = this.board.slice();
    const piece = board[path[0]!]!;
    const captured: number[] = [];
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]!;
      const b = path[i]!;
      if (Math.abs(Math.floor(a / 8) - Math.floor(b / 8)) === 2) captured.push((a + b) / 2);
    }
    for (const sq of captured) board[sq] = CheckerPiece.empty;
    board[path[0]!] = CheckerPiece.empty;
    const end = path[path.length - 1]!;
    const crowned = !isKing(piece) && Math.floor(end / 8) === crownRow(seat);
    board[end] = crowned ? (seat === 0 ? CheckerPiece.blackKing : CheckerPiece.redKing) : piece;

    const next: Seat = seat === 0 ? 1 : 0;
    const progress = captured.length > 0 || !isKing(piece);
    const quiet = progress ? 0 : this.quiet + 1;
    const key = keyOf(board, next);
    const seen = new Map(progress ? [] : this.seen);
    seen.set(key, (seen.get(key) ?? 0) + 1);
    const event: CheckersEvent = { seat, path, captured, crowned };

    const probe = new CheckersState(board, next, quiet, seen, null, event);
    let result: GameResult | null = null;
    if (probe.legalMoves(next).length === 0) result = { winners: [seat], draw: false };
    else if (quiet >= NO_PROGRESS_PLIES || seen.get(key)! >= 3) result = { winners: [], draw: true };
    return result ? new CheckersState(board, next, quiet, seen, result, event) : probe;
  }
}

/** A position for tests and puzzles: any board, any side to move. */
export function checkersFrom(board: readonly number[], toMove: Seat): CheckersState {
  return new CheckersState(board, toMove, 0, new Map([[keyOf(board, toMove), 1]]), null, null);
}

export function newCheckers(): CheckersState {
  return checkersFrom(initialCheckersBoard(), 0);
}

/**
 * Position value for `seat`. Everyone counts material (kings worth more); the sharper bots also like
 * advancing men, keeping the back row guarded and holding the center.
 */
function evaluate(sharp: boolean) {
  return (generic: GameState<CheckersMove>, seat: Seat): number => {
    const state = generic as CheckersState;
    let score = 0;
    state.board.forEach((piece, sq) => {
      if (piece === CheckerPiece.empty) return;
      const owner = ownerOf(piece);
      const row = Math.floor(sq / 8);
      const col = sq % 8;
      let value = isKing(piece) ? 160 : 100;
      if (!isKing(piece)) {
        const advance = owner === 0 ? 7 - row : row;
        value += sharp ? advance * 3 : advance;
        if (sharp && row === (owner === 0 ? 7 : 0)) value += 10;
      }
      if (sharp && row >= 2 && row <= 5 && col >= 2 && col <= 5) value += 6;
      score += owner === seat ? value : -value;
    });
    return score;
  };
}

const TIERS: Record<BotTier, SearchTier & { sharp: boolean }> = {
  easy: { depth: 2, randomMoveRate: 0.3, sharp: false },
  medium: { depth: 4, randomMoveRate: 0.08, sharp: false },
  hard: { depth: 5, randomMoveRate: 0.02, sharp: true },
  expert: { depth: 6, randomMoveRate: 0, sharp: true },
};

export const checkers: GameDefinition<CheckersMove> = {
  id: 'checkers',
  name: 'Checkers',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: false,
  realtime: false,
  newGame: () => newCheckers(),
  createBot: (tier) => createSearchBot(TIERS[tier], evaluate(TIERS[tier].sharp)),
  encodeMove: (move) => move,
};
