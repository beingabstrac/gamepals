import { UNDO_TILE_MOVE, type TileMatchState, type TileMove } from '@gamepals/rules';
import type { Session } from '../../session';

/** Undo, with how many are left. Three a game: unlimited would take away the only way to lose. */
export function TileMatchControls({ session }: { session: Session<TileMove> }) {
  const state = session.state as TileMatchState;
  if (state.result) return null;
  const can = state.legalMoves(0).includes(UNDO_TILE_MOVE);
  return (
    <div class="sweeper-tools">
      <button class="tool" disabled={!can} aria-label={`Undo, ${state.undos} left`} onClick={() => session.play(UNDO_TILE_MOVE)}>
        ↩️ Undo ({state.undos})
      </button>
    </div>
  );
}
