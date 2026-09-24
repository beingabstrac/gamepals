import { describe, expect, it } from 'vitest';
import { moveFor } from '../../core/moves';
import { createRng } from '../../core/rng';
import { codeBreaker, CODE_LEVELS, CodeState, mark, newCodeBreaker, possibleCodes } from './index';

describe('code breaker', () => {
  it('marks right place first, then right color in the wrong place, never counting a peg twice', () => {
    expect(mark([0, 1, 2, 3], [0, 1, 2, 3])).toEqual({ exact: 4, near: 0 });
    expect(mark([0, 1, 2, 3], [3, 2, 1, 0])).toEqual({ exact: 0, near: 4 });
    expect(mark([0, 0, 1, 1], [0, 1, 0, 2])).toEqual({ exact: 1, near: 2 });
    expect(mark([1, 1, 1, 1], [1, 2, 2, 2])).toEqual({ exact: 1, near: 0 });
    expect(mark([1, 2, 3, 4], [1, 1, 1, 1])).toEqual({ exact: 1, near: 0 });
  });

  it('the code fits its level: easy has no repeats', () => {
    for (let seed = 0; seed < 30; seed++) {
      const easy = newCodeBreaker(seed, 'easy');
      expect(new Set(easy.code).size).toBe(4);
      expect(newCodeBreaker(seed, 'hard').code).toHaveLength(5);
      expect(newCodeBreaker(seed, 'hard').code.every((c) => c < 8)).toBe(true);
    }
  });

  it('cracking it wins; running out of rows loses and shows nothing more', () => {
    const s = newCodeBreaker(3, 'classic');
    const win = s.apply(`g${s.code.join('')}`);
    expect(win.result).toEqual({ winners: [0], draw: false });
    let t: CodeState = newCodeBreaker(3, 'classic');
    const wrong = `g${t.code.map((c) => (c + 1) % 6).join('')}`;
    for (let i = 0; i < CODE_LEVELS.classic!.rows; i++) t = t.apply(wrong);
    expect(t.result).toEqual({ winners: [], draw: false });
    expect(() => t.apply(wrong)).toThrow();
  });

  it('any row of the right shape is allowed, even one the clues rule out, and nothing else is', () => {
    const s = newCodeBreaker(1, 'classic');
    expect(s.allows('g0000')).toBe(true);
    expect(s.allows('g0006')).toBe(false);
    expect(s.allows('g000')).toBe(false);
    expect(moveFor(codeBreaker, s, 'g5555')).toBe('g5555');
    expect(moveFor(codeBreaker, s, 'x')).toBeUndefined();
  });

  it('the code is always among the codes the clues allow', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = createRng(seed);
      let s = newCodeBreaker(seed, seed % 2 ? 'easy' : 'classic');
      while (!s.result) {
        expect(possibleCodes(s.level, s.rows).some((c) => c.join() === s.code.join())).toBe(true);
        s = s.apply(`g${Array.from({ length: 4 }, () => rng.int(6)).join('')}`);
      }
    }
  });

  it('test play cracks it well inside the rows', { timeout: 60_000 }, () => {
    let total = 0;
    for (let seed = 0; seed < 20; seed++) {
      const rng = createRng(seed);
      const bot = codeBreaker.createBot('medium');
      let s = newCodeBreaker(seed, 'classic');
      while (!s.result) s = s.apply(bot.chooseMove(s, 0, rng)) as CodeState;
      expect(s.result.winners).toEqual([0]);
      total += s.rows.length;
    }
    expect(total / 20).toBeLessThan(7);
  });

  it('the same seed hides the same code', () => {
    expect(codeBreaker.newGame({ players: 1, variant: 'hard' }, 8)).toEqual(newCodeBreaker(8, 'hard'));
  });
});
