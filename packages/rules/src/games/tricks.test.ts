import { describe, expect, it } from 'vitest';
import type { Seat } from '../core/types';
import { follows, ledSuit, trickRank, trickWinner, voidsFrom, type Played } from './tricks';

const card = (rank: number, suit: number) => suit * 13 + rank - 1;
const play = (seat: number, c: number): Played => ({ seat: seat as Seat, card: c });

describe('trick taking', () => {
  it('counts an ace above a king', () => {
    expect(trickRank(card(1, 0))).toBe(14);
    expect(trickRank(card(13, 0))).toBe(13);
  });

  it('makes everybody follow the suit that was led, while they can', () => {
    const hand = [card(4, 0), card(9, 1)];
    const trick = [play(0, card(7, 0))];
    expect(ledSuit(trick)).toBe(0);
    expect(follows(hand, trick, card(4, 0))).toBe(true);
    expect(follows(hand, trick, card(9, 1))).toBe(false);
    // With none of the suit led, anything goes.
    expect(follows([card(9, 1)], trick, card(9, 1))).toBe(true);
    // Nothing is led yet, so anything leads.
    expect(follows(hand, [], card(9, 1))).toBe(true);
  });

  it('gives the trick to the highest card of the suit led', () => {
    const trick = [play(0, card(7, 0)), play(1, card(13, 0)), play(2, card(2, 0)), play(3, card(9, 1))];
    expect(trickWinner(trick)).toBe(1);
  });

  it('gives it to the highest trump when there is one', () => {
    const trick = [play(0, card(13, 0)), play(1, card(2, 2)), play(2, card(3, 2)), play(3, card(1, 0))];
    // Diamonds are trump, so the three of diamonds beats the ace of spades.
    expect(trickWinner(trick, 2)).toBe(2);
    // Without a trump suit the ace takes it.
    expect(trickWinner(trick, -1)).toBe(3);
  });

  it('remembers who has shown they are out of a suit', () => {
    const tricks = [
      [play(0, card(7, 0)), play(1, card(2, 1)), play(2, card(9, 0)), play(3, card(4, 0))],
      [play(2, card(5, 2)), play(3, card(6, 2)), play(0, card(8, 3)), play(1, card(9, 2))],
    ];
    const voids = voidsFrom(tricks);
    expect([...(voids.get(1 as Seat) ?? [])]).toEqual([0]);
    expect([...(voids.get(0 as Seat) ?? [])]).toEqual([2]);
    expect(voids.get(3 as Seat)).toBeUndefined();
  });
});
