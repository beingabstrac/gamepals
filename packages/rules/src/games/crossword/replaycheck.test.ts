import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { CHECK, crosswordGame, newCrossword, rubOut, writeIn } from './index';

describe('a wrong letter and the referee', () => {
  it('replays a game where somebody typed the wrong letter and fixed it', () => {
    const state = newCrossword(3);
    let row = 0;
    let col = 0;
    while (state.blockAt(row, col)) col++;
    const right = state.answer[row]![col]!;
    const wrong = right === 'z' ? 'q' : 'z';
    // Type a wrong letter, ask, rub it out, type the right one. That is a game, not an edge case.
    const moves = [writeIn(row, col, wrong), CHECK, rubOut(row, col), writeIn(row, col, right)];
    let walked = state;
    for (const move of moves) walked = walked.apply(move);
    expect(walked.letterAt(row, col)).toBe(right);
    const log = toMoveLog(crosswordGame, { players: 1 }, 3, moves);
    expect(() => replay(crosswordGame, log)).not.toThrow();
  });
});
