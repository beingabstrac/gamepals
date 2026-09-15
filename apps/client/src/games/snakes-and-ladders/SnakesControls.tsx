import type { SnakesMove, SnakesState } from '@gamepals/rules';
import type { Session } from '../../session';
import { Die } from '../ludo/LudoControls';

export function SnakesControls({ session }: { session: Session<SnakesMove> }) {
  const state = session.state as SnakesState;
  if (state.result) return null;
  const myTurn = session.isHumanTurn();
  return (
    <div class="sudoku-controls">
      <div class="ludo-controls">
        {/* Keying on the roll count replays the tumble animation for every roll. */}
        <Die key={state.rollCount} value={state.last?.roll ?? null} />
        <button class="btn primary roll-btn" disabled={!myTurn} onClick={() => session.play('roll')}>
          {myTurn ? 'Roll' : 'Waiting…'}
        </button>
      </div>
    </div>
  );
}
