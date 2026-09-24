import { createRng, type Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * 2248 (docs/games/chain-merge.md): a grid of numbers, every one a power of two. Drag a chain
 * through neighbours (sideways, up, down or corner to corner) that starts with two the same, where
 * each next number is the same as the one before or double it. The chain becomes one tile at its
 * end, worth its sum rounded up to a power of two, the rest drop down and new numbers fall in from
 * the top. Make 4096 within thirty chains and you win; the real game goes on for ever, and a game
 * here has to end.
 *
 * Values are kept as powers: 1 is 2, 2 is 4, 12 is 4096.
 */
export const CM_COLS = 5;
export const CM_ROWS = 7;
export const CM_GOAL = 12;
export const CM_CHAINS = 30;

/** A chain move: the cells in the order they were joined, as `p30.31.26`. */
export type ChainMove = string;

export const chainMove = (cells: readonly number[]): ChainMove => `p${cells.join('.')}`;

export function parseChain(move: string): number[] | null {
  const m = /^p(\d+(?:\.\d+)+)$/.exec(move);
  if (!m) return null;
  const cells = m[1]!.split('.').map(Number);
  return cells.every((c) => c >= 0 && c < CM_COLS * CM_ROWS) && new Set(cells).size === cells.length ? cells : null;
}

export const touching = (a: number, b: number) =>
  a !== b && Math.abs((a % CM_COLS) - (b % CM_COLS)) <= 1 && Math.abs(Math.floor(a / CM_COLS) - Math.floor(b / CM_COLS)) <= 1;

/** Does this run of powers make a chain: two the same to start, then each the same or one more? */
export function chainFits(powers: readonly number[]): boolean {
  if (powers.length < 2 || powers[1] !== powers[0]) return false;
  for (let i = 2; i < powers.length; i++) if (powers[i] !== powers[i - 1] && powers[i] !== powers[i - 1]! + 1) return false;
  return true;
}

/** What a chain of these powers turns into: the sum, rounded up to a power of two. */
export function chainResult(powers: readonly number[]): number {
  const sum = powers.reduce((a, p) => a + 2 ** p, 0);
  return Math.ceil(Math.log2(sum) - 1e-9);
}

export interface ChainChange {
  readonly cells: readonly number[];
  readonly made: number;
  /** Where each tile left standing fell from (-1 for a new one dropped in from the top). */
  readonly fell: readonly number[];
}

export class ChainState implements GameState<ChainMove> {
  readonly currentSeat: Seat = 0;

  constructor(
    readonly grid: readonly number[],
    readonly score: number,
    readonly seed: number,
    readonly drops: number,
    /** Chains made so far. */
    readonly used: number,
    readonly result: GameResult | null,
    readonly last: ChainChange | null,
  ) {}

  get left(): number {
    return CM_CHAINS - this.used;
  }

  get best(): number {
    return Math.max(...this.grid);
  }

  /** Every chain is thousands of paths, so this is the authority and `legalMoves` is a spread. */
  allows(move: ChainMove): boolean {
    if (this.result) return false;
    const cells = parseChain(move);
    if (!cells) return false;
    for (let i = 1; i < cells.length; i++) if (!touching(cells[i - 1]!, cells[i]!)) return false;
    return chainFits(cells.map((c) => this.grid[c]!));
  }

  /** Every pair of touching equal numbers, and the longest easy chain grown from each: for bots and tests. */
  legalMoves(seat: Seat): readonly ChainMove[] {
    if (this.result || seat !== 0) return [];
    const out: ChainMove[] = [];
    for (const [a, b] of this.pairs()) {
      out.push(chainMove([a, b]));
      const grown = this.grow([a, b]);
      if (grown.length > 2) out.push(chainMove(grown));
    }
    return out;
  }

  private pairs(): [number, number][] {
    const out: [number, number][] = [];
    for (let a = 0; a < this.grid.length; a++)
      for (let b = 0; b < this.grid.length; b++) if (touching(a, b) && this.grid[a] === this.grid[b]) out.push([a, b]);
    return out;
  }

  /** Greedily extends a chain, taking a same number first and then a double, until it can go no further. */
  grow(start: readonly number[]): number[] {
    const path = [...start];
    for (;;) {
      const end = path[path.length - 1]!;
      const p = this.grid[end]!;
      const next = [...Array(this.grid.length).keys()]
        .filter((c) => touching(end, c) && !path.includes(c) && (this.grid[c] === p || this.grid[c] === p + 1))
        .sort((x, y) => this.grid[x]! - this.grid[y]!)[0];
      if (next === undefined) return path;
      path.push(next);
    }
  }

  apply(move: ChainMove): ChainState {
    if (!this.allows(move)) throw new Error(`Illegal move: ${move}`);
    const cells = parseChain(move)!;
    const made = chainResult(cells.map((c) => this.grid[c]!));
    const end = cells[cells.length - 1]!;
    const gone = new Set(cells.slice(0, -1));
    const grid: (number | null)[] = this.grid.map((p, i) => (gone.has(i) ? null : i === end ? made : p));
    // Each column settles down, and new numbers drop in on top.
    const out: number[] = Array<number>(grid.length).fill(0);
    const fell: number[] = Array<number>(grid.length).fill(-1);
    const rng = createRng((this.seed ^ Math.imul(this.drops + 1, 0x9e3779b1)) >>> 0);
    const best = Math.max(made, ...this.grid);
    let drops = 0;
    for (let col = 0; col < CM_COLS; col++) {
      const stay: { p: number; from: number }[] = [];
      for (let row = CM_ROWS - 1; row >= 0; row--) {
        const i = row * CM_COLS + col;
        if (grid[i] !== null) stay.push({ p: grid[i]!, from: i });
      }
      for (let row = CM_ROWS - 1, k = 0; row >= 0; row--, k++) {
        const i = row * CM_COLS + col;
        if (k < stay.length) {
          out[i] = stay[k]!.p;
          fell[i] = stay[k]!.from;
        } else {
          out[i] = dropFor(rng, best);
          drops++;
        }
      }
    }
    const score = this.score + 2 ** made;
    const used = this.used + 1;
    const next = new ChainState(out, score, this.seed, this.drops + drops, used, null, { cells, made, fell });
    const won = made >= CM_GOAL;
    const over = won || used >= CM_CHAINS || next.pairs().length === 0;
    if (over) return new ChainState(out, score, this.seed, next.drops, used, { winners: won ? [0] : [], draw: false }, next.last);
    return next;
  }
}

/** A new number: small ones mostly, and the smallest on offer creeps up as the best tile grows. */
function dropFor(rng: Rng, best: number): number {
  const low = Math.max(1, best - 7);
  return low + Math.floor(rng.next() ** 1.6 * 5);
}

export function newChainMerge(seed: number): ChainState {
  const rng = createRng(seed >>> 0);
  for (let attempt = 0; ; attempt++) {
    const grid = Array.from({ length: CM_COLS * CM_ROWS }, () => 1 + Math.floor(rng.next() ** 1.4 * 6));
    const state = new ChainState(grid, 0, seed >>> 0, 0, 0, null, null);
    if (state.legalMoves(0).length >= 4 || attempt > 20) return state;
  }
}

export interface ChainTier {
  /** Pick the chain that makes the biggest tile, rather than any. */
  readonly greedy: boolean;
  /** Look one move further: how many chains the board is left with. */
  readonly ahead: boolean;
}

const CHAIN_TIERS: Record<BotTier, ChainTier> = {
  easy: { greedy: false, ahead: false },
  medium: { greedy: true, ahead: false },
  hard: { greedy: true, ahead: true },
  expert: { greedy: true, ahead: true },
};

export function chooseChainMove(state: ChainState, tier: ChainTier, rng: Rng): ChainMove {
  const moves = state.legalMoves(0);
  if (!moves.length) throw new Error('No legal moves');
  if (!tier.greedy) return rng.pick(moves);
  const score = (m: ChainMove) => {
    const cells = parseChain(m)!;
    const made = chainResult(cells.map((c) => state.grid[c]!));
    // Big tiles low down are easier to feed; a board left with chains is a board still alive.
    let v = made * 10 + cells.length + Math.floor(cells[cells.length - 1]! / CM_COLS) * 0.5;
    if (tier.ahead) v += Math.min(state.apply(m).legalMoves(0).length, 20) * 0.6;
    return v;
  };
  const scored = moves.map((m) => ({ m, v: score(m) }));
  const top = Math.max(...scored.map((s) => s.v));
  return rng.pick(scored.filter((s) => s.v >= top - 1e-9)).m;
}

export const chainMerge: GameDefinition<ChainMove> = {
  id: 'chain-merge',
  name: '2248',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo', 'race'],
  hiddenInfo: false,
  realtime: false,
  newGame: (_config, seed) => newChainMerge(seed),
  createBot: (tier) => ({
    chooseMove: (generic: GameState<ChainMove>, _seat: Seat, rng: Rng) => chooseChainMove(generic as ChainState, CHAIN_TIERS[tier], rng),
  }) satisfies Bot<ChainMove>,
  encodeMove: (move) => move,
  decodeMove: (key) => (parseChain(key) ? key : null),
};

export { CHAIN_TIERS };
