import type { BotTier, GameResult, RealtimeGameDefinition, Seat } from '../../core/types';

/**
 * Brick Blast (docs/games/brick-blast.md): breakout for two on one phone. A wall of bricks stands
 * across the middle, a paddle guards each end, and two balls are in play at once. Chip a way
 * through the wall and get a ball past the other paddle for a point; first to five. Real time, a
 * pure fixed step like the other duels.
 */
export const BRICK_CANVAS = { width: 600, height: 900 } as const;
export const BRICK_STEP = 1 / 120;
export const BRICK_WIN = 5;
export const BRICK_BALL_R = 11;
export const PADDLE = { w: 130, h: 22 } as const;
/** Where each paddle's face is: seat 0 guards the bottom, seat 1 the top. */
export const PADDLE_Y = [820, 80] as const;
export const PADDLE_SPEED = 1100;
export const WALL = { x0: 15, y0: 333, cols: 8, rows: 6, w: 66, h: 34, gap: 6 } as const;
/** The two middle rows are tough: two hits each. */
const TOUGH_ROWS = [2, 3];

const COUNTDOWN = 1.5;
const SERVE = 1;
const START_SPEED = 520;
const MAX_SPEED = 820;
const SPEED_UP = 1.035;
/** The steepest a paddle sends a ball, off its very edge, from straight up. */
const MAX_ANGLE = 1.05;

export interface BrickBall {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  /** Seconds left sitting on a paddle before it launches; 0 once it is moving. */
  readonly held: number;
  /** Whose ball it is: the last paddle to touch it. */
  readonly owner: Seat;
  /** Everything it has bounced off, to vary the bots' aim. */
  readonly bounces: number;
}

export interface BrickState {
  readonly seed: number;
  readonly phase: 'countdown' | 'play' | 'over';
  readonly timer: number;
  readonly paddles: readonly [number, number];
  readonly balls: readonly [BrickBall, BrickBall];
  /** Hits each brick has left, row by row from the top; 0 is gone. */
  readonly bricks: readonly number[];
  readonly scores: readonly [number, number];
  readonly result: GameResult | null;
}

export interface BrickInput {
  /** Where this player wants their paddle, or null to leave it. */
  readonly x: number | null;
}

export interface BrickEvents {
  paddle: Seat | null;
  /** Bricks broken this step, by index. */
  broken: number[];
  /** Tough bricks cracked (hit once, still standing). */
  cracked: number[];
  wall: boolean;
  /** Who scored, if anyone. */
  goal: Seat | null;
  launched: boolean;
  /** The wall was all gone and has built itself back up. */
  rebuilt: boolean;
}

const other = (seat: Seat): Seat => (seat === 0 ? 1 : 0);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const HALF = PADDLE.w / 2;

/** A number in [-1, 1) from the seed and a counter: the bots' wobble and the serve angles. */
export function wobble(seed: number, n: number): number {
  let h = (seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 2 ** 31 - 1;
}

export function brickRect(i: number): { x: number; y: number; w: number; h: number } {
  const col = i % WALL.cols;
  const row = Math.floor(i / WALL.cols);
  return { x: WALL.x0 + col * (WALL.w + WALL.gap), y: WALL.y0 + row * (WALL.h + WALL.gap), w: WALL.w, h: WALL.h };
}

export const isTough = (i: number) => TOUGH_ROWS.includes(Math.floor(i / WALL.cols));

/** A ball sitting on `seat`'s paddle, ready to go. */
function onPaddle(seat: Seat, paddleX: number, bounces: number, held = SERVE): BrickBall {
  const y = seat === 0 ? PADDLE_Y[0] - PADDLE.h / 2 - BRICK_BALL_R : PADDLE_Y[1] + PADDLE.h / 2 + BRICK_BALL_R;
  return { x: paddleX, y, vx: 0, vy: 0, held, owner: seat, bounces };
}

const fullWall = () => Array.from({ length: WALL.cols * WALL.rows }, (_, i) => (isTough(i) ? 2 : 1));

export function newBrickBlast(seed: number): BrickState {
  const mid = BRICK_CANVAS.width / 2;
  const bricks = fullWall();
  return {
    seed,
    phase: 'countdown',
    timer: COUNTDOWN,
    paddles: [mid, mid],
    balls: [onPaddle(0, mid, 0), onPaddle(1, mid, 0)],
    bricks,
    scores: [0, 0],
    result: null,
  };
}

/** How a paddle sends a ball back: steeper the further from its middle it hits. */
function offPaddle(ball: BrickBall, seat: Seat, paddleX: number): BrickBall {
  const offset = clamp((ball.x - paddleX) / (HALF + BRICK_BALL_R), -1, 1);
  const speed = Math.min(Math.hypot(ball.vx, ball.vy) * SPEED_UP, MAX_SPEED);
  const angle = offset * MAX_ANGLE;
  const up = seat === 0 ? -1 : 1;
  const y = seat === 0 ? PADDLE_Y[0] - PADDLE.h / 2 - BRICK_BALL_R : PADDLE_Y[1] + PADDLE.h / 2 + BRICK_BALL_R;
  return { ...ball, y, vx: Math.sin(angle) * speed, vy: Math.cos(angle) * speed * up, owner: seat, bounces: ball.bounces + 1 };
}

function moveBall(state: BrickState, index: 0 | 1, ball: BrickBall, bricks: number[], events: BrickEvents, dt: number): BrickBall | Seat {
  if (ball.held > 0) {
    const held = ball.held - dt;
    const x = state.paddles[ball.owner];
    if (held > 0) return { ...onPaddle(ball.owner, x, ball.bounces, held) };
    // Off it goes, a little to one side, toward the wall.
    events.launched = true;
    const angle = wobble(state.seed, index * 1000 + ball.bounces) * 0.45;
    const up = ball.owner === 0 ? -1 : 1;
    return { ...ball, x, held: 0, vx: Math.sin(angle) * START_SPEED, vy: Math.cos(angle) * START_SPEED * up };
  }
  const { width: W, height: H } = BRICK_CANVAS;
  let { vx, vy } = ball;
  let x = ball.x + vx * dt;
  let y = ball.y + vy * dt;
  let bounces = ball.bounces;
  if (x < BRICK_BALL_R || x > W - BRICK_BALL_R) {
    x = clamp(x, BRICK_BALL_R, W - BRICK_BALL_R);
    vx = -vx;
    bounces++;
    events.wall = true;
  }
  // Bricks: the first one the ball overlaps turns it back on whichever side it came in by.
  for (let i = 0; i < bricks.length; i++) {
    if (!bricks[i]) continue;
    const r = brickRect(i);
    const nx = clamp(x, r.x, r.x + r.w);
    const ny = clamp(y, r.y, r.y + r.h);
    if ((x - nx) ** 2 + (y - ny) ** 2 > BRICK_BALL_R * BRICK_BALL_R) continue;
    const fromSide = ball.x < r.x || ball.x > r.x + r.w;
    const fromEnd = ball.y < r.y || ball.y > r.y + r.h;
    if (fromEnd || !fromSide) {
      vy = -vy;
      y = ball.y;
    } else {
      vx = -vx;
      x = ball.x;
    }
    bricks[i]!--;
    (bricks[i] ? events.cracked : events.broken).push(i);
    bounces++;
    break;
  }
  let next: BrickBall = { ...ball, x, y, vx, vy, bounces };
  // Paddles: only a ball coming toward one, crossing its face, within its reach.
  for (const seat of [0, 1] as const) {
    const face = seat === 0 ? PADDLE_Y[0] - PADDLE.h / 2 : PADDLE_Y[1] + PADDLE.h / 2;
    const toward = seat === 0 ? vy > 0 : vy < 0;
    const edge = seat === 0 ? y + BRICK_BALL_R : y - BRICK_BALL_R;
    const was = seat === 0 ? ball.y + BRICK_BALL_R : ball.y - BRICK_BALL_R;
    const crossed = seat === 0 ? was <= face + 6 && edge >= face : was >= face - 6 && edge <= face;
    if (toward && crossed && Math.abs(x - state.paddles[seat]) <= HALF + BRICK_BALL_R) {
      events.paddle = seat;
      next = offPaddle(next, seat, state.paddles[seat]);
    }
  }
  // Out the far end: a point to whoever guards the other one.
  if (next.y < -BRICK_BALL_R) return 0;
  if (next.y > H + BRICK_BALL_R) return 1;
  return next;
}

/** Advances the match by one fixed step. Pure. */
export function stepBrick(state: BrickState, inputs: readonly [BrickInput, BrickInput], dt = BRICK_STEP): { state: BrickState; events: BrickEvents } {
  const events: BrickEvents = { paddle: null, broken: [], cracked: [], wall: false, goal: null, launched: false, rebuilt: false };
  if (state.result) return { state, events };
  const paddles = ([0, 1] as const).map((seat) => {
    const want = inputs[seat].x;
    const now = state.paddles[seat];
    if (want === null) return now;
    const step = clamp(want - now, -PADDLE_SPEED * dt, PADDLE_SPEED * dt);
    return clamp(now + step, HALF, BRICK_CANVAS.width - HALF);
  }) as unknown as [number, number];
  if (state.phase === 'countdown') {
    const timer = state.timer - dt;
    const balls: [BrickBall, BrickBall] = [onPaddle(0, paddles[0], 0), onPaddle(1, paddles[1], 0)];
    return { state: { ...state, paddles, balls, timer: Math.max(timer, 0), phase: timer > 0 ? 'countdown' : 'play' }, events };
  }
  const moved: BrickState = { ...state, paddles };
  const bricks = [...state.bricks];
  const scores: [number, number] = [state.scores[0], state.scores[1]];
  const balls = ([0, 1] as const).map((i) => {
    const out = moveBall(moved, i, state.balls[i], bricks, events, dt);
    if (typeof out !== 'number') return out;
    // A point; the ball goes back to the one who let it by, to serve again.
    scores[out]++;
    events.goal = out;
    const loser = other(out);
    return onPaddle(loser, paddles[loser], state.balls[i].bounces + 1);
  }) as unknown as [BrickBall, BrickBall];
  // A cleared wall builds itself back, once neither ball is where the bricks go.
  const band = (b: BrickBall) => b.y + BRICK_BALL_R > WALL.y0 - 4 && b.y - BRICK_BALL_R < WALL.y0 + WALL.rows * (WALL.h + WALL.gap) + 4;
  if (bricks.every((b) => !b) && !balls.some(band)) {
    fullWall().forEach((b, i) => (bricks[i] = b));
    events.rebuilt = true;
  }
  const won = scores.findIndex((s) => s >= BRICK_WIN);
  const result: GameResult | null = won >= 0 ? { winners: [won as Seat], draw: false } : null;
  return { state: { ...moved, balls, bricks, scores, phase: result ? 'over' : 'play', result }, events };
}

export interface BrickTier {
  /** How far from its end a ball must be before the bot starts to chase it. */
  readonly sight: number;
  /** How far off its guess can be, in px, either way. */
  readonly error: number;
  /** How far off its paddle's middle it tries to take the ball, to angle it away from the other paddle. */
  readonly aim: number;
}

export const BRICK_TIERS: Record<BotTier, BrickTier> = {
  easy: { sight: 330, error: 120, aim: 0 },
  medium: { sight: 420, error: 100, aim: 0 },
  hard: { sight: 560, error: 86, aim: 10 },
  expert: { sight: 900, error: 34, aim: 38 },
};

/** Where a ball will cross `y`, bouncing off the side walls (the wall of bricks is ignored). */
export function crossingX(ball: BrickBall, y: number): number | null {
  if (!ball.vy || (y - ball.y) / ball.vy < 0) return null;
  const W = BRICK_CANVAS.width;
  const span = W - 2 * BRICK_BALL_R;
  let x = ball.x + (ball.vx * (y - ball.y)) / ball.vy - BRICK_BALL_R;
  x = ((x % (2 * span)) + 2 * span) % (2 * span);
  return BRICK_BALL_R + (x > span ? 2 * span - x : x);
}

/**
 * Bot paddle: follows the ball that will reach its end first, once it is close enough to see,
 * with a wobble that changes every bounce. It never looks at anything a person could not see.
 */
export function brickBotInput(state: BrickState, seat: Seat, tier: BrickTier): BrickInput {
  const face = seat === 0 ? PADDLE_Y[0] - PADDLE.h / 2 - BRICK_BALL_R : PADDLE_Y[1] + PADDLE.h / 2 + BRICK_BALL_R;
  let best: { t: number; x: number; ball: BrickBall; i: number } | null = null;
  state.balls.forEach((ball, i) => {
    if (ball.held > 0) return;
    const toward = seat === 0 ? ball.vy > 0 : ball.vy < 0;
    if (!toward || Math.abs(face - ball.y) > tier.sight) return;
    const x = crossingX(ball, face);
    if (x === null) return;
    const t = (face - ball.y) / ball.vy;
    if (!best || t < best.t) best = { t, x, ball, i };
  });
  if (!best) return { x: BRICK_CANVAS.width / 2 };
  const { x, ball, i } = best as { t: number; x: number; ball: BrickBall; i: number };
  // To send it left, take it on the paddle's left side: the paddle sits to the right of it.
  const away = state.paddles[other(seat)] > BRICK_CANVAS.width / 2 ? 1 : -1;
  return { x: x + away * tier.aim + wobble(state.seed, 7919 * (i + 1) + ball.bounces * 31 + seat) * tier.error };
}

export const brickBlast: RealtimeGameDefinition = {
  id: 'brick-blast',
  name: 'Brick Blast',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive'],
  realtime: true,
};
