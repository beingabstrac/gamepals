import { watchFor } from '../../ads';
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
        {/* A toggle: the highlight and aria-pressed say whether notes are on, so the word "off"
            (which read like an instruction to turn them off) is gone. */}
        <button class={ui.notes ? 'tool on' : 'tool'} aria-pressed={ui.notes} onClick={() => ui.toggleNotes()}>
          Notes
        </button>
        <button
          class="tool"
          onClick={() => {
            // Out of hints: Pro gets one anyway, everybody else is asked whether they want to
            // watch for it. Nothing is ever taken without asking (docs/08 M10).
            if (state.hintsLeft > 0) ui.hint();
            else void watchFor('sudoku hint').then((earned) => earned && ui.hint());
          }}
          aria-label={state.hintsLeft > 0 ? `Hint, ${state.hintsLeft} left` : 'Hint, watch to earn one'}
        >
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
