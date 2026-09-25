import { createRng, type Rng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Escape Room (docs/games/escape-room.md), room-lite: the lock shows pictures and the code is how
 * many of each there are in the room, in order. Things sit on four walls, some inside drawers,
 * boxes or behind curtains. Three rooms a run.
 */
export const ESCAPE_ROOMS = 3;
export const ESCAPE_WALLS = 4;
/** Things there can be: the scene draws each. A look-alike is the same thing in another color. */
export const ESCAPE_THINGS = ['apple', 'fish', 'star', 'cat', 'flower', 'book', 'cup', 'sock'] as const;
export type EscapeThing = (typeof ESCAPE_THINGS)[number];
export const ESCAPE_HIDEOUTS = ['drawer', 'box', 'curtain'] as const;

export interface EscapePlaced {
  readonly thing: EscapeThing;
  /** A look-alike: drawn in its other color, and not counted. */
  readonly odd: boolean;
  readonly wall: number;
  /** Where on the wall, 0 to 1 each way. */
  readonly x: number;
  readonly y: number;
  /** Inside a hiding place on that wall (its index), or out in the open (-1). */
  readonly inside: number;
}

export interface Hideout {
  readonly kind: (typeof ESCAPE_HIDEOUTS)[number];
  readonly wall: number;
  readonly x: number;
  readonly y: number;
}

export interface Room {
  readonly lock: readonly EscapeThing[];
  readonly code: string;
  readonly things: readonly EscapePlaced[];
  readonly hideouts: readonly Hideout[];
}

/** How many of `thing` count in a room: the real ones, hidden or not, never the look-alikes. */
export const escapeCount = (room: Room, thing: EscapeThing) => room.things.filter((p) => p.thing === thing && !p.odd).length;

export function makeRooms(seed: number): Room[] {
  const rng = createRng(seed >>> 0);
  return Array.from({ length: ESCAPE_ROOMS }, (_, r) => {
    const digits = r + 2;
    const pool = [...ESCAPE_THINGS];
    const lock: EscapeThing[] = [];
    for (let k = 0; k < digits; k++) lock.push(pool.splice(rng.int(pool.length), 1)[0]!);
    // One or two other things as distraction, never on the lock.
    const extra: EscapeThing[] = [pool.splice(rng.int(pool.length), 1)[0]!];
    if (r > 0) extra.push(pool.splice(rng.int(pool.length), 1)[0]!);
    // Hiding places: none in the first room, then two on each of some walls.
    const hideouts: Hideout[] = [];
    const kinds = r === 1 ? (['drawer', 'box'] as const) : (['drawer', 'box', 'curtain'] as const);
    if (r > 0)
      for (let wall = 0; wall < ESCAPE_WALLS; wall++) {
        if (wall === 0) continue; // The door wall keeps its lock clear.
        hideouts.push({ kind: kinds[rng.int(kinds.length)]!, wall, x: 0.25 + rng.int(2) * 0.5, y: 0.72 });
      }
    const things: EscapePlaced[] = [];
    // Spots on each wall: a grid, each used once, so nothing covers anything.
    const spots: { wall: number; x: number; y: number }[] = [];
    for (let wall = 0; wall < ESCAPE_WALLS; wall++)
      for (let gy = 0; gy < 3; gy++)
        for (let gx = 0; gx < 4; gx++) if (!(wall === 0 && gx >= 1 && gx <= 2)) spots.push({ wall, x: 0.14 + gx * 0.24, y: 0.16 + gy * 0.2 });
    const place = (thing: EscapeThing, odd: boolean) => {
      // Hidden now and then from the second room on.
      const hide = hideouts.length && rng.next() < (r === 1 ? 0.3 : 0.4);
      const h = hideouts.length ? rng.int(hideouts.length) : -1;
      // A hiding place holds at most eight, so everything in it can be seen once it is open.
      if (hide && things.filter((p) => p.inside === h).length < 8) {
        things.push({ thing, odd, wall: hideouts[h]!.wall, x: 0, y: 0, inside: h });
        return;
      }
      const s = spots.splice(rng.int(spots.length), 1)[0]!;
      things.push({ thing, odd, wall: s.wall, x: s.x, y: s.y, inside: -1 });
    };
    const code = lock.map((t) => {
      const n = 1 + rng.int(6);
      for (let k = 0; k < n; k++) place(t, false);
      return String(n);
    });
    for (const t of extra) for (let k = 1 + rng.int(3); k > 0; k--) place(t, false);
    // The last room has look-alikes of the first lock thing.
    if (r === ESCAPE_ROOMS - 1) for (let k = 1 + rng.int(3); k > 0; k--) place(lock[0]!, true);
    return { lock, code: code.join(''), things, hideouts };
  });
}

/** `c3142`: try this code on the door. */
export type EscapeMove = string;

export class EscapeState implements GameState<EscapeMove> {
  readonly currentSeat: Seat = 0;

  constructor(
    readonly rooms: readonly Room[],
    readonly room: number,
    readonly tries: number,
    readonly last: { readonly code: string; readonly right: boolean } | null,
    readonly result: GameResult | null,
  ) {}

  get current(): Room {
    return this.rooms[this.room]!;
  }

  /** Any code of the lock's length is a try, so this is the authority and `legalMoves` is a spread. */
  allows(move: EscapeMove): boolean {
    return !this.result && new RegExp(`^c[0-9]{${this.current.lock.length}}$`).test(move);
  }

  /** The right code and a few wrong ones: for bots and tests. */
  legalMoves(seat: Seat): readonly EscapeMove[] {
    if (this.result || seat !== 0) return [];
    const code = this.current.code;
    const wrong = [...code].map((d, i) => [...code].map((e, j) => (i === j ? String((Number(d) % 9) + 1) : e)).join(''));
    return [`c${code}`, ...wrong.map((w) => `c${w}`)];
  }

  apply(move: EscapeMove): EscapeState {
    if (!this.allows(move)) throw new Error(`Illegal move: ${move}`);
    const code = move.slice(1);
    const right = code === this.current.code;
    const tries = this.tries + 1;
    if (!right) return new EscapeState(this.rooms, this.room, tries, { code, right }, null);
    const done = this.room + 1 === this.rooms.length;
    return new EscapeState(this.rooms, done ? this.room : this.room + 1, tries, { code, right }, done ? { winners: [0], draw: false } : null);
  }
}

export const newEscape = (seed: number) => new EscapeState(makeRooms(seed), 0, 0, null, null);

/** Test play: one wrong try in the first room, then every code right. */
function createEscapeBot(): Bot<EscapeMove> {
  return {
    chooseMove(generic: GameState<EscapeMove>, _seat: Seat, _rng: Rng): EscapeMove {
      const s = generic as EscapeState;
      return s.tries === 0 ? s.legalMoves(0)[1]! : `c${s.current.code}`;
    },
  };
}

export const escapeRoom: GameDefinition<EscapeMove> = {
  id: 'escape-room',
  name: 'Escape Room',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo', 'race'],
  hiddenInfo: false,
  realtime: false,
  newGame: (_config, seed) => newEscape(seed),
  createBot: () => createEscapeBot(),
  encodeMove: (move) => move,
  decodeMove: (key) => (/^c[0-9]{1,6}$/.test(key) ? key : null),
};
