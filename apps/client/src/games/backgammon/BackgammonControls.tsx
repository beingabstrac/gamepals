import { PASS, ROLL, type BackgammonMove, type BackgammonState } from '@gamepals/rules';
import type { Session } from '../../session';

export function BackgammonControls({ session }: { session: Session<BackgammonMove> }) {
  const state = session.state as BackgammonState;
  if (state.result) return null;
  const myTurn = session.isHumanTurn();
  const moves = state.legalMoves(state.currentSeat);
  const only = moves.length === 1 ? moves[0] : undefined;
  let label = 'Waiting…';
  let move: BackgammonMove | null = null;
  if (myTurn && only === ROLL) [label, move] = ['Roll', ROLL];
  else if (myTurn && only === PASS) [label, move] = ['No move. Turn over', PASS];
  else if (myTurn) label = 'Tap a checker';
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
