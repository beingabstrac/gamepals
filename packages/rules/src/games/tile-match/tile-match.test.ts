import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import {
  covers,
  newTileMatch,
  REST_ON,
  takeTileMove,
  TILE_LEVELS,
  TILE_SPECS,
  TILE_UNDOS,
  tileMatch,
  TileMatchState,
  TRAY_SIZE,
  UNDO_TILE_MOVE,
  type PileTile,
} from './index';

/** A flat row of tiles with the pictures given, nothing stacked, so every tile is free. */
function rowOf(symbols: number[]): TileMatchState {
  const tiles: PileTile[] = symbols.map((_, i) => ({ x: i * 2, y: 0, z: 0 }));
  return new TileMatchState('easy', tiles, symbols, symbols.map((_, i) => i), tiles.map(() => true), [], [], TILE_UNDOS, null, null, null, null);
}

const take = (state: TileMatchState, tile: number) => state.apply(takeTileMove(tile));

describe('tile match', () => {
  it('a tile is free exactly when nothing above overlaps it', () => {
    const tiles: PileTile[] = [
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
      { x: 4, y: 0, z: 0 },
      { x: 1, y: 1, z: 1 },
    ];
    const state = new TileMatchState('easy', tiles, [0, 0, 0, 1], [3, 0, 1, 2], tiles.map(() => true), [], [], TILE_UNDOS, null, null, null, null);
    // The top tile sits over the first two, half a tile in; the third is clear of it.
    expect([0, 1, 2, 3].map((t) => state.isFree(t))).toEqual([false, false, true, true]);
    expect(covers(tiles[3]!, tiles[2]!)).toBe(false);
    expect(() => take(state, 0)).toThrow();
    const lifted = take(state, 3);
    expect([0, 1, 2].map((t) => lifted.isFree(t))).toEqual([true, true, true]);
  });

  it('lands beside its own kind, and clears three alike', () => {
    let state = rowOf([0, 1, 0, 2, 0, 1, 1, 2, 2]);
    state = take(state, 0);
    state = take(state, 1);
    state = take(state, 2);
    expect(state.tray).toEqual([0, 2, 1]);
    expect(state.last?.slot).toBe(1);
    state = take(state, 4);
    expect(state.tray).toEqual([1]);
    expect(state.cleared).toEqual([0, 2, 4]);
    expect(state.last?.cleared).toEqual([0, 2, 4]);
  });

  it('loses on the seventh tile without a three, and wins with everything cleared', () => {
    let lost = rowOf([0, 1, 2, 3, 4, 5, 6, 0, 1]);
    for (let t = 0; t < TRAY_SIZE - 1; t++) lost = take(lost, t);
    expect(lost.result).toBeNull();
    lost = take(lost, TRAY_SIZE - 1);
    expect(lost.result).toEqual({ winners: [], draw: false });
    expect(lost.legalMoves(0)).toEqual([]);

    let won = rowOf([0, 0, 0, 1, 1, 1]);
    for (let t = 0; t < 6; t++) won = take(won, t);
    expect(won.result).toEqual({ winners: [0], draw: false });
    // A seventh tile that makes a three clears before the tray is counted, so it is not a loss.
    let squeeze = rowOf([0, 0, 1, 1, 2, 2, 0, 1, 2]);
    for (let t = 0; t < 6; t++) squeeze = take(squeeze, t);
    expect(squeeze.tray.length).toBe(6);
    squeeze = take(squeeze, 6);
    expect(squeeze.result).toBeNull();
    expect(squeeze.tray.length).toBe(4);
    squeeze = take(take(squeeze, 7), 8);
    expect(squeeze.result).toEqual({ winners: [0], draw: false });
  });

  it('undo puts the tile back, restores the tray, costs one, and runs out', () => {
    let state = rowOf([0, 1, 0, 0, 1, 1]);
    expect(state.legalMoves(0)).not.toContain(UNDO_TILE_MOVE);
    state = take(state, 0);
    state = take(state, 2);
    state = take(state, 3);
    expect(state.tray).toEqual([]);
    const undone = state.apply(UNDO_TILE_MOVE);
    expect(undone.tray).toEqual([0, 2]);
    expect(undone.onBoard[3]).toBe(true);
    expect(undone.undos).toBe(TILE_UNDOS - 1);
    expect(undone.last).toEqual({ tile: 3, slot: -1, cleared: [], undo: true });
    // Twice in a row puts back the one before.
    const twice = undone.apply(UNDO_TILE_MOVE);
    expect(twice.last?.tile).toBe(2);
    expect(twice.tray).toEqual([0]);
    const thrice = twice.apply(UNDO_TILE_MOVE);
    expect(thrice.tray).toEqual([]);
    expect(thrice.undos).toBe(0);
    const again = take(thrice, 1);
    expect(again.legalMoves(0)).not.toContain(UNDO_TILE_MOVE);
    expect(() => again.apply(UNDO_TILE_MOVE)).toThrow();
  });

  it('lists exactly what apply accepts', () => {
    const state = newTileMatch(4, 'medium');
    const listed = new Set(state.legalMoves(0));
    for (let tile = 0; tile < state.tiles.length; tile++) {
      const move = takeTileMove(tile);
      if (listed.has(move)) expect(() => state.apply(move)).not.toThrow();
      else expect(() => state.apply(move)).toThrow();
    }
    expect(() => state.apply(UNDO_TILE_MOVE)).toThrow();
  });

  it('deals the counts of the level, every picture in threes, mirrored left to right', () => {
    for (const level of TILE_LEVELS) {
      const spec = TILE_SPECS[level];
      for (let seed = 1; seed <= 200; seed++) {
        const state = newTileMatch(seed, level);
        const where = `${level} seed ${seed}`;
        spec.layers.forEach((count, z) => expect(state.tiles.filter((t) => t.z === z).length, `${where} layer ${z}`).toBe(count));
        const counts = new Map<number, number>();
        for (const symbol of state.symbols) counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
        for (const [symbol, n] of counts) expect(n % 3, `${where} picture ${symbol}`).toBe(0);
        expect(counts.size, where).toBe(spec.kinds);
        const at = new Set(state.tiles.map((t) => `${t.x},${t.y},${t.z}`));
        for (const t of state.tiles) expect(at.has(`${12 - t.x},${t.y},${t.z}`), `${where} mirror of ${t.x},${t.y},${t.z}`).toBe(true);
        for (const t of state.tiles.filter((tile) => tile.z > 0)) {
          const under = state.tiles.filter((below) => below.z === t.z - 1 && covers(t, below)).length;
          expect(under, `${where} tile at ${t.x},${t.y},${t.z} rests on`).toBeGreaterThanOrEqual(REST_ON);
        }
      }
    }
  });

  it('every board of every level is cleared by the order it was dealt along', { timeout: 120_000 }, () => {
    for (const level of TILE_LEVELS) {
      for (let seed = 1; seed <= 100; seed++) {
        let state = newTileMatch(seed, level);
        let most = 0;
        for (const tile of state.plan) {
          state = take(state, tile);
          most = Math.max(most, state.tray.length);
        }
        expect(state.result, `${level} seed ${seed}`).toEqual({ winners: [0], draw: false });
        expect(most, `${level} seed ${seed}`).toBeLessThanOrEqual(2 * TILE_SPECS[level].open);
      }
    }
  });

  it('autoplay clears the board, and a game replays from its log', () => {
    const bot = tileMatch.createBot('medium');
    const rng = createRng(3);
    let state = tileMatch.newGame({ players: 1, variant: 'hard' }, 21) as TileMatchState;
    const moves: string[] = [];
    while (!state.result) {
      const move = bot.chooseMove(state, 0, rng);
      moves.push(move);
      state = state.apply(move);
    }
    expect(state.result).toEqual({ winners: [0], draw: false });

    const random = createRng(8);
    let played = tileMatch.newGame({ players: 1, variant: 'easy' }, 5) as TileMatchState;
    const log: string[] = [];
    while (!played.result) {
      const move = random.pick(played.legalMoves(0));
      log.push(move);
      played = played.apply(move);
    }
    const again = replay(tileMatch, toMoveLog(tileMatch, { players: 1, variant: 'easy' }, 5, log)) as TileMatchState;
    expect(again.tray).toEqual(played.tray);
    expect(again.result).toEqual(played.result);
  });
});

/**
 * Invariant: every picture is a whole number of threes across the board, the tray and what has been
 * cleared; no tile is in two places; and the tray is under seven after any move that did not lose.
 */
describe('tile match invariants', () => {
  it('conserves every tile and every three', () => {
    for (const level of TILE_LEVELS) {
      for (let seed = 0; seed < 12; seed++) {
        const rng = createRng(seed + 50);
        let state = newTileMatch(seed, level);
        for (let move = 0; move < 400 && !state.result; move++) {
          state = state.apply(rng.pick(state.legalMoves(0)));
          const where = `${level} seed ${seed} move ${move}`;
          const places = state.tiles.map((_, t) => Number(state.onBoard[t]) + Number(state.tray.includes(t)) + Number(state.cleared.includes(t)));
          places.forEach((n, t) => expect(n, `${where}: tile ${t} is in ${n} places`).toBe(1));
          const perPicture = new Map<number, number>();
          for (const t of state.cleared) perPicture.set(state.symbols[t]!, (perPicture.get(state.symbols[t]!) ?? 0) + 1);
          for (const [symbol, n] of perPicture) expect(n % 3, `${where}: picture ${symbol} cleared ${n}`).toBe(0);
          if (!state.result) expect(state.tray.length, where).toBeLessThan(TRAY_SIZE);
        }
      }
    }
  });
});
