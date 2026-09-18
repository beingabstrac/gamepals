import { PYRAMID_UNDO, pyramidHint, type PyramidMove, type PyramidState } from '@gamepals/rules';
import { useEffect, useState } from 'preact/hooks';
import type { Session } from '../../session';
import { hintBusFor } from '../cards/hintBus';

/** Undo and hint. Everything else happens by tapping cards. */
export function PyramidControls({ session }: { session: Session<PyramidMove> }) {
  const bus = hintBusFor(session);
  const state = session.state as PyramidState;
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => setMessage(null), [state]);
  if (state.result) return null;

  const hint = () => {
    const move = pyramidHint(state);
    if (!move) {
      setMessage('Nothing left to take. Try Undo, or start a new deal.');
      return;
    }
    bus.hint(move);
  };

  return (
    <div class="sudoku-controls">
      {message && <p class="hint-bubble">💡 {message}</p>}
      <div class="sudoku-tools">
        <button class="tool" disabled={state.history.length === 0} onClick={() => session.play(PYRAMID_UNDO)}>
          Undo
        </button>
        <button class="tool" onClick={hint}>
          Hint
        </button>
      </div>
    </div>
  );
}
