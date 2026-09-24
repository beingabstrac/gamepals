import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { newRather, RATHER, RATHER_ROUNDS, RatherState, wouldYouRather, type RatherMove } from './index';

const through = (s: RatherState, moves: RatherMove[]) => moves.reduce((x, m) => x.apply(m), s);

describe('would you rather', () => {
  it('the phone goes round, then the split is shown', () => {
    let s = newRather(1, 3);
    for (let seat = 0; seat < 3; seat++) {
      expect(s.phase).toBe('pick');
      expect(s.currentSeat).toBe(seat);
      s = s.apply('a');
    }
    expect(s.phase).toBe('reveal');
    expect(s.apply('seen').round).toBe(1);
  });

  it('siding with most of the table scores; a tie scores nobody', () => {
    const s = through(newRather(1, 3), ['a', 'a', 'b']);
    expect(s.scores).toEqual([1, 1, 0]);
    const tie = through(newRather(1, 2), ['a', 'b']);
    expect(tie.scores).toEqual([0, 0]);
  });

  it('ten questions, none twice, then whoever sided with the table most wins', () => {
    let s = newRather(2, 3);
    expect(new Set(s.deck).size).toBe(RATHER_ROUNDS);
    for (let r = 0; r < RATHER_ROUNDS; r++) s = through(s, ['a', 'a', 'b', 'seen']);
    expect(s.result).toEqual({ winners: [0, 1], draw: false });
  });

  it('all level is a draw', () => {
    let s = newRather(2, 2);
    for (let r = 0; r < RATHER_ROUNDS; r++) s = through(s, ['a', 'a', 'seen']);
    expect(s.result).toEqual({ winners: [], draw: true });
  });

  it('every question is two different things, none repeated, and the same seed asks the same', () => {
    expect(new Set(RATHER.map(([a, b]) => `${a}|${b}`)).size).toBe(RATHER.length);
    for (const [a, b] of RATHER) expect(a).not.toBe(b);
    expect(newRather(7, 4)).toEqual(newRather(7, 4));
  });

  it('test play finishes', () => {
    const bot = wouldYouRather.createBot('medium');
    let s = newRather(3, 4) as RatherState;
    const rng = createRng(1);
    while (!s.result) s = s.apply(bot.chooseMove(s, s.currentSeat, rng)) as RatherState;
    expect(s.result).not.toBeNull();
  });
});

/** Invariant: a round's score goes to at most the players who picked the same, and only once. */
describe('would you rather invariants', () => {
  it('scores at most one a round each', () => {
    for (let seed = 0; seed < 10; seed++) {
      const rng = createRng(seed);
      let s = newRather(seed, 2 + (seed % 6));
      while (!s.result) {
        const before = s.scores;
        s = s.apply(rng.pick(s.legalMoves(s.currentSeat)));
        s.scores.forEach((v, i) => expect(v - before[i]!).toBeLessThanOrEqual(1));
      }
    }
  });
});
