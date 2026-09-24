import { createRng, type Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Maze Paint (docs/games/maze-paint.md): a ball in a maze. Swipe and it rolls the way you swiped
 * until it hits a wall, painting every square it rolls over. Paint the whole maze to finish. Each
 * maze is carved by rolling a ball through it, so it can always be painted, and it is checked so
 * that wherever you roll you can still get everywhere: nobody can paint themselves into a corner.
 */
export type MazeDir = 'u' | 'd' | 'l' | 'r';
export const MAZE_DIRS: readonly MazeDir[] = ['u', 'd', 'l', 'r'];
const STEP: Record<MazeDir, [number, number]> = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };

export type MazeLevel = 'small' | 'medium' | 'large';
export const MAZE_SIZES: Record<MazeLevel, { size: number; slides: number }> = {
  small: { size: 7, slides: 14 },
  medium: { size: 9, slides: 24 },
  large: { size: 11, slides: 36 },
};

export interface MazeRoll {
  readonly dir: MazeDir;
  readonly from: number;
  readonly to: number;
  /** Squares painted by this roll that were not painted before. */
  readonly fresh: readonly number[];
}

export class MazeState implements GameState<MazeDir> {
  readonly currentSeat: Seat = 0;

  constructor(
    readonly size: number,
    /** True where there is floor; false is wall. */
    readonly open: readonly boolean[],
    readonly ball: number,
    readonly painted: readonly boolean[],
    readonly moves: number,
    /** How many rolls the maze was carved with: a fair target. */
    readonly par: number,
    readonly result: GameResult | null,
    readonly last: MazeRoll | null,
  ) {}

  get left(): number {
    return this.open.reduce((n, o, i) => n + (o && !this.painted[i] ? 1 : 0), 0);
  }

  legalMoves(seat: Seat): readonly MazeDir[] {
    if (this.result || seat !== 0) return [];
    return MAZE_DIRS.filter((d) => rollTo(this.size, this.open, this.ball, d).length > 0);
  }

  apply(move: MazeDir): MazeState {
    if (this.result) throw new Error('Game is over');
    const path = rollTo(this.size, this.open, this.ball, move);
    if (!path.length) throw new Error(`Illegal move: ${move} hits a wall`);
    const painted = [...this.painted];
    const fresh = path.filter((i) => !painted[i]);
    for (const i of path) painted[i] = true;
    const to = path[path.length - 1]!;
    const next = new MazeState(this.size, this.open, to, painted, this.moves + 1, this.par, null, { dir: move, from: this.ball, to, fresh });
    return next.left === 0 ? new MazeState(this.size, this.open, to, painted, next.moves, this.par, { winners: [0], draw: false }, next.last) : next;
  }
}

/** The squares a ball rolls over from `from` going `dir`, in order, until a wall stops it. */
export function rollTo(size: number, open: readonly boolean[], from: number, dir: MazeDir): number[] {
  const [dx, dy] = STEP[dir];
  let x = from % size;
  let y = Math.floor(from / size);
  const out: number[] = [];
  for (;;) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= size || ny >= size || !open[ny * size + nx]) return out;
    x = nx;
    y = ny;
    out.push(y * size + x);
  }
}

/** Every place the ball can come to rest, reached from `start`. */
function stops(size: number, open: readonly boolean[], start: number): Map<number, number[]> {
  const graph = new Map<number, number[]>();
  const queue = [start];
  while (queue.length) {
    const at = queue.shift()!;
    if (graph.has(at)) continue;
    const next = MAZE_DIRS.map((d) => rollTo(size, open, at, d)).filter((p) => p.length).map((p) => p[p.length - 1]!);
    graph.set(at, next);
    for (const n of next) if (!graph.has(n)) queue.push(n);
  }
  return graph;
}

/** Can the ball get from every resting place back to every other? Then nobody can get stuck. */
export function allConnected(size: number, open: readonly boolean[], start: number): boolean {
  const graph = stops(size, open, start);
  for (const from of graph.keys()) {
    const seen = new Set([from]);
    const queue = [from];
    while (queue.length) for (const n of graph.get(queue.shift()!)!) if (!seen.has(n)) seen.add(n), queue.push(n);
    if (seen.size !== graph.size) return false;
  }
  return true;
}

/**
 * Carves a maze by rolling: from a start square, pick a direction and a length, open the squares
 * along it and keep the one beyond as wall so the roll stops there. The rolls it made are a way to
 * paint it, so the maze is kept only if replaying them does paint every square (a later roll can
 * open the wall an earlier one stopped at) and every resting place can reach every other.
 */
export function carveMaze(seed: number, level: MazeLevel): { open: boolean[]; start: number; par: number } {
  const { size, slides } = MAZE_SIZES[level];
  for (let attempt = 0; ; attempt++) {
    const rng = createRng((seed ^ Math.imul(attempt + 1, 0x85ebca6b)) >>> 0);
    const open = Array<boolean>(size * size).fill(false);
    const keep = new Set<number>();
    const start = (Math.floor(size / 2) + rng.int(2)) * size + 1 + rng.int(size - 2);
    open[start] = true;
    const rolls: MazeDir[] = [];
    let at = start;
    let last: MazeDir | null = null;
    for (let n = 0; n < slides * 3 && rolls.length < slides; n++) {
      const dir = rng.pick(MAZE_DIRS.filter((d) => d !== last));
      const [dx, dy] = STEP[dir];
      const len = 1 + rng.int(size - 2);
      let x = at % size;
      let y = Math.floor(at / size);
      const path: number[] = [];
      for (let k = 0; k < len; k++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size || keep.has(ny * size + nx)) break;
        x = nx;
        y = ny;
        path.push(y * size + x);
      }
      if (!path.length) continue;
      // The square past the end stays a wall so the roll stops where it was carved to; if it is
      // already floor, the roll would run on, so this one is not carved.
      const bx = x + dx;
      const by = y + dy;
      const beyond = bx >= 0 && by >= 0 && bx < size && by < size ? by * size + bx : -1;
      if (beyond >= 0 && open[beyond]) continue;
      for (const i of path) open[i] = true;
      if (beyond >= 0) keep.add(beyond);
      rolls.push(dir);
      at = y * size + x;
      last = dir;
    }
    const floor = open.filter(Boolean).length;
    if (floor < size * size * 0.35 && attempt < 200) continue;
    // Replay the carving rolls on the finished maze: they must paint it all.
    let ball = start;
    const painted = new Set([start]);
    let fine = true;
    for (const d of rolls) {
      const p = rollTo(size, open, ball, d);
      if (!p.length) {
        fine = false;
        break;
      }
      for (const i of p) painted.add(i);
      ball = p[p.length - 1]!;
    }
    if (!fine || painted.size !== floor) continue;
    if (!allConnected(size, open, start)) continue;
    return { open, start, par: rolls.length };
  }
}

export function newMazePaint(seed: number, level: MazeLevel = 'small'): MazeState {
  const { size } = MAZE_SIZES[level];
  const { open, start, par } = carveMaze(seed >>> 0, level);
  const painted = open.map(() => false);
  painted[start] = true;
  return new MazeState(size, open, start, painted, 0, par, null, null);
}

/** The shortest run of rolls from where the ball is to a roll that paints something new. */
export function nextPaint(state: MazeState): MazeDir[] {
  const seen = new Map<number, MazeDir[]>([[state.ball, []]]);
  const queue = [state.ball];
  while (queue.length) {
    const at = queue.shift()!;
    const route = seen.get(at)!;
    for (const d of MAZE_DIRS) {
      const p = rollTo(state.size, state.open, at, d);
      if (!p.length) continue;
      if (p.some((i) => !state.painted[i])) return [...route, d];
      const to = p[p.length - 1]!;
      if (!seen.has(to)) {
        seen.set(to, [...route, d]);
        queue.push(to);
      }
    }
  }
  return [];
}

const TIERS: Record<BotTier, number> = { easy: 0.5, medium: 0.8, hard: 1, expert: 1 };

export function chooseMazeMove(state: MazeState, rng: Rng, care = 1): MazeDir {
  const moves = state.legalMoves(0);
  if (!moves.length) throw new Error('No legal moves');
  if (rng.next() > care) return rng.pick(moves);
  return nextPaint(state)[0] ?? rng.pick(moves);
}

export const mazePaint: GameDefinition<MazeDir> = {
  id: 'maze-paint',
  name: 'Maze Paint',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo', 'race'],
  hiddenInfo: false,
  realtime: false,
  newGame: (config, seed) => newMazePaint(seed, (config.variant as MazeLevel | undefined) ?? 'small'),
  createBot: (tier) => ({
    chooseMove: (generic: GameState<MazeDir>, _seat: Seat, rng: Rng) => chooseMazeMove(generic as MazeState, rng, TIERS[tier]),
  }) satisfies Bot<MazeDir>,
  encodeMove: (move) => move,
};
