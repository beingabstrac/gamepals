import { createRng } from '../../core/rng';
import type { BotTier, GameResult, RealtimeGameDefinition, Seat } from '../../core/types';

/**
 * Paint Fight (docs/games/paint-fight.md): two rollers on a floor of tiles, painting as they go.
 * Most tiles at sixty seconds wins. Real time, a pure fixed step like the other duels.
 */
export const PAINT_CANVAS = { width: 600, height: 900 } as const;
export const PAINT_STEP = 1 / 120;
export const PAINT_COLS = 12;
export const PAINT_ROWS = 18;
export const PAINT_TILE = 50;
export const ROLLER_R = 22;
export const PAINT_SECONDS = 60;
/** How far a pot's splat reaches, in tiles, from the tile it sat on. */
export const SPLAT = 2;

const SPEED = 230;
/** How quickly a roller turns toward where it is steered (per second). */
const TURN = 5;
const COUNTDOWN = 1.5;
const POT_EVERY = 7;

export interface Roller {
  readonly x: number;
  readonly y: number;
  /** The way it is going, a unit vector. */
  readonly dx: number;
  readonly dy: number;
}

export interface Pot {
  readonly col: number;
  readonly row: number;
  /** When it appears, seconds into the round. */
  readonly at: number;
}

export type PaintPhase = 'countdown' | 'round' | 'over';

export interface PaintState {
  readonly rollers: readonly [Roller, Roller];
  /** Who owns each tile, row by row: 0, 1, or -1 for bare floor. */
  readonly floor: readonly number[];
  /** The round's pots, from the seed; `taken` marks the ones rolled over. */
  readonly pots: readonly Pot[];
  readonly taken: readonly boolean[];
  readonly phase: PaintPhase;
  readonly clock: number;
  readonly result: GameResult | null;
}

/** Which way to steer, length 0…1, or null to keep going straight. */
export interface PaintInput {
  readonly steer: { readonly x: number; readonly y: number } | null;
}

export interface PaintEvents {
  bump: boolean;
  splat: { seat: Seat; col: number; row: number } | null;
}

export const tileAt = (x: number, y: number): number => {
  const col = Math.max(0, Math.min(PAINT_COLS - 1, Math.floor(x / PAINT_TILE)));
  const row = Math.max(0, Math.min(PAINT_ROWS - 1, Math.floor(y / PAINT_TILE)));
  return row * PAINT_COLS + col;
};

export function newPaint(seed: number): PaintState {
  const rng = createRng(seed);
  const pots: Pot[] = [];
  for (let at = 4; at < PAINT_SECONDS - 3; at += POT_EVERY) pots.push({ col: 2 + rng.int(PAINT_COLS - 4), row: 3 + rng.int(PAINT_ROWS - 6), at: at + rng.next() * 2 });
  return {
    rollers: [
      { x: PAINT_CANVAS.width / 2, y: PAINT_CANVAS.height - 120, dx: 0, dy: -1 },
      { x: PAINT_CANVAS.width / 2, y: 120, dx: 0, dy: 1 },
    ],
    floor: Array<number>(PAINT_COLS * PAINT_ROWS).fill(-1),
    pots,
    taken: pots.map(() => false),
    phase: 'countdown',
    clock: COUNTDOWN,
    result: null,
  };
}

export const countOf = (state: PaintState, seat: Seat): number => state.floor.filter((owner) => owner === seat).length;

function roll(r: Roller, input: PaintInput, dt: number): Roller {
  let { dx, dy } = r;
  if (input.steer) {
    const len = Math.hypot(input.steer.x, input.steer.y);
    if (len > 0.1) {
      // Turn smoothly toward the steer, the way a roller swings round.
      const k = Math.min(1, TURN * dt);
      dx += (input.steer.x / len - dx) * k;
      dy += (input.steer.y / len - dy) * k;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d;
      dy /= d;
    }
  }
  let x = r.x + dx * SPEED * dt;
  let y = r.y + dy * SPEED * dt;
  // Walls: bounce back off them.
  if (x < ROLLER_R || x > PAINT_CANVAS.width - ROLLER_R) {
    dx = -dx;
    x = Math.max(ROLLER_R, Math.min(PAINT_CANVAS.width - ROLLER_R, x));
  }
  if (y < ROLLER_R || y > PAINT_CANVAS.height - ROLLER_R) {
    dy = -dy;
    y = Math.max(ROLLER_R, Math.min(PAINT_CANVAS.height - ROLLER_R, y));
  }
  return { x, y, dx, dy };
}

/** Advances the round by one fixed step. Pure. */
export function stepPaint(state: PaintState, inputs: readonly [PaintInput, PaintInput], dt = PAINT_STEP): { state: PaintState; events: PaintEvents } {
  const events: PaintEvents = { bump: false, splat: null };
  if (state.result) return { state, events };
  if (state.phase === 'countdown') {
    const clock = state.clock - dt;
    return { state: clock > 0 ? { ...state, clock } : { ...state, phase: 'round', clock: 0 }, events };
  }
  let r0 = roll(state.rollers[0], inputs[0], dt);
  let r1 = roll(state.rollers[1], inputs[1], dt);
  const gap = Math.hypot(r1.x - r0.x, r1.y - r0.y);
  if (gap < ROLLER_R * 2 && gap > 0) {
    // A bump: pushed apart, and both sent back the way they came.
    const nx = (r1.x - r0.x) / gap;
    const ny = (r1.y - r0.y) / gap;
    const push = ROLLER_R * 2 - gap;
    r0 = { x: r0.x - (nx * push) / 2, y: r0.y - (ny * push) / 2, dx: -nx, dy: -ny };
    r1 = { x: r1.x + (nx * push) / 2, y: r1.y + (ny * push) / 2, dx: nx, dy: ny };
    events.bump = true;
  }
  const floor = state.floor.slice();
  const clock = state.clock + dt;
  const taken = state.taken.slice();
  [r0, r1].forEach((r, seat) => {
    floor[tileAt(r.x, r.y)] = seat;
    state.pots.forEach((pot, i) => {
      if (taken[i] || pot.at > clock || tileAt(r.x, r.y) !== pot.row * PAINT_COLS + pot.col) return;
      taken[i] = true;
      for (let row = pot.row - SPLAT; row <= pot.row + SPLAT; row++) {
        for (let col = pot.col - SPLAT; col <= pot.col + SPLAT; col++) {
          if (row < 0 || col < 0 || row >= PAINT_ROWS || col >= PAINT_COLS) continue;
          // A round splat: the corners of the square are left dry.
          if (Math.abs(row - pot.row) + Math.abs(col - pot.col) > SPLAT + 1) continue;
          floor[row * PAINT_COLS + col] = seat;
        }
      }
      events.splat = { seat: seat as Seat, col: pot.col, row: pot.row };
    });
  });
  const next: PaintState = { ...state, rollers: [r0, r1], floor, taken, clock };
  if (clock < PAINT_SECONDS) return { state: next, events };
  const a = countOf(next, 0);
  const b = countOf(next, 1);
  const winners: Seat[] = a === b ? [0, 1] : [a > b ? 0 : 1];
  return { state: { ...next, clock: PAINT_SECONDS, phase: 'over', result: { winners, draw: winners.length === 2 } }, events };
}

export interface PaintTier {
  /** Radians of steering error. */
  readonly wobble: number;
  /** How many tiles round it the bot looks for something to paint. */
  readonly sight: number;
  /** How much it prefers the other player's tiles over bare floor. */
  readonly spite: number;
}

export const PAINT_TIERS: Record<BotTier, PaintTier> = {
  easy: { wobble: 0.9, sight: 3, spite: 0 },
  medium: { wobble: 0.5, sight: 5, spite: 0.5 },
  hard: { wobble: 0.25, sight: 7, spite: 1 },
  expert: { wobble: 0.1, sight: 9, spite: 1.5 },
};

/**
 * Bot steering: head for the best tile within sight that is not its own, the other player's first by
 * its spite, and for any pot it can see. `noise` in [-1, 1].
 */
export function paintBotInput(state: PaintState, seat: Seat, tier: PaintTier, noise = 0): PaintInput {
  if (state.phase !== 'round') return { steer: null };
  const me = state.rollers[seat];
  const here = tileAt(me.x, me.y);
  const myCol = here % PAINT_COLS;
  const myRow = Math.floor(here / PAINT_COLS);
  let best: { x: number; y: number; score: number } | null = null;
  const consider = (col: number, row: number, value: number) => {
    const cx = col * PAINT_TILE + PAINT_TILE / 2;
    const cy = row * PAINT_TILE + PAINT_TILE / 2;
    const d = Math.hypot(cx - me.x, cy - me.y) / PAINT_TILE;
    // Tiles ahead are cheaper than tiles behind, which need a turn.
    const ahead = ((cx - me.x) * me.dx + (cy - me.y) * me.dy) / (d * PAINT_TILE || 1);
    const score = value / (1 + d) + ahead * 0.3;
    if (!best || score > best.score) best = { x: cx, y: cy, score };
  };
  for (let row = myRow - tier.sight; row <= myRow + tier.sight; row++) {
    for (let col = myCol - tier.sight; col <= myCol + tier.sight; col++) {
      if (row < 0 || col < 0 || row >= PAINT_ROWS || col >= PAINT_COLS || (row === myRow && col === myCol)) continue;
      const owner = state.floor[row * PAINT_COLS + col]!;
      if (owner === seat) continue;
      consider(col, row, owner === -1 ? 1 : 1 + tier.spite);
    }
  }
  state.pots.forEach((pot, i) => {
    if (!state.taken[i] && pot.at <= state.clock) consider(pot.col, pot.row, 8);
  });
  const target = best as { x: number; y: number; score: number } | null;
  if (!target) return { steer: { x: PAINT_CANVAS.width / 2 - me.x, y: PAINT_CANVAS.height / 2 - me.y } };
  const a = Math.atan2(target.y - me.y, target.x - me.x) + noise * tier.wobble;
  return { steer: { x: Math.cos(a), y: Math.sin(a) } };
}

export const paintFight: RealtimeGameDefinition = {
  id: 'paint-fight',
  name: 'Paint Fight',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive'],
  realtime: true,
};
