import type { Rng } from '../../core/rng';
import { createRng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/** Color Sort, the water sort puzzle (docs/games/color-sort.md). */
export type ColorSortLevel = 'easy' | 'medium' | 'hard';
export const COLOR_SORT_LEVELS: readonly ColorSortLevel[] = ['easy', 'medium', 'hard'];
const COLORS_FOR: Record<ColorSortLevel, number> = { easy: 4, medium: 7, hard: 10 };
export const TUBE_SIZE = 4;
const EMPTY_TUBES = 2;
/** The solver gives up past this many positions, and the deal is replaced. */
const SEARCH_LIMIT = 60_000;

/** `p<from>:<to>` pours from one tube into another; `u` undoes. */
export type ColorSortMove = string;
export const pourMove = (from: number, to: number): ColorSortMove => `p${from}:${to}`;
export const UNDO_POUR: ColorSortMove = 'u';

type Tubes = readonly (readonly number[])[];

export interface Pour {
  readonly from: number;
  readonly to: number;
  readonly color: number;
  readonly count: number;
}

const top = (tube: readonly number[]) => tube[tube.length - 1];

/** Same-colored layers on top of a tube. */
function topRun(tube: readonly number[]): number {
  let run = 0;
  for (let i = tube.length - 1; i >= 0 && tube[i] === top(tube); i--) run++;
  return run;
}

export function canPour(tubes: Tubes, from: number, to: number): boolean {
  const source = tubes[from];
  const target = tubes[to];
  if (!source || !target || from === to || source.length === 0 || target.length >= TUBE_SIZE) return false;
  return target.length === 0 || top(target) === top(source);
}

function pour(tubes: Tubes, from: number, to: number): { tubes: number[][]; pour: Pour } {
  const next = tubes.map((tube) => tube.slice());
  const color = top(next[from]!)!;
  const count = Math.min(topRun(next[from]!), TUBE_SIZE - next[to]!.length);
  for (let i = 0; i < count; i++) next[to]!.push(next[from]!.pop()!);
  return { tubes: next, pour: { from, to, color, count } };
}

const isComplete = (tube: readonly number[]) => tube.length === TUBE_SIZE && tube.every((c) => c === tube[0]);
export const isSorted = (tubes: Tubes) => tubes.every((tube) => tube.length === 0 || isComplete(tube));

/**
 * Finds a sequence of pours that sorts the tubes, or null if none is found within the search limit.
 * Tubes are interchangeable, so positions are remembered in a sorted form; pointless pours are skipped.
 */
export function solveColorSort(start: Tubes): [number, number][] | null {
  const seen = new Set<string>();
  const key = (tubes: Tubes) =>
    tubes
      .map((tube) => tube.join(','))
      .sort()
      .join('|');
  const path: [number, number][] = [];
  const search = (tubes: Tubes): boolean => {
    if (isSorted(tubes)) return true;
    if (seen.size > SEARCH_LIMIT) return false;
    const k = key(tubes);
    if (seen.has(k)) return false;
    seen.add(k);
    for (let from = 0; from < tubes.length; from++) {
      const source = tubes[from]!;
      if (source.length === 0 || isComplete(source)) continue;
      const allOneColor = topRun(source) === source.length;
      let triedEmpty = false;
      for (let to = 0; to < tubes.length; to++) {
        if (!canPour(tubes, from, to)) continue;
        const empty = tubes[to]!.length === 0;
        // Pouring a single-color tube into an empty one changes nothing; one empty target is enough.
        if (empty && (allOneColor || triedEmpty)) continue;
        if (empty) triedEmpty = true;
        path.push([from, to]);
        if (search(pour(tubes, from, to).tubes)) return true;
        path.pop();
      }
    }
    return false;
  };
  return search(start) ? path.slice() : null;
}

/**
 * Plans are remembered for every position along them, so following hints (or the bot) keeps going the
 * same way. Solving again from each new position could start by pouring straight back, and loop forever.
 */
const plans = new Map<string, [number, number][]>();
const exactKey = (tubes: Tubes) => tubes.map((tube) => tube.join(',')).join('|');

function planFrom(tubes: Tubes): [number, number][] | null {
  const cached = plans.get(exactKey(tubes));
  if (cached) return cached;
  const path = solveColorSort(tubes);
  if (!path) return null;
  if (plans.size > 5000) plans.clear();
  let at: Tubes = tubes;
  path.forEach(([from, to], i) => {
    plans.set(exactKey(at), path.slice(i));
    at = pour(at, from, to).tubes;
  });
  return path;
}

export class ColorSortState implements GameState<ColorSortMove> {
  readonly currentSeat: Seat = 0;

  constructor(
    readonly level: ColorSortLevel,
    /** Each tube bottom to top; numbers are colors. */
    readonly tubes: Tubes,
    readonly moves: number,
    readonly result: GameResult | null,
    readonly last: Pour | null,
    readonly previous: ColorSortState | null,
  ) {}

  legalMoves(seat: Seat): readonly ColorSortMove[] {
    if (this.result || seat !== 0) return [];
    const moves: ColorSortMove[] = [];
    for (let from = 0; from < this.tubes.length; from++) {
      for (let to = 0; to < this.tubes.length; to++) if (canPour(this.tubes, from, to)) moves.push(pourMove(from, to));
    }
    if (this.previous) moves.push(UNDO_POUR);
    return moves;
  }

  apply(move: ColorSortMove): ColorSortState {
    if (this.result) throw new Error('Game is over');
    if (!this.legalMoves(0).includes(move)) throw new Error(`Illegal move: ${move}`);
    if (move === UNDO_POUR) {
      const back = this.previous!;
      return new ColorSortState(this.level, back.tubes, this.moves + 1, null, null, back.previous);
    }
    const [from, to] = move.slice(1).split(':').map(Number) as [number, number];
    const { tubes, pour: done } = pour(this.tubes, from, to);
    const result: GameResult | null = isSorted(tubes) ? { winners: [0], draw: false } : null;
    return new ColorSortState(this.level, tubes, this.moves + 1, result, done, this);
  }

  /** The next pour toward a win from here, or null when the tubes are stuck (undo some pours). */
  hint(): ColorSortMove | null {
    const path = planFrom(this.tubes);
    return path?.[0] ? pourMove(path[0][0], path[0][1]) : null;
  }
}

/** Deals colors at random, keeping only deals the solver can finish and that aren't already sorted. */
export function newColorSort(seed: number, level: ColorSortLevel): ColorSortState {
  const colors = COLORS_FOR[level];
  for (let attempt = 0; ; attempt++) {
    const rng = createRng((seed ^ Math.imul(attempt + 1, 0x9e3779b1)) >>> 0);
    const units = Array.from({ length: colors * TUBE_SIZE }, (_, i) => Math.floor(i / TUBE_SIZE));
    for (let i = units.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [units[i], units[j]] = [units[j]!, units[i]!];
    }
    const tubes: number[][] = Array.from({ length: colors }, (_, t) => units.slice(t * TUBE_SIZE, (t + 1) * TUBE_SIZE));
    for (let i = 0; i < EMPTY_TUBES; i++) tubes.push([]);
    if (tubes.some(isComplete)) continue;
    if (solveColorSort(tubes) || attempt > 200) return new ColorSortState(level, tubes, 0, null, null, null);
  }
}

/** Autoplay and hints: the solver's next pour; when stuck, undo. */
function createColorSortBot(): Bot<ColorSortMove> {
  return {
    chooseMove(generic: GameState<ColorSortMove>, _seat: Seat, rng: Rng): ColorSortMove {
      const state = generic as ColorSortState;
      const next = state.hint();
      if (next) return next;
      const legal = state.legalMoves(0);
      return legal.includes(UNDO_POUR) ? UNDO_POUR : rng.pick(legal);
    },
  };
}

const isLevel = (value: string | undefined): value is ColorSortLevel => COLOR_SORT_LEVELS.includes(value as ColorSortLevel);

export const colorSort: GameDefinition<ColorSortMove> = {
  id: 'color-sort',
  name: 'Color Sort',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo', 'race'],
  hiddenInfo: false,
  realtime: false,
  newGame: (config, seed) => newColorSort(seed, isLevel(config.variant) ? config.variant : 'easy'),
  createBot: () => createColorSortBot(),
  encodeMove: (move) => move,
};
