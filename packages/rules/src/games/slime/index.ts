import type { Rng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Slime (docs/games/slime.md), a chill toy: pick a color, mix things in, then poke and stretch it.
 * The squishing is the scene's soft body; the rules keep the color, the mix-ins and how often it was
 * poked, and it is done when you say.
 */
export const SLIME_COLORS = 7;
/** Glitter, beads, foam and stars. */
export const SLIME_MIXINS = 4;

/** `c2` colors it; `m1` mixes in beads; `p` is a poke or a stretch; `done` finishes. */
export type SlimeMove = string;

export class SlimeState implements GameState<SlimeMove> {
  readonly currentSeat: Seat = 0;

  constructor(
    readonly color: number,
    readonly mixins: readonly boolean[],
    readonly pokes: number,
    readonly last: SlimeMove | null,
    readonly result: GameResult | null,
  ) {}

  legalMoves(seat: Seat): readonly SlimeMove[] {
    if (this.result || seat !== 0) return [];
    return [
      ...Array.from({ length: SLIME_COLORS }, (_, i) => i).flatMap((i) => (i === this.color ? [] : [`c${i}`])),
      ...this.mixins.flatMap((m, i) => (m ? [] : [`m${i}`])),
      'p',
      'done',
    ];
  }

  apply(move: SlimeMove): SlimeState {
    if (!this.legalMoves(0).includes(move)) throw new Error(`Illegal move: ${move}`);
    if (move === 'done') return new SlimeState(this.color, this.mixins, this.pokes, move, { winners: [0], draw: false });
    if (move === 'p') return new SlimeState(this.color, this.mixins, this.pokes + 1, move, null);
    const i = Number(move.slice(1));
    if (move[0] === 'c') return new SlimeState(i, this.mixins, this.pokes, move, null);
    return new SlimeState(this.color, this.mixins.map((m, k) => m || k === i), this.pokes, move, null);
  }
}

/** A fresh slime is mint, with nothing mixed in. */
export const newSlime = () => new SlimeState(3, Array<boolean>(SLIME_MIXINS).fill(false), 0, null, null);

/** Test play: a new color, every mix-in, a dozen pokes, done. */
function createSlimeBot(): Bot<SlimeMove> {
  return {
    chooseMove(generic: GameState<SlimeMove>, _seat: Seat, _rng: Rng): SlimeMove {
      const s = generic as SlimeState;
      if (s.color === 3) return 'c6';
      const next = s.mixins.findIndex((m) => !m);
      if (next >= 0) return `m${next}`;
      return s.pokes < 12 ? 'p' : 'done';
    },
  };
}

export const slime: GameDefinition<SlimeMove> = {
  id: 'slime',
  name: 'Slime',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo'],
  hiddenInfo: false,
  realtime: false,
  newGame: () => newSlime(),
  createBot: () => createSlimeBot(),
  encodeMove: (move) => move,
};
