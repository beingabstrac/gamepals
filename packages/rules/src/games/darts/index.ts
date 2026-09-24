import type { Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Darts (docs/games/darts.md): 301 or 501, double out, three darts a turn. The move is where a dart
 * lands, in millimetres from the bull (y downwards), so a person's sway lives in the scene and a
 * bot's shake in its tier; the rules score the board and keep the count, busts included.
 */
export type DartsLevel = '301' | '501';
export const DARTS_LEVELS: readonly DartsLevel[] = ['301', '501'];

/** The numbers clockwise from the top. */
export const DART_SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5] as const;
/** Ring edges in millimetres from the middle. */
export const DART_RINGS = { bull: 6.35, outerBull: 15.9, trebleIn: 99, trebleOut: 107, doubleIn: 162, doubleOut: 170 } as const;
/** How far from the middle a dart may land (the edge of the board's face). */
export const DART_LIMIT = 225;
export const DARTS_PER_TURN = 3;

export interface DartBed {
  /** The number (25 for the bull), how many times it counts, and the points. */
  readonly base: number;
  readonly mult: 0 | 1 | 2 | 3;
  readonly points: number;
}

/** What a dart at (x, y) mm scores. A dart on a wire takes the bed it is inside. */
export function dartScore(x: number, y: number): DartBed {
  const r = Math.hypot(x, y);
  if (r <= DART_RINGS.bull) return { base: 25, mult: 2, points: 50 };
  if (r <= DART_RINGS.outerBull) return { base: 25, mult: 1, points: 25 };
  if (r > DART_RINGS.doubleOut) return { base: 0, mult: 0, points: 0 };
  // Clockwise from straight up, with the 20 centred on the top.
  const deg = (((Math.atan2(x, -y) * 180) / Math.PI + 9) % 360 + 360) % 360;
  const base = DART_SECTORS[Math.floor(deg / 18) % 20]!;
  const mult = r > DART_RINGS.doubleIn ? 2 : r > DART_RINGS.trebleIn && r <= DART_RINGS.trebleOut ? 3 : 1;
  return { base, mult, points: base * mult };
}

export const bedLabel = (b: DartBed): string =>
  b.mult === 0 ? 'Miss' : b.base === 25 ? (b.mult === 2 ? 'Bull' : '25') : `${b.mult === 3 ? 'T' : b.mult === 2 ? 'D' : ''}${b.base}`;

/** A bed to aim for: the number and how many times. */
export interface DartTarget {
  readonly base: number;
  readonly mult: 1 | 2 | 3;
}

/** The middle of a bed, where anyone would aim for it. Singles aim at the big outer single. */
export function dartAim(t: DartTarget): { x: number; y: number } {
  if (t.base === 25) return t.mult === 2 ? { x: 0, y: 0 } : { x: 0, y: -11 };
  const r = t.mult === 3 ? 103 : t.mult === 2 ? 166 : 134;
  const a = (DART_SECTORS.indexOf(t.base as (typeof DART_SECTORS)[number]) * 18 * Math.PI) / 180;
  return { x: Math.round(r * Math.sin(a)), y: Math.round(-r * Math.cos(a)) };
}

const ALL_TARGETS: readonly DartTarget[] = [
  ...[20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].flatMap((n) => [
    { base: n, mult: 1 as const },
    { base: n, mult: 3 as const },
    { base: n, mult: 2 as const },
  ]),
  { base: 25, mult: 1 },
  { base: 25, mult: 2 },
];
/** Doubles players like to finish on, best first: the ones that halve down to other doubles. */
const FAVOURITE = [20, 16, 18, 12, 10, 8, 14, 6, 4, 2, 19, 17, 15, 13, 11, 9, 7, 5, 3, 1, 25];
const points = (t: DartTarget) => t.base * t.mult;

/**
 * The darts that finish `score` within `darts` throws, ending on a double; null if it cannot be
 * done. Fewest darts first, then a single rather than a treble to set up, then a favourite double.
 */
export function dartCheckout(score: number, darts: number): DartTarget[] | null {
  if (score < 2 || score > 170 || darts < 1) return null;
  const doubles = FAVOURITE.map((n) => ({ base: n, mult: 2 as const }));
  const finish = (s: number) => doubles.find((d) => points(d) === s) ?? null;
  const one = finish(score);
  if (one) return [one];
  if (darts < 2) return null;
  // Setting up: a single first where one will do, then a treble; bulls last.
  const setters = [...ALL_TARGETS].sort((a, b) => (a.mult === 1 ? 0 : a.mult === 3 ? 1 : 2) - (b.mult === 1 ? 0 : b.mult === 3 ? 1 : 2) || points(b) - points(a));
  let best: DartTarget[] | null = null;
  const rank = (route: DartTarget[]) => FAVOURITE.indexOf(route[route.length - 1]!.base);
  for (const s of setters) {
    const d = finish(score - points(s));
    if (d && (!best || rank([s, d]) < rank(best))) best = [s, d];
  }
  if (best || darts < 3) return best;
  // Three darts: the biggest first dart that leaves a two-dart finish.
  for (const s of [...ALL_TARGETS].sort((a, b) => points(b) - points(a))) {
    const rest = dartCheckout(score - points(s), 2);
    if (rest && rest.length === 2) return [s, ...rest];
  }
  return null;
}

export interface DartThrow {
  readonly seat: Seat;
  readonly at: { readonly x: number; readonly y: number };
  readonly bed: DartBed;
  readonly bust: boolean;
  /** The last dart of a turn (the third, a bust, or the finish). */
  readonly turnEnd: boolean;
}

/** `x,y`: where the dart lands, in whole millimetres from the bull, y downwards. */
export type DartsMove = string;
export const dartMove = (x: number, y: number): DartsMove => `${Math.round(x)},${Math.round(y)}`;
export function parseDart(move: string): { x: number; y: number } | null {
  const m = /^(-?\d{1,3}),(-?\d{1,3})$/.exec(move);
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
}

export class DartsState implements GameState<DartsMove> {
  constructor(
    readonly start: number,
    readonly scores: readonly number[],
    readonly currentSeat: Seat,
    /** The score the current player had when this turn began: a bust goes back to it. */
    readonly turnStart: number,
    readonly thrown: number,
    readonly darts: readonly number[],
    readonly throws: readonly DartThrow[],
    readonly result: GameResult | null,
  ) {}

  get players(): number {
    return this.scores.length;
  }

  get last(): DartThrow | null {
    return this.throws[this.throws.length - 1] ?? null;
  }

  allows(move: DartsMove): boolean {
    const p = parseDart(move);
    return !this.result && p !== null && Math.abs(p.x) <= DART_LIMIT && Math.abs(p.y) <= DART_LIMIT;
  }

  /** The middle of every bed, and one off the board: for bots and tests. `allows` is the whole truth. */
  legalMoves(seat: Seat): readonly DartsMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    return [...ALL_TARGETS.map((t) => dartAim(t)), { x: 0, y: -200 }].map((p) => dartMove(p.x, p.y));
  }

  apply(move: DartsMove): DartsState {
    if (!this.allows(move)) throw new Error(`Illegal move: ${move}`);
    const at = parseDart(move)!;
    const seat = this.currentSeat;
    const bed = dartScore(at.x, at.y);
    const left = this.scores[seat]! - bed.points;
    const bust = left < 0 || left === 1 || (left === 0 && bed.mult !== 2);
    const won = left === 0 && !bust;
    const thrown = this.thrown + 1;
    const turnEnd = bust || won || thrown === DARTS_PER_TURN;
    const scores = this.scores.map((s, i) => (i === seat ? (bust ? this.turnStart : left) : s));
    const darts = this.darts.map((d, i) => (i === seat ? d + 1 : d));
    const throws = [...this.throws, { seat, at, bed, bust, turnEnd }];
    if (won) return new DartsState(this.start, scores, seat, 0, thrown, darts, throws, { winners: [seat], draw: false });
    if (!turnEnd) return new DartsState(this.start, scores, seat, this.turnStart, thrown, darts, throws, null);
    const next = ((seat + 1) % this.players) as Seat;
    return new DartsState(this.start, scores, next, scores[next]!, 0, darts, throws, null);
  }
}

export function newDarts(players: number, level: DartsLevel = '301'): DartsState {
  const start = Number(level);
  return new DartsState(
    start,
    Array.from({ length: players }, () => start),
    0,
    start,
    0,
    Array.from({ length: players }, () => 0),
    [],
    null,
  );
}

/** What a player would go for with this score and these darts left in the turn. */
export function dartPlan(score: number, dartsLeft: number): DartTarget {
  const route = dartCheckout(score, dartsLeft);
  if (route) return route[0]!;
  if (score > 100) return { base: 20, mult: 3 };
  // No finish this turn: a single that leaves a double to go for, a favourite one if possible.
  for (const d of FAVOURITE) {
    const s = score - d * 2;
    if (s >= 1 && s <= 20) return { base: s, mult: 1 };
  }
  return { base: 20, mult: 1 };
}

/** The spread of a throw, in millimetres either way (one standard deviation). */
const TIERS: Record<BotTier, number> = { easy: 42, medium: 26, hard: 16, expert: 10 };

function createDartsBot(tier: BotTier): Bot<DartsMove> {
  const spread = TIERS[tier];
  return {
    chooseMove(generic: GameState<DartsMove>, _seat: Seat, rng: Rng): DartsMove {
      const s = generic as DartsState;
      const aim = dartAim(dartPlan(s.scores[s.currentSeat]!, DARTS_PER_TURN - s.thrown));
      // Three draws summed is close enough to a bell curve for an arm.
      const shake = () => (rng.next() + rng.next() + rng.next() - 1.5) * 2 * spread;
      const clamp = (v: number) => Math.max(-DART_LIMIT, Math.min(DART_LIMIT, v));
      return dartMove(clamp(aim.x + shake()), clamp(aim.y + shake()));
    },
  };
}

const isLevel = (v: string | undefined): v is DartsLevel => DARTS_LEVELS.includes(v as DartsLevel);

export const darts: GameDefinition<DartsMove> = {
  id: 'darts',
  name: 'Darts',
  minPlayers: 1,
  maxPlayers: 4,
  modes: ['solo', 'bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: false,
  realtime: false,
  newGame: (config, _seed) => newDarts(Math.max(1, Math.min(4, config.players)), isLevel(config.variant) ? config.variant : '301'),
  createBot: (tier) => createDartsBot(tier),
  encodeMove: (move) => move,
  decodeMove: (key) => (parseDart(key) ? key : null),
};
