import { createRng, type Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Pachisi (docs/games/pachisi.md): the Indian cross-and-circle race game. Four pieces each start in
 * the middle, go down their own arm, counter-clockwise right round the outside of the cross and back
 * up their own arm home. Six cowrie shells are the dice; a 6, 10 or 25 is a grace, which brings a
 * piece on and throws again. Four play as two partnerships, sitting opposite.
 *
 * Each arm is three columns of eight: rows count out from the middle (0) to the end (7). Its `prev`
 * column is the one a piece coming round the board reaches first, then the middle end square, then
 * its `next` column.
 */
export const PACHISI_PIECES = 4;
/** Squares on each path: 8 down the middle, 67 round the outside, 8 back up. */
export const PACHISI_PATH = 83;
export const PACHISI_HOME = PACHISI_PATH;
export const PACHISI_WAITING = -1;

export type PachisiColumn = 'prev' | 'mid' | 'next';
export interface PachisiCell {
  readonly arm: number;
  readonly col: PachisiColumn;
  readonly row: number;
}

/** The square at step `i` of the path of the player whose arm is `arm`. */
export function pachisiCell(arm: number, i: number): PachisiCell {
  if (i < 8) return { arm, col: 'mid', row: i };
  let k = i - 8;
  if (k < 8) return { arm, col: 'next', row: 7 - k };
  k -= 8;
  for (let n = 1; n <= 3; n++) {
    const a = (arm + n) % 4;
    if (k < 8) return { arm: a, col: 'prev', row: k };
    k -= 8;
    if (k === 0) return { arm: a, col: 'mid', row: 7 };
    k -= 1;
    if (k < 8) return { arm: a, col: 'next', row: 7 - k };
    k -= 8;
  }
  if (k < 8) return { arm, col: 'prev', row: k };
  k -= 8;
  return { arm, col: 'mid', row: 7 - k };
}

export const cellKey = (c: PachisiCell): string => `${c.arm}${c.col[0]}${c.row}`;

/** Castles: the end of every middle column, and four squares in from the end of every outer column. */
export const isCastle = (c: PachisiCell): boolean => (c.col === 'mid' && c.row === 7) || (c.col !== 'mid' && c.row === 3);

/** Six cowries: the throw is by how many land mouth up. None up counts 25, one up counts 10. */
export const COWRIE_VALUE = [25, 10, 2, 3, 4, 5, 6] as const;
export const isGrace = (value: number): boolean => value === 6 || value === 10 || value === 25;

export function cowries(seed: number, n: number): readonly number[] {
  const rng = createRng((seed ^ Math.imul(n + 1, 0x27d4eb2f)) >>> 0);
  return Array.from({ length: 6 }, () => rng.int(2));
}

export const cowrieValue = (shells: readonly number[]): number => COWRIE_VALUE[shells.reduce((a, b) => a + b, 0)]!;

/** How likely each throw is: six coins. */
export const PACHISI_ODDS: Readonly<Record<number, number>> = { 25: 1 / 64, 10: 6 / 64, 2: 15 / 64, 3: 20 / 64, 4: 15 / 64, 5: 6 / 64, 6: 1 / 64 };

/** `roll`, `e` to bring a piece on with a grace, or `m<piece>` to move that piece. */
export type PachisiMove = string;

export interface PachisiEvent {
  readonly seat: Seat;
  readonly piece: number;
  readonly from: number;
  readonly to: number;
  /** Pieces sent back to the middle, as [seat, piece]. */
  readonly captured: readonly (readonly [Seat, number])[];
}

export class PachisiState implements GameState<PachisiMove> {
  constructor(
    readonly players: number,
    readonly seed: number,
    /** Each seat's four pieces: -1 waiting in the middle, 0–82 along its path, 83 home. */
    readonly pieces: readonly (readonly number[])[],
    readonly currentSeat: Seat,
    readonly phase: 'roll' | 'move',
    readonly shells: readonly number[] | null,
    readonly throws: number,
    readonly last: PachisiEvent | null,
    readonly passed: boolean,
    readonly result: GameResult | null,
  ) {}

  get value(): number {
    return this.shells ? cowrieValue(this.shells) : 0;
  }

  /** Each seat's arm: two players sit opposite, three or four take the arms in turn. */
  arm(seat: Seat): number {
    return this.players === 2 ? seat * 2 : seat;
  }

  /** With four, seats 0 and 2 play against 1 and 3. */
  partners(a: Seat, b: Seat): boolean {
    return a === b || (this.players === 4 && a % 2 === b % 2);
  }

  cellOf(seat: Seat, piece: number): PachisiCell | null {
    const at = this.pieces[seat]![piece]!;
    return at < 0 || at >= PACHISI_HOME ? null : pachisiCell(this.arm(seat), at);
  }

  /** Who is on a square, as [seat, piece] pairs. */
  occupants(cell: PachisiCell): [Seat, number][] {
    const key = cellKey(cell);
    const found: [Seat, number][] = [];
    this.pieces.forEach((list, seat) => list.forEach((_, piece) => {
      const c = this.cellOf(seat, piece);
      if (c && cellKey(c) === key) found.push([seat, piece]);
    }));
    return found;
  }

  /** Where `piece` would go with `value`, or null if it cannot. */
  target(seat: Seat, piece: number, value: number): number | null {
    const at = this.pieces[seat]![piece]!;
    if (at < 0 || at >= PACHISI_HOME) return null;
    const to = at + value;
    // Home needs the exact throw. No throw counts one, so a piece may not stop one short of home,
    // where it could never finish.
    if (to > PACHISI_HOME || to === PACHISI_HOME - 1) return null;
    if (to === PACHISI_HOME) return to;
    const cell = pachisiCell(this.arm(seat), to);
    // A castle held by the other side cannot be landed on.
    if (isCastle(cell) && this.occupants(cell).some(([s]) => !this.partners(s, seat))) return null;
    return to;
  }

  canEnter(seat: Seat, value: number): boolean {
    if (!isGrace(value) || !this.pieces[seat]!.includes(PACHISI_WAITING)) return false;
    // The first square of your arm is yours alone, so entering is never blocked.
    return true;
  }

  legalMoves(seat: Seat): readonly PachisiMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    if (this.phase === 'roll') return ['roll'];
    const moves: PachisiMove[] = [];
    if (this.canEnter(seat, this.value)) moves.push('e');
    // Pieces on the same square move the same, so each square is one move.
    const seen = new Set<number>();
    this.pieces[seat]!.forEach((at, piece) => {
      if (seen.has(at) || this.target(seat, piece, this.value) === null) return;
      seen.add(at);
      moves.push(`m${piece}`);
    });
    return moves;
  }

  private nextSeat(): Seat {
    // Skip anyone already home; with partners, a player home keeps playing for nobody.
    for (let n = 1; n <= this.players; n++) {
      const s = (this.currentSeat + n) % this.players;
      if (this.pieces[s]!.some((p) => p !== PACHISI_HOME)) return s;
    }
    return this.currentSeat;
  }

  apply(move: PachisiMove): PachisiState {
    if (!this.legalMoves(this.currentSeat).includes(move)) throw new Error(`Illegal move: ${move}`);
    const seat = this.currentSeat;
    if (move === 'roll') {
      const shells = cowries(this.seed, this.throws);
      const next = new PachisiState(this.players, this.seed, this.pieces, seat, 'move', shells, this.throws + 1, this.last, false, null);
      if (next.legalMoves(seat).length === 0) {
        // Nothing to do with it. A grace still throws again.
        const again = isGrace(cowrieValue(shells));
        return new PachisiState(this.players, this.seed, this.pieces, again ? seat : this.nextSeat(), 'roll', shells, this.throws + 1, this.last, true, null);
      }
      return next;
    }
    const pieces = this.pieces.map((list) => list.slice());
    const mine = pieces[seat]!;
    let piece: number;
    let to: number;
    const from = move === 'e' ? PACHISI_WAITING : mine[Number(move.slice(1))]!;
    if (move === 'e') {
      piece = mine.indexOf(PACHISI_WAITING);
      to = 0;
    } else {
      piece = Number(move.slice(1));
      to = this.target(seat, piece, this.value)!;
    }
    mine[piece] = to;
    const captured: [Seat, number][] = [];
    if (to < PACHISI_HOME) {
      const cell = pachisiCell(this.arm(seat), to);
      if (!isCastle(cell)) {
        // Land on the other side and every one of theirs there goes back to the middle.
        for (const [s, p] of this.occupants(cell)) {
          if (this.partners(s, seat)) continue;
          pieces[s]![p] = PACHISI_WAITING;
          captured.push([s, p]);
        }
      }
    }
    const event: PachisiEvent = { seat, piece, from, to, captured };
    const home = (s: Seat) => pieces[s]!.every((p) => p === PACHISI_HOME);
    const winners = Array.from({ length: this.players }, (_, s) => s).filter((s) => this.partners(s, seat));
    if (winners.every(home)) {
      return new PachisiState(this.players, this.seed, pieces, seat, 'roll', this.shells, this.throws, event, false, { winners, draw: false });
    }
    const again = (isGrace(this.value) || captured.length > 0) && !home(seat);
    const after = new PachisiState(this.players, this.seed, pieces, seat, 'roll', this.shells, this.throws, event, false, null);
    return again ? after : new PachisiState(this.players, this.seed, pieces, after.nextSeat(), 'roll', this.shells, this.throws, event, false, null);
  }
}

export function newPachisi(seed: number, players: number): PachisiState {
  const pieces = Array.from({ length: players }, () => Array<number>(PACHISI_PIECES).fill(PACHISI_WAITING));
  return new PachisiState(players, seed >>> 0, pieces, 0, 'roll', null, 0, null, false, null);
}

export interface PachisiTier {
  readonly random: number;
  readonly caution: number;
}

export const PACHISI_TIERS: Record<BotTier, PachisiTier> = {
  easy: { random: 0.5, caution: 0 },
  medium: { random: 0.15, caution: 0.5 },
  hard: { random: 0, caution: 1 },
  expert: { random: 0, caution: 1.4 },
};

/** How likely a piece on `cell` is to be hit next turn by anyone on the other side. */
function danger(state: PachisiState, seat: Seat, cell: PachisiCell): number {
  if (isCastle(cell)) return 0;
  let chance = 0;
  const key = cellKey(cell);
  for (let s = 0; s < state.players; s++) {
    if (state.partners(s, seat)) continue;
    for (const [value, odds] of Object.entries(PACHISI_ODDS)) {
      const v = Number(value);
      if (state.pieces[s]!.some((at) => at >= 0 && at + v < PACHISI_HOME && cellKey(pachisiCell(state.arm(s), at + v)) === key)) chance += odds;
    }
  }
  return Math.min(1, chance);
}

function scoreMove(state: PachisiState, seat: Seat, move: PachisiMove, tier: PachisiTier): number {
  const next = state.apply(move);
  const event = next.last!;
  if (next.result) return 1e6;
  let score = event.to - Math.max(0, event.from);
  if (move === 'e') score += 30;
  if (event.to === PACHISI_HOME) score += 40;
  score += event.captured.reduce((sum, [s, p]) => sum + 25 + Math.max(0, state.pieces[s]![p]!), 0);
  if (event.to < PACHISI_HOME) {
    const cell = pachisiCell(state.arm(seat), event.to);
    if (isCastle(cell)) score += 6;
    score -= tier.caution * danger(next, seat, cell) * (event.to + 20);
  }
  if (event.from >= 0) score += tier.caution * danger(state, seat, pachisiCell(state.arm(seat), event.from)) * (event.from + 20) * 0.6;
  return score;
}

export function choosePachisiMove(state: PachisiState, seat: Seat, tier: PachisiTier, rng: Rng): PachisiMove {
  const moves = state.legalMoves(seat);
  if (moves.length === 1) return moves[0]!;
  if (rng.next() < tier.random) return rng.pick(moves);
  const scored = moves.map((move) => ({ move, score: scoreMove(state, seat, move, tier) }));
  const best = Math.max(...scored.map((s) => s.score));
  return rng.pick(scored.filter((s) => s.score === best)).move;
}

export const pachisi: GameDefinition<PachisiMove> = {
  id: 'pachisi',
  name: 'Pachisi',
  minPlayers: 2,
  maxPlayers: 4,
  modes: ['bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: false,
  realtime: false,
  newGame: (config, seed) => newPachisi(seed, Math.max(2, Math.min(4, config.players))),
  createBot: (tier): Bot<PachisiMove> => ({
    chooseMove: (state, seat, rng) => choosePachisiMove(state as PachisiState, seat, PACHISI_TIERS[tier], rng),
  }),
  encodeMove: (move) => move,
};

/**
 * Where a square sits on the 19 by 19 grid of the cross, the middle at (9, 9). Arm 0 points down
 * with its `next` column on the right; each arm after it is the one before turned a quarter
 * counter-clockwise, so the path goes round the board counter-clockwise on screen.
 */
export function pachisiGrid(cell: PachisiCell): { x: number; y: number } {
  let dx = cell.col === 'prev' ? -1 : cell.col === 'next' ? 1 : 0;
  let dy = 2 + cell.row;
  for (let i = 0; i < cell.arm; i++) [dx, dy] = [dy, -dx];
  return { x: 9 + dx, y: 9 + dy };
}
