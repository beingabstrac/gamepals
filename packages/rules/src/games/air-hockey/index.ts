import type { BotTier, GameResult, RealtimeGameDefinition, Seat } from '../../core/types';

/** Portrait table in logical pixels. Seat 0 defends the bottom goal, seat 1 the top goal. */
export const TABLE = { width: 600, height: 900 } as const;
export const GOAL_WIDTH = 240;
export const PUCK_RADIUS = 24;
export const MALLET_RADIUS = 40;
export const AIR_HOCKEY_WIN_SCORE = 7;
/** Fixed simulation step (seconds). Same step everywhere ⇒ same outcome everywhere. */
export const STEP = 1 / 120;

const DRAG = 0.35;
const WALL_BOUNCE = 0.88;
const HIT_RESTITUTION = 0.92;
const MAX_PUCK_SPEED = 1900;
const SERVE_FREEZE = 0.9;
const MALLET_HOME_OFFSET = 110;

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Body extends Point {
  readonly vx: number;
  readonly vy: number;
}

export interface AirHockeyState {
  readonly puck: Body;
  readonly mallets: readonly [Body, Body];
  readonly scores: readonly [number, number];
  /** Seconds left before the puck is live again (after a serve or goal). */
  readonly freeze: number;
  readonly result: GameResult | null;
}

export interface StepEvents {
  /** Impact speed of the strongest mallet hit this step (0 = no hit). */
  hit: number;
  wall: boolean;
  /** Seat that scored this step, if any. */
  goal: Seat | null;
}

export interface StepResult {
  readonly state: AirHockeyState;
  readonly events: StepEvents;
}

export interface MalletInput {
  /** Where the player (finger or bot) wants the mallet; null = stay put. */
  readonly target: Point | null;
  /** Pixels per second. */
  readonly maxSpeed: number;
}

const still = (x: number, y: number): Body => ({ x, y, vx: 0, vy: 0 });

const homeMallets = (): readonly [Body, Body] => [
  still(TABLE.width / 2, TABLE.height - MALLET_HOME_OFFSET),
  still(TABLE.width / 2, MALLET_HOME_OFFSET),
];

export function newAirHockeyGame(): AirHockeyState {
  return {
    // Seat 0 (the bottom player — the person, in games against a bot) serves first.
    puck: still(TABLE.width / 2, TABLE.height * 0.62),
    mallets: homeMallets(),
    scores: [0, 0],
    freeze: SERVE_FREEZE,
    result: null,
  };
}

/** Keeps a mallet on its own side of the center line and inside the rails. */
export function clampToHalf(seat: Seat, point: Point): Point {
  const { width: w, height: h } = TABLE;
  const r = MALLET_RADIUS;
  const x = Math.min(w - r, Math.max(r, point.x));
  const y = seat === 0 ? Math.min(h - r, Math.max(h / 2 + r, point.y)) : Math.min(h / 2 - r, Math.max(r, point.y));
  return { x, y };
}

function moveMallet(mallet: Body, seat: Seat, input: MalletInput, dt: number): Body {
  if (!input.target) return { ...mallet, vx: 0, vy: 0 };
  const goal = clampToHalf(seat, input.target);
  let dx = goal.x - mallet.x;
  let dy = goal.y - mallet.y;
  const distance = Math.hypot(dx, dy);
  const maxStep = input.maxSpeed * dt;
  if (distance > maxStep) {
    dx *= maxStep / distance;
    dy *= maxStep / distance;
  }
  return { x: mallet.x + dx, y: mallet.y + dy, vx: dx / dt, vy: dy / dt };
}

/** Advances the table by one fixed step. Pure: returns a new state and what happened. */
export function stepAirHockey(state: AirHockeyState, inputs: readonly [MalletInput, MalletInput], dt = STEP): StepResult {
  const events: StepEvents = { hit: 0, wall: false, goal: null };
  if (state.result) return { state, events };

  const mallets: readonly [Body, Body] = [
    moveMallet(state.mallets[0], 0, inputs[0], dt),
    moveMallet(state.mallets[1], 1, inputs[1], dt),
  ];
  if (state.freeze > 0) {
    return { state: { ...state, mallets, freeze: Math.max(0, state.freeze - dt) }, events };
  }

  const { width: w, height: h } = TABLE;
  const r = PUCK_RADIUS;
  const damp = Math.exp(-DRAG * dt);
  let vx = state.puck.vx * damp;
  let vy = state.puck.vy * damp;
  let x = state.puck.x + vx * dt;
  let y = state.puck.y + vy * dt;

  const inMouth = (px: number) => Math.abs(px - w / 2) < GOAL_WIDTH / 2;
  const bounceOffRails = () => {
    if (x < r) {
      x = r;
      vx = Math.abs(vx) * WALL_BOUNCE;
      events.wall = true;
    } else if (x > w - r) {
      x = w - r;
      vx = -Math.abs(vx) * WALL_BOUNCE;
      events.wall = true;
    }
    if (y < r && !inMouth(x)) {
      y = r;
      vy = Math.abs(vy) * WALL_BOUNCE;
      events.wall = true;
    } else if (y > h - r && !inMouth(x)) {
      y = h - r;
      vy = -Math.abs(vy) * WALL_BOUNCE;
      events.wall = true;
    }
  };
  bounceOffRails();

  // A puck fully through a goal mouth scores for the other side.
  if (y < -r || y > h + r) {
    const scorer: Seat = y < 0 ? 0 : 1;
    const scores: [number, number] = [state.scores[0], state.scores[1]];
    scores[scorer]++;
    events.goal = scorer;
    const conceder: Seat = scorer === 0 ? 1 : 0;
    const result: GameResult | null = scores[scorer] >= AIR_HOCKEY_WIN_SCORE ? { winners: [scorer], draw: false } : null;
    // The player who conceded serves from their own half.
    const puck = still(w / 2, conceder === 0 ? h * 0.72 : h * 0.28);
    return { state: { puck, mallets: homeMallets(), scores, freeze: SERVE_FREEZE, result }, events };
  }

  for (const mallet of mallets) {
    const dx = x - mallet.x;
    const dy = y - mallet.y;
    const distance = Math.hypot(dx, dy);
    const minDistance = r + MALLET_RADIUS;
    if (distance >= minDistance || distance === 0) continue;
    const nx = dx / distance;
    const ny = dy / distance;
    x = mallet.x + nx * minDistance;
    y = mallet.y + ny * minDistance;
    // Mallets are immovable for the puck: reflect the relative velocity along the contact normal.
    const approach = (vx - mallet.vx) * nx + (vy - mallet.vy) * ny;
    if (approach < 0) {
      vx -= (1 + HIT_RESTITUTION) * approach * nx;
      vy -= (1 + HIT_RESTITUTION) * approach * ny;
      events.hit = Math.max(events.hit, -approach);
    }
  }
  bounceOffRails();

  const speed = Math.hypot(vx, vy);
  if (speed > MAX_PUCK_SPEED) {
    vx *= MAX_PUCK_SPEED / speed;
    vy *= MAX_PUCK_SPEED / speed;
  }
  return { state: { ...state, puck: { x, y, vx, vy }, mallets }, events };
}

export interface AirHockeyTier {
  readonly maxSpeed: number;
  /** How stale the bot's view of the puck is — the client feeds it an older snapshot. */
  readonly reactionMs: number;
  /** Pixels of random aim error at the far goal. */
  readonly aimError: number;
  /** 0 = only defends; 1 = strikes whenever the puck is on its side. */
  readonly aggression: number;
  /** 0 = aims at the middle of the goal; 1 = aims at the corner away from the opponent's mallet. */
  readonly cornerAim: number;
  /** How fully the bot covers the goal-to-puck line when defending (1 = perfect goalie). */
  readonly defense: number;
}

export const AIR_HOCKEY_TIERS: Record<BotTier, AirHockeyTier> = {
  easy: { maxSpeed: 650, reactionMs: 260, aimError: 110, aggression: 0.35, cornerAim: 0, defense: 0.45 },
  medium: { maxSpeed: 1000, reactionMs: 170, aimError: 60, aggression: 0.6, cornerAim: 0.4, defense: 0.7 },
  hard: { maxSpeed: 1500, reactionMs: 110, aimError: 30, aggression: 0.85, cornerAim: 0.7, defense: 0.85 },
  expert: { maxSpeed: 2100, reactionMs: 60, aimError: 12, aggression: 1, cornerAim: 0.9, defense: 1 },
};

/**
 * Where a bot wants its mallet this step. `noise` in [-1, 1] shifts its aim;
 * the caller changes it every so often so the bot isn't perfectly predictable.
 */
export function airHockeyBotTarget(state: AirHockeyState, seat: Seat, tier: AirHockeyTier, noise = 0): Point {
  const { width: w, height: h } = TABLE;
  // Work in a frame where this seat's own goal is at y = 0 and it attacks toward +y.
  const toFrame = (p: Point): Point => (seat === 1 ? p : { x: p.x, y: h - p.y });
  const puck = toFrame(state.puck);
  const puckVy = seat === 1 ? state.puck.vy : -state.puck.vy;
  const me = toFrame(state.mallets[seat]);
  const them = toFrame(state.mallets[seat === 0 ? 1 : 0]);
  const reach = MALLET_RADIUS + PUCK_RADIUS;

  // A puck resting on the center line is still reachable, so count it as ours.
  const onMySide = puck.y < h / 2 + PUCK_RADIUS;
  const incomingFast = puckVy < -350;
  const shouldStrike = onMySide && !(incomingFast && tier.aggression < 0.7);

  let target: Point;
  if (shouldStrike) {
    // Better bots shoot for the side of the goal the opponent's mallet isn't covering.
    const openSide = them.x < w / 2 ? 1 : -1;
    const cornerOffset = openSide * tier.cornerAim * (GOAL_WIDTH / 2 - PUCK_RADIUS - 6);
    const aim = { x: w / 2 + cornerOffset + tier.aimError * noise, y: h + 50 };
    const length = Math.hypot(aim.x - puck.x, aim.y - puck.y) || 1;
    const dir = { x: (aim.x - puck.x) / length, y: (aim.y - puck.y) / length };
    const behindPuck = me.y < puck.y - reach * 0.5;
    target = behindPuck
      ? // Drive through the puck toward the aim point.
        { x: puck.x + dir.x * 40 * tier.aggression, y: puck.y + dir.y * 40 * tier.aggression }
      : // Get around to the goal side of the puck first.
        { x: puck.x + (me.x < puck.x ? -1 : 1) * (reach + 12), y: puck.y - (reach + 12) };
  } else {
    // Guard: sit on the line between the goal and the puck.
    const goal = { x: w / 2, y: 0 };
    const length = Math.hypot(puck.x - goal.x, puck.y - goal.y) || 1;
    const guard = 110 + 40 * tier.aggression;
    const lineX = goal.x + ((puck.x - goal.x) / length) * guard;
    // Weaker bots drift back toward the middle instead of tracking the puck's line exactly.
    target = { x: goal.x + (lineX - goal.x) * tier.defense, y: goal.y + ((puck.y - goal.y) / length) * guard };
  }
  return toFrame(target);
}

export const airHockey: RealtimeGameDefinition = {
  id: 'air-hockey',
  name: 'Air Hockey',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive'],
  realtime: true,
};
