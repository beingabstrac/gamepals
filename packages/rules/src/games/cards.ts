import type { Rng } from '../core/rng';

/**
 * One pack of cards, shared by every card game. A card is 0–51: suit = card / 13
 * (0 spades, 1 hearts, 2 diamonds, 3 clubs) and rank = card % 13 + 1 (1 = Ace, 13 = King).
 */
export const SUIT_SYMBOLS = ['♠', '♥', '♦', '♣'] as const;
export const RANK_LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export const suitOf = (card: number): number => Math.floor(card / 13) % 4;
export const rankOf = (card: number): number => (card % 13) + 1;
export const isRed = (card: number): boolean => suitOf(card) === 1 || suitOf(card) === 2;
export const cardLabel = (card: number): string => `${RANK_LABELS[rankOf(card) - 1]}${SUIT_SYMBOLS[suitOf(card)]}`;

/** `packs` packs shuffled with the given stream; cards from a second pack repeat 0–51. */
export function shuffledDeck(rng: Rng, packs = 1): number[] {
  const deck = Array.from({ length: 52 * packs }, (_, i) => i % 52);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return deck;
}
