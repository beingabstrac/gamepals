import { createRng, type Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Fruit Merge (docs/games/fruit-merge.md): drop fruit into a box. Two of the same that touch
 * become one of the next size up. Fruit piles up, rolls and settles; let the pile reach the line
 * at the top and the game is over. The physics is a pure fixed step here in the rules, so a drop
 * is a move like any other and the same drop always lands the same way.
 */
export const FRUIT_BOX = { left: 40, right: 560, bottom: 870, line: 230, top: 120 } as const;
/** Radius of each size, smallest first. */
export const FRUIT_R = [22, 29, 37, 46, 56, 67, 79, 92, 106, 121, 138] as const;
/** Only the five smallest are ever dropped. */
export const DROP_KINDS = 5;
export const FRUIT_STEP = 1 / 120;

const GRAVITY = 1900;
const BOUNCE = 0.12;
const ITERATIONS = 4;
/** A drop settles once nothing has moved much for this many steps, or after this many at most. */
const QUIET = 24;
const MAX_STEPS = 900;

export interface Fruit {
  readonly id: number;
  readonly kind: number;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
}

export interface World {
  readonly fruit: readonly Fruit[];
  readonly nextId: number;
  /** Merges so far this drop, as the kind each made. */
  readonly made: readonly number[];
}

/** A drop: where across the box to let go, as `x312`. */
export type FruitMove = string;

export const fruitMove = (x: number): FruitMove => `x${Math.round(x)}`;

export function parseDrop(move: string): number | null {
  const m = /^x(\d{1,3})$/.exec(move);
  return m ? Number(m[1]) : null;
}

/** Points for making a fruit of `kind`: bigger ones are worth a lot more. */
export const fruitPoints = (kind: number) => ((kind + 1) * (kind + 2)) / 2;

/** One fixed step of the box: gravity, then fruit pushed apart (or merged), then the walls. */
export function stepWorld(world: World, dt = FRUIT_STEP): World {
  let fruit = world.fruit.map((f) => ({ ...f, vy: f.vy + GRAVITY * dt }));
  for (const f of fruit) {
    f.x += f.vx * dt;
    f.y += f.vy * dt;
  }
  let nextId = world.nextId;
  const made = [...world.made];
  for (let it = 0; it < ITERATIONS; it++) {
    const gone = new Set<number>();
    const born: typeof fruit = [];
    for (let i = 0; i < fruit.length; i++) {
      const a = fruit[i]!;
      if (gone.has(a.id)) continue;
      for (let j = i + 1; j < fruit.length; j++) {
        const b = fruit[j]!;
        if (gone.has(b.id)) continue;
        const ra = FRUIT_R[a.kind]!;
        const rb = FRUIT_R[b.kind]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d >= ra + rb) continue;
        if (a.kind === b.kind) {
          // Two the same become one bigger, where they met; the biggest of all just pop.
          gone.add(a.id);
          gone.add(b.id);
          made.push(a.kind + 1);
          if (a.kind + 1 < FRUIT_R.length) born.push({ id: nextId++, kind: a.kind + 1, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, vx: (a.vx + b.vx) / 2, vy: Math.min(a.vy, b.vy) / 2 });
          break;
        }
        const ux = d > 1e-9 ? dx / d : 0;
        const uy = d > 1e-9 ? dy / d : 1;
        const overlap = ra + rb - d;
        // Heavier fruit (by area) moves less.
        const ma = ra * ra;
        const mb = rb * rb;
        const pa = mb / (ma + mb);
        const pb = ma / (ma + mb);
        a.x -= ux * overlap * pa;
        a.y -= uy * overlap * pa;
        b.x += ux * overlap * pb;
        b.y += uy * overlap * pb;
        const closing = (a.vx - b.vx) * ux + (a.vy - b.vy) * uy;
        if (closing > 0) {
          const j2 = (1 + BOUNCE) * closing;
          a.vx -= ux * j2 * pa;
          a.vy -= uy * j2 * pa;
          b.vx += ux * j2 * pb;
          b.vy += uy * j2 * pb;
          // A little rolling friction, so piles come to rest.
          const tx = -uy;
          const ty = ux;
          const slide = (a.vx - b.vx) * tx + (a.vy - b.vy) * ty;
          a.vx -= tx * slide * 0.05 * pa;
          a.vy -= ty * slide * 0.05 * pa;
          b.vx += tx * slide * 0.05 * pb;
          b.vy += ty * slide * 0.05 * pb;
        }
      }
    }
    if (gone.size || born.length) fruit = [...fruit.filter((f) => !gone.has(f.id)), ...born];
    for (const f of fruit) {
      const r = FRUIT_R[f.kind]!;
      if (f.x - r < FRUIT_BOX.left) {
        f.x = FRUIT_BOX.left + r;
        f.vx = Math.abs(f.vx) * BOUNCE;
      }
      if (f.x + r > FRUIT_BOX.right) {
        f.x = FRUIT_BOX.right - r;
        f.vx = -Math.abs(f.vx) * BOUNCE;
      }
      if (f.y + r > FRUIT_BOX.bottom) {
        f.y = FRUIT_BOX.bottom - r;
        f.vy = -Math.abs(f.vy) * BOUNCE;
        f.vx *= 0.96;
      }
    }
  }
  return { fruit: fruit.map((f) => ({ ...f, vx: f.vx * 0.998, vy: f.vy * 0.998 })), nextId, made };
}

/** Has everything come to rest? */
export const still = (world: World) => world.fruit.every((f) => Math.abs(f.vx) < 6 && Math.abs(f.vy) < 6);

/** Runs a world until it has been still a while (or long enough), calling `each` on every step. */
export function settle(world: World, each?: (w: World) => void): World {
  let w = world;
  let quiet = 0;
  for (let n = 0; n < MAX_STEPS && quiet < QUIET; n++) {
    w = stepWorld(w);
    each?.(w);
    quiet = still(w) ? quiet + 1 : 0;
  }
  return w;
}

/** Where a drop of `kind` may be let go: anywhere its fruit fits between the walls. */
export function dropRange(kind: number): [number, number] {
  const r = FRUIT_R[kind]!;
  return [FRUIT_BOX.left + r, FRUIT_BOX.right - r];
}

export class FruitState implements GameState<FruitMove> {
  readonly currentSeat: Seat = 0;

  constructor(
    readonly seed: number,
    readonly fruit: readonly Fruit[],
    readonly nextId: number,
    /** The fruit in hand, and the one after it. */
    readonly kind: number,
    readonly next: number,
    readonly drops: number,
    readonly score: number,
    readonly result: GameResult | null,
    /** Fruit made by the last drop, for the scene's pops. */
    readonly made: readonly number[],
  ) {}

  get biggest(): number {
    return this.fruit.reduce((m, f) => Math.max(m, f.kind), -1);
  }

  /** Any whole-pixel spot in reach is a drop, hundreds of them, so this is the authority. */
  allows(move: FruitMove): boolean {
    const x = parseDrop(move);
    if (this.result || x === null) return false;
    const [lo, hi] = dropRange(this.kind);
    return x >= Math.ceil(lo) && x <= Math.floor(hi);
  }

  /** Eleven spots across the box, for bots and tests. */
  legalMoves(seat: Seat): readonly FruitMove[] {
    if (this.result || seat !== 0) return [];
    const [lo, hi] = dropRange(this.kind);
    return Array.from({ length: 11 }, (_, i) => fruitMove(Math.ceil(lo) + ((Math.floor(hi) - Math.ceil(lo)) * i) / 10));
  }

  /** The world as it is the moment a drop is let go: the new fruit hanging just above the line. */
  dropWorld(move: FruitMove): World {
    const x = parseDrop(move)!;
    const fresh: Fruit = { id: this.nextId, kind: this.kind, x, y: FRUIT_BOX.top, vx: 0, vy: 0 };
    return { fruit: [...this.fruit, fresh], nextId: this.nextId + 1, made: [] };
  }

  apply(move: FruitMove): FruitState {
    if (!this.allows(move)) throw new Error(`Illegal move: ${move}`);
    const world = settle(this.dropWorld(move));
    const rng = createRng((this.seed ^ Math.imul(this.drops + 1, 0x9e3779b1)) >>> 0);
    const score = this.score + world.made.reduce((s, k) => s + fruitPoints(k), 0);
    const fruit = world.fruit.map((f) => ({ ...f, vx: 0, vy: 0 }));
    // Over the line once it has settled: the game is over.
    const over = fruit.some((f) => f.y - FRUIT_R[f.kind]! < FRUIT_BOX.line);
    const result: GameResult | null = over ? { winners: [], draw: false } : null;
    return new FruitState(this.seed, fruit, world.nextId, this.next, rng.int(DROP_KINDS), this.drops + 1, score, result, world.made);
  }
}

export function newFruitMerge(seed: number): FruitState {
  const rng = createRng(seed >>> 0);
  return new FruitState(seed >>> 0, [], 0, rng.int(3), rng.int(3), 0, 0, null, []);
}

/**
 * Bot hands. Easy lets go anywhere. Medium drops onto the nearest fruit of the same kind it can
 * see from above, or into the lowest spot. Hard and Expert try a few spots and keep the one that
 * scores most and leaves the pile lowest.
 */
export function chooseFruitMove(state: FruitState, tier: BotTier, rng: Rng): FruitMove {
  const moves = state.legalMoves(0);
  if (tier === 'easy') return rng.pick(moves);
  const [lo, hi] = dropRange(state.kind);
  const clampX = (x: number) => Math.min(Math.floor(hi), Math.max(Math.ceil(lo), x));
  // The fruit you would land on at each x: the highest one there.
  const topAt = (x: number) =>
    state.fruit.filter((f) => Math.abs(f.x - x) < FRUIT_R[f.kind]! + FRUIT_R[state.kind]! * 0.5).sort((a, b) => a.y - FRUIT_R[a.kind]! - (b.y - FRUIT_R[b.kind]!))[0];
  if (tier === 'medium') {
    const same = state.fruit.filter((f) => f.kind === state.kind && topAt(f.x)?.id === f.id);
    if (same.length) return fruitMove(clampX(rng.pick(same).x));
    const lowest = moves.map((m) => ({ m, top: topAt(parseDrop(m)!) })).sort((a, b) => (b.top ? b.top.y - FRUIT_R[b.top.kind]! : 1e9) - (a.top ? a.top.y - FRUIT_R[a.top.kind]! : 1e9))[0]!;
    return lowest.m;
  }
  const tries = tier === 'expert' ? moves : moves.filter((_, i) => i % 2 === 0);
  const score = (m: FruitMove) => {
    const after = state.apply(m);
    const height = after.fruit.reduce((h, f) => Math.min(h, f.y - FRUIT_R[f.kind]!), FRUIT_BOX.bottom);
    return (after.result ? -1e6 : 0) + (after.score - state.score) * 20 + height;
  };
  const scored = tries.map((m) => ({ m, v: score(m) }));
  const best = Math.max(...scored.map((s) => s.v));
  return rng.pick(scored.filter((s) => s.v >= best - 1e-9)).m;
}

export const fruitMerge: GameDefinition<FruitMove> = {
  id: 'fruit-merge',
  name: 'Fruit Merge',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo', 'race'],
  hiddenInfo: false,
  realtime: false,
  newGame: (_config, seed) => newFruitMerge(seed),
  createBot: (tier) => ({
    chooseMove: (generic: GameState<FruitMove>, _seat: Seat, rng: Rng) => chooseFruitMove(generic as FruitState, tier, rng),
  }) satisfies Bot<FruitMove>,
  encodeMove: (move) => move,
  decodeMove: (key) => (parseDrop(key) !== null ? key : null),
};
