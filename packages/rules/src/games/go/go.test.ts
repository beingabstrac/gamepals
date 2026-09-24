import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { areaScore, chooseGoMove, GO_KOMI, GO_POINTS, GO_TIERS, GoState, newGo, playStone } from './index';

const at = (x: number, y: number) => y * 9 + x;
const through = (state: GoState, moves: string[]) => moves.reduce((s, m) => s.apply(m), state);
const p = (x: number, y: number) => `p${at(x, y)}`;

describe('go 9x9', () => {
  it('a stone with no liberties is taken', () => {
    // White at the corner, surrounded by Black on both sides.
    const s = through(newGo(), [p(1, 0), p(0, 0), p(0, 1)]);
    expect(s.board[at(0, 0)]).toBe(0);
    expect(s.captures[0]).toBe(1);
    expect(s.last?.captured).toEqual([at(0, 0)]);
  });

  it('you cannot take your own last liberty, unless it captures', () => {
    const s = through(newGo(), [p(1, 0), 'pass', p(0, 1), 'pass']);
    // White into the corner between two black stones is suicide.
    expect(s.apply('pass').legalMoves(1)).not.toContain(p(0, 0));
    expect(playStone(s.board, at(0, 0), 2)).toBeNull();
  });

  it('ko: the stone just taken cannot be retaken at once', () => {
    // A classic ko on the top edge.
    const moves = [p(1, 0), p(2, 0), p(0, 1), p(3, 1), p(1, 2), p(2, 2), 'pass', p(1, 1)];
    let s = through(newGo(), moves);
    // White at (1,1) is in atari; Black takes it at (2,1).
    s = s.apply(p(2, 1));
    expect(s.board[at(1, 1)]).toBe(0);
    // White may not take straight back at (1,1).
    expect(s.legalMoves(1)).not.toContain(p(1, 1));
  });

  it('two passes end it, scored by area with 7 for White', () => {
    const s = through(newGo(), ['pass', 'pass']);
    expect(s.result).toEqual({ winners: [1], draw: false });
    expect(s.score).toEqual([0, GO_KOMI]);
    const board = Array<number>(GO_POINTS).fill(0);
    for (let y = 0; y < 9; y++) board[at(4, y)] = 1;
    const [b, w] = areaScore(board);
    expect(b).toBe(81);
    expect(w).toBe(0);
  });

  it('a pass then a move carries on', () => {
    const s = through(newGo(), ['pass', p(4, 4)]);
    expect(s.result).toBeNull();
    expect(s.passes).toBe(0);
  });

  it('refuses a stone on a stone', () => {
    expect(() => through(newGo(), [p(4, 4), p(4, 4)])).toThrow();
  });

  it('bots play legal moves and the game ends', { timeout: 120_000 }, () => {
    const rng = createRng(3);
    let s = newGo();
    while (!s.result) {
      const move = chooseGoMove(s, GO_TIERS.easy, rng);
      expect(s.legalMoves(s.currentSeat)).toContain(move);
      s = s.apply(move);
    }
    expect(s.result).not.toBeNull();
  });

  it('more playouts win more', { timeout: 300_000 }, () => {
    let wins = 0;
    const games = 4;
    for (let seed = 0; seed < games; seed++) {
      const rng = createRng(seed);
      const strong = seed % 2;
      let s = newGo();
      while (!s.result) s = s.apply(chooseGoMove(s, s.currentSeat === strong ? GO_TIERS.medium : GO_TIERS.easy, rng));
      if (s.result.winners[0] === strong) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(3);
  });
});

/** Invariant: no group on the board ever sits with no liberties, and no position comes round twice. */
describe('go invariants', () => {
  it('keeps every group breathing and every position new', { timeout: 60_000 }, () => {
    for (let seed = 0; seed < 12; seed++) {
      const rng = createRng(seed);
      let s = newGo();
      const positions = new Set<string>([s.board.join('')]);
      while (!s.result) {
        // Mostly stones, now and then a pass, so games reach both endings.
        const stones = s.legalMoves(s.currentSeat).filter((m) => m !== 'pass');
        const move = stones.length && rng.next() > 0.05 ? rng.pick(stones) : 'pass';
        s = s.apply(move);
        if (move !== 'pass') {
          const key = s.board.join('');
          expect(positions.has(key), `seed ${seed}: a position came back`).toBe(false);
          positions.add(key);
        }
        for (let q = 0; q < GO_POINTS; q++) {
          if (!s.board[q]) continue;
          // Every stone is in a group that touches at least one empty point.
          const stack = [q];
          const seen = new Set([q]);
          let free = false;
          while (stack.length && !free) {
            const r = stack.pop()!;
            const x = r % 9;
            const y = Math.floor(r / 9);
            for (const n of [x > 0 ? r - 1 : -1, x < 8 ? r + 1 : -1, y > 0 ? r - 9 : -1, y < 8 ? r + 9 : -1]) {
              if (n < 0) continue;
              if (s.board[n] === 0) free = true;
              else if (s.board[n] === s.board[q] && !seen.has(n)) {
                seen.add(n);
                stack.push(n);
              }
            }
          }
          expect(free, `seed ${seed}: a group with no liberties at ${q}`).toBe(true);
        }
      }
    }
  });
});
