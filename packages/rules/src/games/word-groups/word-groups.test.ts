import { describe, expect, it } from 'vitest';
import { BOT_TIERS } from '../../core/types';
import { createRng } from '../../core/rng';
import { replay, toMoveLog } from '../../core/replay';
import {
  GROUP_SIZE,
  GroupsState,
  guess,
  LIVES,
  newWordGroups,
  PUZZLES,
  SHUFFLE,
  wordGroupsGame,
  type GroupMove,
} from './index';

describe('the written puzzles', () => {
  it('are sixteen different words in four groups of four', () => {
    expect(PUZZLES.length).toBeGreaterThanOrEqual(20);
    PUZZLES.forEach((puzzle, index) => {
      expect(puzzle.groups, `puzzle ${index}`).toHaveLength(4);
      const words = puzzle.groups.flatMap((group) => group.words);
      expect(words, `puzzle ${index}`).toHaveLength(16);
      // A word in two groups of the same board is not a trap, it is a mistake: the trap is a
      // word that looks like it belongs elsewhere, and both cannot be true of one word.
      expect(new Set(words).size, `puzzle ${index} repeats a word`).toBe(16);
      for (const group of puzzle.groups) {
        expect(group.words, `puzzle ${index}`).toHaveLength(GROUP_SIZE);
        expect(group.name.length, `puzzle ${index}`).toBeGreaterThan(2);
        expect(group.words.every((word) => /^[A-Z]{2,12}$/.test(word)), `puzzle ${index} ${group.name}`).toBe(true);
      }
    });
  });

  it('never gives two puzzles the same board', () => {
    const boards = PUZZLES.map((puzzle) => puzzle.groups.flatMap((group) => group.words).sort().join(','));
    expect(new Set(boards).size).toBe(PUZZLES.length);
  });
});

describe('guessing a group', () => {
  it('locks a group when the four are right', () => {
    const state = newWordGroups(3);
    const group = state.groups[0]!;
    const after = state.apply(guess(group.words));
    expect(after.found).toEqual([0]);
    expect(after.lives).toBe(LIVES);
    expect(after.left).toHaveLength(12);
    // Those four are out of play now.
    expect(() => after.apply(guess(group.words))).toThrow(/Illegal/);
  });

  it('costs a life when they are not, and says how close it was', () => {
    const state = newWordGroups(3);
    // Three from one group and one from another is the "one away" case.
    const near = [...state.groups[0]!.words.slice(0, 3), state.groups[1]!.words[0]!];
    const after = state.apply(guess(near));
    expect(after.lives).toBe(LIVES - 1);
    expect(after.found).toEqual([]);
    expect(after.away).toBe(3);
    // Two and two is not one away.
    const split = [...state.groups[0]!.words.slice(0, 2), ...state.groups[1]!.words.slice(0, 2)];
    expect(state.apply(guess(split)).away).toBe(2);
  });

  it('ends when the lives run out, with the groups still there to read', () => {
    let state = newWordGroups(3);
    const wrong = [state.groups[0]!.words[0]!, state.groups[1]!.words[0]!, state.groups[2]!.words[0]!, state.groups[3]!.words[0]!];
    for (let life = 0; life < LIVES; life++) state = state.apply(guess(wrong));
    expect(state.lives).toBe(0);
    expect(state.won).toBe(false);
    expect(state.result?.winners).toEqual([]);
    expect(state.groups).toHaveLength(4);
    expect(() => state.apply(guess(wrong))).toThrow(/over/);
  });

  it('refuses a guess that is not four words in play', () => {
    const state = newWordGroups(3);
    expect(() => state.apply(guess(state.groups[0]!.words.slice(0, 3)))).toThrow(/Illegal/);
    expect(() => state.apply('gONE,TWO,THREE,FOUR')).toThrow(/Illegal/);
    expect(() => state.apply('nonsense')).toThrow(/Illegal/);
    const twice = state.groups[0]!.words[0]!;
    expect(() => state.apply(`g${twice},${twice},${state.groups[0]!.words[1]},${state.groups[0]!.words[2]}`)).toThrow(/Illegal/);
  });

  it('shuffles the board and changes nothing else', () => {
    const state = newWordGroups(3).apply(guess(newWordGroups(3).groups[0]!.words));
    const after = state.apply(SHUFFLE);
    expect([...after.board].sort()).toEqual([...state.board].sort());
    expect(after.found).toEqual(state.found);
    expect(after.lives).toBe(state.lives);
    expect(after.board).not.toEqual(state.board);
  });
});

describe('dealing a board', () => {
  it('lays all sixteen, and the same seed gives the same board', () => {
    const one = newWordGroups(11);
    expect(one.board).toHaveLength(16);
    expect([...one.board].sort()).toEqual(one.groups.flatMap((group) => group.words).sort());
    expect(newWordGroups(11).board).toEqual(one.board);
    const seen = new Set([1, 2, 3, 4, 5, 6].map((seed) => newWordGroups(seed).board.join(',')));
    expect(seen.size).toBeGreaterThan(3);
  });
});

describe('word groups bots', () => {
  it('finish, and the weak ones spend lives getting there', { timeout: 120_000 }, () => {
    for (const tier of BOT_TIERS) {
      const bot = wordGroupsGame.createBot(tier);
      let state = wordGroupsGame.newGame({ players: 1 }, 6) as GroupsState;
      const moves: GroupMove[] = [];
      while (!state.result && moves.length < 60) {
        const move = bot.chooseMove(state, 0, createRng(moves.length + 1));
        moves.push(move);
        state = state.apply(move);
      }
      expect(state.result, `${tier} never finished`).not.toBe(null);
      if (tier === 'hard' || tier === 'expert') {
        expect(state.won, `${tier} should not lose a life`).toBe(true);
        expect(state.lives).toBe(LIVES);
      }
      const replayed = replay(wordGroupsGame, toMoveLog(wordGroupsGame, { players: 1 }, 6, moves)) as GroupsState;
      expect(replayed.found).toEqual(state.found);
    }
  });
});
