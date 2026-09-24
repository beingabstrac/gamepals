import { createRng, type Rng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Number Match (docs/games/number-match.md), the pencil game also called Take Ten or Numberama:
 * rows of digits nine wide. Cross out two numbers that are the same or add up to ten, when nothing
 * but crossed-out numbers lies between them across, down, on a diagonal, or reading on from the
 * end of one row to the start of the next. A row with nothing left vanishes. Stuck, and you may
 * copy every number still standing onto the end. Clear them all to win.
 */
export const NM_WIDTH = 9;
export const NM_START = 36;
export const NM_ADDS = 5;

/** `p<a>-<b>` crosses out the pair at those places; `add` copies what is left onto the end. */
export type NumberMove = string;

export class NumberState implements GameState<NumberMove> {
  readonly currentSeat: Seat = 0;

  constructor(
    /** Each number in reading order, and whether it is crossed out. */
    readonly values: readonly number[],
    readonly gone: readonly boolean[],
    readonly adds: number,
    readonly score: number,
    readonly last: { pair: readonly [number, number] | null; rows: number } | null,
    readonly result: GameResult | null,
  ) {}

  /** Whether a and b (a < b) can be crossed out together. */
  canPair(a: number, b: number): boolean {
    if (a === b || this.gone[a] || this.gone[b]) return false;
    const va = this.values[a]!;
    const vb = this.values[b]!;
    if (va !== vb && va + vb !== 10) return false;
    const [lo, hi] = a < b ? [a, b] : [b, a];
    // Reading on: everything between them in reading order is crossed out.
    let clear = true;
    for (let i = lo + 1; i < hi; i++) if (!this.gone[i]) clear = false;
    if (clear) return true;
    const ax = lo % NM_WIDTH;
    const ay = Math.floor(lo / NM_WIDTH);
    const bx = hi % NM_WIDTH;
    const by = Math.floor(hi / NM_WIDTH);
    const dx = Math.sign(bx - ax);
    const dy = Math.sign(by - ay);
    // Down a column, or along a diagonal: the same number of steps across as down.
    if (!(bx === ax || Math.abs(bx - ax) === by - ay) || by === ay) return false;
    for (let x = ax + dx, y = ay + dy; y < by; x += dx, y += dy) if (!this.gone[y * NM_WIDTH + x]) return false;
    return true;
  }

  pairs(): [number, number][] {
    const out: [number, number][] = [];
    for (let a = 0; a < this.values.length; a++) {
      if (this.gone[a]) continue;
      for (let b = a + 1; b < this.values.length; b++) if (this.canPair(a, b)) out.push([a, b]);
    }
    return out;
  }

  legalMoves(seat: Seat): readonly NumberMove[] {
    if (this.result || seat !== 0) return [];
    const moves = this.pairs().map(([a, b]) => `p${a}-${b}`);
    if (this.adds > 0) moves.push('add');
    return moves;
  }

  apply(move: NumberMove): NumberState {
    if (!this.legalMoves(0).includes(move)) throw new Error(`Illegal move: ${move}`);
    if (move === 'add') {
      const standing = this.values.filter((_, i) => !this.gone[i]);
      const values = [...this.values, ...standing];
      const gone = [...this.gone, ...standing.map(() => false)];
      return settle(values, gone, this.adds - 1, this.score, { pair: null, rows: 0 });
    }
    const [a, b] = move.slice(1).split('-').map(Number) as [number, number];
    const gone = this.gone.slice();
    gone[a] = true;
    gone[b] = true;
    return settle(this.values.slice(), gone, this.adds, this.score + 1, { pair: [a, b], rows: 0 });
  }
}

/** Takes out every row with nothing left in it, and ends the game if it is won or stuck. */
function settle(values: number[], gone: boolean[], adds: number, score: number, last: NumberState['last']): NumberState {
  const keepV: number[] = [];
  const keepG: boolean[] = [];
  let rows = 0;
  for (let start = 0; start < values.length; start += NM_WIDTH) {
    const end = Math.min(values.length, start + NM_WIDTH);
    // Only whole rows vanish: the last, unfinished row stays even when it is all crossed out.
    const whole = end - start === NM_WIDTH;
    if (whole && gone.slice(start, end).every(Boolean)) {
      rows++;
      continue;
    }
    keepV.push(...values.slice(start, end));
    keepG.push(...gone.slice(start, end));
  }
  const nextScore = score + rows * 10;
  const lastMove = last ? { pair: rows ? null : last.pair, rows } : null;
  const state = new NumberState(keepV, keepG, adds, nextScore, lastMove, null);
  if (keepG.every(Boolean)) return new NumberState(keepV, keepG, adds, nextScore, lastMove, { winners: [0], draw: false });
  if (state.legalMoves(0).length === 0) return new NumberState(keepV, keepG, adds, nextScore, lastMove, { winners: [], draw: false });
  return state;
}

export function newNumberMatch(seed: number): NumberState {
  const rng = createRng(seed);
  const values = Array.from({ length: NM_START }, () => 1 + rng.int(9));
  return new NumberState(values, values.map(() => false), NM_ADDS, 0, null, null);
}

/** Test play: cross out the pair nearest the top, and add when there is none. */
function createNumberBot(): Bot<NumberMove> {
  return {
    chooseMove(generic: GameState<NumberMove>, _seat: Seat, rng: Rng): NumberMove {
      const moves = (generic as NumberState).legalMoves(0).filter((m) => m !== 'add');
      return moves.length ? moves[Math.min(moves.length - 1, rng.int(2))]! : 'add';
    },
  };
}

export const numberMatch: GameDefinition<NumberMove> = {
  id: 'number-match',
  name: 'Number Match',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo', 'race'],
  hiddenInfo: false,
  realtime: false,
  newGame: (_config, seed) => newNumberMatch(seed),
  createBot: () => createNumberBot(),
  encodeMove: (move) => move,
};
