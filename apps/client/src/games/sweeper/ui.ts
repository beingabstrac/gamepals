import type { SweeperMove } from '@gamepals/rules';
import type { Session } from '../../session';

/**
 * What the board and the Dig / Flag toggle share. Long-press flags whatever the toggle says; the
 * toggle is for anyone who would rather not long-press, and for mice, which cannot.
 */
export class SweeperUi {
  flagging = false;
  private readonly listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setFlagging(on: boolean): void {
    if (this.flagging === on) return;
    this.flagging = on;
    this.listeners.forEach((listener) => listener());
  }
}

const uis = new WeakMap<Session<SweeperMove>, SweeperUi>();

export function sweeperUiFor(session: Session<SweeperMove>): SweeperUi {
  let ui = uis.get(session);
  if (!ui) {
    ui = new SweeperUi();
    uis.set(session, ui);
  }
  return ui;
}
