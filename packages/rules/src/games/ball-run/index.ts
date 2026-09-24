import { createRng, type Rng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Ball Run (docs/games/ball-run.md): a grid of track pieces, each turned the wrong way. Tap a
 * piece to turn it a quarter turn. When a track runs all the way from the ball's start to the goal,
 * the ball rolls home. Every board is made by laying a real path first and turning the pieces
 * afterwards, so it can always be joined up.
 */
export type RunLevel = 'small' | 'medium' | 'large';
export const RUN_SIZES: Record<RunLevel, number> = { small: 5, medium: 6, large: 7 };

/** Sides as bits: up 1, right 2, down 4, left 8. */
export const UP = 1;
export const RIGHT = 2;
export const DOWN = 4;
export const LEFT = 8;
/** Pieces as the sides they join, before turning: a straight, a bend, a T and a cross. */
export type PieceKind = 'straight' | 'bend' | 'tee' | 'cross';
const SHAPE: Record<PieceKind, number> = { straight: UP | DOWN, bend: UP | RIGHT, tee: UP | RIGHT | DOWN, cross: UP | RIGHT | DOWN | LEFT };
const TURNS: Record<PieceKind, number> = { straight: 2, bend: 4, tee: 4, cross: 1 };

/** A side turned a quarter turn clockwise, `k` times. */
export function turnSides(sides: number, k: number): number {
  let s = sides;
  for (let i = 0; i < ((k % 4) + 4) % 4; i++) s = ((s << 1) | (s >> 3)) & 15;
  return s;
}

export interface Piece {
  readonly kind: PieceKind;
  readonly turn: number;
}

export const pieceSides = (p: Piece) => turnSides(SHAPE[p.kind], p.turn);

/** `r12` turns the piece at cell 12 a quarter turn clockwise. */
export type RunMove = string;

export class RunState implements GameState<RunMove> {
  readonly currentSeat: Seat = 0;

  constructor(
    readonly size: number,
    readonly pieces: readonly Piece[],
    /** Where the ball starts, and the side of that cell it comes in from (off the board). */
    readonly start: { readonly cell: number; readonly from: number },
    readonly goal: { readonly cell: number; readonly to: number },
    /** The path the board was made from, and each piece's turn on it: for hints and bots. */
    readonly solution: readonly { readonly cell: number; readonly turn: number }[],
    readonly moves: number,
    readonly par: number,
    readonly last: number | null,
    readonly result: GameResult | null,
  ) {}

  /** Follows the track from the start: the cells the ball would roll through, and whether it reaches the goal. */
  trace(): { cells: number[]; home: boolean } {
    const n = this.size;
    const cells: number[] = [];
    let cell = this.start.cell;
    let from = this.start.from;
    const seen = new Set<number>();
    for (;;) {
      const sides = pieceSides(this.pieces[cell]!);
      if (!(sides & from) || seen.has(cell)) return { cells, home: false };
      seen.add(cell);
      cells.push(cell);
      // Where it leaves: a straight or bend has one other side; with more, it keeps straight on if it can.
      const opposite = turnSides(from, 2);
      const exits = [UP, RIGHT, DOWN, LEFT].filter((s) => s !== from && sides & s);
      const out = exits.includes(opposite) ? opposite : exits[0];
      if (out === undefined) return { cells, home: false };
      if (cell === this.goal.cell && out === this.goal.to) return { cells, home: true };
      const x = cell % n;
      const y = Math.floor(cell / n);
      const nx = x + (out === RIGHT ? 1 : out === LEFT ? -1 : 0);
      const ny = y + (out === DOWN ? 1 : out === UP ? -1 : 0);
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) return { cells, home: false };
      cell = ny * n + nx;
      from = turnSides(out, 2);
    }
  }

  legalMoves(seat: Seat): readonly RunMove[] {
    if (this.result || seat !== 0) return [];
    // A cross looks the same every way round, so turning it is not a move.
    return this.pieces.flatMap((p, i) => (p.kind === 'cross' ? [] : [`r${i}`]));
  }

  apply(move: RunMove): RunState {
    if (!this.legalMoves(0).includes(move)) throw new Error(`Illegal move: ${move}`);
    const i = Number(move.slice(1));
    const pieces = this.pieces.map((p, k) => (k === i ? { ...p, turn: (p.turn + 1) % 4 } : p));
    const next = new RunState(this.size, pieces, this.start, this.goal, this.solution, this.moves + 1, this.par, i, null);
    return next.trace().home ? new RunState(this.size, pieces, this.start, this.goal, this.solution, next.moves, this.par, i, { winners: [0], draw: false }) : next;
  }
}

/** Quarter turns to go from `turn` to one that joins the same sides as `want` (a straight has two). */
export function turnsTo(kind: PieceKind, turn: number, want: number): number {
  for (let k = 0; k < 4; k++) if (pieceSides({ kind, turn: (turn + k) % 4 }) === pieceSides({ kind, turn: want })) return k;
  return 0;
}

export function newBallRun(seed: number, level: RunLevel = 'small'): RunState {
  const n = RUN_SIZES[level];
  const rng = createRng(seed >>> 0);
  for (;;) {
    // Start on the left edge, goal on the right; walk a path between them that never crosses itself.
    const startY = rng.int(n);
    const goalY = rng.int(n);
    const path = walk(n, startY * n, goalY * n + n - 1, rng);
    if (!path || path.length < n + 1) continue;
    const pieces: Piece[] = [];
    const solution: { cell: number; turn: number }[] = [];
    const onPath = new Map<number, number>(path.map((c, i) => [c, i]));
    for (let cell = 0; cell < n * n; cell++) {
      const i = onPath.get(cell);
      if (i === undefined) {
        const r = rng.next();
        const kind: PieceKind = r < 0.35 ? 'straight' : r < 0.8 ? 'bend' : r < 0.95 ? 'tee' : 'cross';
        pieces.push({ kind, turn: rng.int(4) });
        continue;
      }
      const into = i === 0 ? LEFT : sideTowards(n, cell, path[i - 1]!);
      const outOf = i === path.length - 1 ? RIGHT : sideTowards(n, cell, path[i + 1]!);
      const want = into | outOf;
      const kind: PieceKind = want === (UP | DOWN) || want === (LEFT | RIGHT) ? 'straight' : 'bend';
      const turn = [0, 1, 2, 3].find((k) => turnSides(SHAPE[kind], k) === want)!;
      solution.push({ cell, turn });
      // Scrambled: never already right, so every path piece needs at least one turn.
      let scrambled = (turn + 1 + rng.int(TURNS[kind] - 1)) % 4;
      if (pieceSides({ kind, turn: scrambled }) === want) scrambled = (scrambled + 1) % 4;
      pieces.push({ kind, turn: scrambled });
    }
    const par = solution.reduce((sum, s) => sum + turnsTo(pieces[s.cell]!.kind, pieces[s.cell]!.turn, s.turn), 0);
    const state = new RunState(n, pieces, { cell: startY * n, from: LEFT }, { cell: goalY * n + n - 1, to: RIGHT }, solution, 0, par, null, null);
    if (state.trace().home) continue;
    return state;
  }
}

function sideTowards(n: number, from: number, to: number): number {
  const dx = (to % n) - (from % n);
  const dy = Math.floor(to / n) - Math.floor(from / n);
  return dx === 1 ? RIGHT : dx === -1 ? LEFT : dy === 1 ? DOWN : UP;
}

/** A random self-avoiding walk from `a` to `b`, leaning toward the goal, or null if it gets stuck. */
function walk(n: number, a: number, b: number, rng: Rng): number[] | null {
  const path = [a];
  const used = new Set([a]);
  let at = a;
  for (let steps = 0; steps < n * n * 3 && at !== b; steps++) {
    const x = at % n;
    const y = Math.floor(at / n);
    const options = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ].filter(([nx, ny]) => nx! >= 0 && ny! >= 0 && nx! < n && ny! < n && !used.has(ny! * n + nx!));
    if (!options.length) return null;
    // Mostly wander; now and then head straight for the goal column.
    const [nx, ny] = rng.next() < 0.35 ? options.reduce((best, o) => (o[0]! > best[0]! ? o : best)) : rng.pick(options);
    at = ny! * n + nx!;
    used.add(at);
    path.push(at);
  }
  return at === b ? path : null;
}

/** Test play: turn the first piece on the path that is not yet right. */
function createRunBot(): Bot<RunMove> {
  return {
    chooseMove(generic: GameState<RunMove>, _seat: Seat, _rng: Rng): RunMove {
      const s = generic as RunState;
      const wrong = s.solution.find((p) => turnsTo(s.pieces[p.cell]!.kind, s.pieces[p.cell]!.turn, p.turn) > 0);
      return `r${wrong ? wrong.cell : s.solution[0]!.cell}`;
    },
  };
}

export const ballRun: GameDefinition<RunMove> = {
  id: 'ball-run',
  name: 'Ball Run',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo', 'race'],
  hiddenInfo: false,
  realtime: false,
  newGame: (config, seed) => newBallRun(seed, (config.variant as RunLevel | undefined) ?? 'small'),
  createBot: () => createRunBot(),
  encodeMove: (move) => move,
};
