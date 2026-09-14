import { UNDO_POUR, type ColorSortMove, type ColorSortState } from '@gamepals/rules';
import { useEffect, useState } from 'preact/hooks';
import type { Session } from '../../session';
import { colorSortUiFor } from './ui';

/** Undo and Hint under the tubes. */
export function ColorSortControls({ session }: { session: Session<ColorSortMove> }) {
  const ui = colorSortUiFor(session);
  const state = session.state as ColorSortState;
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => setMessage(null), [state]);
  if (state.result) return null;

  const hint = () => {
    const move = state.hint();
    if (!move) {
      setMessage('No way forward from here. Undo a few pours.');
      return;
    }
    ui.hint(move);
  };

  return (
    <div class="sudoku-controls">
      {message && <p class="hint-bubble">💡 {message}</p>}
      <div class="sudoku-tools">
        <button class="tool" disabled={!state.previous} onClick={() => session.play(UNDO_POUR)}>
          Undo
        </button>
        <button class="tool" onClick={hint}>
          Hint
        </button>
      </div>
    </div>
  );
}
