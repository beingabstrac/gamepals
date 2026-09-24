import type { BotTier, GameResult, RealtimeGameDefinition, Seat } from '../../core/types';

/**
 * Tank Duel (docs/games/tank-duel.md): one button each. Your tank spins on the spot; hold your
 * button and it drives the way it is facing; every press fires a shell, which bounces off the
 * walls. Hit the other tank to win the round; first to five rounds.
 * Real time, a pure fixed step like the other duels.
 */
export const TANK_CANVAS = { width: 600, height: 900 } as const;
export const TANK_STEP = 1 / 120;
export const TANK_R = 24;
export const SHELL_R = 6;
export const TANK_WIN = 5;
/** The blocks in the arena, the same turned round for each player. */
export const TANK_WALLS: readonly { x: number; y: number; w: number; h: number }[] = [
  { x: 250, y: 420, w: 100, h: 60 },
  { x: 70, y: 250, w: 170, h: 30 },
  { x: 360, y: 620, w: 170, h: 30 },
  { x: 430, y: 170, w: 30, h: 150 },
  { x: 140, y: 580, w: 30, h: 150 },
];

const COUNTDOWN = 1.2;
const PAUSE = 1.3;
/** A round that nobody wins in this long is called off and played again. */
const ROUND_LIMIT = 40;
const DRIVE = 170;
const TURN = 2.8;
const SHELL_SPEED = 430;
const SHELL_LIFE = 3;
const SHELL_BOUNCES = 3;
const MAX_SHELLS = 3;
const RELOAD = 0.25;

export interface Tank {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly held: boolean;
  readonly reload: number;
}

export interface Shell {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly owner: Seat;
  readonly age: number;
  readonly bounces: number;
}

export interface TankState {
  readonly seed: number;
  readonly phase: 'countdown' | 'play' | 'hit' | 'over';
  readonly timer: number;
  /** Seconds into this round. */
  readonly round: number;
  /** Rounds played so far, called-off ones too. */
  readonly rounds: number;
  readonly tanks: readonly [Tank, Tank];
  readonly shells: readonly Shell[];
  readonly scores: readonly [number, number];
  /** Who was hit last, for the scene's explosion. */
  readonly hit: readonly Seat[];
  readonly result: GameResult | null;
}

export interface TankInput {
  readonly held: boolean;
}

export interface TankEvents {
  fired: Seat[];
  bounced: number;
  hit: Seat[];
  /** A round called off with nobody hit. */
  timeout: boolean;
}

/** A tank while a step works on it. */
type Moving = { -readonly [K in keyof Tank]: Tank[K] };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function hash(seed: number, n: number): number {
  let h = (seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 2 ** 32;
}

/** Both tanks at their ends, each turned a seeded way off straight ahead, different every round. */
export function startTanks(seed: number, rounds: number): [Tank, Tank] {
  const off = (seat: number) => (hash(seed, rounds * 2 + seat + 101) * 2 - 1) * 1.2;
  return [
    { x: TANK_CANVAS.width / 2, y: TANK_CANVAS.height - 90, angle: -Math.PI / 2 + off(0), held: false, reload: 0 },
    { x: TANK_CANVAS.width / 2, y: 90, angle: Math.PI / 2 + off(1), held: false, reload: 0 },
  ];
}

export function newTankDuel(seed: number): TankState {
  return { seed, phase: 'countdown', timer: COUNTDOWN, round: 0, rounds: 0, tanks: startTanks(seed, 0), shells: [], scores: [0, 0], hit: [], result: null };
}

/** Pushes a circle out of the walls and the edges; returns the normal it was pushed along, if any. */
function pushOut(p: { x: number; y: number }, r: number): { nx: number; ny: number } | null {
  const { width: W, height: H } = TANK_CANVAS;
  let normal: { nx: number; ny: number } | null = null;
  if (p.x < r) (p.x = r), (normal = { nx: 1, ny: 0 });
  if (p.x > W - r) (p.x = W - r), (normal = { nx: -1, ny: 0 });
  if (p.y < r) (p.y = r), (normal = { nx: 0, ny: 1 });
  if (p.y > H - r) (p.y = H - r), (normal = { nx: 0, ny: -1 });
  for (const w of TANK_WALLS) {
    const cx = clamp(p.x, w.x, w.x + w.w);
    const cy = clamp(p.y, w.y, w.y + w.h);
    const dx = p.x - cx;
    const dy = p.y - cy;
    const d = Math.hypot(dx, dy);
    if (d >= r) continue;
    if (d > 1e-6) {
      p.x = cx + (dx / d) * r;
      p.y = cy + (dy / d) * r;
      normal = { nx: dx / d, ny: dy / d };
    } else {
      // Its middle is inside the block: out through the nearest face.
      const faces = [
        { d: p.x - w.x, nx: -1, ny: 0 },
        { d: w.x + w.w - p.x, nx: 1, ny: 0 },
        { d: p.y - w.y, nx: 0, ny: -1 },
        { d: w.y + w.h - p.y, nx: 0, ny: 1 },
      ];
      const f = faces.reduce((a, b) => (b.d < a.d ? b : a));
      p.x += f.nx * (f.d + r);
      p.y += f.ny * (f.d + r);
      normal = { nx: f.nx, ny: f.ny };
    }
  }
  return normal;
}

/** Is the straight line between two points clear of every block? */
export function clearLine(ax: number, ay: number, bx: number, by: number, pad = 0): boolean {
  const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 10);
  for (let i = 1; i < steps; i++) {
    const x = ax + ((bx - ax) * i) / steps;
    const y = ay + ((by - ay) * i) / steps;
    for (const w of TANK_WALLS) if (x > w.x - pad && x < w.x + w.w + pad && y > w.y - pad && y < w.y + w.h + pad) return false;
  }
  return true;
}

/** Advances the match by one fixed step. Pure. */
export function stepTank(state: TankState, inputs: readonly [TankInput, TankInput], dt = TANK_STEP): { state: TankState; events: TankEvents } {
  const events: TankEvents = { fired: [], bounced: 0, hit: [], timeout: false };
  if (state.result) return { state, events };
  if (state.phase === 'countdown') {
    const timer = state.timer - dt;
    // Holding through the countdown does not count as a press when it ends.
    const tanks = state.tanks.map((t, i) => ({ ...t, held: inputs[i]!.held })) as unknown as [Tank, Tank];
    return { state: { ...state, tanks, timer: Math.max(timer, 0), phase: timer > 0 ? 'countdown' : 'play' }, events };
  }
  if (state.phase === 'hit') {
    const timer = state.timer - dt;
    if (timer > 0) return { state: { ...state, timer }, events };
    const rounds = state.rounds + 1;
    return { state: { ...state, phase: 'countdown', timer: COUNTDOWN, round: 0, rounds, tanks: startTanks(state.seed, rounds), shells: [], hit: [] }, events };
  }
  const fired: Shell[] = [];
  const tanks = state.tanks.map((t, i) => {
    const seat = i as Seat;
    const held = inputs[seat].held;
    const tank: Moving = { ...t, held, reload: Math.max(t.reload - dt, 0) };
    if (held && !t.held && tank.reload === 0 && state.shells.filter((s) => s.owner === seat).length < MAX_SHELLS) {
      // A press fires a shell from the end of the barrel.
      const ux = Math.cos(t.angle);
      const uy = Math.sin(t.angle);
      fired.push({ x: t.x + ux * (TANK_R + 4), y: t.y + uy * (TANK_R + 4), vx: ux * SHELL_SPEED, vy: uy * SHELL_SPEED, owner: seat, age: 0, bounces: 0 });
      tank.reload = RELOAD;
      events.fired.push(seat);
    }
    if (held) {
      tank.x += Math.cos(t.angle) * DRIVE * dt;
      tank.y += Math.sin(t.angle) * DRIVE * dt;
    } else tank.angle = (t.angle + TURN * dt) % (Math.PI * 2);
    pushOut(tank, TANK_R);
    return tank;
  }) as [Moving, Moving];
  // Tanks shove each other apart.
  const [a, b] = tanks;
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  if (d < 2 * TANK_R && d > 1e-6) {
    const push = (2 * TANK_R - d) / 2;
    const ux = (b.x - a.x) / d;
    const uy = (b.y - a.y) / d;
    a.x -= ux * push;
    a.y -= uy * push;
    b.x += ux * push;
    b.y += uy * push;
    pushOut(a, TANK_R);
    pushOut(b, TANK_R);
  }
  const hit = new Set<Seat>();
  const shells: Shell[] = [];
  for (const s of [...state.shells, ...fired]) {
    const fresh = fired.includes(s);
    const p = { x: s.x + (fresh ? 0 : s.vx * dt), y: s.y + (fresh ? 0 : s.vy * dt) };
    let { vx, vy } = s;
    let bounces = s.bounces;
    const n = pushOut(p, SHELL_R);
    if (n && vx * n.nx + vy * n.ny < 0) {
      const along = vx * n.nx + vy * n.ny;
      vx -= 2 * along * n.nx;
      vy -= 2 * along * n.ny;
      bounces++;
      events.bounced++;
    }
    const age = s.age + (fresh ? 0 : dt);
    let spent = age > SHELL_LIFE || bounces > SHELL_BOUNCES;
    for (const seat of [0, 1] as const) {
      const t = tanks[seat];
      // Your own shells never hurt you: a bounce back is a near miss, not a loss.
      if (seat === s.owner) continue;
      if (Math.hypot(p.x - t.x, p.y - t.y) < TANK_R + SHELL_R) {
        hit.add(seat);
        spent = true;
      }
    }
    if (!spent) shells.push({ ...s, x: p.x, y: p.y, vx, vy, age, bounces });
  }
  const round = state.round + dt;
  if (hit.size) {
    events.hit = [...hit];
    const scores: [number, number] = [state.scores[0], state.scores[1]];
    // Both hit at once: nobody scores.
    if (hit.size === 1) scores[hit.has(0) ? 1 : 0]++;
    const won = scores.findIndex((v) => v >= TANK_WIN);
    const result: GameResult | null = won >= 0 ? { winners: [won as Seat], draw: false } : null;
    return { state: { ...state, tanks, shells: [], scores, hit: [...hit], round, phase: result ? 'over' : 'hit', timer: PAUSE, result }, events };
  }
  if (round > ROUND_LIMIT) {
    events.timeout = true;
    return { state: { ...state, tanks, shells: [], round, phase: 'hit', timer: PAUSE, hit: [] }, events };
  }
  return { state: { ...state, tanks, shells, round }, events };
}

export interface TankTier {
  /** How close to straight at the other tank it must be facing before it fires, in radians. */
  readonly aim: number;
  /** Chance, each step it could fire, that it does. */
  readonly trigger: number;
  /** How far ahead, in seconds, it looks for shells coming at it to get out of the way of (0: never). */
  readonly dodge: number;
  /** Does it aim ahead of a moving tank? */
  readonly lead: boolean;
}

export const TANK_TIERS: Record<BotTier, TankTier> = {
  easy: { aim: 0.32, trigger: 0.02, dodge: 0, lead: false },
  medium: { aim: 0.2, trigger: 0.05, dodge: 0.3, lead: false },
  hard: { aim: 0.16, trigger: 0.1, dodge: 0.45, lead: false },
  expert: { aim: 0.06, trigger: 1, dodge: 0.9, lead: true },
};

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Open spots on a grid across the arena, clear of every block, for bots to drive between. */
const WAYPOINTS: readonly { x: number; y: number }[] = (() => {
  const out: { x: number; y: number }[] = [];
  for (let x = 60; x <= TANK_CANVAS.width - 60; x += 80)
    for (let y = 50; y <= TANK_CANVAS.height - 50; y += 80) {
      const p = { x, y };
      pushOut(p, TANK_R + 12);
      if (p.x === x && p.y === y) out.push(p);
    }
  return out;
})();

/** Which waypoints a tank can drive straight between, worked out once. */
const LINKS: readonly (readonly { to: number; d: number }[])[] = WAYPOINTS.map((a, i) =>
  WAYPOINTS.flatMap((b, j) => {
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    return j !== i && d < 180 && clearLine(a.x, a.y, b.x, b.y, TANK_R - 4) ? [{ to: j, d }] : [];
  }),
);

/** How far each waypoint is, by road, from any waypoint that can see (x, y). */
function roadTo(x: number, y: number): number[] {
  const dist = WAYPOINTS.map((w) => (clearLine(w.x, w.y, x, y, SHELL_R) ? 0 : Infinity));
  // Few nodes and short links: relaxing until nothing changes is quick enough.
  for (let changed = true; changed; ) {
    changed = false;
    LINKS.forEach((links, i) => {
      for (const { to, d } of links)
        if (dist[to]! + d < dist[i]!) {
          dist[i] = dist[to]! + d;
          changed = true;
        }
    });
  }
  return dist;
}

/**
 * Bot hand: one button like everyone else. It fires when it faces the other tank with a clear
 * line, gets out of the way of shells heading at it (if its tier looks), and otherwise drives
 * when it faces roughly toward the other tank with room ahead, and spins when it does not.
 */
export function tankBotInput(state: TankState, seat: Seat, tier: TankTier): TankInput {
  if (state.phase !== 'play') return { held: false };
  const me = state.tanks[seat];
  const them = state.tanks[seat === 0 ? 1 : 0];
  const step = Math.round(state.round / TANK_STEP) + state.rounds * 100_000;
  const facing = (x: number, y: number) => Math.abs(wrap(Math.atan2(y - me.y, x - me.x) - me.angle));
  // Out of the way of a shell that will pass close in the next half second.
  if (tier.dodge > 0) {
    for (const s of state.shells) {
      if (s.owner === seat) continue;
      const rx = me.x - s.x;
      const ry = me.y - s.y;
      const t = (rx * s.vx + ry * s.vy) / (SHELL_SPEED * SHELL_SPEED);
      if (t <= 0 || t > tier.dodge) continue;
      const miss = Math.hypot(s.x + s.vx * t - me.x, s.y + s.vy * t - me.y);
      if (miss > TANK_R + SHELL_R + 8) continue;
      // Drive if facing across its path; otherwise keep turning until it is.
      const across = Math.abs(Math.cos(me.angle) * s.vx + Math.sin(me.angle) * s.vy) / SHELL_SPEED;
      return { held: across < 0.5 };
    }
  }
  let tx = them.x;
  let ty = them.y;
  if (tier.lead && them.held) {
    const t = Math.hypot(them.x - me.x, them.y - me.y) / SHELL_SPEED;
    tx += Math.cos(them.angle) * DRIVE * t;
    ty += Math.sin(them.angle) * DRIVE * t;
  }
  const sight = clearLine(me.x, me.y, tx, ty, SHELL_R);
  const mine = state.shells.filter((s) => s.owner === seat).length;
  if (sight && facing(tx, ty) < tier.aim && me.reload === 0 && mine < MAX_SHELLS) {
    // A press fires: let go first if it is already holding.
    if (me.held) return { held: false };
    return { held: hash(state.seed, step * 2 + seat) < tier.trigger };
  }
  // Keep a little way off once it can see the other tank; close in when it cannot.
  const far = Math.hypot(them.x - me.x, them.y - me.y) > (sight ? 260 : 60);
  const ahead = { x: me.x + Math.cos(me.angle) * 70, y: me.y + Math.sin(me.angle) * 70 };
  const room = clearLine(me.x, me.y, ahead.x, ahead.y, TANK_R) && ahead.x > TANK_R && ahead.x < TANK_CANVAS.width - TANK_R && ahead.y > TANK_R && ahead.y < TANK_CANVAS.height - TANK_R;
  if (sight) return { held: far && room && facing(tx, ty) < 0.35 };
  // No line of sight: follow the road to the nearest spot that has one.
  const road = roadTo(them.x, them.y);
  let goal: { x: number; y: number } | null = null;
  let best = Infinity;
  WAYPOINTS.forEach((w, i) => {
    const gap = Math.hypot(w.x - me.x, w.y - me.y);
    if (gap < 30 || gap > 200) return;
    const cost = gap + road[i]!;
    if (cost < best - 1 && clearLine(me.x, me.y, w.x, w.y, TANK_R - 4)) {
      best = cost;
      goal = w;
    }
  });
  const to = (goal ?? them) as { x: number; y: number };
  return { held: facing(to.x, to.y) < 0.3 };
}

export const tankDuel: RealtimeGameDefinition = {
  id: 'tank-duel',
  name: 'Tank Duel',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive'],
  realtime: true,
};
