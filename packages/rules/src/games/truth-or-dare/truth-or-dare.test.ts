import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { DARES, newTruthOrDare, TOD_GOES, TodState, truthOrDare, TRUTHS, type TodMove } from './index';

const through = (s: TodState, moves: TodMove[]) => moves.reduce((x, m) => x.apply(m), s);

describe('truth or dare', () => {
  it('pick truth or dare, get a card, do it or pass, and the phone goes on', () => {
    let s = newTruthOrDare(1, 3);
    expect(s.legalMoves(0)).toEqual(['truth', 'dare']);
    s = s.apply('truth');
    expect(TRUTHS).toContain(s.text);
    s = s.apply('done');
    expect(s.scores).toEqual([1, 0, 0]);
    expect(s.currentSeat).toBe(1);
    s = through(s, ['dare', 'pass']);
    expect(s.scores).toEqual([1, 0, 0]);
  });

  it('no card comes up twice in a game', () => {
    let s = newTruthOrDare(3, 8);
    const seen = new Set<string>();
    while (!s.result) {
      s = s.apply(s.go % 2 ? 'dare' : 'truth');
      expect(seen.has(s.text!)).toBe(false);
      seen.add(s.text!);
      s = s.apply('done');
    }
  });

  it('three goes each, then the most done wins; all level is a draw', () => {
    let s = newTruthOrDare(2, 2);
    for (let g = 0; g < 2 * TOD_GOES; g++) s = through(s, ['truth', g === 1 ? 'pass' : 'done']);
    expect(s.result).toEqual({ winners: [0], draw: false });
    let t = newTruthOrDare(2, 2);
    for (let g = 0; g < 2 * TOD_GOES; g++) t = through(t, ['dare', 'done']);
    expect(t.result).toEqual({ winners: [], draw: true });
  });

  it('every card is its own, and there are plenty of both', () => {
    expect(new Set(TRUTHS).size).toBe(TRUTHS.length);
    expect(new Set(DARES).size).toBe(DARES.length);
    expect(TRUTHS.length).toBeGreaterThanOrEqual(24);
    expect(DARES.length).toBeGreaterThanOrEqual(24);
  });

  it('test play finishes, and the same seed deals the same cards', () => {
    const bot = truthOrDare.createBot('medium');
    let s = newTruthOrDare(4, 4) as TodState;
    const rng = createRng(1);
    while (!s.result) s = s.apply(bot.chooseMove(s, s.currentSeat, rng)) as TodState;
    expect(through(newTruthOrDare(9, 2), ['dare']).text).toBe(through(newTruthOrDare(9, 2), ['dare']).text);
  });
});

/** Invariant: only a done ever scores, and only for the player whose go it is. */
describe('truth or dare invariants', () => {
  it('scores honestly', () => {
    for (let seed = 0; seed < 10; seed++) {
      const rng = createRng(seed);
      let s = newTruthOrDare(seed, 2 + (seed % 7));
      while (!s.result) {
        const seat = s.currentSeat;
        const before = s.scores;
        const move = rng.pick(s.legalMoves(seat));
        s = s.apply(move);
        s.scores.forEach((v, i) => expect(v - before[i]!).toBe(move === 'done' && i === seat ? 1 : 0));
      }
    }
  });
});
