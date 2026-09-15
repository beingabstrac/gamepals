import type { DominoMove, DominoState } from '@gamepals/rules';
import type { Session } from '../../session';

export function DominoControls({ session }: { session: Session<DominoMove> }) {
  const state = session.state as DominoState;
  if (state.result) return null;
  const myTurn = session.isHumanTurn();
  const only = state.legalMoves(state.currentSeat)[0];
  let label = 'Waiting…';
  let move: DominoMove | null = null;
  if (myTurn && only === 'deal') [label, move] = ['Next hand', 'deal'];
  else if (myTurn && only === 'draw') [label, move] = ['No tile fits. Draw one', 'draw'];
  else if (myTurn && only === 'pass') [label, move] = ['No tile fits. Pass', 'pass'];
  else if (myTurn) label = 'Tap a glowing tile';
  return (
    <div class="sudoku-controls">
      <div class="ludo-controls">
        <button class="btn primary roll-btn" disabled={move === null} onClick={() => move && session.play(move)}>
          {label}
        </button>
      </div>
    </div>
  );
}
