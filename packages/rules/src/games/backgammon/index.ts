import { createRng, type Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Backgammon (docs/games/backgammon.md). Points are 0–23. Seat 0 moves downward (home 0–5),
 * seat 1 moves upward (home 18–23). `points[i]` is positive for seat 0 checkers and negative
 * for seat 1. No doubling cube and no gammon scoring: one game, one winner.
 */
export const CHECKERS_PER_SIDE = 15;
export type BackgammonMove = string;

export const enterMove = (to: number): BackgammonMove => `e${to}`;
export const stepMove = (from: number, to: number): BackgammonMove => `m${from}.${to}`;
export const bearOffMove = (from: number): BackgammonMove => `o${from}`;
export const ROLL: BackgammonMove = 'r';
export const PASS: BackgammonMove = 'pass';

export interface BackgammonEvent {
  readonly kind: 'roll' | 'move' | 'pass';
  readonly seat: Seat;
  readonly dice?: readonly number[];
  /** -1 means "from the bar". */
  readonly from?: number;
  /** -1 means "borne off". */
  readonly to?: number;
  readonly hit?: boolean;
}

export interface Board {
  points: number[];
  /** Checkers waiting on the bar, per seat. */
  bar: [number, number];
  /** Checkers borne off, per seat. */
  off: [number, number];
}

const other = (seat: Seat): Seat => (seat === 0 ? 1 : 0);
const mine = (count: number, seat: Seat) => (seat === 0 ? count > 0 : count < 0);
const theirs = (count: number, seat: Seat) => (seat === 0 ? count < 0 : count > 0);
const size = (count: number) => Math.abs(count);
const cloneBoard = (board: Board): Board => ({ points: board.points.slice(), bar: [...board.bar], off: [...board.off] });

export function startingBoard(): Board {
  const points = Array<number>(24).fill(0);
  points[23] = 2;
  points[12] = 5;
  points[7] = 3;
  points[5] = 5;
  points[0] = -2;
  points[11] = -5;
  points[16] = -3;
  points[18] = -5;
  return { points, bar: [0, 0], off: [0, 0] };
}

/** Where a checker lands when it comes in from the bar with `die`. */
export const entryPoint = (seat: Seat, die: number): number => (seat === 0 ? 24 - die : die - 1);
/** How far a checker on `point` still has to travel to come off. */
export const distanceToOff = (seat: Seat, point: number): number => (seat === 0 ? point + 1 : 24 - point);
const homePoints = (seat: Seat): number[] => (seat === 0 ? [0, 1, 2, 3, 4, 5] : [18, 19, 20, 21, 22, 23]);

export function pipCount(board: Board, seat: Seat): number {
  let pips = board.bar[seat] * 25;
  board.points.forEach((count, point) => {
    if (mine(count, seat)) pips += size(count) * distanceToOff(seat, point);
  });
  return pips;
}

/** Every checker home (or already off), so bearing off may start. */
export function canBearOff(board: Board, seat: Seat): boolean {
  if (board.bar[seat] > 0) return false;
  const home = new Set(homePoints(seat));
  return board.points.every((count, point) => !mine(count, seat) || home.has(point));
}

/** Moves using exactly one die, ignoring the "use both dice" rule. */
function movesWithDie(board: Board, seat: Seat, die: number): BackgammonMove[] {
  const moves: BackgammonMove[] = [];
  const open = (point: number) => {
    const count = board.points[point]!;
    return !theirs(count, seat) || size(count) === 1;
  };
  if (board.bar[seat] > 0) {
    const to = entryPoint(seat, die);
    return open(to) ? [enterMove(to)] : [];
  }
  const bearing = canBearOff(board, seat);
  for (let from = 0; from < 24; from++) {
    if (!mine(board.points[from]!, seat)) continue;
    const to = seat === 0 ? from - die : from + die;
    if (to >= 0 && to <= 23) {
      if (open(to)) moves.push(stepMove(from, to));
      continue;
    }
    if (!bearing) continue;
    const distance = distanceToOff(seat, from);
    if (distance === die) moves.push(bearOffMove(from));
    // A bigger number than needed takes a checker off the highest point, if nothing is further back.
    else if (die > distance && !board.points.some((count, point) => mine(count, seat) && distanceToOff(seat, point) > distance)) {
      moves.push(bearOffMove(from));
    }
  }
  return moves;
}

/** Plays one move on a copy, saying whether it hit a blot. */
function playMove(board: Board, seat: Seat, move: BackgammonMove): { board: Board; hit: boolean; from: number; to: number } {
  const next = cloneBoard(board);
  const step = seat === 0 ? 1 : -1;
  let from = -1;
  let to = -1;
  if (move[0] === 'e') {
    to = Number(move.slice(1));
    next.bar[seat]--;
  } else if (move[0] === 'o') {
    from = Number(move.slice(1));
    next.points[from]! -= step;
    next.off[seat]++;
  } else {
    const [a, b] = move.slice(1).split('.');
    from = Number(a);
    to = Number(b);
    next.points[from]! -= step;
  }
  let hit = false;
  if (to >= 0) {
    if (theirs(next.points[to]!, seat)) {
      hit = true;
      next.points[to] = 0;
      next.bar[other(seat)]++;
    }
    next.points[to]! += step;
  }
  return { board: next, hit, from, to };
}

/** The most dice that can still be used, which is what the "use both dice" rule needs. */
function maxUsable(board: Board, seat: Seat, dice: readonly number[]): number {
  if (dice.length === 0) return 0;
  let best = 0;
  const tried = new Set<number>();
  dice.forEach((die, index) => {
    if (tried.has(die)) return;
    tried.add(die);
    const rest = [...dice.slice(0, index), ...dice.slice(index + 1)];
    for (const move of movesWithDie(board, seat, die)) {
      best = Math.max(best, 1 + maxUsable(playMove(board, seat, move).board, seat, rest));
      if (best === dice.length) return;
    }
  });
  return best;
}

export class BackgammonState implements GameState<BackgammonMove> {
  private cached?: BackgammonMove[];

  constructor(
    readonly board: Board,
    readonly seed: number,
    readonly currentSeat: Seat,
    readonly phase: 'roll' | 'move',
    /** Dice still to be used this turn. */
    readonly dice: readonly number[],
    /** Both dice as rolled, for the board to show. */
    readonly rolled: readonly number[],
    readonly rollCount: number,
    readonly result: GameResult | null,
    readonly last: BackgammonEvent | null,
  ) {}

  legalMoves(seat: Seat): readonly BackgammonMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    if (this.phase === 'roll') return [ROLL];
    this.cached ??= this.buildMoves();
    return this.cached;
  }

  private buildMoves(): BackgammonMove[] {
    const best = maxUsable(this.board, this.currentSeat, this.dice);
    if (best === 0) return [PASS];
    const distinct = [...new Set(this.dice)];
    // Only one number can be played: it has to be the higher one.
    if (best === 1 && distinct.length === 2) {
      const higher = Math.max(...distinct);
      const highMoves = movesWithDie(this.board, this.currentSeat, higher);
      if (highMoves.length) return highMoves;
      return movesWithDie(this.board, this.currentSeat, Math.min(...distinct));
    }
    const moves: BackgammonMove[] = [];
    for (const die of distinct) {
      const rest = [...this.dice];
      rest.splice(rest.indexOf(die), 1);
      for (const move of movesWithDie(this.board, this.currentSeat, die)) {
        // Keep only moves that still allow the most dice to be used.
        if (1 + maxUsable(playMove(this.board, this.currentSeat, move).board, this.currentSeat, rest) === best) moves.push(move);
      }
    }
    return [...new Set(moves)];
  }

  apply(move: BackgammonMove): BackgammonState {
    if (this.result) throw new Error('Game is over');
    if (!this.legalMoves(this.currentSeat).includes(move)) throw new Error(`Illegal move: ${move}`);
    const seat = this.currentSeat;
    if (move === ROLL) {
      const a = die(this.seed, this.rollCount);
      const b = die(this.seed, this.rollCount + 1);
      const dice = a === b ? [a, a, a, a] : [a, b];
      return new BackgammonState(this.board, this.seed, seat, 'move', dice, [a, b], this.rollCount + 2, null, { kind: 'roll', seat, dice: [a, b] });
    }
    if (move === PASS) {
      return new BackgammonState(this.board, this.seed, other(seat), 'roll', [], this.rolled, this.rollCount, null, { kind: 'pass', seat });
    }
    const played = playMove(this.board, seat, move);
    const usedDie = move[0] === 'e' ? Math.abs(entryDie(seat, played.to)) : played.to < 0 ? bearOffDie(this.dice, seat, played.from) : Math.abs(played.to - played.from);
    const dice = [...this.dice];
    const at = dice.indexOf(usedDie);
    dice.splice(at < 0 ? 0 : at, 1);
    const event: BackgammonEvent = { kind: 'move', seat, from: move[0] === 'e' ? -1 : played.from, to: move[0] === 'o' ? -1 : played.to, hit: played.hit };
    if (played.board.off[seat] === CHECKERS_PER_SIDE) {
      return new BackgammonState(played.board, this.seed, seat, 'move', [], this.rolled, this.rollCount, { winners: [seat], draw: false }, event);
    }
    const done = dice.length === 0;
    return new BackgammonState(played.board, this.seed, done ? other(seat) : seat, done ? 'roll' : 'move', dice, this.rolled, this.rollCount, null, event);
  }
}

const entryDie = (seat: Seat, to: number) => (seat === 0 ? 24 - to : to + 1);
/** The die a bear-off used: the exact one if it is there, else the smallest that is big enough. */
function bearOffDie(dice: readonly number[], seat: Seat, from: number): number {
  const distance = distanceToOff(seat, from);
  if (dice.includes(distance)) return distance;
  return Math.min(...dice.filter((d) => d > distance));
}

/** The n-th die of a game, fixed by the seed. */
export function die(seed: number, n: number): number {
  return createRng((seed ^ Math.imul(n + 1, 0x7feb352d)) >>> 0).int(6) + 1;
}

export function newBackgammon(seed: number): BackgammonState {
  return new BackgammonState(startingBoard(), seed >>> 0, 0, 'roll', [], [], 0, null, null);
}

// ---- Bots

/** Rolls out of 36 that hit a blot from this distance behind it (direct shots, then combinations). */
const SHOTS = [0, 11, 12, 14, 15, 15, 17, 6, 6, 5, 3, 2, 3, 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 0, 1];

function blotRisk(board: Board, seat: Seat): number {
  let risk = 0;
  board.points.forEach((count, point) => {
    if (!mine(count, seat) || size(count) !== 1) return;
    let worst = 0;
    board.points.forEach((enemy, from) => {
      if (!theirs(enemy, seat)) return;
      // The other player moves the other way, so danger comes from behind the blot.
      const distance = seat === 0 ? from - point : point - from;
      if (distance > 0 && distance < SHOTS.length) worst = Math.max(worst, SHOTS[distance]!);
    });
    if (board.bar[other(seat)] > 0) worst = Math.max(worst, SHOTS[distanceToOff(other(seat), point) > 24 ? 0 : Math.min(24, seat === 0 ? 24 - point : point + 1)] ?? 0);
    risk += worst / 36;
  });
  return risk;
}

function evaluate(board: Board, seat: Seat, sharp: boolean): number {
  const enemy = other(seat);
  let score = (pipCount(board, enemy) - pipCount(board, seat)) * 0.6;
  score += board.off[seat] * 12 - board.off[enemy] * 12;
  score -= board.bar[seat] * 20;
  score += board.bar[enemy] * 16;
  const made = (who: Seat) => board.points.filter((count) => mine(count, who) && size(count) >= 2).length;
  score += (made(seat) - made(enemy)) * 3;
  const home = (who: Seat) => homePoints(who).filter((point) => mine(board.points[point]!, who) && size(board.points[point]!) >= 2).length;
  score += (home(seat) - home(enemy)) * 4;
  if (sharp) score -= blotRisk(board, seat) * 22;
  else score -= board.points.filter((count) => mine(count, seat) && size(count) === 1).length * 4;
  return score;
}

interface BackgammonTier {
  readonly style: 'random' | 'greedy' | 'careful';
  readonly sharp: boolean;
}

const TIERS: Record<BotTier, BackgammonTier> = {
  easy: { style: 'random', sharp: false },
  medium: { style: 'greedy', sharp: false },
  hard: { style: 'careful', sharp: false },
  expert: { style: 'careful', sharp: true },
};

function createBackgammonBot(tier: BackgammonTier): Bot<BackgammonMove> {
  return {
    chooseMove(generic: GameState<BackgammonMove>, seat: Seat, rng: Rng): BackgammonMove {
      const state = generic as BackgammonState;
      const moves = state.legalMoves(seat);
      if (moves.length === 0) throw new Error('No legal moves');
      if (moves.length === 1) return moves[0]!;
      if (tier.style === 'random') return rng.pick(moves);
      const scored = moves.map((move) => {
        const after = playMove(state.board, seat, move);
        let score = evaluate(after.board, seat, tier.sharp);
        if (tier.style === 'greedy' && after.hit) score += 15;
        return { move, score };
      });
      const best = Math.max(...scored.map((s) => s.score));
      return rng.pick(scored.filter((s) => s.score === best).map((s) => s.move));
    },
  };
}

export const backgammon: GameDefinition<BackgammonMove> = {
  id: 'backgammon',
  name: 'Backgammon',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: false,
  realtime: false,
  newGame: (_config, seed) => newBackgammon(seed),
  createBot: (tier) => createBackgammonBot(TIERS[tier]),
  encodeMove: (move) => move,
};
