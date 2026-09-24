import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { replay } from '../../core/replay';
import type { BotTier } from '../../core/types';
import { chooseSixMove, connectSix, newConnectSix, SIX_TIERS, SixState, sixMove, sixSeatOf } from './index';

const N = 15;
const at = (x: number, y: number) => y * N + x;
/** A board with black stones at `blacks` and white at `whites`, `stones` placed so far. */
const board = (blacks: number[], whites: number[], stones: number) => {
  const b = Array<number>(N * N).fill(0);
  for (const c of blacks) b[c] = 1;
  for (const c of whites) b[c] = 2;
  return new SixState(N, b, stones, null, null, []);
};

describe('connect six', () => {
  it('Black puts down one stone, then two each a turn', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(sixSeatOf)).toEqual([0, 1, 1, 0, 0, 1, 1]);
    let s = newConnectSix();
    s = s.apply(sixMove(at(7, 7)));
    expect(s.currentSeat).toBe(1);
    expect(s.left).toBe(2);
    s = s.apply(sixMove(at(8, 8)));
    expect(s.currentSeat).toBe(1);
    expect(s.left).toBe(1);
    s = s.apply(sixMove(at(9, 9)));
    expect(s.currentSeat).toBe(0);
    expect(() => s.apply(sixMove(at(9, 9)))).toThrow();
  });

  it('six in a row wins, seven too, five does not', () => {
    const row = (k: number) => Array.from({ length: k }, (_, i) => at(2 + i, 5));
    // Stones 7, 8, 11 and 12 are Black's.
    const b5 = board(row(4), [at(0, 0), at(0, 1), at(0, 2)], 7).apply(sixMove(at(6, 5)));
    expect(b5.result).toBeNull();
    const b6 = board(row(5), [at(0, 0), at(0, 1), at(0, 2), at(0, 3)], 11).apply(sixMove(at(7, 5)));
    expect(b6.result?.winners).toEqual([0]);
    expect(b6.line.length).toBe(6);
    const seven = board([...row(3), at(6, 5), at(7, 5), at(8, 5)], [at(0, 0), at(0, 1), at(0, 2), at(0, 3), at(0, 4)], 11).apply(sixMove(at(5, 5)));
    expect(seven.result?.winners).toEqual([0]);
    expect(seven.line.length).toBe(7);
  });

  it('a bot with two stones finishes a four, and blocks one of theirs', () => {
    const rng = createRng(1);
    // White to move with two stones; White has four in a row open.
    const win = board([at(1, 1), at(1, 2), at(1, 3), at(9, 9), at(10, 9)], [at(3, 7), at(4, 7), at(5, 7), at(6, 7)], 9);
    expect(win.currentSeat).toBe(1);
    expect(win.left).toBe(2);
    const m1 = chooseSixMove(win, SIX_TIERS.medium, rng);
    const after = win.apply(m1);
    const m2 = chooseSixMove(after, SIX_TIERS.medium, rng);
    expect(after.apply(m2).result?.winners).toEqual([1]);
    // Black has four open; White (with no threat of its own) must put a stone in that window.
    const block = board([at(3, 7), at(4, 7), at(5, 7), at(6, 7), at(12, 12)], [at(1, 1), at(13, 2), at(1, 13), at(10, 3)], 9);
    const b = Number(chooseSixMove(block, SIX_TIERS.medium, rng).slice(1));
    expect([at(1, 7), at(2, 7), at(7, 7), at(8, 7)]).toContain(b);
  });

  it('bot tiers line up: each beats the one below', { timeout: 120_000 }, () => {
    const tiers: BotTier[] = ['easy', 'medium', 'hard', 'expert'];
    for (let i = 0; i < 3; i++) {
      const [low, high] = [tiers[i]!, tiers[i + 1]!];
      let wins = 0;
      let losses = 0;
      const games = 16;
      for (let g = 0; g < games; g++) {
        const seats = g % 2 === 0 ? [high, low] : [low, high];
        const bots = seats.map((t) => connectSix.createBot(t));
        const rng = createRng(300 + g);
        let s = newConnectSix();
        while (!s.result) s = s.apply(bots[s.currentSeat]!.chooseMove(s, s.currentSeat, rng));
        if (s.result.draw) continue;
        if (seats[s.result.winners[0]!] === high) wins++;
        else losses++;
      }
      // Two good players often draw at this game, so the test is wins against losses.
      expect(wins, `${high} over ${low}: ${wins} wins, ${losses} losses`).toBeGreaterThan(losses * 2);
      expect(wins, `${high} over ${low}: ${wins} wins of ${games}`).toBeGreaterThanOrEqual(6);
    }
  });

  it('the referee replays a game', () => {
    let s = connectSix.newGame({ players: 2 }, 2);
    const bot = connectSix.createBot('medium');
    const rng = createRng(2);
    const moves: string[] = [];
    while (!s.result) {
      const m = bot.chooseMove(s, s.currentSeat, rng);
      moves.push(m);
      s = s.apply(m);
    }
    expect(replay(connectSix, { gameId: 'connect-six', seed: 2, config: { players: 2 }, moves }).result).toEqual(s.result);
  });
});
