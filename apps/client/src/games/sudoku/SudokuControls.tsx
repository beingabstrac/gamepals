import { HINT_MOVE, type SudokuMove, type SudokuState } from '@gamepals/rules';
import { useEffect, useState } from 'preact/hooks';
import type { Session } from '../../session';
import { uiFor } from './ui';

/** Undo, erase, notes and hint, then the big number pad. */
export function SudokuControls({ session }: { session: Session<SudokuMove> }) {
  const ui = uiFor(session);
  const [, setTick] = useState(0);
  useEffect(() => ui.subscribe(() => setTick((t) => t + 1)), [ui]);

  const state = session.state as SudokuState;
  if (state.result) return null;
  const placed = (digit: number) => state.values.filter((v) => v === digit).length;
  const hint = session.moves[session.moves.length - 1] === HINT_MOVE ? state.lastHint : null;

  return (
    <div class="sudoku-controls">
      {hint && (
        <p class="hint-bubble" key={state.hintsLeft}>
          💡 {hint.reason}
        </p>
      )}
      <div class="sudoku-tools">
        <button class="tool" disabled={!state.previous} onClick={() => ui.undo()}>
          Undo
        </button>
        <button class="tool" onClick={() => ui.erase()}>
          Erase
        </button>
        <button class={ui.notes ? 'tool on' : 'tool'} aria-pressed={ui.notes} onClick={() => ui.toggleNotes()}>
          Notes {ui.notes ? 'on' : 'off'}
        </button>
        <button class="tool" disabled={state.hintsLeft === 0} onClick={() => ui.hint()} aria-label={`Hint, ${state.hintsLeft} left`}>
          Hint <span class="badge">{state.hintsLeft}</span>
        </button>
      </div>
      <div class={ui.notes ? 'pad notes' : 'pad'}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => {
          const left = Math.max(0, 9 - placed(digit));
          return (
            <button key={digit} class={left === 0 ? 'pad-key done' : 'pad-key'} onClick={() => ui.enter(digit)} aria-label={`${digit}, ${left} left`}>
              <span class="pad-digit">{digit}</span>
              <span class="pad-left">{left}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
