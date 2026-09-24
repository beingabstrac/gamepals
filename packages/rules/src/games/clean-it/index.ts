import { createRng, type Rng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Clean It (docs/games/clean-it.md), a chill toy: something grubby (a window, an old coin, a rug)
 * under blotches of dirt up to three coats thick. Rub it clean: every wipe takes one coat off the
 * spot under your finger and the spots beside it. When the last speck goes, it sparkles.
 */
export const CLEAN_COLS = 12;
export const CLEAN_ROWS = 16;
export const CLEAN_COATS = 3;
export type CleanThing = 'window' | 'coin' | 'rug';
export const CLEAN_THINGS: readonly CleanThing[] = ['window', 'coin', 'rug'];

/** `w<cell>` wipes there. */
export type CleanMove = string;

/** The spot under the finger and the four beside it: what one wipe reaches. */
export function wipeReach(cell: number): number[] {
  const x = cell % CLEAN_COLS;
  const y = Math.floor(cell / CLEAN_COLS);
  const out = [cell];
  if (x > 0) out.push(cell - 1);
  if (x < CLEAN_COLS - 1) out.push(cell + 1);
  if (y > 0) out.push(cell - CLEAN_COLS);
  if (y < CLEAN_ROWS - 1) out.push(cell + CLEAN_COLS);
  return out;
}

export class CleanState implements GameState<CleanMove> {
  readonly currentSeat: Seat = 0;

  constructor(
    readonly thing: CleanThing,
    /** Coats of dirt on each spot, 0 to 3. */
    readonly dirt: readonly number[],
    readonly wipes: number,
    readonly total: number,
    readonly result: GameResult | null,
  ) {}

  /** How clean it is, 0 to 100. */
  get clean(): number {
    const left = this.dirt.reduce((a, b) => a + b, 0);
    return Math.floor(((this.total - left) / this.total) * 100);
  }

  legalMoves(seat: Seat): readonly CleanMove[] {
    if (this.result || seat !== 0) return [];
    // A wipe anywhere near dirt; a wipe over a clean patch does nothing, so it is not a move.
    const out: CleanMove[] = [];
    for (let i = 0; i < this.dirt.length; i++) if (wipeReach(i).some((c) => this.dirt[c]! > 0)) out.push(`w${i}`);
    return out;
  }

  apply(move: CleanMove): CleanState {
    const i = Number(move.slice(1));
    if (!/^w\d+$/.test(move) || !this.legalMoves(0).includes(move)) throw new Error(`Illegal move: ${move}`);
    const dirt = this.dirt.slice();
    for (const c of wipeReach(i)) dirt[c] = Math.max(0, dirt[c]! - 1);
    const done = dirt.every((d) => d === 0);
    return new CleanState(this.thing, dirt, this.wipes + 1, this.total, done ? { winners: [0], draw: false } : null);
  }
}

/** Blotches of dirt: a few round smears, thicker in the middle, laid over each other. */
export function newCleanIt(seed: number, thing: CleanThing = 'window'): CleanState {
  const rng = createRng(seed >>> 0);
  const dirt = Array<number>(CLEAN_COLS * CLEAN_ROWS).fill(0);
  const blotches = 7 + rng.int(4);
  for (let b = 0; b < blotches; b++) {
    const cx = rng.next() * CLEAN_COLS;
    const cy = rng.next() * CLEAN_ROWS;
    const r = 2 + rng.next() * 3.5;
    for (let i = 0; i < dirt.length; i++) {
      const d = Math.hypot((i % CLEAN_COLS) + 0.5 - cx, Math.floor(i / CLEAN_COLS) + 0.5 - cy);
      if (d < r) dirt[i] = Math.min(CLEAN_COATS, dirt[i]! + (d < r * 0.45 ? 2 : 1));
    }
  }
  // Never a clean start: a smudge in the middle at least.
  if (dirt.every((d) => d === 0)) dirt[Math.floor(dirt.length / 2)] = 1;
  const total = dirt.reduce((a, c) => a + c, 0);
  return new CleanState(thing, dirt, 0, total, null);
}

/** Test play: wipe wherever the most dirt is in reach. */
function createCleanBot(): Bot<CleanMove> {
  return {
    chooseMove(generic: GameState<CleanMove>, _seat: Seat, _rng: Rng): CleanMove {
      const s = generic as CleanState;
      let best = '';
      let most = -1;
      for (const m of s.legalMoves(0)) {
        const here = wipeReach(Number(m.slice(1))).reduce((a, c) => a + (s.dirt[c]! > 0 ? 1 : 0), 0);
        if (here > most) (most = here), (best = m);
      }
      return best;
    },
  };
}

export const cleanIt: GameDefinition<CleanMove> = {
  id: 'clean-it',
  name: 'Clean It',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo'],
  hiddenInfo: false,
  realtime: false,
  newGame: (config, seed) => newCleanIt(seed, (config.variant as CleanThing | undefined) ?? 'window'),
  createBot: () => createCleanBot(),
  encodeMove: (move) => move,
};
