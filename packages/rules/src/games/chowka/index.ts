import { createRng, type Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Chowka Bhara (docs/games/chowka.md), the south Indian race game also called Ashta Chamma: a 5 by 5
 * board, four pieces each, four cowries. Round the outside anticlockwise, then the inner ring
 * clockwise to the middle. You may not go inside until you have knocked somebody off.
 */
export const CHOWKA_PIECES = 4;
/** 16 round the outside, 8 round the inner ring, then the middle square. */
export const CHOWKA_HOME = 24;
export const CHOWKA_WAITING = -1;
/** A game running this long with nobody home is called a draw. */
export const CHOWKA_THROW_LIMIT = 3000;

/** Square `i` of the path of the player starting at the bottom, as (x, y) on the 5 by 5 grid. */
const BOTTOM_PATH: readonly (readonly [number, number])[] = [
  [2, 4], [3, 4], [4, 4], [4, 3], [4, 2], [4, 1], [4, 0], [3, 0], [2, 0], [1, 0], [0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 4],
  [1, 3], [1, 2], [1, 1], [2, 1], [3, 1], [3, 2], [3, 3], [2, 3],
  [2, 2],
];

/** Where step `i` of the path of the player on `side` (0 bottom, 1 right, 2 top, 3 left) is. */
export function chowkaSquare(side: number, i: number): { x: number; y: number } {
  const [x, y] = BOTTOM_PATH[i]!;
  let dx = x - 2;
  let dy = y - 2;
  for (let k = 0; k < side; k++) [dx, dy] = [dy, -dx];
  return { x: 2 + dx, y: 2 + dy };
}

const key = (c: { x: number; y: number }) => c.y * 5 + c.x;
/** The four starting squares and the middle, marked with a cross, where nobody can be hit. */
export const CHOWKA_SAFE: ReadonlySet<number> = new Set([22, 14, 2, 10, 12]);

/** Four cowries: the throw is how many land mouth up, and none up counts eight. */
export function chowkaShells(seed: number, n: number): readonly number[] {
  const rng = createRng((seed ^ Math.imul(n + 1, 0x165667b1)) >>> 0);
  return Array.from({ length: 4 }, () => rng.int(2));
}
export const chowkaValue = (shells: readonly number[]): number => shells.reduce((a, b) => a + b, 0) || 8;
/** A four (chamma) or an eight (ashta) brings a piece on and throws again. */
export const isChamma = (value: number): boolean => value === 4 || value === 8;
export const CHOWKA_ODDS: Readonly<Record<number, number>> = { 1: 4 / 16, 2: 6 / 16, 3: 4 / 16, 4: 1 / 16, 8: 1 / 16 };

/** `roll`, `e` to bring a piece on, `m<piece>` to move one. */
export type ChowkaMove = string;

export interface ChowkaEvent {
  readonly seat: Seat;
  readonly piece: number;
  readonly from: number;
  readonly to: number;
  readonly captured: readonly (readonly [Seat, number])[];
}

export class ChowkaState implements GameState<ChowkaMove> {
  constructor(
    readonly players: number,
    readonly seed: number,
    readonly pieces: readonly (readonly number[])[],
    /** Whether each seat has knocked a piece off yet, which opens the inner ring to them. */
    readonly hit: readonly boolean[],
    readonly currentSeat: Seat,
    readonly phase: 'roll' | 'move',
    readonly shells: readonly number[] | null,
    readonly throws: number,
    readonly last: ChowkaEvent | null,
    readonly passed: boolean,
    readonly result: GameResult | null,
  ) {}

  get value(): number {
    return this.shells ? chowkaValue(this.shells) : 0;
  }

  /** Two sit opposite; three or four take the sides in turn. */
  side(seat: Seat): number {
    return this.players === 2 ? seat * 2 : seat;
  }

  squareOf(seat: Seat, piece: number): number | null {
    const at = this.pieces[seat]![piece]!;
    return at < 0 ? null : key(chowkaSquare(this.side(seat), at));
  }

  /** Who is on a square, as [seat, piece] pairs. */
  on(square: number): [Seat, number][] {
    const found: [Seat, number][] = [];
    this.pieces.forEach((list, seat) => list.forEach((_, piece) => {
      if (this.squareOf(seat, piece) === square) found.push([seat, piece]);
    }));
    return found;
  }

  target(seat: Seat, piece: number, value: number): number | null {
    const at = this.pieces[seat]![piece]!;
    if (at < 0 || at >= CHOWKA_HOME) return null;
    let to = at + value;
    if (to > CHOWKA_HOME) return null;
    // The inner ring is shut to anyone who has not yet knocked somebody off: they go round the
    // outside again instead. (Stopping at the door instead, every piece ends up parked there in
    // doubles nobody can hit, and the game never ends.)
    if (to >= 16 && !this.hit[seat]) to -= 16;
    const square = key(chowkaSquare(this.side(seat), to));
    if (!CHOWKA_SAFE.has(square)) {
      const theirs = this.on(square).filter(([s]) => s !== seat);
      // Two of theirs on one square are a double, which a single piece cannot hit.
      const bySeat = new Map<number, number>();
      for (const [s] of theirs) bySeat.set(s, (bySeat.get(s) ?? 0) + 1);
      if ([...bySeat.values()].some((n) => n >= 2)) return null;
    }
    return to;
  }

  legalMoves(seat: Seat): readonly ChowkaMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    if (this.phase === 'roll') return ['roll'];
    const moves: ChowkaMove[] = [];
    if (isChamma(this.value) && this.pieces[seat]!.includes(CHOWKA_WAITING)) moves.push('e');
    const seen = new Set<number>();
    this.pieces[seat]!.forEach((at, piece) => {
      if (seen.has(at) || this.target(seat, piece, this.value) === null) return;
      seen.add(at);
      moves.push(`m${piece}`);
    });
    return moves;
  }

  private nextSeat(): Seat {
    for (let n = 1; n <= this.players; n++) {
      const s = (this.currentSeat + n) % this.players;
      if (this.pieces[s]!.some((p) => p !== CHOWKA_HOME)) return s;
    }
    return this.currentSeat;
  }

  apply(move: ChowkaMove): ChowkaState {
    if (!this.legalMoves(this.currentSeat).includes(move)) throw new Error(`Illegal move: ${move}`);
    const seat = this.currentSeat;
    if (move === 'roll') {
      const shells = chowkaShells(this.seed, this.throws);
      const next = new ChowkaState(this.players, this.seed, this.pieces, this.hit, seat, 'move', shells, this.throws + 1, this.last, false, null);
      if (this.throws + 1 >= CHOWKA_THROW_LIMIT) return new ChowkaState(this.players, this.seed, this.pieces, this.hit, seat, 'roll', shells, this.throws + 1, this.last, false, { winners: [], draw: true });
      if (next.legalMoves(seat).length === 0) {
        const again = isChamma(chowkaValue(shells));
        return new ChowkaState(this.players, this.seed, this.pieces, this.hit, again ? seat : this.nextSeat(), 'roll', shells, this.throws + 1, this.last, true, null);
      }
      return next;
    }
    const pieces = this.pieces.map((list) => list.slice());
    const hit = this.hit.slice();
    const mine = pieces[seat]!;
    const piece = move === 'e' ? mine.indexOf(CHOWKA_WAITING) : Number(move.slice(1));
    const from = mine[piece]!;
    const to = move === 'e' ? 0 : this.target(seat, piece, this.value)!;
    mine[piece] = to;
    const captured: [Seat, number][] = [];
    const square = key(chowkaSquare(this.side(seat), to));
    if (!CHOWKA_SAFE.has(square)) {
      for (const [s, p] of this.on(square)) {
        if (s === seat) continue;
        pieces[s]![p] = CHOWKA_WAITING;
        captured.push([s, p]);
      }
    }
    if (captured.length) hit[seat] = true;
    const event: ChowkaEvent = { seat, piece, from, to, captured };
    if (mine.every((p) => p === CHOWKA_HOME)) {
      return new ChowkaState(this.players, this.seed, pieces, hit, seat, 'roll', this.shells, this.throws, event, false, { winners: [seat], draw: false });
    }
    const again = isChamma(this.value) || captured.length > 0;
    const after = new ChowkaState(this.players, this.seed, pieces, hit, seat, 'roll', this.shells, this.throws, event, false, null);
    return again ? after : new ChowkaState(this.players, this.seed, pieces, hit, after.nextSeat(), 'roll', this.shells, this.throws, event, false, null);
  }
}

export function newChowka(seed: number, players: number): ChowkaState {
  const pieces = Array.from({ length: players }, () => Array<number>(CHOWKA_PIECES).fill(CHOWKA_WAITING));
  return new ChowkaState(players, seed >>> 0, pieces, Array<boolean>(players).fill(false), 0, 'roll', null, 0, null, false, null);
}

export interface ChowkaTier {
  readonly random: number;
  readonly caution: number;
}

export const CHOWKA_TIERS: Record<BotTier, ChowkaTier> = {
  easy: { random: 0.5, caution: 0 },
  medium: { random: 0.15, caution: 0.5 },
  hard: { random: 0, caution: 1 },
  expert: { random: 0, caution: 1.4 },
};

/** How likely a piece of `seat` on `square` is to be hit next turn. */
function danger(state: ChowkaState, seat: Seat, square: number): number {
  if (CHOWKA_SAFE.has(square)) return 0;
  if (state.on(square).filter(([s]) => s === seat).length >= 2) return 0;
  let chance = 0;
  for (let s = 0; s < state.players; s++) {
    if (s === seat) continue;
    for (const [value, odds] of Object.entries(CHOWKA_ODDS)) {
      const v = Number(value);
      if (state.pieces[s]!.some((at) => at >= 0 && at + v < 16 && key(chowkaSquare(state.side(s), at + v)) === square)) chance += odds;
    }
  }
  return Math.min(1, chance);
}

function scoreMove(state: ChowkaState, seat: Seat, move: ChowkaMove, tier: ChowkaTier): number {
  const next = state.apply(move);
  if (next.result) return 1e6;
  const event = next.last!;
  let score = event.to - Math.max(0, event.from);
  if (move === 'e') score += 12;
  if (event.to === CHOWKA_HOME) score += 20;
  score += event.captured.reduce((sum, [s, p]) => sum + 15 + Math.max(0, state.pieces[s]![p]!), 0);
  if (!state.hit[seat] && event.captured.length) score += 20;
  const square = key(chowkaSquare(state.side(seat), event.to));
  if (CHOWKA_SAFE.has(square)) score += 3;
  score -= tier.caution * danger(next, seat, square) * (event.to + 8);
  if (event.from >= 0) score += tier.caution * danger(state, seat, key(chowkaSquare(state.side(seat), event.from))) * (event.from + 8) * 0.6;
  return score;
}

export function chooseChowkaMove(state: ChowkaState, seat: Seat, tier: ChowkaTier, rng: Rng): ChowkaMove {
  const moves = state.legalMoves(seat);
  if (moves.length === 1) return moves[0]!;
  if (rng.next() < tier.random) return rng.pick(moves);
  const scored = moves.map((move) => ({ move, score: scoreMove(state, seat, move, tier) }));
  const best = Math.max(...scored.map((s) => s.score));
  return rng.pick(scored.filter((s) => s.score === best)).move;
}

export const chowka: GameDefinition<ChowkaMove> = {
  id: 'chowka',
  name: 'Chowka Bhara',
  minPlayers: 2,
  maxPlayers: 4,
  modes: ['bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: false,
  realtime: false,
  newGame: (config, seed) => newChowka(seed, Math.max(2, Math.min(4, config.players))),
  createBot: (tier): Bot<ChowkaMove> => ({
    chooseMove: (state, seat, rng) => chooseChowkaMove(state as ChowkaState, seat, CHOWKA_TIERS[tier], rng),
  }),
  encodeMove: (move) => move,
};
