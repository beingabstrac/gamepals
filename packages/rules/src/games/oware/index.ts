import { createSearchBot, type SearchTier } from '../../core/bots';
import type { BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';
import { housesOf, storeOf, type MancalaEvent } from '../mancala';

/**
 * Oware (Abapa rules, docs/games/oware.md): the West African sowing game. Laid out like our
 * Mancala (0 to 5 seat 0's houses, 7 to 12 seat 1's, 6 and 13 where each keeps what they take),
 * but nothing is ever sown into those; they only hold captures.
 *
 * Pick up a house and sow round, one seed a house, skipping the house you started from when you
 * go all the way round. If your last seed lands on the other side and makes two or three, take
 * them, and the houses before it while they also hold two or three. Taking every seed the other
 * side has is not allowed: that sowing captures nothing. If the other side is empty you must give
 * them seeds if you can; if you cannot, you take what is left. More than 24 wins.
 */
export const OWARE_SEEDS = 4;
/** Moves in a row with no capture before the game is called, each side keeping its own seeds. */
export const OWARE_QUIET = 60;

export type OwareMove = string;

const other = (s: Seat): Seat => (s === 0 ? 1 : 0);
const ownerOf = (pit: number): Seat => (pit < 6 ? 0 : 1);
const side = (pits: readonly number[], s: Seat) => housesOf(s).reduce((n, h) => n + pits[h]!, 0);

/** Sows from `pit` and returns the pits after it, the path, and what was taken. */
function sow(pits: readonly number[], pit: number): { pits: number[]; path: number[]; taken: number[]; grabbed: number } {
  const next = pits.slice();
  const seat = ownerOf(pit);
  let seeds = next[pit]!;
  next[pit] = 0;
  const path: number[] = [];
  let at = pit;
  while (seeds > 0) {
    at = (at + 1) % 14;
    if (at === 6 || at === 13 || at === pit) continue;
    next[at]!++;
    path.push(at);
    seeds--;
  }
  // Captures: back from the last house while it is theirs and holds two or three.
  const taken: number[] = [];
  let c = at;
  while (ownerOf(c) !== seat && c !== 6 && c !== 13 && (next[c] === 2 || next[c] === 3)) {
    taken.push(c);
    c = c === 7 ? -1 : c === 0 ? -1 : c - 1;
    if (c < 0) break;
  }
  const grabbed = taken.reduce((n, h) => n + next[h]!, 0);
  // A grand slam (every seed they have) captures nothing.
  if (taken.length && grabbed === side(next, other(seat))) return { pits: next, path, taken: [], grabbed: 0 };
  for (const h of taken) {
    next[storeOf(seat)]! += next[h]!;
    next[h] = 0;
  }
  return { pits: next, path, taken, grabbed };
}

export class OwareState implements GameState<OwareMove> {
  constructor(
    readonly pits: readonly number[],
    readonly currentSeat: Seat,
    readonly quiet: number,
    readonly result: GameResult | null,
    readonly last: MancalaEvent | null,
  ) {}

  store(seat: Seat): number {
    return this.pits[storeOf(seat)]!;
  }

  legalMoves(seat: Seat): readonly OwareMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    const mine = housesOf(seat).filter((h) => this.pits[h]! > 0);
    // Their side empty: only a move that gives them seeds will do (if there is one).
    if (side(this.pits, other(seat)) === 0) {
      const feeding = mine.filter((h) => side(sow(this.pits, h).pits, other(seat)) > 0);
      if (feeding.length) return feeding.map((h) => `h${h}`);
    }
    return mine.map((h) => `h${h}`);
  }

  apply(move: OwareMove): OwareState {
    if (!this.legalMoves(this.currentSeat).includes(move)) throw new Error(`Illegal move: ${move}`);
    const seat = this.currentSeat;
    const pit = Number(move.slice(1));
    const { pits, path, taken, grabbed } = sow(this.pits, pit);
    const capture = taken.length ? { from: taken[0]!, seeds: grabbed } : null;
    const quiet = taken.length ? 0 : this.quiet + 1;
    const event = (swept: [number, number] | null): MancalaEvent => ({ seat, pit, path, capture, extraTurn: false, swept });
    const done = (final: number[], swept: [number, number] | null) => {
      const a = final[storeOf(0)]!;
      const b = final[storeOf(1)]!;
      const result: GameResult = a === b ? { winners: [], draw: true } : { winners: [a > b ? 0 : 1], draw: false };
      return new OwareState(final, seat, quiet, result, event(swept));
    };
    if (pits[storeOf(seat)]! > 24 || (pits[6] === 24 && pits[13] === 24)) return done(pits, null);
    const next = other(seat);
    // The next player cannot move at all, or the game has gone quiet: each side keeps its own.
    const stuck = new OwareState(pits, next, quiet, null, null).legalMoves(next).length === 0;
    if (stuck || quiet >= OWARE_QUIET) {
      const final = pits.slice();
      const swept: [number, number] = [0, 0];
      for (const s of [0, 1] as Seat[])
        for (const h of housesOf(s)) {
          swept[s] += final[h]!;
          final[storeOf(s)]! += final[h]!;
          final[h] = 0;
        }
      return done(final, swept);
    }
    return new OwareState(pits, next, quiet, null, event(null));
  }
}

export function newOware(): OwareState {
  const pits = Array.from({ length: 14 }, (_, i) => (i === 6 || i === 13 ? 0 : OWARE_SEEDS));
  return new OwareState(pits, 0, 0, null, null);
}

/** Captures, plus (for the sharper bots) a little for seeds still to play with on your side. */
function evaluate(sharp: boolean) {
  return (generic: GameState<OwareMove>, seat: Seat): number => {
    const s = generic as OwareState;
    let score = (s.store(seat) - s.store(other(seat))) * 10;
    if (sharp) score += side(s.pits, seat) - side(s.pits, other(seat));
    return score;
  };
}

const TIERS: Record<BotTier, SearchTier & { sharp: boolean }> = {
  easy: { depth: 1, randomMoveRate: 0.35, sharp: false },
  medium: { depth: 3, randomMoveRate: 0.1, sharp: false },
  hard: { depth: 5, randomMoveRate: 0.02, sharp: true },
  expert: { depth: 7, randomMoveRate: 0, sharp: true },
};

export const oware: GameDefinition<OwareMove> = {
  id: 'oware',
  name: 'Oware',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: false,
  realtime: false,
  newGame: () => newOware(),
  createBot: (tier) => createSearchBot(TIERS[tier], evaluate(TIERS[tier].sharp)),
  encodeMove: (move) => move,
};
