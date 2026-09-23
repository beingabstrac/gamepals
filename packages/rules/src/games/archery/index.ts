import type { Rng } from '../../core/rng';
import { createRng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/** Archery: ends of three arrows at a ten-ring face, wind to read (docs/games/archery.md). */
export type ArcheryRange = 'near' | 'mid' | 'far';
export const ARCHERY_RANGES: readonly ArcheryRange[] = ['near', 'mid', 'far'];
export const RANGE_METRES: Record<ArcheryRange, number> = { near: 30, mid: 50, far: 70 };

/** How far one m/s of wind carries an arrow at each range, in millimetres on the face. */
const DRIFT: Record<ArcheryRange, number> = { near: 14, mid: 26, far: 40 };

/** The outdoor face: 122cm across, ten rings each 61mm wide, and the X inside the 10. */
export const FACE_R = 610;
export const RING_W = 61;
export const X_R = 30.5;
/** How far from the middle an aim may be, either way: a little past the face, so a wild one can miss. */
export const AIM_LIMIT = 900;
export const ENDS = 3;
export const ARROWS_PER_END = 3;

/** An aim: `x,y` in whole millimetres from the middle of the face, y downwards. */
export type ArcheryMove = string;
export const aimMove = (x: number, y: number): ArcheryMove => `${x},${y}`;

export function parseAim(move: string): { x: number; y: number } | null {
  const m = /^(-?\d+),(-?\d+)$/.exec(move);
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
}

/** The wind for one arrow, in whole m/s each way (positive x blows to the right, positive y down). */
export interface Wind {
  readonly x: number;
  readonly y: number;
}

export interface Hit {
  readonly player: Seat;
  readonly aim: { readonly x: number; readonly y: number };
  readonly at: { readonly x: number; readonly y: number };
  readonly score: number;
  readonly x10: boolean;
}

/** The ring an arrow at `r` millimetres from the middle scores; an arrow on a line takes the higher. */
export function ringScore(r: number): number {
  if (r > FACE_R) return 0;
  return Math.min(10, 11 - Math.ceil(r / RING_W));
}

export class ArcheryState implements GameState<ArcheryMove> {
  constructor(
    readonly range: ArcheryRange,
    readonly players: number,
    /** The wind for every arrow of the match, in shooting order, dealt from the seed. */
    readonly winds: readonly Wind[],
    readonly hits: readonly Hit[],
    readonly result: GameResult | null,
  ) {}

  get arrows(): number {
    return ENDS * ARROWS_PER_END * this.players;
  }

  /** Players take turns an arrow at a time. */
  get currentSeat(): Seat {
    return this.hits.length % this.players;
  }

  /** The wind for the arrow about to be shot. */
  get wind(): Wind {
    return this.winds[Math.min(this.hits.length, this.winds.length - 1)]!;
  }

  /** Which end is being shot, from 0. */
  get end(): number {
    return Math.min(ENDS - 1, Math.floor(this.hits.length / (ARROWS_PER_END * this.players)));
  }

  /** Where the wind will carry an arrow aimed at the middle, in millimetres. */
  drift(wind: Wind = this.wind): { x: number; y: number } {
    return { x: wind.x * DRIFT[this.range], y: wind.y * DRIFT[this.range] };
  }

  total(player: Seat): number {
    return this.hits.reduce((sum, hit) => (hit.player === player ? sum + hit.score : sum), 0);
  }

  tens(player: Seat): number {
    return this.hits.filter((hit) => hit.player === player && hit.score === 10).length;
  }

  xs(player: Seat): number {
    return this.hits.filter((hit) => hit.player === player && hit.x10).length;
  }

  allows(move: ArcheryMove): boolean {
    if (this.result) return false;
    const aim = parseAim(move);
    return aim !== null && Math.abs(aim.x) <= AIM_LIMIT && Math.abs(aim.y) <= AIM_LIMIT;
  }

  /** A grid of aims over the face, for bots and tests; `allows` is the whole truth. */
  legalMoves(seat: Seat): readonly ArcheryMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    const moves: ArcheryMove[] = [];
    for (let y = -800; y <= 800; y += 100) for (let x = -800; x <= 800; x += 100) moves.push(aimMove(x, y));
    return moves;
  }

  apply(move: ArcheryMove): ArcheryState {
    if (!this.allows(move)) throw new Error(`Illegal move: ${move}`);
    const aim = parseAim(move)!;
    const drift = this.drift();
    const at = { x: aim.x + drift.x, y: aim.y + drift.y };
    const r = Math.sqrt(at.x * at.x + at.y * at.y);
    const hit: Hit = { player: this.currentSeat, aim, at, score: ringScore(r), x10: r <= X_R };
    const hits = [...this.hits, hit];
    const next = new ArcheryState(this.range, this.players, this.winds, hits, null);
    if (hits.length < this.arrows) return next;
    return new ArcheryState(this.range, this.players, this.winds, hits, resultOf(next));
  }
}

/** Highest total wins; then most 10s; then most Xs; a tie on all three is shared. */
function resultOf(state: ArcheryState): GameResult {
  const seats = Array.from({ length: state.players }, (_, i) => i);
  const key = (p: Seat) => [state.total(p), state.tens(p), state.xs(p)];
  const best = seats.reduce((a, b) => {
    const [ka, kb] = [key(a), key(b)];
    for (let i = 0; i < 3; i++) if (ka[i] !== kb[i]) return ka[i]! > kb[i]! ? a : b;
    return a;
  });
  const winners = seats.filter((p) => key(p).every((v, i) => v === key(best)[i]));
  return { winners, draw: state.players > 1 && winners.length === state.players };
}

export function newArchery(seed: number, range: ArcheryRange, players: number): ArcheryState {
  const rng = createRng(seed);
  const winds: Wind[] = [];
  for (let i = 0; i < ENDS * ARROWS_PER_END * players; i++) {
    // Mostly a cross-wind of up to 6 m/s, and a little up or down.
    winds.push({ x: rng.int(13) - 6, y: rng.int(5) - 2 });
  }
  return new ArcheryState(range, players, winds, [], null);
}

/** How well a tier reads the wind (the share of it it aims off for), and how much its arm shakes (mm). */
const TIERS: Record<BotTier, { readonly read: number; readonly shake: number }> = {
  easy: { read: 0.3, shake: 380 },
  medium: { read: 0.7, shake: 200 },
  hard: { read: 0.9, shake: 130 },
  expert: { read: 1, shake: 75 },
};

/** A bot aims off for the wind as well as its tier reads it, and its arm shakes like anyone's. */
function createArcheryBot(tier: BotTier): Bot<ArcheryMove> {
  const { read, shake } = TIERS[tier];
  return {
    chooseMove(generic: GameState<ArcheryMove>, _seat: Seat, rng: Rng): ArcheryMove {
      const state = generic as ArcheryState;
      const drift = state.drift();
      // Three draws summed is close enough to a bell curve for an arm.
      const wobble = () => (rng.next() + rng.next() + rng.next() - 1.5) * shake;
      const clamp = (v: number) => Math.max(-AIM_LIMIT, Math.min(AIM_LIMIT, Math.round(v)));
      return aimMove(clamp(-drift.x * read + wobble()), clamp(-drift.y * read + wobble()));
    },
  };
}

const isRange = (value: string | undefined): value is ArcheryRange => ARCHERY_RANGES.includes(value as ArcheryRange);

export const archery: GameDefinition<ArcheryMove> = {
  id: 'archery',
  name: 'Archery',
  minPlayers: 1,
  maxPlayers: 4,
  modes: ['solo', 'bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: false,
  realtime: false,
  newGame: (config, seed) => newArchery(seed, isRange(config.variant) ? config.variant : 'near', Math.max(1, Math.min(4, config.players))),
  createBot: (tier) => createArcheryBot(tier),
  encodeMove: (move) => move,
  decodeMove: (key) => (parseAim(key) ? key : null),
};
