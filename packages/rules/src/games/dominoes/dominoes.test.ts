import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import type { BotTier, Seat } from '../../core/types';
import { DOMINO_LEVELS, DOMINO_TILES, dominoes, DominoState, handSize, newDominoes, pipsOf, playTile, tileIndex, type DominoLevel, type DominoMove, type Placed } from './index';

const T = (a: number, b: number) => tileIndex(a, b);

/** A hand in progress: hands, the line, the boneyard, seat to move. */
function table(hands: number[][], line: Placed[], boneyard: number[] = [], seat: Seat = 0, level: DominoLevel = 'draw-100', scores?: number[]): DominoState {
  const missing = hands.map(() => [] as number[]);
  return new DominoState(level, 1, 0, hands, boneyard, line, seat, scores ?? hands.map(() => 0), 0, missing, 'play', null, null);
}

describe('dominoes set and deal', () => {
  it('has 28 tiles, every pair once', () => {
    expect(DOMINO_TILES).toHaveLength(28);
    expect(new Set(DOMINO_TILES.map(([a, b]) => `${a}-${b}`)).size).toBe(28);
    expect(DOMINO_TILES.filter(([a, b]) => a === b)).toHaveLength(7);
  });

  it('deals the right number of tiles', () => {
    const two = newDominoes(2, 5);
    expect(two.hands.map((h) => h.length)).toEqual([7, 7]);
    expect(two.boneyard).toHaveLength(14);
    expect(handSize('draw-100', 4)).toBe(5);
    expect(handSize('block-100', 3)).toBe(6);
    const all = [...two.hands.flat(), ...two.boneyard];
    expect(new Set(all).size).toBe(28);
  });

  it('the highest double opens, and only that tile may be played', () => {
    for (let seed = 1; seed < 20; seed++) {
      const state = newDominoes(3, seed);
      const doubles = state.hands.flat().filter((t) => DOMINO_TILES[t]![0] === DOMINO_TILES[t]![1]);
      if (!doubles.length) continue;
      const highest = doubles.reduce((a, b) => (pipsOf(b) > pipsOf(a) ? b : a));
      expect(state.hands[state.currentSeat]).toContain(highest);
      expect(state.legalMoves(state.currentSeat)).toEqual([playTile(highest, 'L')]);
    }
  });
});

describe('dominoes play', () => {
  it('tiles only go on matching ends, and the ends move', () => {
    const state = table([[T(6, 3), T(2, 2)], [T(1, 1)]], [{ tile: T(6, 6), left: 6, right: 6 }]);
    // Both ends are 6, so one choice is enough; the 2-2 fits nowhere.
    expect(state.legalMoves(0)).toEqual([playTile(T(6, 3), 'L')]);
    const after = state.apply(playTile(T(6, 3), 'L'));
    expect(after.ends).toEqual([3, 6]);
    expect(after.currentSeat).toBe(1);
    expect(() => state.apply(playTile(T(2, 2), 'L'))).toThrow();
  });

  it('plays on either end when a tile fits both', () => {
    const state = table([[T(3, 5), T(0, 0)], [T(1, 1)]], [{ tile: T(3, 4), left: 3, right: 4 }, { tile: T(4, 5), left: 4, right: 5 }]);
    expect([...state.legalMoves(0)].sort()).toEqual([playTile(T(3, 5), 'L'), playTile(T(3, 5), 'R')].sort());
    const right = state.apply(playTile(T(3, 5), 'R'));
    expect(right.ends).toEqual([3, 3]);
  });

  it('in the Block game you pass; in the Draw game you draw until you can play', () => {
    const line = [{ tile: T(6, 6), left: 6, right: 6 }];
    expect(table([[T(1, 2)], [T(0, 0)]], line, [T(6, 1)], 0, 'block-100').legalMoves(0)).toEqual(['pass']);
    const draw = table([[T(1, 2)], [T(0, 0)]], line, [T(0, 1), T(6, 1)]);
    expect(draw.legalMoves(0)).toEqual(['draw']);
    const once = draw.apply('draw');
    expect(once.hands[0]).toContain(T(0, 1));
    expect(once.currentSeat).toBe(0);
    expect(once.missing[0]).toContain(6);
    const twice = once.apply('draw');
    expect(twice.legalMoves(0)).toEqual([playTile(T(6, 1), 'L')]);
    // Nothing left to draw: pass.
    expect(table([[T(1, 2)], [T(0, 0)]], line, []).legalMoves(0)).toEqual(['pass']);
  });

  it("going out wins the hand and scores everyone else's pips", () => {
    const state = table([[T(6, 3)], [T(5, 5), T(1, 0)]], [{ tile: T(6, 6), left: 6, right: 6 }]);
    const after = state.apply(playTile(T(6, 3), 'L'));
    expect(after.phase).toBe('handOver');
    expect(after.scores).toEqual([11, 0]);
    expect(after.last).toMatchObject({ kind: 'handEnd', winner: 0, points: 11, blocked: false });
    expect(after.legalMoves(0)).toEqual(['deal']);
    const dealt = after.apply('deal');
    expect(dealt.hand).toBe(1);
    expect(dealt.line).toEqual([]);
    expect(dealt.scores).toEqual([11, 0]);
  });

  it('a blocked hand goes to the lightest hand, scoring the difference', () => {
    const line = [{ tile: T(6, 6), left: 6, right: 6 }];
    const state = table([[T(1, 2)], [T(4, 5)]], line, [], 0, 'block-100');
    const after = state.apply('pass').apply('pass');
    expect(after.last).toMatchObject({ kind: 'handEnd', winner: 0, points: 9 - 3, blocked: true });
    expect(after.scores).toEqual([6, 0]);
    // A tie for lightest scores nothing.
    const tied = table([[T(1, 2)], [T(0, 3)]], line, [], 0, 'block-100').apply('pass').apply('pass');
    expect(tied.last).toMatchObject({ kind: 'handEnd', winner: null, points: 0 });
  });

  it('the match ends when someone reaches the target', () => {
    const state = table([[T(6, 3)], [T(5, 5), T(1, 0)]], [{ tile: T(6, 6), left: 6, right: 6 }], [], 0, 'draw-50', [45, 20]);
    const after = state.apply(playTile(T(6, 3), 'L'));
    expect(after.scores).toEqual([56, 20]);
    expect(after.result).toEqual({ winners: [0], draw: false });
  });
});

function playMatch(tiers: BotTier[], seed: number, level: DominoLevel): { state: DominoState; moves: DominoMove[] } {
  const bots = tiers.map((tier) => dominoes.createBot(tier));
  const rng = createRng(seed * 3 + 7);
  let state = dominoes.newGame({ players: tiers.length, variant: level }, seed) as DominoState;
  const moves: DominoMove[] = [];
  while (!state.result && moves.length < 3000) {
    const move = bots[state.currentSeat]!.chooseMove(state, state.currentSeat, rng);
    expect(state.legalMoves(state.currentSeat)).toContain(move);
    moves.push(move);
    state = state.apply(move);
  }
  return { state, moves };
}

describe('dominoes bots', () => {
  it('play whole matches with only legal moves, and replay exactly', () => {
    const games: [BotTier[], DominoLevel][] = [
      [['easy', 'medium'], 'draw-50'],
      [['hard', 'easy', 'medium'], 'block-50'],
      [['medium', 'hard', 'easy', 'hard'], 'draw-50'],
    ];
    games.forEach(([tiers, level], i) => {
      const { state, moves } = playMatch(tiers, 30 + i, level);
      expect(state.result?.winners).toHaveLength(1);
      const replayed = replay(dominoes, toMoveLog(dominoes, { players: tiers.length, variant: level }, 30 + i, moves)) as DominoState;
      expect(replayed.scores).toEqual(state.scores);
    });
  });

  it('bots only look at their own tiles: hidden hands can change without changing the choice', () => {
    const bot = dominoes.createBot('hard');
    const line = [{ tile: T(6, 6), left: 6, right: 6 }];
    const a = table([[T(6, 1), T(6, 2), T(3, 3)], [T(0, 0), T(1, 1)]], line);
    const b = table([[T(6, 1), T(6, 2), T(3, 3)], [T(4, 4), T(2, 5)]], line);
    expect(bot.chooseMove(a, 0, createRng(1))).toBe(bot.chooseMove(b, 0, createRng(1)));
  });

  it('Nova beats Pip', { timeout: 120_000 }, () => {
    let wins = 0;
    for (let game = 0; game < 6; game++) {
      const novaSeat = game % 2;
      const { state } = playMatch(novaSeat === 0 ? ['expert', 'easy'] : ['easy', 'expert'], 60 + game, 'draw-50');
      if (state.result?.winners[0] === novaSeat) wins++;
    }
    expect(wins).toBeGreaterThan(3);
  });
});

/**
 * Twenty-eight tiles, once each, spread between the hands, the line and the boneyard. A tile in
 * two places at once, or in none, is the kind of thing a shuffle or a draw gets wrong quietly.
 */
describe('dominoes conservation', () => {
  it('keeps all twenty-eight tiles, once each', () => {
    for (const level of DOMINO_LEVELS) {
      for (let seed = 0; seed < 8; seed++) {
        const rng = createRng(seed);
        let state = newDominoes(2 + (seed % 3), seed, level);
        for (let move = 0; move < 300 && !state.result; move++) {
          const all = [...state.hands.flat(), ...state.line.map((p) => p.tile), ...state.boneyard];
          expect(all.length, `${level}, seed ${seed}, move ${move}`).toBe(DOMINO_TILES.length);
          expect(new Set(all).size, `${level}, seed ${seed}, move ${move}`).toBe(DOMINO_TILES.length);
          const moves = state.legalMoves(state.currentSeat);
          if (moves.length === 0) break;
          state = state.apply(rng.pick(moves));
        }
      }
    }
  });
});
