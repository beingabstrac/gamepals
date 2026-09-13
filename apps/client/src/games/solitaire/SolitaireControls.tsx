import { DRAW_MOVE, suggestMove, UNDO_CARD_MOVE, type SolitaireMove, type SolitaireState } from '@gamepals/rules';
import { useEffect, useState } from 'preact/hooks';
import type { Session } from '../../session';
import { solitaireUiFor } from './ui';

/** Undo, hint, and Finish once every card is face up. */
export function SolitaireControls({ session }: { session: Session<SolitaireMove> }) {
  const ui = solitaireUiFor(session);
  const state = session.state as SolitaireState;
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => setMessage(null), [state]);
  if (state.result) return null;

  const hint = () => {
    const move = suggestMove(state);
    if (!move) {
      setMessage('No more useful moves. Try Undo, or start a new deal.');
      return;
    }
    ui.hint(move);
    if (move === DRAW_MOVE) setMessage(state.stock.length ? 'Tap the deck to draw.' : 'Tap the empty deck spot to turn the cards over.');
  };

  const finish = () => {
    const step = () => {
      const current = session.state as SolitaireState;
      const move = current.result ? null : suggestMove(current);
      if (!move) return;
      session.play(move);
      setTimeout(step, 110);
    };
    step();
  };

  return (
    <div class="sudoku-controls">
      {message && <p class="hint-bubble">💡 {message}</p>}
      <div class="sudoku-tools">
        <button class="tool" disabled={!state.previous} onClick={() => session.play(UNDO_CARD_MOVE)}>
          Undo
        </button>
        <button class="tool" onClick={hint}>
          Hint
        </button>
        {state.canFinish() && (
          <button class="tool on" onClick={finish}>
            Finish
          </button>
        )}
      </div>
    </div>
  );
}
