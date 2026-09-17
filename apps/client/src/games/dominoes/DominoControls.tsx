import type { DominoMove, DominoState } from '@gamepals/rules';
import type { Session } from '../../session';
import { TurnHint } from '../hint';

export function DominoControls({ session }: { session: Session<DominoMove> }) {
  const state = session.state as DominoState;
  if (state.result) return null;
  const myTurn = session.isHumanTurn();
  const only = state.legalMoves(state.currentSeat)[0];
  let label = '';
  let move: DominoMove | null = null;
  if (myTurn && only === 'deal') [label, move] = ['Next hand', 'deal'];
  else if (myTurn && only === 'draw') [label, move] = ['No tile fits. Draw one', 'draw'];
  else if (myTurn && only === 'pass') [label, move] = ['No tile fits. Pass', 'pass'];
  if (move === null) {
    return (
      <div class="sudoku-controls">
        <TurnHint>{myTurn ? 'Tap a glowing tile' : 'Waiting for the other player'}</TurnHint>
      </div>
    );
  }
  const chosen = move;
  return (
    <div class="sudoku-controls">
      <div class="ludo-controls">
        <button class="btn primary roll-btn" onClick={() => session.play(chosen)}>
          {label}
        </button>
      </div>
    </div>
  );
}
