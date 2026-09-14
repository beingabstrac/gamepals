import { REVERSI_PASS, type ReversiMove, type ReversiState } from '@gamepals/rules';
import type { Session } from '../../session';

/** Shows up only when a person has no legal move: explains it and offers the pass. */
export function ReversiControls({ session }: { session: Session<ReversiMove> }) {
  const state = session.state as ReversiState;
  if (state.result || !session.isHumanTurn()) return null;
  if (state.legalMoves(state.currentSeat)[0] !== REVERSI_PASS) return null;
  return (
    <div class="sudoku-controls">
      <p class="hint-bubble">You have no moves, so you pass.</p>
      <div class="sudoku-tools">
        <button class="tool on" onClick={() => session.play(REVERSI_PASS)}>
          Pass
        </button>
      </div>
    </div>
  );
}
