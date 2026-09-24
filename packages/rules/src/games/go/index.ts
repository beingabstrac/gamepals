import type { Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Go on a 9 by 9 board (docs/games/go.md). Black (seat 0) plays first; stones with no liberties are
 * captured; a move may not take its own last liberty, nor bring back a position seen before
 * (positional superko). Two passes in a row end the game, which is scored by area as Tromp and
 * Taylor set it out: your stones plus the empty points only you reach, and White gets 7 for going
 * second. A dead group has to be taken off by playing, so the phone never has to guess.
 */
export const GO_SIZE = 9;
export const GO_POINTS = GO_SIZE * GO_SIZE;
export const GO_KOMI = 7;
/** A game this long is scored where it stands: a real 9 by 9 game is well under this. */
export const GO_MOVE_LIMIT = 250;

const NEIGHBORS: readonly (readonly number[])[] = Array.from({ length: GO_POINTS }, (_, p) => {
  const x = p % GO_SIZE;
  const y = Math.floor(p / GO_SIZE);
  const out: number[] = [];
  if (x > 0) out.push(p - 1);
  if (x < GO_SIZE - 1) out.push(p + 1);
  if (y > 0) out.push(p - GO_SIZE);
  if (y < GO_SIZE - 1) out.push(p + GO_SIZE);
  return out;
});

/** 0 empty, 1 black, 2 white. */
export const stoneOf = (seat: Seat): number => seat + 1;

/** The group at `p` and its liberties. */
function group(board: ArrayLike<number>, p: number): { stones: number[]; liberties: number } {
  const color = board[p]!;
  const seen = new Set<number>([p]);
  const libs = new Set<number>();
  const stack = [p];
  const stones: number[] = [];
  while (stack.length) {
    const q = stack.pop()!;
    stones.push(q);
    for (const n of NEIGHBORS[q]!) {
      const c = board[n]!;
      if (c === 0) libs.add(n);
      else if (c === color && !seen.has(n)) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  return { stones, liberties: libs.size };
}

/** Plays `color` at `p` on a copy of `board`: the new board and how many it took, or null if it is suicide. */
export function playStone(board: readonly number[] | Int8Array, p: number, color: number): { board: number[]; captured: number[] } | null {
  if (board[p] !== 0) return null;
  const next = Array.from(board);
  next[p] = color;
  const enemy = 3 - color;
  const captured: number[] = [];
  for (const n of NEIGHBORS[p]!) {
    if (next[n] !== enemy) continue;
    const g = group(next, n);
    if (g.liberties === 0) for (const s of g.stones) {
      next[s] = 0;
      captured.push(s);
    }
  }
  if (group(next, p).liberties === 0) return null;
  return { board: next, captured };
}

/** Who owns each point for the area count: the stone on it, or the one color an empty region touches (0 if none or both). */
export function areaOwners(board: readonly number[]): number[] {
  const owners = board.slice();
  const seen = new Set<number>();
  for (let p = 0; p < GO_POINTS; p++) {
    if (board[p] || seen.has(p)) continue;
    const region: number[] = [];
    const touches = new Set<number>();
    const stack = [p];
    seen.add(p);
    while (stack.length) {
      const q = stack.pop()!;
      region.push(q);
      for (const n of NEIGHBORS[q]!) {
        const d = board[n]!;
        if (d) touches.add(d);
        else if (!seen.has(n)) {
          seen.add(n);
          stack.push(n);
        }
      }
    }
    const owner = touches.size === 1 ? [...touches][0]! : 0;
    for (const q of region) owners[q] = owner;
  }
  return owners;
}

/** Area score: stones plus empty regions that touch only one color. */
export function areaScore(board: readonly number[]): [number, number] {
  const owners = areaOwners(board);
  return [owners.filter((o) => o === 1).length, owners.filter((o) => o === 2).length];
}

const keyOf = (board: readonly number[]): string => board.join('');

/** `p<point>` places a stone; `pass`. */
export type GoMove = string;

export class GoState implements GameState<GoMove> {
  constructor(
    readonly board: readonly number[],
    readonly currentSeat: Seat,
    /** Every position so far, for superko. */
    readonly seen: ReadonlySet<string>,
    readonly passes: number,
    readonly moves: number,
    readonly captures: readonly [number, number],
    readonly last: { seat: Seat; point: number | null; captured: readonly number[] } | null,
    readonly result: GameResult | null,
  ) {}

  /** The score as it stands, White's komi included. */
  get score(): [number, number] {
    const [b, w] = areaScore(this.board as number[]);
    return [b, w + GO_KOMI];
  }

  legalMoves(seat: Seat): readonly GoMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    const color = stoneOf(seat);
    const moves: GoMove[] = [];
    for (let p = 0; p < GO_POINTS; p++) {
      if (this.board[p] !== 0) continue;
      const played = playStone(this.board, p, color);
      if (played && !this.seen.has(keyOf(played.board))) moves.push(`p${p}`);
    }
    moves.push('pass');
    return moves;
  }

  apply(move: GoMove): GoState {
    const seat = this.currentSeat;
    const other: Seat = seat === 0 ? 1 : 0;
    if (this.result) throw new Error('The game is over');
    if (move === 'pass') {
      const passes = this.passes + 1;
      const last = { seat, point: null, captured: [] };
      const state = new GoState(this.board, other, this.seen, passes, this.moves + 1, this.captures, last, null);
      return passes >= 2 || state.moves >= GO_MOVE_LIMIT ? state.finished() : state;
    }
    if (!move.startsWith('p')) throw new Error(`Illegal move: ${move}`);
    const p = Number(move.slice(1));
    const played = Number.isInteger(p) && p >= 0 && p < GO_POINTS ? playStone(this.board, p, stoneOf(seat)) : null;
    if (!played) throw new Error(`Illegal move: ${move}`);
    const key = keyOf(played.board);
    if (this.seen.has(key)) throw new Error(`Illegal move: ${move} repeats a position`);
    const seen = new Set(this.seen);
    seen.add(key);
    const captures: [number, number] = [this.captures[0], this.captures[1]];
    captures[seat] += played.captured.length;
    const state = new GoState(played.board, other, seen, 0, this.moves + 1, captures, { seat, point: p, captured: played.captured }, null);
    return state.moves >= GO_MOVE_LIMIT ? state.finished() : state;
  }

  private finished(): GoState {
    const [b, w] = this.score;
    const result: GameResult = b === w ? { winners: [], draw: true } : { winners: [b > w ? 0 : 1], draw: false };
    return new GoState(this.board, this.currentSeat, this.seen, this.passes, this.moves, this.captures, this.last, result);
  }
}

export function newGo(): GoState {
  const board = Array<number>(GO_POINTS).fill(0);
  return new GoState(board, 0, new Set([keyOf(board)]), 0, 0, [0, 0], null, null);
}

/**
 * A mutable board for the bot's search, much faster than the immutable state: no copies, stamps
 * instead of sets. It keeps simple ko rather than superko, which is plenty for looking ahead.
 */
class FastBoard {
  readonly cells: Int8Array;
  ko = -1;
  private readonly stamp = new Int32Array(GO_POINTS);
  private mark = 0;
  private readonly stack = new Int32Array(GO_POINTS);

  constructor(cells: ArrayLike<number>) {
    this.cells = Int8Array.from(cells as ArrayLike<number>);
  }

  copy(): FastBoard {
    const b = new FastBoard(this.cells);
    b.ko = this.ko;
    return b;
  }

  /** Does the group at `p` have a liberty? Stops at the first one found. */
  private breathes(p: number): boolean {
    const color = this.cells[p];
    this.mark++;
    let top = 0;
    this.stack[top++] = p;
    this.stamp[p] = this.mark;
    while (top) {
      const q = this.stack[--top]!;
      for (const n of NEIGHBORS[q]!) {
        const c = this.cells[n];
        if (c === 0) return true;
        if (c === color && this.stamp[n] !== this.mark) {
          this.stamp[n] = this.mark;
          this.stack[top++] = n;
        }
      }
    }
    return false;
  }

  private remove(p: number): number {
    const color = this.cells[p];
    let top = 0;
    let count = 0;
    this.stack[top++] = p;
    this.cells[p] = 0;
    while (top) {
      const q = this.stack[--top]!;
      count++;
      for (const n of NEIGHBORS[q]!) {
        if (this.cells[n] === color) {
          this.cells[n] = 0;
          this.stack[top++] = n;
        }
      }
    }
    return count;
  }

  /** Plays if legal (not occupied, not the ko point, not suicide) and says whether it did. */
  play(p: number, color: number): boolean {
    if (this.cells[p] !== 0 || p === this.ko) return false;
    this.cells[p] = color;
    const enemy = 3 - color;
    let taken = 0;
    let lastTaken = -1;
    for (const n of NEIGHBORS[p]!) {
      if (this.cells[n] === enemy && !this.breathes(n)) {
        lastTaken = n;
        taken += this.remove(n);
      }
    }
    if (taken === 0 && !this.breathes(p)) {
      this.cells[p] = 0;
      return false;
    }
    // One stone taken by a lone stone that now has one liberty: the ko point.
    this.ko = taken === 1 && NEIGHBORS[p]!.every((n) => this.cells[n] !== color) ? lastTaken : -1;
    return true;
  }

  pass(): void {
    this.ko = -1;
  }

  /** Your own eye: every neighbor yours. Nobody sensible fills one. */
  isEye(p: number, color: number): boolean {
    return NEIGHBORS[p]!.every((n) => this.cells[n] === color);
  }

  /** Points worth playing for `color`: empty, not your own eye, and legal. */
  candidates(color: number): number[] {
    const out: number[] = [];
    for (let p = 0; p < GO_POINTS; p++) {
      if (this.cells[p] !== 0 || this.isEye(p, color)) continue;
      const trial = this.copy();
      if (trial.play(p, color)) out.push(p);
    }
    return out;
  }
}

/** Plays random moves (never into its own eyes) to the end and says who won the area count. */
function playout(board: FastBoard, toMove: number, rng: Rng): number {
  let color = toMove;
  let passes = 0;
  const empties: number[] = [];
  for (let turn = 0; turn < 160 && passes < 2; turn++) {
    empties.length = 0;
    for (let p = 0; p < GO_POINTS; p++) if (board.cells[p] === 0 && !board.isEye(p, color)) empties.push(p);
    let moved = false;
    while (empties.length) {
      const i = rng.int(empties.length);
      const p = empties[i]!;
      empties[i] = empties[empties.length - 1]!;
      empties.pop();
      if (board.play(p, color)) {
        moved = true;
        break;
      }
    }
    if (!moved) board.pass();
    passes = moved ? 0 : passes + 1;
    color = 3 - color;
  }
  const [b, w] = areaScore(Array.from(board.cells));
  return b > w + GO_KOMI ? 1 : 2;
}

interface Node {
  /** The point played to get here, -1 for a pass, null at the root. */
  readonly move: number | null;
  readonly board: FastBoard;
  /** The color to play next. */
  readonly toMove: number;
  readonly passes: number;
  readonly parent: Node | null;
  children: Node[];
  untried: number[] | null;
  visits: number;
  /** Wins for the color that made `move`. */
  wins: number;
}

export interface GoTier {
  readonly playouts: number;
  /** Chance of a random legal move instead of searching. */
  readonly random: number;
}

export const GO_TIERS: Record<BotTier, GoTier> = {
  easy: { playouts: 150, random: 0.2 },
  medium: { playouts: 600, random: 0.05 },
  hard: { playouts: 1500, random: 0 },
  expert: { playouts: 3500, random: 0 },
};

/** Monte Carlo tree search: UCT over random playouts. Bots see only the board, like a person. */
export function chooseGoMove(state: GoState, tier: GoTier, rng: Rng): GoMove {
  const seat = state.currentSeat;
  const color = stoneOf(seat);
  const legal = state.legalMoves(seat).filter((m) => m !== 'pass');
  const root = new FastBoard(state.board);
  // The search keeps to simple ko; superko is enforced here, on the real list, at the root.
  const rootMoves = legal.map((m) => Number(m.slice(1))).filter((p) => !root.isEye(p, color));
  if (rootMoves.length === 0) return 'pass';
  if (rng.next() < tier.random) return `p${rng.pick(rootMoves)}`;
  // Once the other player has passed, pass back if that already wins, so the game ends.
  if (state.passes === 1) {
    const [b, w] = state.score;
    if ((seat === 0 && b > w) || (seat === 1 && w > b)) return 'pass';
  }
  const top: Node = { move: null, board: root, toMove: color, passes: state.passes, parent: null, children: [], untried: rootMoves.slice(), visits: 0, wins: 0 };
  for (let i = 0; i < tier.playouts; i++) {
    let node = top;
    while (node.untried !== null && node.untried.length === 0 && node.children.length && node.passes < 2) {
      const logN = Math.log(node.visits);
      let best = node.children[0]!;
      let bestValue = -Infinity;
      for (const child of node.children) {
        const value = child.wins / child.visits + Math.sqrt((2 * logN) / child.visits);
        if (value > bestValue) {
          bestValue = value;
          best = child;
        }
      }
      node = best;
    }
    if (node.passes < 2) {
      node.untried ??= node.board.candidates(node.toMove);
      if (node.untried.length === 0 && node.children.length === 0) node.untried.push(-1);
      if (node.untried.length) {
        const move = node.untried.splice(rng.int(node.untried.length), 1)[0]!;
        const board = node.board.copy();
        if (move === -1) board.pass();
        else board.play(move, node.toMove);
        const child: Node = { move, board, toMove: 3 - node.toMove, passes: move === -1 ? node.passes + 1 : 0, parent: node, children: [], untried: null, visits: 0, wins: 0 };
        node.children.push(child);
        node = child;
      }
    }
    const winner = playout(node.board.copy(), node.toMove, rng);
    for (let n: Node | null = node; n; n = n.parent) {
      n.visits++;
      // The node's move was made by the color not to move there.
      if (n.move !== null && winner === 3 - n.toMove) n.wins++;
    }
  }
  let best = top.children[0]!;
  for (const child of top.children) if (child.visits > best.visits) best = child;
  // Hopeless everywhere: pass rather than fill the board with stones that will only be taken.
  if (best.wins / best.visits < 0.03 && state.moves > 40) return 'pass';
  return best.move === -1 ? 'pass' : `p${best.move}`;
}

export const go: GameDefinition<GoMove> = {
  id: 'go',
  name: 'Go 9×9',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: false,
  realtime: false,
  newGame: () => newGo(),
  createBot: (tier): Bot<GoMove> => ({
    chooseMove: (state, _seat, rng) => chooseGoMove(state as GoState, GO_TIERS[tier], rng),
  }),
  encodeMove: (move) => move,
};
