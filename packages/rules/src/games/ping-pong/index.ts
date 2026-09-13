import type { BotTier, GameResult, RealtimeGameDefinition, Seat } from '../../core/types';

/** Portrait table in logical pixels. Seat 0 plays at the bottom, seat 1 at the top. */
export const PONG_TABLE = { width: 600, height: 900 } as const;
export const PADDLE_WIDTH = 130;
export const PADDLE_HEIGHT = 22;
export const PADDLE_INSET = 70;
export const BALL_RADIUS = 14;
export const PONG_WIN_SCORE = 7;
export const PONG_STEP = 1 / 120;

const START_SPEED = 540;
const SPEEDUP = 1.05;
const MAX_SPEED = 1500;
const MAX_BOUNCE_ANGLE = (60 * Math.PI) / 180;
const SERVE_FREEZE = 0.8;

export interface PongBall {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
}

export interface PongState {
  readonly ball: PongBall;
  /** Paddle centers along x. */
  readonly paddles: readonly [number, number];
  readonly scores: readonly [number, number];
  /** Seconds before a served ball starts moving. */
  readonly freeze: number;
  readonly rally: number;
  readonly result: GameResult | null;
}

export interface PongEvents {
  hit: boolean;
  wall: boolean;
  /** Seat that won the point this step, if any. */
  point: Seat | null;
}

export interface PaddleInput {
  /** Where the player wants the paddle's center; null = stay put. */
  readonly targetX: number | null;
  /** Pixels per second. */
  readonly maxSpeed: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const paddleY = (seat: Seat): number => (seat === 0 ? PONG_TABLE.height - PADDLE_INSET : PADDLE_INSET);

/** The side toward the receiver, angled alternately left and right so serves vary. */
function serveBall(receiver: Seat, servesSoFar: number): PongBall {
  const angle = (servesSoFar % 2 ? 1 : -1) * 0.35;
  const dir = receiver === 0 ? 1 : -1;
  return {
    x: PONG_TABLE.width / 2,
    y: PONG_TABLE.height / 2,
    vx: Math.sin(angle) * START_SPEED,
    vy: dir * Math.cos(angle) * START_SPEED,
  };
}

export function newPongGame(): PongState {
  const center = PONG_TABLE.width / 2;
  return { ball: serveBall(0, 0), paddles: [center, center], scores: [0, 0], freeze: SERVE_FREEZE, rally: 0, result: null };
}

function movePaddle(x: number, input: PaddleInput, dt: number): number {
  if (input.targetX === null) return x;
  const half = PADDLE_WIDTH / 2;
  const target = clamp(input.targetX, half, PONG_TABLE.width - half);
  const maxStep = input.maxSpeed * dt;
  return x + clamp(target - x, -maxStep, maxStep);
}

/** Advances the table by one fixed step. Pure: returns a new state and what happened. */
export function stepPong(state: PongState, inputs: readonly [PaddleInput, PaddleInput], dt = PONG_STEP): { state: PongState; events: PongEvents } {
  const events: PongEvents = { hit: false, wall: false, point: null };
  if (state.result) return { state, events };

  const paddles: readonly [number, number] = [movePaddle(state.paddles[0], inputs[0], dt), movePaddle(state.paddles[1], inputs[1], dt)];
  if (state.freeze > 0) return { state: { ...state, paddles, freeze: Math.max(0, state.freeze - dt) }, events };

  const { width: w, height: h } = PONG_TABLE;
  const r = BALL_RADIUS;
  let { x, y, vx, vy } = state.ball;
  x += vx * dt;
  y += vy * dt;

  if (x < r) {
    x = r;
    vx = Math.abs(vx);
    events.wall = true;
  } else if (x > w - r) {
    x = w - r;
    vx = -Math.abs(vx);
    events.wall = true;
  }

  let rally = state.rally;
  for (const seat of [0, 1] as const) {
    const movingToward = seat === 0 ? vy > 0 : vy < 0;
    if (!movingToward) continue;
    const py = paddleY(seat);
    const face = seat === 0 ? py - PADDLE_HEIGHT / 2 : py + PADDLE_HEIGHT / 2;
    const back = seat === 0 ? py + PADDLE_HEIGHT / 2 : py - PADDLE_HEIGHT / 2;
    const reached = seat === 0 ? y + r >= face && y - r <= back : y - r <= face && y + r >= back;
    const px = paddles[seat];
    if (!reached || Math.abs(x - px) > PADDLE_WIDTH / 2 + r) continue;

    // Where the ball meets the paddle sets its new angle: edges send it wide.
    const offset = clamp((x - px) / (PADDLE_WIDTH / 2 + r), -1, 1);
    const speed = Math.min(Math.hypot(vx, vy) * SPEEDUP, MAX_SPEED);
    const angle = offset * MAX_BOUNCE_ANGLE;
    vx = Math.sin(angle) * speed;
    vy = (seat === 0 ? -1 : 1) * Math.cos(angle) * speed;
    y = seat === 0 ? face - r : face + r;
    events.hit = true;
    rally++;
  }

  if (y > h + r || y < -r) {
    const scorer: Seat = y > h ? 1 : 0;
    const scores: [number, number] = [state.scores[0], state.scores[1]];
    scores[scorer]++;
    events.point = scorer;
    const receiver: Seat = scorer === 0 ? 1 : 0;
    const result: GameResult | null = scores[scorer] >= PONG_WIN_SCORE ? { winners: [scorer], draw: false } : null;
    return {
      state: { ball: serveBall(receiver, scores[0] + scores[1]), paddles, scores, freeze: SERVE_FREEZE, rally: 0, result },
      events,
    };
  }

  return { state: { ...state, ball: { x, y, vx, vy }, paddles, rally }, events };
}

/** Where the ball will cross `targetY`, bouncing off the side walls on the way. */
export function predictLandingX(ball: PongBall, targetY: number): number {
  const { width: w } = PONG_TABLE;
  const r = BALL_RADIUS;
  if (ball.vy === 0) return ball.x;
  const t = (targetY - ball.y) / ball.vy;
  if (t <= 0) return ball.x;
  const span = w - 2 * r;
  const period = 2 * span;
  const raw = ball.x + ball.vx * t - r;
  const u = ((raw % period) + period) % period;
  return r + (u <= span ? u : period - u);
}

export interface PongTier {
  readonly maxSpeed: number;
  /** How stale the bot's view of the ball is — the client feeds it an older snapshot. */
  readonly reactionMs: number;
  /** Pixels of random positioning error. */
  readonly error: number;
  /** Predicts wall bounces instead of chasing where the ball is now. */
  readonly anticipation: boolean;
  /** 0 = returns straight back; 1 = uses the paddle edge to send the ball away from the opponent. */
  readonly aim: number;
}

export const PONG_TIERS: Record<BotTier, PongTier> = {
  easy: { maxSpeed: 420, reactionMs: 240, error: 60, anticipation: false, aim: 0 },
  medium: { maxSpeed: 650, reactionMs: 170, error: 35, anticipation: true, aim: 0.3 },
  hard: { maxSpeed: 950, reactionMs: 110, error: 18, anticipation: true, aim: 0.6 },
  expert: { maxSpeed: 1300, reactionMs: 60, error: 8, anticipation: true, aim: 0.8 },
};

/** Where a bot wants its paddle's center. `noise` in [-1, 1] adds its positioning error. */
export function pongBotTarget(state: PongState, seat: Seat, tier: PongTier, noise = 0): number {
  const { width: w } = PONG_TABLE;
  const ball = state.ball;
  const coming = seat === 0 ? ball.vy > 0 : ball.vy < 0;
  if (!coming || state.freeze > 0) return w / 2 + noise * tier.error;

  const face = seat === 0 ? paddleY(0) - PADDLE_HEIGHT / 2 : paddleY(1) + PADDLE_HEIGHT / 2;
  const landing = tier.anticipation ? predictLandingX(ball, face) : ball.x;
  // To send the ball left, meet it with the paddle's left side (paddle shifted right), and vice versa.
  const opponent = state.paddles[seat === 0 ? 1 : 0];
  const sendLeft = opponent > w / 2;
  const shift = tier.aim * PADDLE_WIDTH * 0.35 * (sendLeft ? 1 : -1);
  return landing + shift + noise * tier.error;
}

export const pingPong: RealtimeGameDefinition = {
  id: 'ping-pong',
  name: 'Ping Pong',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive'],
  realtime: true,
};
