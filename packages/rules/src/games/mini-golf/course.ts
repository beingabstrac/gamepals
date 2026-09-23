/**
 * Mini Golf courses and their physics, in millimetres and milliseconds like Pool's table, and like it
 * using nothing but arithmetic and `Math.sqrt`, so every engine plays a stroke out the same way.
 */

export interface Spot {
  readonly x: number;
  readonly y: number;
}

/** A closed outline, as corner points in order. */
export type Outline = readonly Spot[];

export interface Hole {
  readonly name: string;
  readonly par: number;
  /** The green: the ball stays inside this outline. */
  readonly green: Outline;
  /** Blocks standing on the green that the ball bounces off. */
  readonly blocks: readonly Outline[];
  /** Slopes: inside each, the ball is pushed along (ax, ay) in mm/ms² every millisecond. */
  readonly slopes: readonly { readonly area: Outline; readonly ax: number; readonly ay: number }[];
  readonly sand: readonly Outline[];
  readonly water: readonly Outline[];
  readonly tee: Spot;
  readonly cup: Spot;
}

/** Every course is drawn inside this box, held upright. */
export const COURSE_W = 1000;
export const COURSE_H = 2000;
export const GOLF_R = 21;
export const CUP_R = 54;

/** Carpet slows a ball faster than cloth; sand much faster. */
const ROLL = 0.0009;
const SAND_ROLL = 0.004;
/** Speed kept off a wall. */
const BOUNCE = 0.72;
/** A ball over the cup drops if it is going slower than this (m/s); faster, it skips across. */
const DROP_SPEED = 1.1;
const STOP = 0.003;
const MAX_STEP = 4;
const STEP_TRAVEL = GOLF_R * 0.4;
const MAX_MS = 30_000;
const FRAME_MS = 16;

const rect = (x: number, y: number, w: number, h: number): Outline => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

/**
 * Nine holes of our own, from a plain straight to banks, a slope, sand, water and a narrow gap. They
 * are data: a new hole is a new entry here and nothing else.
 */
export const HOLES: readonly Hole[] = [
  {
    name: 'Warm up',
    par: 2,
    green: rect(300, 250, 400, 1500),
    blocks: [],
    slopes: [],
    sand: [],
    water: [],
    tee: { x: 500, y: 1600 },
    cup: { x: 500, y: 450 },
  },
  {
    name: 'The block',
    par: 2,
    green: rect(250, 250, 500, 1500),
    blocks: [rect(420, 900, 160, 160)],
    slopes: [],
    sand: [],
    water: [],
    tee: { x: 500, y: 1600 },
    cup: { x: 500, y: 450 },
  },
  {
    name: 'Dogleg',
    par: 3,
    green: [
      { x: 150, y: 1800 },
      { x: 150, y: 350 },
      { x: 850, y: 350 },
      { x: 850, y: 750 },
      { x: 500, y: 750 },
      { x: 500, y: 1800 },
    ],
    blocks: [],
    slopes: [],
    sand: [],
    water: [],
    tee: { x: 325, y: 1650 },
    cup: { x: 720, y: 550 },
  },
  {
    name: 'Side hill',
    par: 2,
    green: rect(200, 250, 600, 1500),
    blocks: [],
    slopes: [{ area: rect(200, 700, 600, 600), ax: 0.0006, ay: 0 }],
    sand: [],
    water: [],
    tee: { x: 500, y: 1600 },
    cup: { x: 500, y: 450 },
  },
  {
    name: 'Beach',
    par: 3,
    green: rect(200, 250, 600, 1500),
    blocks: [rect(200, 1000, 300, 60)],
    slopes: [],
    sand: [rect(330, 500, 340, 200)],
    water: [],
    tee: { x: 350, y: 1600 },
    cup: { x: 500, y: 400 },
  },
  {
    name: 'The bridge',
    par: 3,
    green: rect(200, 250, 600, 1500),
    blocks: [],
    slopes: [],
    sand: [],
    water: [rect(200, 850, 230, 260), rect(570, 850, 230, 260)],
    tee: { x: 500, y: 1600 },
    cup: { x: 500, y: 450 },
  },
  {
    name: 'Zigzag',
    par: 3,
    green: rect(200, 250, 600, 1500),
    blocks: [
      [
        { x: 200, y: 1250 },
        { x: 600, y: 1150 },
        { x: 600, y: 1210 },
        { x: 200, y: 1310 },
      ],
      [
        { x: 800, y: 750 },
        { x: 400, y: 650 },
        { x: 400, y: 710 },
        { x: 800, y: 810 },
      ],
    ],
    slopes: [],
    sand: [],
    water: [],
    tee: { x: 330, y: 1600 },
    cup: { x: 650, y: 420 },
  },
  {
    name: 'Round the back',
    par: 3,
    green: rect(150, 250, 700, 1500),
    blocks: [rect(150, 700, 520, 70)],
    slopes: [],
    sand: [],
    water: [],
    tee: { x: 300, y: 1600 },
    cup: { x: 300, y: 450 },
  },
  {
    name: 'The bowl',
    par: 2,
    green: [
      { x: 100, y: 1800 },
      { x: 100, y: 900 },
      { x: 350, y: 300 },
      { x: 650, y: 300 },
      { x: 900, y: 900 },
      { x: 900, y: 1800 },
    ],
    blocks: [],
    slopes: [
      { area: rect(100, 300, 400, 700), ax: 0.00025, ay: -0.00015 },
      { area: rect(500, 300, 400, 700), ax: -0.00025, ay: -0.00015 },
    ],
    sand: [],
    water: [],
    tee: { x: 500, y: 1650 },
    cup: { x: 500, y: 520 },
  },
];

/** Whether a point is inside an outline: count the edges a ray to the right crosses. */
export function inside(area: Outline, x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = area.length - 1; i < area.length; j = i++) {
    const a = area[i]!;
    const b = area[j]!;
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

/** Every wall on a hole as a segment: the green's edge and each block's. */
function wallsOf(hole: Hole): [Spot, Spot][] {
  const walls: [Spot, Spot][] = [];
  for (const outline of [hole.green, ...hole.blocks]) {
    for (let i = 0; i < outline.length; i++) walls.push([outline[i]!, outline[(i + 1) % outline.length]!]);
  }
  return walls;
}

export type StrokeEvent = { readonly t: number; readonly kind: 'wall'; readonly speed: number } | { readonly t: number; readonly kind: 'cup' } | { readonly t: number; readonly kind: 'water' };

export interface StrokeOutcome {
  /** Where the ball came to rest: in the cup, in the water (it goes back), or on the green. */
  readonly end: 'cup' | 'water' | 'rest';
  readonly at: Spot;
  readonly events: readonly StrokeEvent[];
  /** Ball positions every `frameMs`, x then y. */
  readonly frames: readonly number[];
  readonly frameMs: number;
}

/** Plays a stroke out: the ball leaves `from` at `(vx, vy)` and rolls until it stops, drops or drowns. */
export function roll(hole: Hole, from: Spot, vx: number, vy: number, frames = true): StrokeOutcome {
  const walls = wallsOf(hole);
  let x = from.x;
  let y = from.y;
  let ux = vx;
  let uy = vy;
  let t = 0;
  let nextFrame = FRAME_MS;
  const events: StrokeEvent[] = [];
  const kept: number[] = frames ? [x, y] : [];
  let end: StrokeOutcome['end'] = 'rest';
  for (;;) {
    const speed = Math.sqrt(ux * ux + uy * uy);
    if (speed === 0 || t >= MAX_MS) break;
    const dt = Math.min(MAX_STEP, STEP_TRAVEL / speed);
    t += dt;
    x += ux * dt;
    y += uy * dt;
    for (const slope of hole.slopes) {
      if (inside(slope.area, x, y)) {
        ux += slope.ax * dt;
        uy += slope.ay * dt;
      }
    }
    const friction = hole.sand.some((area) => inside(area, x, y)) ? SAND_ROLL : ROLL;
    const now = Math.sqrt(ux * ux + uy * uy);
    const slower = now - friction * dt;
    if (slower <= STOP) {
      ux = 0;
      uy = 0;
    } else {
      ux = (ux * slower) / now;
      uy = (uy * slower) / now;
    }
    const cx = x - hole.cup.x;
    const cy = y - hole.cup.y;
    if (cx * cx + cy * cy < CUP_R * CUP_R && now < DROP_SPEED) {
      end = 'cup';
      x = hole.cup.x;
      y = hole.cup.y;
      events.push({ t, kind: 'cup' });
      break;
    }
    if (hole.water.some((area) => inside(area, x, y))) {
      end = 'water';
      events.push({ t, kind: 'water' });
      break;
    }
    let touched = false;
    for (const [a, b] of walls) {
      const ex = b.x - a.x;
      const ey = b.y - a.y;
      const len2 = ex * ex + ey * ey;
      let k = ((x - a.x) * ex + (y - a.y) * ey) / len2;
      k = k < 0 ? 0 : k > 1 ? 1 : k;
      const px = a.x + ex * k;
      const py = a.y + ey * k;
      const dx = x - px;
      const dy = y - py;
      const d2 = dx * dx + dy * dy;
      if (d2 >= GOLF_R * GOLF_R) continue;
      const d = Math.sqrt(d2) || 1e-9;
      const nx = dx / d;
      const ny = dy / d;
      x = px + nx * GOLF_R;
      y = py + ny * GOLF_R;
      touched = true;
      const into = ux * nx + uy * ny;
      if (into < 0) {
        ux -= (1 + BOUNCE) * into * nx;
        uy -= (1 + BOUNCE) * into * ny;
        ux *= 0.97;
        uy *= 0.97;
        events.push({ t, kind: 'wall', speed: -into });
      }
    }
    // A slope can hold a ball against a wall for ever; nearly still and touching one, it stops.
    if (touched && ux * ux + uy * uy < 0.03 * 0.03) {
      ux = 0;
      uy = 0;
    }
    if (frames && t >= nextFrame) {
      kept.push(x, y);
      nextFrame += FRAME_MS;
    }
  }
  if (frames) kept.push(x, y);
  return { end, at: { x, y }, events, frames: kept, frameMs: FRAME_MS };
}
