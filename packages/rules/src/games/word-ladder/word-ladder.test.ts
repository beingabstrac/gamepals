import { describe, expect, it } from 'vitest';
import { BOT_TIERS } from '../../core/types';
import { createRng } from '../../core/rng';
import { replay, toMoveLog } from '../../core/replay';
import {
  LADDER_SIZES,
  LadderState,
  ladderSizeFor,
  newWordLadder,
  oneApart,
  rung,
  shortest,
  TAKE_BACK,
  wordLadderGame,
  type LadderMove,
} from './index';

const game = (variant: string, seed: number): LadderState => newWordLadder({ players: 1, variant }, seed);

describe('climbing a ladder', () => {
  it('knows what one letter apart means', () => {
    expect(oneApart('cat', 'cot')).toBe(true);
    expect(oneApart('cat', 'cat')).toBe(false);
    expect(oneApart('cat', 'dog')).toBe(false);
    // Same letters, different places, is not a rung: they stay where they are.
    expect(oneApart('cat', 'act')).toBe(false);
    expect(oneApart('cat', 'cart')).toBe(false);
  });

  it('takes a rung one letter away and refuses everything else', () => {
    const state = game('short', 4);
    const step = state.legalMoves(0).find((move) => move !== TAKE_BACK)!;
    const after = state.apply(step);
    expect(after.here).toBe(step.slice(1));
    expect(after.rungs).toHaveLength(1);
    // Two letters at once, a word that is not on the list, and nonsense.
    expect(() => state.apply(rung(state.start))).toThrow(/Illegal/);
    expect(() => state.apply(rung('zzz'))).toThrow(/Illegal/);
    expect(() => state.apply('nonsense')).toThrow(/Illegal/);
  });

  it('will not step on the same word twice', () => {
    const state = game('short', 4);
    const step = state.legalMoves(0).find((move) => move !== TAKE_BACK)!;
    const after = state.apply(step);
    // Going straight back is stepping on the start again.
    expect(() => after.apply(rung(state.start))).toThrow(/Illegal/);
    expect(after.legalMoves(0)).not.toContain(rung(state.start));
  });

  it('takes a rung back, and not from the ground', () => {
    const state = game('short', 4);
    expect(() => state.apply(TAKE_BACK)).toThrow(/Illegal/);
    const step = state.legalMoves(0).find((move) => move !== TAKE_BACK)!;
    const back = state.apply(step).apply(TAKE_BACK);
    expect(back.rungs).toEqual([]);
    expect(back.here).toBe(state.start);
  });
});

describe('laying a ladder', () => {
  it('lays one at every length, with par the real shortest', { timeout: 120_000 }, () => {
    for (const variant of Object.keys(LADDER_SIZES)) {
      const letters = ladderSizeFor(variant).letters;
      for (let seed = 0; seed < 8; seed++) {
        const state = game(variant, seed);
        expect(state.start).toHaveLength(letters);
        expect(state.target).toHaveLength(letters);
        expect(state.start).not.toBe(state.target);
        // Par is claimed to be the shortest there is, so ask a search that does not know it.
        expect(shortest(state.start, state.target, letters), `${variant} seed ${seed}`).toBe(state.par);
        expect(state.par).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('gives the same ladder for the same seed, and different ones for different seeds', () => {
    const one = game('medium', 12);
    const two = game('medium', 12);
    expect([one.start, one.target]).toEqual([two.start, two.target]);
    const pairs = new Set([1, 2, 3, 4, 5].map((seed) => `${game('medium', seed).start}-${game('medium', seed).target}`));
    expect(pairs.size).toBeGreaterThan(3);
  });
});

describe('word ladder bots', () => {
  it('climb every length, and replay exactly', { timeout: 120_000 }, () => {
    for (const variant of Object.keys(LADDER_SIZES)) {
      for (const tier of BOT_TIERS) {
        const config = { players: 1, variant };
        const bot = wordLadderGame.createBot(tier);
        let state = wordLadderGame.newGame(config, 5) as LadderState;
        const moves: LadderMove[] = [];
        // The wandering tiers can take a long way round, so give them room to get there.
        while (!state.result && moves.length < 400) {
          const move = bot.chooseMove(state, 0, createRng(moves.length + 1));
          moves.push(move);
          state = state.apply(move);
        }
        expect(state.result, `${tier} never got there on ${variant}`).not.toBe(null);
        expect(state.here).toBe(state.target);
        const replayed = replay(wordLadderGame, toMoveLog(wordLadderGame, config, 5, moves)) as LadderState;
        expect(replayed.rungs).toEqual(state.rungs);
      }
    }
  });

  it('the good tiers climb in par', { timeout: 120_000 }, () => {
    for (const variant of Object.keys(LADDER_SIZES)) {
      const bot = wordLadderGame.createBot('expert');
      let state = newWordLadder({ players: 1, variant }, 9);
      const par = state.par;
      while (!state.result) state = state.apply(bot.chooseMove(state, 0, createRng(state.moves + 1)));
      expect(state.rungs.length, `expert took ${state.rungs.length} for a par of ${par} on ${variant}`).toBe(par);
    }
  });
});
