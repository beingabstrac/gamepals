import type { Rng } from '../../core/rng';
import { createRng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Token progress:
 *   -1        in the yard
 *   0–50      on the shared track (0 = the color's own start square)
 *   51–55     in the color's home column (safe)
 *   56        home (finished)
 */
export const YARD = -1;
export const LAST_TRACK = 50;
export const HOME = 56;
export const TRACK_LENGTH = 52;
export const TOKENS_PER_PLAYER = 4;
const START_OFFSET = 13;

/** Start squares and star squares (absolute track index) where tokens can't be captured. */
export const SAFE_SQUARES: ReadonlySet<number> = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

/** Board color per seat (0 red, 1 green, 2 yellow, 3 blue); two players sit opposite each other. */
export const COLORS_BY_PLAYERS: Readonly<Record<number, readonly number[]>> = {
  2: [0, 2],
  3: [0, 1, 2],
  4: [0, 1, 2, 3],
};

/** Roll the die, or move the token with this index (0–3). */
export type LudoMove = 'roll' | number;

export interface LudoCapture {
  readonly seat: Seat;
  readonly token: number;
  readonly from: number;
}

/** What the last token move did, so views can animate it. */
export interface LudoEvent {
  readonly seat: Seat;
  readonly token: number;
  readonly from: number;
  readonly to: number;
  readonly captured: readonly LudoCapture[];
}

export function absoluteSquare(color: number, progress: number): number | null {
  if (progress < 0 || progress > LAST_TRACK) return null;
  return (color * START_OFFSET + progress) % TRACK_LENGTH;
}

/** Die value for the n-th roll of a game: fixed by the seed so games replay exactly. */
export function dieValue(seed: number, rollIndex: number): number {
  return createRng((seed ^ Math.imul(rollIndex + 1, 0x9e3779b1)) >>> 0).int(6) + 1;
}

export class LudoState implements GameState<LudoMove> {
  constructor(
    readonly players: number,
    readonly seed: number,
    readonly tokens: readonly (readonly number[])[],
    readonly currentSeat: Seat,
    readonly phase: 'roll' | 'move',
    /** Last rolled value (kept after the move so views can show it). */
    readonly dice: number | null,
    readonly rollCount: number,
    readonly result: GameResult | null,
    readonly lastEvent: LudoEvent | null,
  ) {}

  colorOf(seat: Seat): number {
    const color = COLORS_BY_PLAYERS[this.players]?.[seat];
    if (color === undefined) throw new Error(`No seat ${seat} with ${this.players} players`);
    return color;
  }

  /** Tokens `seat` could move with `value`: leaving the yard needs a 6; finishing needs an exact roll. */
  movableTokens(seat: Seat, value: number): number[] {
    const movable: number[] = [];
    (this.tokens[seat] ?? []).forEach((progress, index) => {
      if (progress === YARD ? value === 6 : progress !== HOME && progress + value <= HOME) movable.push(index);
    });
    return movable;
  }

  legalMoves(seat: Seat): readonly LudoMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    if (this.phase === 'roll') return ['roll'];
    return this.movableTokens(seat, this.dice ?? 0);
  }

  apply(move: LudoMove): LudoState {
    if (this.result) throw new Error('Game is over');
    return move === 'roll' ? this.roll() : this.moveToken(move);
  }

  private nextSeat(): Seat {
    return (this.currentSeat + 1) % this.players;
  }

  private roll(): LudoState {
    if (this.phase !== 'roll') throw new Error('Move a token before rolling again');
    const value = dieValue(this.seed, this.rollCount);
    const canMove = this.movableTokens(this.currentSeat, value).length > 0;
    return new LudoState(
      this.players,
      this.seed,
      this.tokens,
      canMove ? this.currentSeat : this.nextSeat(),
      canMove ? 'move' : 'roll',
      value,
      this.rollCount + 1,
      null,
      null,
    );
  }

  private moveToken(token: number): LudoState {
    if (this.phase !== 'move' || this.dice === null) throw new Error('Roll first');
    const seat = this.currentSeat;
    const value = this.dice;
    if (!Number.isInteger(token) || !this.movableTokens(seat, value).includes(token)) {
      throw new Error(`Illegal move: ${token}`);
    }

    const from = this.tokens[seat]![token]!;
    const to = from === YARD ? 0 : from + value;
    const tokens = this.tokens.map((list) => list.slice());
    tokens[seat]![token] = to;

    const captured: LudoCapture[] = [];
    const square = absoluteSquare(this.colorOf(seat), to);
    if (square !== null && !SAFE_SQUARES.has(square)) {
      tokens.forEach((list, other) => {
        if (other === seat) return;
        list.forEach((progress, index) => {
          if (absoluteSquare(this.colorOf(other), progress) === square) {
            captured.push({ seat: other, token: index, from: progress });
            list[index] = YARD;
          }
        });
      });
    }

    const event: LudoEvent = { seat, token, from, to, captured };
    if (tokens[seat]!.every((progress) => progress === HOME)) {
      return new LudoState(this.players, this.seed, tokens, seat, 'roll', value, this.rollCount, { winners: [seat], draw: false }, event);
    }
    // A six, a capture or bringing a token home earns another roll.
    const again = value === 6 || captured.length > 0 || to === HOME;
    return new LudoState(this.players, this.seed, tokens, again ? seat : this.nextSeat(), 'roll', value, this.rollCount, null, event);
  }
}

/** Opponent tokens that could land on `square` with a single roll. */
function threatsTo(state: LudoState, seat: Seat, square: number): number {
  let threats = 0;
  state.tokens.forEach((list, other) => {
    if (other === seat) return;
    const color = state.colorOf(other);
    for (const progress of list) {
      if (progress === YARD) {
        if (absoluteSquare(color, 0) === square) threats++;
        continue;
      }
      const from = absoluteSquare(color, progress);
      if (from === null) continue;
      const distance = (square - from + TRACK_LENGTH) % TRACK_LENGTH;
      if (distance >= 1 && distance <= 6 && progress + distance <= LAST_TRACK) threats++;
    }
  });
  return threats;
}

interface LudoTier {
  readonly randomMoveRate: number;
  /** How much the bot fears landing where it can be captured (0 = ignores danger). */
  readonly caution: number;
  readonly aggression: number;
}

const TIERS: Record<BotTier, LudoTier> = {
  easy: { randomMoveRate: 0.5, caution: 0, aggression: 0.5 },
  medium: { randomMoveRate: 0.2, caution: 0.6, aggression: 1 },
  hard: { randomMoveRate: 0.05, caution: 1, aggression: 1 },
  expert: { randomMoveRate: 0, caution: 1.4, aggression: 1.2 },
};

function scoreMove(state: LudoState, seat: Seat, token: number, tier: LudoTier): number {
  const next = state.apply(token);
  const event = next.lastEvent!;
  const color = state.colorOf(seat);
  let score = event.to - Math.max(event.from, 0);

  score += tier.aggression * event.captured.reduce((sum, c) => sum + 40 + c.from, 0);
  if (event.to === HOME) score += 60;
  if (event.from === YARD) score += 35;
  if (event.to > LAST_TRACK && event.from <= LAST_TRACK) score += 25;

  const landing = absoluteSquare(color, event.to);
  if (landing !== null) {
    if (SAFE_SQUARES.has(landing)) score += 8;
    else score -= tier.caution * 18 * threatsTo(next, seat, landing);
  }
  const leaving = absoluteSquare(color, event.from);
  if (leaving !== null && !SAFE_SQUARES.has(leaving)) {
    score += tier.caution * 12 * threatsTo(state, seat, leaving);
  }
  return score;
}

function createLudoBot(tier: LudoTier): Bot<LudoMove> {
  return {
    chooseMove(generic: GameState<LudoMove>, seat: Seat, rng: Rng): LudoMove {
      const state = generic as LudoState;
      const moves = state.legalMoves(seat);
      if (moves.length === 0) throw new Error('No legal moves');
      if (moves[0] === 'roll') return 'roll';
      if (rng.next() < tier.randomMoveRate) return rng.pick(moves);
      const scored = moves.map((move) => ({ move, score: scoreMove(state, seat, move as number, tier) }));
      const best = Math.max(...scored.map((s) => s.score));
      return rng.pick(scored.filter((s) => s.score === best)).move;
    },
  };
}

export const ludo: GameDefinition<LudoMove> = {
  id: 'ludo',
  name: 'Ludo',
  minPlayers: 2,
  maxPlayers: 4,
  modes: ['bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: false,
  realtime: false,
  newGame: (config, seed) => {
    if (!COLORS_BY_PLAYERS[config.players]) throw new Error(`Ludo needs 2–4 players, got ${config.players}`);
    const tokens = Array.from({ length: config.players }, () => Array<number>(TOKENS_PER_PLAYER).fill(YARD));
    return new LudoState(config.players, seed >>> 0, tokens, 0, 'roll', null, 0, null, null);
  },
  createBot: (tier) => createLudoBot(TIERS[tier]),
  encodeMove: (move) => String(move),
};
