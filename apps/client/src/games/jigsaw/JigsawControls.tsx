import type { JigsawMove, JigsawState } from '@gamepals/rules';
import { useEffect, useState } from 'preact/hooks';
import type { Session } from '../../session';
import { jigsawUiFor } from './ui';

/** Edges first: the middle pieces step back, because the edges are where people start. */
export function JigsawControls({ session }: { session: Session<JigsawMove> }) {
  const ui = jigsawUiFor(session);
  const [, setTick] = useState(0);
  useEffect(() => ui.subscribe(() => setTick((t) => t + 1)), [ui]);

  const state = session.state as JigsawState;
  if (state.result) return null;
  const edgesLeft = state.placed.some((done, piece) => !done && state.isEdge(piece));
  return (
    <div class="sweeper-tools">
      <button class={ui.edgesFirst ? 'tool on' : 'tool'} aria-pressed={ui.edgesFirst} disabled={!edgesLeft && !ui.edgesFirst} onClick={() => ui.setEdgesFirst(!ui.edgesFirst)}>
        🧩 Edges first
      </button>
    </div>
  );
}
