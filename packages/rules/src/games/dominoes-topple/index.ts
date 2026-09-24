import type { Rng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Dominoes Topple (docs/games/dominoes-topple.md), a chill toy: lay a line of dominoes with your
 * finger, tip the first, and watch them fall one after another. The chain is worked out here, not
 * in the scene: a falling domino lands on the nearest standing one in front of it, within its
 * length and its width, and that one falls on in the way it faces. Knock every domino down with
 * one push, with at least TOPPLE_GOAL on the table, and it is done.
 */
export const TOPPLE_TABLE = { w: 560, h: 700 };
/** How far a falling domino's top reaches from its base, how thick and how wide it is. */
export const TOPPLE_REACH = 46;
export const TOPPLE_THICK = 9;
export const TOPPLE_WIDE = 26;
/** The gap a drawn line leaves between dominoes, and the least gap the table allows. */
export const TOPPLE_SPACING = 24;
const MIN_GAP = 14;
const EDGE = 16;
export const TOPPLE_MAX = 120;
export const TOPPLE_GOAL = 20;

export interface Domino {
  readonly x: number;
  readonly y: number;
  /** The way it faces, in degrees: 0 is to the right, 90 is down the table. */
  readonly a: number;
}

/** One domino falling: which, when (ms after the push) and which way. */
export interface Fall {
  readonly i: number;
  readonly at: number;
  readonly dir: number;
}

export type ToppleLast = { kind: 'lay' } | { kind: 'tip'; falls: readonly Fall[] } | { kind: 'up' } | { kind: 'clear' };

/** `l120,300,45` lays a domino; `t4` tips domino 4; `up` stands them all up again; `clear` empties the table. */
export type ToppleMove = string;
export const layMove = (x: number, y: number, a: number): ToppleMove => `l${Math.round(x)},${Math.round(y)},${((Math.round(a) % 360) + 360) % 360}`;

function parseLay(move: string): Domino | null {
  const m = /^l(\d{1,3}),(\d{1,3}),(\d{1,3})$/.exec(move);
  return m ? { x: Number(m[1]), y: Number(m[2]), a: Number(m[3]) } : null;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/** The chain from a push on domino `first`: every domino that falls, in the order they fall. */
export function toppleChain(dominoes: readonly Domino[], down: readonly boolean[], first: number): Fall[] {
  const falls: Fall[] = [];
  const queued = new Set<number>([first]);
  const waiting: Fall[] = [{ i: first, at: 0, dir: dominoes[first]!.a }];
  while (waiting.length) {
    waiting.sort((p, q) => p.at - q.at || p.i - q.i);
    const f = waiting.shift()!;
    falls.push(f);
    const from = dominoes[f.i]!;
    const ux = Math.cos(rad(f.dir));
    const uy = Math.sin(rad(f.dir));
    // Everything standing in front, within its reach and under its width.
    const hits: { j: number; along: number }[] = [];
    dominoes.forEach((d, j) => {
      if (down[j] || queued.has(j)) return;
      const vx = d.x - from.x;
      const vy = d.y - from.y;
      const along = vx * ux + vy * uy;
      const side = Math.abs(vx * uy - vy * ux);
      if (along > TOPPLE_THICK / 2 && along <= TOPPLE_REACH && side <= TOPPLE_WIDE * 0.8) hits.push({ j, along });
    });
    if (!hits.length) continue;
    // It lands on the nearest; one standing beside that one, just as near, goes too (a fork).
    const nearest = Math.min(...hits.map((h) => h.along));
    for (const h of hits)
      if (h.along <= nearest + 6) {
        const d = dominoes[h.j]!;
        // Pushed from behind it falls the way it faces, from in front the other way.
        const facing = Math.cos(rad(d.a - f.dir)) >= 0 ? d.a : (d.a + 180) % 360;
        queued.add(h.j);
        waiting.push({ i: h.j, at: f.at + 40 + Math.round(h.along * 2.2), dir: facing });
      }
  }
  return falls;
}

export class ToppleState implements GameState<ToppleMove> {
  readonly currentSeat: Seat = 0;

  constructor(
    readonly dominoes: readonly Domino[],
    readonly down: readonly boolean[],
    readonly pushes: number,
    readonly last: ToppleLast | null,
    readonly result: GameResult | null,
  ) {}

  get standing(): number {
    return this.down.filter((d) => !d).length;
  }

  /** Any spot on the table is a lay, so this is the authority and `legalMoves` is a spread. */
  allows(move: ToppleMove): boolean {
    if (this.result) return false;
    const lay = parseLay(move);
    if (lay) {
      const { w, h } = TOPPLE_TABLE;
      if (this.dominoes.length >= TOPPLE_MAX || lay.a >= 360) return false;
      if (lay.x < EDGE || lay.y < EDGE || lay.x > w - EDGE || lay.y > h - EDGE) return false;
      return this.dominoes.every((d) => Math.hypot(d.x - lay.x, d.y - lay.y) >= MIN_GAP);
    }
    const tip = /^t(\d+)$/.exec(move);
    if (tip) return Number(tip[1]) < this.dominoes.length && !this.down[Number(tip[1])];
    if (move === 'up') return this.down.some((d) => d);
    if (move === 'clear') return this.dominoes.length > 0;
    return false;
  }

  /** Tips of every standing domino, standing up, clearing, and the next domino along the line. */
  legalMoves(seat: Seat): readonly ToppleMove[] {
    if (this.result || seat !== 0) return [];
    const out: ToppleMove[] = this.dominoes.flatMap((_, i) => (this.down[i] ? [] : [`t${i}`]));
    const tail = this.dominoes[this.dominoes.length - 1];
    const next = tail ? layMove(tail.x + TOPPLE_SPACING * Math.cos(rad(tail.a)), tail.y + TOPPLE_SPACING * Math.sin(rad(tail.a)), tail.a) : layMove(80, 140, 0);
    for (const m of [next, 'up', 'clear']) if (this.allows(m)) out.push(m);
    return out;
  }

  apply(move: ToppleMove): ToppleState {
    if (!this.allows(move)) throw new Error(`Illegal move: ${move}`);
    const lay = parseLay(move);
    if (lay) return new ToppleState([...this.dominoes, lay], [...this.down, false], this.pushes, { kind: 'lay' }, null);
    if (move === 'up') return new ToppleState(this.dominoes, this.dominoes.map(() => false), this.pushes, { kind: 'up' }, null);
    if (move === 'clear') return new ToppleState([], [], this.pushes, { kind: 'clear' }, null);
    const falls = toppleChain(this.dominoes, this.down, Number(move.slice(1)));
    const down = [...this.down];
    for (const f of falls) down[f.i] = true;
    // All of them down from one push, standing up in full before it: that is the run done.
    const all = falls.length === this.dominoes.length && this.dominoes.length >= TOPPLE_GOAL;
    return new ToppleState(this.dominoes, down, this.pushes + 1, { kind: 'tip', falls }, all ? { winners: [0], draw: false } : null);
  }
}

export const newTopple = () => new ToppleState([], [], 0, null, null);

/**
 * The line test play lays: along the table, round a U-turn and back. Each step turns
 * 22.5 degrees on the bend, well inside what the chain carries round.
 */
export function topplePath(count: number): Domino[] {
  const out: Domino[] = [];
  let x = 80;
  let y = 140;
  let a = 0;
  for (let k = 0; k < count; k++) {
    out.push({ x: Math.round(x), y: Math.round(y), a: ((Math.round(a) % 360) + 360) % 360 });
    const bend = k >= 16 && k < 24;
    if (bend) a += 22.5;
    x += TOPPLE_SPACING * Math.cos(rad(a));
    y += TOPPLE_SPACING * Math.sin(rad(a));
  }
  return out;
}

/** Test play: lay the path, then push the first one over. */
function createToppleBot(): Bot<ToppleMove> {
  const path = topplePath(30);
  return {
    chooseMove(generic: GameState<ToppleMove>, _seat: Seat, _rng: Rng): ToppleMove {
      const s = generic as ToppleState;
      if (s.down.some((d) => d)) return 'up';
      if (s.dominoes.length < path.length) {
        const d = path[s.dominoes.length]!;
        return layMove(d.x, d.y, d.a);
      }
      return 't0';
    },
  };
}

export const dominoesTopple: GameDefinition<ToppleMove> = {
  id: 'dominoes-topple',
  name: 'Dominoes Topple',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo'],
  hiddenInfo: false,
  realtime: false,
  newGame: () => newTopple(),
  createBot: () => createToppleBot(),
  encodeMove: (move) => move,
  decodeMove: (key) => key,
};
