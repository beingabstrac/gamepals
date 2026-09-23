import type { Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';
import { HOLES, roll, type Hole, type Spot, type StrokeOutcome } from './course';

export { COURSE_H, COURSE_W, CUP_R, GOLF_R, HOLES, inside, type Hole, type Outline, type Spot, type StrokeEvent, type StrokeOutcome } from './course';

/** Mini Golf: fewest strokes round the course (docs/games/mini-golf.md). */
export type GolfLength = 'short' | 'full';
export const GOLF_LENGTHS: readonly GolfLength[] = ['short', 'full'];
/** Which holes each length plays: three with something on each, or all nine. */
export const GOLF_ROUNDS: Record<GolfLength, readonly number[]> = { short: [1, 3, 5], full: [0, 1, 2, 3, 4, 5, 6, 7, 8] };

/** A stroke: `a<dx>,<dy>` a direction as two whole numbers, and `p<power>` from 1 to 100. */
export type GolfMove = string;
export const GOLF_MAX_POWER = 100;
/** A firm putt at full power, in m/s. */
const TOP_SPEED = 3.4;
const MAX_AIM = 40_000;
/** Strokes before you pick up; the hole is then scored one more. */
export const STROKE_CAP = 6;

export const strokeMove = (dx: number, dy: number, power: number): GolfMove => `a${dx},${dy}p${power}`;

export function parseStroke(move: string): { dx: number; dy: number; power: number } | null {
  const m = /^a(-?\d+),(-?\d+)p(\d+)$/.exec(move);
  if (!m) return null;
  return { dx: Number(m[1]), dy: Number(m[2]), power: Number(m[3]) };
}

export interface StrokeReport {
  readonly player: Seat;
  readonly hole: number;
  readonly from: Spot;
  readonly outcome: StrokeOutcome;
  /** The ball went in the water: a stroke's penalty, and it goes back where it was hit from. */
  readonly penalty: boolean;
  /** The player picked up at the cap without holing out. */
  readonly pickedUp: boolean;
}

export class GolfState implements GameState<GolfMove> {
  constructor(
    readonly length: GolfLength,
    readonly players: number,
    /** Which of the round's holes is being played, 0 up. */
    readonly holeIndex: number,
    readonly currentSeat: Seat,
    /** Where the current player's ball is. */
    readonly ball: Spot,
    /** Strokes on each hole of the round, for each player: `cards[player][hole]`, 0 until played. */
    readonly cards: readonly (readonly number[])[],
    /** Strokes so far on this hole for the current player. */
    readonly strokes: number,
    readonly result: GameResult | null,
    readonly last: StrokeReport | null,
  ) {}

  get round(): readonly number[] {
    return GOLF_ROUNDS[this.length];
  }

  get hole(): Hole {
    return HOLES[this.round[this.holeIndex]!]!;
  }

  total(player: Seat): number {
    return this.cards[player]!.reduce((sum, n) => sum + n, 0);
  }

  /** Par for the holes played so far by `player`, to read a total against. */
  parSoFar(player: Seat): number {
    return this.cards[player]!.reduce((sum, n, i) => (n > 0 ? sum + HOLES[this.round[i]!]!.par : sum), 0);
  }

  allows(move: GolfMove): boolean {
    if (this.result) return false;
    const stroke = parseStroke(move);
    if (!stroke) return false;
    if (stroke.dx === 0 && stroke.dy === 0) return false;
    if (Math.abs(stroke.dx) > MAX_AIM || Math.abs(stroke.dy) > MAX_AIM) return false;
    return Number.isInteger(stroke.power) && stroke.power >= 1 && stroke.power <= GOLF_MAX_POWER;
  }

  /** A spread of strokes round the compass at three powers, for bots and tests; `allows` is the whole truth. */
  legalMoves(seat: Seat): readonly GolfMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    const moves: GolfMove[] = [];
    for (let i = -8; i < 8; i++) {
      for (const [dx, dy] of [
        [i * 1000, -8000],
        [8000, i * 1000],
        [-i * 1000, 8000],
        [-8000, -i * 1000],
      ] as const) {
        for (const power of [20, 50, 85]) moves.push(strokeMove(dx, dy, power));
      }
    }
    return moves;
  }

  apply(move: GolfMove): GolfState {
    if (!this.allows(move)) throw new Error(`Illegal move: ${move}`);
    return this.hit(parseStroke(move)!, true);
  }

  /** Plays a stroke out and moves the round on. `frames` is off when a bot is only looking. */
  hit(stroke: { dx: number; dy: number; power: number }, frames: boolean): GolfState {
    const length = Math.sqrt(stroke.dx * stroke.dx + stroke.dy * stroke.dy);
    const speed = (TOP_SPEED * stroke.power) / GOLF_MAX_POWER;
    const outcome = roll(this.hole, this.ball, (stroke.dx / length) * speed, (stroke.dy / length) * speed, frames);
    const penalty = outcome.end === 'water';
    const strokes = this.strokes + 1 + (penalty ? 1 : 0);
    const holed = outcome.end === 'cup';
    const pickedUp = !holed && strokes >= STROKE_CAP;
    const report: StrokeReport = { player: this.currentSeat, hole: this.holeIndex, from: this.ball, outcome, penalty, pickedUp };
    if (!holed && !pickedUp) {
      const ball = penalty ? this.ball : outcome.at;
      return new GolfState(this.length, this.players, this.holeIndex, this.currentSeat, ball, this.cards, strokes, null, report);
    }
    // This player is done with the hole: write it down and hand over.
    const score = holed ? strokes : STROKE_CAP + 1;
    const cards = this.cards.map((card, player) => (player === this.currentSeat ? card.map((n, i) => (i === this.holeIndex ? score : n)) : card));
    let seat = this.currentSeat + 1;
    let holeIndex = this.holeIndex;
    if (seat >= this.players) {
      seat = 0;
      holeIndex++;
    }
    if (holeIndex >= this.round.length) {
      const totals = cards.map((card) => card.reduce((sum, n) => sum + n, 0));
      const best = Math.min(...totals);
      const winners = totals.flatMap((t, i) => (t === best ? [i] : []));
      const result: GameResult = { winners, draw: this.players > 1 && winners.length === this.players };
      // The last card is in; the finished state keeps the last player's count rather than zeroing it.
      return new GolfState(this.length, this.players, this.holeIndex, this.currentSeat, outcome.at, cards, strokes, result, report);
    }
    const next = HOLES[this.round[holeIndex]!]!;
    return new GolfState(this.length, this.players, holeIndex, seat, next.tee, cards, 0, null, report);
  }
}

export function newGolf(length: GolfLength, players: number): GolfState {
  const round = GOLF_ROUNDS[length];
  const cards = Array.from({ length: players }, () => round.map(() => 0));
  return new GolfState(length, players, 0, 0, HOLES[round[0]!]!.tee, cards, 0, null, null);
}

/** How a tier plays: how many directions it tries, which powers, and how much its hand shakes (degrees). */
const TIERS: Record<BotTier, { readonly fan: number; readonly powers: readonly number[]; readonly shake: number }> = {
  easy: { fan: 10, powers: [30, 55], shake: 6 },
  medium: { fan: 20, powers: [25, 40, 60], shake: 3 },
  hard: { fan: 40, powers: [20, 30, 42, 58, 75], shake: 1.2 },
  expert: { fan: 72, powers: [15, 22, 30, 38, 48, 60, 75, 90], shake: 0.3 },
};

/**
 * The bot tries a fan of directions round the line to the cup, at a few powers, with the same roll
 * the course uses, and keeps the one that ends in the cup or nearest it. Its hand shakes by its tier.
 * Angles are fine here: a bot's choice only has to agree with itself on one device, and the stroke it
 * sends is whole numbers like anyone's.
 */
function createGolfBot(tier: BotTier): Bot<GolfMove> {
  const knobs = TIERS[tier];
  return {
    chooseMove(generic: GameState<GolfMove>, _seat: Seat, rng: Rng): GolfMove {
      const state = generic as GolfState;
      const { ball, hole } = state;
      const toCup = Math.atan2(hole.cup.y - ball.y, hole.cup.x - ball.x);
      let best = { angle: toCup, power: knobs.powers[0]!, score: Infinity };
      for (let i = 0; i < knobs.fan; i++) {
        // Half the fan close round the straight line, half all the way round for banks.
        const angle = i < knobs.fan / 2 ? toCup + ((i - knobs.fan / 4) / (knobs.fan / 4)) * 0.35 : toCup + ((i - knobs.fan / 2) / (knobs.fan / 2)) * Math.PI * 2;
        for (const power of knobs.powers) {
          const [dx, dy] = aim(angle);
          const after = state.hit({ dx, dy, power }, false);
          const out = after.last!.outcome;
          const score = out.end === 'cup' ? -1000 + power / 100 : out.end === 'water' ? 5000 : Math.sqrt((out.at.x - hole.cup.x) ** 2 + (out.at.y - hole.cup.y) ** 2);
          if (score < best.score) best = { angle, power, score };
        }
      }
      const shaken = best.angle + ((rng.next() - 0.5) * 2 * knobs.shake * Math.PI) / 180;
      const [dx, dy] = aim(shaken);
      return strokeMove(dx, dy, best.power);
    },
  };
}

function aim(angle: number): [number, number] {
  const dx = Math.round(Math.cos(angle) * 10_000);
  const dy = Math.round(Math.sin(angle) * 10_000);
  return dx === 0 && dy === 0 ? [0, -1] : [dx, dy];
}

const isLength = (value: string | undefined): value is GolfLength => GOLF_LENGTHS.includes(value as GolfLength);

export const miniGolf: GameDefinition<GolfMove> = {
  id: 'mini-golf',
  name: 'Mini Golf',
  minPlayers: 1,
  maxPlayers: 4,
  modes: ['solo', 'bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: false,
  realtime: false,
  newGame: (config, _seed) => newGolf(isLength(config.variant) ? config.variant : 'short', Math.max(1, Math.min(4, config.players))),
  createBot: (tier) => createGolfBot(tier),
  encodeMove: (move) => move,
  decodeMove: (key) => (parseStroke(key) ? key : null),
};
