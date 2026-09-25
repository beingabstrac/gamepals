import type { Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Flick Football (docs/games/flick-football.md): three round men a side and a ball on a pitch seen
 * from above. A turn is one flick of one of your men; the ball moves only when a man hits it. The
 * roll is a fixed step here in the rules. Seat 0 attacks the top goal, seat 1 the bottom one.
 */
export const PITCH = { w: 520, h: 820 };
export const GOAL_W = 190;
export const MAN_R = 26;
export const FOOTBALL_R = 15;
export const FLICK_STEP = 1 / 120;
export const GOALS_TO_WIN = 3;
export const FLICKS_EACH = 30;
export const MEN = 3;
const TOP_SPEED = 950;
const MAN_FRICTION = 300;
const BALL_FRICTION = 190;
const BOUNCE = 0.85;
const WALL_BOUNCE = 0.72;
const MAX_STEPS = 1800;

export interface FlickBody {
  readonly x: number;
  readonly y: number;
}

/** Where everyone stands at a kick-off: seat 0's three men, seat 1's three, then the ball. */
export function kickOff(): FlickBody[] {
  const { w, h } = PITCH;
  return [
    { x: w / 2, y: h - 110 },
    { x: w / 2 - 120, y: h - 250 },
    { x: w / 2 + 120, y: h - 250 },
    { x: w / 2, y: 110 },
    { x: w / 2 - 120, y: 250 },
    { x: w / 2 + 120, y: 250 },
    { x: w / 2, y: h / 2 },
  ];
}

export interface FlickRoll {
  /** Everyone's position every few steps, for the scene to play. */
  readonly frames: readonly (readonly FlickBody[])[];
  readonly end: readonly FlickBody[];
  /** The seat that scored, if the ball went in. */
  readonly goal: Seat | null;
  /** Did the flicked man touch the ball at all. */
  readonly touched: boolean;
}

/** Rolls everything from a flick of body `who` at `angle` degrees and `power` 1 to 100. */
export function flickRoll(start: readonly FlickBody[], who: number, angle: number, power: number, every = 2): FlickRoll {
  const n = start.length;
  const x = start.map((b) => b.x);
  const y = start.map((b) => b.y);
  const vx = Array<number>(n).fill(0);
  const vy = Array<number>(n).fill(0);
  const speed = (TOP_SPEED * power) / 100;
  vx[who] = Math.cos((angle * Math.PI) / 180) * speed;
  vy[who] = Math.sin((angle * Math.PI) / 180) * speed;
  const r = (i: number) => (i === n - 1 ? FOOTBALL_R : MAN_R);
  const m = (i: number) => (i === n - 1 ? 1 : 2.2);
  const ball = n - 1;
  const frames: FlickBody[][] = [];
  let touched = false;
  const snap = () => frames.push(x.map((_, i) => ({ x: x[i]!, y: y[i]! })));
  snap();
  const mouthL = (PITCH.w - GOAL_W) / 2;
  const mouthR = (PITCH.w + GOAL_W) / 2;
  for (let step = 1; step <= MAX_STEPS; step++) {
    let moving = false;
    for (let i = 0; i < n; i++) {
      const s = Math.hypot(vx[i]!, vy[i]!);
      if (s === 0) continue;
      const slow = Math.max(0, s - (i === ball ? BALL_FRICTION : MAN_FRICTION) * FLICK_STEP);
      vx[i] = (vx[i]! / s) * slow;
      vy[i] = (vy[i]! / s) * slow;
      x[i]! += vx[i]! * FLICK_STEP;
      y[i]! += vy[i]! * FLICK_STEP;
      if (slow > 0) moving = true;
    }
    // Circles bump: equal and opposite, the ball lighter than a man.
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const dx = x[j]! - x[i]!;
        const dy = y[j]! - y[i]!;
        const d = Math.hypot(dx, dy);
        const min = r(i) + r(j);
        if (d >= min || d === 0) continue;
        const nx = dx / d;
        const ny = dy / d;
        const overlap = min - d;
        const mi = m(i);
        const mj = m(j);
        x[i]! -= (nx * overlap * mj) / (mi + mj);
        y[i]! -= (ny * overlap * mj) / (mi + mj);
        x[j]! += (nx * overlap * mi) / (mi + mj);
        y[j]! += (ny * overlap * mi) / (mi + mj);
        const approach = (vx[j]! - vx[i]!) * nx + (vy[j]! - vy[i]!) * ny;
        if (approach < 0) {
          const jImp = (-(1 + BOUNCE) * approach) / (1 / mi + 1 / mj);
          vx[i]! -= (jImp / mi) * nx;
          vy[i]! -= (jImp / mi) * ny;
          vx[j]! += (jImp / mj) * nx;
          vy[j]! += (jImp / mj) * ny;
          if ((i === who && j === ball) || (j === who && i === ball)) touched = true;
        }
      }
    // Walls; the goal mouths are open only to the ball.
    for (let i = 0; i < n; i++) {
      const ri = r(i);
      if (x[i]! < ri) (x[i] = ri), (vx[i] = Math.abs(vx[i]!) * WALL_BOUNCE);
      if (x[i]! > PITCH.w - ri) (x[i] = PITCH.w - ri), (vx[i] = -Math.abs(vx[i]!) * WALL_BOUNCE);
      const inMouth = i === ball && x[i]! > mouthL && x[i]! < mouthR;
      if (inMouth) {
        if (y[i]! < -ri) return { frames: [...frames, x.map((_, k) => ({ x: x[k]!, y: y[k]! }))], end: kickOff(), goal: 0, touched };
        if (y[i]! > PITCH.h + ri) return { frames: [...frames, x.map((_, k) => ({ x: x[k]!, y: y[k]! }))], end: kickOff(), goal: 1, touched };
        continue;
      }
      if (y[i]! < ri) (y[i] = ri), (vy[i] = Math.abs(vy[i]!) * WALL_BOUNCE);
      if (y[i]! > PITCH.h - ri) (y[i] = PITCH.h - ri), (vy[i] = -Math.abs(vy[i]!) * WALL_BOUNCE);
    }
    if (step % every === 0) snap();
    if (!moving) break;
  }
  snap();
  const end = x.map((_, i) => ({ x: Math.round(x[i]! * 10) / 10, y: Math.round(y[i]! * 10) / 10 }));
  return { frames, end, goal: null, touched };
}

/** `m2a135p80`: flick your man 2 at 135 degrees (0 is right, 90 is down) with power 80. */
export type FlickMove = string;
export const flickMove = (man: number, angle: number, power: number): FlickMove => `m${man}a${((Math.round(angle) % 360) + 360) % 360}p${Math.round(power)}`;
export function parseFlick(move: string): { man: number; angle: number; power: number } | null {
  const m = /^m([0-2])a(\d{1,3})p(\d{1,3})$/.exec(move);
  if (!m) return null;
  const angle = Number(m[2]);
  const power = Number(m[3]);
  return angle < 360 && power >= 1 && power <= 100 ? { man: Number(m[1]), angle, power } : null;
}

export class FlickState implements GameState<FlickMove> {
  constructor(
    readonly bodies: readonly FlickBody[],
    readonly currentSeat: Seat,
    readonly goals: readonly [number, number],
    readonly flicks: readonly [number, number],
    readonly last: { readonly seat: Seat; readonly man: number; readonly from: readonly FlickBody[]; readonly angle: number; readonly power: number; readonly goal: Seat | null } | null,
    readonly result: GameResult | null,
  ) {}

  /** Any direction and power for any of your men, so this is the authority and `legalMoves` is a spread. */
  allows(move: FlickMove): boolean {
    return !this.result && parseFlick(move) !== null;
  }

  legalMoves(seat: Seat): readonly FlickMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    const out: FlickMove[] = [];
    for (let man = 0; man < MEN; man++) for (let a = 0; a < 360; a += 30) for (const p of [40, 80]) out.push(flickMove(man, a, p));
    return out;
  }

  apply(move: FlickMove): FlickState {
    if (!this.allows(move)) throw new Error(`Illegal move: ${move}`);
    const f = parseFlick(move)!;
    const seat = this.currentSeat;
    const roll = flickRoll(this.bodies, seat * MEN + f.man, f.angle, f.power, 1000);
    const goals: [number, number] = [this.goals[0], this.goals[1]];
    if (roll.goal !== null) goals[roll.goal]++;
    const flicks: [number, number] = [this.flicks[0], this.flicks[1]];
    flicks[seat]++;
    // The side that let a goal in kicks off; otherwise turns alternate.
    const next: Seat = roll.goal !== null ? (roll.goal === 0 ? 1 : 0) : seat === 0 ? 1 : 0;
    const last = { seat, man: f.man, from: this.bodies, angle: f.angle, power: f.power, goal: roll.goal };
    let result: GameResult | null = null;
    if (goals[0] >= GOALS_TO_WIN || goals[1] >= GOALS_TO_WIN) result = { winners: [goals[0] > goals[1] ? 0 : 1], draw: false };
    else if (flicks[0] >= FLICKS_EACH && flicks[1] >= FLICKS_EACH) result = goals[0] === goals[1] ? { winners: [], draw: true } : { winners: [goals[0] > goals[1] ? 0 : 1], draw: false };
    return new FlickState(roll.end, next, goals, flicks, last, result);
  }
}

export const newFlick = () => new FlickState(kickOff(), 0, [0, 0], [0, 0], null, null);

interface FlickTier {
  /** Directions tried per man (evenly spread), and strengths. */
  readonly angles: number;
  readonly powers: readonly number[];
  /** Degrees the flick goes off where it was aimed, either way. */
  readonly shake: number;
  /** Fine-tune round the best flick found. */
  readonly refine: boolean;
}

/** Measured over 20 matches each: Medium beat Easy 17-2, Hard beat Medium 17-3, Expert beat Hard 17-3. */
export const FLICK_TIERS: Record<BotTier, FlickTier> = {
  easy: { angles: 6, powers: [55], shake: 22, refine: false },
  medium: { angles: 18, powers: [45, 85], shake: 7, refine: false },
  hard: { angles: 36, powers: [35, 65, 100], shake: 3, refine: false },
  expert: { angles: 36, powers: [30, 55, 80, 100], shake: 1.5, refine: true },
};

/** How good a pitch is for `seat` after a flick: goals first, then where the ball is. */
function worth(roll: FlickRoll, seat: Seat): number {
  if (roll.goal !== null) return roll.goal === seat ? 100000 : -100000;
  const ball = roll.end[roll.end.length - 1]!;
  // Seat 0 wants the ball near the top (small y), seat 1 near the bottom.
  const upfield = seat === 0 ? PITCH.h - ball.y : ball.y;
  const central = -Math.abs(ball.x - PITCH.w / 2) * 0.3;
  // A man of ours between the ball and our own goal is worth something too.
  const ownGoalY = seat === 0 ? PITCH.h : 0;
  const guard = roll.end
    .slice(seat * MEN, seat * MEN + MEN)
    .some((b) => Math.abs(b.x - ball.x) < 80 && (seat === 0 ? b.y > ball.y : b.y < ball.y) && Math.abs(b.y - ownGoalY) < Math.abs(ball.y - ownGoalY))
    ? 120
    : 0;
  return upfield + central + guard + (roll.touched ? 40 : 0);
}

export function chooseFlick(state: FlickState, tier: FlickTier, rng: Rng): FlickMove {
  const seat = state.currentSeat;
  let best = { man: 0, angle: seat === 0 ? 270 : 90, power: 60, v: -Infinity };
  for (let man = 0; man < MEN; man++)
    for (let k = 0; k < tier.angles; k++) {
      const angle = (k * 360) / tier.angles;
      for (const power of tier.powers) {
        const v = worth(flickRoll(state.bodies, seat * MEN + man, angle, power, 1000), seat);
        if (v > best.v) best = { man, angle, power, v };
      }
    }
  if (tier.refine)
    for (let da = -8; da <= 8; da += 2)
      for (const dp of [-10, 0, 10]) {
        const angle = best.angle + da;
        const power = Math.max(1, Math.min(100, best.power + dp));
        const v = worth(flickRoll(state.bodies, seat * MEN + best.man, angle, power, 1000), seat);
        if (v > best.v) best = { ...best, angle, power, v };
      }
  const off = (rng.next() * 2 - 1) * tier.shake;
  return flickMove(best.man, best.angle + off, best.power);
}

export const flickFootball: GameDefinition<FlickMove> = {
  id: 'flick-football',
  name: 'Flick Football',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: false,
  realtime: false,
  newGame: () => newFlick(),
  createBot: (tier) => ({ chooseMove: (s: GameState<FlickMove>, _seat: Seat, rng: Rng) => chooseFlick(s as FlickState, FLICK_TIERS[tier], rng) }) satisfies Bot<FlickMove>,
  encodeMove: (move) => move,
  decodeMove: (key) => (parseFlick(key) ? key : null),
};
