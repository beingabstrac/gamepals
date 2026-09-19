import { rankOf, suitOf } from './cards';

/**
 * The bones of a melding game, shared by the games that play them (docs/games/gin-rummy.md).
 * A meld is a set (three or four of a rank) or a run (three or more in sequence in one suit).
 * Aces are low here, so A-2-3 is a run and Q-K-A is not. Nothing in this file knows about
 * knocking, scoring or turns, so Gin Rummy and Rummy can both sit on it.
 */

export type Meld = readonly number[];

/** What a loose card costs: ten for a court card, one for an ace, its number otherwise. */
export const deadwoodValue = (card: number): number => Math.min(10, rankOf(card));

export const handValue = (cards: readonly number[]): number =>
  cards.reduce((sum, card) => sum + deadwoodValue(card), 0);

const byRankThenSuit = (a: number, b: number): number => rankOf(a) - rankOf(b) || suitOf(a) - suitOf(b);

/** Is this a legal meld on its own? */
export function isMeld(cards: readonly number[]): boolean {
  if (cards.length < 3) return false;
  const unique = new Set(cards);
  if (unique.size !== cards.length) return false;
  const ranks = cards.map(rankOf);
  const suits = cards.map(suitOf);
  if (ranks.every((rank) => rank === ranks[0])) return cards.length <= 4 && new Set(suits).size === cards.length;
  if (!suits.every((suit) => suit === suits[0])) return false;
  const order = [...ranks].sort((a, b) => a - b);
  return order.every((rank, i) => i === 0 || rank === order[i - 1]! + 1);
}

/** Every meld that can be made from these cards, sets first, then runs of every length. */
export function meldsIn(hand: readonly number[]): Meld[] {
  const found: Meld[] = [];
  for (let rank = 1; rank <= 13; rank++) {
    const same = hand.filter((card) => rankOf(card) === rank).sort((a, b) => a - b);
    if (same.length >= 3) {
      found.push(same);
      // Four of a rank also plays as any three of them, which can leave the fourth for a run.
      if (same.length === 4) for (const left of same) found.push(same.filter((card) => card !== left));
    }
  }
  for (let suit = 0; suit < 4; suit++) {
    const ordered = hand.filter((card) => suitOf(card) === suit).sort((a, b) => rankOf(a) - rankOf(b));
    for (let from = 0; from < ordered.length; from++) {
      const run = [ordered[from]!];
      for (let next = from + 1; next < ordered.length; next++) {
        if (rankOf(ordered[next]!) !== rankOf(run[run.length - 1]!) + 1) break;
        run.push(ordered[next]!);
        if (run.length >= 3) found.push([...run]);
      }
    }
  }
  return found;
}

export interface Arrangement {
  readonly melds: readonly Meld[];
  readonly deadwood: readonly number[];
  readonly value: number;
}

/**
 * The arrangement of a hand with the least left over. Ten or eleven cards make few enough melds
 * that trying every combination is quick, and it has to be exact: a knock is legal or not on this
 * number, so an arrangement that is nearly best is a wrong answer.
 */
export function bestArrangement(hand: readonly number[]): Arrangement {
  const options = meldsIn(hand);
  let best: Arrangement = { melds: [], deadwood: [...hand].sort(byRankThenSuit), value: handValue(hand) };

  const walk = (from: number, left: readonly number[], taken: readonly Meld[]): void => {
    const value = handValue(left);
    if (value < best.value) best = { melds: taken, deadwood: [...left].sort(byRankThenSuit), value };
    if (best.value === 0) return;
    for (let i = from; i < options.length; i++) {
      const meld = options[i]!;
      if (!meld.every((card) => left.includes(card))) continue;
      walk(i + 1, left.filter((card) => !meld.includes(card)), [...taken, meld]);
      if (best.value === 0) return;
    }
  };
  walk(0, hand, []);
  return best;
}

/** What is left over in this hand once it is arranged as well as it can be. */
export const deadwoodOf = (hand: readonly number[]): number => bestArrangement(hand).value;

/** Can this card be added to this meld and leave it a legal meld? */
export const fitsMeld = (meld: Meld, card: number): boolean => isMeld([...meld, card]);

/**
 * Laying off: the lowest this hand's loose cards can go against somebody else's melds. Each card
 * that fits is added to the meld it fits, which can then take the next card along in a run.
 */
export function layOff(deadwood: readonly number[], melds: readonly Meld[]): number[] {
  const piles = melds.map((meld) => [...meld]);
  const left = [...deadwood];
  let moved = true;
  while (moved) {
    moved = false;
    for (let i = 0; i < left.length; i++) {
      const card = left[i]!;
      const pile = piles.find((meld) => fitsMeld(meld, card));
      if (!pile) continue;
      pile.push(card);
      left.splice(i, 1);
      moved = true;
      break;
    }
  }
  return left;
}
