import { boxOf, colOf, rowOf, UNITS, type SudokuMove, type SudokuState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { ROOM_TONES, tone } from '../../look';
import type { Session } from '../../session';
import { COLORS, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed } from '../../autoplay';
import { uiFor, type SudokuUi } from './ui';

const SIZE = 720;
const PAD = 18;
const CELL = (SIZE - PAD * 2) / 9;
export const SUDOKU_SIZE = { width: SIZE, height: SIZE };

const cellX = (cell: number) => PAD + colOf(cell) * CELL + CELL / 2;
const cellY = (cell: number) => PAD + rowOf(cell) * CELL + CELL / 2;

const PEER_TINT = 0xfff0c2;
const SAME_TINT = 0xffd966;
const CONFLICT_TINT = 0xffcfcf;
const THIN_LINE = 0xd4c8fa;

export class SudokuScene extends Scene {
  private readonly ui: SudokuUi;
  private highlight!: GameObjects.Graphics;
  private digits: (GameObjects.Text | null)[] = Array(81).fill(null);
  private noteTexts = new Map<number, GameObjects.Text[]>();
  private shownValues: number[] = Array(81).fill(0);
  private shownNotes: number[] = Array(81).fill(0);
  private shownConflicts = new Set<number>();
  private complete = new Set<number>();

  constructor(private readonly session: Session<SudokuMove>) {
    super('sudoku');
    this.ui = uiFor(session);
  }

  private get state(): SudokuState {
    return this.session.state as SudokuState;
  }

  create(): void {
    fitCamera(this, SIZE, SIZE);
    applySpeed(this);
    const paper = this.add.graphics();
    paper.fillStyle(0x2b2a3a, 0.08);
    paper.fillRoundedRect(4, 10, SIZE - 8, SIZE - 10, 28);
    paper.fillStyle(tone(0xffffff, ROOM_TONES.panel), 1);
    paper.fillRoundedRect(4, 2, SIZE - 8, SIZE - 10, 28);
    this.highlight = this.add.graphics().setDepth(1);
    this.drawLines();

    this.sync(true);

    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      const col = Math.floor((p.worldX - PAD) / CELL);
      const row = Math.floor((p.worldY - PAD) / CELL);
      if (col < 0 || col > 8 || row < 0 || row > 8) return;
      const cell = row * 9 + col;
      this.ui.select(this.ui.selected === cell ? null : cell);
      const digit = this.digits[cell];
      if (digit) this.tweens.add({ targets: digit, scale: 1.12, duration: 90, yoyo: true });
    });

    const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (/^[1-9]$/.test(event.key)) this.ui.enter(Number(event.key));
      else if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') this.ui.erase();
      else if (event.key.toLowerCase() === 'n') this.ui.toggleNotes();
      else if (moves[event.key]) {
        const [dr, dc] = moves[event.key]!;
        const from = this.ui.selected ?? 40;
        this.ui.select(((rowOf(from) + dr + 9) % 9) * 9 + ((colOf(from) + dc + 9) % 9));
      }
    });

    const offSession = this.session.subscribe(() => this.sync(false));
    const offUi = this.ui.subscribe(() => this.drawHighlight());
    this.events.once('shutdown', () => {
      offSession();
      offUi();
    });
  }

  private drawLines(): void {
    const g = this.add.graphics().setDepth(2);
    g.lineStyle(2, THIN_LINE, 1);
    for (let i = 1; i < 9; i++) {
      if (i % 3 === 0) continue;
      g.lineBetween(PAD + i * CELL, PAD, PAD + i * CELL, SIZE - PAD);
      g.lineBetween(PAD, PAD + i * CELL, SIZE - PAD, PAD + i * CELL);
    }
    g.lineStyle(5, toHex(COLORS.grape), 1);
    for (const i of [3, 6]) {
      g.lineBetween(PAD + i * CELL, PAD, PAD + i * CELL, SIZE - PAD);
      g.lineBetween(PAD, PAD + i * CELL, SIZE - PAD, PAD + i * CELL);
    }
    g.strokeRoundedRect(PAD, PAD, SIZE - PAD * 2, SIZE - PAD * 2, 14);
  }

  private drawHighlight(): void {
    const { selected, focus } = this.ui;
    const state = this.state;
    const g = this.highlight.clear();
    const fill = (cell: number, color: number, alpha = 1) => {
      g.fillStyle(color, alpha);
      g.fillRoundedRect(cellX(cell) - CELL / 2 + 3, cellY(cell) - CELL / 2 + 3, CELL - 6, CELL - 6, 10);
    };
    const digit = selected !== null ? state.values[selected] || null : focus;
    for (let cell = 0; cell < 81; cell++) {
      const peer =
        selected !== null && (rowOf(cell) === rowOf(selected) || colOf(cell) === colOf(selected) || boxOf(cell) === boxOf(selected));
      if (this.shownConflicts.has(cell)) fill(cell, CONFLICT_TINT);
      else if (digit && state.values[cell] === digit) fill(cell, SAME_TINT);
      else if (peer) fill(cell, PEER_TINT);
    }
    if (selected !== null) fill(selected, toHex(COLORS.sunny), 0.75);
  }

  private colorFor(cell: number): string {
    if (this.shownConflicts.has(cell)) return COLORS.tomato;
    return this.state.isGiven(cell) ? COLORS.ink : COLORS.grape;
  }

  /** Brings the board up to date and animates whatever changed. */
  private sync(first: boolean): void {
    const state = this.state;
    const conflicts = state.conflicts();
    const hinted = state.lastHint?.cell;
    const changed: number[] = [];

    for (let cell = 0; cell < 81; cell++) {
      const value = state.values[cell]!;
      if (value !== this.shownValues[cell]) {
        changed.push(cell);
        this.shownValues[cell] = value;
        const old = this.digits[cell];
        if (old) {
          if (first) old.destroy();
          else this.tweens.add({ targets: old, scale: 0, alpha: 0, duration: 140, onComplete: () => old.destroy() });
        }
        this.digits[cell] = null;
        if (value) {
          const text = sharpText(this, cellX(cell), cellY(cell) + 2, String(value), 50, COLORS.ink).setDepth(3);
          if (!state.isGiven(cell)) text.setFontStyle('bold');
          this.digits[cell] = text;
          if (!first) {
            text.setScale(1.45);
            this.tweens.add({ targets: text, scale: 1, duration: 260, ease: 'Back.easeOut' });
          }
        }
      }
      if (state.notes[cell] !== this.shownNotes[cell]) {
        this.shownNotes[cell] = state.notes[cell]!;
        this.drawNotes(cell, state.notes[cell]!);
      }
    }

    // Repeats turn red and give a little shake.
    const fresh = [...conflicts].filter((cell) => !this.shownConflicts.has(cell));
    this.shownConflicts = conflicts;
    for (let cell = 0; cell < 81; cell++) this.digits[cell]?.setColor(this.colorFor(cell));
    if (!first) {
      for (const cell of fresh) {
        const text = this.digits[cell];
        if (text) this.tweens.add({ targets: text, angle: { from: -10, to: 10 }, duration: 60, yoyo: true, repeat: 2, onComplete: () => text.setAngle(0) });
      }
    }

    if (hinted !== undefined && changed.includes(hinted) && !first) this.ring(hinted);

    // A finished row, column or box sends a sparkle along it.
    UNITS.forEach((unit, index) => {
      const done = unit.every((cell) => state.values[cell] === state.solution[cell]);
      if (done && !this.complete.has(index) && !first) this.sparkle(unit, 0);
      if (done) this.complete.add(index);
      else this.complete.delete(index);
    });
    if (state.result && !first) {
      const from = changed[0] ?? 40;
      const cells = Array.from({ length: 81 }, (_, i) => i);
      for (const cell of cells) {
        const distance = Math.hypot(rowOf(cell) - rowOf(from), colOf(cell) - colOf(from));
        this.sparkle([cell], 300 + distance * 70);
      }
      this.ui.select(null);
    }
    this.drawHighlight();
  }

  private drawNotes(cell: number, mask: number): void {
    this.noteTexts.get(cell)?.forEach((text) => text.destroy());
    const texts: GameObjects.Text[] = [];
    for (let d = 1; d <= 9; d++) {
      if (!(mask & (1 << d))) continue;
      const x = cellX(cell) + (((d - 1) % 3) - 1) * (CELL / 3.2);
      const y = cellY(cell) + (Math.floor((d - 1) / 3) - 1) * (CELL / 3.2);
      const text = sharpText(this, x, y, String(d), 19, COLORS.soft).setDepth(3);
      text.setScale(0);
      this.tweens.add({ targets: text, scale: 1, duration: 180, ease: 'Back.easeOut' });
      texts.push(text);
    }
    this.noteTexts.set(cell, texts);
  }

  private sparkle(cells: readonly number[], delay: number): void {
    cells.forEach((cell, i) => {
      const g = this.add.graphics().setDepth(2.5).setAlpha(0);
      g.fillStyle(toHex(COLORS.mint), 1);
      g.fillRoundedRect(cellX(cell) - CELL / 2 + 3, cellY(cell) - CELL / 2 + 3, CELL - 6, CELL - 6, 10);
      this.tweens.add({ targets: g, alpha: 0.55, duration: 170, delay: delay + i * 45, yoyo: true, onComplete: () => g.destroy() });
      const text = this.digits[cell];
      if (text) this.tweens.add({ targets: text, scale: 1.2, duration: 170, delay: delay + i * 45, yoyo: true, ease: 'Sine.easeOut' });
    });
  }

  /** A ring that grows out of a square filled by a hint. */
  private ring(cell: number): void {
    const g = this.add.graphics({ x: cellX(cell), y: cellY(cell) }).setDepth(4);
    g.lineStyle(5, toHex(COLORS.mint), 1);
    g.strokeCircle(0, 0, CELL * 0.42);
    g.setScale(0.6);
    this.tweens.add({ targets: g, scale: 1.5, alpha: 0, duration: 650, ease: 'Quad.easeOut', onComplete: () => g.destroy() });
  }
}
