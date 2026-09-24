import type { Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Chinese Checkers (docs/games/chinese-checkers.md): the six-pointed star game, which began as the
 * German Stern-Halma in 1892 and took its English name from an American marketing idea. Ten
 * marbles each race from their own point of the star to the one opposite, stepping to a
 * neighboring hole or hopping over marbles, as many hops as they like in one turn.
 *
 * Holes are cube coordinates (q, r, s) with q + r + s = 0: the star is two big triangles laid over
 * each other, the upward one (every coordinate at least -4) and the downward one (every coordinate
 * at most 4).
 */
export interface StarHole {
  readonly q: number;
  readonly r: number;
  readonly s: number;
}

export const STAR_HOLES: readonly StarHole[] = (() => {
  const out: StarHole[] = [];
  for (let q = -8; q <= 8; q++) {
    for (let r = -8; r <= 8; r++) {
      const s = -q - r;
      const up = q >= -4 && r >= -4 && s >= -4;
      const down = q <= 4 && r <= 4 && s <= 4;
      if (up || down) out.push({ q, r, s });
    }
  }
  return out;
})();

const INDEX = new Map(STAR_HOLES.map((h, i) => [`${h.q},${h.r}`, i]));
export const holeAt = (q: number, r: number): number | undefined => INDEX.get(`${q},${r}`);

const DIRS: readonly (readonly [number, number])[] = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1],
];

/**
 * The six points of the star, in order round it. Point k is opposite point k + 3. Each is the
 * ten holes past the hexagon in one direction.
 */
const inPoint = (h: StarHole, k: number): boolean =>
  [h.q > 4, h.s < -4, h.r > 4, h.q < -4, h.s > 4, h.r < -4][k]!;
export const STAR_POINTS: readonly (readonly number[])[] = Array.from({ length: 6 }, (_, k) => STAR_HOLES.flatMap((h, i) => (inPoint(h, k) ? [i] : [])));

/**
 * Which point each seat starts in, by how many are playing; each aims for the one opposite. Six can
 * play on the board, but the table seats four for now.
 */
export const STAR_START: Readonly<Record<number, readonly number[]>> = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 6: [0, 1, 2, 3, 4, 5] };
export const targetOf = (start: number): number => (start + 3) % 6;

/** Plies before a game that has stalled is decided by who is nearest home. */
export const STAR_MOVE_LIMIT = 800;

/** `m<from>-<to>`: a step, or a run of hops ending on `to`. */
export type StarMove = string;

export class StarState implements GameState<StarMove> {
  constructor(
    readonly players: number,
    /** Which seat's marble is in each hole, or -1. */
    readonly board: readonly number[],
    readonly currentSeat: Seat,
    readonly plies: number,
    /** The last move's path, hop by hop, for the scene to follow. */
    readonly last: { seat: Seat; path: readonly number[] } | null,
    readonly result: GameResult | null,
  ) {}

  start(seat: Seat): number {
    return STAR_START[this.players]![seat]!;
  }

  /** Every hole the marble on `from` can reach this turn, each with the path that gets there. */
  reach(from: number): Map<number, number[]> {
    const out = new Map<number, number[]>();
    const h = STAR_HOLES[from]!;
    for (const [dq, dr] of DIRS) {
      const n = holeAt(h.q + dq, h.r + dr);
      if (n !== undefined && this.board[n] === -1) out.set(n, [from, n]);
    }
    // Hops: over one marble to the empty hole straight beyond, again and again.
    const queue: number[][] = [[from]];
    const seen = new Set([from]);
    while (queue.length) {
      const path = queue.shift()!;
      const at = STAR_HOLES[path[path.length - 1]!]!;
      for (const [dq, dr] of DIRS) {
        const over = holeAt(at.q + dq, at.r + dr);
        const land = holeAt(at.q + 2 * dq, at.r + 2 * dr);
        if (over === undefined || land === undefined || this.board[over] === -1 || this.board[land] !== -1 || seen.has(land)) continue;
        if (land === from) continue;
        seen.add(land);
        const next = [...path, land];
        if (!out.has(land)) out.set(land, next);
        queue.push(next);
      }
    }
    return out;
  }

  legalMoves(seat: Seat): readonly StarMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    const moves: StarMove[] = [];
    this.board.forEach((who, from) => {
      if (who !== seat) return;
      for (const to of this.reach(from).keys()) moves.push(`m${from}-${to}`);
    });
    return moves;
  }

  /** Home: the target point is full, and at least one of the marbles in it is yours. */
  home(seat: Seat): boolean {
    const target = STAR_POINTS[targetOf(this.start(seat))]!;
    return target.every((p) => this.board[p] !== -1) && target.some((p) => this.board[p] === seat);
  }

  /** How far a seat still has to go: each marble's distance to the far tip of its target. */
  distance(seat: Seat): number {
    const target = STAR_POINTS[targetOf(this.start(seat))]!;
    // The tip is the hole of the point farthest from the middle of the board.
    const tip = STAR_HOLES[target.find((p) => { const h = STAR_HOLES[p]!; return Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(h.s)) === 8; })!]!;
    let total = 0;
    this.board.forEach((who, p) => {
      if (who !== seat) return;
      const h = STAR_HOLES[p]!;
      total += (Math.abs(h.q - tip.q) + Math.abs(h.r - tip.r) + Math.abs(h.s - tip.s)) / 2;
    });
    return total;
  }

  apply(move: StarMove): StarState {
    if (!this.legalMoves(this.currentSeat).includes(move)) throw new Error(`Illegal move: ${move}`);
    const seat = this.currentSeat;
    const [from, to] = move.slice(1).split('-').map(Number) as [number, number];
    const path = this.reach(from).get(to)!;
    const board = this.board.slice();
    board[to] = seat;
    board[from] = -1;
    const plies = this.plies + 1;
    const next = new StarState(this.players, board, (seat + 1) % this.players, plies, { seat, path }, null);
    if (next.home(seat)) return new StarState(this.players, board, next.currentSeat, plies, { seat, path }, { winners: [seat], draw: false });
    if (plies >= STAR_MOVE_LIMIT) {
      // A stalled game goes to whoever is nearest home.
      const d = Array.from({ length: this.players }, (_, s) => next.distance(s));
      const best = Math.min(...d);
      const winners = d.flatMap((v, s) => (v === best ? [s] : []));
      return new StarState(this.players, board, next.currentSeat, plies, { seat, path }, winners.length === this.players ? { winners: [], draw: true } : { winners, draw: false });
    }
    return next;
  }
}

/** Distance between two holes, in steps. */
export function holeDistance(a: number, b: number): number {
  const x = STAR_HOLES[a]!;
  const y = STAR_HOLES[b]!;
  return (Math.abs(x.q - y.q) + Math.abs(x.r - y.r) + Math.abs(x.s - y.s)) / 2;
}

export function newStar(players: number): StarState {
  const n = STAR_START[players] ? players : 2;
  const board = Array<number>(STAR_HOLES.length).fill(-1);
  STAR_START[n]!.forEach((point, seat) => {
    for (const p of STAR_POINTS[point]!) board[p] = seat;
  });
  return new StarState(n, board, 0, 0, null, null);
}

export interface StarTier {
  readonly random: number;
  /** Look at the other players' best reply (2 players only: with more it costs too much for too little). */
  readonly reply: boolean;
}

export const STAR_TIERS: Record<BotTier, StarTier> = {
  easy: { random: 0.35, reply: false },
  medium: { random: 0.08, reply: false },
  hard: { random: 0, reply: false },
  expert: { random: 0, reply: true },
};

/** Greedy on distance gained, with a nudge to bring up the back marbles so nobody is left behind. */
function progress(state: StarState, seat: Seat, move: StarMove): number {
  const next = state.apply(move);
  if (next.result?.winners.includes(seat)) return 1e6;
  const gain = state.distance(seat) - next.distance(seat);
  const [from] = move.slice(1).split('-').map(Number) as [number];
  const target = STAR_POINTS[targetOf(state.start(seat))]!;
  const behind = Math.min(...target.map((p) => holeDistance(from, p)));
  return gain * 10 + behind * 0.5;
}

export function chooseStarMove(state: StarState, seat: Seat, tier: StarTier, rng: Rng): StarMove {
  const moves = state.legalMoves(seat);
  if (moves.length === 1) return moves[0]!;
  if (rng.next() < tier.random) return rng.pick(moves);
  let scored = moves.map((move) => ({ move, score: progress(state, seat, move) }));
  if (tier.reply && state.players === 2) {
    scored.sort((a, b) => b.score - a.score);
    scored = scored.slice(0, 8).map(({ move, score }) => {
      const next = state.apply(move);
      if (next.result) return { move, score };
      const other = next.currentSeat;
      const theirs = Math.max(...next.legalMoves(other).map((m) => progress(next, other, m)));
      return { move, score: score - theirs * 0.6 };
    });
  }
  const best = Math.max(...scored.map((s) => s.score));
  return rng.pick(scored.filter((s) => s.score === best)).move;
}

export const chineseCheckers: GameDefinition<StarMove> = {
  id: 'chinese-checkers',
  name: 'Chinese Checkers',
  minPlayers: 2,
  maxPlayers: 4,
  modes: ['bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: false,
  realtime: false,
  newGame: (config) => newStar(config.players),
  createBot: (tier): Bot<StarMove> => ({
    chooseMove: (state, seat, rng) => chooseStarMove(state as StarState, seat, STAR_TIERS[tier], rng),
  }),
  encodeMove: (move) => move,
};
