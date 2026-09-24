import type { Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Connect Six (docs/games/connect-six.md): Black puts down one stone, then each player puts down two
 * a turn; six or more in a row wins. A move is one stone, so a turn is two moves by the same seat.
 */
export type SixLevel = '15' | '19';
export const SIX_LEVELS: readonly SixLevel[] = ['15', '19'];

const DIRS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
] as const;

interface Geometry {
  readonly n: number;
  /** Every run of six cells, and the runs each cell is in. */
  readonly windows: readonly (readonly number[])[];
  readonly at: readonly (readonly number[])[];
}

const GEOMETRY = new Map<number, Geometry>();
function geometry(n: number): Geometry {
  const known = GEOMETRY.get(n);
  if (known) return known;
  const windows: number[][] = [];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      for (const [dx, dy] of DIRS) {
        const ex = x + dx * 5;
        const ey = y + dy * 5;
        if (ex < 0 || ex >= n || ey < 0 || ey >= n) continue;
        windows.push([0, 1, 2, 3, 4, 5].map((k) => (y + dy * k) * n + x + dx * k));
      }
  const at: number[][] = Array.from({ length: n * n }, () => []);
  windows.forEach((w, i) => w.forEach((c) => at[c]!.push(i)));
  const g = { n, windows, at };
  GEOMETRY.set(n, g);
  return g;
}

export const sixMove = (cell: number) => `p${cell}`;
/** Whose stone the `k`th stone of the game is: Black's first, then two each. */
export const sixSeatOf = (k: number): Seat => (Math.floor((k + 1) / 2) % 2) as Seat;
/** Which turn the `k`th stone belongs to: 0 for Black's opening stone, then one per pair. */
export const sixTurnOf = (k: number) => Math.floor((k + 1) / 2);

export class SixState implements GameState<string> {
  constructor(
    readonly n: number,
    /** 0 empty, 1 black (seat 0), 2 white (seat 1). */
    readonly board: readonly number[],
    readonly stones: number,
    readonly last: number | null,
    readonly result: GameResult | null,
    /** The six (or more) that won, for the scene to light up. */
    readonly line: readonly number[],
    /** Every stone in the order it went down, so the scene can mark the last turn's pair. */
    readonly placed: readonly number[] = [],
  ) {}

  get currentSeat(): Seat {
    return sixSeatOf(this.stones);
  }

  /** Stones still to put down this turn, counting the one about to be placed. */
  get left(): number {
    return this.stones === 0 ? 1 : this.stones % 2 === 1 ? 2 : 1;
  }

  legalMoves(seat: Seat): readonly string[] {
    if (this.result || seat !== this.currentSeat) return [];
    const out: string[] = [];
    this.board.forEach((v, i) => v === 0 && out.push(sixMove(i)));
    return out;
  }

  apply(move: string): SixState {
    const cell = Number(move.slice(1));
    if (!/^p\d+$/.test(move) || this.result || this.board[cell] !== 0) throw new Error(`Illegal move: ${move}`);
    const who = this.currentSeat;
    const board = this.board.slice();
    board[cell] = who + 1;
    const line = sixLine(board, cell, this.n);
    const placed = [...this.placed, cell];
    if (line.length) return new SixState(this.n, board, this.stones + 1, cell, { winners: [who], draw: false }, line, placed);
    if (this.stones + 1 === this.n * this.n) return new SixState(this.n, board, this.stones + 1, cell, { winners: [], draw: true }, [], placed);
    return new SixState(this.n, board, this.stones + 1, cell, null, [], placed);
  }
}

/** The run of six or more through `cell`, if the stone there makes one; else empty. */
export function sixLine(board: readonly number[], cell: number, n: number): number[] {
  const who = board[cell]!;
  const x = cell % n;
  const y = Math.floor(cell / n);
  for (const [dx, dy] of DIRS) {
    const run = [cell];
    for (const s of [1, -1]) {
      let cx = x + dx * s;
      let cy = y + dy * s;
      while (cx >= 0 && cy >= 0 && cx < n && cy < n && board[cy * n + cx] === who) {
        if (s === 1) run.push(cy * n + cx);
        else run.unshift(cy * n + cx);
        cx += dx * s;
        cy += dy * s;
      }
    }
    if (run.length >= 6) return run;
  }
  return [];
}

export function newConnectSix(level: SixLevel = '15'): SixState {
  const n = Number(level);
  return new SixState(n, Array<number>(n * n).fill(0), 0, null, null, []);
}

// ---------------------------------------------------------------------------------------------
// Bots, one stone at a time. A window of six with none of the other player's stones is a chance,
// worth more the fuller it is; four or five of one player's stones in a window with none of the
// other's is a threat, since two stones finish it, and has to get a stone of the other's at once.

const WORTH = [0, 1, 8, 60, 700, 9000, 1e7];

function counts(board: readonly number[], win: readonly number[]): [number, number] {
  let a = 0;
  let b = 0;
  for (const c of win) {
    if (board[c] === 1) a++;
    else if (board[c] === 2) b++;
  }
  return [a, b];
}

/** The windows where `who` has at least `k` stones and the other player none. */
function openWindows(board: readonly number[], g: Geometry, who: 1 | 2, k: number): (readonly number[])[] {
  return g.windows.filter((w) => {
    const [a, b] = counts(board, w);
    return (who === 1 ? a : b) >= k && (who === 1 ? b : a) === 0;
  });
}

/** How many stones the other player needs to put down to break every threat `who` has. */
export function blockersNeeded(board: readonly number[], n: number, who: 1 | 2): number {
  let threats = openWindows(board, geometry(n), who, 4);
  let needed = 0;
  while (threats.length && needed < 4) {
    // The empty point in the most threats; greedy is close enough for counting.
    const hits = new Map<number, number>();
    for (const w of threats) for (const c of w) if (board[c] === 0) hits.set(c, (hits.get(c) ?? 0) + 1);
    let best = -1;
    let most = 0;
    for (const [c, k] of hits) if (k > most) (best = c), (most = k);
    if (best < 0) break;
    threats = threats.filter((w) => !w.includes(best));
    needed++;
  }
  return needed;
}

function worth(board: readonly number[], g: Geometry, cell: number, who: 1 | 2): number {
  let v = 0;
  for (const w of g.at[cell]!) {
    const [a, b] = counts(board, g.windows[w]!);
    const mine = who === 1 ? a : b;
    const theirs = who === 1 ? b : a;
    if (theirs === 0) v += WORTH[mine + 1]!;
  }
  return v;
}

function candidates(board: readonly number[], n: number): number[] {
  const out: number[] = [];
  let any = false;
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== 0) {
      any = true;
      continue;
    }
    const x = i % n;
    const y = Math.floor(i / n);
    let near = false;
    for (let dy = -2; dy <= 2 && !near; dy++)
      for (let dx = -2; dx <= 2 && !near; dx++) {
        const cx = x + dx;
        const cy = y + dy;
        if ((dx || dy) && cx >= 0 && cy >= 0 && cx < n && cy < n && board[cy * n + cx] !== 0) near = true;
      }
    if (near) out.push(i);
  }
  return any ? out : [Math.floor((n * n) / 2)];
}

interface SixTier {
  /** Chance of a loose stone from the top few instead of the best. */
  readonly loose: number;
  readonly block: boolean;
  /** How many first stones to try as the start of a pair (0: one stone at a time). */
  readonly firsts: number;
  /** How many second stones to try with each first, and for the second stone itself. */
  readonly seconds: number;
  /** Count the stones the other player would need to stop us: three is a win, two forces them. */
  readonly press: boolean;
  /** Look for a pair of theirs that would need three stones to stop, and spoil it first. */
  readonly guard: boolean;
}

export const SIX_TIERS: Record<BotTier, SixTier> = {
  easy: { loose: 0.5, block: false, firsts: 0, seconds: 0, press: false, guard: false },
  medium: { loose: 0.1, block: true, firsts: 0, seconds: 0, press: false, guard: false },
  hard: { loose: 0, block: true, firsts: 8, seconds: 4, press: true, guard: false },
  expert: { loose: 0, block: true, firsts: 14, seconds: 10, press: true, guard: true },
};

/** What making `who` this hard to stop is worth: three stones needed wins, two forces a block. */
const pressWorth = (needed: number) => (needed >= 3 ? 1e8 : needed * 3000);

/** Could `who`, with a whole turn of two stones, leave threats that need three stones to stop? */
function pairWins(board: number[], g: Geometry, n: number, who: 1 | 2): boolean {
  const other: 1 | 2 = who === 1 ? 2 : 1;
  const rank = () =>
    candidates(board, n)
      .filter((c) => board[c] === 0)
      .map((c) => ({ c, v: worth(board, g, c, who) + worth(board, g, c, other) * 0.3 }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 6);
  for (const a of rank()) {
    board[a.c] = who;
    for (const b of rank()) {
      board[b.c] = who;
      const needed = blockersNeeded(board, n, who);
      board[b.c] = 0;
      if (needed >= 3) {
        board[a.c] = 0;
        return true;
      }
    }
    board[a.c] = 0;
  }
  return false;
}

export function chooseSixMove(state: SixState, tier: SixTier, rng: Rng): string {
  const n = state.n;
  const g = geometry(n);
  const board = state.board.slice();
  const me: 1 | 2 = state.currentSeat === 0 ? 1 : 2;
  const them: 1 | 2 = me === 1 ? 2 : 1;
  const left = state.left;
  // 1. Win: a window that the stones left this turn can finish.
  for (const w of openWindows(board, g, me, 6 - left)) {
    const gap = w.find((c) => board[c] === 0);
    if (gap !== undefined) return sixMove(gap);
  }
  // 2. Block every threat of theirs, the point in most of them first.
  const threats = openWindows(board, g, them, 4);
  if (threats.length && (tier.block || rng.next() < 0.5)) {
    const hits = new Map<number, number>();
    for (const w of threats) for (const c of w) if (board[c] === 0) hits.set(c, (hits.get(c) ?? 0) + 1);
    const most = Math.max(...hits.values());
    return sixMove(rng.pick([...hits].filter(([, k]) => k === most).map(([c]) => c)));
  }
  // 3. The best point, or the first stone of the best pair.
  const ranked = () =>
    candidates(board, n)
      .filter((c) => board[c] === 0)
      .map((c) => ({ c, v: worth(board, g, c, me) + worth(board, g, c, them) * 0.8 }))
      .sort((a, b) => b.v - a.v);
  const scored = ranked();
  if (tier.loose && rng.next() < tier.loose) return sixMove(rng.pick(scored.slice(0, 6)).c);
  if (tier.press && left === 1) {
    // The second stone: the best point, counting how hard the pair is to stop.
    const threatened = tier.guard && pairWins(board, g, n, them);
    let best = scored[0]!;
    let bestV = -Infinity;
    for (const d of scored.slice(0, Math.max(tier.seconds, 6))) {
      board[d.c] = me;
      let total = d.v + pressWorth(blockersNeeded(board, n, me));
      // Leaving them a pair that cannot be stopped is as bad as losing, unless ours wins first.
      if (threatened && total < 1e8 && pairWins(board, g, n, them)) total -= 1e7;
      board[d.c] = 0;
      if (total > bestV) (bestV = total), (best = d);
    }
    return sixMove(best.c);
  }
  if (tier.firsts && left === 2) {
    const pairs: { first: number; total: number; second: number }[] = [];
    for (const first of scored.slice(0, tier.firsts)) {
      board[first.c] = me;
      for (const second of ranked().slice(0, Math.max(1, tier.seconds))) {
        board[second.c] = me;
        const total = first.v + second.v + (tier.press ? pressWorth(blockersNeeded(board, n, me)) : 0);
        board[second.c] = 0;
        pairs.push({ first: first.c, second: second.c, total });
      }
      board[first.c] = 0;
    }
    pairs.sort((a, b) => b.total - a.total);
    if (tier.guard && pairs[0]!.total < 1e8 && pairWins(board, g, n, them)) {
      // They have an unstoppable pair waiting: take the best of ours that spoils it.
      for (const p of pairs.slice(0, 10)) {
        board[p.first] = me;
        board[p.second] = me;
        const still = pairWins(board, g, n, them);
        board[p.first] = 0;
        board[p.second] = 0;
        if (!still) return sixMove(p.first);
      }
    }
    return sixMove(pairs[0]?.first ?? scored[0]!.c);
  }
  const top = scored[0]!.v;
  return sixMove(rng.pick(scored.filter((s) => s.v >= top - 1e-9)).c);
}

const isLevel = (v: string | undefined): v is SixLevel => SIX_LEVELS.includes(v as SixLevel);

export const connectSix: GameDefinition<string> = {
  id: 'connect-six',
  name: 'Connect Six',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: false,
  realtime: false,
  newGame: (config) => newConnectSix(isLevel(config.variant) ? config.variant : '15'),
  createBot: (tier) => ({
    chooseMove: (generic: GameState<string>, _seat: Seat, rng: Rng) => chooseSixMove(generic as SixState, SIX_TIERS[tier], rng),
  }) satisfies Bot<string>,
  encodeMove: (move) => move,
};
