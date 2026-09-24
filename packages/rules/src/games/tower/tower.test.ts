import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { replay } from '../../core/replay';
import { isLegalMove } from '../../core/moves';
import { chooseTowerMove, newTower, parseTower, tower, TOWER_ROWS, towerMargin, towerMove, towerRisk, TowerState } from './index';

const full = () => Array.from({ length: TOWER_ROWS }, () => [true, true, true]);

describe('tower', () => {
  it('a full tower stands square; a row with only a side block under a centred load falls', () => {
    expect(towerMargin(full())).toBe(1.5);
    const rows = full();
    rows[3] = [true, false, false];
    expect(towerMargin(rows)).toBeLessThan(0);
    rows[3] = [false, true, false];
    expect(towerMargin(rows)).toBeGreaterThan(0);
    rows[3] = [true, false, true];
    expect(towerMargin(rows)).toBeGreaterThan(0);
  });

  it('you may pull from any row below the top two, and lay the block on top', () => {
    const s = newTower(1);
    const moves = s.legalMoves(0);
    const rows = new Set(moves.map((m) => parseTower(m)!.row));
    expect(Math.max(...rows)).toBe(TOWER_ROWS - 3);
    expect(s.allows(towerMove(TOWER_ROWS - 1, 0, 0))).toBe(false);
    const next = s.apply(towerMove(4, 1, 0, 90));
    expect(next.rows.length).toBe(TOWER_ROWS + 1);
    expect(next.rows[TOWER_ROWS]).toEqual([true, false, false]);
    expect(next.rows[4]).toEqual([true, false, true]);
    expect(next.currentSeat).toBe(1);
  });

  it('the next block goes in a free place on the part-built top row, and a full top row starts a new one', () => {
    let s = newTower(2).apply(towerMove(2, 0, 1, 100));
    expect(s.free).toEqual([0, 2]);
    expect(s.allows(towerMove(3, 0, 1, 50))).toBe(false);
    s = s.apply(towerMove(3, 0, 0, 100)).apply(towerMove(5, 0, 2, 100));
    expect(s.rows[TOWER_ROWS]).toEqual([true, true, true]);
    expect(s.free).toEqual([0, 1, 2]);
  });

  it('a pull that leaves a row unable to hold what is above brings it down, and that player loses', () => {
    let s = newTower(3, 3);
    s = s.apply(towerMove(6, 1, 1, 100));
    expect(s.result).toBeNull();
    const fall = s.apply(towerMove(6, 0, 0, 100));
    expect(fall.last?.fell).toBe(true);
    expect(fall.result).toEqual({ winners: [0, 2], draw: false });
  });

  it('a careful pull is less likely to wobble over than a rough one, and a taller tower wobbles more', () => {
    const s = newTower(4);
    expect(towerRisk(s, towerMove(4, 0, 0, 100))).toBeLessThan(towerRisk(s, towerMove(4, 0, 0, 0)));
    const tall = new TowerState(2, [...full(), ...full().slice(0, 6)], 0, 4, 0, null, null);
    expect(towerRisk(tall, towerMove(4, 0, 0, 50))).toBeGreaterThan(towerRisk(s, towerMove(4, 0, 0, 50)));
  });

  it('any care from 0 to 100 is a move; the referee replays a game', () => {
    const rng = createRng(5);
    let s = newTower(5);
    const moves: string[] = [];
    while (!s.result && moves.length < 200) {
      const m = chooseTowerMove(s, 'hard', rng);
      expect(isLegalMove(s, m)).toBe(true);
      moves.push(m);
      s = s.apply(m);
    }
    expect(replay(tower, { gameId: 'tower', seed: 5, config: { players: 2 }, moves }).result).toEqual(s.result);
    expect(parseTower('3.1>0@101')).toBeNull();
  });

  it('careful bots last longer than careless ones', { timeout: 30_000 }, () => {
    const length = (tier: 'easy' | 'hard') => {
      let total = 0;
      for (let seed = 1; seed <= 12; seed++) {
        const rng = createRng(seed);
        let s = newTower(seed);
        while (!s.result) s = s.apply(chooseTowerMove(s, tier, rng));
        total += s.turns;
      }
      return total;
    };
    expect(length('hard')).toBeGreaterThan(length('easy'));
  });

  it('invariant, every move of bot play: blocks are neither made nor lost, and no row below the top is empty', () => {
    const rng = createRng(7);
    let s = newTower(7, 4);
    while (!s.result) {
      s = s.apply(chooseTowerMove(s, 'medium', rng));
      expect(s.rows.flat().filter(Boolean).length).toBe(TOWER_ROWS * 3);
      for (let r = 0; r < s.rows.length - 1; r++) expect(s.rows[r]!.some(Boolean)).toBe(true);
    }
  });
});
