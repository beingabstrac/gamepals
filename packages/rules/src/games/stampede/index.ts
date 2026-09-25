import type { BotTier, GameResult, RealtimeGameDefinition, Seat } from '../../core/types';

/**
 * Stampede (docs/games/stampede.md): one player runs, the other herds. The herder taps a lane at
 * the top to send an animal charging down it; the runner, at the bottom, dodges from lane to lane
 * and has to last the round. Then they swap. Top-down, logical pixels.
 */
export const STAMPEDE_CANVAS = { width: 600, height: 900 } as const;
export const FIELD = { left: 40, right: 560, top: 90, bottom: 830 } as const;
export const LANES = 5;
export const LANE_W = (FIELD.right - FIELD.left) / LANES;
export const RUNNER_Y = 760;
export const RUNNER_W = 52;
export const ANIMAL_H = 70;
export const ANIMAL_W = 70;
export const STAMPEDE_STEP = 1 / 120;
export const STAMPEDE_SECONDS = 20;
/** Two rounds each way. */
export const STAMPEDE_ROUNDS = 4;

const RUN_ACCEL = 5200;
const RUN_DRAG = 9;
const RUN_TOP = 560;
const SEND_COOLDOWN = 0.55;
/** Animals get faster through a round. */
const SPEED_START = 380;
const SPEED_END = 600;
const COUNTDOWN = 1.4;
const ROUND_PAUSE = 1.4;

export interface Animal {
  readonly lane: number;
  readonly y: number;
  readonly speed: number;
}

export type StampedePhase = 'countdown' | 'run' | 'over';

export interface StampedeState {
  readonly round: number;
  /** Who runs this round; the other seat herds. Seat 0 runs first. */
  readonly runner: Seat;
  readonly x: number;
  readonly vx: number;
  readonly animals: readonly Animal[];
  readonly phase: StampedePhase;
  /** Counting down before a round and after it; counting up (seconds survived) during one. */
  readonly timer: number;
  readonly cooldown: number;
  /** Rounds won by each seat, and seconds survived as the runner. */
  readonly points: readonly [number, number];
  readonly survived: readonly [number, number];
  readonly lastRound: { readonly runner: Seat; readonly survived: boolean } | null;
  readonly result: GameResult | null;
}

export interface StampedeInput {
  /** Runner: which way to run, -1 to 1 (null to stop). Herder: ignored. */
  readonly run: number | null;
  /** Herder: the lane to send an animal down (null for none). Runner: ignored. */
  readonly send: number | null;
}

export interface StampedeEvents {
  sent: number | null;
  hit: boolean;
  /** The round ended: did the runner last it. */
  roundOver: boolean | null;
}

export const laneX = (lane: number) => FIELD.left + LANE_W * (lane + 0.5);

export function newStampede(): StampedeState {
  return {
    round: 0,
    runner: 0,
    x: laneX(2),
    vx: 0,
    animals: [],
    phase: 'countdown',
    timer: COUNTDOWN,
    cooldown: 0,
    points: [0, 0],
    survived: [0, 0],
    lastRound: null,
    result: null,
  };
}

const other = (s: Seat): Seat => (s === 0 ? 1 : 0);
export const animalSpeed = (t: number) => SPEED_START + ((SPEED_END - SPEED_START) * Math.min(t, STAMPEDE_SECONDS)) / STAMPEDE_SECONDS;

/** Can the herder send down this lane now? Not while the last one sent there is still near the top. */
export function canSend(state: StampedeState, lane: number): boolean {
  return state.phase === 'run' && state.cooldown === 0 && lane >= 0 && lane < LANES && !state.animals.some((a) => a.lane === lane && a.y < FIELD.top + ANIMAL_H * 2);
}

function endRound(state: StampedeState, survived: boolean, time: number, events: StampedeEvents): StampedeState {
  const points: [number, number] = [state.points[0], state.points[1]];
  points[survived ? state.runner : other(state.runner)]++;
  const survivedTime: [number, number] = [state.survived[0], state.survived[1]];
  survivedTime[state.runner] += time;
  events.roundOver = survived;
  const round = state.round + 1;
  let result: GameResult | null = null;
  if (round >= STAMPEDE_ROUNDS) {
    const lead = points[0] !== points[1] ? (points[0] > points[1] ? 0 : 1) : survivedTime[0] !== survivedTime[1] ? (survivedTime[0] > survivedTime[1] ? 0 : 1) : null;
    result = lead === null ? { winners: [], draw: true } : { winners: [lead], draw: false };
  }
  return { ...state, phase: 'over', timer: ROUND_PAUSE, points, survived: survivedTime, round, lastRound: { runner: state.runner, survived }, result };
}

/** One fixed step of the field. Pure. */
export function stepStampede(state: StampedeState, inputs: readonly [StampedeInput, StampedeInput], dt = STAMPEDE_STEP): { state: StampedeState; events: StampedeEvents } {
  const events: StampedeEvents = { sent: null, hit: false, roundOver: null };
  if (state.result) return { state, events };
  if (state.phase === 'countdown') {
    const timer = state.timer - dt;
    return { state: timer > 0 ? { ...state, timer } : { ...state, phase: 'run', timer: 0 }, events };
  }
  if (state.phase === 'over') {
    const timer = state.timer - dt;
    if (timer > 0) return { state: { ...state, timer }, events };
    // Swap: the herder runs next.
    return { state: { ...state, runner: other(state.runner), x: laneX(2), vx: 0, animals: [], phase: 'countdown', timer: COUNTDOWN, cooldown: 0 }, events };
  }
  const t = state.timer + dt;
  const run = inputs[state.runner].run;
  const send = inputs[other(state.runner)].send;
  // The runner.
  let vx = state.vx;
  if (run !== null) vx += Math.max(-1, Math.min(1, run)) * RUN_ACCEL * dt;
  vx *= Math.exp(-RUN_DRAG * dt);
  vx = Math.max(-RUN_TOP, Math.min(RUN_TOP, vx));
  let x = state.x + vx * dt;
  if (x < FIELD.left + RUNNER_W / 2) (x = FIELD.left + RUNNER_W / 2), (vx = 0);
  if (x > FIELD.right - RUNNER_W / 2) (x = FIELD.right - RUNNER_W / 2), (vx = 0);
  // The herd.
  let animals = state.animals.map((a) => ({ ...a, y: a.y + a.speed * dt })).filter((a) => a.y < FIELD.bottom + ANIMAL_H);
  let cooldown = Math.max(0, state.cooldown - dt);
  if (send !== null && canSend({ ...state, animals, cooldown }, send)) {
    animals = [...animals, { lane: send, y: FIELD.top, speed: animalSpeed(t) }];
    cooldown = SEND_COOLDOWN;
    events.sent = send;
  }
  const next = { ...state, x, vx, animals, timer: t, cooldown };
  // Caught: an animal overlapping the runner.
  const hit = animals.some((a) => Math.abs(a.y - RUNNER_Y) < (ANIMAL_H + 36) / 2 && Math.abs(laneX(a.lane) - x) < (ANIMAL_W + RUNNER_W) / 2 - 6);
  if (hit) {
    events.hit = true;
    return { state: endRound(next, false, t, events), events };
  }
  if (t >= STAMPEDE_SECONDS) return { state: endRound(next, true, STAMPEDE_SECONDS, events), events };
  return { state: next, events };
}

export interface StampedeTier {
  /** Runner: how far ahead it looks for animals (seconds), and how late it reacts. */
  readonly foresight: number;
  readonly reactionMs: number;
  /** Herder: sends at where the runner is going (1) or just where it is (0), and how often it tries. */
  readonly lead: number;
  readonly eagerness: number;
  /** Herder: once the runner's lane has an animal coming, send the next into the lane it will flee to. */
  readonly trap: boolean;
}

/**
 * Measured over 20 matches each: Medium beat Easy 17-3, Hard beat Medium 20-0, Expert beat Hard
 * 12-0 (8 drawn, both lasting every round). Only Expert sets traps; without them the best herder
 * could not catch a runner who looks ahead, and every Expert-Hard match was a draw.
 */
export const STAMPEDE_TIERS: Record<BotTier, StampedeTier> = {
  easy: { foresight: 0.5, reactionMs: 260, lead: 0, eagerness: 0.3, trap: false },
  medium: { foresight: 0.6, reactionMs: 220, lead: 0.25, eagerness: 0.45, trap: false },
  hard: { foresight: 0.9, reactionMs: 120, lead: 0.6, eagerness: 0.75, trap: false },
  expert: { foresight: 1, reactionMs: 90, lead: 0.8, eagerness: 0.9, trap: true },
};

/** How dangerous each lane is for the runner over the next `ahead` seconds (bigger is worse). */
function danger(state: StampedeState, ahead: number): number[] {
  const out = Array<number>(LANES).fill(0);
  for (const a of state.animals) {
    const arrive = (RUNNER_Y - ANIMAL_H / 2 - 18 - a.y) / a.speed;
    const leave = (RUNNER_Y + ANIMAL_H / 2 + 18 - a.y) / a.speed;
    if (leave < 0 || arrive > ahead) continue;
    out[a.lane]! += 1 + Math.max(0, ahead - arrive);
  }
  return out;
}

/**
 * Bot play for whichever role the seat has this round. `noise` in [-1, 1] makes a herder's choice
 * of lane a little loose. The client feeds each bot a view as old as its reaction time.
 */
export function stampedeBotInput(state: StampedeState, seat: Seat, tier: StampedeTier, noise = 0): StampedeInput {
  if (state.phase !== 'run') return { run: null, send: null };
  if (seat === state.runner) {
    const d = danger(state, tier.foresight);
    const here = Math.max(0, Math.min(LANES - 1, Math.floor((state.x - FIELD.left) / LANE_W)));
    // The safest lane, and among equals the nearest; a lane is only reachable through its neighbours.
    let best = here;
    let bestScore = Infinity;
    for (let lane = 0; lane < LANES; lane++) {
      // The lanes it has to pass into on the way (not the one it is leaving).
      const path = lane === here ? [here] : Array.from({ length: Math.abs(lane - here) }, (_, k) => here + Math.sign(lane - here) * (k + 1));
      const score = Math.max(...path.map((l) => d[l]!)) * 10 + Math.abs(lane - here);
      if (score < bestScore) (bestScore = score), (best = lane);
    }
    const dx = laneX(best) - state.x;
    return { run: Math.abs(dx) < 6 ? null : Math.max(-1, Math.min(1, dx / 40)), send: null };
  }
  if (state.cooldown > 0 || (noise + 1) / 2 > tier.eagerness) return { run: null, send: null };
  // Send where the runner will be when the animal gets there: where it is, plus where it is heading.
  const travel = (RUNNER_Y - FIELD.top) / animalSpeed(state.timer);
  const aim = state.x + state.vx * travel * tier.lead;
  let lane = Math.max(0, Math.min(LANES - 1, Math.floor((aim - FIELD.left) / LANE_W)));
  if (tier.trap) {
    // Their lane already has one coming: send this one where they will run to get out of it.
    const d = danger(state, 1.6);
    const here = Math.max(0, Math.min(LANES - 1, Math.floor((state.x - FIELD.left) / LANE_W)));
    if (d[here]! > 0) {
      const sides = [here - 1, here + 1].filter((l) => l >= 0 && l < LANES);
      lane = sides.reduce((best, l) => (d[l]! < d[best]! ? l : best), sides[0]!);
    }
  }
  if (!canSend(state, lane)) lane = Math.max(0, Math.min(LANES - 1, lane + (noise > 0 ? 1 : -1)));
  return { run: null, send: canSend(state, lane) ? lane : null };
}

export const stampede: RealtimeGameDefinition = {
  id: 'stampede',
  name: 'Stampede',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive'],
  realtime: true,
};
