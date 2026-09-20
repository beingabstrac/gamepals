import { createRng, type Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Target Number (docs/games/target-number.md). Six numbers, four operations, reach the target.
 *
 * Moves: `c<i><op><j>` combines the numbers at those two places, `-` takes the last step back.
 */
export type TargetMove = string;
export type Op = '+' | '-' | '*' | '/';
export const OPS: readonly Op[] = ['+', '-', '*', '/'];
export const combine = (i: number, op: Op, j: number): TargetMove => `c${i}${op}${j}`;
export const STEP_BACK: TargetMove = '-';

export const SMALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const LARGE = [25, 50, 75, 100];
export const COUNT = 6;
export const TARGET_LOW = 101;
export const TARGET_HIGH = 999;

export interface Step {
  readonly a: number;
  readonly op: Op;
  readonly b: number;
  readonly out: number;
}

/** What two numbers make with one operation, or 0 when the rules do not allow it. */
export function applyOp(a: number, b: number, op: Op): number {
  if (op === '+') return a + b;
  if (op === '*') return a * b;
  if (op === '-') return a > b ? a - b : 0;
  return b !== 0 && a % b === 0 ? a / b : 0;
}

/**
 * The closest any working can get, and whether the target can be hit exactly. Used to lay a
 * puzzle that is really solvable and by the bots. Every arrangement of the pool is walked once.
 */
export function solve(pool: readonly number[], target: number): { exact: boolean; closest: number } {
  const seen = new Set<string>();
  let closest = pool[0] ?? 0;
  let exact = false;

  const walk = (numbers: readonly number[]): boolean => {
    const key = [...numbers].sort((x, y) => x - y).join(',');
    if (seen.has(key)) return false;
    seen.add(key);
    for (const value of numbers) {
      if (Math.abs(value - target) < Math.abs(closest - target)) closest = value;
      if (value === target) {
        exact = true;
        return true;
      }
    }
    for (let i = 0; i < numbers.length; i++) {
      for (let j = 0; j < numbers.length; j++) {
        if (i === j) continue;
        const rest = numbers.filter((_, at) => at !== i && at !== j);
        for (const op of OPS) {
          // Adding and multiplying are the same either way round, so only do them once.
          if ((op === '+' || op === '*') && i > j) continue;
          const out = applyOp(numbers[i]!, numbers[j]!, op);
          if (out > 0 && walk([...rest, out])) return true;
        }
      }
    }
    return false;
  };

  walk(pool);
  return { exact, closest };
}

export class TargetState implements GameState<TargetMove> {
  constructor(
    readonly target: number,
    /** The numbers drawn, never changing, for showing what the round started with. */
    readonly drawn: readonly number[],
    /** What is on the table now: what is left of the draw plus every result made so far. */
    readonly pool: readonly number[],
    readonly steps: readonly Step[],
    /** The nearest anything has come to the target so far. */
    readonly closest: number,
    readonly currentSeat: Seat,
    readonly moves: number,
    readonly result: GameResult | null,
  ) {}

  get away(): number {
    return Math.abs(this.closest - this.target);
  }

  legalMoves(seat: Seat): readonly TargetMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    const moves: TargetMove[] = [];
    for (let i = 0; i < this.pool.length; i++) {
      for (let j = 0; j < this.pool.length; j++) {
        if (i === j) continue;
        for (const op of OPS) {
          if ((op === '+' || op === '*') && i > j) continue;
          if (applyOp(this.pool[i]!, this.pool[j]!, op) > 0) moves.push(combine(i, op, j));
        }
      }
    }
    return this.steps.length ? [...moves, STEP_BACK] : moves;
  }

  apply(move: TargetMove): TargetState {
    if (this.result) throw new Error('Game is over');
    if (move === STEP_BACK) {
      if (!this.steps.length) throw new Error(`Illegal move: ${move}`);
      const steps = this.steps.slice(0, -1);
      // Rebuild rather than unpick: the working is short and this cannot drift.
      return steps.reduce(
        (state, step) => state.apply(combine(state.pool.indexOf(step.a), step.op, state.pool.indexOf(step.b))),
        new TargetState(this.target, this.drawn, this.drawn, [], nearest(this.drawn, this.target), 0, 0, null),
      ).withMoves(this.moves + 1);
    }
    const parsed = /^c(\d+)([-+*/])(\d+)$/.exec(move);
    if (!parsed) throw new Error(`Illegal move: ${move}`);
    const i = Number(parsed[1]);
    const j = Number(parsed[3]);
    const op = parsed[2] as Op;
    const a = this.pool[i];
    const b = this.pool[j];
    if (a === undefined || b === undefined || i === j) throw new Error(`Illegal move: ${move}`);
    const out = applyOp(a, b, op);
    if (out <= 0) throw new Error(`Illegal move: ${move}`);
    const pool = [...this.pool.filter((_, at) => at !== i && at !== j), out];
    const steps = [...this.steps, { a, op, b, out }];
    const closest = Math.abs(out - this.target) < Math.abs(this.closest - this.target) ? out : this.closest;
    const hit = out === this.target;
    // One number left and it is not the target: there is nothing else to try.
    const stuck = pool.length === 1 && !hit;
    const result: GameResult | null = hit ? { winners: [0], draw: false } : stuck ? { winners: [], draw: false } : null;
    return new TargetState(this.target, this.drawn, pool, steps, closest, 0, this.moves + 1, result);
  }

  /** Same state, a different move count, for a take-back that rebuilt from the start. */
  private withMoves(moves: number): TargetState {
    return new TargetState(this.target, this.drawn, this.pool, this.steps, this.closest, 0, moves, this.result);
  }
}

const nearest = (numbers: readonly number[], target: number): number =>
  numbers.reduce((best, value) => (Math.abs(value - target) < Math.abs(best - target) ? value : best), numbers[0] ?? 0);

export function newTargetNumber(seed: number): TargetState {
  const rng = createRng(seed >>> 0);
  // Draw, check it can really be done, draw again if not. Rare: 55 of 60 random draws are exact.
  for (let attempt = 0; attempt < 60; attempt++) {
    const bigs = rng.int(LARGE.length + 1);
    const large = shuffled(LARGE, rng).slice(0, bigs);
    const small = shuffled([...SMALL, ...SMALL], rng).slice(0, COUNT - bigs);
    const drawn = shuffled([...large, ...small], rng);
    const target = TARGET_LOW + rng.int(TARGET_HIGH - TARGET_LOW + 1);
    if (!solve(drawn, target).exact) continue;
    return new TargetState(target, drawn, drawn, [], nearest(drawn, target), 0, 0, null);
  }
  throw new Error('Could not lay a target number round');
}

function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** What a seat may know. Nothing is held back: the numbers and the target are the whole game. */
export interface TargetView {
  readonly pool: readonly number[];
  readonly target: number;
}

export const targetViewFor = (state: TargetState): TargetView => ({ pool: state.pool, target: state.target });

/**
 * A solo puzzle has no opponent to be fair to, so the bot is an autoplayer. The good ones take a
 * step that still leads to the target; the rest take whatever gets nearer.
 */
function createTargetBot(solves: boolean): Bot<TargetMove> {
  return {
    chooseMove(generic: GameState<TargetMove>, _seat: Seat, rng: Rng): TargetMove {
      const state = generic as TargetState;
      const moves = state.legalMoves(0).filter((move) => move !== STEP_BACK);
      if (!moves.length) throw new Error('No legal moves');
      if (solves) {
        for (const move of moves) {
          const after = state.apply(move);
          if (after.result?.winners.length || solve(after.pool, state.target).exact) return move;
        }
      }
      // Nearest result wins, which is how somebody plays who is not working it out properly.
      let best = moves[0]!;
      let bestAway = Infinity;
      for (const move of moves) {
        const after = state.apply(move);
        const away = Math.abs(after.pool[after.pool.length - 1]! - state.target);
        if (away < bestAway) {
          bestAway = away;
          best = move;
        }
      }
      return solves ? best : rng.pick(moves.slice(0, Math.max(1, Math.ceil(moves.length / 2))));
    },
  };
}

const TIERS: Record<BotTier, boolean> = { easy: false, medium: false, hard: true, expert: true };

export const targetNumberGame: GameDefinition<TargetMove> = {
  id: 'target-number',
  name: 'Target Number',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo'],
  hiddenInfo: false,
  realtime: false,
  newGame: (_config, seed) => newTargetNumber(seed),
  createBot: (tier) => createTargetBot(TIERS[tier]),
  encodeMove: (move) => move,
};
