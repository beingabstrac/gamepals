import type { SweeperMove, SweeperState } from '@gamepals/rules';
import { useEffect, useState } from 'preact/hooks';
import type { Session } from '../../session';
import { sweeperUiFor } from './ui';

/** Dig or Flag: what a plain tap does. Two buttons rather than one toggle, so the pressed one says it. */
export function SweeperControls({ session }: { session: Session<SweeperMove> }) {
  const ui = sweeperUiFor(session);
  const [, setTick] = useState(0);
  useEffect(() => ui.subscribe(() => setTick((t) => t + 1)), [ui]);

  const state = session.state as SweeperState;
  if (state.result) return null;
  return (
    <div class="sweeper-tools">
      <button class={ui.flagging ? 'tool' : 'tool on'} aria-pressed={!ui.flagging} onClick={() => ui.setFlagging(false)}>
        ⛏️ Dig
      </button>
      <button class={ui.flagging ? 'tool on' : 'tool'} aria-pressed={ui.flagging} onClick={() => ui.setFlagging(true)}>
        🚩 Flag
      </button>
    </div>
  );
}
