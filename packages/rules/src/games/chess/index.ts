import type { Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Chess (docs/games/chess.md): our own engine, no GPL code. Squares are 0 = a1 to 63 = h8.
 * A piece is its type (1–6) plus 8 for black. Moves are written the way players write them:
 * `e2e4`, and `e7e8q` for a promotion.
 */
export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;
const BLACK_BIT = 8;

export const typeOf = (piece: number): number => piece & 7;
export const colorOf = (piece: number): Seat => ((piece & BLACK_BIT) === 0 ? 0 : 1);
export const pieceFor = (type: number, color: Seat): number => type | (color === 1 ? BLACK_BIT : 0);

const FILES = 'abcdefgh';
export const squareName = (square: number): string => `${FILES[square & 7]}${(square >> 3) + 1}`;
export const squareIndex = (name: string): number => FILES.indexOf(name[0]!) + (Number(name[1]) - 1) * 8;

/** Castling rights, one bit each. */
export const WHITE_KING_SIDE = 1;
export const WHITE_QUEEN_SIDE = 2;
export const BLACK_KING_SIDE = 4;
export const BLACK_QUEEN_SIDE = 8;

const KNIGHT_STEPS = [17, 15, 10, 6, -6, -10, -15, -17];
const KING_STEPS = [9, 8, 7, 1, -1, -7, -8, -9];
const BISHOP_DIRS = [9, 7, -7, -9];
const ROOK_DIRS = [8, 1, -1, -8];

/** How far a step moves across the board, so moves can't wrap around an edge. */
const fileShift = (delta: number): number => {
  const size = Math.abs(delta);
  return size === 8 ? 0 : size === 10 || size === 6 ? 2 : 1;
};

/** The square `delta` away, or -1 if that would fall off the board or wrap. */
function stepTo(from: number, delta: number): number {
  const to = from + delta;
  if (to < 0 || to > 63) return -1;
  return Math.abs((to & 7) - (from & 7)) === fileShift(delta) ? to : -1;
}

export interface Move {
  readonly from: number;
  readonly to: number;
  /** The piece a pawn becomes. */
  readonly promotion?: number;
}

/** A board and everything else the rules need. Mutable: the search makes and takes back moves. */
export interface Position {
  board: number[];
  toMove: Seat;
  castling: number;
  /** The square a pawn may be captured on this turn, or null. */
  ep: number | null;
  /** Half moves since the last capture or pawn move (the 50-move rule counts to 100). */
  halfmove: number;
}

const clone = (pos: Position): Position => ({ board: pos.board.slice(), toMove: pos.toMove, castling: pos.castling, ep: pos.ep, halfmove: pos.halfmove });
const other = (color: Seat): Seat => (color === 0 ? 1 : 0);

export function findKing(board: readonly number[], color: Seat): number {
  const king = pieceFor(KING, color);
  return board.indexOf(king);
}

/** Is `square` attacked by any piece of `by`? */
export function isAttacked(board: readonly number[], square: number, by: Seat): boolean {
  // Pawns: a pawn of `by` sits one diagonal step "behind" the square.
  const back = by === 0 ? [-9, -7] : [9, 7];
  for (const delta of back) {
    const from = stepTo(square, delta);
    if (from >= 0 && board[from] === pieceFor(PAWN, by)) return true;
  }
  for (const delta of KNIGHT_STEPS) {
    const from = stepTo(square, delta);
    if (from >= 0 && board[from] === pieceFor(KNIGHT, by)) return true;
  }
  for (const delta of KING_STEPS) {
    const from = stepTo(square, delta);
    if (from >= 0 && board[from] === pieceFor(KING, by)) return true;
  }
  for (const [dirs, slider] of [
    [ROOK_DIRS, ROOK],
    [BISHOP_DIRS, BISHOP],
  ] as const) {
    for (const delta of dirs) {
      let at = stepTo(square, delta);
      while (at >= 0) {
        const piece = board[at]!;
        if (piece !== 0) {
          if (colorOf(piece) === by && (typeOf(piece) === slider || typeOf(piece) === QUEEN)) return true;
          break;
        }
        at = stepTo(at, delta);
      }
    }
  }
  return false;
}

export const inCheck = (pos: Position, color: Seat = pos.toMove): boolean => isAttacked(pos.board, findKing(pos.board, color), other(color));

/** Every move that looks right for the piece, before checking whether the king is left in danger. */
function pseudoMoves(pos: Position): Move[] {
  const moves: Move[] = [];
  const me = pos.toMove;
  const forward = me === 0 ? 8 : -8;
  const startRank = me === 0 ? 1 : 6;
  const lastRank = me === 0 ? 7 : 0;
  const add = (from: number, to: number) => {
    if ((to >> 3) === lastRank) for (const promo of [QUEEN, ROOK, BISHOP, KNIGHT]) moves.push({ from, to, promotion: promo });
    else moves.push({ from, to });
  };

  for (let from = 0; from < 64; from++) {
    const piece = pos.board[from]!;
    if (piece === 0 || colorOf(piece) !== me) continue;
    const type = typeOf(piece);
    if (type === PAWN) {
      const one = stepTo(from, forward);
      if (one >= 0 && pos.board[one] === 0) {
        add(from, one);
        const two = stepTo(one, forward);
        if ((from >> 3) === startRank && two >= 0 && pos.board[two] === 0) moves.push({ from, to: two });
      }
      for (const delta of [forward + 1, forward - 1]) {
        const to = stepTo(from, delta);
        if (to < 0) continue;
        const target = pos.board[to]!;
        if (target !== 0 && colorOf(target) !== me) add(from, to);
        else if (target === 0 && to === pos.ep) moves.push({ from, to });
      }
      continue;
    }
    if (type === KNIGHT || type === KING) {
      for (const delta of type === KNIGHT ? KNIGHT_STEPS : KING_STEPS) {
        const to = stepTo(from, delta);
        if (to < 0) continue;
        const target = pos.board[to]!;
        if (target === 0 || colorOf(target) !== me) moves.push({ from, to });
      }
      continue;
    }
    const dirs = type === BISHOP ? BISHOP_DIRS : type === ROOK ? ROOK_DIRS : [...ROOK_DIRS, ...BISHOP_DIRS];
    for (const delta of dirs) {
      let to = stepTo(from, delta);
      while (to >= 0) {
        const target = pos.board[to]!;
        if (target === 0) moves.push({ from, to });
        else {
          if (colorOf(target) !== me) moves.push({ from, to });
          break;
        }
        to = stepTo(to, delta);
      }
    }
  }

  // Castling: rights, empty squares between, and the king never in or through check.
  const home = me === 0 ? 4 : 60;
  const kingSide = me === 0 ? WHITE_KING_SIDE : BLACK_KING_SIDE;
  const queenSide = me === 0 ? WHITE_QUEEN_SIDE : BLACK_QUEEN_SIDE;
  if (pos.board[home] === pieceFor(KING, me) && !isAttacked(pos.board, home, other(me))) {
    if ((pos.castling & kingSide) !== 0 && pos.board[home + 1] === 0 && pos.board[home + 2] === 0 && !isAttacked(pos.board, home + 1, other(me))) {
      moves.push({ from: home, to: home + 2 });
    }
    if ((pos.castling & queenSide) !== 0 && pos.board[home - 1] === 0 && pos.board[home - 2] === 0 && pos.board[home - 3] === 0 && !isAttacked(pos.board, home - 1, other(me))) {
      moves.push({ from: home, to: home - 2 });
    }
  }
  return moves;
}

interface Undo {
  readonly captured: number;
  readonly capturedSquare: number;
  readonly castling: number;
  readonly ep: number | null;
  readonly halfmove: number;
  readonly rookFrom: number;
  readonly rookTo: number;
}

/** Rights a move takes away: moving a king or rook, or capturing a rook on its home square. */
const RIGHT_BY_SQUARE: Record<number, number> = {
  0: WHITE_QUEEN_SIDE,
  7: WHITE_KING_SIDE,
  56: BLACK_QUEEN_SIDE,
  63: BLACK_KING_SIDE,
};

export function doMove(pos: Position, move: Move): Undo {
  const piece = pos.board[move.from]!;
  const me = colorOf(piece);
  const type = typeOf(piece);
  let capturedSquare = move.to;
  if (type === PAWN && move.to === pos.ep && pos.board[move.to] === 0) capturedSquare = move.to + (me === 0 ? -8 : 8);
  const captured = pos.board[capturedSquare]!;
  const undo: Undo = { captured, capturedSquare, castling: pos.castling, ep: pos.ep, halfmove: pos.halfmove, rookFrom: -1, rookTo: -1 };

  pos.board[capturedSquare] = 0;
  pos.board[move.from] = 0;
  pos.board[move.to] = move.promotion ? pieceFor(move.promotion, me) : piece;

  let rookFrom = -1;
  let rookTo = -1;
  if (type === KING && Math.abs(move.to - move.from) === 2) {
    const kingSide = move.to > move.from;
    rookFrom = kingSide ? move.from + 3 : move.from - 4;
    rookTo = kingSide ? move.from + 1 : move.from - 1;
    pos.board[rookTo] = pos.board[rookFrom]!;
    pos.board[rookFrom] = 0;
  }

  pos.castling &= ~(RIGHT_BY_SQUARE[move.from] ?? 0);
  pos.castling &= ~(RIGHT_BY_SQUARE[capturedSquare] ?? 0);
  if (type === KING) pos.castling &= me === 0 ? ~(WHITE_KING_SIDE | WHITE_QUEEN_SIDE) : ~(BLACK_KING_SIDE | BLACK_QUEEN_SIDE);
  pos.ep = type === PAWN && Math.abs(move.to - move.from) === 16 ? (move.from + move.to) / 2 : null;
  pos.halfmove = type === PAWN || captured !== 0 ? 0 : pos.halfmove + 1;
  pos.toMove = other(me);
  return { ...undo, rookFrom, rookTo };
}

export function undoMove(pos: Position, move: Move, undo: Undo): void {
  const moved = pos.board[move.to]!;
  const me = colorOf(moved);
  pos.board[move.from] = move.promotion ? pieceFor(PAWN, me) : moved;
  pos.board[move.to] = 0;
  if (undo.captured !== 0) pos.board[undo.capturedSquare] = undo.captured;
  if (undo.rookFrom >= 0) {
    pos.board[undo.rookFrom] = pos.board[undo.rookTo]!;
    pos.board[undo.rookTo] = 0;
  }
  pos.castling = undo.castling;
  pos.ep = undo.ep;
  pos.halfmove = undo.halfmove;
  pos.toMove = me;
}

/** Every legal move: pseudo-legal moves that don't leave your own king attacked. */
export function legalMovesOf(pos: Position): Move[] {
  const me = pos.toMove;
  const legal: Move[] = [];
  for (const move of pseudoMoves(pos)) {
    const undo = doMove(pos, move);
    if (!isAttacked(pos.board, findKing(pos.board, me), other(me))) legal.push(move);
    undoMove(pos, move, undo);
  }
  return legal;
}

export type ChessMove = string;
const PROMO_LETTER: Record<number, string> = { [QUEEN]: 'q', [ROOK]: 'r', [BISHOP]: 'b', [KNIGHT]: 'n' };
const LETTER_PROMO: Record<string, number> = { q: QUEEN, r: ROOK, b: BISHOP, n: KNIGHT };
export const writeMove = (move: Move): ChessMove => `${squareName(move.from)}${squareName(move.to)}${move.promotion ? PROMO_LETTER[move.promotion] : ''}`;
export const readMove = (text: ChessMove): Move => ({
  from: squareIndex(text.slice(0, 2)),
  to: squareIndex(text.slice(2, 4)),
  ...(text.length > 4 ? { promotion: LETTER_PROMO[text[4]!] } : {}),
});

export interface ChessEvent {
  readonly seat: Seat;
  readonly move: Move;
  readonly piece: number;
  readonly captured: number;
  /** Where the captured piece stood (not the landing square, for en passant). */
  readonly capturedSquare: number;
  readonly castleRook: { readonly from: number; readonly to: number } | null;
  readonly check: boolean;
}

const START_BOARD = (): number[] => {
  const board = Array<number>(64).fill(0);
  const back = [ROOK, KNIGHT, BISHOP, QUEEN, KING, BISHOP, KNIGHT, ROOK];
  for (let file = 0; file < 8; file++) {
    board[file] = pieceFor(back[file]!, 0);
    board[8 + file] = pieceFor(PAWN, 0);
    board[48 + file] = pieceFor(PAWN, 1);
    board[56 + file] = pieceFor(back[file]!, 1);
  }
  return board;
};

const keyOf = (pos: Position): string => `${pos.board.join('')}|${pos.toMove}|${pos.castling}|${pos.ep ?? '-'}`;

/** King and one minor piece, or bare kings: nobody can mate. */
export function insufficientMaterial(board: readonly number[]): boolean {
  const pieces = board.filter((p) => p !== 0);
  if (pieces.length > 4) return false;
  const others = pieces.filter((p) => typeOf(p) !== KING);
  if (others.length === 0) return true;
  if (others.length === 1) return typeOf(others[0]!) === BISHOP || typeOf(others[0]!) === KNIGHT;
  if (others.length === 2 && others.every((p) => typeOf(p) === BISHOP)) {
    // Both bishops on the same colour square: still no mate.
    const squares = board.flatMap((p, i) => (typeOf(p) === BISHOP ? [i] : []));
    return squares.every((s) => ((s >> 3) + (s & 7)) % 2 === ((squares[0]! >> 3) + (squares[0]! & 7)) % 2);
  }
  return false;
}

export class ChessState implements GameState<ChessMove> {
  private cached?: ChessMove[];

  constructor(
    readonly position: Position,
    /** Position keys since the last capture, pawn move or lost castling right, for the three-times rule. */
    readonly history: readonly string[],
    readonly result: GameResult | null,
    readonly last: ChessEvent | null,
    /** Why the game ended, in plain words. */
    readonly ending: string | null = null,
  ) {}

  get currentSeat(): Seat {
    return this.position.toMove;
  }

  get board(): readonly number[] {
    return this.position.board;
  }

  get check(): boolean {
    return inCheck(this.position);
  }

  legalMoves(seat: Seat): readonly ChessMove[] {
    if (this.result || seat !== this.position.toMove) return [];
    this.cached ??= legalMovesOf(this.position).map(writeMove);
    return this.cached;
  }

  apply(move: ChessMove): ChessState {
    if (this.result) throw new Error('Game is over');
    if (!this.legalMoves(this.position.toMove).includes(move)) throw new Error(`Illegal move: ${move}`);
    const parsed = readMove(move);
    const position = clone(this.position);
    const seat = position.toMove;
    const piece = position.board[parsed.from]!;
    const undo = doMove(position, parsed);
    const event: ChessEvent = {
      seat,
      move: parsed,
      piece,
      captured: undo.captured,
      capturedSquare: undo.capturedSquare,
      castleRook: undo.rookFrom >= 0 ? { from: undo.rookFrom, to: undo.rookTo } : null,
      check: inCheck(position),
    };
    const history = position.halfmove === 0 ? [keyOf(position)] : [...this.history, keyOf(position)];
    return settle(new ChessState(position, history, null, event));
  }
}

/** Works out whether the game just ended, and says why. */
function settle(state: ChessState): ChessState {
  const pos = state.position;
  const moves = legalMovesOf(pos);
  if (moves.length === 0) {
    if (inCheck(pos)) {
      const winner = other(pos.toMove);
      return new ChessState(pos, state.history, { winners: [winner], draw: false }, state.last, `Checkmate. ${winner === 0 ? 'White' : 'Black'} wins`);
    }
    return new ChessState(pos, state.history, { winners: [], draw: true }, state.last, 'Stalemate, it is a draw');
  }
  if (pos.halfmove >= 100) return new ChessState(pos, state.history, { winners: [], draw: true }, state.last, 'Draw: 50 moves with no capture or pawn move');
  const key = keyOf(pos);
  if (state.history.filter((k) => k === key).length >= 3) {
    return new ChessState(pos, state.history, { winners: [], draw: true }, state.last, 'Draw: the same position three times');
  }
  if (insufficientMaterial(pos.board)) return new ChessState(pos, state.history, { winners: [], draw: true }, state.last, 'Draw: not enough pieces to mate');
  return state;
}

export function newChess(): ChessState {
  const position: Position = { board: START_BOARD(), toMove: 0, castling: WHITE_KING_SIDE | WHITE_QUEEN_SIDE | BLACK_KING_SIDE | BLACK_QUEEN_SIDE, ep: null, halfmove: 0 };
  return new ChessState(position, [keyOf(position)], null, null);
}

/** Reads a position in FEN, which is how chess positions are written down (used by our tests). */
export function chessFromFen(fen: string): ChessState {
  const [placement, turn, rights, ep] = fen.trim().split(/\s+/);
  const board = Array<number>(64).fill(0);
  const LETTERS: Record<string, number> = { p: PAWN, n: KNIGHT, b: BISHOP, r: ROOK, q: QUEEN, k: KING };
  let square = 56;
  for (const ch of placement!) {
    if (ch === '/') square -= 16;
    else if (/\d/.test(ch)) square += Number(ch);
    else {
      const type = LETTERS[ch.toLowerCase()]!;
      board[square++] = pieceFor(type, ch === ch.toLowerCase() ? 1 : 0);
    }
  }
  let castling = 0;
  if (rights?.includes('K')) castling |= WHITE_KING_SIDE;
  if (rights?.includes('Q')) castling |= WHITE_QUEEN_SIDE;
  if (rights?.includes('k')) castling |= BLACK_KING_SIDE;
  if (rights?.includes('q')) castling |= BLACK_QUEEN_SIDE;
  const position: Position = { board, toMove: turn === 'b' ? 1 : 0, castling, ep: ep && ep !== '-' ? squareIndex(ep) : null, halfmove: 0 };
  return settle(new ChessState(position, [keyOf(position)], null, null));
}

/** Counts the moves available `depth` moves deep: the standard check that move generation is right. */
export function perft(pos: Position, depth: number): number {
  if (depth === 0) return 1;
  let total = 0;
  for (const move of legalMovesOf(pos)) {
    const undo = doMove(pos, move);
    total += perft(pos, depth - 1);
    undoMove(pos, move, undo);
  }
  return total;
}

// ---- Bots: our own alpha-beta search.

const VALUE = [0, 100, 320, 330, 500, 900, 20000];

/** Small bonuses per square, from white's side; black reads the same table mirrored. */
const SQUARE_BONUS: Record<number, readonly number[]> = {
  [PAWN]: [
    0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, -20, -20, 10, 10, 5, 5, -5, -10, 0, 0, -10, -5, 5, 0, 0, 0, 20, 20, 0, 0, 0,
    5, 5, 10, 25, 25, 10, 5, 5, 10, 10, 20, 30, 30, 20, 10, 10, 50, 50, 50, 50, 50, 50, 50, 50, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  [KNIGHT]: [
    -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 5, 5, 0, -20, -40, -30, 5, 10, 15, 15, 10, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 10, 15, 15, 10, 0, -30, -40, -20, 0, 0, 0, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  [BISHOP]: [
    -20, -10, -10, -10, -10, -10, -10, -20, -10, 5, 0, 0, 0, 0, 5, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 0, 0, 0, 0, 0, 0, -10, -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  [ROOK]: [
    0, 0, 5, 10, 10, 5, 0, 0, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 5, 10, 10, 10, 10, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  [QUEEN]: [
    -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 5, 0, 0, 0, 0, -10, -10, 5, 5, 5, 5, 5, 0, -10, 0, 0, 5, 5, 5, 5, 0, -5,
    -5, 0, 5, 5, 5, 5, 0, -5, -10, 0, 5, 5, 5, 5, 0, -10, -10, 0, 0, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  [KING]: [
    20, 30, 10, 0, 0, 10, 30, 20, 20, 20, 0, 0, 0, 0, 20, 20, -10, -20, -20, -20, -20, -20, -20, -10, -20, -30, -30, -40, -40, -30, -30, -20,
    -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
  ],
};

/** Score from the side to move's point of view. */
function evaluate(pos: Position): number {
  let score = 0;
  for (let square = 0; square < 64; square++) {
    const piece = pos.board[square]!;
    if (piece === 0) continue;
    const color = colorOf(piece);
    const type = typeOf(piece);
    const worth = VALUE[type]! + (SQUARE_BONUS[type]?.[color === 0 ? square : square ^ 56] ?? 0);
    score += color === pos.toMove ? worth : -worth;
  }
  return score;
}

const MATE = 100_000;
/** Take the most valuable piece with the least valuable one first: it prunes the most. */
const captureScore = (pos: Position, move: Move) => {
  const target = pos.board[move.to]!;
  return (target === 0 ? 0 : VALUE[typeOf(target)]! * 10 - VALUE[typeOf(pos.board[move.from]!)]!) + (move.promotion ? VALUE[move.promotion]! : 0);
};
const ordered = (pos: Position, moves: Move[]): Move[] => [...moves].sort((a, b) => captureScore(pos, b) - captureScore(pos, a));

interface Budget {
  nodes: number;
}

/** Keeps looking while pieces are still being taken, so the bot doesn't stop mid-trade. */
function quiesce(pos: Position, alpha: number, beta: number, budget: Budget): number {
  const stand = evaluate(pos);
  if (stand >= beta) return beta;
  let best = Math.max(alpha, stand);
  if (budget.nodes <= 0) return best;
  for (const move of ordered(pos, legalMovesOf(pos).filter((m) => pos.board[m.to] !== 0 || m.promotion))) {
    budget.nodes--;
    const undo = doMove(pos, move);
    const score = -quiesce(pos, -beta, -best, budget);
    undoMove(pos, move, undo);
    if (score >= beta) return beta;
    if (score > best) best = score;
  }
  return best;
}

function search(pos: Position, depth: number, alpha: number, beta: number, budget: Budget, quiescence: boolean, ply = 0): number {
  const moves = legalMovesOf(pos);
  if (moves.length === 0) return inCheck(pos) ? -MATE + ply : 0;
  if (pos.halfmove >= 100) return 0;
  if (depth === 0) return quiescence ? quiesce(pos, alpha, beta, budget) : evaluate(pos);
  let best = alpha;
  for (const move of ordered(pos, moves)) {
    if (budget.nodes <= 0) break;
    budget.nodes--;
    const undo = doMove(pos, move);
    const score = -search(pos, depth - 1, -beta, -best, budget, quiescence, ply + 1);
    undoMove(pos, move, undo);
    if (score >= beta) return beta;
    if (score > best) best = score;
  }
  return best;
}

interface ChessTier {
  readonly depth: number;
  readonly randomMoveRate: number;
  readonly quiescence: boolean;
  readonly nodes: number;
}

const TIERS: Record<BotTier, ChessTier> = {
  easy: { depth: 1, randomMoveRate: 0.35, quiescence: false, nodes: 30_000 },
  medium: { depth: 2, randomMoveRate: 0.08, quiescence: false, nodes: 80_000 },
  hard: { depth: 3, randomMoveRate: 0.02, quiescence: true, nodes: 250_000 },
  expert: { depth: 4, randomMoveRate: 0, quiescence: true, nodes: 700_000 },
};

/** Scores every legal move at this tier; the scene uses it for hints too. */
export function scoreChessMoves(state: ChessState, tier: BotTier): { move: ChessMove; score: number }[] {
  const settings = TIERS[tier];
  const pos = clone(state.position);
  const budget: Budget = { nodes: settings.nodes };
  return ordered(pos, legalMovesOf(pos)).map((move) => {
    const undo = doMove(pos, move);
    const score = -search(pos, settings.depth - 1, -MATE, MATE, budget, settings.quiescence, 1);
    undoMove(pos, move, undo);
    return { move: writeMove(move), score };
  });
}

function createChessBot(tier: BotTier): Bot<ChessMove> {
  const settings = TIERS[tier];
  return {
    chooseMove(generic: GameState<ChessMove>, seat: Seat, rng: Rng): ChessMove {
      const state = generic as ChessState;
      const moves = state.legalMoves(seat);
      if (moves.length === 0) throw new Error('No legal moves');
      if (rng.next() < settings.randomMoveRate) return rng.pick(moves);
      const scored = scoreChessMoves(state, tier);
      const best = Math.max(...scored.map((s) => s.score));
      return rng.pick(scored.filter((s) => s.score === best).map((s) => s.move));
    },
  };
}

export const chess: GameDefinition<ChessMove> = {
  id: 'chess',
  name: 'Chess',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: false,
  realtime: false,
  newGame: () => newChess(),
  createBot: (tier) => createChessBot(tier),
  encodeMove: (move) => move,
};
