import { createRng, type Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';
import { rankOf, shuffledDeck, suitOf } from '../cards';
import { follows, ledSuit, trickRank, trickWinner, voidsFrom, type Played } from '../tricks';

/**
 * Hearts, the game most people mean by it: plain Hearts with the queen of spades added
 * (docs/games/hearts.md). Four players, thirteen cards each, and points are bad.
 * Moves: `p<card>` plays a card; `x<a>.<b>.<c>` passes those three on.
 */
export type HeartsMove = string;
export const heartsPlay = (card: number): HeartsMove => `p${card}`;
export const heartsPass = (cards: readonly number[]): HeartsMove => `x${[...cards].sort((a, b) => a - b).join('.')}`;
export const HEARTS = 1;
export const SPADES = 0;
export const QUEEN_RANK = 12;
export const TWO_OF_CLUBS = 3 * 13 + 1;
export const PASS_COUNT = 3;
/** Left, right, across, then a hand nobody passes on. */
export const PASS_ROUND = [1, 3, 2, 0] as const;
export const MOON = 26;

export type HeartsPhase = 'pass' | 'play';
/** How long a match runs, picked at the table. */
export type HeartsTarget = 'hand' | '50' | '100';
const TARGETS: Record<HeartsTarget, number> = { hand: 0, '50': 50, '100': 100 };

/** A heart is one, and the queen of spades is thirteen. */
export const heartsValue = (card: number): number => {
  if (suitOf(card) === HEARTS) return 1;
  return suitOf(card) === SPADES && rankOf(card) === QUEEN_RANK ? 13 : 0;
};
export const trickValue = (trick: readonly Played[]): number => trick.reduce((sum, play) => sum + heartsValue(play.card), 0);

export interface HeartsEvent {
  readonly kind: 'pass' | 'play' | 'trick' | 'hand';
  readonly seat?: Seat;
  readonly card?: number;
  /** Who took the trick that just closed, and what it cost them. */
  readonly took?: Seat;
  readonly points?: number;
  readonly moon?: Seat;
  readonly broke?: boolean;
}

export class HeartsState implements GameState<HeartsMove> {
  private cached?: HeartsMove[];

  constructor(
    readonly hands: readonly (readonly number[])[],
    /** Match scores, which is what the game is really about. */
    readonly scores: readonly number[],
    /** Points taken this hand. */
    readonly taken: readonly number[],
    readonly phase: HeartsPhase,
    /** What each seat has put aside to pass, while the passing lasts. */
    readonly passing: readonly (readonly number[])[],
    /** Which hand of the match this is, which decides which way the passing goes. */
    readonly hand: number,
    readonly trick: readonly Played[],
    /** Every closed trick of this hand, which everybody watched. */
    readonly tricks: readonly (readonly Played[])[],
    readonly broken: boolean,
    readonly currentSeat: Seat,
    readonly target: HeartsTarget,
    readonly moves: number,
    readonly result: GameResult | null,
    readonly last: HeartsEvent | null,
  ) {}

  get counts(): readonly number[] {
    return this.hands.map((hand) => hand.length);
  }

  /** Which way this hand's three cards go: 0 means nobody passes. */
  get passTo(): number {
    return PASS_ROUND[this.hand % PASS_ROUND.length]!;
  }

  /** Nothing that scores may go on the first trick. */
  private firstTrick(): boolean {
    return this.tricks.length === 0;
  }

  /** The cards this seat may legally play right now. */
  playable(seat: Seat): number[] {
    const hand = this.hands[seat]!;
    let allowed = hand.filter((card) => follows(hand, this.trick, card));
    if (this.firstTrick()) {
      // The two of clubs starts it, and nothing that costs points may be thrown on it.
      if (!this.trick.length) return hand.includes(TWO_OF_CLUBS) ? [TWO_OF_CLUBS] : allowed;
      const safe = allowed.filter((card) => heartsValue(card) === 0);
      if (safe.length) allowed = safe;
    } else if (!this.trick.length && !this.broken) {
      // Hearts cannot be led until they are broken, unless that is all there is.
      const others = allowed.filter((card) => suitOf(card) !== HEARTS);
      if (others.length) allowed = others;
    }
    return allowed;
  }

  legalMoves(seat: Seat): readonly HeartsMove[] {
    if (this.result) return [];
    if (seat !== this.currentSeat) return [];
    if (this.phase === 'pass') {
      // Everybody passes, one seat at a time, so the phone can go round before anything moves.
      this.cached ??= combinations(this.hands[seat]!).map(heartsPass);
      return this.cached;
    }
    this.cached ??= this.playable(seat).map(heartsPlay);
    return this.cached;
  }

  apply(play: HeartsMove): HeartsState {
    if (this.result) throw new Error('Game is over');
    if (play[0] === 'x') return this.applyPass(play);
    return this.applyPlay(play);
  }

  private applyPass(play: HeartsMove): HeartsState {
    const seat = this.currentSeat;
    if (this.phase !== 'pass' || this.passing[seat]!.length) throw new Error(`Illegal move: ${play}`);
    const cards = play.slice(1).split('.').map(Number);
    const hand = this.hands[seat]!;
    if (cards.length !== PASS_COUNT || cards.some((card) => !hand.includes(card))) throw new Error(`Illegal move: ${play}`);
    const passing = this.passing.map((list, i) => (i === seat ? cards : list));
    const waiting = passing.findIndex((list) => list.length === 0);
    if (waiting !== -1) {
      return new HeartsState(this.hands, this.scores, this.taken, 'pass', passing, this.hand, this.trick, this.tricks, this.broken,
        waiting as Seat, this.target, this.moves + 1, null, { kind: 'pass', seat });
    }
    // Everybody has chosen: the cards change hands at the same moment.
    const step = this.passTo;
    const hands = this.hands.map((_hand, i) => {
      const from = (i - step + this.hands.length) % this.hands.length;
      const kept = this.hands[i]!.filter((card) => !passing[i]!.includes(card));
      return [...kept, ...passing[from]!].sort((a, b) => a - b);
    });
    const leads = hands.findIndex((hand) => hand.includes(TWO_OF_CLUBS)) as Seat;
    return new HeartsState(hands, this.scores, this.taken, 'play', this.hands.map(() => []), this.hand, [], [], false,
      leads, this.target, this.moves + 1, null, { kind: 'pass' });
  }

  private applyPlay(play: HeartsMove): HeartsState {
    if (!this.legalMoves(this.currentSeat).includes(play)) throw new Error(`Illegal move: ${play}`);
    const seat = this.currentSeat;
    const card = Number(play.slice(1));
    const hands = this.hands.map((hand, i) => (i === seat ? hand.filter((held) => held !== card) : hand));
    const trick = [...this.trick, { seat, card }];
    const broke = !this.broken && suitOf(card) === HEARTS && ledSuit(this.trick) !== HEARTS;
    const broken = this.broken || suitOf(card) === HEARTS;

    if (trick.length < this.hands.length) {
      const next = ((seat + 1) % this.hands.length) as Seat;
      return new HeartsState(hands, this.scores, this.taken, 'play', this.passing, this.hand, trick, this.tricks, broken,
        next, this.target, this.moves + 1, null, { kind: 'play', seat, card, broke });
    }

    // The trick closes: whoever played the highest card of the suit led takes it, and leads next.
    const took = trickWinner(trick);
    const points = trickValue(trick);
    const taken = this.taken.map((n, i) => (i === took ? n + points : n));
    const tricks = [...this.tricks, trick];
    if (hands.some((hand) => hand.length)) {
      return new HeartsState(hands, this.scores, taken, 'play', this.passing, this.hand, [], tricks, broken,
        took, this.target, this.moves + 1, null, { kind: 'trick', took, points, card, seat });
    }
    return this.endHand(hands, taken, tricks, { kind: 'hand', took, points });
  }

  /** The hand is over: score it, and either deal again or finish the match. */
  private endHand(
    hands: readonly (readonly number[])[],
    taken: readonly number[],
    tricks: readonly (readonly Played[])[],
    event: HeartsEvent,
  ): HeartsState {
    const shooter = taken.findIndex((points) => points === MOON);
    // Shooting the moon: nothing for them, everything for everybody else.
    const added = shooter === -1 ? taken : taken.map((_, i) => (i === shooter ? 0 : MOON));
    const scores = this.scores.map((score, i) => score + added[i]!);
    const limit = TARGETS[this.target];
    const over = limit === 0 || scores.some((score) => score >= limit);
    if (!over) {
      const next = newHand(this.hand + 1, scores, this.target, this.moves + 1);
      return new HeartsState(next.hands, scores, next.taken, next.phase, next.passing, next.hand, [], [], false,
        next.currentSeat, this.target, this.moves + 1, null, { ...event, moon: shooter === -1 ? undefined : (shooter as Seat) });
    }
    const best = Math.min(...scores);
    const winners = scores.flatMap((score, i) => (score === best ? [i as Seat] : []));
    return new HeartsState(hands, scores, added, 'play', this.passing, this.hand, [], tricks, this.broken, this.currentSeat,
      this.target, this.moves + 1, { winners, draw: winners.length > 1 }, { ...event, moon: shooter === -1 ? undefined : (shooter as Seat) });
  }
}

/** Every way to choose three cards from a hand, which is what a pass is. */
function combinations(hand: readonly number[]): number[][] {
  const out: number[][] = [];
  for (let a = 0; a < hand.length; a++) {
    for (let b = a + 1; b < hand.length; b++) {
      for (let c = b + 1; c < hand.length; c++) out.push([hand[a]!, hand[b]!, hand[c]!]);
    }
  }
  return out;
}

/** A fresh hand of the match: deal thirteen each, and pass unless this is the fourth hand. */
function newHand(hand: number, scores: readonly number[], target: HeartsTarget, salt: number) {
  const deck = shuffledDeck(createRng(((hand + 1) * 2654435761 + salt) >>> 0));
  const hands = [0, 1, 2, 3].map((seat) => deck.slice(seat * 13, (seat + 1) * 13).sort((a, b) => a - b));
  const passes = PASS_ROUND[hand % PASS_ROUND.length]!;
  const leads = hands.findIndex((cards) => cards.includes(TWO_OF_CLUBS)) as Seat;
  return {
    hands,
    taken: [0, 0, 0, 0],
    passing: hands.map(() => [] as number[]),
    phase: (passes === 0 ? 'play' : 'pass') as HeartsPhase,
    hand,
    // Passing goes round from the first chair; once it is done, the two of clubs leads.
    currentSeat: (passes === 0 ? leads : 0) as Seat,
    scores,
    target,
  };
}

export function newHearts(seed: number, target: HeartsTarget = 'hand'): HeartsState {
  const start = newHand(0, [0, 0, 0, 0], target, seed >>> 0);
  return new HeartsState(start.hands, start.scores, start.taken, start.phase, start.passing, 0, [], [], false,
    start.currentSeat, target, 0, null, null);
}

/** What a seat may know: its own cards, the trick, what has been played, and the scores. */
export interface HeartsView {
  readonly hand: readonly number[];
  readonly trick: readonly Played[];
  readonly tricks: readonly (readonly Played[])[];
  readonly scores: readonly number[];
  readonly taken: readonly number[];
  readonly broken: boolean;
  readonly seat: Seat;
}

export const heartsViewFor = (state: HeartsState, seat: Seat): HeartsView => ({
  hand: state.hands[seat]!,
  trick: state.trick,
  tricks: state.tricks,
  scores: state.scores,
  taken: state.taken,
  broken: state.broken,
  seat,
});

interface HeartsStyle {
  /** Ducks under the trick rather than taking it. */
  readonly ducks: boolean;
  /** Passes its worst cards on rather than three at random. */
  readonly passesWell: boolean;
  /** Watches who has run out of which suit. */
  readonly watches: boolean;
}

const TIERS: Record<BotTier, HeartsStyle> = {
  easy: { ducks: false, passesWell: false, watches: false },
  medium: { ducks: true, passesWell: false, watches: false },
  hard: { ducks: true, passesWell: true, watches: false },
  expert: { ducks: true, passesWell: true, watches: true },
};

/** What a card costs to hold: the queen most, then high spades, then high hearts. */
function burden(card: number): number {
  if (suitOf(card) === SPADES && rankOf(card) === QUEEN_RANK) return 100;
  if (suitOf(card) === SPADES && trickRank(card) > QUEEN_RANK) return 60 + trickRank(card);
  if (suitOf(card) === HEARTS) return 20 + trickRank(card);
  return trickRank(card);
}

function choosePass(view: HeartsView, style: HeartsStyle, rng: Rng, moves: readonly HeartsMove[]): HeartsMove {
  if (!style.passesWell) return rng.pick(moves);
  const worst = [...view.hand].sort((a, b) => burden(b) - burden(a)).slice(0, PASS_COUNT);
  const wanted = heartsPass(worst);
  return moves.includes(wanted) ? wanted : rng.pick(moves);
}

function choosePlay(view: HeartsView, style: HeartsStyle, rng: Rng, moves: readonly HeartsMove[]): HeartsMove {
  if (moves.length === 1) return moves[0]!;
  const cards = moves.map((move) => Number(move.slice(1)));
  const led = ledSuit(view.trick);
  if (led === null) {
    // Leading: get out of the suits everybody is short of, and never lead into the queen.
    const voids = style.watches ? voidsFrom(view.tricks) : new Map();
    const risky = (card: number) => [...voids.values()].filter((set: Set<number>) => set.has(suitOf(card))).length;
    const score = (card: number) => trickRank(card) + burden(card) * 0.4 + risky(card) * 12;
    const best = Math.min(...cards.map(score));
    return heartsPlay(rng.pick(cards.filter((card) => score(card) === best)));
  }
  const following = cards.filter((card) => suitOf(card) === led);
  if (!following.length) {
    // Out of the suit: throw the worst thing in hand.
    const worst = Math.max(...cards.map(burden));
    return heartsPlay(rng.pick(cards.filter((card) => burden(card) === worst)));
  }
  const highest = Math.max(...view.trick.filter((p) => suitOf(p.card) === led).map((p) => trickRank(p.card)));
  const under = following.filter((card) => trickRank(card) < highest);
  const last = view.trick.length === 3;
  if (style.ducks && under.length) {
    // Slip under the trick with the highest card that still loses it.
    const top = Math.max(...under.map(trickRank));
    return heartsPlay(rng.pick(under.filter((card) => trickRank(card) === top)));
  }
  if (style.ducks && last && trickValue(view.trick) === 0) {
    // Nothing on it, so taking it is free and keeps the lead.
    const top = Math.max(...following.map(trickRank));
    return heartsPlay(rng.pick(following.filter((card) => trickRank(card) === top)));
  }
  const low = Math.min(...following.map(trickRank));
  return heartsPlay(rng.pick(following.filter((card) => trickRank(card) === low)));
}

function createHeartsBot(style: HeartsStyle): Bot<HeartsMove> {
  return {
    chooseMove(generic: GameState<HeartsMove>, seat: Seat, rng: Rng): HeartsMove {
      const state = generic as HeartsState;
      const moves = state.legalMoves(seat);
      if (!moves.length) throw new Error('No legal moves');
      // Handed a seat's view, never the state, so it cannot read another hand.
      const view = heartsViewFor(state, seat);
      return state.phase === 'pass' ? choosePass(view, style, rng, moves) : choosePlay(view, style, rng, moves);
    },
  };
}

const isTarget = (value: string | undefined): value is HeartsTarget => value === 'hand' || value === '50' || value === '100';

export const hearts: GameDefinition<HeartsMove> = {
  id: 'hearts',
  name: 'Hearts',
  minPlayers: 4,
  maxPlayers: 4,
  modes: ['bot', 'sameDevice', 'onlineLive'],
  hiddenInfo: true,
  realtime: false,
  newGame: (config, seed) => newHearts(seed, isTarget(config.variant) ? config.variant : 'hand'),
  createBot: (tier) => createHeartsBot(TIERS[tier]),
  encodeMove: (move) => move,
};
