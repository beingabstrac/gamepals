import { SPIDER_DEAL, SPIDER_UNDO, spiderHint, type SpiderMove, type SpiderState } from '@gamepals/rules';
import { useEffect, useState } from 'preact/hooks';
import type { Session } from '../../session';
import { hintBusFor } from '../cards/hintBus';

/** Undo, hint, and a Deal button for people who would rather not aim at the deck. */
export function SpiderControls({ session }: { session: Session<SpiderMove> }) {
  const bus = hintBusFor(session);
  const state = session.state as SpiderState;
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => setMessage(null), [state]);
  if (state.result) return null;

  const canDeal = state.legalMoves(0).includes(SPIDER_DEAL);
  const hint = () => {
    const move = spiderHint(state);
    if (!move) {
      setMessage('Nothing left to move. Try Undo, or start a new deal.');
      return;
    }
    bus.hint(move);
    if (move === SPIDER_DEAL) setMessage('Nothing good on the board. Deal a new row.');
  };

  return (
    <div class="sudoku-controls">
      {message && <p class="hint-bubble">💡 {message}</p>}
      <div class="sudoku-tools">
        <button class="tool" disabled={state.history.length === 0} onClick={() => session.play(SPIDER_UNDO)}>
          Undo
        </button>
        <button class="tool" onClick={hint}>
          Hint
        </button>
        <button class="tool on" disabled={!canDeal} onClick={() => session.play(SPIDER_DEAL)}>
          Deal
        </button>
      </div>
    </div>
  );
}
