import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { replay } from '../../core/replay';
import { chooseTrainMove, isDouble, longestRun, MT_HIGH, MT_TILES, mexicanTrain, newMexicanTrain, TrainState, trainMove } from './index';

const tile = (a: number, b: number) => MT_TILES.findIndex(([x, y]) => (x === a && y === b) || (x === b && y === a));
const all = (s: TrainState) => [...s.hands.flat(), ...s.boneyard, ...s.trains.flatMap((t) => t.tiles)];

describe('mexican train', () => {
  it('deals from the double-nine set with the hub out: twelve each for two, nine each for four', () => {
    const two = newMexicanTrain(2, 1);
    expect(two.hands.map((h) => h.length)).toEqual([12, 12]);
    expect(newMexicanTrain(4, 1).hands.map((h) => h.length)).toEqual([9, 9, 9, 9]);
    expect(MT_TILES.length).toBe(54);
    expect(new Set(all(two)).size).toBe(54);
    expect(two.trains.every((t) => t.end === MT_HIGH)).toBe(true);
  });

  it('a tile goes on your own train or the Mexican train if it matches the end, and the end turns', () => {
    const t = tile(9, 4);
    const s = new TrainState(2, [[t, tile(0, 1)], [tile(2, 3)]], [tile(5, 5)], [{ tiles: [], end: 9 }, { tiles: [], end: 9 }, { tiles: [], end: 9 }], [false, false], null, 0, false, 0, null, null);
    expect(s.legalMoves(0)).toEqual([trainMove(t, 0), trainMove(t, 2)]);
    const next = s.apply(trainMove(t, 0));
    expect(next.trains[0]!.end).toBe(4);
    expect(next.currentSeat).toBe(1);
    // Nobody may play on someone else's train without a marker.
    expect(s.openTo(0)).toEqual([0, 2]);
  });

  it('cannot play: draw one; still cannot: pass and put a marker on your own train, which opens it', () => {
    const s = new TrainState(2, [[tile(0, 1)], [tile(2, 3), tile(3, 9)]], [tile(1, 2)], [{ tiles: [], end: 9 }, { tiles: [], end: 9 }, { tiles: [], end: 9 }], [false, false], null, 0, false, 0, null, null);
    expect(s.legalMoves(0)).toEqual(['draw']);
    const drawn = s.apply('draw');
    expect(drawn.legalMoves(0)).toEqual(['pass']);
    const passed = drawn.apply('pass');
    expect(passed.markers[0]).toBe(true);
    expect(passed.openTo(1)).toContain(0);
  });

  it('a double must be covered before anything else, and the one who played it goes again', () => {
    const s = new TrainState(2, [[tile(9, 6), tile(6, 6), tile(6, 1)], [tile(0, 0)]], [], [{ tiles: [], end: 9 }, { tiles: [], end: 9 }, { tiles: [], end: 9 }], [false, false], null, 0, false, 0, null, null);
    const a = s.apply(trainMove(tile(9, 6), 0));
    expect(a.currentSeat).toBe(1);
    const b = new TrainState(2, a.hands, [], a.trains, a.markers, null, 0, false, 0, null, null).apply(trainMove(tile(6, 6), 0));
    expect(isDouble(tile(6, 6))).toBe(true);
    expect(b.openDouble).toBe(0);
    expect(b.currentSeat).toBe(0);
    expect(b.legalMoves(0)).toEqual([trainMove(tile(6, 1), 0)]);
  });

  it('first to play out wins; a blocked round goes to the fewest pips', () => {
    const s = new TrainState(2, [[tile(9, 1)], [tile(5, 5), tile(4, 4)]], [], [{ tiles: [], end: 9 }, { tiles: [], end: 9 }, { tiles: [], end: 9 }], [false, false], null, 0, false, 0, null, null);
    expect(s.apply(trainMove(tile(9, 1), 0)).result).toEqual({ winners: [0], draw: false });
    const stuck = new TrainState(2, [[tile(0, 1)], [tile(5, 5), tile(4, 4)]], [], [{ tiles: [], end: 9 }, { tiles: [], end: 9 }, { tiles: [], end: 9 }], [false, false], null, 0, false, 1, null, null);
    expect(stuck.apply('pass').result).toEqual({ winners: [0], draw: false });
  });

  it('finds the longest run a hand can lay', () => {
    expect(longestRun([tile(9, 4), tile(4, 2), tile(2, 7), tile(9, 1)], 9)).toEqual([tile(9, 4), tile(4, 2), tile(2, 7)]);
  });

  it('bots finish every round, and the referee replays one', { timeout: 30_000 }, () => {
    for (const players of [2, 3, 4]) {
      const rng = createRng(players);
      let s = mexicanTrain.newGame({ players }, players) as TrainState;
      const moves: string[] = [];
      while (!s.result) {
        const m = chooseTrainMove(s, 'hard', rng);
        moves.push(m);
        s = s.apply(m);
        expect(moves.length).toBeLessThan(2000);
      }
      expect(replay(mexicanTrain, { gameId: 'mexican-train', seed: players, config: { players }, moves }).result).toEqual(s.result);
    }
  });

  it('invariant, every move of bot play: all 54 tiles are somewhere, once each', () => {
    const rng = createRng(8);
    let s = newMexicanTrain(3, 8);
    while (!s.result) {
      s = s.apply(chooseTrainMove(s, 'medium', rng));
      const tiles = all(s);
      expect(tiles.length).toBe(54);
      expect(new Set(tiles).size).toBe(54);
    }
  });
});
