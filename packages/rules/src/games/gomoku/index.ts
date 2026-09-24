import type { Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Gomoku (docs/games/gomoku.md), freestyle: two players take turns putting a stone on a 15 by 15
 * board; the first to get five or more in a row, across, down or corner to corner, wins. A full
 * board is a draw. Black (seat 0) goes first.
 */
export const GOMOKU_N = 15;
const N = GOMOKU_N;

/** Every run of five cells on the board: the only places five in a row can ever be made. */
const WINDOWS: readonly (readonly number[])[] = (() => {
  const out: number[][] = [];
  const dirs = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++)
      for (const [dx, dy] of dirs) {
        const ex = x + dx! * 4;
        const ey = y + dy! * 4;
        if (ex < 0 || ex >= N || ey < 0 || ey >= N) continue;
        out.push([0, 1, 2, 3, 4].map((k) => (y + dy! * k) * N + x + dx! * k));
      }
  return out;
})();
/** The windows each cell is in. */
const WINDOWS_AT: readonly (readonly number[])[] = (() => {
  const at: number[][] = Array.from({ length: N * N }, () => []);
  WINDOWS.forEach((w, i) => w.forEach((c) => at[c]!.push(i)));
  return at;
})();

export const gomokuMove = (cell: number) => `p${cell}`;

/** Does the stone just put at `cell` make five or more in a row? */
export function makesFive(board: readonly number[], cell: number): boolean {
  const who = board[cell]!;
  const x = cell % N;
  const y = Math.floor(cell / N);
  for (const [dx, dy] of [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ] as const) {
    let run = 1;
    for (const s of [1, -1]) {
      let cx = x + dx * s;
      let cy = y + dy * s;
      while (cx >= 0 && cy >= 0 && cx < N && cy < N && board[cy * N + cx] === who) {
        run++;
        cx += dx * s;
        cy += dy * s;
      }
    }
    if (run >= 5) return true;
  }
  return false;
}

export class GomokuState implements GameState<string> {
  constructor(
    /** 0 empty, 1 black (seat 0), 2 white (seat 1). */
    readonly board: readonly number[],
    readonly currentSeat: Seat,
    readonly moves: number,
    readonly last: number | null,
    readonly result: GameResult | null,
    /** The five (or more) that won, for the scene to light up. */
    readonly line: readonly number[],
  ) {}

  legalMoves(seat: Seat): readonly string[] {
    if (this.result || seat !== this.currentSeat) return [];
    const out: string[] = [];
    this.board.forEach((v, i) => v === 0 && out.push(gomokuMove(i)));
    return out;
  }

  apply(move: string): GomokuState {
    const cell = Number(move.slice(1));
    if (!/^p\d+$/.test(move) || this.result || this.board[cell] !== 0) throw new Error(`Illegal move: ${move}`);
    const board = this.board.slice();
    board[cell] = this.currentSeat + 1;
    if (makesFive(board, cell)) {
      const line = WINDOWS_AT[cell]!.map((w) => WINDOWS[w]!).find((w) => w.every((c) => board[c] === board[cell])) ?? [cell];
      return new GomokuState(board, this.currentSeat, this.moves + 1, cell, { winners: [this.currentSeat], draw: false }, line);
    }
    if (this.moves + 1 === N * N) return new GomokuState(board, this.currentSeat, this.moves + 1, cell, { winners: [], draw: true }, []);
    return new GomokuState(board, (1 - this.currentSeat) as Seat, this.moves + 1, cell, null, []);
  }
}

export function newGomoku(): GomokuState {
  return new GomokuState(Array<number>(N * N).fill(0), 0, 0, null, null, []);
}

// ---------------------------------------------------------------------------------------------
// Bots. A cell is worth what it does to every window of five through it: a window with none of the
// other player's stones is a chance for this one, worth more the fuller it is. Adding the other
// player's worth there too means a move that also blocks is preferred. The better tiers add a
// search for a forced win by fours (each four must be blocked at once, so the replies are known).

/** Worth of a window after a stone is added, by how many of that player's stones it then holds. */
const WORTH = [0, 1, 12, 120, 2400, 1e7];

function counts(board: readonly number[], w: number): [number, number] {
  let a = 0;
  let b = 0;
  for (const c of WINDOWS[w]!) {
    if (board[c] === 1) a++;
    else if (board[c] === 2) b++;
  }
  return [a, b];
}

/** What putting `who`'s stone at `cell` is worth to `who`. */
function worth(board: readonly number[], cell: number, who: 1 | 2): number {
  let v = 0;
  for (const w of WINDOWS_AT[cell]!) {
    const [a, b] = counts(board, w);
    const mine = who === 1 ? a : b;
    const theirs = who === 1 ? b : a;
    if (theirs === 0) v += WORTH[mine + 1]!;
  }
  return v;
}

/** Empty cells near stones: the only ones worth thinking about. */
function candidates(board: readonly number[]): number[] {
  const out: number[] = [];
  let any = false;
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== 0) {
      any = true;
      continue;
    }
    const x = i % N;
    const y = Math.floor(i / N);
    let near = false;
    for (let dy = -2; dy <= 2 && !near; dy++)
      for (let dx = -2; dx <= 2 && !near; dx++) {
        const cx = x + dx;
        const cy = y + dy;
        if ((dx || dy) && cx >= 0 && cy >= 0 && cx < N && cy < N && board[cy * N + cx] !== 0) near = true;
      }
    if (near) out.push(i);
  }
  return any ? out : [Math.floor((N * N) / 2)];
}

/** Cells where `who` would make five right now. */
function fives(board: readonly number[], who: 1 | 2): number[] {
  const out = new Set<number>();
  WINDOWS.forEach((win, w) => {
    const [a, b] = counts(board, w);
    const mine = who === 1 ? a : b;
    const theirs = who === 1 ? b : a;
    if (mine === 4 && theirs === 0) for (const c of win) if (board[c] === 0) out.add(c);
  });
  return [...out];
}

/** Moves that make a four for `who` (a window with four of theirs and one gap). */
function fourMakers(board: readonly number[], who: 1 | 2): number[] {
  const out = new Set<number>();
  WINDOWS.forEach((win, w) => {
    const [a, b] = counts(board, w);
    const mine = who === 1 ? a : b;
    const theirs = who === 1 ? b : a;
    if (mine === 3 && theirs === 0) for (const c of win) if (board[c] === 0) out.add(c);
  });
  return [...out];
}

/**
 * Can `who`, to move, force a win by fours alone? Each four has to be blocked on the spot, so the
 * reply is forced and the search stays narrow. Returns the first move of the win, or -1.
 */
export function forcedWin(board: number[], who: 1 | 2, depth: number): number {
  const other: 1 | 2 = who === 1 ? 2 : 1;
  const now = fives(board, who);
  if (now.length) return now[0]!;
  if (depth <= 0 || fives(board, other).length) return -1;
  for (const m of fourMakers(board, who)) {
    board[m] = who;
    const threats = fives(board, who);
    let win = false;
    if (threats.length >= 2) win = true;
    else if (threats.length === 1) {
      const block = threats[0]!;
      board[block] = other;
      // A block that makes five for them ends it; otherwise keep pressing.
      if (!makesFive(board, block)) win = forcedWin(board, who, depth - 1) >= 0;
      board[block] = 0;
    }
    board[m] = 0;
    if (win) return m;
  }
  return -1;
}

interface GomokuTier {
  /** Chance of a loose move from the top few, instead of the best. */
  readonly loose: number;
  /** How deep to look for a forced win by fours (0: not at all). */
  readonly search: number;
  /** Look for the other player's forced win, and break it. */
  readonly guard: boolean;
}

export const GOMOKU_TIERS: Record<BotTier, GomokuTier> = {
  easy: { loose: 0.45, search: 0, guard: false },
  medium: { loose: 0.12, search: 0, guard: false },
  hard: { loose: 0, search: 6, guard: false },
  expert: { loose: 0, search: 10, guard: true },
};

export function chooseGomokuMove(state: GomokuState, tier: GomokuTier, rng: Rng): string {
  const board = state.board.slice();
  const me: 1 | 2 = state.currentSeat === 0 ? 1 : 2;
  const them: 1 | 2 = me === 1 ? 2 : 1;
  // Win now; else stop theirs.
  const win = fives(board, me);
  if (win.length) return gomokuMove(win[0]!);
  const block = fives(board, them);
  if (block.length) return gomokuMove(block[0]!);
  if (tier.search) {
    const forced = forcedWin(board, me, tier.search);
    if (forced >= 0) return gomokuMove(forced);
  }
  const cands = candidates(board);
  const scored = cands.map((c) => ({ c, v: worth(board, c, me) + worth(board, c, them) * 0.9 })).sort((a, b) => b.v - a.v);
  if (tier.loose && rng.next() < tier.loose) return gomokuMove(rng.pick(scored.slice(0, 6)).c);
  if (tier.guard) {
    // If they have a forced win, play the best move that leaves them without one.
    const threat = forcedWin(board, them, 8);
    if (threat >= 0) {
      for (const { c } of scored.slice(0, 12)) {
        board[c] = me;
        const still = forcedWin(board, them, 8) >= 0;
        board[c] = 0;
        if (!still) return gomokuMove(c);
      }
    }
  }
  const best = scored[0]!.v;
  return gomokuMove(rng.pick(scored.filter((s) => s.v >= best - 1e-9)).c);
}

export const gomoku: GameDefinition<string> = {
  id: 'gomoku',
  name: 'Gomoku',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: false,
  realtime: false,
  newGame: () => newGomoku(),
  createBot: (tier) => ({
    chooseMove: (generic: GameState<string>, _seat: Seat, rng: Rng) => chooseGomokuMove(generic as GomokuState, GOMOKU_TIERS[tier], rng),
  }) satisfies Bot<string>,
  encodeMove: (move) => move,
};
