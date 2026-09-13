import { eraseMove, HINT_MOVE, noteMove, placeMove, UNDO_MOVE, type SudokuMove, type SudokuState } from '@gamepals/rules';
import type { Session } from '../../session';

/** What the board and the number pad share: the chosen square, notes mode and a highlighted number. */
export class SudokuUi {
  selected: number | null = null;
  notes = false;
  /** Number to highlight everywhere when no square is chosen. */
  focus: number | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly session: Session<SudokuMove>) {}

  private get state(): SudokuState {
    return this.session.state as SudokuState;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }

  select(cell: number | null): void {
    this.selected = cell;
    this.focus = null;
    this.emit();
  }

  toggleNotes(): void {
    this.notes = !this.notes;
    this.emit();
  }

  /** A number from the pad or keyboard: place it, jot it as a note, or highlight it. */
  enter(digit: number): void {
    const cell = this.selected;
    const state = this.state;
    if (cell === null || state.isGiven(cell)) {
      this.focus = this.focus === digit ? null : digit;
      this.emit();
      return;
    }
    const value = state.values[cell];
    if (this.notes) {
      if (!value) this.session.play(noteMove(cell, digit));
    } else {
      // Tapping the number that's already there takes it out again.
      this.session.play(value === digit ? eraseMove(cell) : placeMove(cell, digit));
    }
    this.emit();
  }

  erase(): void {
    if (this.selected !== null) this.session.play(eraseMove(this.selected));
    this.emit();
  }

  hint(): void {
    this.session.play(HINT_MOVE);
    this.select(this.state.lastHint?.cell ?? this.selected);
  }

  undo(): void {
    this.session.play(UNDO_MOVE);
    this.emit();
  }
}

const uis = new WeakMap<Session<SudokuMove>, SudokuUi>();

export function uiFor(session: Session<SudokuMove>): SudokuUi {
  let ui = uis.get(session);
  if (!ui) {
    ui = new SudokuUi(session);
    uis.set(session, ui);
  }
  return ui;
}
