import { createRng, type Rng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Game of the Goose (docs/games/goose.md): the 63-square race with geese, the Bridge, the Inn, the
 * Well, the Maze, the Prison and Death. The only move is `roll`: the dice come from the seed.
 */
export const GOOSE_HOME = 63;
export const GEESE: readonly number[] = [5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54, 59];
export const GOOSE_BRIDGE = { from: 6, to: 12 };
export const GOOSE_INN = 19;
export const GOOSE_WELL = 31;
export const GOOSE_MAZE = { from: 42, to: 30 };
export const GOOSE_PRISON = 52;
export const GOOSE_DEATH = 58;

export type GooseMove = 'roll';

/** The two dice of the n-th throw of a game. */
export function gooseDice(seed: number, throwIndex: number): [number, number] {
  const rng = createRng((seed ^ Math.imul(throwIndex + 1, 0x9e3779b1)) >>> 0);
  return [rng.int(6) + 1, rng.int(6) + 1];
}

/** One leg of a move, for the scene to play: walking, flying goose to goose, or a jump. */
export interface GooseHop {
  readonly to: number;
  readonly kind: 'walk' | 'back' | 'goose' | 'first' | 'bridge' | 'maze' | 'death';
}

export interface GooseEvent {
  readonly seat: Seat;
  readonly dice: readonly [number, number];
  readonly from: number;
  readonly hops: readonly GooseHop[];
  /** Someone knocked back to where this move started. */
  readonly bumped: { readonly seat: Seat; readonly to: number } | null;
  readonly effect: 'inn' | 'well' | 'prison' | 'home' | null;
  /** Everyone left was held in the Well or the Prison, so all were let out. */
  readonly released: boolean;
}

export class GooseState implements GameState<GooseMove> {
  constructor(
    readonly seed: number,
    readonly positions: readonly number[],
    /** Turns each player still has to miss (the Inn). */
    readonly waits: readonly number[],
    /** Held in the Well or the Prison until someone else arrives. */
    readonly held: readonly boolean[],
    readonly currentSeat: Seat,
    readonly throws: number,
    readonly result: GameResult | null,
    readonly last: GooseEvent | null,
  ) {}

  get players(): number {
    return this.positions.length;
  }

  legalMoves(seat: Seat): readonly GooseMove[] {
    return this.result || seat !== this.currentSeat ? [] : ['roll'];
  }

  apply(move: GooseMove): GooseState {
    if (move !== 'roll' || this.result) throw new Error(`Illegal move: ${String(move)}`);
    const seat = this.currentSeat;
    const dice = gooseDice(this.seed, this.throws);
    const total = dice[0] + dice[1];
    const from = this.positions[seat]!;
    const hops: GooseHop[] = [];
    let at = from;
    const first = from === 0 && this.throws < this.players && this.firstTurn(seat);
    if (first && ((dice[0] === 6 && dice[1] === 3) || (dice[0] === 3 && dice[1] === 6))) hops.push({ to: (at = 26), kind: 'first' });
    else if (first && ((dice[0] === 5 && dice[1] === 4) || (dice[0] === 4 && dice[1] === 5))) hops.push({ to: (at = 53), kind: 'first' });
    else {
      // Walk the total; past home, count back. Landing on a goose goes on by the total the same way.
      let dir = 1;
      let kind: GooseHop['kind'] = 'walk';
      for (let guard = 0; guard < 20; guard++) {
        let target = at + dir * total;
        if (target > GOOSE_HOME) {
          target = GOOSE_HOME - (target - GOOSE_HOME);
          dir = -1;
          hops.push({ to: GOOSE_HOME, kind });
          kind = 'back';
        }
        if (target < 0) target = 0;
        hops.push({ to: target, kind });
        at = target;
        if (!GEESE.includes(at)) break;
        kind = 'goose';
      }
      if (at === GOOSE_BRIDGE.from) hops.push({ to: (at = GOOSE_BRIDGE.to), kind: 'bridge' });
      else if (at === GOOSE_MAZE.from) hops.push({ to: (at = GOOSE_MAZE.to), kind: 'maze' });
      else if (at === GOOSE_DEATH) hops.push({ to: (at = 0), kind: 'death' });
    }
    const positions = [...this.positions];
    const waits = [...this.waits];
    const held = [...this.held];
    positions[seat] = at;
    // Knocked back: whoever stood there goes to where this move began, and is free again.
    let bumped: GooseEvent['bumped'] = null;
    const other = positions.findIndex((p, i) => i !== seat && p === at && at !== 0 && at !== GOOSE_HOME);
    if (other >= 0) {
      positions[other] = from;
      held[other] = false;
      bumped = { seat: other as Seat, to: from };
    }
    let effect: GooseEvent['effect'] = null;
    if (at === GOOSE_HOME) effect = 'home';
    else if (at === GOOSE_INN) (effect = 'inn'), (waits[seat] = 1);
    else if (at === GOOSE_WELL || at === GOOSE_PRISON) (effect = at === GOOSE_WELL ? 'well' : 'prison'), (held[seat] = true);
    const done = at === GOOSE_HOME ? { winners: [seat], draw: false } : null;
    const base = { seat, dice, from, hops, bumped, effect };
    if (done) return new GooseState(this.seed, positions, waits, held, seat, this.throws + 1, done, { ...base, released: false });
    // The next player who is not missing a turn or held; a missed turn is used up by being passed.
    let next = seat;
    let released = false;
    for (let step = 0; ; step++) {
      next = ((next + 1) % this.players) as Seat;
      if (step > this.players * 3) {
        // Everyone is held: let them all out rather than stall.
        held.fill(false);
        released = true;
        next = ((seat + 1) % this.players) as Seat;
        waits[next] = 0;
        break;
      }
      if (waits[next]! > 0) {
        waits[next]!--;
        continue;
      }
      if (held[next]) continue;
      break;
    }
    return new GooseState(this.seed, positions, waits, held, next, this.throws + 1, null, { ...base, released });
  }

  /** Whether this is the player's first throw of the game (they have never moved). */
  private firstTurn(seat: Seat): boolean {
    return this.throws === seat;
  }
}

export function newGoose(players: number, seed: number): GooseState {
  const n = Math.max(2, Math.min(4, players));
  return new GooseState(seed >>> 0, Array(n).fill(0), Array(n).fill(0), Array(n).fill(false), 0, 0, null, null);
}

/** Nothing to choose: a bot just throws. Every tier plays the same. */
function createGooseBot(): Bot<GooseMove> {
  return { chooseMove: (_state: GameState<GooseMove>, _seat: Seat, _rng: Rng) => 'roll' };
}

export const goose: GameDefinition<GooseMove> = {
  id: 'goose',
  name: 'Game of the Goose',
  minPlayers: 2,
  maxPlayers: 4,
  modes: ['bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: false,
  realtime: false,
  newGame: (config, seed) => newGoose(config.players, seed),
  createBot: () => createGooseBot(),
  encodeMove: (move) => move,
};
