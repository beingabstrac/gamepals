import { createRng } from '../../core/rng';
import type { GameDefinition, GameResult, GameState, Seat } from '../../core/types';
import { rankOf, shuffledDeck } from '../cards';

/**
 * Pyramid solitaire (docs/games/pyramid.md). Twenty-eight cards in a pyramid of seven rows;
 * take away uncovered pairs that add up to 13, and Kings on their own. Solo, so there are no bots.
 * Moves: `p<i>` a King in the pyramid, `p<i>.<j>` a pair in the pyramid, `p<i>.w` a pyramid card
 * with the top of the waste, `w` a King on the waste, `d` turn a card, `r` gather the waste back up.
 */
export type PyramidMove = string;
export const PYRAMID_DRAW: PyramidMove = 'd';
export const PYRAMID_REDEAL: PyramidMove = 'r';
export const PYRAMID_WASTE: PyramidMove = 'w';
export const PYRAMID_UNDO: PyramidMove = 'u';
export const PYRAMID_ROWS = 7;
export const PYRAMID_CARDS = 28;
/** Three times through the deck: the deal, then two redeals. */
export const PYRAMID_PASSES = 3;
export const PAIR_TO = 13;

/** The first index of a row, and the row and place of an index. */
export const rowStart = (row: number): number => (row * (row + 1)) / 2;
export const rowOfIndex = (index: number): number => {
  let row = 0;
  while (rowStart(row + 1) <= index) row++;
  return row;
};

export interface PyramidEvent {
  /** The cards that just left, by pyramid index, and whether the waste top went with them. */
  readonly taken: readonly number[];
  readonly waste: boolean;
  readonly kind: 'take' | 'draw' | 'redeal';
}

export class PyramidState implements GameState<PyramidMove> {
  private cached?: PyramidMove[];

  constructor(
    /** The pyramid, row by row; null where a card has been taken. */
    readonly pyramid: readonly (number | null)[],
    readonly stock: readonly number[],
    readonly waste: readonly number[],
    /** How many times the deck has been turned over, counting the deal. */
    readonly pass: number,
    readonly moves: number,
    readonly result: GameResult | null,
    readonly last: PyramidEvent | null,
    readonly history: readonly PyramidState[] = [],
  ) {}

  get currentSeat(): Seat {
    return 0;
  }

  /** How many cards are still on the pyramid. */
  get left(): number {
    return this.pyramid.filter((card) => card !== null).length;
  }

  /** A card is free once both of the cards overlapping it are gone. */
  free(index: number): boolean {
    if (this.pyramid[index] === null || this.pyramid[index] === undefined) return false;
    const row = rowOfIndex(index);
    if (row === PYRAMID_ROWS - 1) return true;
    const below = rowStart(row + 1) + (index - rowStart(row));
    return this.pyramid[below] === null && this.pyramid[below + 1] === null;
  }

  /** The card on top of the waste, or null when the waste is empty. */
  get wasteTop(): number | null {
    return this.waste.length ? this.waste[this.waste.length - 1]! : null;
  }

  legalMoves(seat: Seat): readonly PyramidMove[] {
    if (this.result || seat !== 0) return [];
    this.cached ??= this.build();
    return this.cached;
  }

  private build(): PyramidMove[] {
    const list: PyramidMove[] = [];
    const open: number[] = [];
    for (let i = 0; i < PYRAMID_CARDS; i++) if (this.free(i)) open.push(i);
    for (const i of open) {
      const rank = rankOf(this.pyramid[i]!);
      if (rank === PAIR_TO) list.push(`p${i}`);
    }
    for (let a = 0; a < open.length; a++) {
      for (let b = a + 1; b < open.length; b++) {
        if (rankOf(this.pyramid[open[a]!]!) + rankOf(this.pyramid[open[b]!]!) === PAIR_TO) list.push(`p${open[a]}.${open[b]}`);
      }
    }
    const top = this.wasteTop;
    if (top !== null) {
      if (rankOf(top) === PAIR_TO) list.push(PYRAMID_WASTE);
      for (const i of open) if (rankOf(this.pyramid[i]!) + rankOf(top) === PAIR_TO) list.push(`p${i}.w`);
    }
    if (this.stock.length) list.push(PYRAMID_DRAW);
    else if (this.waste.length > 1 && this.pass < PYRAMID_PASSES) list.push(PYRAMID_REDEAL);
    if (this.history.length) list.push(PYRAMID_UNDO);
    return list;
  }

  apply(play: PyramidMove): PyramidState {
    if (this.result) throw new Error('Game is over');
    if (!this.legalMoves(0).includes(play)) throw new Error(`Illegal move: ${play}`);
    if (play === PYRAMID_UNDO) return this.history[this.history.length - 1]!;
    const history = [...this.history, this].slice(-200);
    const pyramid = [...this.pyramid];
    const stock = [...this.stock];
    const waste = [...this.waste];

    if (play === PYRAMID_DRAW) {
      waste.push(stock.pop()!);
      return new PyramidState(pyramid, stock, waste, this.pass, this.moves + 1, null, { taken: [], waste: false, kind: 'draw' }, history);
    }
    if (play === PYRAMID_REDEAL) {
      // The waste goes back under the deck, the same way round, for the next pass.
      return new PyramidState(pyramid, [...waste].reverse(), [], this.pass + 1, this.moves + 1, null, { taken: [], waste: false, kind: 'redeal' }, history);
    }

    const taken: number[] = [];
    let usedWaste = false;
    if (play === PYRAMID_WASTE) {
      waste.pop();
      usedWaste = true;
    } else {
      const [first, second] = play.slice(1).split('.') as [string, string | undefined];
      taken.push(Number(first));
      if (second === 'w') {
        waste.pop();
        usedWaste = true;
      } else if (second !== undefined) taken.push(Number(second));
      for (const index of taken) pyramid[index] = null;
    }

    const cleared = pyramid.every((card) => card === null);
    return new PyramidState(
      pyramid,
      stock,
      waste,
      this.pass,
      this.moves + 1,
      cleared ? { winners: [0], draw: false } : null,
      { taken, waste: usedWaste, kind: 'take' },
      history,
    );
  }
}

/** The deal: 28 cards into seven rows, the rest face down as the stock. */
export function newPyramid(seed: number): PyramidState {
  const deck = shuffledDeck(createRng(seed >>> 0));
  return new PyramidState(deck.slice(0, PYRAMID_CARDS), deck.slice(PYRAMID_CARDS).reverse(), [], 1, 0, null, null, []);
}

/** A move worth making, for the Hint button: clear the pyramid first, and free the most cards. */
export function pyramidHint(state: PyramidState): PyramidMove | null {
  const moves = state.legalMoves(0).filter((play) => play !== PYRAMID_UNDO);
  const takes = moves.filter((play) => play[0] === 'p' || play === PYRAMID_WASTE);
  if (!takes.length) return moves.includes(PYRAMID_DRAW) ? PYRAMID_DRAW : (moves[0] ?? null);
  // Prefer taking two off the pyramid, then the lowest cards, which sit in the way of the most.
  const score = (play: PyramidMove): number => {
    if (play === PYRAMID_WASTE) return 3;
    const parts = play.slice(1).split('.');
    const pair = parts.length > 1 && parts[1] !== 'w';
    const deepest = Math.max(...parts.filter((part) => part !== 'w').map((part) => rowOfIndex(Number(part))));
    return (pair ? 0 : 1) * 10 - deepest;
  };
  return [...takes].sort((a, b) => score(a) - score(b))[0]!;
}

export const pyramid: GameDefinition<PyramidMove> = {
  id: 'pyramid',
  name: 'Pyramid',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo'],
  hiddenInfo: false,
  realtime: false,
  newGame: (_config, seed) => newPyramid(seed),
  createBot: () => ({
    // Autoplay only: take pairs off the pyramid while it can, turn cards when it cannot, and
    // take a move back when the deal is spent. Picks are seeded, so games still replay exactly.
    chooseMove: (state, _seat, rng) => {
      const moves = state.legalMoves(0);
      const takes = moves.filter((play) => play[0] === 'p' || play === PYRAMID_WASTE);
      if (takes.length) return rng.pick(takes);
      if (moves.includes(PYRAMID_DRAW)) return PYRAMID_DRAW;
      if (moves.includes(PYRAMID_REDEAL)) return PYRAMID_REDEAL;
      if (!moves.length) throw new Error('No legal moves');
      return PYRAMID_UNDO;
    },
  }),
  encodeMove: (m) => m,
};
