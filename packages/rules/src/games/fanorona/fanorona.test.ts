import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { fanorona, FanoState, isStrong, newFanorona } from './index';

const at = (x: number, y: number) => y * 9 + x;
const pos = (white: [number, number][], black: [number, number][], seat: 0 | 1 = 0) => {
  const board = Array<number>(45).fill(-1);
  for (const [x, y] of white) board[at(x, y)] = 0;
  for (const [x, y] of black) board[at(x, y)] = 1;
  return new FanoState(board, seat, null, 0, null, null);
};
const mv = (a: [number, number], b: [number, number], kind = '') => `m${at(...a)}-${at(...b)}${kind}`;

describe('fanorona', () => {
  it('starts with 22 each and the center empty; the middle is a strong point', () => {
    const s = newFanorona();
    expect(s.board.filter((b) => b === 0)).toHaveLength(22);
    expect(s.board.filter((b) => b === 1)).toHaveLength(22);
    expect(s.board[at(4, 2)]).toBe(-1);
    expect(isStrong(at(4, 2))).toBe(true);
    expect(isStrong(at(1, 2))).toBe(false);
  });

  it('capturing is a must: the opening moves are all captures', () => {
    const s = newFanorona();
    const moves = s.legalMoves(0);
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((m) => m.endsWith('a') || m.endsWith('w'))).toBe(true);
  });

  it('approach takes the whole unbroken line in front', () => {
    const s = pos([[0, 2]], [[2, 2], [3, 2], [4, 2], [6, 2], [8, 0]]).apply(mv([0, 2], [1, 2], 'a'));
    expect(s.board[at(2, 2)]).toBe(-1);
    expect(s.board[at(3, 2)]).toBe(-1);
    expect(s.board[at(4, 2)]).toBe(-1);
    expect(s.board[at(6, 2)]).toBe(1);
  });

  it('withdrawal takes the line behind', () => {
    const s = pos([[3, 2]], [[2, 2], [1, 2], [8, 4]]).apply(mv([3, 2], [4, 2], 'w'));
    expect(s.board[at(2, 2)]).toBe(-1);
    expect(s.board[at(1, 2)]).toBe(-1);
  });

  it('a weak point has no diagonals', () => {
    const s = pos([[1, 2]], [[8, 0]]);
    expect(s.legalMoves(0)).not.toContain(mv([1, 2], [2, 3]));
    const t = pos([[2, 2]], [[8, 0]]);
    expect(t.legalMoves(0)).toContain(mv([2, 2], [3, 3]));
  });

  it('a capture run: the same piece goes on, not the same way twice, not back where it was, and may stop', () => {
    // White at (0,4) approaches (2,4) along the row, then can turn up to take (1,2) by approach.
    const s = pos([[0, 4]], [[2, 4], [1, 2], [8, 0]]).apply(mv([0, 4], [1, 4], 'a'));
    expect(s.chain?.at).toBe(at(1, 4));
    expect(s.currentSeat).toBe(0);
    const moves = s.legalMoves(0);
    expect(moves).toContain('stop');
    expect(moves).toContain(mv([1, 4], [1, 3], 'a'));
    expect(moves.every((m) => m === 'stop' || m.startsWith(`m${at(1, 4)}-`))).toBe(true);
    expect(s.apply('stop').currentSeat).toBe(1);
  });

  it('taking the last piece wins', () => {
    const s = pos([[0, 2]], [[2, 2]]).apply(mv([0, 2], [1, 2], 'a'));
    expect(s.result).toEqual({ winners: [0], draw: false });
  });

  it('bots finish and the tiers come out in order', { timeout: 300_000 }, () => {
    let wins = 0;
    const games = 8;
    for (let seed = 0; seed < games; seed++) {
      const rng = createRng(seed);
      const strong = seed % 2;
      const bots = [fanorona.createBot(strong === 0 ? 'medium' : 'easy'), fanorona.createBot(strong === 0 ? 'easy' : 'medium')];
      let s = newFanorona();
      while (!s.result) s = s.apply(bots[s.currentSeat]!.chooseMove(s, s.currentSeat, rng));
      if (s.result.winners[0] === strong) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(6);
  });
});

/** Invariant: pieces only ever go down, and only by the ones a capture names. */
describe('fanorona invariants', () => {
  it('keeps the count honest', { timeout: 60_000 }, () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = createRng(seed);
      let s = newFanorona();
      while (!s.result) {
        const before = s.board.filter((b) => b !== -1).length;
        const move = rng.pick(s.legalMoves(s.currentSeat));
        const next = s.apply(move);
        const after = next.board.filter((b) => b !== -1).length;
        expect(before - after).toBe(move === 'stop' ? 0 : next.last!.captured.length);
        if (move !== 'stop' && !move.endsWith('a') && !move.endsWith('w')) expect(next.last!.captured).toEqual([]);
        s = next;
      }
    }
  });
});
