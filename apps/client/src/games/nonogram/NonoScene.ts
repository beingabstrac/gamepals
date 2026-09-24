import { type NonoMove, type NonoState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { focusRing, moveRing, onKeys } from '../keys';

const W = 640;
const H = 800;
export const NONO_CANVAS = { width: W, height: H };
export const NONO_COLORS = [COLORS.mint];

const CLUE = 150;
const MODE_Y = 740;

/**
 * Nonogram. The rules keep the picture and check the grid; the scene draws the clues along the top
 * and left, grays a clue out when its line is done, and paints squares as you tap or drag. Fill
 * and Mark are two big buttons, so a finger never has to long-press.
 */
export class NonoScene extends Scene {
  private board!: GameObjects.Graphics;
  private clueTexts: GameObjects.Text[] = [];
  private modeTexts: GameObjects.Text[] = [];
  private ring!: GameObjects.Graphics;
  private mode: 'fill' | 'mark' = 'fill';
  /** A drag in progress: what it does to each square it crosses. */
  private stroke: 'f' | 'x' | 'c' | null = null;
  private touched = new Set<number>();
  private focus = 0;
  private won = false;

  constructor(private readonly session: Session<NonoMove>) {
    super('nonogram');
  }

  private get state(): NonoState {
    return this.session.state as NonoState;
  }

  private get cell(): number {
    return Math.floor((W - CLUE - 24) / this.state.size);
  }

  private cellXY(i: number): { x: number; y: number } {
    const n = this.state.size;
    return { x: CLUE + 8 + (i % n) * this.cell + this.cell / 2, y: CLUE + 8 + Math.floor(i / n) * this.cell + this.cell / 2 };
  }

  private cellAt(x: number, y: number): number | null {
    const n = this.state.size;
    const col = Math.floor((x - CLUE - 8) / this.cell);
    const row = Math.floor((y - CLUE - 8) / this.cell);
    return col >= 0 && row >= 0 && col < n && row < n ? row * n + col : null;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.board = this.add.graphics();
    this.ring = focusRing(this, this.cell, this.cell, 6);
    this.makeClues();
    this.modeTexts = [
      sharpText(this, W / 2 - 110, MODE_Y, 'Fill', 26, '#FFFFFF').setFontStyle('bold').setDepth(3),
      sharpText(this, W / 2 + 110, MODE_Y, 'Mark ×', 26, '#FFFFFF').setFontStyle('bold').setDepth(3),
    ];
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      this.ring.setVisible(false);
      if (Math.abs(p.worldY - MODE_Y) < 30) {
        this.mode = p.worldX < W / 2 ? 'fill' : 'mark';
        cue('tap');
        return this.draw();
      }
      const i = this.cellAt(p.worldX, p.worldY);
      if (i === null || !this.session.isHumanTurn()) return;
      // The first square decides the stroke: fill blanks (or clear fills), and the drag keeps doing it.
      const v = this.state.cells[i]!;
      this.stroke = this.mode === 'fill' ? (v === 1 ? 'c' : 'f') : v === 0 ? 'c' : 'x';
      this.touched.clear();
      this.paint(i);
    });
    this.input.on('pointermove', (p: { worldX: number; worldY: number; isDown: boolean }) => {
      if (!p.isDown || !this.stroke) return;
      const i = this.cellAt(p.worldX, p.worldY);
      if (i !== null) this.paint(i);
    });
    const up = () => (this.stroke = null);
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
    onKeys(this, (key) => this.key(key));
    const off = this.session.subscribe(() => this.draw());
    this.events.once('shutdown', off);
    this.draw();
  }

  private paint(i: number): void {
    if (this.touched.has(i) || !this.stroke || this.state.result) return;
    this.touched.add(i);
    const move = `${this.stroke}${i}`;
    if (!this.state.legalMoves(0).includes(move)) return;
    cue(this.stroke === 'f' ? 'place' : 'tap');
    this.session.play(move);
  }

  private makeClues(): void {
    const state = this.state;
    const n = state.size;
    const size = n <= 5 ? 26 : n <= 10 ? 20 : 15;
    const cell = this.cell;
    state.rowClues.forEach((clue, y) => {
      const text = sharpText(this, CLUE - 6, CLUE + 8 + y * cell + cell / 2, clue.join(' '), size, COLORS.ink).setOrigin(1, 0.5).setFontStyle('bold');
      this.clueTexts.push(text);
    });
    state.colClues.forEach((clue, x) => {
      const text = sharpText(this, CLUE + 8 + x * cell + cell / 2, CLUE - 6, clue.join('\n'), size, COLORS.ink).setOrigin(0.5, 1).setFontStyle('bold').setAlign('center');
      text.setLineSpacing(-size * 0.25);
      this.clueTexts.push(text);
    });
  }

  private key(key: string): boolean {
    const n = this.state.size;
    const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -n, ArrowDown: n } as Record<string, number>)[key];
    if (step !== undefined) {
      const col = this.focus % n;
      if ((step === -1 && col === 0) || (step === 1 && col === n - 1)) return true;
      const next = this.focus + step;
      if (next >= 0 && next < n * n) this.focus = next;
      const { x, y } = this.cellXY(this.focus);
      moveRing(this, this.ring, x, y);
      return true;
    }
    if (key === ' ' || key === 'Enter' || key === 'x' || key === 'X') {
      if (!this.session.isHumanTurn()) return true;
      const v = this.state.cells[this.focus]!;
      const mark = key === 'x' || key === 'X';
      this.stroke = mark ? (v === 0 ? 'c' : 'x') : v === 1 ? 'c' : 'f';
      this.touched.clear();
      this.paint(this.focus);
      this.stroke = null;
      return true;
    }
    return false;
  }

  private draw(): void {
    const state = this.state;
    const n = state.size;
    const cell = this.cell;
    const g = this.board.clear();
    const x0 = CLUE + 8;
    const y0 = CLUE + 8;
    g.fillStyle(0xe6e0f4, 1);
    g.fillRoundedRect(x0 - 6, y0 - 6 + 5, n * cell + 12, n * cell + 12, 14);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(x0 - 6, y0 - 6, n * cell + 12, n * cell + 12, 14);
    for (let i = 0; i < n * n; i++) {
      const { x, y } = this.cellXY(i);
      const v = state.cells[i];
      const pad = Math.max(2, cell * 0.06);
      if (v === 1) {
        g.fillStyle(toHex(state.result ? COLORS.grape : DARK.mint), 1);
        g.fillRoundedRect(x - cell / 2 + pad, y - cell / 2 + pad + 2, cell - pad * 2, cell - pad * 2, cell * 0.18);
        g.fillStyle(toHex(state.result ? COLORS.bubblegum : COLORS.mint), 1);
        g.fillRoundedRect(x - cell / 2 + pad, y - cell / 2 + pad, cell - pad * 2, cell - pad * 2, cell * 0.18);
      } else {
        g.fillStyle(0xf4f1fb, 1);
        g.fillRoundedRect(x - cell / 2 + pad, y - cell / 2 + pad, cell - pad * 2, cell - pad * 2, cell * 0.18);
        if (v === 0) {
          g.lineStyle(Math.max(2, cell * 0.08), toHex(COLORS.soft), 0.7);
          const k = cell * 0.22;
          g.lineBetween(x - k, y - k, x + k, y + k);
          g.lineBetween(x - k, y + k, x + k, y - k);
        }
      }
    }
    // Heavier lines every five squares, as on paper, so big grids can be counted.
    g.lineStyle(2, toHex(COLORS.soft), 0.35);
    for (let k = 5; k < n; k += 5) {
      g.lineBetween(x0 + k * cell, y0, x0 + k * cell, y0 + n * cell);
      g.lineBetween(x0, y0 + k * cell, x0 + n * cell, y0 + k * cell);
    }
    this.clueTexts.forEach((t, i) => {
      const done = i < n ? state.lineDone('row', i) : state.lineDone('col', i - n);
      t.setColor(done ? '#C9C2E0' : COLORS.ink);
    });
    const live = !state.result;
    for (const [i, which] of (['fill', 'mark'] as const).entries()) {
      const on = this.mode === which;
      const x = W / 2 + (i === 0 ? -110 : 110);
      g.fillStyle(toHex(on ? DARK.grape : '#D8D3E6'), 1);
      g.fillRoundedRect(x - 96, MODE_Y - 28 + 6, 192, 56, 28);
      g.fillStyle(toHex(on ? COLORS.grape : COLORS.line), 1);
      g.fillRoundedRect(x - 96, MODE_Y - 28, 192, 56, 28);
      this.modeTexts[i]!.setColor(on ? '#FFFFFF' : COLORS.soft).setVisible(live);
    }
    if (!live) {
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, MODE_Y - 36, W, 80);
    }
    if (state.result && !this.won) {
      this.won = true;
      cue('win');
      // The picture turns pink and a burst of confetti goes up from the middle of it.
      const n = state.size;
      const mid = { x: CLUE + 8 + (n * this.cell) / 2, y: CLUE + 8 + (n * this.cell) / 2 };
      const colors = [COLORS.sunny, COLORS.sky, COLORS.tomato, COLORS.mint, COLORS.grape];
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const bit = this.add.circle(mid.x, mid.y, 9, toHex(colors[k % colors.length]!)).setDepth(6);
        this.tweens.add({ targets: bit, x: mid.x + Math.cos(a) * 260, y: mid.y + Math.sin(a) * 260, alpha: 0, duration: 650, ease: 'Cubic.easeOut', onComplete: () => bit.destroy() });
      }
    }
  }

  /** The bands the board keeps to, for the layout check. */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    const n = this.state.size;
    return [
      { name: 'grid', top: 0, bottom: CLUE + 8 + n * this.cell + 12 },
      { name: 'mode', top: MODE_Y - 28, bottom: MODE_Y + 34 },
    ];
  }
}

export function nonoStatus(state: NonoState): string | undefined {
  if (state.result) return undefined;
  const n = state.size;
  const done = Array.from({ length: n }, (_, i) => state.lineDone('row', i)).filter(Boolean).length;
  return `${done} of ${n} rows done`;
}

export function nonoResult(state: NonoState): string | undefined {
  return state.result ? `Picture done in ${state.moves} ${state.moves === 1 ? 'move' : 'moves'}! 🎉` : undefined;
}
