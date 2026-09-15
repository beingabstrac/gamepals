import { createRng, type Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Shut the Box (docs/games/shut-the-box.md). Tiles 1–9 (or 1–12). Roll, then shut open tiles adding up to the roll,
 * until you can't. Score = open tiles left, lowest wins; shutting every tile wins at once.
 * Moves: `r2` / `r1` roll two dice or one; `s<tiles>` shuts tiles, e.g. `s1.3.4`.
 */
export type ShutLevel = 'nine' | 'twelve';
export const SHUT_TILES: Record<ShutLevel, number> = { nine: 9, twelve: 12 };
export type ShutMove = string;
export const shutMove = (tiles: readonly number[]): ShutMove => `s${[...tiles].sort((a, b) => a - b).join('.')}`;

/** The n-th die thrown in a game, fixed by the seed. */
export function shutDie(seed: number, n: number): number {
  return createRng((seed ^ Math.imul(n + 1, 0x27d4eb2f)) >>> 0).int(6) + 1;
}

const tilesOf = (mask: number): number[] => {
  const tiles: number[] = [];
  for (let t = 1; mask >> (t - 1); t++) if ((mask >> (t - 1)) & 1) tiles.push(t);
  return tiles;
};
export const maskSum = (mask: number): number => tilesOf(mask).reduce((a, b) => a + b, 0);
const fullMask = (tiles: number) => (1 << tiles) - 1;
/** One die is allowed once tiles 7 and up are all shut. */
const oneDieAllowed = (open: number) => open >> 6 === 0;

/** Every set of open tiles that adds up to `total`, as masks. */
export function splits(open: number, total: number): number[] {
  const found: number[] = [];
  for (let sub = open; sub > 0; sub = (sub - 1) & open) if (maskSum(sub) === total) found.push(sub);
  return found;
}

export type ShutEvent =
  | { readonly kind: 'roll'; readonly seat: Seat; readonly dice: readonly number[]; readonly stuck: boolean; readonly score: number | null }
  | { readonly kind: 'shut'; readonly seat: Seat; readonly tiles: readonly number[]; readonly shutBox: boolean };

export class ShutState implements GameState<ShutMove> {
  constructor(
    readonly level: ShutLevel,
    readonly seed: number,
    /** Open tiles of the player on turn: bit t-1 is tile t. */
    readonly open: number,
    /** Each player's final score, once their turn is over. */
    readonly scores: readonly (number | null)[],
    readonly currentSeat: Seat,
    readonly phase: 'roll' | 'shut',
    readonly dice: readonly number[],
    readonly thrown: number,
    readonly result: GameResult | null,
    readonly last: ShutEvent | null,
  ) {}

  get tiles(): number {
    return SHUT_TILES[this.level];
  }

  get roll(): number {
    return this.dice.reduce((a, b) => a + b, 0);
  }

  isOpen(tile: number): boolean {
    return ((this.open >> (tile - 1)) & 1) === 1;
  }

  legalMoves(seat: Seat): readonly ShutMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    if (this.phase === 'roll') return oneDieAllowed(this.open) ? ['r2', 'r1'] : ['r2'];
    return splits(this.open, this.roll).map((mask) => shutMove(tilesOf(mask)));
  }

  apply(move: ShutMove): ShutState {
    if (this.result) throw new Error('Game is over');
    if (!this.legalMoves(this.currentSeat).includes(move)) throw new Error(`Illegal move: ${move}`);
    const seat = this.currentSeat;
    if (move[0] === 'r') {
      const count = move === 'r1' ? 1 : 2;
      const dice = Array.from({ length: count }, (_, i) => shutDie(this.seed, this.thrown + i));
      const total = dice.reduce((a, b) => a + b, 0);
      const thrown = this.thrown + count;
      if (splits(this.open, total).length > 0) {
        return new ShutState(this.level, this.seed, this.open, this.scores, seat, 'shut', dice, thrown, null, { kind: 'roll', seat, dice, stuck: false, score: null });
      }
      // Stuck: the turn is over and the open tiles are the score.
      const score = maskSum(this.open);
      const scores = this.scores.map((s, i) => (i === seat ? score : s));
      const event: ShutEvent = { kind: 'roll', seat, dice, stuck: true, score };
      const next = scores.findIndex((s) => s === null);
      if (next < 0) return new ShutState(this.level, this.seed, this.open, scores, seat, 'roll', dice, thrown, resultOf(scores), event);
      return new ShutState(this.level, this.seed, fullMask(this.tiles), scores, next, 'roll', dice, thrown, null, event);
    }
    const tiles = move.slice(1).split('.').map(Number);
    const open = tiles.reduce((mask, t) => mask & ~(1 << (t - 1)), this.open);
    if (open === 0) {
      // Shut the box: an outright win.
      const scores = this.scores.map((s, i) => (i === seat ? 0 : s));
      const event: ShutEvent = { kind: 'shut', seat, tiles, shutBox: true };
      return new ShutState(this.level, this.seed, 0, scores, seat, 'roll', this.dice, this.thrown, { winners: [seat], draw: false }, event);
    }
    return new ShutState(this.level, this.seed, open, this.scores, seat, 'roll', this.dice, this.thrown, null, { kind: 'shut', seat, tiles, shutBox: false });
  }
}

function resultOf(scores: readonly (number | null)[]): GameResult {
  const values = scores.map((s) => s ?? Infinity);
  const best = Math.min(...values);
  const winners = values.flatMap((v, seat) => (v === best ? [seat] : []));
  if (scores.length > 1 && winners.length === scores.length) return { winners: [], draw: true };
  return { winners, draw: false };
}

export function newShutTheBox(players: number, seed: number, level: ShutLevel = 'nine'): ShutState {
  if (players < 1 || players > 4) throw new Error(`Shut the Box needs 1–4 players, got ${players}`);
  return new ShutState(level, seed >>> 0, fullMask(SHUT_TILES[level]), Array<number | null>(players).fill(null), 0, 'roll', [], 0, null, null);
}

// ---- Bots

/** Chance of each total with two dice, and with one. */
const TWO_DICE = Array.from({ length: 13 }, (_, total) => (total < 2 ? 0 : (6 - Math.abs(total - 7)) / 36));
const ONE_DIE = Array.from({ length: 13 }, (_, total) => (total >= 1 && total <= 6 ? 1 / 6 : 0));

/** Exact expected final score from a set of open tiles, playing perfectly (memoized per mask). */
const expected = new Map<number, number>();
function expectedScore(open: number): number {
  if (open === 0) return 0;
  const cached = expected.get(open);
  if (cached !== undefined) return cached;
  const withDice = (chances: readonly number[]) =>
    chances.reduce((sum, p, total) => {
      if (p === 0) return sum;
      const options = splits(open, total);
      const best = options.length ? Math.min(...options.map((sub) => expectedScore(open & ~sub))) : maskSum(open);
      return sum + p * best;
    }, 0);
  const value = oneDieAllowed(open) ? Math.min(withDice(TWO_DICE), withDice(ONE_DIE)) : withDice(TWO_DICE);
  expected.set(open, value);
  return value;
}

/** Chance the next roll (two dice) can be made from these tiles. */
const makeable = (open: number) => TWO_DICE.reduce((sum, p, total) => sum + (p && splits(open, total).length ? p : 0), 0);

type ShutTier = 'random' | 'biggest' | 'odds' | 'exact';
const TIERS: Record<BotTier, ShutTier> = { easy: 'random', medium: 'biggest', hard: 'odds', expert: 'exact' };

function createShutBot(tier: ShutTier): Bot<ShutMove> {
  return {
    chooseMove(generic: GameState<ShutMove>, seat: Seat, rng: Rng): ShutMove {
      const state = generic as ShutState;
      const moves = state.legalMoves(seat);
      if (moves.length === 0) throw new Error('No legal moves');
      if (state.phase === 'roll') {
        if (moves.length === 1) return 'r2';
        if (tier === 'random') return rng.pick(moves);
        if (tier === 'exact') {
          const score = (chances: readonly number[]) =>
            chances.reduce((sum, p, total) => {
              const options = splits(state.open, total);
              return sum + p * (options.length ? Math.min(...options.map((sub) => expectedScore(state.open & ~sub))) : maskSum(state.open));
            }, 0);
          return score(ONE_DIE) < score(TWO_DICE) ? 'r1' : 'r2';
        }
        // With little left, one die makes small totals easier.
        return maskSum(state.open) <= 6 ? 'r1' : 'r2';
      }
      const options = splits(state.open, state.roll);
      let pick: number;
      if (tier === 'random') pick = rng.pick(options);
      else if (tier === 'biggest') pick = options.reduce((a, b) => (Math.max(...tilesOf(b)) > Math.max(...tilesOf(a)) ? b : a));
      else if (tier === 'odds') pick = options.reduce((a, b) => (makeable(state.open & ~b) > makeable(state.open & ~a) ? b : a));
      else pick = options.reduce((a, b) => (expectedScore(state.open & ~b) < expectedScore(state.open & ~a) ? b : a));
      return shutMove(tilesOf(pick));
    },
  };
}

export const shutTheBox: GameDefinition<ShutMove> = {
  id: 'shut-the-box',
  name: 'Shut the Box',
  minPlayers: 1,
  maxPlayers: 4,
  modes: ['solo', 'bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: false,
  realtime: false,
  newGame: (config, seed) => newShutTheBox(config.players, seed, config.variant === 'twelve' ? 'twelve' : 'nine'),
  createBot: (tier) => createShutBot(TIERS[tier]),
  encodeMove: (move) => move,
};
