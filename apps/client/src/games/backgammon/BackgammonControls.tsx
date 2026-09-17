import { PASS, ROLL, type BackgammonMove, type BackgammonState } from '@gamepals/rules';
import type { Session } from '../../session';
import { TurnHint } from '../hint';

export function BackgammonControls({ session }: { session: Session<BackgammonMove> }) {
  const state = session.state as BackgammonState;
  if (state.result) return null;
  const myTurn = session.isHumanTurn();
  const moves = state.legalMoves(state.currentSeat);
  const only = moves.length === 1 ? moves[0] : undefined;
  let label = '';
  let move: BackgammonMove | null = null;
  if (myTurn && only === ROLL) [label, move] = ['Roll', ROLL];
  else if (myTurn && only === PASS) [label, move] = ['No move. Turn over', PASS];
  if (move === null) {
    return (
      <div class="sudoku-controls">
        <TurnHint>{myTurn ? 'Tap a checker, then where it goes' : 'Waiting for the other player'}</TurnHint>
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
