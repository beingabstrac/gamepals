import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { chooseHexMove, HEX_CELLS, HEX_TIERS, hexPath, HexState, newHex } from './index';

const at = (x: number, y: number) => y * 11 + x;
const through = (state: HexState, moves: string[]) => moves.reduce((s, m) => s.apply(m), state);

describe('hex', () => {
  it('red joins top to bottom and wins', () => {
    const moves: string[] = [];
    for (let y = 0; y < 11; y++) {
      moves.push(`p${at(3, y)}`);
      if (y < 10) moves.push(`p${at(8, y)}`);
    }
    const s = through(newHex(), moves);
    expect(s.result).toEqual({ winners: [0], draw: false });
    expect(s.path).toHaveLength(11);
  });

  it('a chain can bend along the hex neighbors', () => {
    const board = Array<number>(HEX_CELLS).fill(0);
    // Down and to the left each row: (x, y) and (x - 1, y + 1) touch on a hex board.
    for (let y = 0; y < 11; y++) board[at(10 - y, y)] = 1;
    expect(hexPath(board, 1)).not.toBeNull();
    // But (x, y) and (x + 1, y + 1) do not.
    const apart = Array<number>(HEX_CELLS).fill(0);
    for (let y = 0; y < 11; y++) apart[at(y, y)] = 1;
    expect(hexPath(apart, 1)).toBeNull();
  });

  it('blue may swap only straight after the first stone, and it reflects', () => {
    const s = newHex().apply(`p${at(2, 7)}`);
    expect(s.legalMoves(1)).toContain('swap');
    const swapped = s.apply('swap');
    expect(swapped.board[at(2, 7)]).toBe(0);
    expect(swapped.board[at(7, 2)]).toBe(2);
    expect(swapped.currentSeat).toBe(0);
    expect(swapped.legalMoves(0)).not.toContain('swap');
    expect(newHex().apply(`p0`).apply(`p1`).legalMoves(0)).not.toContain('swap');
  });

  it('a full board always has exactly one winner', () => {
    const rng = createRng(4);
    for (let n = 0; n < 200; n++) {
      const board = Array.from({ length: HEX_CELLS }, () => 1 + rng.int(2));
      const red = hexPath(board, 1) !== null;
      const blue = hexPath(board, 2) !== null;
      expect(red !== blue).toBe(true);
    }
  });

  it('a bot takes a win and blocks one', () => {
    const rng = createRng(1);
    const moves: string[] = [];
    for (let y = 0; y < 10; y++) {
      moves.push(`p${at(3, y)}`);
      moves.push(`p${at(8, y)}`);
    }
    const s = through(newHex(), moves);
    // Either cell under (3, 9) finishes it: (3, 10) or, on a hex board, (2, 10).
    expect(s.apply(chooseHexMove(s, HEX_TIERS.medium, rng)).result).toEqual({ winners: [0], draw: false });
    // And Blue, to move with Red one away down the left edge, where only (0, 10) finishes, blocks it.
    const edge: string[] = [];
    for (let y = 0; y < 10; y++) {
      edge.push(`p${at(0, y)}`);
      if (y < 9) edge.push(`p${at(10, y)}`);
    }
    const block = through(newHex(), edge);
    expect(block.currentSeat).toBe(1);
    expect(chooseHexMove(block, HEX_TIERS.medium, rng)).toBe(`p${at(0, 10)}`);
  });

  it('more playouts win more', { timeout: 60_000 }, () => {
    let wins = 0;
    const games = 6;
    for (let seed = 0; seed < games; seed++) {
      const rng = createRng(seed);
      const strong = seed % 2;
      let s = newHex();
      while (!s.result) s = s.apply(chooseHexMove(s, s.currentSeat === strong ? HEX_TIERS.medium : HEX_TIERS.easy, rng));
      if (s.result.winners[0] === strong) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(5);
  });
});

/** Invariant: stones never move, the game ends the moment a path is made, and never before. */
describe('hex invariants', () => {
  it('ends exactly when someone joins their edges', { timeout: 60_000 }, () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = createRng(seed);
      let s = newHex();
      while (!s.result) {
        expect(hexPath(s.board, 1)).toBeNull();
        expect(hexPath(s.board, 2)).toBeNull();
        s = s.apply(rng.pick(s.legalMoves(s.currentSeat)));
      }
      expect(hexPath(s.board, s.result.winners[0]! + 1)).not.toBeNull();
    }
  });
});
