import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { replay } from '../../core/replay';
import { CHIMES, newChimes, windChimes } from './index';

describe('wind chimes', () => {
  it('each tube counts once; a tube that is not there is not a move', () => {
    const s = newChimes().apply('r2');
    expect(s.rung[2]).toBe(true);
    expect(s.last).toBe(2);
    expect(() => s.apply('r2')).toThrow();
    expect(() => s.apply(`r${CHIMES}`)).toThrow();
    expect(s.legalMoves(0).length).toBe(CHIMES - 1);
  });

  it('every tube rung is done; test play gets there and the referee replays it', () => {
    let s = windChimes.newGame({ players: 1 }, 1);
    const bot = windChimes.createBot('easy');
    const rng = createRng(1);
    const moves: string[] = [];
    while (!s.result) {
      const m = bot.chooseMove(s, 0, rng);
      moves.push(m);
      s = s.apply(m);
    }
    expect(moves.length).toBe(CHIMES);
    expect(replay(windChimes, { gameId: 'wind-chimes', seed: 1, config: { players: 1 }, moves }).result).toEqual(s.result);
  });
});
