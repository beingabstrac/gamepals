import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { replay } from '../../core/replay';
import { newSwitchBoard, SB_DIAL_MAX, SB_SLIDER_MAX, switchBoard } from './index';

describe('switch board', () => {
  it('every control clicks: a toggle flips, a slider and a dial take a setting, a button counts, the lever throws', () => {
    let s = newSwitchBoard();
    s = s.apply('t1').apply('s2.7').apply('d0.4').apply('b3').apply('b3').apply('lever');
    expect(s.board.toggles[1]).toBe(true);
    expect(s.board.sliders[2]).toBe(7);
    expect(s.board.dials[0]).toBe(4);
    expect(s.board.presses[3]).toBe(2);
    expect(s.board.lever).toBe(true);
    expect(s.clicks).toBe(6);
    expect(s.apply('t1').board.toggles[1]).toBe(false);
  });

  it('a lamp lights for each control that is on, and all of them on goes rainbow', () => {
    let s = newSwitchBoard();
    expect(s.lit).toBe(0);
    s = s.apply('t0').apply('b0');
    expect(s.lit).toBe(2);
    const rng = createRng(1);
    const bot = switchBoard.createBot('easy');
    while (!s.result && !s.rainbow) s = s.apply(bot.chooseMove(s, 0, rng)) as typeof s;
    expect(s.rainbow).toBe(true);
    expect(s.lit).toBe(14);
  });

  it('setting a slider or dial to where it already is, or past its end, is not a move', () => {
    const s = newSwitchBoard();
    expect(() => s.apply('s0.0')).toThrow();
    expect(() => s.apply(`s0.${SB_SLIDER_MAX + 1}`)).toThrow();
    expect(() => s.apply(`d1.${SB_DIAL_MAX + 1}`)).toThrow();
  });

  it('done finishes it, and the referee replays the whole board', () => {
    const rng = createRng(2);
    const bot = switchBoard.createBot('easy');
    let s = switchBoard.newGame({ players: 1 }, 2);
    const moves: string[] = [];
    while (!s.result) {
      const m = bot.chooseMove(s, 0, rng);
      moves.push(m);
      s = s.apply(m);
    }
    expect(s.result).toEqual({ winners: [0], draw: false });
    expect(replay(switchBoard, { gameId: 'switch-board', seed: 2, config: { players: 1 }, moves }).result).toEqual(s.result);
  });
});
