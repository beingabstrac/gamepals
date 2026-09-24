import type { Rng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Newton's Cradle (docs/games/newtons-cradle.md), a chill toy: five steel balls in a row on
 * strings. Pull one or more out to the side and let go, and as many fly out the other side, click,
 * click, until they settle. The swinging is the scene's; the rules count the swings and the moment
 * you are done.
 */
export const CRADLE_BALLS = 5;

/** `l<n>` or `r<n>`: let go of n balls pulled out on the left or the right; `done` puts it down. */
export type CradleMove = string;

export class CradleState implements GameState<CradleMove> {
  readonly currentSeat: Seat = 0;

  constructor(
    readonly swings: number,
    readonly last: { side: 'l' | 'r'; n: number } | null,
    readonly result: GameResult | null,
  ) {}

  legalMoves(seat: Seat): readonly CradleMove[] {
    if (this.result || seat !== 0) return [];
    const moves: CradleMove[] = [];
    for (let n = 1; n < CRADLE_BALLS; n++) moves.push(`l${n}`, `r${n}`);
    moves.push('done');
    return moves;
  }

  apply(move: CradleMove): CradleState {
    if (!this.legalMoves(0).includes(move)) throw new Error(`Illegal move: ${move}`);
    if (move === 'done') return new CradleState(this.swings, this.last, { winners: [0], draw: false });
    return new CradleState(this.swings + 1, { side: move[0] as 'l' | 'r', n: Number(move.slice(1)) }, null);
  }
}

export function newCradle(): CradleState {
  return new CradleState(0, null, null);
}

/** Test play: one ball, then two from the other side, then put it down. */
function createCradleBot(): Bot<CradleMove> {
  return {
    chooseMove(generic: GameState<CradleMove>, _seat: Seat, _rng: Rng): CradleMove {
      const s = generic as CradleState;
      return s.swings === 0 ? 'l1' : s.swings === 1 ? 'r2' : 'done';
    },
  };
}

export const newtonsCradle: GameDefinition<CradleMove> = {
  id: 'newtons-cradle',
  name: "Newton's Cradle",
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo'],
  hiddenInfo: false,
  realtime: false,
  newGame: () => newCradle(),
  createBot: () => createCradleBot(),
  encodeMove: (move) => move,
};
