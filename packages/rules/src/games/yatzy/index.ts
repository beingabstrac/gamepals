import { createRng, type Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Yatzy, Scandinavian scoring (docs/games/yatzy.md). Five dice, up to three rolls a turn, 15 boxes each.
 * Moves are strings: `r` + five 0/1 flags (1 keeps that die) rolls the rest; `s<box>` scores a box.
 */
export const YATZY_BOXES = [
  'ones', 'twos', 'threes', 'fours', 'fives', 'sixes',
  'pair', 'twoPairs', 'three', 'four', 'smallStraight', 'largeStraight', 'fullHouse', 'chance', 'yatzy',
] as const;
export type YatzyBox = (typeof YATZY_BOXES)[number];
export type YatzyMove = string;
export const YATZY_BONUS_AT = 63;
export const YATZY_BONUS = 50;
export const YATZY_FIRST_ROLL: YatzyMove = 'r00000';
export const yatzyRoll = (keep: readonly boolean[]): YatzyMove => `r${keep.map((k) => (k ? '1' : '0')).join('')}`;
export const yatzyScore = (box: YatzyBox): YatzyMove => `s${box}`;

/** The n-th die thrown in a game, fixed by the seed. */
export function yatzyDie(seed: number, n: number): number {
  return createRng((seed ^ Math.imul(n + 1, 0xc2b2ae35)) >>> 0).int(6) + 1;
}

export function scoreBox(box: YatzyBox, dice: readonly number[]): number {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) counts[d]!++;
  const sum = dice.reduce((a, b) => a + b, 0);
  const withAtLeast = (n: number) => [6, 5, 4, 3, 2, 1].filter((v) => counts[v]! >= n);
  const upper = YATZY_BOXES.indexOf(box);
  if (upper < 6) return counts[upper + 1]! * (upper + 1);
  switch (box) {
    case 'pair': {
      const v = withAtLeast(2)[0];
      return v ? v * 2 : 0;
    }
    case 'twoPairs': {
      const pairs = withAtLeast(2);
      return pairs.length >= 2 ? pairs[0]! * 2 + pairs[1]! * 2 : 0;
    }
    case 'three': {
      const v = withAtLeast(3)[0];
      return v ? v * 3 : 0;
    }
    case 'four': {
      const v = withAtLeast(4)[0];
      return v ? v * 4 : 0;
    }
    case 'smallStraight':
      return [1, 2, 3, 4, 5].every((v) => counts[v] === 1) ? 15 : 0;
    case 'largeStraight':
      return [2, 3, 4, 5, 6].every((v) => counts[v] === 1) ? 20 : 0;
    case 'fullHouse':
      return withAtLeast(3).length === 1 && counts.filter((c) => c === 2).length === 1 ? sum : 0;
    case 'chance':
      return sum;
    case 'yatzy':
      return withAtLeast(5).length ? 50 : 0;
    default:
      return 0;
  }
}

export type YatzyCard = readonly (number | null)[];
export const upperSum = (card: YatzyCard): number => card.slice(0, 6).reduce<number>((a, b) => a + (b ?? 0), 0);
export const bonusOf = (card: YatzyCard): number => (upperSum(card) >= YATZY_BONUS_AT ? YATZY_BONUS : 0);
export const totalOf = (card: YatzyCard): number => card.reduce<number>((a, b) => a + (b ?? 0), 0) + bonusOf(card);

export type YatzyEvent =
  | { readonly kind: 'roll'; readonly seat: Seat; readonly kept: readonly boolean[] }
  | { readonly kind: 'score'; readonly seat: Seat; readonly box: YatzyBox; readonly points: number; readonly bonus: boolean };

export class YatzyState implements GameState<YatzyMove> {
  constructor(
    readonly seed: number,
    readonly cards: readonly YatzyCard[],
    /** The five dice; zeros before the first roll of the game. */
    readonly dice: readonly number[],
    readonly rollsUsed: number,
    readonly currentSeat: Seat,
    /** Dice thrown so far, which picks the next die from the seed. */
    readonly thrown: number,
    readonly result: GameResult | null,
    readonly last: YatzyEvent | null,
  ) {}

  get players(): number {
    return this.cards.length;
  }

  total(seat: Seat): number {
    return totalOf(this.cards[seat]!);
  }

  openBoxes(seat: Seat): YatzyBox[] {
    return YATZY_BOXES.filter((_, i) => this.cards[seat]![i] === null);
  }

  legalMoves(seat: Seat): readonly YatzyMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    if (this.rollsUsed === 0) return [YATZY_FIRST_ROLL];
    const moves: YatzyMove[] = [];
    if (this.rollsUsed < 3) {
      for (let mask = 0; mask < 32; mask++) moves.push(yatzyRoll([0, 1, 2, 3, 4].map((i) => ((mask >> i) & 1) === 1)));
    }
    for (const box of this.openBoxes(seat)) moves.push(yatzyScore(box));
    return moves;
  }

  apply(move: YatzyMove): YatzyState {
    if (this.result) throw new Error('Game is over');
    if (!this.legalMoves(this.currentSeat).includes(move)) throw new Error(`Illegal move: ${move}`);
    const seat = this.currentSeat;
    if (move[0] === 'r') {
      const kept = [...move.slice(1)].map((c) => c === '1');
      let thrown = this.thrown;
      const dice = this.dice.map((d, i) => (kept[i] ? d : yatzyDie(this.seed, thrown++)));
      return new YatzyState(this.seed, this.cards, dice, this.rollsUsed + 1, seat, thrown, null, { kind: 'roll', seat, kept });
    }
    const box = move.slice(1) as YatzyBox;
    const points = scoreBox(box, this.dice);
    const card = this.cards[seat]!.slice();
    const hadBonus = bonusOf(card) > 0;
    card[YATZY_BOXES.indexOf(box)] = points;
    const cards = this.cards.map((c, s) => (s === seat ? card : c));
    const event: YatzyEvent = { kind: 'score', seat, box, points, bonus: !hadBonus && bonusOf(card) > 0 };
    const next = (seat + 1) % this.players;
    const done = cards.every((c) => c.every((v) => v !== null));
    return new YatzyState(this.seed, cards, this.dice, 0, next, this.thrown, done ? resultOf(cards) : null, event);
  }
}

function resultOf(cards: readonly YatzyCard[]): GameResult {
  const totals = cards.map(totalOf);
  const best = Math.max(...totals);
  const winners = totals.flatMap((t, seat) => (t === best ? [seat] : []));
  if (cards.length > 1 && winners.length === cards.length) return { winners: [], draw: true };
  return { winners, draw: false };
}

export function newYatzy(players: number, seed: number): YatzyState {
  if (players < 1 || players > 4) throw new Error(`Yatzy needs 1–4 players, got ${players}`);
  const cards = Array.from({ length: players }, () => Array<number | null>(15).fill(null));
  return new YatzyState(seed >>> 0, cards, [0, 0, 0, 0, 0], 0, 0, 0, null, null);
}

// ---- Bots: they only see the dice on the table and roll their own simulated dice to plan, never the game's.

/** Scores for every box, for each of the 252 possible sets of five dice. */
const TABLE = new Map<string, number[]>();
const keyOf = (dice: readonly number[]) => [...dice].sort().join('');
for (let a = 1; a <= 6; a++)
  for (let b = a; b <= 6; b++)
    for (let c = b; c <= 6; c++)
      for (let d = c; d <= 6; d++)
        for (let e = d; e <= 6; e++) TABLE.set(`${a}${b}${c}${d}${e}`, YATZY_BOXES.map((box) => scoreBox(box, [a, b, c, d, e])));

/** A typical score for each box: scoring well under it wastes the box. */
const PAR = [2, 5, 8, 11, 14, 17, 9, 14, 11, 8, 5, 5, 10, 20, 6];

interface YatzyTier {
  /** Simulated rerolls per keep choice; 0 keeps the most common number. */
  readonly samples: number;
  /** Weigh boxes against their typical score and the upper bonus. */
  readonly sharp: boolean;
  /** Also plan for the roll after next. */
  readonly deep: boolean;
}

const TIERS: Record<BotTier, YatzyTier> = {
  easy: { samples: 0, sharp: false, deep: false },
  medium: { samples: 0, sharp: true, deep: false },
  hard: { samples: 30, sharp: true, deep: false },
  expert: { samples: 40, sharp: true, deep: true },
};

function boxValue(index: number, points: number, card: YatzyCard, sharp: boolean): number {
  if (!sharp) return points - index * 0.001;
  let value = points - PAR[index]!;
  if (index < 6) {
    const upper = upperSum(card);
    if (upper < YATZY_BONUS_AT) {
      value += points - 3 * (index + 1);
      if (upper + points >= YATZY_BONUS_AT) value += 25;
    }
  }
  return value;
}

function bestBox(dice: readonly number[], card: YatzyCard, sharp: boolean): { index: number; value: number } {
  const scores = TABLE.get(keyOf(dice))!;
  let best = { index: -1, value: -Infinity };
  card.forEach((v, index) => {
    if (v !== null) return;
    const value = boxValue(index, scores[index]!, card, sharp);
    if (value > best.value) best = { index, value };
  });
  return best;
}

/** Keep every die showing the most common number (the higher number on a tie). */
function commonKeep(dice: readonly number[]): boolean[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) counts[d]!++;
  let target = 6;
  for (let v = 6; v >= 1; v--) if (counts[v]! > counts[target]!) target = v;
  return dice.map((d) => d === target);
}

function reroll(dice: readonly number[], keep: readonly boolean[], rng: Rng): number[] {
  return dice.map((d, i) => (keep[i] ? d : rng.int(6) + 1));
}

function createYatzyBot(tier: YatzyTier): Bot<YatzyMove> {
  return {
    chooseMove(generic: GameState<YatzyMove>, seat: Seat, rng: Rng): YatzyMove {
      const state = generic as YatzyState;
      if (state.legalMoves(seat).length === 0) throw new Error('No legal moves');
      if (state.rollsUsed === 0) return YATZY_FIRST_ROLL;
      const card = state.cards[seat]!;
      const now = bestBox(state.dice, card, tier.sharp);
      const score = yatzyScore(YATZY_BOXES[now.index]!);
      if (state.rollsUsed === 3) return score;

      if (tier.samples === 0) {
        const keep = commonKeep(state.dice);
        // A full house, straight or Yatzy already worth its box: take it.
        if (keep.every(Boolean) || now.value >= (tier.sharp ? 8 : 20)) return score;
        return yatzyRoll(keep);
      }

      // Try every different set of dice to keep against simulated rerolls.
      const deep = tier.deep && state.rollsUsed === 1;
      const outcome = (dice: readonly number[]) => {
        const direct = bestBox(dice, card, tier.sharp).value;
        if (!deep) return direct;
        let later = 0;
        const keep = commonKeep(dice);
        for (let k = 0; k < 4; k++) later += bestBox(reroll(dice, keep, rng), card, tier.sharp).value;
        return Math.max(direct, later / 4);
      };
      let bestMove = score;
      let bestValue = now.value;
      const tried = new Set<string>();
      for (let mask = 0; mask < 31; mask++) {
        const keep = [0, 1, 2, 3, 4].map((i) => ((mask >> i) & 1) === 1);
        const kept = keyOf(state.dice.filter((_, i) => keep[i]));
        if (tried.has(kept)) continue;
        tried.add(kept);
        let total = 0;
        for (let s = 0; s < tier.samples; s++) total += outcome(reroll(state.dice, keep, rng));
        const value = total / tier.samples;
        if (value > bestValue) {
          bestValue = value;
          bestMove = yatzyRoll(keep);
        }
      }
      return bestMove;
    },
  };
}

export const yatzy: GameDefinition<YatzyMove> = {
  id: 'yatzy',
  name: 'Yatzy',
  minPlayers: 1,
  maxPlayers: 4,
  modes: ['solo', 'bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: false,
  realtime: false,
  newGame: (config, seed) => newYatzy(config.players, seed),
  createBot: (tier) => createYatzyBot(TIERS[tier]),
  encodeMove: (move) => move,
};
