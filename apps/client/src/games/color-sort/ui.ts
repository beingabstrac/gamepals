import type { ColorSortMove } from '@gamepals/rules';
import type { Session } from '../../session';

/** Lets the Hint button under the board ask the scene to point at the next pour. */
export class ColorSortUi {
  private readonly listeners = new Set<(move: ColorSortMove) => void>();

  onHint(listener: (move: ColorSortMove) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  hint(move: ColorSortMove): void {
    this.listeners.forEach((listener) => listener(move));
  }
}

const uis = new WeakMap<Session<ColorSortMove>, ColorSortUi>();

export function colorSortUiFor(session: Session<ColorSortMove>): ColorSortUi {
  let ui = uis.get(session);
  if (!ui) {
    ui = new ColorSortUi();
    uis.set(session, ui);
  }
  return ui;
}
