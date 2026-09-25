import { createRng, type Rng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Marble Run (docs/games/marble-run.md): set ramps on four pegs, drop the marble, get it into the
 * cup. The roll is a fixed step here in the rules, so a drop is a move and always rolls the same.
 */
export const MARBLE_BOARD = { w: 480, h: 640 };
export const MARBLE_R = 11;
export const MARBLE_STEP = 1 / 120;
export const RAMP_LEN = 104;
export const MARBLE_PEGS = 4;
const GRAVITY = 900;
const BOUNCE = 0.25;
const MAX_STEPS = 2400;
const CUP = { w: 74, top: 588, bottom: 628 };
/** A ramp's tilt for each peg state: none, down to the left, down to the right. */
const TILT = [0, -28, 28];

export interface Segment {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface MarbleLevel {
  readonly start: number;
  readonly cup: number;
  readonly fixed: readonly Segment[];
  readonly pegs: readonly { readonly x: number; readonly y: number }[];
  /** A set of peg states that lands, and the fewest ramps any landing set uses. */
  readonly solution: readonly number[];
  readonly par: number;
}

/** A ramp on a peg, as a segment. */
export function rampAt(peg: { x: number; y: number }, state: number): Segment | null {
  if (!state) return null;
  const a = (TILT[state]! * Math.PI) / 180;
  const dx = (Math.cos(a) * RAMP_LEN) / 2;
  const dy = (Math.sin(a) * RAMP_LEN) / 2;
  // y grows downwards, so a positive tilt lowers the right end and the marble runs off to the right.
  return { x1: peg.x - dx, y1: peg.y - dy, x2: peg.x + dx, y2: peg.y + dy };
}

/** The cup's walls and floor, and the board's sides. */
function frame(level: MarbleLevel): Segment[] {
  const l = level.cup - CUP.w / 2;
  const r = level.cup + CUP.w / 2;
  return [
    { x1: 0, y1: 0, x2: 0, y2: MARBLE_BOARD.h },
    { x1: MARBLE_BOARD.w, y1: 0, x2: MARBLE_BOARD.w, y2: MARBLE_BOARD.h },
    { x1: l, y1: CUP.top, x2: l, y2: CUP.bottom },
    { x1: l, y1: CUP.bottom, x2: r, y2: CUP.bottom },
    { x1: r, y1: CUP.top, x2: r, y2: CUP.bottom },
  ];
}

export interface Roll {
  /** Where the marble was every few steps, for the scene to draw. */
  readonly path: readonly { readonly x: number; readonly y: number }[];
  readonly landed: boolean;
}

/** Rolls the marble from the top with these ramps: in the cup, off the bottom, or stuck. */
export function roll(level: MarbleLevel, states: readonly number[], every = 2): Roll {
  const segs = [...level.fixed, ...frame(level), ...level.pegs.flatMap((p, i) => rampAt(p, states[i] ?? 0) ?? [])];
  let x = level.start;
  let y = 30;
  let vx = 0;
  let vy = 0;
  let slow = 0;
  const path: { x: number; y: number }[] = [{ x, y }];
  const l = level.cup - CUP.w / 2;
  const r = level.cup + CUP.w / 2;
  for (let step = 1; step <= MAX_STEPS; step++) {
    vy += GRAVITY * MARBLE_STEP;
    x += vx * MARBLE_STEP;
    y += vy * MARBLE_STEP;
    for (const s of segs) {
      const ex = s.x2 - s.x1;
      const ey = s.y2 - s.y1;
      const t = Math.max(0, Math.min(1, ((x - s.x1) * ex + (y - s.y1) * ey) / (ex * ex + ey * ey)));
      const qx = s.x1 + ex * t;
      const qy = s.y1 + ey * t;
      const d = Math.hypot(x - qx, y - qy);
      if (d >= MARBLE_R || d === 0) continue;
      const nx = (x - qx) / d;
      const ny = (y - qy) / d;
      x = qx + nx * MARBLE_R;
      y = qy + ny * MARBLE_R;
      const vn = vx * nx + vy * ny;
      if (vn < 0) {
        vx -= (1 + BOUNCE) * vn * nx;
        vy -= (1 + BOUNCE) * vn * ny;
        vx *= 0.995;
        vy *= 0.995;
      }
    }
    if (step % every === 0) path.push({ x, y });
    if (x > l && x < r && y > CUP.top) return { path: [...path, { x, y }], landed: true };
    if (y > MARBLE_BOARD.h + 40) return { path, landed: false };
    slow = Math.hypot(vx, vy) < 6 ? slow + 1 : 0;
    if (slow > 120) return { path, landed: false };
  }
  return { path, landed: false };
}

/** Every set of peg states, three ways each. */
function allStates(): number[][] {
  const out: number[][] = [];
  for (let k = 0; k < 3 ** MARBLE_PEGS; k++) out.push(Array.from({ length: MARBLE_PEGS }, (_, i) => Math.floor(k / 3 ** i) % 3));
  return out;
}
const ALL = allStates();

export function makeLevel(seed: number): MarbleLevel {
  const rng = createRng(seed >>> 0);
  for (;;) {
    const start = 70 + rng.int(340);
    let cup = 60 + rng.int(360);
    if (Math.abs(cup - start) < 150) cup = start < 240 ? start + 150 + rng.int(80) : start - 150 - rng.int(80);
    const fixed: Segment[] = [];
    for (let k = 0; k < 2; k++) {
      const cx = 70 + rng.int(340);
      const cy = 170 + rng.int(300);
      const a = ((rng.next() < 0.5 ? -1 : 1) * (14 + rng.int(20)) * Math.PI) / 180;
      const dx = Math.cos(a) * 55;
      const dy = Math.sin(a) * 55;
      fixed.push({ x1: cx - dx, y1: cy - dy, x2: cx + dx, y2: cy + dy });
    }
    const pegs = [120, 240, 360, 480].map((y) => ({ x: 80 + rng.int(320), y }));
    // Pegs keep clear of the fixed planks.
    if (pegs.some((p) => fixed.some((f) => Math.hypot(p.x - (f.x1 + f.x2) / 2, p.y - (f.y1 + f.y2) / 2) < 90))) continue;
    const level = { start, cup, fixed, pegs, solution: [] as number[], par: 0 };
    if (roll(level, [0, 0, 0, 0]).landed) continue;
    const wins = ALL.filter((states) => roll(level, states, 1000).landed);
    if (!wins.length) continue;
    const used = (s: number[]) => s.filter(Boolean).length;
    const best = wins.reduce((a, b) => (used(b) < used(a) ? b : a));
    return { ...level, solution: best, par: used(best) };
  }
}

/** `t2` turns peg 2 (none, left, right, none...); `drop` lets the marble go. */
export type MarbleMove = string;

export class MarbleState implements GameState<MarbleMove> {
  readonly currentSeat: Seat = 0;

  constructor(
    readonly level: MarbleLevel,
    readonly states: readonly number[],
    readonly drops: number,
    readonly last: { readonly kind: 'turn'; readonly peg: number } | { readonly kind: 'drop'; readonly landed: boolean } | null,
    readonly result: GameResult | null,
  ) {}

  get ramps(): number {
    return this.states.filter(Boolean).length;
  }

  legalMoves(seat: Seat): readonly MarbleMove[] {
    if (this.result || seat !== 0) return [];
    return [...this.level.pegs.map((_, i) => `t${i}`), 'drop'];
  }

  apply(move: MarbleMove): MarbleState {
    if (!this.legalMoves(0).includes(move)) throw new Error(`Illegal move: ${move}`);
    if (move === 'drop') {
      const { landed } = roll(this.level, this.states, 1000);
      return new MarbleState(this.level, this.states, this.drops + 1, { kind: 'drop', landed }, landed ? { winners: [0], draw: false } : null);
    }
    const peg = Number(move.slice(1));
    const states = this.states.map((s, i) => (i === peg ? (s + 1) % 3 : s));
    return new MarbleState(this.level, states, this.drops, { kind: 'turn', peg }, null);
  }
}

export const newMarbleRun = (seed: number) => {
  const level = makeLevel(seed);
  return new MarbleState(level, level.pegs.map(() => 0), 0, null, null);
};

/** Test play: one drop with no ramps, then set the pegs to the level's solution and drop again. */
function createMarbleBot(): Bot<MarbleMove> {
  return {
    chooseMove(generic: GameState<MarbleMove>, _seat: Seat, _rng: Rng): MarbleMove {
      const s = generic as MarbleState;
      if (s.drops === 0) return 'drop';
      const wrong = s.states.findIndex((st, i) => st !== s.level.solution[i]);
      return wrong >= 0 ? `t${wrong}` : 'drop';
    },
  };
}

export const marbleRun: GameDefinition<MarbleMove> = {
  id: 'marble-run',
  name: 'Marble Run',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo', 'race'],
  hiddenInfo: false,
  realtime: false,
  newGame: (_config, seed) => newMarbleRun(seed),
  createBot: () => createMarbleBot(),
  encodeMove: (move) => move,
};
