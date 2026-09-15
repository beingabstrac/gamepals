import type { ShutMove, ShutState } from '@gamepals/rules';
import type { Session } from '../../session';

export function ShutControls({ session }: { session: Session<ShutMove> }) {
  const state = session.state as ShutState;
  if (state.result) return null;
  const myTurn = session.isHumanTurn();
  const moves = state.legalMoves(state.currentSeat);
  const rolling = state.phase === 'roll';
  return (
    <div class="sudoku-controls">
      <div class="ludo-controls">
        {rolling ? (
          <>
            <button class="btn primary roll-btn" disabled={!myTurn} onClick={() => session.play('r2')}>
              {myTurn ? 'Roll 2 dice' : 'Waiting…'}
            </button>
            {myTurn && moves.includes('r1') && (
              <button class="btn" onClick={() => session.play('r1')}>
                Roll 1 die
              </button>
            )}
          </>
        ) : (
          <button class="btn primary roll-btn" disabled>
            {myTurn ? `Pick tiles that add up to ${state.roll}` : 'Waiting…'}
          </button>
        )}
      </div>
    </div>
  );
}
