/**
 * Pool table physics: a fixed-step simulation in millimetres and milliseconds, so a speed in mm/ms
 * is a speed in m/s. It uses nothing but arithmetic and `Math.sqrt`, which every JavaScript engine
 * does to the same last bit; `sin` and `cos` are not promised to, and a pool shot turns a last-bit
 * difference into a different game (docs/games/pool.md).
 */

/**
 * A 7-foot bar table's playing surface, held upright: the head (where you break from) at the bottom.
 * A 9-foot table was tried first and its balls came out 11 points across on a phone, too small to
 * aim at; the same balls on the smaller table are a third bigger, and it is the table most people
 * have played on.
 */
export const TABLE_W = 991;
export const TABLE_H = 1981;
export const BALL_R = 28.575;
/** Where the cue ball may go for the break: behind the head string, a quarter of the way up. */
export const HEAD_STRING = TABLE_H * 0.75;
export const FOOT_SPOT = { x: TABLE_W / 2, y: TABLE_H * 0.25 };

/** Rolling slows a ball by this much each millisecond, in mm/ms: 0.55 m/s². */
const ROLL = 0.00055;
/** How much speed a ball keeps off a cushion, and in a hit with another ball. */
const CUSHION = 0.78;
const RESTITUTION = 0.96;
/** Below this a ball is at rest. */
const STOP = 0.004;
/** The longest step, and how far a ball may move in one: small enough that no hit is ever missed. */
const MAX_STEP = 4;
const STEP_TRAVEL = BALL_R * 0.4;
/** Most passes over the contacts in one step; a packed rack settles in a handful. */
const CONTACT_PASSES = 8;
/** A shot that has not come to rest in this long is stopped where it is. */
const MAX_MS = 30_000;
/** Animation frames are kept this often, in table time. */
const FRAME_MS = 16;

/** The six pockets: corners, then the two sides. A ball whose centre comes inside one drops. */
export const POCKETS: readonly { readonly x: number; readonly y: number; readonly r: number }[] = [
  { x: 0, y: 0, r: 62 },
  { x: TABLE_W, y: 0, r: 62 },
  { x: -14, y: TABLE_H / 2, r: 58 },
  { x: TABLE_W + 14, y: TABLE_H / 2, r: 58 },
  { x: 0, y: TABLE_H, r: 62 },
  { x: TABLE_W, y: TABLE_H, r: 62 },
];

export interface TablePoint {
  readonly x: number;
  readonly y: number;
}

/** What happened during a shot, in order, for the rules and for the sound. */
export type ShotEvent =
  | { readonly t: number; readonly kind: 'hit'; readonly a: number; readonly b: number; readonly speed: number }
  | { readonly t: number; readonly kind: 'cushion'; readonly ball: number; readonly speed: number }
  | { readonly t: number; readonly kind: 'pocket'; readonly ball: number; readonly pocket: number };

export interface ShotOutcome {
  /** Where every ball stopped, or null if it went down. */
  readonly balls: (TablePoint | null)[];
  readonly events: readonly ShotEvent[];
  /** Positions every `FRAME_MS`: for each frame, x and y of each ball in turn (NaN once it is down). */
  readonly frames: readonly Float64Array[];
  readonly frameMs: number;
}

/**
 * Plays a shot out to the end: the cue ball (ball 0) leaves at `(vx, vy)`, everything rolls, hits and
 * drops until nothing moves. `frames` is false for bots, which only want the outcome.
 */
export function simulate(start: readonly (TablePoint | null)[], vx: number, vy: number, frames = true): ShotOutcome {
  const n = start.length;
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const ux = new Float64Array(n);
  const uy = new Float64Array(n);
  const on = start.map((ball) => ball !== null);
  start.forEach((ball, i) => {
    if (!ball) return;
    x[i] = ball.x;
    y[i] = ball.y;
  });
  ux[0] = vx;
  uy[0] = vy;
  const events: ShotEvent[] = [];
  const kept: Float64Array[] = [];
  const keep = () => {
    const frame = new Float64Array(n * 2);
    for (let i = 0; i < n; i++) {
      frame[i * 2] = on[i] ? x[i]! : NaN;
      frame[i * 2 + 1] = on[i] ? y[i]! : NaN;
    }
    kept.push(frame);
  };
  if (frames) keep();
  let t = 0;
  let nextFrame = FRAME_MS;
  for (;;) {
    let fastest = 0;
    for (let i = 0; i < n; i++) if (on[i]) fastest = Math.max(fastest, Math.sqrt(ux[i]! * ux[i]! + uy[i]! * uy[i]!));
    if (fastest === 0 || t >= MAX_MS) break;
    const dt = Math.min(MAX_STEP, STEP_TRAVEL / fastest);
    t += dt;
    for (let i = 0; i < n; i++) {
      if (!on[i]) continue;
      const speed = Math.sqrt(ux[i]! * ux[i]! + uy[i]! * uy[i]!);
      if (speed === 0) continue;
      x[i] += ux[i]! * dt;
      y[i] += uy[i]! * dt;
      const slower = speed - ROLL * dt;
      if (slower <= STOP) {
        ux[i] = 0;
        uy[i] = 0;
      } else {
        ux[i] = (ux[i]! * slower) / speed;
        uy[i] = (uy[i]! * slower) / speed;
      }
      const dropped = POCKETS.findIndex((p) => sq(x[i]! - p.x) + sq(y[i]! - p.y) < p.r * p.r);
      if (dropped >= 0) {
        on[i] = false;
        ux[i] = 0;
        uy[i] = 0;
        events.push({ t, kind: 'pocket', ball: i, pocket: dropped });
        continue;
      }
      const cushion = () => events.push({ t, kind: 'cushion', ball: i, speed });
      if (x[i]! < BALL_R) {
        x[i] = BALL_R;
        ux[i] = -ux[i]! * CUSHION;
        uy[i] = uy[i]! * CUSHION;
        cushion();
      } else if (x[i]! > TABLE_W - BALL_R) {
        x[i] = TABLE_W - BALL_R;
        ux[i] = -ux[i]! * CUSHION;
        uy[i] = uy[i]! * CUSHION;
        cushion();
      }
      if (y[i]! < BALL_R) {
        y[i] = BALL_R;
        uy[i] = -uy[i]! * CUSHION;
        ux[i] = ux[i]! * CUSHION;
        cushion();
      } else if (y[i]! > TABLE_H - BALL_R) {
        y[i] = TABLE_H - BALL_R;
        uy[i] = -uy[i]! * CUSHION;
        ux[i] = ux[i]! * CUSHION;
        cushion();
      }
    }
    // Contacts are resolved in passes until none is still closing, so a hit travels right through
    // a packed rack in one step. Done once in ball-number order, how a break spread depended on
    // which numbered ball sat where: the same break at the same speed scattered 307 to 776mm.
    for (let pass = 0; pass < CONTACT_PASSES; pass++) {
      let pushed = false;
      for (let a = 0; a < n; a++) {
        if (!on[a]) continue;
        for (let b = a + 1; b < n; b++) {
          if (!on[b]) continue;
          const dx = x[b]! - x[a]!;
          const dy = y[b]! - y[a]!;
          const d2 = dx * dx + dy * dy;
          if (d2 >= 4 * BALL_R * BALL_R) continue;
          const d = Math.sqrt(d2) || 1e-9;
          const nx = dx / d;
          const ny = dy / d;
          // Push them apart, so a ball can never sit inside another.
          const overlap = (2 * BALL_R - d) / 2;
          x[a] -= nx * overlap;
          y[a] -= ny * overlap;
          x[b] += nx * overlap;
          y[b] += ny * overlap;
          const closing = (ux[a]! - ux[b]!) * nx + (uy[a]! - uy[b]!) * ny;
          if (closing <= 1e-9) continue;
          // Equal masses: the speed along the line between them is shared out, losing a little.
          const k = (closing * (1 + RESTITUTION)) / 2;
          ux[a] -= k * nx;
          uy[a] -= k * ny;
          ux[b] += k * nx;
          uy[b] += k * ny;
          if (pass === 0) events.push({ t, kind: 'hit', a, b, speed: closing });
          pushed = true;
        }
      }
      if (!pushed) break;
    }
    if (frames && t >= nextFrame) {
      keep();
      nextFrame += FRAME_MS;
    }
  }
  if (frames) keep();
  const balls = start.map((_, i): TablePoint | null => (on[i] ? { x: x[i]!, y: y[i]! } : null));
  return { balls, events, frames: kept, frameMs: FRAME_MS };
}

/** The rack: fifteen balls in a triangle, apex on the foot spot, the 8 in the middle, a solid and a stripe in the back corners. */
export function rackBalls(order: readonly number[]): (TablePoint | null)[] {
  const balls: (TablePoint | null)[] = Array.from({ length: 16 }, () => null);
  balls[0] = { x: TABLE_W / 2, y: (HEAD_STRING + TABLE_H) / 2 };
  const gap = 2 * BALL_R + 0.3;
  const rowStep = gap * 0.8660254037844386;
  let slot = 0;
  for (let row = 0; row < 5; row++) {
    for (let i = 0; i <= row; i++) {
      balls[order[slot]!] = { x: TABLE_W / 2 + (i - row / 2) * gap, y: FOOT_SPOT.y - row * rowStep };
      slot++;
    }
  }
  return balls;
}

/** Whether a ball could be put down here: on the table, clear of every other ball and every pocket. */
export function canPlace(balls: readonly (TablePoint | null)[], at: TablePoint, skip = 0): boolean {
  if (at.x < BALL_R || at.x > TABLE_W - BALL_R || at.y < BALL_R || at.y > TABLE_H - BALL_R) return false;
  if (POCKETS.some((p) => sq(at.x - p.x) + sq(at.y - p.y) < sq(p.r + BALL_R))) return false;
  return balls.every((ball, i) => i === skip || !ball || sq(ball.x - at.x) + sq(ball.y - at.y) >= 4 * BALL_R * BALL_R);
}

/** A square by multiplying, never `**`: that is `Math.pow`, which engines are allowed to approximate. */
function sq(v: number): number {
  return v * v;
}
