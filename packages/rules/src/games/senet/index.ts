import { createRng, type Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Senet (docs/games/senet.md). No rulebook survives, so this is the modern reconstruction most
 * sets and apps play, after Timothy Kendall: five pieces each start mixed along the first row,
 * four throwing sticks, landing on a lone piece swaps places with it, two side by side are safe,
 * three in a row cannot be passed, and the last five squares each have their own rule.
 */
export const SENET_PIECES = 5;
export const SENET_SQUARES = 30;
export const SENET_OFF = 31;
/** The House of Rebirth, where the water sends you. */
export const REBIRTH = 15;
/** The House of Beauty: every piece must stop here before it can go further. */
export const BEAUTY = 26;
/** The House of Water: land here and you are washed back to Rebirth. */
export const WATER = 27;
/** Squares where a piece cannot be swapped. */
export const SENET_SAFE: ReadonlySet<number> = new Set([26, 28, 29]);
/** The throw that bears a piece off from each of the last squares. */
export const EXIT_THROW: Readonly<Record<number, number>> = { 26: 5, 28: 3, 29: 2, 30: 1 };

/** Four sticks, white on one side: the throw is the whites showing, and no whites counts five. */
export function senetSticks(seed: number, n: number): readonly [number, number, number, number] {
  const rng = createRng((seed ^ Math.imul(n + 1, 0xc2b2ae35)) >>> 0);
  return [rng.int(2), rng.int(2), rng.int(2), rng.int(2)];
}

export const sticksValue = (sticks: readonly number[]): number => sticks.reduce((a, b) => a + b, 0) || 5;

export const SENET_ODDS: Readonly<Record<number, number>> = { 1: 4 / 16, 2: 6 / 16, 3: 4 / 16, 4: 1 / 16, 5: 1 / 16 };
/** A 1, 4 or 5 throws again; a 2 or 3 ends the turn. */
export const throwsAgain = (value: number): boolean => value === 1 || value === 4 || value === 5;

/** `roll`, or `m<from>`: move the piece on square `from`. */
export type SenetMove = string;

export interface SenetEvent {
  readonly seat: Seat;
  readonly from: number;
  readonly to: number;
  /** Where the piece really ended up: the water sends it back. */
  readonly landed: number;
  /** The other player's piece that was swapped back to `from`, if any. */
  readonly swapped: boolean;
  readonly backward: boolean;
}

export class SenetState implements GameState<SenetMove> {
  constructor(
    readonly seed: number,
    /** Each seat's pieces by square, 1 to 30, or 31 once borne off. Sorted. */
    readonly pieces: readonly [readonly number[], readonly number[]],
    readonly currentSeat: Seat,
    readonly phase: 'roll' | 'move',
    readonly sticks: readonly number[] | null,
    readonly throws: number,
    readonly last: SenetEvent | null,
    readonly passed: boolean,
    readonly result: GameResult | null,
  ) {}

  get value(): number {
    return this.sticks ? sticksValue(this.sticks) : 0;
  }

  owner(square: number): Seat | null {
    if (this.pieces[0].includes(square)) return 0;
    if (this.pieces[1].includes(square)) return 1;
    return null;
  }

  /** Where a piece on `from` would go with `value`, forward or back, or null if it cannot. */
  target(seat: Seat, from: number, value: number, backward: boolean): number | null {
    if (from >= SENET_OFF) return null;
    const other: Seat = seat === 0 ? 1 : 0;
    if (backward) {
      // Pieces in the last houses have made it; only pieces before them are sent back.
      if (from >= BEAUTY) return null;
    } else if (from >= BEAUTY) {
      // From the last houses a piece goes off with its throw; from Beauty any other throw moves on.
      if (EXIT_THROW[from] === value) return SENET_OFF;
      if (from !== BEAUTY) return null;
    }
    const to = backward ? from - value : from + value;
    if (to < 1) return null;
    if (!backward && from < BEAUTY && to > BEAUTY) return null;
    if (to === SENET_OFF) return to;
    if (to > SENET_SQUARES) return null;
    const holder = this.owner(to);
    if (holder === seat) return null;
    if (holder === other) {
      if (SENET_SAFE.has(to)) return null;
      // Two side by side guard each other.
      if (this.owner(to - 1) === other || this.owner(to + 1) === other) return null;
    }
    // Three in a row are a wall nothing gets past.
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    for (let s = lo + 1; s + 2 < hi; s++) {
      if (this.owner(s) === other && this.owner(s + 1) === other && this.owner(s + 2) === other) return null;
    }
    return to;
  }

  /** The pieces `seat` can move with `value`: forward if any can, only backward if none can. */
  options(seat: Seat, value: number): { froms: number[]; backward: boolean } {
    const mine = this.pieces[seat].filter((p) => p < SENET_OFF);
    const forward = mine.filter((from) => this.target(seat, from, value, false) !== null);
    if (forward.length) return { froms: forward, backward: false };
    return { froms: mine.filter((from) => this.target(seat, from, value, true) !== null), backward: true };
  }

  legalMoves(seat: Seat): readonly SenetMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    if (this.phase === 'roll') return ['roll'];
    return this.options(seat, this.value).froms.map((from) => `m${from}`);
  }

  apply(move: SenetMove): SenetState {
    if (!this.legalMoves(this.currentSeat).includes(move)) throw new Error(`Illegal move: ${move}`);
    const seat = this.currentSeat;
    const other: Seat = seat === 0 ? 1 : 0;
    if (move === 'roll') {
      const sticks = senetSticks(this.seed, this.throws);
      const next = new SenetState(this.seed, this.pieces, seat, 'move', sticks, this.throws + 1, this.last, false, null);
      if (next.options(seat, sticksValue(sticks)).froms.length === 0) {
        // Nothing can move. A throw that earns another still keeps the sticks in your hand.
        const again = throwsAgain(sticksValue(sticks));
        return new SenetState(this.seed, this.pieces, again ? seat : other, 'roll', sticks, this.throws + 1, this.last, true, null);
      }
      return next;
    }
    const from = Number(move.slice(1));
    const { backward } = this.options(seat, this.value);
    const to = this.target(seat, from, this.value, backward)!;
    let mine = this.pieces[seat].filter((_, i, list) => i !== list.indexOf(from));
    let theirs = this.pieces[other].slice();
    const swapped = to !== SENET_OFF && theirs.includes(to);
    if (swapped) theirs = theirs.map((p) => (p === to ? from : p));
    let landed = to;
    if (to === WATER) {
      // Washed back to Rebirth, or the first free square before it.
      landed = REBIRTH;
      while (landed > 1 && (mine.includes(landed) || theirs.includes(landed))) landed--;
    }
    mine = [...mine, landed].sort((a, b) => a - b);
    theirs.sort((a, b) => a - b);
    const pieces = (seat === 0 ? [mine, theirs] : [theirs, mine]) as [number[], number[]];
    const event: SenetEvent = { seat, from, to, landed, swapped, backward };
    if (mine.every((p) => p === SENET_OFF)) {
      return new SenetState(this.seed, pieces, seat, 'roll', this.sticks, this.throws, event, false, { winners: [seat], draw: false });
    }
    const again = throwsAgain(this.value);
    return new SenetState(this.seed, pieces, again ? seat : other, 'roll', this.sticks, this.throws, event, false, null);
  }
}

export function newSenet(seed: number): SenetState {
  // Mixed along the first row: the one who moves first starts behind, on the odd squares.
  return new SenetState(seed >>> 0, [[1, 3, 5, 7, 9], [2, 4, 6, 8, 10]], 0, 'roll', null, 0, null, false, null);
}

export interface SenetTier {
  readonly random: number;
  /** How much a piece left where it can be swapped counts against a move. */
  readonly caution: number;
  /** How much a wall or a guarding pair counts for. */
  readonly shape: number;
}

export const SENET_TIERS: Record<BotTier, SenetTier> = {
  easy: { random: 0.6, caution: 0, shape: 0 },
  medium: { random: 0.25, caution: 0.5, shape: 0.5 },
  hard: { random: 0, caution: 1, shape: 1 },
  expert: { random: 0, caution: 1.3, shape: 1.3 },
};

/** How likely the other player is to be able to swap the piece on `square` next turn. */
function exposure(state: SenetState, seat: Seat, square: number): number {
  if (square >= SENET_OFF || SENET_SAFE.has(square)) return 0;
  if (state.owner(square - 1) === seat || state.owner(square + 1) === seat) return 0;
  const other: Seat = seat === 0 ? 1 : 0;
  let chance = 0;
  for (let value = 1; value <= 5; value++) {
    if (state.pieces[other].some((p) => p < square && state.target(other, p, value, false) === square)) chance += SENET_ODDS[value]!;
  }
  return chance;
}

/** A position from `seat`'s side: how far each has come, walls and pairs, and pieces left open. */
export function senetValue(state: SenetState, seat: Seat, tier: SenetTier): number {
  const side = (s: Seat) => {
    let total = 0;
    const mine = state.pieces[s];
    for (const p of mine) {
      total += p === SENET_OFF ? 40 : p;
      if (p < SENET_OFF) {
        if (mine.includes(p + 1)) total += tier.shape * 2;
        if (mine.includes(p + 1) && mine.includes(p + 2)) total += tier.shape * 3;
        total -= tier.caution * exposure(state, s, p) * p * 0.5;
      }
    }
    return total;
  };
  return side(seat) - side(seat === 0 ? 1 : 0);
}

export function chooseSenetMove(state: SenetState, seat: Seat, tier: SenetTier, rng: Rng): SenetMove {
  const moves = state.legalMoves(seat);
  if (moves.length === 1) return moves[0]!;
  if (rng.next() < tier.random) return rng.pick(moves);
  const scored = moves.map((move) => {
    const next = state.apply(move);
    let value = next.result ? 10_000 : senetValue(next, seat, tier);
    if (next.last?.swapped) value += 3;
    return { move, value };
  });
  const best = Math.max(...scored.map((s) => s.value));
  return rng.pick(scored.filter((s) => s.value === best)).move;
}

export const senet: GameDefinition<SenetMove> = {
  id: 'senet',
  name: 'Senet',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: false,
  realtime: false,
  newGame: (_config, seed) => newSenet(seed),
  createBot: (tier): Bot<SenetMove> => ({
    chooseMove: (state, seat, rng) => chooseSenetMove(state as SenetState, seat, SENET_TIERS[tier], rng),
  }),
  encodeMove: (move) => move,
};
