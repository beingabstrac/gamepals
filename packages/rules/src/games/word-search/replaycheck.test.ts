import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { newWordSearch, searchLine, wordSearchGame, type SearchState } from './index';

describe('a drag from the far end and the referee', () => {
  it('replays a word taken backwards', () => {
    const state = newWordSearch({ players: 1, variant: 'medium' }, 3) as SearchState;
    const word = state.words[0]!;
    // Find where it sits, then drag it the other way, which the rules accept at the table.
    let found: { r: number; c: number; r2: number; c2: number } | undefined;
    const ways = [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]] as const;
    for (let r = 0; r < state.side && !found; r++) {
      for (let c = 0; c < state.side && !found; c++) {
        for (const [dr, dc] of ways) {
          const r2 = r + dr * (word.length - 1);
          const c2 = c + dc * (word.length - 1);
          if (state.read(r, c, r2, c2) === word) {
            found = { r, c, r2, c2 };
            break;
          }
        }
      }
    }
    const backwards = searchLine(found!.r2, found!.c2, found!.r, found!.c);
    expect(() => state.apply(backwards)).not.toThrow();
    const log = toMoveLog(wordSearchGame, { players: 1, variant: 'medium' }, 3, [backwards]);
    expect(() => replay(wordSearchGame, log)).not.toThrow();
  });
});
