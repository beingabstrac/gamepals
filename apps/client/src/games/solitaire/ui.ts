import type { SolitaireMove } from '@gamepals/rules';
import type { Session } from '../../session';

/** Lets the controls under the table ask the scene to point at a hinted card. */
export class SolitaireUi {
  private readonly listeners = new Set<(move: SolitaireMove) => void>();

  onHint(listener: (move: SolitaireMove) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  hint(move: SolitaireMove): void {
    this.listeners.forEach((listener) => listener(move));
  }
}

const uis = new WeakMap<Session<SolitaireMove>, SolitaireUi>();

export function solitaireUiFor(session: Session<SolitaireMove>): SolitaireUi {
  let ui = uis.get(session);
  if (!ui) {
    ui = new SolitaireUi();
    uis.set(session, ui);
  }
  return ui;
}
