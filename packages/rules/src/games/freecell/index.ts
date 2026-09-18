import { createRng } from '../../core/rng';
import type { GameDefinition, GameResult, GameState, Seat } from '../../core/types';
import { isRed, rankOf, shuffledDeck, suitOf } from '../cards';

/**
 * FreeCell (docs/games/freecell.md). Every card is face up from the start: 8 columns,
 * 4 free cells, 4 foundations. Solo, so there are no bots.
 * Moves: `c<from><to>` where a place is `t0`–`t7` (columns), `f0`–`f3` (free cells),
 * `h0`–`h3` (foundations, one per suit); `u` takes the last move back.
 */
export type FreeCellMove = string;
export const FREECELL_UNDO: FreeCellMove = 'u';
export const FREECELL_COLUMNS = 8;
export const FREECELL_CELLS = 4;
export const freeCellPlay = (from: string, to: string): FreeCellMove => `c${from}.${to}`;

export interface FreeCellEvent {
  readonly from: string;
  readonly to: string;
  /** How many cards travelled together. */
  readonly count: number;
}

export class FreeCellState implements GameState<FreeCellMove> {
  private cached?: FreeCellMove[];

  constructor(
    readonly columns: readonly (readonly number[])[],
    /** One card or null in each free cell. */
    readonly cells: readonly (number | null)[],
    /** The highest rank home in each suit, 0 for empty. */
    readonly foundations: readonly number[],
    readonly moves: number,
    readonly result: GameResult | null,
    readonly last: FreeCellEvent | null,
    /** Every earlier position, so undo can step back through the whole game. */
    readonly history: readonly FreeCellState[] = [],
  ) {}

  get currentSeat(): Seat {
    return 0;
  }

  /** Cards at the bottom of a column that already form a run: down in rank, alternating colour. */
  runLength(column: number): number {
    const cards = this.columns[column]!;
    let run = 1;
    for (let i = cards.length - 1; i > 0; i--) {
      const lower = cards[i]!;
      const upper = cards[i - 1]!;
      if (rankOf(upper) !== rankOf(lower) + 1 || isRed(upper) === isRed(lower)) break;
      run++;
    }
    return cards.length === 0 ? 0 : run;
  }

  /** (free cells + 1) × 2^(empty columns), halved when the target column is empty. */
  maxMove(toEmptyColumn: boolean): number {
    const freeCells = this.cells.filter((card) => card === null).length;
    const emptyColumns = this.columns.filter((cards) => cards.length === 0).length;
    const most = (freeCells + 1) * 2 ** emptyColumns;
    return toEmptyColumn ? Math.max(1, Math.floor(most / 2)) : most;
  }

  /** Can `card` go here, ignoring how many cards travel with it? */
  private accepts(place: string, card: number): boolean {
    const index = Number(place.slice(1));
    if (place[0] === 'f') return this.cells[index] === null;
    if (place[0] === 'h') return suitOf(card) === index && this.foundations[index] === rankOf(card) - 1;
    const cards = this.columns[index]!;
    if (cards.length === 0) return true;
    const onto = cards[cards.length - 1]!;
    return rankOf(onto) === rankOf(card) + 1 && isRed(onto) !== isRed(card);
  }

  legalMoves(seat: Seat): readonly FreeCellMove[] {
    if (this.result || seat !== 0) return [];
    this.cached ??= this.build();
    return this.cached;
  }

  private build(): FreeCellMove[] {
    const places = [
      ...Array.from({ length: FREECELL_COLUMNS }, (_, i) => `t${i}`),
      ...Array.from({ length: FREECELL_CELLS }, (_, i) => `f${i}`),
      ...Array.from({ length: 4 }, (_, i) => `h${i}`),
    ];
    const list: FreeCellMove[] = [];
    for (const from of places) {
      if (from[0] === 'h') continue; // Cards stay home once they are home.
      const index = Number(from.slice(1));
      const isColumn = from[0] === 't';
      const run = isColumn ? this.runLength(index) : 1;
      for (let count = 1; count <= run; count++) {
        const cards = isColumn ? this.columns[index]! : [this.cells[index]];
        const card = isColumn ? cards[cards.length - count]! : this.cells[index];
        if (card === null || card === undefined) continue;
        for (const to of places) {
          if (to === from) continue;
          if (count > 1 && to[0] !== 't') continue; // Only a column takes a run.
          if (!this.accepts(to, card)) continue;
          const toEmpty = to[0] === 't' && this.columns[Number(to.slice(1))]!.length === 0;
          if (count > this.maxMove(toEmpty)) continue;
          list.push(count === 1 ? freeCellPlay(from, to) : `${freeCellPlay(from, to)}.${count}`);
        }
      }
    }
    if (this.history.length) list.push(FREECELL_UNDO);
    return list;
  }

  apply(play: FreeCellMove): FreeCellState {
    if (this.result) throw new Error('Game is over');
    if (!this.legalMoves(0).includes(play)) throw new Error(`Illegal move: ${play}`);
    if (play === FREECELL_UNDO) return this.history[this.history.length - 1]!;

    const [from, to, countText] = play.slice(1).split('.');
    const count = countText ? Number(countText) : 1;
    const columns = this.columns.map((cards) => [...cards]);
    const cells = [...this.cells];
    const foundations = [...this.foundations];

    let moving: number[];
    if (from![0] === 't') moving = columns[Number(from!.slice(1))]!.splice(-count);
    else {
      const index = Number(from!.slice(1));
      moving = [cells[index]!];
      cells[index] = null;
    }
    if (to![0] === 't') columns[Number(to!.slice(1))]!.push(...moving);
    else if (to![0] === 'f') cells[Number(to!.slice(1))] = moving[0]!;
    else foundations[Number(to!.slice(1))] = rankOf(moving[0]!);

    const done = foundations.every((rank) => rank === 13);
    const history = [...this.history, this].slice(-200);
    return new FreeCellState(
      columns,
      cells,
      foundations,
      this.moves + 1,
      done ? { winners: [0], draw: false } : null,
      { from: from!, to: to!, count },
      history,
    );
  }
}

/** The deal: 8 columns, four of 7 and four of 6, every card face up. */
export function newFreeCell(seed: number): FreeCellState {
  const deck = shuffledDeck(createRng(seed >>> 0));
  const columns: number[][] = Array.from({ length: FREECELL_COLUMNS }, () => []);
  deck.forEach((card, i) => columns[i % FREECELL_COLUMNS]!.push(card));
  return new FreeCellState(columns, Array<number | null>(FREECELL_CELLS).fill(null), [0, 0, 0, 0], 0, null, null, []);
}

export const freecell: GameDefinition<FreeCellMove> = {
  id: 'freecell',
  name: 'FreeCell',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo'],
  hiddenInfo: false,
  realtime: false,
  newGame: (_config, seed) => newFreeCell(seed),
  createBot: () => ({
    chooseMove: (state) => {
      const moves = state.legalMoves(0).filter((m) => m !== FREECELL_UNDO);
      if (!moves.length) throw new Error('No legal moves');
      // Autoplay only: prefer sending a card home, so a test game makes progress.
      return moves.find((m) => m.includes('.h')) ?? moves[0]!;
    },
  }),
  encodeMove: (m) => m,
};

/** How a place is ranked as somewhere to send a card: home first, then a column, a cell last. */
const placeRank = (to: string): number => (to[0] === 'h' ? 0 : to[0] === 't' ? 1 : 2);

/** The move a tap on this place should make: home if it can go home, else a column, else a free cell. */
export function freeCellMoveFrom(state: FreeCellState, from: string, count = 1): FreeCellMove | null {
  const prefix = `c${from}.`;
  const wanted = state
    .legalMoves(0)
    .filter((play) => play.startsWith(prefix))
    .filter((play) => (Number(play.split('.')[2] ?? 1) || 1) === count);
  if (!wanted.length) return null;
  const score = (play: FreeCellMove): number => {
    const to = play.split('.')[1]!;
    const empty = to[0] === 't' && state.columns[Number(to.slice(1))]!.length === 0;
    // An empty column is worth keeping, so it comes after a column that already takes the card.
    return placeRank(to) * 2 + (empty ? 1 : 0);
  };
  return [...wanted].sort((a, b) => score(a) - score(b))[0]!;
}

/** A move worth making, for the Hint button. Sending a card home always wins. */
export function freeCellHint(state: FreeCellState): FreeCellMove | null {
  const moves = state.legalMoves(0).filter((play) => play !== FREECELL_UNDO);
  if (!moves.length) return null;
  const NOT_WORTH = 9;
  const score = (play: FreeCellMove): number => {
    const [from, to] = play.slice(1).split('.') as [string, string];
    const count = Number(play.split('.')[2] ?? 1) || 1;
    if (to[0] === 'h') return 0;
    if (to[0] === 'f') {
      if (from[0] === 'f') return NOT_WORTH; // Shuffling cards between cells gains nothing.
      // Parking a card is worth it when the card underneath can then go home.
      const after = state.apply(play);
      return after.legalMoves(0).some((next) => next.split('.')[1]?.[0] === 'h') ? 5 : NOT_WORTH;
    }
    const emptied = from[0] === 't' && state.columns[Number(from.slice(1))]!.length === count;
    const lands = state.columns[Number(to.slice(1))]!.length > 0;
    if (!lands && from[0] === 't' && emptied) return NOT_WORTH; // Column to empty column: nothing changes.
    if (emptied && lands) return 1; // A column freed, and the cards still have a home.
    if (from[0] === 'f') return 2; // A cell freed.
    if (lands) return 3 - Math.min(2, count) * 0.1; // Building on a column, longer runs first.
    return 4;
  };
  const best = [...moves].sort((a, b) => score(a) - score(b))[0]!;
  return score(best) >= NOT_WORTH ? null : best;
}
