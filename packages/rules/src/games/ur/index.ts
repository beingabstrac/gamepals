import { createRng, type Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * The Royal Game of Ur (docs/games/ur.md), in Irving Finkel's reading of the rules on the British
 * Museum's tablet: seven pieces each race along a fourteen-square path, four binary dice decide how
 * far, rosettes give another throw, and the shared middle row is where pieces get knocked off.
 */
export const UR_PIECES = 7;
/** Squares along each player's path: 1–4 their own, 5–12 shared, 13–14 their own, 15 is off. */
export const UR_PATH = 14;
export const UR_OFF = UR_PATH + 1;
/** Rosettes on the path: 4 and 14 are private; 8, in the middle of the shared row, is safe too. */
export const UR_ROSETTES: ReadonlySet<number> = new Set([4, 8, 14]);
export const UR_SAFE = 8;
export const isShared = (square: number): boolean => square >= 5 && square <= 12;

/** The four binary dice for throw number `n` of a game: fixed by the seed so games replay exactly. */
export function urDice(seed: number, n: number): readonly [number, number, number, number] {
  const rng = createRng((seed ^ Math.imul(n + 1, 0x85ebca6b)) >>> 0);
  return [rng.int(2), rng.int(2), rng.int(2), rng.int(2)];
}

/** How likely each throw is: four coins, so 0 and 4 are rare and 2 is the usual. */
export const UR_ODDS: readonly number[] = [1 / 16, 4 / 16, 6 / 16, 4 / 16, 1 / 16];

/** `roll`, or `m<from>`: move the piece on square `from` (0 brings a new piece on). */
export type UrMove = string;

export interface UrEvent {
  readonly seat: Seat;
  readonly from: number;
  readonly to: number;
  readonly captured: boolean;
  readonly again: boolean;
}

export class UrState implements GameState<UrMove> {
  constructor(
    readonly seed: number,
    /** Each seat's seven pieces, by square: 0 waiting, 1–14 on the path, 15 off. Sorted. */
    readonly pieces: readonly [readonly number[], readonly number[]],
    readonly currentSeat: Seat,
    readonly phase: 'roll' | 'move',
    /** The last throw, kept after the move so the scene can show the dice. */
    readonly dice: readonly number[] | null,
    readonly throws: number,
    readonly last: UrEvent | null,
    /** The last throw moved nothing (a nought, or nothing could go). */
    readonly passed: boolean,
    readonly result: GameResult | null,
  ) {}

  get value(): number {
    return this.dice ? this.dice.reduce((a, b) => a + b, 0) : 0;
  }

  /** Squares `seat` could move from with a throw of `value`. */
  movable(seat: Seat, value: number): number[] {
    if (value === 0) return [];
    const mine = this.pieces[seat]!;
    const theirs = this.pieces[seat === 0 ? 1 : 0]!;
    const froms = [...new Set(mine.filter((p) => p < UR_OFF))];
    return froms.filter((from) => {
      const to = from + value;
      if (to > UR_OFF) return false;
      if (to === UR_OFF) return true;
      if (mine.includes(to)) return false;
      // The shared rosette is safe: nobody can be knocked off it.
      if (to === UR_SAFE && theirs.includes(to)) return false;
      return true;
    });
  }

  legalMoves(seat: Seat): readonly UrMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    if (this.phase === 'roll') return ['roll'];
    return this.movable(seat, this.value).map((from) => `m${from}`);
  }

  apply(move: UrMove): UrState {
    if (!this.legalMoves(this.currentSeat).includes(move)) throw new Error(`Illegal move: ${move}`);
    const seat = this.currentSeat;
    const other: Seat = seat === 0 ? 1 : 0;
    if (move === 'roll') {
      const dice = urDice(this.seed, this.throws);
      const value = dice.reduce((a: number, b) => a + b, 0);
      const next = new UrState(this.seed, this.pieces, seat, 'move', dice, this.throws + 1, this.last, false, null);
      // Nothing to move: the throw is lost and the turn goes over.
      if (next.movable(seat, value).length === 0) return new UrState(this.seed, this.pieces, other, 'roll', dice, this.throws + 1, this.last, true, null);
      return next;
    }
    const from = Number(move.slice(1));
    const to = from + this.value;
    const mine = this.pieces[seat]!.slice();
    mine[mine.indexOf(from)] = to;
    mine.sort((a, b) => a - b);
    let theirs = this.pieces[other]!;
    // Pieces only meet in the shared row, so that is the only place one can knock another off.
    const captured = isShared(to) && theirs.includes(to);
    if (captured) theirs = theirs.map((p) => (p === to ? 0 : p)).sort((a, b) => a - b);
    const pieces = (seat === 0 ? [mine, theirs] : [theirs, mine]) as [number[], number[]];
    const again = UR_ROSETTES.has(to);
    const won = mine.every((p) => p === UR_OFF);
    const event = { seat, from, to, captured, again };
    if (won) return new UrState(this.seed, pieces, seat, 'roll', this.dice, this.throws, event, false, { winners: [seat], draw: false });
    return new UrState(this.seed, pieces, again ? seat : other, 'roll', this.dice, this.throws, event, false, null);
  }
}

export function newUr(seed: number): UrState {
  const start = Array<number>(UR_PIECES).fill(0);
  return new UrState(seed >>> 0, [start, start], 0, 'roll', null, 0, null, false, null);
}

/** Where the other player's pieces could hit `square` from: the chance they have a throw that lands there. */
export function urDanger(state: UrState, seat: Seat, square: number): number {
  if (!isShared(square) || square === UR_SAFE) return 0;
  const theirs = state.pieces[seat === 0 ? 1 : 0]!;
  let chance = 0;
  for (let value = 1; value <= 4; value++) {
    // Their path runs the same shared squares, so a piece `value` behind can land here.
    if (theirs.some((p) => p === square - value && p < UR_OFF)) chance += UR_ODDS[value]!;
  }
  return Math.min(1, chance);
}

export interface UrTier {
  readonly random: number;
  /** How much a piece left where it can be hit counts against a move. */
  readonly caution: number;
  /** Look at the other player's best reply to every throw they might make. */
  readonly lookahead: boolean;
}

export const UR_TIERS: Record<BotTier, UrTier> = {
  easy: { random: 0.55, caution: 0, lookahead: false },
  medium: { random: 0.2, caution: 0.5, lookahead: false },
  hard: { random: 0, caution: 0.5, lookahead: false },
  expert: { random: 0, caution: 0, lookahead: true },
};

/** A position from `seat`'s side: how far their pieces have got, less how far the other's have. */
export function urValue(state: UrState, seat: Seat, caution: number): number {
  const score = (s: Seat) => {
    let total = 0;
    for (const p of state.pieces[s]!) {
      total += p === UR_OFF ? 18 : p;
      // Holding the middle rosette blocks the shared row for the other player.
      if (p === UR_SAFE) total += 3;
      if (p !== UR_OFF) total -= caution * urDanger(state, s, p) * (p + 3);
    }
    return total;
  };
  const other: Seat = seat === 0 ? 1 : 0;
  return score(seat) - score(other);
}

function greedy(state: UrState, seat: Seat, tier: UrTier): { move: UrMove; value: number }[] {
  return state.legalMoves(seat).map((move) => {
    const next = state.apply(move);
    let value = urValue(next, seat, tier.caution);
    if (next.last?.captured) value += 4;
    if (next.last?.again && !next.result) value += 5;
    if (next.result) value += 1000;
    return { move, value };
  });
}

/** The other player's best reply, averaged over what they might throw. */
function replyValue(state: UrState, seat: Seat, tier: UrTier): number {
  if (state.result) return state.result.winners.includes(seat) ? 1000 : -1000;
  if (state.currentSeat === seat) return urValue(state, seat, tier.caution) + 5;
  const other = state.currentSeat;
  let total = 0;
  for (let value = 0; value <= 4; value++) {
    const odds = UR_ODDS[value]!;
    const froms = state.movable(other, value);
    if (!froms.length) {
      total += odds * urValue(state, seat, tier.caution);
      continue;
    }
    // Their best move for this throw, judged the way they would judge it.
    const rolled = new UrState(state.seed, state.pieces, other, 'move', [value >= 1 ? 1 : 0, value >= 2 ? 1 : 0, value >= 3 ? 1 : 0, value >= 4 ? 1 : 0], state.throws, state.last, false, null);
    let worst = Infinity;
    for (const from of froms) {
      const next = rolled.apply(`m${from}`);
      worst = Math.min(worst, next.result ? -1000 : urValue(next, seat, tier.caution) - (next.last?.captured ? 4 : 0) - (next.last?.again ? 5 : 0));
    }
    total += odds * worst;
  }
  return total;
}

export function chooseUrMove(state: UrState, seat: Seat, tier: UrTier, rng: Rng): UrMove {
  const moves = state.legalMoves(seat);
  if (moves.length === 1) return moves[0]!;
  if (rng.next() < tier.random) return rng.pick(moves);
  const scored = tier.lookahead ? moves.map((move) => ({ move, value: replyValue(state.apply(move), seat, tier) })) : greedy(state, seat, tier);
  const best = Math.max(...scored.map((s) => s.value));
  return rng.pick(scored.filter((s) => s.value === best)).move;
}

export const ur: GameDefinition<UrMove> = {
  id: 'ur',
  name: 'Royal Game of Ur',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: false,
  realtime: false,
  newGame: (_config, seed) => newUr(seed),
  createBot: (tier): Bot<UrMove> => ({
    chooseMove: (state, seat, rng) => chooseUrMove(state as UrState, seat, UR_TIERS[tier], rng),
  }),
  encodeMove: (move) => move,
};
