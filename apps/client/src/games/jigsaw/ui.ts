import type { JigsawMove } from '@gamepals/rules';
import type { Session } from '../../session';

/** What the tray and the Edges first toggle share: whether the middle pieces step back. */
export class JigsawUi {
  edgesFirst = false;
  private readonly listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setEdgesFirst(on: boolean): void {
    if (this.edgesFirst === on) return;
    this.edgesFirst = on;
    this.listeners.forEach((listener) => listener());
  }
}

const uis = new WeakMap<Session<JigsawMove>, JigsawUi>();

export function jigsawUiFor(session: Session<JigsawMove>): JigsawUi {
  let ui = uis.get(session);
  if (!ui) {
    ui = new JigsawUi();
    uis.set(session, ui);
  }
  return ui;
}
