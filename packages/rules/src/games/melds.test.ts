import { describe, expect, it } from 'vitest';
import { bestArrangement, deadwoodOf, deadwoodValue, fitsMeld, handValue, isMeld, layOff, meldsIn } from './melds';

const card = (rank: number, suit: number) => suit * 13 + rank - 1;
const SPADES = 0;
const HEARTS = 1;
const DIAMONDS = 2;
const CLUBS = 3;

describe('melds', () => {
  it('counts a court card as ten and an ace as one', () => {
    expect(deadwoodValue(card(13, SPADES))).toBe(10);
    expect(deadwoodValue(card(11, HEARTS))).toBe(10);
    expect(deadwoodValue(card(1, CLUBS))).toBe(1);
    expect(deadwoodValue(card(7, DIAMONDS))).toBe(7);
    expect(handValue([card(13, SPADES), card(1, CLUBS), card(4, HEARTS)])).toBe(15);
  });

  it('knows a set from a run, and refuses everything else', () => {
    expect(isMeld([card(5, SPADES), card(5, HEARTS), card(5, CLUBS)])).toBe(true);
    expect(isMeld([card(5, SPADES), card(6, SPADES), card(7, SPADES)])).toBe(true);
    expect(isMeld([card(5, SPADES), card(6, SPADES)])).toBe(false);
    expect(isMeld([card(5, SPADES), card(6, SPADES), card(8, SPADES)])).toBe(false);
    expect(isMeld([card(5, SPADES), card(6, HEARTS), card(7, CLUBS)])).toBe(false);
  });

  it('keeps aces low, so A-2-3 is a run and Q-K-A is not', () => {
    expect(isMeld([card(1, HEARTS), card(2, HEARTS), card(3, HEARTS)])).toBe(true);
    expect(isMeld([card(12, HEARTS), card(13, HEARTS), card(1, HEARTS)])).toBe(false);
  });

  it('finds the arrangement with the least left over', () => {
    // 5♠6♠7♠ is a run and 5♥5♦5♣ is a set, but the 5♠ can only be in one of them.
    const hand = [
      card(5, SPADES), card(6, SPADES), card(7, SPADES),
      card(5, HEARTS), card(5, DIAMONDS), card(5, CLUBS),
      card(13, CLUBS),
    ];
    const best = bestArrangement(hand);
    expect(best.melds).toHaveLength(2);
    expect(best.value).toBe(10);
    expect(best.deadwood).toEqual([card(13, CLUBS)]);
  });

  it('splits a run to feed a set when that leaves less behind', () => {
    // I read this hand as K-Q-J-10 of hearts with two loose kings, worth 22. It is better than
    // that: the king of hearts joins the other two kings and Q-J-10 still stands, leaving the two.
    const hand = [
      card(13, HEARTS), card(12, HEARTS), card(11, HEARTS), card(10, HEARTS),
      card(13, SPADES), card(13, CLUBS), card(2, DIAMONDS),
    ];
    const best = bestArrangement(hand);
    expect(best.melds).toHaveLength(2);
    expect(best.value).toBe(2);
    expect(deadwoodOf(hand)).toBe(2);
  });

  it('offers three of a rank out of four, so the fourth can go in a run', () => {
    const four = [card(9, SPADES), card(9, HEARTS), card(9, DIAMONDS), card(9, CLUBS)];
    const options = meldsIn(four);
    expect(options.some((meld) => meld.length === 4)).toBe(true);
    expect(options.filter((meld) => meld.length === 3)).toHaveLength(4);
  });

  it('lays a loose card onto somebody else"s meld, and then the one after it', () => {
    const melds = [[card(5, SPADES), card(6, SPADES), card(7, SPADES)]];
    // The 8 goes on the end of the run, and then the 9 goes on the end of that.
    const left = layOff([card(8, SPADES), card(9, SPADES), card(2, CLUBS)], melds);
    expect(left).toEqual([card(2, CLUBS)]);
    expect(fitsMeld(melds[0]!, card(8, SPADES))).toBe(true);
    expect(fitsMeld(melds[0]!, card(8, HEARTS))).toBe(false);
  });
});
