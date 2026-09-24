import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { replay } from '../../core/replay';
import { CLEAN_COATS, CLEAN_COLS, CLEAN_ROWS, CLEAN_THINGS, cleanIt, newCleanIt, wipeReach } from './index';

describe('clean it', () => {
  it('starts grubby: blotches up to three coats, never clean', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = newCleanIt(seed);
      expect(s.dirt.length).toBe(CLEAN_COLS * CLEAN_ROWS);
      expect(s.dirt.every((d) => d >= 0 && d <= CLEAN_COATS)).toBe(true);
      expect(s.total).toBeGreaterThan(0);
      expect(s.clean).toBe(0);
    }
  });

  it('a wipe takes one coat off the spot and the four beside it, and not past the edge', () => {
    expect(wipeReach(0).sort((a, b) => a - b)).toEqual([0, 1, CLEAN_COLS]);
    expect(wipeReach(CLEAN_COLS + 1).length).toBe(5);
    const s = newCleanIt(3);
    const move = s.legalMoves(0)[0]!;
    const cell = Number(move.slice(1));
    const next = s.apply(move);
    for (const c of wipeReach(cell)) expect(next.dirt[c]).toBe(Math.max(0, s.dirt[c]! - 1));
    expect(next.wipes).toBe(1);
  });

  it('a wipe over a clean patch is not a move', () => {
    const s = newCleanIt(4);
    const clean = [...Array(s.dirt.length).keys()].find((i) => wipeReach(i).every((c) => s.dirt[c] === 0));
    if (clean !== undefined) expect(() => s.apply(`w${clean}`)).toThrow();
  });

  it('the last speck gone, it is done; the referee replays the cleaning', () => {
    for (const thing of CLEAN_THINGS) {
      let s = cleanIt.newGame({ players: 1, variant: thing }, 5);
      const bot = cleanIt.createBot('easy');
      const rng = createRng(5);
      const moves: string[] = [];
      while (!s.result) {
        const m = bot.chooseMove(s, 0, rng);
        moves.push(m);
        s = s.apply(m);
      }
      expect((s as ReturnType<typeof newCleanIt>).clean).toBe(100);
      expect(replay(cleanIt, { gameId: 'clean-it', seed: 5, config: { players: 1, variant: thing }, moves }).result).toEqual(s.result);
    }
  });
});
