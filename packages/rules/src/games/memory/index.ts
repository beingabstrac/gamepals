import type { Rng } from '../../core/rng';
import { createRng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/** Memory / Concentration (docs/games/memory.md). */
export type MemorySize = 'small' | 'medium' | 'large';
export const MEMORY_SIZES: Record<MemorySize, { readonly cols: number; readonly rows: number }> = {
  small: { cols: 3, rows: 4 },
  medium: { cols: 4, rows: 5 },
  large: { cols: 5, rows: 6 },
};

/** Flip the card at this index: `f<index>`. */
export type MemoryMove = string;
export const flipMove = (card: number): MemoryMove => `f${card}`;

/** What the second flip of a turn did, so views can animate it. */
export interface MemoryEvent {
  readonly seat: Seat;
  readonly cards: readonly [number, number];
  readonly match: boolean;
}

export class MemoryState implements GameState<MemoryMove> {
  constructor(
    readonly players: number,
    readonly size: MemorySize,
    /** Picture on each card; every picture appears exactly twice. */
    readonly symbols: readonly number[],
    /** Who took each card, or -1 while it's still on the table. */
    readonly owner: readonly number[],
    /** Card flipped first this turn (at most one; the second flip resolves the turn). */
    readonly open: readonly number[],
    readonly scores: readonly number[],
    readonly currentSeat: Seat,
    /** Turns played so far (one turn = two flips). */
    readonly turns: number,
    /** Every card shown so far, in order. Bots may only remember from this. */
    readonly seen: readonly number[],
    readonly result: GameResult | null,
    readonly last: MemoryEvent | null,
  ) {}

  get pairsLeft(): number {
    return this.owner.filter((o) => o < 0).length / 2;
  }

  legalMoves(seat: Seat): readonly MemoryMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    const moves: MemoryMove[] = [];
    this.owner.forEach((o, card) => {
      if (o < 0 && !this.open.includes(card)) moves.push(flipMove(card));
    });
    return moves;
  }

  apply(move: MemoryMove): MemoryState {
    if (this.result) throw new Error('Game is over');
    if (!this.legalMoves(this.currentSeat).includes(move)) throw new Error(`Illegal move: ${move}`);
    const card = Number(move.slice(1));
    const seen = [...this.seen, card];
    if (this.open.length === 0) {
      return new MemoryState(this.players, this.size, this.symbols, this.owner, [card], this.scores, this.currentSeat, this.turns, seen, null, null);
    }
    const first = this.open[0]!;
    const seat = this.currentSeat;
    const match = this.symbols[first] === this.symbols[card];
    const owner = this.owner.slice();
    const scores = this.scores.slice();
    if (match) {
      owner[first] = seat;
      owner[card] = seat;
      scores[seat]!++;
    }
    // A match earns another turn; a miss passes play on.
    const next = match ? seat : (seat + 1) % this.players;
    const event: MemoryEvent = { seat, cards: [first, card], match };
    const done = owner.every((o) => o >= 0);
    return new MemoryState(this.players, this.size, this.symbols, owner, [], scores, next, this.turns + 1, seen, done ? resultFor(scores) : null, event);
  }
}

function resultFor(scores: readonly number[]): GameResult {
  if (scores.length === 1) return { winners: [0], draw: false };
  const best = Math.max(...scores);
  const winners = scores.flatMap((s, seat) => (s === best ? [seat] : []));
  // Everyone tied: a draw. Some players tied for first: they all win.
  return winners.length === scores.length ? { winners: [], draw: true } : { winners, draw: false };
}

export function newMemory(players: number, seed: number, size: MemorySize): MemoryState {
  if (players < 1 || players > 4) throw new Error(`Memory needs 1–4 players, got ${players}`);
  const { cols, rows } = MEMORY_SIZES[size];
  const pairs = (cols * rows) / 2;
  const deck = Array.from({ length: pairs * 2 }, (_, i) => Math.floor(i / 2));
  const rng = createRng(seed >>> 0);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return new MemoryState(players, size, deck, Array<number>(deck.length).fill(-1), [], Array<number>(players).fill(0), 0, 0, [], null, null);
}

/** How many of the most recent flips each bot remembers. Bots never look at hidden cards. */
const RECALL: Record<BotTier, number> = { easy: 2, medium: 6, hard: 14, expert: Infinity };

function createMemoryBot(tier: BotTier): Bot<MemoryMove> {
  return {
    chooseMove(generic: GameState<MemoryMove>, seat: Seat, rng: Rng): MemoryMove {
      const state = generic as MemoryState;
      const legal = state.legalMoves(seat).map((m) => Number(m.slice(1)));
      if (legal.length === 0) throw new Error('No legal moves');
      // What this bot remembers: recently shown cards still on the table.
      const recall = RECALL[tier];
      const memory = new Map<number, Set<number>>();
      state.seen.slice(Number.isFinite(recall) ? -recall : 0).forEach((card) => {
        if (state.owner[card]! >= 0) return;
        const symbol = state.symbols[card]!;
        memory.set(symbol, (memory.get(symbol) ?? new Set()).add(card));
      });
      const known = new Set([...memory.values()].flatMap((cards) => [...cards]));
      const unknown = legal.filter((card) => !known.has(card));
      const pick = (cards: number[]) => rng.pick(cards.length ? cards : legal);

      const first = state.open[0];
      if (first === undefined) {
        const pair = [...memory.values()].find((cards) => cards.size >= 2);
        return flipMove(pair ? [...pair][0]! : pick(unknown));
      }
      // Second flip: the first card is face up, so everyone can see it.
      const partner = [...(memory.get(state.symbols[first]!) ?? [])].find((card) => card !== first && legal.includes(card));
      return flipMove(partner ?? pick(unknown));
    },
  };
}

const isSize = (value: string | undefined): value is MemorySize => value === 'small' || value === 'medium' || value === 'large';

export const memory: GameDefinition<MemoryMove> = {
  id: 'memory',
  name: 'Memory',
  minPlayers: 1,
  maxPlayers: 4,
  modes: ['solo', 'bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: true,
  realtime: false,
  newGame: (config, seed) => newMemory(config.players, seed, isSize(config.variant) ? config.variant : 'small'),
  createBot: (tier) => createMemoryBot(tier),
  encodeMove: (move) => move,
};
