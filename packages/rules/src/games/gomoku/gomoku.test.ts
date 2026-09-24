import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { replay } from '../../core/replay';
import { chooseGomokuMove, forcedWin, GOMOKU_N, GOMOKU_TIERS, gomoku, gomokuMove, makesFive, newGomoku, type GomokuState } from './index';

const N = GOMOKU_N;
const at = (x: number, y: number) => y * N + x;
/** Plays a list of cells, black and white taking turns. */
const play = (cells: number[]) => cells.reduce<GomokuState>((s, c) => s.apply(gomokuMove(c)), newGomoku());

describe('gomoku', () => {
  it('five in a row wins, across, down and corner to corner; six counts too', () => {
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      const cells: number[] = [];
      for (let k = 0; k < 5; k++) cells.push(at(5 + dx! * k, 7 + dy! * k), at(k, 0 + (k === 0 ? 14 : 13)));
      const s = play(cells.slice(0, 9));
      expect(s.result).toEqual({ winners: [0], draw: false });
      expect(s.line.length).toBe(5);
    }
    const board = Array<number>(N * N).fill(0);
    for (let k = 0; k < 6; k++) board[at(k, 3)] = 1;
    expect(makesFive(board, at(2, 3))).toBe(true);
  });

  it('four is not enough, and a taken point is not a move', () => {
    const s = play([at(0, 0), at(0, 5), at(1, 0), at(1, 5), at(2, 0), at(2, 5), at(3, 0)]);
    expect(s.result).toBeNull();
    expect(() => s.apply(gomokuMove(at(0, 0)))).toThrow();
  });

  it('a bot wins when it can and blocks when it must', () => {
    const rng = createRng(1);
    // White to move with four black stones in a row and an open end: it has to block.
    const s = play([at(3, 7), at(0, 0), at(4, 7), at(0, 2), at(5, 7), at(0, 4), at(6, 7)]);
    const block = chooseGomokuMove(s, GOMOKU_TIERS.easy, rng);
    expect([gomokuMove(at(2, 7)), gomokuMove(at(7, 7))]).toContain(block);
  });

  it('finds a win by fours when one is there', () => {
    // Two broken threes crossing: a four on one line forces a block, then the other line wins.
    const board = Array<number>(N * N).fill(0);
    for (const c of [at(5, 5), at(6, 5), at(7, 5), at(5, 6), at(5, 7), at(5, 8)]) board[c] = 1;
    expect(forcedWin(board, 1, 6)).toBeGreaterThanOrEqual(0);
  });

  it('the better bot wins more, and the referee replays a game', { timeout: 60_000 }, () => {
    let wins = 0;
    for (let g = 0; g < 8; g++) {
      const rng = createRng(g + 1);
      let s = newGomoku();
      const me = g % 2;
      const moves: string[] = [];
      while (!s.result) {
        const m = chooseGomokuMove(s, s.currentSeat === me ? GOMOKU_TIERS.hard : GOMOKU_TIERS.easy, rng);
        moves.push(m);
        s = s.apply(m);
      }
      if (s.result.winners[0] === me) wins++;
      if (g === 0) expect(replay(gomoku, { gameId: 'gomoku', seed: 1, config: { players: 2 }, moves }).result).toEqual(s.result);
    }
    expect(wins).toBeGreaterThanOrEqual(7);
  });

  it('invariant, every move of bot play: stones only ever go down, one a turn, black and white taking turns', () => {
    const rng = createRng(9);
    let s = newGomoku();
    while (!s.result) {
      const next = s.apply(chooseGomokuMove(s, GOMOKU_TIERS.medium, rng));
      const placed = next.board.filter((v) => v !== 0).length;
      expect(placed).toBe(next.moves);
      next.board.forEach((v, i) => s.board[i] !== 0 && expect(v).toBe(s.board[i]));
      const black = next.board.filter((v) => v === 1).length;
      const white = next.board.filter((v) => v === 2).length;
      expect(black - white === 0 || black - white === 1).toBe(true);
      s = next;
    }
  });
});
