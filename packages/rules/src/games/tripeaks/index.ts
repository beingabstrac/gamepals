import { createRng } from '../../core/rng';
import type { GameDefinition, GameResult, GameState, Seat } from '../../core/types';
import { rankOf, shuffledDeck } from '../cards';

/**
 * TriPeaks (docs/games/tripeaks.md). Three peaks over a base row of ten; take any free card that
 * is one rank above or below the top of the waste, Ace wrapping both ways. Solo, so there are no bots.
 * Moves: `t<i>` take board card i, `d` turn a card from the deck, `u` take a move back.
 */
export type TriPeaksMove = string;
export const TRIPEAKS_DRAW: TriPeaksMove = 'd';
export const TRIPEAKS_UNDO: TriPeaksMove = 'u';
export const TRIPEAKS_CARDS = 28;
/** Cards in each row: three peak tops, then 6, then 9, then the base row of 10. */
export const TRIPEAKS_ROWS: readonly number[] = [3, 6, 9, 10];
const ROW_START = [0, 3, 9, 18];

/** The row a board place is in. */
export const rowOfPlace = (index: number): number => {
  for (let row = TRIPEAKS_ROWS.length - 1; row > 0; row--) if (index >= ROW_START[row]!) return row;
  return 0;
};

/**
 * The two places that overlap a card. Within a peak each card covers the two under it; the bottom
 * peak row sits on the base row, where neighbouring peaks share a card.
 */
export function coveredBy(index: number): [number, number] | null {
  const row = rowOfPlace(index);
  if (row === TRIPEAKS_ROWS.length - 1) return null;
  const place = index - ROW_START[row]!;
  if (row === 0) return [ROW_START[1]! + place * 2, ROW_START[1]! + place * 2 + 1];
  if (row === 1) {
    const peak = Math.floor(place / 2);
    const inPeak = place % 2;
    const first = ROW_START[2]! + peak * 3 + inPeak;
    return [first, first + 1];
  }
  return [ROW_START[3]! + place, ROW_START[3]! + place + 1];
}

/** Ranks run in a ring: an Ace takes a King or a two. */
export const nextTo = (a: number, b: number): boolean => {
  const step = Math.abs(rankOf(a) - rankOf(b));
  return step === 1 || step === 12;
};

export interface TriPeaksEvent {
  readonly kind: 'take' | 'draw';
  readonly place?: number;
}

export class TriPeaksState implements GameState<TriPeaksMove> {
  private cached?: TriPeaksMove[];

  constructor(
    /** The board, row by row; null where a card has been taken. */
    readonly board: readonly (number | null)[],
    /** How many of the board cards are face down; the base row starts face up. */
    readonly down: readonly boolean[],
    readonly stock: readonly number[],
    readonly waste: readonly number[],
    /** Cards taken since the last turn of the deck. */
    readonly run: number,
    readonly best: number,
    readonly moves: number,
    readonly result: GameResult | null,
    readonly last: TriPeaksEvent | null,
    readonly history: readonly TriPeaksState[] = [],
  ) {}

  get currentSeat(): Seat {
    return 0;
  }

  get left(): number {
    return this.board.filter((card) => card !== null).length;
  }

  get wasteTop(): number {
    return this.waste[this.waste.length - 1]!;
  }

  /** A card is free once both cards overlapping it are gone. */
  free(index: number): boolean {
    if (this.board[index] === null || this.board[index] === undefined) return false;
    const over = coveredBy(index);
    if (!over) return true;
    return this.board[over[0]] === null && this.board[over[1]] === null;
  }

  legalMoves(seat: Seat): readonly TriPeaksMove[] {
    if (this.result || seat !== 0) return [];
    this.cached ??= this.build();
    return this.cached;
  }

  private build(): TriPeaksMove[] {
    const list: TriPeaksMove[] = [];
    for (let i = 0; i < TRIPEAKS_CARDS; i++) if (this.free(i) && nextTo(this.board[i]!, this.wasteTop)) list.push(`t${i}`);
    if (this.stock.length) list.push(TRIPEAKS_DRAW);
    if (this.history.length) list.push(TRIPEAKS_UNDO);
    return list;
  }

  apply(play: TriPeaksMove): TriPeaksState {
    if (this.result) throw new Error('Game is over');
    if (!this.legalMoves(0).includes(play)) throw new Error(`Illegal move: ${play}`);
    if (play === TRIPEAKS_UNDO) return this.history[this.history.length - 1]!;
    const history = [...this.history, this].slice(-200);
    const stock = [...this.stock];
    const waste = [...this.waste];

    if (play === TRIPEAKS_DRAW) {
      waste.push(stock.pop()!);
      // Going back to the deck ends the run.
      return new TriPeaksState(this.board, this.down, stock, waste, 0, this.best, this.moves + 1, null, { kind: 'draw' }, history);
    }

    const place = Number(play.slice(1));
    const board = [...this.board];
    waste.push(board[place]!);
    board[place] = null;
    // Whatever that card was hiding now shows its face.
    const down = this.down.map((hidden, i) => hidden && !(board[i] !== null && bothGone(board, i)));
    const cleared = board.every((card) => card === null);
    const run = this.run + 1;
    return new TriPeaksState(
      board,
      down,
      stock,
      waste,
      run,
      Math.max(this.best, run),
      this.moves + 1,
      cleared ? { winners: [0], draw: false } : null,
      { kind: 'take', place },
      history,
    );
  }
}

/** Both of the cards overlapping this place are gone. */
function bothGone(board: readonly (number | null)[], index: number): boolean {
  const over = coveredBy(index);
  if (!over) return true;
  return board[over[0]] === null && board[over[1]] === null;
}

/** The deal: 28 board cards with only the base row face up, 23 in the deck and one already turned. */
export function newTriPeaks(seed: number): TriPeaksState {
  const deck = shuffledDeck(createRng(seed >>> 0));
  const board = deck.slice(0, TRIPEAKS_CARDS);
  const rest = deck.slice(TRIPEAKS_CARDS);
  const down = board.map((_, i) => rowOfPlace(i) < TRIPEAKS_ROWS.length - 1);
  return new TriPeaksState(board, down, rest.slice(1).reverse(), [rest[0]!], 0, 0, 0, null, null, []);
}

/** A move worth making, for the Hint button: take a card, and prefer the one that frees the most. */
export function triPeaksHint(state: TriPeaksState): TriPeaksMove | null {
  const moves = state.legalMoves(0).filter((play) => play !== TRIPEAKS_UNDO);
  const takes = moves.filter((play) => play[0] === 't');
  if (!takes.length) return moves.includes(TRIPEAKS_DRAW) ? TRIPEAKS_DRAW : null;
  // A card higher up the peaks opens more of the board than one along the base.
  return [...takes].sort((a, b) => rowOfPlace(Number(a.slice(1))) - rowOfPlace(Number(b.slice(1))))[0]!;
}

export const tripeaks: GameDefinition<TriPeaksMove> = {
  id: 'tripeaks',
  name: 'TriPeaks',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo'],
  hiddenInfo: false,
  realtime: false,
  newGame: (_config, seed) => newTriPeaks(seed),
  createBot: () => ({
    // Autoplay only: take a card while it can, turn one when it cannot, and step back when the
    // deal is spent. Picks are seeded, so games still replay exactly.
    chooseMove: (state, _seat, rng) => {
      const moves = state.legalMoves(0);
      const takes = moves.filter((play) => play[0] === 't');
      if (takes.length) return rng.pick(takes);
      if (moves.includes(TRIPEAKS_DRAW)) return TRIPEAKS_DRAW;
      if (!moves.length) throw new Error('No legal moves');
      return TRIPEAKS_UNDO;
    },
  }),
  encodeMove: (m) => m,
};
