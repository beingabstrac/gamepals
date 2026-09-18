import type { Rng } from '../../core/rng';
import { createRng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';
import { isRed, rankOf, suitOf, SUIT_SYMBOLS } from '../cards';

/**
 * Klondike solitaire (docs/games/solitaire.md).
 * Cards are 0–51: suit = floor(card / 13) (0 spades, 1 hearts, 2 diamonds, 3 clubs), rank = card % 13 + 1.
 */
export type SolitaireDraw = 1 | 3;
// Card helpers (suits, ranks, colours) come from games/cards.ts, which every card game shares.
// They are not re-exported here: the package index would then export the same name twice.

/** Standard scoring: +10 to a foundation, +5 waste to tableau, +5 turning a card up, -15 foundation to tableau. */
export const SOLITAIRE_POINTS = { foundation: 10, wasteToTableau: 5, turnUp: 5, fromFoundation: -15 } as const;

export interface Column {
  readonly cards: readonly number[];
  /** How many cards at the bottom of the column are face down. */
  readonly down: number;
}

/**
 * Moves are strings so they compare by value:
 *   d            draw from the stock (or turn the waste back over when the stock is empty)
 *   <from>><to>  from: w (waste top), t<col>:<index> (a face-up run), f<suit>; to: t<col>, f<suit>
 *   u            undo
 */
export type SolitaireMove = string;
export const DRAW_MOVE: SolitaireMove = 'd';
export const UNDO_CARD_MOVE: SolitaireMove = 'u';

function canStack(card: number, onto: number | undefined): boolean {
  if (onto === undefined) return rankOf(card) === 13;
  return rankOf(card) === rankOf(onto) - 1 && isRed(card) !== isRed(onto);
}

function canFound(card: number, pile: readonly number[]): boolean {
  const top = pile[pile.length - 1];
  return top === undefined ? rankOf(card) === 1 : rankOf(card) === rankOf(top) + 1;
}

export class SolitaireState implements GameState<SolitaireMove> {
  readonly currentSeat: Seat = 0;
  private cachedMoves: SolitaireMove[] | null = null;

  constructor(
    readonly draw: SolitaireDraw,
    /** Top of the stock is the last card. */
    readonly stock: readonly number[],
    /** Top of the waste is the last card. */
    readonly waste: readonly number[],
    /** One pile per suit, Ace first. */
    readonly foundations: readonly (readonly number[])[],
    readonly tableau: readonly Column[],
    readonly score: number,
    readonly moveCount: number,
    readonly result: GameResult | null,
    readonly previous: SolitaireState | null,
    /** Card turned face up by the last move, for the flip animation. */
    readonly flipped: number | null,
  ) {}

  /** Cards a move from `source` would carry (empty when the source has nothing to give). */
  cardsAt(source: string): number[] {
    if (source === 'w') return this.waste.length ? [this.waste[this.waste.length - 1]!] : [];
    if (source[0] === 'f') {
      const pile = this.foundations[Number(source.slice(1))]!;
      return pile.length ? [pile[pile.length - 1]!] : [];
    }
    const [col, index] = source.slice(1).split(':').map(Number) as [number, number];
    const column = this.tableau[col];
    if (!column || index < column.down || index >= column.cards.length) return [];
    return column.cards.slice(index);
  }

  /** Every place a card can be picked up from right now. */
  sources(): string[] {
    const out: string[] = [];
    if (this.waste.length) out.push('w');
    this.tableau.forEach((column, c) => {
      for (let i = column.down; i < column.cards.length; i++) out.push(`t${c}:${i}`);
    });
    this.foundations.forEach((pile, s) => {
      if (pile.length) out.push(`f${s}`);
    });
    return out;
  }

  legalMoves(seat: Seat): readonly SolitaireMove[] {
    if (this.result || seat !== 0) return [];
    if (this.cachedMoves) return this.cachedMoves;
    const moves: SolitaireMove[] = [];
    if (this.stock.length || this.waste.length) moves.push(DRAW_MOVE);
    for (const source of this.sources()) {
      const cards = this.cardsAt(source);
      const head = cards[0]!;
      if (cards.length === 1 && source[0] !== 'f' && canFound(head, this.foundations[suitOf(head)]!)) {
        moves.push(`${source}>f${suitOf(head)}`);
      }
      this.tableau.forEach((column, c) => {
        if (source.startsWith(`t${c}:`)) return;
        // A King that already sits alone at the bottom of a column gains nothing by moving to another empty one.
        if (column.cards.length === 0 && source.endsWith(':0')) return;
        if (canStack(head, column.cards[column.cards.length - 1])) moves.push(`${source}>t${c}`);
      });
    }
    if (this.previous) moves.push(UNDO_CARD_MOVE);
    this.cachedMoves = moves;
    return moves;
  }

  apply(move: SolitaireMove): SolitaireState {
    if (this.result) throw new Error('Game is over');
    if (!this.legalMoves(0).includes(move)) throw new Error(`Illegal move: ${move}`);
    if (move === UNDO_CARD_MOVE) return this.previous!;
    if (move === DRAW_MOVE) return this.drawCards();

    const [source, target] = move.split('>') as [string, string];
    const cards = this.cardsAt(source);
    let stock = this.stock;
    let waste = this.waste;
    const foundations = this.foundations.map((pile) => pile.slice());
    const tableau = this.tableau.map((column) => ({ cards: column.cards.slice(), down: column.down }));
    let score = this.score;
    let flipped: number | null = null;

    if (source === 'w') waste = waste.slice(0, -1);
    else if (source[0] === 'f') foundations[Number(source.slice(1))]!.pop();
    else {
      const [col, index] = source.slice(1).split(':').map(Number) as [number, number];
      const column = tableau[col]!;
      column.cards.length = index;
      // The card underneath turns face up on its own, like in every modern app.
      if (column.down > 0 && column.down === column.cards.length) {
        column.down--;
        flipped = column.cards[column.cards.length - 1]!;
        score += SOLITAIRE_POINTS.turnUp;
      }
    }

    if (target[0] === 'f') {
      foundations[Number(target.slice(1))]!.push(...cards);
      score += SOLITAIRE_POINTS.foundation;
    } else {
      tableau[Number(target.slice(1))]!.cards.push(...cards);
      if (source === 'w') score += SOLITAIRE_POINTS.wasteToTableau;
      if (source[0] === 'f') score += SOLITAIRE_POINTS.fromFoundation;
    }

    const won = foundations.every((pile) => pile.length === 13);
    return new SolitaireState(
      this.draw,
      stock,
      waste,
      foundations,
      tableau,
      Math.max(0, score),
      this.moveCount + 1,
      won ? { winners: [0], draw: false } : null,
      this,
      flipped,
    );
  }

  private drawCards(): SolitaireState {
    let stock: readonly number[];
    let waste: readonly number[];
    if (this.stock.length) {
      const count = Math.min(this.draw, this.stock.length);
      const taken = this.stock.slice(-count).reverse();
      stock = this.stock.slice(0, -count);
      waste = [...this.waste, ...taken];
    } else {
      // Turn the waste back over to make a new stock.
      stock = this.waste.slice().reverse();
      waste = [];
    }
    return new SolitaireState(this.draw, stock, waste, this.foundations, this.tableau, this.score, this.moveCount + 1, null, this, null);
  }

  /** True when every card is face up and out of the stock, so the rest can play itself. */
  canFinish(): boolean {
    return !this.result && this.stock.length === 0 && this.waste.length === 0 && this.tableau.every((column) => column.down === 0);
  }
}

export function newSolitaire(seed: number, draw: SolitaireDraw): SolitaireState {
  const rng = createRng(seed >>> 0);
  const deck = Array.from({ length: 52 }, (_, i) => i);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  const tableau: Column[] = [];
  let next = 0;
  for (let c = 0; c < 7; c++) {
    tableau.push({ cards: deck.slice(next, next + c + 1), down: c });
    next += c + 1;
  }
  return new SolitaireState(draw, deck.slice(next), [], [[], [], [], []], tableau, 0, 0, null, null, null);
}

/** Where a tapped card should go: a foundation first, then a column with cards, then an empty column. */
export function bestMoveFrom(state: SolitaireState, source: string): SolitaireMove | null {
  const moves = state.legalMoves(0).filter((m) => m.startsWith(`${source}>`));
  return (
    moves.find((m) => m.includes('>f')) ??
    moves.find((m) => state.tableau[Number(m.split('>t')[1])]!.cards.length > 0) ??
    moves[0] ??
    null
  );
}

/**
 * A good next move, the way a careful player thinks: play to the foundations, free a face-down card,
 * use the waste card, or draw. Null when only pointless shuffling is left.
 */
export function suggestMove(state: SolitaireState): SolitaireMove | null {
  const moves = state.legalMoves(0).filter((m) => m !== UNDO_CARD_MOVE);
  const toFoundation = moves.find((m) => m.includes('>f'));
  if (toFoundation) return toFoundation;
  const reveals = moves
    .filter((m) => m[0] === 't')
    .filter((m) => {
      const [col, index] = m.slice(1).split('>')[0]!.split(':').map(Number) as [number, number];
      return index === state.tableau[col]!.down && index > 0;
    })
    .sort((a, b) => state.tableau[Number(b[1])]!.down - state.tableau[Number(a[1])]!.down);
  if (reveals[0]) return reveals[0];
  const fromWaste = moves.find((m) => m.startsWith('w>t'));
  if (fromWaste) return fromWaste;
  // Split a run so the card it was covering can go home.
  const unlocks = moves.find((m) => {
    if (m[0] !== 't' || m.includes('>f')) return false;
    const [col, index] = m.slice(1).split('>')[0]!.split(':').map(Number) as [number, number];
    const under = state.tableau[col]!.cards[index - 1];
    return index > state.tableau[col]!.down && under !== undefined && canFound(under, state.foundations[suitOf(under)]!);
  });
  if (unlocks) return unlocks;
  return moves.includes(DRAW_MOVE) && !cycledWithoutProgress(state) ? DRAW_MOVE : null;
}

/** True once a whole pass through the deck has gone by with nothing else changing. */
export function cycledWithoutProgress(state: SolitaireState): boolean {
  let draws = 0;
  for (let s = state; s.previous && s.previous.tableau === s.tableau && s.previous.foundations === s.foundations; s = s.previous) draws++;
  const pass = Math.ceil((state.stock.length + state.waste.length) / state.draw) + 1;
  return draws > pass;
}

const RANDOM_RATE: Record<BotTier, number> = { easy: 0.5, medium: 0.2, hard: 0.05, expert: 0 };

function createSolitaireBot(tier: BotTier): Bot<SolitaireMove> {
  return {
    chooseMove(generic: GameState<SolitaireMove>, _seat: Seat, rng: Rng): SolitaireMove {
      const state = generic as SolitaireState;
      const moves = state.legalMoves(0).filter((m) => m !== UNDO_CARD_MOVE);
      if (moves.length === 0) throw new Error('No legal moves');
      if (rng.next() < RANDOM_RATE[tier]) return rng.pick(moves);
      // Stuck: try a different card move instead of drawing through the deck again.
      const shuffles = moves.filter((m) => m !== DRAW_MOVE && m[0] !== 'f');
      return suggestMove(state) ?? (shuffles.length ? rng.pick(shuffles) : rng.pick(moves));
    },
  };
}

export const solitaire: GameDefinition<SolitaireMove> = {
  id: 'solitaire',
  name: 'Solitaire',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo', 'race'],
  hiddenInfo: true,
  realtime: false,
  newGame: (config, seed) => newSolitaire(seed, config.variant === 'draw3' ? 3 : 1),
  createBot: (tier) => createSolitaireBot(tier),
  encodeMove: (move) => move,
};
