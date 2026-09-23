import { createSearchBot } from '../../core/bots';
import type { Rng } from '../../core/rng';
import { createRng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/** Flood: turn the board one colour from a corner, alone or against someone (docs/games/flood.md). */
export type FloodLevel = 'small' | 'medium' | 'large';
export const FLOOD_LEVELS: readonly FloodLevel[] = ['small', 'medium', 'large'];

/**
 * Board sides, and the spare moves a solo board gets on top of what the solver needed. The solver's
 * own moves always win, so a limit built this way can never be too tight.
 */
export const FLOOD_SIZES: Record<FloodLevel, { readonly size: number; readonly spare: number }> = {
  small: { size: 10, spare: 4 },
  medium: { size: 12, spare: 3 },
  large: { size: 14, spare: 2 },
};

export const FLOOD_COLOURS = 6;

/** Turns in a row that claim nothing before a duel ends on the count, for two people just passing. */
export const FLOOD_IDLE_LIMIT = 20;

/** A colour, `0` to `5`. */
export type FloodMove = string;

/** The four squares beside a cell. */
export function sidesOf(size: number, cell: number): number[] {
  const x = cell % size;
  const y = Math.floor(cell / size);
  const out: number[] = [];
  if (x > 0) out.push(cell - 1);
  if (x < size - 1) out.push(cell + 1);
  if (y > 0) out.push(cell - size);
  if (y < size - 1) out.push(cell + size);
  return out;
}

/**
 * `seat`'s patch turns `colour` and swallows every free square of that colour joined to it. Returns
 * the new colours, the new owners and the squares that joined, nearest first.
 */
function flow(
  size: number,
  colours: readonly number[],
  owner: readonly number[],
  seat: Seat,
  colour: number,
): { colours: number[]; owner: number[]; joined: number[] } {
  const nextColours = colours.slice();
  const nextOwner = owner.slice();
  const queue: number[] = [];
  for (let cell = 0; cell < nextOwner.length; cell++) {
    if (nextOwner[cell] !== seat) continue;
    nextColours[cell] = colour;
    queue.push(cell);
  }
  const joined: number[] = [];
  for (let i = 0; i < queue.length; i++) {
    for (const side of sidesOf(size, queue[i]!)) {
      if (nextOwner[side] !== -1 || nextColours[side] !== colour) continue;
      nextOwner[side] = seat;
      joined.push(side);
      queue.push(side);
    }
  }
  return { colours: nextColours, owner: nextOwner, joined };
}

/** Patches of one colour, and which patches touch, for the solver. */
interface Patches {
  readonly colour: readonly number[];
  readonly area: readonly number[];
  readonly touching: readonly (readonly number[])[];
  /** The patch each square is in. */
  readonly of: readonly number[];
}

function patchesOf(size: number, colours: readonly number[]): Patches {
  const of = Array<number>(colours.length).fill(-1);
  const colour: number[] = [];
  const area: number[] = [];
  for (let cell = 0; cell < colours.length; cell++) {
    if (of[cell] !== -1) continue;
    const id = colour.length;
    colour.push(colours[cell]!);
    let count = 0;
    const stack = [cell];
    of[cell] = id;
    while (stack.length) {
      const at = stack.pop()!;
      count++;
      for (const side of sidesOf(size, at)) {
        if (of[side] === -1 && colours[side] === colours[cell]) {
          of[side] = id;
          stack.push(side);
        }
      }
    }
    area.push(count);
  }
  const touching = colour.map(() => new Set<number>());
  for (let cell = 0; cell < colours.length; cell++) {
    for (const side of sidesOf(size, cell)) if (of[side] !== of[cell]) touching[of[cell]!]!.add(of[side]!);
  }
  return { colour, area, touching: touching.map((set) => [...set].sort((a, b) => a - b)), of };
}

/** How far, in moves, the farthest patch is from ours, ignoring colour. */
function reach(patches: Patches, mine: readonly boolean[]): number {
  const distance = patches.colour.map((_, id): number => (mine[id] ? 0 : -1));
  const queue = distance.flatMap((d, id) => (d === 0 ? [id] : []));
  let farthest = 0;
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]!;
    for (const next of patches.touching[id]!) {
      if (distance[next] !== -1) continue;
      distance[next] = distance[id]! + 1;
      farthest = Math.max(farthest, distance[next]!);
      queue.push(next);
    }
  }
  return farthest;
}

/**
 * The colours the solver would pick, in order, to flood a solo board from where it stands. It takes a
 * colour it can finish off in one go whenever there is one, since that never costs a move; otherwise
 * the colour that brings the farthest patch nearest, and the most squares when two tie. This is the
 * rule Simon Tatham's Flood solver is built on. It is good rather than perfect (perfect is NP-hard),
 * and every colour it picks is a real move, so its count is a limit that can always be met.
 */
export function floodPlan(size: number, colours: readonly number[], owner: readonly number[]): number[] {
  const patches = patchesOf(size, colours);
  const mine = patches.colour.map(() => false);
  for (let cell = 0; cell < owner.length; cell++) if (owner[cell] === 0) mine[patches.of[cell]!] = true;
  let current = colours[owner.indexOf(0)]!;
  const plan: number[] = [];
  const absorb = (held: readonly boolean[], colour: number): boolean[] => {
    const next = held.slice();
    held.forEach((own, id) => {
      if (own) for (const side of patches.touching[id]!) if (patches.colour[side] === colour) next[side] = true;
    });
    return next;
  };
  const areaOf = (held: readonly boolean[]) => held.reduce((sum, own, id) => (own ? sum + patches.area[id]! : sum), 0);
  while (mine.some((own) => !own)) {
    let pick = -1;
    for (let colour = 0; colour < FLOOD_COLOURS && pick === -1; colour++) {
      if (colour === current) continue;
      const left = patches.colour.flatMap((c, id) => (c === colour && !mine[id] ? [id] : []));
      if (left.length > 0 && left.every((id) => patches.touching[id]!.some((side) => mine[side]))) pick = colour;
    }
    if (pick === -1) {
      let best = { reach: Infinity, area: -1 };
      const before = areaOf(mine);
      for (let colour = 0; colour < FLOOD_COLOURS; colour++) {
        if (colour === current) continue;
        const held = absorb(mine, colour);
        const area = areaOf(held);
        if (area === before) continue;
        const far = reach(patches, held);
        if (far < best.reach || (far === best.reach && area > best.area)) {
          best = { reach: far, area };
          pick = colour;
        }
      }
    }
    // Cannot happen on a board that is not full, since some free patch always touches ours; a guard
    // all the same, because a bot that spins forever hangs the game.
    if (pick === -1) break;
    absorb(mine, pick).forEach((own, id) => (mine[id] = own));
    current = pick;
    plan.push(pick);
  }
  return plan;
}

export class FloodState implements GameState<FloodMove> {
  constructor(
    readonly level: FloodLevel,
    /** 1 for the solo puzzle, 2 for the duel. */
    readonly players: number,
    readonly size: number,
    readonly colours: readonly number[],
    /** The seat holding each square, or -1 while it is free. */
    readonly owner: readonly number[],
    readonly currentSeat: Seat,
    /** Moves made so far, by everyone. */
    readonly moves: number,
    /** Most moves a solo board allows; 0 in the duel, which has none. */
    readonly limit: number,
    /** Turns in a row that claimed nothing, in the duel. */
    readonly idle: number,
    readonly result: GameResult | null,
    /** Squares the last move claimed, nearest first, for the animation. */
    readonly last: readonly number[],
  ) {}

  get cells(): number {
    return this.size * this.size;
  }

  /** Where each seat started: top left alone; bottom left and top right in the duel. */
  home(seat: Seat): number {
    if (this.players === 1) return 0;
    return seat === 0 ? this.cells - this.size : this.size - 1;
  }

  colourOf(seat: Seat): number {
    return this.colours[this.home(seat)]!;
  }

  held(seat: Seat): number {
    return this.owner.filter((who) => who === seat).length;
  }

  get movesLeft(): number {
    return this.limit - this.moves;
  }

  legalMoves(seat: Seat): readonly FloodMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    const barred = new Set([this.colourOf(seat)]);
    if (this.players === 2) barred.add(this.colourOf(1 - seat));
    const moves: FloodMove[] = [];
    for (let colour = 0; colour < FLOOD_COLOURS; colour++) if (!barred.has(colour)) moves.push(String(colour));
    return moves;
  }

  apply(move: FloodMove): FloodState {
    if (this.result) throw new Error('Game is over');
    if (!this.legalMoves(this.currentSeat).includes(move)) throw new Error(`Illegal move: ${move}`);
    const seat = this.currentSeat;
    const { colours, owner, joined } = flow(this.size, this.colours, this.owner, seat, Number(move));
    const moves = this.moves + 1;
    if (this.players === 1) {
      const full = owner.every((who) => who === 0);
      const result = full ? { winners: [0], draw: false } : moves >= this.limit ? { winners: [], draw: false } : null;
      return new FloodState(this.level, 1, this.size, colours, owner, 0, moves, this.limit, 0, result, joined);
    }
    const idle = joined.length > 0 ? 0 : this.idle + 1;
    const counts = [0, 1].map((s) => owner.filter((who) => who === s).length);
    const total = this.cells;
    let result: GameResult | null = null;
    const ahead = counts[0]! > counts[1]! ? 0 : counts[1]! > counts[0]! ? 1 : -1;
    if (counts.some((count) => count * 2 > total)) result = { winners: [ahead], draw: false };
    else if (counts[0]! + counts[1]! === total || idle >= FLOOD_IDLE_LIMIT) {
      result = ahead === -1 ? { winners: [], draw: true } : { winners: [ahead], draw: false };
    }
    return new FloodState(this.level, 2, this.size, colours, owner, 1 - seat, moves, 0, idle, result, joined);
  }
}

/** A solo board: any colours at all, the way the puzzle has always been dealt. */
function soloBoard(rng: Rng, size: number): number[] {
  return Array.from({ length: size * size }, () => rng.int(FLOOD_COLOURS));
}

/**
 * A duel board: no square touches one of its own colour, so both corners start as one square, and
 * the two corners differ, so neither player starts wearing the other's colour.
 */
function duelBoard(rng: Rng, size: number): number[] {
  const colours: number[] = [];
  for (let cell = 0; cell < size * size; cell++) {
    const x = cell % size;
    const y = Math.floor(cell / size);
    const barred = new Set<number>();
    if (x > 0) barred.add(colours[cell - 1]!);
    if (y > 0) barred.add(colours[cell - size]!);
    if (x === 0 && y === size - 1) barred.add(colours[size - 1]!);
    const open = Array.from({ length: FLOOD_COLOURS }, (_, c) => c).filter((c) => !barred.has(c));
    colours.push(rng.pick(open));
  }
  return colours;
}

export function newFlood(seed: number, level: FloodLevel, players: number): FloodState {
  const rng = createRng(seed);
  const { size, spare } = FLOOD_SIZES[level];
  const blank = Array<number>(size * size).fill(-1);
  if (players === 2) {
    const colours = duelBoard(rng, size);
    const owner = blank.slice();
    owner[size * size - size] = 0;
    owner[size - 1] = 1;
    return new FloodState(level, 2, size, colours, owner, 0, 0, 0, 0, null, []);
  }
  const start = soloBoard(rng, size);
  const seeded = blank.slice();
  seeded[0] = 0;
  // The corner's whole joined patch is yours before you move, as in every version.
  const { owner } = flow(size, start, seeded, 0, start[0]!);
  const limit = floodPlan(size, start, owner).length + spare;
  return new FloodState(level, 1, size, start, owner, 0, 0, limit, 0, null, []);
}

/** Autoplay for the solo puzzle: the solver's next colour, so it always wins inside the limit. */
function createSoloBot(): Bot<FloodMove> {
  return {
    chooseMove(generic: GameState<FloodMove>): FloodMove {
      const state = generic as FloodState;
      return String(floodPlan(state.size, state.colours, state.owner)[0]);
    },
  };
}

/** Squares held, from `seat`'s side. */
const lead = (generic: GameState<FloodMove>, seat: Seat): number => {
  const state = generic as FloodState;
  return state.held(seat) - state.held(1 - seat);
};

const DUEL_TIERS: Record<BotTier, { depth: number; randomMoveRate: number }> = {
  easy: { depth: 1, randomMoveRate: 0.5 },
  medium: { depth: 1, randomMoveRate: 0 },
  hard: { depth: 2, randomMoveRate: 0 },
  expert: { depth: 4, randomMoveRate: 0 },
};

function createFloodBot(tier: BotTier): Bot<FloodMove> {
  const solo = createSoloBot();
  const duel = createSearchBot(DUEL_TIERS[tier], lead);
  return {
    chooseMove(state: GameState<FloodMove>, seat: Seat, rng: Rng): FloodMove {
      return (state as FloodState).players === 1 ? solo.chooseMove(state, seat, rng) : duel.chooseMove(state, seat, rng);
    },
  };
}

const isLevel = (value: string | undefined): value is FloodLevel => FLOOD_LEVELS.includes(value as FloodLevel);

export const flood: GameDefinition<FloodMove> = {
  id: 'flood',
  name: 'Flood',
  minPlayers: 1,
  maxPlayers: 2,
  modes: ['solo', 'bot', 'sameDevice', 'onlineLive', 'async', 'race'],
  hiddenInfo: false,
  realtime: false,
  newGame: (config, seed) => newFlood(seed, isLevel(config.variant) ? config.variant : 'small', config.players >= 2 ? 2 : 1),
  createBot: (tier) => createFloodBot(tier),
  encodeMove: (move) => move,
};
