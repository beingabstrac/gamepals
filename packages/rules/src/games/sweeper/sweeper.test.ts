import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng, type Rng } from '../../core/rng';
import {
  chordMove,
  deduce,
  flagMove,
  layMines,
  neighboursOf,
  newSweeper,
  revealMove,
  sweeper,
  SWEEPER_LEVELS,
  SWEEPER_SIZES,
  SweeperState,
  type SweeperLevel,
  type SweeperMove,
} from './index';

/** A board laid by hand: `x` is a mine, `.` is not. The first square counts as already chosen. */
function boardOf(rows: string[], level: SweeperLevel = 'easy'): SweeperState {
  const h = rows.length;
  const w = rows[0]!.length;
  const mines = rows.join('').split('').map((c) => c === 'x');
  const counts = mines.map((_, cell) => neighboursOf(w, h, cell).filter((n) => mines[n]).length);
  const blank = mines.map(() => false);
  return new SweeperState(level, 1, w, h, mines.filter(Boolean).length, mines, counts, blank, blank, null, null, []);
}

/** An rng that refuses to be used: a bot that reaches for it had to guess. */
const noGuessing: Rng = {
  next: () => {
    throw new Error('the bot had to guess');
  },
  int: () => {
    throw new Error('the bot had to guess');
  },
  pick: () => {
    throw new Error('the bot had to guess');
  },
};

describe('sweeper setup', () => {
  it('lays nothing until the first square is uncovered', () => {
    const state = newSweeper(3, 'easy');
    expect(state.mines).toBeNull();
    expect(state.minesLeft).toBe(10);
    expect(state.legalMoves(0).filter((m) => m[0] === 'r')).toHaveLength(80);
    expect(state.legalMoves(0).some((m) => m[0] === 'c')).toBe(false);
  });

  it('never puts a mine on the first square or its ring, and the first tap always opens a region', () => {
    for (const level of SWEEPER_LEVELS) {
      const { w, h, mines } = SWEEPER_SIZES[level];
      for (let seed = 0; seed < 10; seed++) {
        for (const first of [0, w - 1, (h - 1) * w, w * h - 1, Math.floor(h / 2) * w + Math.floor(w / 2)]) {
          const state = newSweeper(seed, level).apply(revealMove(first));
          expect(state.result, `${level} seed ${seed} first ${first}`).not.toEqual({ winners: [], draw: false });
          expect(state.mines!.filter(Boolean)).toHaveLength(mines);
          for (const cell of [first, ...neighboursOf(w, h, first)]) expect(state.mines![cell]).toBe(false);
          expect(state.counts![first]).toBe(0);
          expect(state.last.length, `${level} seed ${seed} first ${first}`).toBeGreaterThan(1);
        }
      }
    }
  });

  it('shows how many of its neighbours are mines', () => {
    const state = newSweeper(7, 'medium').apply(revealMove(70));
    state.counts!.forEach((count, cell) => {
      expect(count).toBe(neighboursOf(state.w, state.h, cell).filter((n) => state.mines![n]).length);
    });
  });
});

describe('sweeper rules', () => {
  it('opens outward through zeros and stops at numbers', () => {
    const state = boardOf(['....', '....', '..x.', '....']).apply(revealMove(0));
    // The seven zeros open, and so do the five numbers they touch. The three numbers on the far
    // side of the mine (11, 14, 15) touch no zero and stay covered.
    expect(state.open.filter(Boolean)).toHaveLength(12);
    expect(state.open[5]).toBe(true); // a 1, reached from the zeros
    expect(state.open[15]).toBe(false); // a 1 behind the mine, not reachable through zeros
    expect(state.result).toBeNull();
  });

  it('a flag stops a flood and cannot be uncovered while it is up', () => {
    const board = boardOf(['....', '....', '..x.', '....']).apply(flagMove(1));
    expect(board.legalMoves(0)).not.toContain(revealMove(1));
    const opened = board.apply(revealMove(0));
    expect(opened.open[1]).toBe(false);
    expect(opened.flags[1]).toBe(true);
  });

  it('unflags on a second flag, and counts mines left against the flags', () => {
    let state = boardOf(['x..', '...', '...']);
    expect(state.minesLeft).toBe(1);
    state = state.apply(flagMove(4)).apply(flagMove(8));
    expect(state.minesLeft).toBe(-1);
    state = state.apply(flagMove(4));
    expect(state.flags[4]).toBe(false);
    expect(state.minesLeft).toBe(0);
  });

  it('a chord on a finished number uncovers its other neighbours', () => {
    let state = boardOf(['x...', '....', '....']).apply(revealMove(5));
    expect(state.counts![5]).toBe(1);
    expect(state.legalMoves(0)).not.toContain(chordMove(5));
    state = state.apply(flagMove(0));
    expect(state.legalMoves(0)).toContain(chordMove(5));
    state = state.apply(chordMove(5));
    for (const n of neighboursOf(state.w, state.h, 5)) if (n !== 0) expect(state.open[n]).toBe(true);
    // On a board this small the sweep reaches zeros that open everything else, so it finishes it.
    expect(state.result).toEqual({ winners: [0], draw: false });
  });

  it('a chord onto a wrong flag uncovers the mine it was hiding, and loses', () => {
    let state = boardOf(['x...', '....', '....']).apply(revealMove(5));
    state = state.apply(flagMove(1)).apply(chordMove(5));
    expect(state.result).toEqual({ winners: [], draw: false });
    expect(state.boom).toBe(0);
    expect(state.open[0]).toBe(true);
  });

  it('uncovering a mine loses, and marks which one', () => {
    const state = boardOf(['x..', '...', '..x']).apply(revealMove(8));
    expect(state.result).toEqual({ winners: [], draw: false });
    expect(state.boom).toBe(8);
    expect(state.legalMoves(0)).toEqual([]);
    expect(() => state.apply(revealMove(4))).toThrow();
  });

  it('wins when every safe square is uncovered, with no flags needed', () => {
    let state = boardOf(['x.', '..']);
    for (const cell of [1, 2, 3]) state = state.apply(revealMove(cell));
    expect(state.result).toEqual({ winners: [0], draw: false });
    expect(state.flags.every((f) => !f)).toBe(true);
  });

  it('lists exactly what it accepts', () => {
    let state = newSweeper(12, 'easy').apply(revealMove(44)) as SweeperState;
    state = state.apply(state.legalMoves(0).find((m) => m[0] === 'f')!);
    const legal = new Set(state.legalMoves(0));
    for (let cell = 0; cell < state.cells; cell++) {
      for (const move of [revealMove(cell), flagMove(cell), chordMove(cell)]) {
        if (legal.has(move)) expect(() => state.apply(move), move).not.toThrow();
        else expect(() => state.apply(move), move).toThrow();
      }
    }
  });
});

describe('sweeper boards', () => {
  it('never needs a guess: the bot wins every board of every size without once picking at random', { timeout: 120_000 }, () => {
    // The bot only ever looks at what a person can see, since `deduce` reads the numbers on
    // uncovered squares and never the mines. Winning without touching the rng is therefore a board
    // that logic alone could finish, which is the promise the brief makes.
    const bot = sweeper.createBot('expert');
    for (const level of SWEEPER_LEVELS) {
      for (let seed = 0; seed < 25; seed++) {
        let state = sweeper.newGame({ players: 1, variant: level }, seed) as SweeperState;
        for (let guard = 0; !state.result && guard < 2000; guard++) {
          const move = bot.chooseMove(state, 0, noGuessing);
          expect(state.legalMoves(0)).toContain(move);
          state = state.apply(move);
        }
        expect(state.result, `${level} seed ${seed}`).toEqual({ winners: [0], draw: false });
      }
    }
  });

  it('proves nothing it cannot see', () => {
    // Two boards that look the same from the uncovered squares must give the same answer.
    const a = boardOf(['x...', '....', '....', '...x']).apply(revealMove(10));
    const b = boardOf(['x...', '....', '....', '..x.']).apply(revealMove(10));
    expect(a.open).toEqual(b.open);
    const seenA = deduce(a.w, a.h, a.open, a.counts!.map((c, i) => (a.open[i] ? c : -1)));
    const seenB = deduce(b.w, b.h, b.open, b.counts!.map((c, i) => (b.open[i] ? c : -1)));
    expect(seenA).toEqual(seenB);
  });

  it('the same seed and the same taps give the same board, and games replay exactly', () => {
    expect(layMines(40, 'hard', 100)).toEqual(layMines(40, 'hard', 100));
    expect(layMines(40, 'hard', 100)).not.toEqual(layMines(41, 'hard', 100));
    const moves: SweeperMove[] = [revealMove(46), flagMove(0)];
    let state = sweeper.newGame({ players: 1, variant: 'medium' }, 9) as SweeperState;
    for (const move of moves) state = state.apply(move);
    const again = replay(sweeper, toMoveLog(sweeper, { players: 1, variant: 'medium' }, 9, moves)) as SweeperState;
    expect(again.mines).toEqual(state.mines);
    expect(again.open).toEqual(state.open);
    expect(again.flags).toEqual(state.flags);
  });

  it('lays boards quickly enough to do it on the first tap', () => {
    const rng = createRng(5);
    const started = Date.now();
    for (let i = 0; i < 20; i++) layMines(rng.int(1_000_000), 'hard', rng.int(216));
    expect(Date.now() - started).toBeLessThan(2000);
  });
});
