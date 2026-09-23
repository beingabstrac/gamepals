import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { charades, CharadesState, CHARADE_WORDS, newCharades, type CharadesMove } from './index';

const through = (state: CharadesState, moves: CharadesMove[]) => moves.reduce((s, m) => s.apply(m), state);

describe('charades', () => {
  it('each person holds the phone in turn, and only they can move', () => {
    let s = newCharades(1, 3);
    for (let seat = 0; seat < 3; seat++) {
      expect(s.phase).toBe('ready');
      expect(s.currentSeat).toBe(seat);
      for (let other = 0; other < 3; other++) if (other !== seat) expect(s.legalMoves(other)).toEqual([]);
      s = through(s, ['start', 'got', 'end']);
    }
    expect(s.phase).toBe('over');
  });

  it('got scores for the holder, pass does not, and both show the next word', () => {
    const s = newCharades(4, 2).apply('start');
    const first = s.word;
    const got = s.apply('got');
    expect(got.scores).toEqual([1, 0]);
    expect(got.word).not.toBe(first);
    const passed = got.apply('pass');
    expect(passed.scores).toEqual([1, 0]);
    expect(passed.thisGo).toEqual([true, false]);
  });

  it('most words wins; all level is a draw', () => {
    const win = through(newCharades(2, 2), ['start', 'got', 'got', 'end', 'start', 'got', 'end']);
    expect(win.result).toEqual({ winners: [0], draw: false });
    const level = through(newCharades(2, 2), ['start', 'got', 'end', 'start', 'got', 'end']);
    expect(level.result).toEqual({ winners: [], draw: true });
    const shared = through(newCharades(2, 3), ['start', 'got', 'end', 'start', 'end', 'start', 'got', 'end']);
    expect(shared.result).toEqual({ winners: [0, 2], draw: false });
  });

  it('two goes each goes round twice', () => {
    let s = charades.newGame({ players: 3, variant: 'two' }, 5) as CharadesState;
    const holders: number[] = [];
    while (!s.result) {
      if (s.phase === 'ready') holders.push(s.currentSeat);
      s = s.apply(s.phase === 'ready' ? 'start' : 'end');
    }
    expect(holders).toEqual([0, 1, 2, 0, 1, 2]);
  });

  it('no word comes up twice until the deck runs out', () => {
    let s = newCharades(9, 8, 2).apply('start');
    const seen = new Set<string>();
    for (let i = 0; i < CHARADE_WORDS.length; i++) {
      expect(seen.has(s.word), `word ${i}: ${s.word}`).toBe(false);
      seen.add(s.word);
      s = s.apply(i % 2 ? 'pass' : 'got');
    }
  });

  it('refuses words before the start, and the same seed deals the same words', () => {
    expect(() => newCharades(3, 2).apply('got')).toThrow();
    expect(newCharades(3, 4)).toEqual(newCharades(3, 4));
    expect(newCharades(3, 4).word).not.toBe(newCharades(4, 4).word);
  });

  it('test play finishes', () => {
    const bot = charades.createBot('medium');
    let s = newCharades(11, 5) as CharadesState;
    const rng = createRng(1);
    while (!s.result) s = s.apply(bot.chooseMove(s, s.currentSeat, rng)) as CharadesState;
    expect(s.scores).toEqual([4, 4, 4, 4, 4]);
  });
});

/** Invariant: the scores add up to the words got, and never go down. */
describe('charades invariants', () => {
  it('keeps the count', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = createRng(seed);
      let s = newCharades(seed, 2 + (seed % 7));
      let got = 0;
      while (!s.result) {
        const move = rng.pick(s.legalMoves(s.currentSeat).filter((m) => m !== 'end' || rng.next() < 0.2));
        const before = s.scores;
        s = s.apply(move);
        if (move === 'got') got++;
        s.scores.forEach((v, i) => expect(v).toBeGreaterThanOrEqual(before[i]!));
        expect(s.scores.reduce((a, b) => a + b, 0)).toBe(got);
      }
    }
  });
});
