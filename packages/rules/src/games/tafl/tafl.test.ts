import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { TAFL_ATTACKER, TAFL_DEFENDER, TAFL_KING, newTafl, tafl, TAFL_SQUARES, TaflState, THRONE } from './index';

const sq = (x: number, y: number) => y * 11 + x;
/** A position by hand. */
const at = (pieces: [number, number, number][], seat: 0 | 1) => {
  const board = Array<number>(TAFL_SQUARES).fill(0);
  for (const [x, y, piece] of pieces) board[sq(x, y)] = piece;
  return new TaflState(board, seat, 0, null, null, null);
};
const mv = (a: [number, number], b: [number, number]) => `m${sq(...a)}-${sq(...b)}`;

describe('hnefatafl', () => {
  it('starts with 24 attackers against 12 defenders and the king on his throne', () => {
    const s = newTafl();
    expect(s.board.filter((p) => p === TAFL_ATTACKER)).toHaveLength(24);
    expect(s.board.filter((p) => p === TAFL_DEFENDER)).toHaveLength(12);
    expect(s.king).toBe(THRONE);
    expect(s.currentSeat).toBe(0);
  });

  it('pieces move like rooks and cannot jump', () => {
    const s = at([[2, 2, TAFL_ATTACKER], [2, 5, TAFL_DEFENDER], [8, 8, TAFL_KING]], 0);
    const moves = s.legalMoves(0);
    expect(moves).toContain(mv([2, 2], [2, 4]));
    expect(moves).not.toContain(mv([2, 2], [2, 6]));
    expect(moves).toContain(mv([2, 2], [9, 2]));
  });

  it('only the king may stop on the throne or a corner, but others may cross the empty throne', () => {
    const s = at([[5, 2, TAFL_ATTACKER], [1, 1, TAFL_KING]], 0);
    expect(s.legalMoves(0)).not.toContain(mv([5, 2], [5, 5]));
    expect(s.legalMoves(0)).toContain(mv([5, 2], [5, 8]));
    const k = at([[1, 0, TAFL_KING], [8, 8, TAFL_ATTACKER]], 1);
    expect(k.legalMoves(1)).toContain(mv([1, 0], [0, 0]));
  });

  it('a piece trapped between two enemies is taken, but only by the move that closes the trap', () => {
    const s = at([[3, 3, TAFL_ATTACKER], [4, 3, TAFL_DEFENDER], [5, 1, TAFL_ATTACKER], [9, 9, TAFL_KING]], 0).apply(mv([5, 1], [5, 3]));
    expect(s.board[sq(4, 3)]).toBe(0);
    expect(s.last?.captured).toEqual([sq(4, 3)]);
    // Moving between two enemies is safe.
    const safe = at([[3, 3, TAFL_DEFENDER], [5, 3, TAFL_DEFENDER], [4, 1, TAFL_ATTACKER], [9, 9, TAFL_KING]], 0).apply(mv([4, 1], [4, 3]));
    expect(safe.board[sq(4, 3)]).toBe(TAFL_ATTACKER);
  });

  it('corners and the empty throne trap like an enemy', () => {
    const s = at([[1, 0, TAFL_DEFENDER], [3, 0, TAFL_ATTACKER], [9, 9, TAFL_KING]], 0).apply(mv([3, 0], [2, 0]));
    expect(s.board[sq(1, 0)]).toBe(0);
    const t = at([[5, 4, TAFL_DEFENDER], [5, 2, TAFL_ATTACKER], [9, 9, TAFL_KING]], 0).apply(mv([5, 2], [5, 3]));
    expect(t.board[sq(5, 4)]).toBe(0);
  });

  it('the king escapes to a corner and wins', () => {
    const s = at([[0, 5, TAFL_KING], [8, 8, TAFL_ATTACKER]], 1).apply(mv([0, 5], [0, 0]));
    expect(s.result).toEqual({ winners: [1], draw: false });
  });

  it('the king is taken on four sides, or three and the throne, and never on the edge', () => {
    const four = at([[4, 3, TAFL_KING], [3, 3, TAFL_ATTACKER], [5, 3, TAFL_ATTACKER], [4, 2, TAFL_ATTACKER], [4, 8, TAFL_ATTACKER]], 0).apply(mv([4, 8], [4, 4]));
    expect(four.result).toEqual({ winners: [0], draw: false });
    const throne = at([[5, 4, TAFL_KING], [4, 4, TAFL_ATTACKER], [6, 4, TAFL_ATTACKER], [5, 1, TAFL_ATTACKER]], 0).apply(mv([5, 1], [5, 3]));
    expect(throne.result).toEqual({ winners: [0], draw: false });
    // A spare defender elsewhere, so the defenders still have a move.
    const edge = at([[0, 4, TAFL_KING], [0, 3, TAFL_ATTACKER], [1, 4, TAFL_ATTACKER], [3, 5, TAFL_ATTACKER], [8, 8, TAFL_DEFENDER]], 0).apply(mv([3, 5], [0, 5]));
    expect(edge.result).toBeNull();
  });

  it('a player with no move loses', () => {
    // The king alone on the edge, boxed in: surrounded on three sides he is not taken, but he cannot move.
    const s = at([[0, 4, TAFL_KING], [0, 3, TAFL_ATTACKER], [1, 4, TAFL_ATTACKER], [3, 5, TAFL_ATTACKER]], 0).apply(mv([3, 5], [0, 5]));
    expect(s.result).toEqual({ winners: [0], draw: false });
  });

  it('bots play legal moves, and the stronger tier wins on either side', { timeout: 300_000 }, () => {
    // Tafl is lopsided with weak players (the king runs), so ordering is measured side by side.
    const attackersWin = (att: 'medium' | 'hard', def: 'medium' | 'hard', games: number) => {
      let wins = 0;
      for (let seed = 0; seed < games; seed++) {
        const rng = createRng(seed + 70);
        const bots = [tafl.createBot(att), tafl.createBot(def)];
        let s = newTafl();
        while (!s.result) {
          const move = bots[s.currentSeat]!.chooseMove(s, s.currentSeat, rng);
          expect(s.legalMoves(s.currentSeat)).toContain(move);
          s = s.apply(move);
        }
        if (s.result.winners[0] === 0) wins++;
      }
      return wins;
    };
    expect(attackersWin('hard', 'medium', 3)).toBeGreaterThanOrEqual(2);
    expect(attackersWin('medium', 'hard', 3)).toBeLessThanOrEqual(1);
  });
});

/** Invariant: one king at most, and the throne and corners hold nobody but him. */
describe('tafl invariants', () => {
  it('keeps the restricted squares his', { timeout: 60_000 }, () => {
    for (let seed = 0; seed < 12; seed++) {
      const rng = createRng(seed);
      let s = newTafl();
      while (!s.result) {
        for (const p of [THRONE, 0, 10, 110, 120]) expect([0, TAFL_KING]).toContain(s.board[p]);
        expect(s.board.filter((p) => p === TAFL_KING).length).toBeLessThanOrEqual(1);
        s = s.apply(rng.pick(s.legalMoves(s.currentSeat)));
      }
    }
  });
});
