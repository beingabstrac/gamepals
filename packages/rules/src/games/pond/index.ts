import { createRng, type Rng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Pond (docs/games/pond.md), a chill toy: tap the water for ripples, hold to feed the koi, and open
 * every lotus bud. The fish and the ripples are the scene's; the rules keep the pads, which have
 * opened and how often food went in, and know when the pond is in bloom.
 */
export const POND = { w: 560, h: 620 };
export const POND_PADS = 5;
export const POND_PAD_R = 44;

export interface Pad {
  readonly x: number;
  readonly y: number;
}

/** `b3` opens the bud on pad 3; `f` scatters food. */
export type PondMove = string;

export class PondState implements GameState<PondMove> {
  readonly currentSeat: Seat = 0;

  constructor(
    readonly pads: readonly Pad[],
    readonly open: readonly boolean[],
    readonly feeds: number,
    readonly last: PondMove | null,
    readonly result: GameResult | null,
  ) {}

  legalMoves(seat: Seat): readonly PondMove[] {
    if (this.result || seat !== 0) return [];
    return [...this.pads.flatMap((_, i) => (this.open[i] ? [] : [`b${i}`])), 'f'];
  }

  apply(move: PondMove): PondState {
    if (!this.legalMoves(0).includes(move)) throw new Error(`Illegal move: ${move}`);
    if (move === 'f') return new PondState(this.pads, this.open, this.feeds + 1, move, null);
    const i = Number(move.slice(1));
    const open = this.open.map((o, k) => o || k === i);
    return new PondState(this.pads, open, this.feeds, move, open.every(Boolean) ? { winners: [0], draw: false } : null);
  }
}

/** Is (x, y) in the pond? The pond is an ellipse filling the space, a little inset. */
export function inPond(x: number, y: number, margin = 0): boolean {
  const rx = POND.w / 2 - margin;
  const ry = POND.h / 2 - margin;
  const dx = (x - POND.w / 2) / rx;
  const dy = (y - POND.h / 2) / ry;
  return dx * dx + dy * dy <= 1;
}

/** Five pads laid from the seed: inside the pond with room round them, and well apart. */
export function newPond(seed: number): PondState {
  const rng = createRng(seed >>> 0);
  const pads: Pad[] = [];
  for (let tries = 0; pads.length < POND_PADS && tries < 5000; tries++) {
    const x = Math.round(POND_PAD_R + rng.next() * (POND.w - 2 * POND_PAD_R));
    const y = Math.round(POND_PAD_R + rng.next() * (POND.h - 2 * POND_PAD_R));
    if (!inPond(x, y, POND_PAD_R + 16)) continue;
    if (pads.some((p) => Math.hypot(p.x - x, p.y - y) < POND_PAD_R * 2.6)) continue;
    pads.push({ x, y });
  }
  return new PondState(pads, pads.map(() => false), 0, null, null);
}

/** Test play: a little food now and then, and a bud opened between. */
function createPondBot(): Bot<PondMove> {
  return {
    chooseMove(generic: GameState<PondMove>, _seat: Seat, _rng: Rng): PondMove {
      const s = generic as PondState;
      if (s.feeds <= s.open.filter(Boolean).length) return 'f';
      return `b${s.open.findIndex((o) => !o)}`;
    },
  };
}

export const pond: GameDefinition<PondMove> = {
  id: 'pond',
  name: 'Pond',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo'],
  hiddenInfo: false,
  realtime: false,
  newGame: (_config, seed) => newPond(seed),
  createBot: () => createPondBot(),
  encodeMove: (move) => move,
};
