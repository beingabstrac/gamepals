import { describe, expect, it } from 'vitest';
import { rankOf } from '../cards';
import { cardsLeft, newSpeed, speedNext, playsFor, SPEED_HAND, SPEED_TIERS, speedBotInput, speedView, stepSpeed, type SpeedInput, type SpeedState, type SpeedTier } from './index';

const none: SpeedInput = { play: null };
const playing = (seed = 1) => {
  let s = newSpeed(seed);
  while (s.phase === 'countdown') s = stepSpeed(s, [none, none]).state;
  return s;
};
const all = (s: SpeedState) => [...s.hands[0], ...s.hands[1], ...s.draws[0], ...s.draws[1], ...s.piles[0], ...s.piles[1], ...s.sides[0], ...s.sides[1]].filter((c) => c !== null);
/** Runs two bots; the scene's job of counting how long each has waited is done here. */
function race(seed: number, a: SpeedTier, b: SpeedTier, limit = 400) {
  let s = newSpeed(seed);
  const waited = [0, 0];
  const seen = ['', ''];
  let n = 0;
  for (; n < 120 * limit && !s.result; n++) {
    for (const seat of [0, 1] as const) {
      const v = speedView(s, seat);
      if (v !== seen[seat]) (seen[seat] = v), (waited[seat] = 0);
      else waited[seat]! += 1 / 120;
    }
    const roll = (seat: number) => ((Math.imul(n + seat * 7919 + seed, 0x9e3779b1) >>> 0) % 1000) / 1000;
    s = stepSpeed(s, [speedBotInput(s, 0, a, waited[0]!, roll(0)), speedBotInput(s, 1, b, waited[1]!, roll(1))]).state;
  }
  return { s, seconds: n / 120 };
}

describe('speed', () => {
  it('deals five in hand and fifteen to draw each, two side stacks of five and one on each pile', () => {
    const s = newSpeed(3);
    expect(s.hands[0].length).toBe(SPEED_HAND);
    expect(s.draws[1].length).toBe(15);
    expect(s.sides[0].length).toBe(5);
    expect(s.piles[0].length).toBe(1);
    expect(new Set(all(s)).size).toBe(52);
  });

  it('a card goes on a pile one above or below, and a king sits next to an ace', () => {
    // Cards are numbered 0-51 by suit: 0 is an ace, 1 a two, 12 a king.
    expect(speedNext(0, 1)).toBe(true);
    expect(speedNext(0, 12)).toBe(true);
    expect(speedNext(4, 4 + 13)).toBe(false);
    expect(speedNext(5, 7)).toBe(false);
    expect(rankOf(12)).toBe(13);
  });

  it('a play that fits lands on the pile and the hand fills up from the draw pile', () => {
    const s = playing(1);
    const play = playsFor(s, 0)[0];
    if (!play) return;
    const card = s.hands[0][play.slot]!;
    const next = stepSpeed(s, [{ play }, none]);
    expect(next.events.played[0]?.card).toBe(card);
    expect(next.state.piles[play.pile].at(-1)).toBe(card);
    expect(next.state.hands[0][play.slot]).toBe(s.draws[0][0]);
    expect(next.state.draws[0].length).toBe(14);
  });

  it('a card that does not fit is a miss and nothing changes', () => {
    const s = playing(2);
    const bad = s.hands[0].findIndex((c) => c !== null && !speedNext(c, s.piles[0].at(-1)!));
    if (bad < 0) return;
    const next = stepSpeed(s, [{ play: { slot: bad, pile: 0 } }, none]);
    expect(next.events.missed).toEqual([0]);
    expect(next.state.piles[0]).toEqual(s.piles[0]);
  });

  it('when nobody can play, the side stacks turn over after a moment', () => {
    let s = playing(4);
    // Leave both hands with nothing that fits by hand: wait until stuck, if it happens in the deal.
    const piles: [number[], number[]] = [[0], [26]];
    const hands: [(number | null)[], (number | null)[]] = [[5, 6, 7, 18, 19], [31, 32, 33, 44, 45]];
    s = { ...s, piles, hands };
    expect(playsFor(s, 0).length + playsFor(s, 1).length).toBe(0);
    let flipped = false;
    for (let i = 0; i < 200 && !flipped; i++) {
      const out = stepSpeed(s, [none, none]);
      flipped = out.events.flipped;
      s = out.state;
    }
    expect(flipped).toBe(true);
    expect(s.piles[0].length).toBe(2);
    expect(s.sides[0].length).toBe(4);
  });

  it('first with no cards left wins', () => {
    const s = playing(5);
    const card = s.hands[0].find((c) => c !== null)!;
    // A pile topped by the card one rank above (or below, for a king).
    const pileTop = card % 13 === 12 ? card - 1 : card + 1;
    const last: SpeedState = { ...s, hands: [[card, null, null, null, null], s.hands[1]], draws: [[], s.draws[1]], piles: [[pileTop], s.piles[1]] };
    const out = stepSpeed(last, [{ play: { slot: 0, pile: 0 } }, none]).state;
    expect(cardsLeft(out, 0)).toBe(0);
    expect(out.result).toEqual({ winners: [0], draw: false });
  });

  it('the quicker bot wins, and every race ends', { timeout: 60_000 }, () => {
    let wins = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const { s } = race(seed, SPEED_TIERS.expert, SPEED_TIERS.easy);
      expect(s.result).not.toBeNull();
      if (s.result?.winners[0] === 0) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(5);
  });

  it('invariant, every step of bot play: all 52 cards are somewhere, once each', { timeout: 30_000 }, () => {
    let s = newSpeed(8);
    const waited = [0, 0];
    for (let n = 0; n < 120 * 200 && !s.result; n++) {
      s = stepSpeed(s, [speedBotInput(s, 0, SPEED_TIERS.hard, waited[0]!, 0.5), speedBotInput(s, 1, SPEED_TIERS.medium, waited[1]!, 0.3)]).state;
      waited[0]! += 1 / 120;
      waited[1]! += 1 / 120;
      const cards = all(s);
      expect(cards.length).toBe(52);
      expect(new Set(cards).size).toBe(52);
    }
  });
});
