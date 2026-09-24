import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { chineseCheckers, chooseStarMove, holeAt, newStar, STAR_HOLES, STAR_POINTS, STAR_TIERS, StarState, targetOf } from './index';

const empty = (players = 2) => new StarState(players, Array<number>(STAR_HOLES.length).fill(-1), 0, 0, null, null);
const put = (s: StarState, holes: [number, number, number][]) => {
  const board = s.board.slice();
  for (const [q, r, seat] of holes) board[holeAt(q, r)!] = seat;
  return new StarState(s.players, board, s.currentSeat, 0, null, null);
};

describe('chinese checkers', () => {
  it('121 holes, six points of ten, each opposite another', () => {
    expect(STAR_HOLES).toHaveLength(121);
    for (const point of STAR_POINTS) expect(point).toHaveLength(10);
    expect(new Set(STAR_POINTS.flat()).size).toBe(60);
    // Opposite points are mirror images through the middle.
    for (let k = 0; k < 6; k++) {
      for (const p of STAR_POINTS[k]!) {
        const h = STAR_HOLES[p]!;
        expect(STAR_POINTS[targetOf(k)]).toContain(holeAt(-h.q, -h.r));
      }
    }
  });

  it('ten marbles each on their own point', () => {
    for (const players of [2, 3, 4]) {
      const s = newStar(players);
      for (let seat = 0; seat < players; seat++) expect(s.board.filter((b) => b === seat)).toHaveLength(10);
    }
  });

  it('a step goes to a neighbor; a hop goes over one marble; hops chain', () => {
    const s = put(empty(), [[0, 0, 0], [1, 0, 1], [3, 0, 1]]);
    const reach = s.reach(holeAt(0, 0)!);
    expect(reach.has(holeAt(0, 1)!)).toBe(true);
    expect(reach.has(holeAt(2, 0)!)).toBe(true);
    // And on over the second marble in the same turn.
    expect(reach.get(holeAt(4, 0)!)).toEqual([holeAt(0, 0), holeAt(2, 0), holeAt(4, 0)]);
    // No hopping over an empty hole.
    expect(reach.has(holeAt(0, 2)!)).toBe(false);
  });

  it('home is a full target with at least one of yours in it', () => {
    let s = empty();
    const target = STAR_POINTS[targetOf(s.start(0))]!;
    const board = s.board.slice();
    target.forEach((p, i) => (board[p] = i === 0 ? 0 : 1));
    s = new StarState(2, board, 0, 0, null, null);
    expect(s.home(0)).toBe(true);
    const theirs = s.board.slice();
    theirs[target[0]!] = 1;
    expect(new StarState(2, theirs, 0, 0, null, null).home(0)).toBe(false);
  });

  it('bots race home and the tiers come out in order', { timeout: 120_000 }, () => {
    const play = (a: keyof typeof STAR_TIERS, b: keyof typeof STAR_TIERS, games: number) => {
      let wins = 0;
      for (let seed = 0; seed < games; seed++) {
        const rng = createRng(seed);
        const aSeat = seed % 2;
        let s = newStar(2);
        while (!s.result) s = s.apply(chooseStarMove(s, s.currentSeat, STAR_TIERS[s.currentSeat === aSeat ? a : b], rng));
        if (s.result.winners.includes(aSeat)) wins++;
      }
      return wins / games;
    };
    expect(play('medium', 'easy', 12)).toBeGreaterThan(0.6);
  });

  it('the definition deals the right table', () => {
    expect(chineseCheckers.newGame({ players: 3 }, 1)).toEqual(newStar(3));
  });
});

/** Invariant: marbles are never made or lost, and never share a hole. */
describe('chinese checkers invariants', () => {
  it('keeps ten marbles each', { timeout: 60_000 }, () => {
    for (let seed = 0; seed < 8; seed++) {
      const players = [2, 3, 4][seed % 3]!;
      const rng = createRng(seed);
      let s = newStar(players);
      for (let ply = 0; ply < 200 && !s.result; ply++) {
        for (let seat = 0; seat < players; seat++) expect(s.board.filter((b) => b === seat)).toHaveLength(10);
        s = s.apply(rng.pick(s.legalMoves(s.currentSeat)));
      }
    }
  });
});
