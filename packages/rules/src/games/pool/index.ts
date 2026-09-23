import type { Rng } from '../../core/rng';
import { createRng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';
import { BALL_R, canPlace, FOOT_SPOT, HEAD_STRING, POCKETS, rackBalls, simulate, TABLE_H, TABLE_W, type TablePoint, type ShotOutcome } from './physics';

export { BALL_R, HEAD_STRING, POCKETS, TABLE_H, TABLE_W, type TablePoint, type ShotEvent, type ShotOutcome } from './physics';

/** Pool: eight-ball, WPA rules with the phone simplifications (docs/games/pool.md). */

/**
 * A shot: `a<dx>,<dy>` the direction as two whole numbers (towards a point, never an angle),
 * `p<power>` from 1 to 100, then `h<x>,<y>` where the cue ball goes when it is in hand, and
 * `c<pocket>` the pocket called for the 8.
 */
export type PoolMove = string;

export const MAX_POWER = 100;
/** Speed at full power, in m/s. A hard break is about 9 m/s. */
const TOP_SPEED = 9.5;
/** The largest either half of a direction may be, so a move string stays short. */
export const MAX_AIM = 40_000;

export type PoolGroup = 'solids' | 'stripes';
export const groupOfBall = (ball: number): PoolGroup | null => (ball >= 1 && ball <= 7 ? 'solids' : ball >= 9 && ball <= 15 ? 'stripes' : null);

/** Where the cue ball may be put: nowhere (it is where it stopped), behind the head string (the break), or anywhere (after a foul). */
export type InHand = 'none' | 'kitchen' | 'anywhere';

export interface PoolShot {
  readonly dx: number;
  readonly dy: number;
  readonly power: number;
  readonly place: TablePoint | null;
  readonly call: number | null;
}

export function encodeShot(shot: PoolShot): PoolMove {
  return `a${shot.dx},${shot.dy}p${shot.power}${shot.place ? `h${shot.place.x},${shot.place.y}` : ''}${shot.call !== null ? `c${shot.call}` : ''}`;
}

export function parseShot(move: string): PoolShot | null {
  const m = /^a(-?\d+),(-?\d+)p(\d+)(?:h(\d+),(\d+))?(?:c([0-5]))?$/.exec(move);
  if (!m) return null;
  return {
    dx: Number(m[1]),
    dy: Number(m[2]),
    power: Number(m[3]),
    place: m[4] !== undefined ? { x: Number(m[4]), y: Number(m[5]) } : null,
    call: m[6] !== undefined ? Number(m[6]) : null,
  };
}

/** Why a shot was a foul, in the words the game shows. */
export type Foul = 'scratch' | 'miss' | 'wrong-ball' | 'no-rail';

export interface ShotReport {
  readonly shooter: Seat;
  /** The table before the shot, the cue ball where it was put. */
  readonly from: readonly (TablePoint | null)[];
  readonly outcome: ShotOutcome;
  readonly firstHit: number | null;
  readonly pocketed: readonly number[];
  readonly foul: Foul | null;
  /** The 8 went down on the break and was put back on the foot spot. */
  readonly respotted: boolean;
  readonly kept: boolean;
}

export class PoolState implements GameState<PoolMove> {
  constructor(
    /** Ball 0 is the cue ball, 8 the eight; null is down (for the cue ball, in hand). */
    readonly balls: readonly (TablePoint | null)[],
    /** The seat that has the solids, or null while the table is open. */
    readonly solids: Seat | null,
    readonly currentSeat: Seat,
    readonly inHand: InHand,
    readonly broken: boolean,
    readonly result: GameResult | null,
    readonly last: ShotReport | null,
  ) {}

  groupOf(seat: Seat): PoolGroup | null {
    if (this.solids === null) return null;
    return this.solids === seat ? 'solids' : 'stripes';
  }

  /** Balls of `seat`'s group still on the table. */
  left(seat: Seat): number[] {
    const group = this.groupOf(seat);
    if (!group) return [];
    return this.balls.flatMap((ball, i) => (ball && groupOfBall(i) === group ? [i] : []));
  }

  /**
   * Shooting for the 8: a group, and none of it left. Also an open table with nothing but the 8 on it,
   * which the rules never mention and which would otherwise leave nothing legal to hit.
   */
  onEight(seat: Seat): boolean {
    if (this.balls[8] === null) return false;
    if (this.groupOf(seat) === null) return this.broken && this.balls.every((ball, i) => !ball || i === 0 || i === 8);
    return this.left(seat).length === 0;
  }

  /** The balls the cue ball may touch first. */
  targets(seat: Seat): number[] {
    const on = this.balls.flatMap((ball, i) => (ball && i > 0 ? [i] : []));
    if (!this.broken) return on;
    if (this.onEight(seat)) return [8];
    const group = this.groupOf(seat);
    return on.filter((i) => i !== 8 && (!group || groupOfBall(i) === group));
  }

  accepts(move: PoolMove): boolean {
    if (this.result) return false;
    const shot = parseShot(move);
    if (!shot) return false;
    if (!Number.isInteger(shot.dx) || !Number.isInteger(shot.dy) || (shot.dx === 0 && shot.dy === 0)) return false;
    if (Math.abs(shot.dx) > MAX_AIM || Math.abs(shot.dy) > MAX_AIM) return false;
    if (!Number.isInteger(shot.power) || shot.power < 1 || shot.power > MAX_POWER) return false;
    if ((this.inHand === 'none') !== (shot.place === null)) return false;
    if (shot.place) {
      if (!canPlace(this.balls, shot.place)) return false;
      if (this.inHand === 'kitchen' && shot.place.y < HEAD_STRING) return false;
    }
    if (this.onEight(this.currentSeat) !== (shot.call !== null)) return false;
    return true;
  }

  /** A spread of shots round the compass at three powers, for bots and tests; `accepts` is the whole truth. */
  legalMoves(seat: Seat): readonly PoolMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    const place = this.inHand === 'none' ? null : this.defaultSpot();
    if (this.inHand !== 'none' && !place) return [];
    const moves: PoolMove[] = [];
    const calling = this.onEight(seat);
    SPREAD.forEach(([dx, dy], i) => {
      for (const power of [25, 55, 85]) moves.push(encodeShot({ dx, dy, power, place, call: calling ? i % POCKETS.length : null }));
    });
    return moves;
  }

  /** Where the cue ball goes by default when it is in hand: the middle of the head, or the first free spot near it. */
  defaultSpot(): TablePoint | null {
    const home = { x: TABLE_W / 2, y: Math.round((HEAD_STRING + TABLE_H) / 2) };
    for (let r = 0; r < 800; r += 20) {
      for (const [sx, sy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
        const at = { x: home.x + sx * r, y: home.y + sy * r };
        if (canPlace(this.balls, at) && (this.inHand !== 'kitchen' || at.y >= HEAD_STRING)) return at;
      }
    }
    return null;
  }

  apply(move: PoolMove): PoolState {
    if (this.result) throw new Error('Game is over');
    if (!this.accepts(move)) throw new Error(`Illegal move: ${move}`);
    return this.shoot(parseShot(move)!, true);
  }

  /** Plays a shot out and applies the rules to what happened. `frames` is off when a bot is only looking. */
  shoot(shot: PoolShot, frames: boolean): PoolState {
    const shooter = this.currentSeat;
    const other = 1 - shooter;
    const from = this.balls.slice();
    if (shot.place) from[0] = shot.place;
    const length = Math.sqrt(shot.dx * shot.dx + shot.dy * shot.dy);
    const speed = (TOP_SPEED * shot.power) / MAX_POWER;
    const outcome = simulate(from, (shot.dx / length) * speed, (shot.dy / length) * speed, frames);

    const firstContact = outcome.events.find((e) => e.kind === 'hit' && (e.a === 0 || e.b === 0));
    const firstHit = firstContact && firstContact.kind === 'hit' ? (firstContact.a === 0 ? firstContact.b : firstContact.a) : null;
    const pockets = outcome.events.flatMap((e) => (e.kind === 'pocket' ? [e] : []));
    const pocketed = pockets.map((e) => e.ball);
    const scratch = pocketed.includes(0);
    const railAfter = firstContact !== undefined && outcome.events.some((e) => e.kind === 'cushion' && e.t >= firstContact.t);
    const objectsIn = pocketed.filter((b) => b !== 0);

    const balls = outcome.balls.slice();
    let solids = this.solids;
    let foul: Foul | null = null;
    let result: GameResult | null = null;
    let respotted = false;
    let kept = false;

    if (!this.broken) {
      // The break: anything may be hit, and the table stays open whatever goes in.
      foul = scratch ? 'scratch' : firstHit === null ? 'miss' : null;
      if (pocketed.includes(8)) {
        balls[8] = spotNear(balls, FOOT_SPOT);
        respotted = true;
      }
      kept = !foul && objectsIn.some((b) => b !== 8);
    } else {
      const legalFirst = firstHit !== null && this.targets(shooter).includes(firstHit);
      foul = scratch ? 'scratch' : firstHit === null ? 'miss' : !legalFirst ? 'wrong-ball' : objectsIn.length === 0 && !railAfter ? 'no-rail' : null;
      if (pocketed.includes(8)) {
        const called = pockets.find((e) => e.ball === 8)!.pocket === shot.call;
        const wins = this.onEight(shooter) && !foul && called;
        result = { winners: [wins ? shooter : other], draw: false };
      } else {
        if (solids === null && !foul) {
          const first = objectsIn.find((b) => groupOfBall(b) !== null);
          if (first !== undefined) solids = groupOfBall(first) === 'solids' ? shooter : other;
        }
        const mine = solids === null ? null : solids === shooter ? 'solids' : 'stripes';
        kept = !foul && mine !== null && objectsIn.some((b) => groupOfBall(b) === mine);
      }
    }
    if (scratch) balls[0] = null;
    const next = kept ? shooter : other;
    const inHand: InHand = result ? 'none' : foul ? 'anywhere' : 'none';
    const report: ShotReport = { shooter, from, outcome, firstHit, pocketed, foul, respotted, kept };
    return new PoolState(balls, solids, result ? shooter : next, inHand, true, result, report);
  }
}

/** The first free spot on the long line from `spot` towards the foot rail, then towards the head. */
function spotNear(balls: readonly (TablePoint | null)[], spot: TablePoint): TablePoint {
  for (let d = 0; d < TABLE_H; d += 1) {
    for (const y of [spot.y - d, spot.y + d]) {
      const at = { x: spot.x, y };
      if (canPlace(balls, at, 8)) return at;
    }
  }
  return spot;
}

/** 64 directions as whole-number pairs round a square, which covers the compass without an angle. */
const SPREAD: readonly [number, number][] = (() => {
  const out: [number, number][] = [];
  const n = 8;
  for (let i = -n; i < n; i++) out.push([i * 1000, -n * 1000]);
  for (let i = -n; i < n; i++) out.push([n * 1000, i * 1000]);
  for (let i = n; i > -n; i--) out.push([i * 1000, n * 1000]);
  for (let i = n; i > -n; i--) out.push([-n * 1000, i * 1000]);
  return out;
})();

export function newPool(seed: number): PoolState {
  const rng = createRng(seed);
  // The 8 in the middle (slot 4) and a solid and a stripe in the back corners (slots 10 and 14); the rest shuffled.
  const solids = [1, 2, 3, 4, 5, 6, 7];
  const stripes = [9, 10, 11, 12, 13, 14, 15];
  const cornerSolid = solids.splice(rng.int(solids.length), 1)[0]!;
  const cornerStripe = stripes.splice(rng.int(stripes.length), 1)[0]!;
  const rest = [...solids, ...stripes];
  for (let i = rest.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [rest[i], rest[j]] = [rest[j]!, rest[i]!];
  }
  const order: number[] = [];
  let k = 0;
  for (let slot = 0; slot < 15; slot++) {
    if (slot === 4) order.push(8);
    else if (slot === 10) order.push(rng.next() < 0.5 ? cornerSolid : cornerStripe);
    else if (slot === 14) order.push(order[10] === cornerSolid ? cornerStripe : cornerSolid);
    else order.push(rest[k++]!);
  }
  return new PoolState(rackBalls(order), null, 0, 'kitchen', false, null, null);
}

/** How a tier plans: how far its hand shakes (mm at the object ball), and how many shots it thinks about. */
const TIERS: Record<BotTier, { readonly shake: number; readonly shots: number; readonly powers: readonly number[] }> = {
  easy: { shake: 55, shots: 6, powers: [55] },
  medium: { shake: 24, shots: 18, powers: [40, 65] },
  hard: { shake: 9, shots: 40, powers: [30, 50, 75] },
  expert: { shake: 2, shots: 80, powers: [28, 45, 65, 85] },
};

/** A pocket's aim point: a little way into the table from its centre, where a ball drops cleanly. */
function aimPoint(pocket: number): TablePoint {
  const p = POCKETS[pocket]!;
  const cx = TABLE_W / 2;
  const cy = TABLE_H / 2;
  const dx = cx - p.x;
  const dy = cy - p.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  return { x: p.x + (dx / d) * 30, y: p.y + (dy / d) * 30 };
}

/** A direction as whole numbers towards `to` from `from`, fine enough to aim with. */
function aimAt(from: TablePoint, to: TablePoint): [number, number] {
  let dx = Math.round((to.x - from.x) * 16);
  let dy = Math.round((to.y - from.y) * 16);
  while (Math.abs(dx) > MAX_AIM || Math.abs(dy) > MAX_AIM) {
    dx = Math.round(dx / 2);
    dy = Math.round(dy / 2);
  }
  if (dx === 0 && dy === 0) dy = -1;
  return [dx, dy];
}

interface Plan {
  readonly place: TablePoint | null;
  readonly target: TablePoint;
  readonly call: number | null;
  readonly power: number;
  readonly ease: number;
}

/**
 * The bot: for each ball it may hit and each pocket, the ghost-ball aim that sends it there, tried at
 * a few powers with the same simulation the table uses, and scored on what happens. It sees exactly
 * what a person sees; the hand shake is where the tiers differ most.
 */
function createPoolBot(tier: BotTier): Bot<PoolMove> {
  const knobs = TIERS[tier];
  return {
    chooseMove(generic: GameState<PoolMove>, seat: Seat, rng: Rng): PoolMove {
      const state = generic as PoolState;
      const calling = state.onEight(seat);
      if (!state.broken) {
        const place = state.defaultSpot()!;
        const [dx, dy] = aimAt(place, { x: FOOT_SPOT.x + (rng.next() - 0.5) * 20, y: FOOT_SPOT.y });
        return encodeShot({ dx, dy, power: 92 + rng.int(9), place, call: null });
      }
      const plans: Plan[] = [];
      for (const target of state.targets(seat)) {
        const ball = state.balls[target]!;
        for (let pocket = 0; pocket < POCKETS.length; pocket++) {
          const aim = aimPoint(pocket);
          const tx = aim.x - ball.x;
          const ty = aim.y - ball.y;
          const td = Math.sqrt(tx * tx + ty * ty);
          const ghost = { x: ball.x - (tx / td) * 2 * BALL_R, y: ball.y - (ty / td) * 2 * BALL_R };
          const cues: TablePoint[] = [];
          if (state.inHand === 'none') cues.push(state.balls[0]!);
          else {
            // In hand: put the cue ball straight behind the ghost ball, if there is room.
            for (const back of [260, 420, 160]) {
              const at = { x: Math.round(ghost.x - (tx / td) * back), y: Math.round(ghost.y - (ty / td) * back) };
              if (canPlace(state.balls, at) && (state.inHand !== 'kitchen' || at.y >= HEAD_STRING)) {
                cues.push(at);
                break;
              }
            }
          }
          for (const cue of cues) {
            const cx = ghost.x - cue.x;
            const cy = ghost.y - cue.y;
            const cd = Math.sqrt(cx * cx + cy * cy);
            const cut = (cx * tx + cy * ty) / (cd * td);
            if (cut < 0.3) continue;
            for (const power of knobs.powers) {
              plans.push({ place: state.inHand === 'none' ? null : cue, target: ghost, call: calling ? pocket : null, power, ease: cut / (1 + (cd + td) / 1500) });
            }
          }
        }
      }
      if (plans.length === 0) {
        const moves = state.legalMoves(seat);
        return rng.pick(moves);
      }
      plans.sort((a, b) => b.ease - a.ease);
      let best: { plan: Plan; score: number } | null = null;
      for (const plan of plans.slice(0, knobs.shots)) {
        const from = plan.place ?? state.balls[0]!;
        const [dx, dy] = aimAt(from, plan.target);
        const after = state.shoot({ dx, dy, power: plan.power, place: plan.place, call: plan.call }, false);
        const score = scoreFor(after, seat) + plan.ease * 10 + rng.next();
        if (!best || score > best.score) best = { plan, score };
      }
      const { plan } = best!;
      const from = plan.place ?? state.balls[0]!;
      // The hand shakes: the aim point moves a little, most for the easy tiers.
      const shaken = { x: plan.target.x + (rng.next() - 0.5) * 2 * knobs.shake, y: plan.target.y + (rng.next() - 0.5) * 2 * knobs.shake };
      const [dx, dy] = aimAt(from, shaken);
      return encodeShot({ dx, dy, power: plan.power, place: plan.place, call: plan.call });
    },
  };
}

/** How good a table is for `seat` after a shot. */
function scoreFor(after: PoolState, seat: Seat): number {
  if (after.result) return after.result.winners.includes(seat) ? 1_000_000 : -1_000_000;
  const report = after.last!;
  let score = 0;
  if (report.foul) score -= 600;
  if (report.kept) score += 400 + 40 * report.pocketed.length;
  // Fewer of your own left is better; fewer of theirs left is worse.
  const mine = after.solids === null ? 0 : after.left(seat).length;
  const theirs = after.solids === null ? 0 : after.left(1 - seat).length;
  score += (theirs - mine) * 15;
  return score;
}

export const pool: GameDefinition<PoolMove> = {
  id: 'pool',
  name: 'Pool',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: false,
  realtime: false,
  newGame: (_config, seed) => newPool(seed),
  createBot: (tier) => createPoolBot(tier),
  encodeMove: (move) => move,
  decodeMove: (key) => (parseShot(key) ? key : null),
};
