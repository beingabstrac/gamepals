import { freeCellHint, FREECELL_UNDO, type FreeCellMove, type FreeCellState } from '@gamepals/rules';
import { useEffect, useState } from 'preact/hooks';
import type { Session } from '../../session';
import { hintBusFor } from '../cards/hintBus';

/** Undo and hint. Every card is already face up, so there is nothing else to ask for. */
export function FreeCellControls({ session }: { session: Session<FreeCellMove> }) {
  const bus = hintBusFor(session);
  const state = session.state as FreeCellState;
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => setMessage(null), [state]);
  if (state.result) return null;

  const hint = () => {
    const move = freeCellHint(state);
    if (!move) {
      setMessage('Nothing useful left. Try Undo, or start a new deal.');
      return;
    }
    bus.hint(move);
  };

  return (
    <div class="sudoku-controls">
      {message && <p class="hint-bubble">💡 {message}</p>}
      <div class="sudoku-tools">
        <button class="tool" disabled={state.history.length === 0} onClick={() => session.play(FREECELL_UNDO)}>
          Undo
        </button>
        <button class="tool" onClick={hint}>
          Hint
        </button>
      </div>
    </div>
  );
}
