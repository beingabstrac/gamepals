import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { DRAW_WORDS, drawGuess, DrawState, newDrawGuess, type DrawMove } from './index';

const through = (state: DrawState, moves: DrawMove[]) => moves.reduce((s, m) => s.apply(m), state);

describe('draw & guess', () => {
  it('everyone draws in turn, and only the drawer moves', () => {
    let s = newDrawGuess(1, 4);
    for (let seat = 0; seat < 4; seat++) {
      expect(s.phase).toBe('ready');
      expect(s.currentSeat).toBe(seat);
      for (let other = 0; other < 4; other++) if (other !== seat) expect(s.legalMoves(other)).toEqual([]);
      s = through(s, ['seen', 'end']);
    }
    expect(s.phase).toBe('over');
  });

  it('a guess scores the guesser and the drawer; time up scores nobody', () => {
    const got = through(newDrawGuess(2, 3), ['seen', 'g2']);
    expect(got.scores).toEqual([1, 0, 1]);
    expect(got.lastGuesser).toBe(2);
    const missed = through(newDrawGuess(2, 3), ['seen', 'end']);
    expect(missed.scores).toEqual([0, 0, 0]);
    expect(missed.lastGuesser).toBeNull();
  });

  it('the drawer cannot guess their own drawing', () => {
    const s = newDrawGuess(3, 3).apply('seen');
    expect(s.legalMoves(0)).toEqual(['g1', 'g2', 'end']);
    expect(() => s.apply('g0')).toThrow();
  });

  it('most points wins; all level is a draw', () => {
    // 0 draws, 1 gets it; 1 draws, 2 gets it; 2 draws, 1 gets it: 1 on 3, 2 on 2, 0 on 1.
    const win = through(newDrawGuess(4, 3), ['seen', 'g1', 'seen', 'g2', 'seen', 'g1']);
    expect(win.scores).toEqual([1, 3, 2]);
    expect(win.result).toEqual({ winners: [1], draw: false });
    const level = through(newDrawGuess(4, 3), ['seen', 'end', 'seen', 'end', 'seen', 'end']);
    expect(level.result).toEqual({ winners: [], draw: true });
  });

  it('two goes each goes round twice, and says what the last word was', () => {
    let s = drawGuess.newGame({ players: 3, variant: 'two' }, 5) as DrawState;
    const drawers: number[] = [];
    let before = s.word;
    while (!s.result) {
      if (s.phase === 'ready') drawers.push(s.currentSeat);
      const next = s.apply(s.phase === 'ready' ? 'seen' : 'end');
      if (next.phase === 'ready') expect(next.lastWord).toBe(before);
      s = next;
      before = s.word;
    }
    expect(drawers).toEqual([0, 1, 2, 0, 1, 2]);
  });

  it('no word twice in a game, and the same seed deals the same words', () => {
    let s = newDrawGuess(9, 8, 2);
    const seen = new Set<string>();
    while (!s.result) {
      if (s.phase === 'ready') {
        expect(seen.has(s.word)).toBe(false);
        seen.add(s.word);
      }
      s = s.apply(s.phase === 'ready' ? 'seen' : 'end');
    }
    expect(seen.size).toBe(16);
    expect(DRAW_WORDS.length).toBeGreaterThanOrEqual(16);
    expect(newDrawGuess(3, 4)).toEqual(newDrawGuess(3, 4));
  });

  it('test play finishes', () => {
    const bot = drawGuess.createBot('medium');
    let s = newDrawGuess(11, 5) as DrawState;
    const rng = createRng(1);
    while (!s.result) s = s.apply(bot.chooseMove(s, s.currentSeat, rng)) as DrawState;
    expect(s.phase).toBe('over');
  });
});

/** Invariant: every drawing adds nought or two points, and the drawer never guesses. */
describe('draw & guess invariants', () => {
  it('keeps the count', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = createRng(seed);
      let s = newDrawGuess(seed, 3 + (seed % 6), 1 + (seed % 2));
      while (!s.result) {
        const drawer = s.currentSeat;
        const move = rng.pick(s.legalMoves(drawer));
        expect(move).not.toBe(`g${drawer}`);
        const before = s.scores.reduce((a, b) => a + b, 0);
        s = s.apply(move);
        const after = s.scores.reduce((a, b) => a + b, 0);
        expect([0, 2]).toContain(after - before);
      }
    }
  });
});
