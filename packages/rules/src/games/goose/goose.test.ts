import { describe, expect, it } from 'vitest';
import { replay } from '../../core/replay';
import { GEESE, goose, gooseDice, GooseState, GOOSE_HOME, newGoose } from './index';

/** A seed whose next throw (at `throws`) has this total, and, if given, exactly these dice. */
function seedFor(throws: number, total: number, dice?: [number, number]): number {
  for (let seed = 1; seed < 200000; seed++) {
    const d = gooseDice(seed, throws);
    if (d[0] + d[1] === total && (!dice || (d[0] === dice[0] && d[1] === dice[1]))) return seed;
  }
  throw new Error('no seed');
}

/** Seat 0 of two to throw, at `pos`, `throws` in (past the first round unless said). */
const at = (pos: number, total: number, other = 40, throws = 10) =>
  new GooseState(seedFor(throws, total), [pos, other], [0, 0], [false, false], 0, throws, null, null).apply('roll');

describe('game of the goose', () => {
  it('a goose sends you on by the total, and again from the next goose', () => {
    // 1 + 8 = 9 (goose), + 8 = 17: not a goose.
    expect(at(1, 8).positions[0]).toBe(17);
    // 0 + 5 = 5 (goose) + 5 = 10 on a later turn.
    expect(at(0, 5).positions[0]).toBe(10);
    // 36 is a goose and 9 from 27 which is a goose from 18: 9 + 9 = 18, 27, 36, 45, 54, 63.
    expect(at(9, 9, 40, 10).positions[0]).toBe(GOOSE_HOME);
  });

  it('6 and 3 on the first throw goes to 26, 5 and 4 to 53; later it does not', () => {
    const first = (dice: [number, number]) => new GooseState(seedFor(0, 9, dice), [0, 0], [0, 0], [false, false], 0, 0, null, null).apply('roll');
    expect(first([6, 3]).positions[0]).toBe(26);
    expect(first([3, 6]).positions[0]).toBe(26);
    expect(first([5, 4]).positions[0]).toBe(53);
    expect(first([4, 5]).positions[0]).toBe(53);
  });

  it('bridge, maze and death', () => {
    expect(at(2, 4).positions[0]).toBe(12);
    expect(at(34, 8).positions[0]).toBe(30);
    expect(at(49, 9).positions[0]).toBe(0);
  });

  it('past home counts back, and back onto a goose goes back again', () => {
    // 60 + 7 = 67: back to 59 (a goose), back 7 more to 52... the Prison.
    const s = at(60, 7);
    expect(s.positions[0]).toBe(52);
    expect(s.held[0]).toBe(true);
    // 61 + 4 = 65: back to 61.
    expect(at(61, 4).positions[0]).toBe(61);
    expect(at(61, 2).result?.winners).toEqual([0]);
  });

  it('the Inn misses one turn', () => {
    const s = new GooseState(seedFor(10, 7), [12, 30], [0, 0], [false, false], 0, 10, null, null).apply('roll');
    expect(s.positions[0]).toBe(19);
    expect(s.currentSeat).toBe(1);
    // Seat 1 throws; seat 0's turn is skipped once, so seat 1 goes again.
    const t = s.apply('roll');
    expect(t.currentSeat).toBe(1);
    expect(t.apply('roll').currentSeat).toBe(0);
  });

  it('the Well holds you until someone lands there, who is then held in your place', () => {
    const s = new GooseState(seedFor(10, 7), [24, 3], [0, 0], [false, false], 0, 10, null, null).apply('roll');
    expect(s.positions[0]).toBe(31);
    expect(s.held[0]).toBe(true);
    // Seat 0 is skipped while held.
    expect(s.currentSeat).toBe(1);
    const freed = new GooseState(seedFor(11, 8), [31, 23], [0, 0], [true, false], 1, 11, null, null).apply('roll');
    expect(freed.positions).toEqual([23, 31]);
    expect(freed.held).toEqual([false, true]);
    expect(freed.last?.bumped).toEqual({ seat: 0, to: 23 });
  });

  it('everyone held is let out rather than stall', () => {
    const s = new GooseState(seedFor(10, 7), [24, 52], [0, 0], [false, true], 0, 10, null, null).apply('roll');
    expect(s.held).toEqual([false, false]);
    expect(s.last?.released).toBe(true);
  });

  it('whole games stay on the board and end, and the referee replays them', () => {
    for (let seed = 1; seed <= 60; seed++) {
      let s = newGoose(2 + (seed % 3), seed);
      const moves: 'roll'[] = [];
      while (!s.result && moves.length < 3000) {
        s = s.apply('roll');
        moves.push('roll');
        expect(s.positions.every((p) => p >= 0 && p <= GOOSE_HOME)).toBe(true);
        expect(s.positions.filter((p) => GEESE.includes(p)).length).toBe(0);
      }
      expect(s.result, `seed ${seed}`).not.toBeNull();
      expect(replay(goose, { gameId: 'goose', seed, config: { players: 2 + (seed % 3) }, moves }).result).toEqual(s.result);
    }
  });
});
