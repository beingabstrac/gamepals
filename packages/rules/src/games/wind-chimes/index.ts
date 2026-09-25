import type { Rng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Wind Chimes (docs/games/wind-chimes.md), a chill toy: bamboo tubes swing on their strings and
 * knock together. The swinging is the scene's; the rules only keep which tubes have rung, and when
 * every one has, that is the toy done. Ringing a tube again is not a move, just music.
 */
export const CHIMES = 7;

/** `r3` rings tube 3 for the first time. */
export type ChimeMove = string;

export class ChimeState implements GameState<ChimeMove> {
  readonly currentSeat: Seat = 0;

  constructor(
    readonly rung: readonly boolean[],
    readonly last: number | null,
    readonly result: GameResult | null,
  ) {}

  legalMoves(seat: Seat): readonly ChimeMove[] {
    if (this.result || seat !== 0) return [];
    return this.rung.flatMap((r, i) => (r ? [] : [`r${i}`]));
  }

  apply(move: ChimeMove): ChimeState {
    if (!this.legalMoves(0).includes(move)) throw new Error(`Illegal move: ${move}`);
    const i = Number(move.slice(1));
    const rung = this.rung.map((r, k) => r || k === i);
    return new ChimeState(rung, i, rung.every(Boolean) ? { winners: [0], draw: false } : null);
  }
}

export const newChimes = () => new ChimeState(Array<boolean>(CHIMES).fill(false), null, null);

/** Test play: rings them from the middle outwards, like a hand brushing across. */
function createChimeBot(): Bot<ChimeMove> {
  const order = [3, 2, 4, 1, 5, 0, 6];
  return {
    chooseMove(generic: GameState<ChimeMove>, _seat: Seat, _rng: Rng): ChimeMove {
      const s = generic as ChimeState;
      return `r${order.find((i) => !s.rung[i])}`;
    },
  };
}

export const windChimes: GameDefinition<ChimeMove> = {
  id: 'wind-chimes',
  name: 'Wind Chimes',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo'],
  hiddenInfo: false,
  realtime: false,
  newGame: () => newChimes(),
  createBot: () => createChimeBot(),
  encodeMove: (move) => move,
};
