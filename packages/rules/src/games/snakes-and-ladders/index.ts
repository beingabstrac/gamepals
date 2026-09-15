import { createRng, type Rng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Snakes & Ladders (docs/games/snakes-and-ladders.md). Squares 1–100, tokens start off the board on 0.
 * The only move is `roll`: the die is fixed by the seed, so there are no choices and games replay exactly.
 */
export type SnakesLevel = 'classic' | 'quick';
export type SnakesMove = 'roll';
export const SNAKES_GOAL = 100;

/** Our one fixed board: ladder foot → top. */
export const LADDERS: Readonly<Record<number, number>> = { 4: 25, 9: 31, 20: 41, 28: 84, 40: 59, 51: 67, 63: 81, 71: 91 };
/** Snake head → tail. */
export const SNAKES: Readonly<Record<number, number>> = { 17: 7, 54: 34, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 79 };

/** Die value for the n-th roll of a game. */
export function snakesDie(seed: number, rollIndex: number): number {
  return createRng((seed ^ Math.imul(rollIndex + 1, 0x85ebca6b)) >>> 0).int(6) + 1;
}

export interface SnakesEvent {
  readonly seat: Seat;
  readonly roll: number;
  readonly from: number;
  /** Every square hopped through, in order (a bounce-back hops forward to 100 then back). */
  readonly path: readonly number[];
  /** A ladder or snake at the landing square, and where it took the token. */
  readonly jump: { readonly kind: 'ladder' | 'snake'; readonly to: number } | null;
  readonly bounced: boolean;
  /** A 6 gives another roll. */
  readonly again: boolean;
  /** A third 6 in a row ends the turn without moving. */
  readonly lostTurn: boolean;
}

export class SnakesState implements GameState<SnakesMove> {
  constructor(
    readonly level: SnakesLevel,
    readonly seed: number,
    readonly positions: readonly number[],
    readonly currentSeat: Seat,
    readonly rollCount: number,
    /** Sixes rolled in a row this turn. */
    readonly sixes: number,
    readonly result: GameResult | null,
    readonly last: SnakesEvent | null,
  ) {}

  get players(): number {
    return this.positions.length;
  }

  legalMoves(seat: Seat): readonly SnakesMove[] {
    return this.result || seat !== this.currentSeat ? [] : ['roll'];
  }

  apply(move: SnakesMove): SnakesState {
    if (this.result) throw new Error('Game is over');
    if (move !== 'roll') throw new Error(`Illegal move: ${String(move)}`);
    const seat = this.currentSeat;
    const roll = snakesDie(this.seed, this.rollCount);
    const from = this.positions[seat]!;
    const next = (seat + 1) % this.players;
    const sixes = roll === 6 ? this.sixes + 1 : 0;

    if (sixes === 3) {
      const event: SnakesEvent = { seat, roll, from, path: [], jump: null, bounced: false, again: false, lostTurn: true };
      return new SnakesState(this.level, this.seed, this.positions, next, this.rollCount + 1, 0, null, event);
    }

    const path: number[] = [];
    let at = from;
    let forward = true;
    for (let step = 0; step < roll; step++) {
      if (at === SNAKES_GOAL) {
        if (this.level === 'quick') break;
        forward = false;
      }
      at += forward ? 1 : -1;
      path.push(at);
    }
    const bounced = !forward;
    let jump: SnakesEvent['jump'] = null;
    if (LADDERS[at] !== undefined) jump = { kind: 'ladder', to: LADDERS[at]! };
    else if (SNAKES[at] !== undefined) jump = { kind: 'snake', to: SNAKES[at]! };
    const landed = jump ? jump.to : at;

    const positions = this.positions.slice();
    positions[seat] = landed;
    if (landed === SNAKES_GOAL) {
      const event: SnakesEvent = { seat, roll, from, path, jump, bounced, again: false, lostTurn: false };
      return new SnakesState(this.level, this.seed, positions, seat, this.rollCount + 1, 0, { winners: [seat], draw: false }, event);
    }
    const again = roll === 6;
    const event: SnakesEvent = { seat, roll, from, path, jump, bounced, again, lostTurn: false };
    return new SnakesState(this.level, this.seed, positions, again ? seat : next, this.rollCount + 1, again ? sixes : 0, null, event);
  }
}

export function newSnakes(players: number, seed: number, level: SnakesLevel = 'classic'): SnakesState {
  if (players < 2 || players > 4) throw new Error(`Snakes & Ladders needs 2–4 players, got ${players}`);
  return new SnakesState(level, seed >>> 0, Array<number>(players).fill(0), 0, 0, 0, null, null);
}

/** There are no choices in this game, so every bot tier just rolls. */
const rollingBot: Bot<SnakesMove> = {
  chooseMove(state: GameState<SnakesMove>, seat: Seat, _rng: Rng): SnakesMove {
    if (state.legalMoves(seat).length === 0) throw new Error('No legal moves');
    return 'roll';
  },
};

export const snakesAndLadders: GameDefinition<SnakesMove> = {
  id: 'snakes-and-ladders',
  name: 'Snakes & Ladders',
  minPlayers: 2,
  maxPlayers: 4,
  modes: ['bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: false,
  realtime: false,
  newGame: (config, seed) => newSnakes(config.players, seed, config.variant === 'quick' ? 'quick' : 'classic'),
  createBot: () => rollingBot,
  encodeMove: (move) => move,
};
