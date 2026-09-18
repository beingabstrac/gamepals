import { createRng } from '../../core/rng';
import type { GameDefinition, GameResult, GameState, Seat } from '../../core/types';
import { rankOf, shuffledDeck, suitOf } from '../cards';

/**
 * Spider solitaire (docs/games/spider.md). Two packs, 10 columns, runs of one suit travel
 * together, and the stock deals a card onto every column at once. Solo, so no bots.
 * Moves: `m<from>.<to>` moves the run under the top of a column, `d` deals, `u` undoes.
 */
export type SpiderLevel = 'one' | 'two' | 'four';
export const SPIDER_SUITS: Record<SpiderLevel, number> = { one: 1, two: 2, four: 4 };
export type SpiderMove = string;
export const SPIDER_DEAL: SpiderMove = 'd';
export const SPIDER_UNDO: SpiderMove = 'u';
export const SPIDER_COLUMNS = 10;
export const RUNS_TO_WIN = 8;
export const spiderMove = (from: number, to: number): SpiderMove => `m${from}.${to}`;

export interface SpiderColumn {
  readonly cards: readonly number[];
  /** How many cards at the top of the column are still face down. */
  readonly down: number;
}

export interface SpiderEvent {
  readonly kind: 'move' | 'deal' | 'run';
  readonly from?: number;
  readonly to?: number;
  readonly count?: number;
  /** A King-to-Ace run of one suit just left the board. */
  readonly completed?: number;
}

export class SpiderState implements GameState<SpiderMove> {
  private cached?: SpiderMove[];

  constructor(
    readonly level: SpiderLevel,
    readonly columns: readonly SpiderColumn[],
    readonly stock: readonly number[],
    /** Full suit runs taken off the board. */
    readonly done: number,
    readonly moves: number,
    readonly result: GameResult | null,
    readonly last: SpiderEvent | null,
    readonly history: readonly SpiderState[] = [],
  ) {}

  get currentSeat(): Seat {
    return 0;
  }

  /** Face-up cards at the bottom of a column that run down in one suit. */
  runLength(column: number): number {
    const { cards, down } = this.columns[column]!;
    const faceUp = cards.length - down;
    if (faceUp <= 0) return 0;
    let run = 1;
    for (let i = cards.length - 1; i > down; i--) {
      const lower = cards[i]!;
      const upper = cards[i - 1]!;
      if (rankOf(upper) !== rankOf(lower) + 1 || suitOf(upper) !== suitOf(lower)) break;
      run++;
    }
    return run;
  }

  legalMoves(seat: Seat): readonly SpiderMove[] {
    if (this.result || seat !== 0) return [];
    this.cached ??= this.build();
    return this.cached;
  }

  private build(): SpiderMove[] {
    const list: SpiderMove[] = [];
    this.columns.forEach((column, from) => {
      const run = this.runLength(from);
      for (let count = 1; count <= run; count++) {
        const card = column.cards[column.cards.length - count]!;
        this.columns.forEach((target, to) => {
          if (to === from) return;
          if (target.cards.length === 0) {
            if (column.cards.length - count > 0 || count < column.cards.length) list.push(`${spiderMove(from, to)}.${count}`);
            return;
          }
          const onto = target.cards[target.cards.length - 1]!;
          if (target.down === target.cards.length) return; // Top card is face down.
          if (rankOf(onto) === rankOf(card) + 1) list.push(`${spiderMove(from, to)}.${count}`);
        });
      }
    });
    // A deal needs cards left and no empty column.
    if (this.stock.length > 0 && this.columns.every((column) => column.cards.length > 0)) list.push(SPIDER_DEAL);
    if (this.history.length) list.push(SPIDER_UNDO);
    return list;
  }

  apply(play: SpiderMove): SpiderState {
    if (this.result) throw new Error('Game is over');
    if (!this.legalMoves(0).includes(play)) throw new Error(`Illegal move: ${play}`);
    if (play === SPIDER_UNDO) return this.history[this.history.length - 1]!;
    const history = [...this.history, this].slice(-200);

    if (play === SPIDER_DEAL) {
      const stock = [...this.stock];
      const columns = this.columns.map((column) => ({ cards: [...column.cards, stock.pop()!], down: column.down }));
      const settled = this.settle(columns);
      return new SpiderState(this.level, settled.columns, stock, this.done + settled.completed.length, this.moves + 1, null, { kind: 'deal' }, history);
    }

    const [places, countText] = play.slice(1).split('.').reduce<[number[], string]>(
      (acc, part, i) => (i < 2 ? [[...acc[0], Number(part)], acc[1]] : [acc[0], part]),
      [[], '1'],
    );
    const [from, to] = places as [number, number];
    const count = Number(countText);
    const columns = this.columns.map((column) => ({ cards: [...column.cards], down: column.down }));
    const moving = columns[from]!.cards.splice(-count);
    columns[to]!.cards.push(...moving);
    // Uncovering the card above turns it face up.
    if (columns[from]!.down > columns[from]!.cards.length) columns[from]!.down = columns[from]!.cards.length;
    if (columns[from]!.down === columns[from]!.cards.length && columns[from]!.cards.length > 0) columns[from]!.down--;

    const settled = this.settle(columns);
    const done = this.done + settled.completed.length;
    const event: SpiderEvent = { kind: settled.completed.length ? 'run' : 'move', from, to, count, ...(settled.completed.length ? { completed: settled.completed[0] } : {}) };
    return new SpiderState(
      this.level,
      settled.columns,
      this.stock,
      done,
      this.moves + 1,
      done === RUNS_TO_WIN ? { winners: [0], draw: false } : null,
      event,
      history,
    );
  }

  /** Lifts any King-to-Ace run of one suit off the board, turning up what it leaves behind. */
  private settle(columns: { cards: number[]; down: number }[]): { columns: SpiderColumn[]; completed: number[] } {
    const completed: number[] = [];
    for (const column of columns) {
      const faceUp = column.cards.length - column.down;
      if (faceUp < 13) continue;
      const tail = column.cards.slice(-13);
      const suit = suitOf(tail[0]!);
      const full = tail.every((card, i) => suitOf(card) === suit && rankOf(card) === 13 - i);
      if (!full) continue;
      column.cards.splice(-13);
      completed.push(suit);
      if (column.cards.length > 0 && column.down === column.cards.length) column.down--;
    }
    return { columns: columns.map((column) => ({ cards: column.cards, down: column.down })), completed };
  }
}

/** The deal: 10 columns (6, 6, 6, 6, 5, 5, 5, 5, 5, 5) with the bottom card face up, 50 in the stock. */
export function newSpider(seed: number, level: SpiderLevel = 'two'): SpiderState {
  const suits = SPIDER_SUITS[level];
  const rng = createRng(seed >>> 0);
  // One suit means eight packs of that suit; two means four of each of two suits, and so on.
  // Adding a whole pack (52) leaves suit and rank alone, so every card keeps its own number
  // even when eight of them show the same face: the screen needs to tell them apart.
  const copies = new Map<number, number>();
  const deck = shuffledDeck(rng, 2).map((card) => {
    const face = (suitOf(card) % suits) * 13 + (rankOf(card) - 1);
    const seen = copies.get(face) ?? 0;
    copies.set(face, seen + 1);
    return face + seen * 52;
  });
  const columns: SpiderColumn[] = [];
  let at = 0;
  for (let i = 0; i < SPIDER_COLUMNS; i++) {
    const size = i < 4 ? 6 : 5;
    const cards = deck.slice(at, at + size);
    at += size;
    columns.push({ cards, down: size - 1 });
  }
  return new SpiderState(level, columns, deck.slice(at), 0, 0, null, null, []);
}

const isLevel = (value: string | undefined): value is SpiderLevel => value === 'one' || value === 'two' || value === 'four';

export const spider: GameDefinition<SpiderMove> = {
  id: 'spider',
  name: 'Spider',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo'],
  hiddenInfo: false,
  realtime: false,
  newGame: (config, seed) => newSpider(seed, isLevel(config.variant) ? config.variant : 'two'),
  createBot: () => ({
    chooseMove: (state) => {
      const moves = state.legalMoves(0).filter((m) => m !== SPIDER_UNDO);
      if (!moves.length) throw new Error('No legal moves');
      // Autoplay only: move cards while it can, and deal when it cannot.
      return moves.find((m) => m[0] === 'm') ?? moves[0]!;
    },
  }),
  encodeMove: (m) => m,
};

/** The move a tap on a column should make: the run under the tap, onto the friendliest column. */
export function spiderMoveFrom(state: SpiderState, from: number, count = 1): SpiderMove | null {
  const wanted = state.legalMoves(0).filter((play) => play.startsWith(`m${from}.`) && Number(play.split('.')[2]) === count);
  if (!wanted.length) return null;
  const card = state.columns[from]!.cards.at(-count)!;
  const score = (play: SpiderMove): number => {
    const to = Number(play.split('.')[1]);
    const target = state.columns[to]!;
    if (target.cards.length === 0) return 2; // Keep empty columns free while anything else fits.
    // Landing on the same suit builds a run that can leave the board.
    return suitOf(target.cards[target.cards.length - 1]!) === suitOf(card) ? 0 : 1;
  };
  return [...wanted].sort((a, b) => score(a) - score(b))[0]!;
}

/** A move worth making, for the Hint button. Null when only a deal or an undo is left. */
export function spiderHint(state: SpiderState): SpiderMove | null {
  const moves = state.legalMoves(0).filter((play) => play[0] === 'm');
  if (!moves.length) return state.legalMoves(0).includes(SPIDER_DEAL) ? SPIDER_DEAL : null;
  const score = (play: SpiderMove): number => {
    const [from, to] = play.slice(1).split('.').map(Number) as [number, number];
    const count = Number(play.split('.')[2]);
    const source = state.columns[from]!;
    const target = state.columns[to]!;
    const card = source.cards[source.cards.length - count]!;
    const onto = target.cards[target.cards.length - 1];
    const sameSuit = onto !== undefined && suitOf(onto) === suitOf(card);
    if (source.cards.length === count && source.down === 0) return 4; // Moving a whole column only shuffles it about.
    const uncovers = source.cards.length - count === source.down && source.down > 0;
    if (sameSuit && uncovers) return 0;
    if (sameSuit) return 1;
    if (uncovers) return 2;
    return 3;
  };
  const best = [...moves].sort((a, b) => score(a) - score(b))[0]!;
  return score(best) >= 4 ? (state.legalMoves(0).includes(SPIDER_DEAL) ? SPIDER_DEAL : best) : best;
}
