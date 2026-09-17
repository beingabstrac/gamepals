import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import type { BotTier, Seat } from '../../core/types';
import {
  cellOf,
  cellsOf,
  FLEET,
  FLEET_CELLS,
  fireMove,
  HIT,
  MISS,
  newSeaBattle,
  placeMove,
  SEA_SIZE,
  seaBattle,
  SeaBattleState,
  UNKNOWN,
  type Placement,
  type SeaMove,
} from './index';

/** Both fleets in a row each, so tests can get straight to firing. */
function ready(): SeaBattleState {
  let state = newSeaBattle();
  for (const seat of [0, 1]) {
    FLEET.forEach((_, ship) => {
      state = state.apply(placeMove(seat === 0 ? ship : ship + 5, 0, true));
    });
  }
  expect(state.phase).toBe('fire');
  return state;
}

describe('sea battle setup', () => {
  it('has a fleet of 5, 4, 3, 3 and 2: seventeen squares', () => {
    expect(FLEET.map((s) => s.size)).toEqual([5, 4, 3, 3, 2]);
    expect(FLEET_CELLS).toBe(17);
  });

  it('places one player at a time, then starts firing', () => {
    let state = newSeaBattle();
    expect(state.currentSeat).toBe(0);
    expect(state.legalMoves(1)).toEqual([]);
    for (let ship = 0; ship < 5; ship++) state = state.apply(placeMove(ship, 0, true));
    expect(state.phase).toBe('place');
    expect(state.currentSeat).toBe(1);
    for (let ship = 0; ship < 5; ship++) state = state.apply(placeMove(ship, 0, true));
    expect(state.phase).toBe('fire');
    expect(state.currentSeat).toBe(0);
  });

  it('keeps ships on the grid and never overlapping', () => {
    const state = newSeaBattle();
    // The carrier is 5 long, so column 6 across would hang off the edge.
    expect(state.legalMoves(0)).not.toContain(placeMove(0, 6, true));
    expect(state.legalMoves(0)).toContain(placeMove(0, 5, true));
    const after = state.apply(placeMove(0, 0, true));
    expect(after.legalMoves(0)).not.toContain(placeMove(0, 0, true));
    expect(after.legalMoves(0)).toContain(placeMove(1, 0, true));
    expect(() => after.apply(placeMove(0, 3, true))).toThrow();
  });
});

describe('sea battle firing', () => {
  it('reports misses and hits, and never fires twice at a square', () => {
    const state = ready();
    // Seat 1's ships sit on rows 5 to 9, so row 0 is empty water.
    const miss = state.apply(fireMove(0, 0));
    expect(miss.shots[0]![cellOf(0, 0)]).toBe(MISS);
    expect(miss.last).toMatchObject({ kind: 'fire', hit: false });
    expect(miss.currentSeat).toBe(1);
    expect(miss.legalMoves(1)).toContain(fireMove(0, 0));
    const back = miss.apply(fireMove(9, 9));
    expect(back.legalMoves(0)).not.toContain(fireMove(0, 0));
    expect(() => back.apply(fireMove(0, 0))).toThrow();
    const hit = back.apply(fireMove(5, 0));
    expect(hit.shots[0]![cellOf(5, 0)]).toBe(HIT);
    expect(hit.last).toMatchObject({ kind: 'fire', hit: true });
  });

  it('says which ship sank, and ends when a whole fleet is down', () => {
    let state = ready();
    // Seat 1's destroyer (2 long) is on row 9; sink it with two shots.
    state = state.apply(fireMove(9, 0)).apply(fireMove(0, 0));
    const sinker = state.apply(fireMove(9, 1));
    expect(sinker.last).toMatchObject({ kind: 'fire', hit: true, sunk: 4 });
    expect(sinker.sunkShips(1)).toEqual([4]);

    // Now sink everything else seat 1 owns.
    let game = ready();
    const enemy = game.fleets[1]!.flatMap((placement: Placement) => cellsOf(placement));
    let shots = 0;
    let reply = 99;
    for (const cell of enemy) {
      game = game.apply(fireMove(Math.floor(cell / SEA_SIZE), cell % SEA_SIZE));
      shots++;
      if (game.result) break;
      // Seat 1 fires somewhere new each time, walking backwards through the grid.
      game = game.apply(fireMove(Math.floor(reply / SEA_SIZE), reply % SEA_SIZE));
      reply--;
    }
    expect(shots).toBe(FLEET_CELLS);
    expect(game.result).toEqual({ winners: [0], draw: false });
    expect(game.sunkShips(1)).toHaveLength(5);
  });
});

function playGame(tiers: BotTier[], seed: number): { state: SeaBattleState; shots: number[] } {
  const bots = tiers.map((tier) => seaBattle.createBot(tier));
  const rng = createRng(seed * 7 + 3);
  let state = seaBattle.newGame({ players: 2 }, seed) as SeaBattleState;
  const shots = [0, 0];
  const moves: SeaMove[] = [];
  while (!state.result && moves.length < 400) {
    const seat = state.currentSeat;
    const move = bots[seat]!.chooseMove(state, seat, rng);
    expect(state.legalMoves(seat)).toContain(move);
    if (move[0] === 'f') shots[seat]!++;
    moves.push(move);
    state = state.apply(move);
  }
  const replayed = replay(seaBattle, toMoveLog(seaBattle, { players: 2 }, seed, moves)) as SeaBattleState;
  expect(replayed.shots).toEqual(state.shots);
  return { state, shots };
}

describe('sea battle bots', () => {
  it('play whole games with only legal moves, and replay exactly', () => {
    for (const seed of [2, 5]) {
      const { state } = playGame(['medium', 'hard'], seed);
      expect(state.result?.winners).toHaveLength(1);
    }
  });

  it('never look at the hidden fleet: the same answers give the same shot', () => {
    const base = ready();
    // Two different hidden fleets for seat 1, with the same answers so far (all misses in row 0).
    const shifted = new SeaBattleState(
      [base.fleets[0]!, base.fleets[1]!.map((p: Placement) => ({ ...p, col: 3 }))],
      base.shots,
      0,
      'fire',
      null,
      null,
    );
    const bot = seaBattle.createBot('expert');
    expect(bot.chooseMove(base, 0, createRng(9))).toBe(bot.chooseMove(shifted, 0, createRng(9)));
  });

  it('Nova needs fewer shots than Pip', () => {
    let nova = 0;
    let pip = 0;
    for (let seed = 1; seed <= 6; seed++) {
      nova += playGame(['expert', 'easy'], seed).shots[0]!;
      pip += playGame(['easy', 'expert'], seed).shots[0]!;
    }
    expect(nova).toBeLessThan(pip);
  });
});
