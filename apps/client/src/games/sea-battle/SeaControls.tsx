import { FLEET, type SeaMove, type SeaBattleState } from '@gamepals/rules';
import type { Session } from '../../session';
import { tableFor, turnShip } from './table';

export function SeaControls({ session }: { session: Session<SeaMove> }) {
  const state = session.state as SeaBattleState;
  if (state.result) return null;
  const myTurn = session.isHumanTurn();
  const placing = state.phase === 'place';
  const placed = state.fleets[state.currentSeat]!.length;
  const waiting = placing && placed < FLEET.length ? FLEET[placed]! : null;

  /** Puts every ship that is left somewhere legal, so nobody has to fiddle. */
  const placeRest = () => {
    let guard = 0;
    while (session.isHumanTurn() && (session.state as SeaBattleState).phase === 'place' && guard++ < 10) {
      const now = session.state as SeaBattleState;
      const moves = now.legalMoves(now.currentSeat);
      if (!moves.length) break;
      session.play(moves[Math.floor(Math.random() * moves.length)]!);
    }
  };

  if (!myTurn) {
    return (
      <div class="sudoku-controls">
        <div class="ludo-controls">
          <button class="btn primary roll-btn" disabled>
            Waiting…
          </button>
        </div>
      </div>
    );
  }

  return (
    <div class="sudoku-controls">
      <div class="ludo-controls">
        {placing ? (
          <>
            <button class="btn" onClick={() => turnShip(tableFor(session))}>
              Turn the {waiting?.name ?? 'ship'}
            </button>
            <button class="btn primary" onClick={placeRest}>
              Place them for me
            </button>
          </>
        ) : (
          <button class="btn primary roll-btn" disabled>
            Fire at their waters
          </button>
        )}
      </div>
    </div>
  );
}
