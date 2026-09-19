import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { newWar, war, WAR_BATTLES, WAR_FLIP, warRank, WarState, type WarMove } from './index';

const card = (rank: number, suit: number) => suit * 13 + rank - 1;
/** Stacks are given next-card-last, the way the game turns them over. */
const at = (a: number[], b: number[], battles = 0) => new WarState([a, b], 0, battles, null, null);

describe('war deal and battles', () => {
  it('splits the deck evenly, 26 each', () => {
    const state = newWar(5);
    expect(state.counts).toEqual([26, 26]);
    expect(new Set(state.stacks.flat()).size).toBe(52);
  });

  it('gives both cards to the higher one', () => {
    const after = at([card(3, 0), card(9, 0)], [card(4, 1), card(5, 1)]).apply(WAR_FLIP);
    expect(after.counts).toEqual([3, 1]);
    expect(after.last).toMatchObject({ winner: 0, wars: 0, taken: 2 });
  });

  it('counts an ace above a king', () => {
    expect(warRank(card(1, 0))).toBe(14);
    expect(warRank(card(13, 0))).toBe(13);
    const after = at([card(2, 0), card(1, 0)], [card(7, 1), card(13, 1)]).apply(WAR_FLIP);
    expect(after.last?.winner).toBe(0);
  });

  it('starts a war on equal cards: one down, one up, and the winner takes all six', () => {
    // Turned in order: 9 against 9, then one face down each, then 10 against 4.
    const after = at([card(3, 0), card(10, 0), card(2, 0), card(9, 0)], [card(6, 1), card(4, 1), card(5, 1), card(9, 1)]).apply(WAR_FLIP);
    expect(after.last?.wars).toBe(1);
    expect(after.last?.winner).toBe(0);
    expect(after.last?.taken).toBe(6);
    expect(after.counts).toEqual([7, 1]);
  });

  it('loses the game for a player who cannot finish a war', () => {
    // Seat 1 ties, puts its last card down, and has nothing to decide the war with.
    const after = at([card(3, 0), card(8, 0), card(2, 0), card(9, 0)], [card(4, 1), card(9, 1)]).apply(WAR_FLIP);
    expect(after.result?.winners).toEqual([0]);
  });
});

describe('war endings', () => {
  it('is won by the player holding every card', () => {
    const after = at([card(3, 0), card(9, 0)], [card(4, 1)]).apply(WAR_FLIP);
    expect(after.counts).toEqual([3, 0]);
    expect(after.result).toEqual({ winners: [0], draw: false });
  });

  it('stops after 300 battles and gives it to the bigger stack', () => {
    const state = at([card(2, 0), card(3, 0), card(9, 0)], [card(4, 1)], WAR_BATTLES - 1);
    const after = state.apply(WAR_FLIP);
    expect(after.battles).toBe(WAR_BATTLES);
    expect(after.result?.winners).toEqual([0]);
  });

  it('plays a whole game and replays exactly', () => {
    const bot = war.createBot('medium');
    let state = war.newGame({ players: 2 }, 19) as WarState;
    const moves: WarMove[] = [];
    while (!state.result && moves.length < WAR_BATTLES + 5) {
      const move = bot.chooseMove(state, state.currentSeat, { next: () => 0, int: () => 0, pick: (list) => list[0]! });
      moves.push(move);
      state = state.apply(move);
    }
    expect(state.result, 'the game never ended').not.toBe(null);
    const replayed = replay(war, toMoveLog(war, { players: 2 }, 19, moves)) as WarState;
    expect(replayed.stacks).toEqual(state.stacks);
    expect(replayed.counts.reduce((a, b) => a + b, 0)).toBe(52);
  });
});
