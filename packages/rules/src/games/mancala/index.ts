import { createSearchBot, type SearchTier } from '../../core/bots';
import type { BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Mancala, Kalah rules (docs/games/mancala.md). The board is 14 spots in sowing order:
 * 0–5 are seat 0's houses (left to right along the bottom), 6 is seat 0's store,
 * 7–12 are seat 1's houses (right to left along the top), 13 is seat 1's store.
 * Sowing goes up the indexes, wrapping around, and skips the other player's store.
 */
export type MancalaLevel = 'three' | 'four' | 'six';
export const MANCALA_SEEDS: Record<MancalaLevel, number> = { three: 3, four: 4, six: 6 };

export const storeOf = (seat: Seat): number => (seat === 0 ? 6 : 13);
export const housesOf = (seat: Seat): number[] => (seat === 0 ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12]);
/** The house straight across the board. */
export const oppositeHouse = (pit: number): number => 12 - pit;
const ownerOfPit = (pit: number): Seat => (pit <= 6 ? 0 : 1);

/** `h<pit>` sows the seeds from that house. */
export type MancalaMove = string;
export const sowMove = (pit: number): MancalaMove => `h${pit}`;

export interface MancalaEvent {
  readonly seat: Seat;
  readonly pit: number;
  /** Every pit a seed landed in, in order. */
  readonly path: readonly number[];
  /** Seeds taken from the house across (plus the capturing seed), or null. */
  readonly capture: { readonly from: number; readonly seeds: number } | null;
  readonly extraTurn: boolean;
  /** Seeds swept into each store when the game ended. */
  readonly swept: readonly [number, number] | null;
}

export class MancalaState implements GameState<MancalaMove> {
  constructor(
    readonly pits: readonly number[],
    readonly currentSeat: Seat,
    readonly result: GameResult | null,
    readonly last: MancalaEvent | null,
  ) {}

  store(seat: Seat): number {
    return this.pits[storeOf(seat)]!;
  }

  legalMoves(seat: Seat): readonly MancalaMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    return housesOf(seat)
      .filter((pit) => this.pits[pit]! > 0)
      .map(sowMove);
  }

  apply(move: MancalaMove): MancalaState {
    if (this.result) throw new Error('Game is over');
    if (!this.legalMoves(this.currentSeat).includes(move)) throw new Error(`Illegal move: ${move}`);
    const seat = this.currentSeat;
    const other: Seat = seat === 0 ? 1 : 0;
    const pit = Number(move.slice(1));
    const pits = this.pits.slice();
    let seeds = pits[pit]!;
    pits[pit] = 0;
    const path: number[] = [];
    let at = pit;
    while (seeds > 0) {
      at = (at + 1) % 14;
      if (at === storeOf(other)) continue;
      pits[at]!++;
      path.push(at);
      seeds--;
    }

    let capture: MancalaEvent['capture'] = null;
    const extraTurn = at === storeOf(seat);
    // Last seed in one of your own houses that was empty, with seeds across: take both.
    if (!extraTurn && ownerOfPit(at) === seat && at !== storeOf(seat) && pits[at] === 1 && pits[oppositeHouse(at)]! > 0) {
      const across = oppositeHouse(at);
      const taken = pits[across]! + 1;
      pits[storeOf(seat)]! += taken;
      pits[across] = 0;
      pits[at] = 0;
      capture = { from: across, seeds: taken };
    }

    // One side empty: the other side's seeds go to their owner's store, and the game ends.
    const empty = (s: Seat) => housesOf(s).every((h) => pits[h] === 0);
    if (empty(0) || empty(1)) {
      const swept: [number, number] = [0, 0];
      for (const s of [0, 1] as Seat[]) {
        for (const h of housesOf(s)) {
          swept[s] += pits[h]!;
          pits[storeOf(s)]! += pits[h]!;
          pits[h] = 0;
        }
      }
      const a = pits[storeOf(0)]!;
      const b = pits[storeOf(1)]!;
      const result: GameResult = a === b ? { winners: [], draw: true } : { winners: [a > b ? 0 : 1], draw: false };
      return new MancalaState(pits, seat, result, { seat, pit, path, capture, extraTurn: false, swept });
    }
    return new MancalaState(pits, extraTurn ? seat : other, null, { seat, pit, path, capture, extraTurn, swept: null });
  }
}

export function newMancala(level: MancalaLevel): MancalaState {
  const seeds = MANCALA_SEEDS[level];
  const pits = Array.from({ length: 14 }, (_, i) => (i === 6 || i === 13 ? 0 : seeds));
  return new MancalaState(pits, 0, null, null);
}

/** Store difference, plus (for the sharper bots) a little credit for seeds still on your side. */
function evaluate(sharp: boolean) {
  return (generic: GameState<MancalaMove>, seat: Seat): number => {
    const state = generic as MancalaState;
    const other: Seat = seat === 0 ? 1 : 0;
    let score = (state.store(seat) - state.store(other)) * 10;
    if (sharp) {
      const side = (s: Seat) => housesOf(s).reduce((sum, h) => sum + state.pits[h]!, 0);
      score += side(seat) - side(other);
    }
    return score;
  };
}

const TIERS: Record<BotTier, SearchTier & { sharp: boolean }> = {
  easy: { depth: 1, randomMoveRate: 0.35, sharp: false },
  medium: { depth: 3, randomMoveRate: 0.1, sharp: false },
  hard: { depth: 5, randomMoveRate: 0.02, sharp: true },
  expert: { depth: 7, randomMoveRate: 0, sharp: true },
};

const isLevel = (value: string | undefined): value is MancalaLevel => value === 'three' || value === 'four' || value === 'six';

export const mancala: GameDefinition<MancalaMove> = {
  id: 'mancala',
  name: 'Mancala',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: false,
  realtime: false,
  newGame: (config) => newMancala(isLevel(config.variant) ? config.variant : 'four'),
  createBot: (tier) => createSearchBot(TIERS[tier], evaluate(TIERS[tier].sharp)),
  encodeMove: (move) => move,
};
