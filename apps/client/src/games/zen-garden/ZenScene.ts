import { ZEN_COLS, ZEN_ROWS, type ZenMove, type ZenState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { focusRing, moveRing, onKeys } from '../keys';

const W = 600;
const H = 820;
export const ZEN_CANVAS = { width: W, height: H };
export const ZEN_COLORS = [COLORS.mint];

const TRAY = { x: 30, y: 40, w: 540, h: 640 };
const CW = TRAY.w / ZEN_COLS;
const CH = TRAY.h / ZEN_ROWS;
const BAR_Y = 755;
const SAND = 0xf3e6c8;
const GROOVE = 0xd9c394;
const SHINE = 0xfff6e0;
const STONE_GREYS = [0x8f8ba3, 0xa7a3b8, 0x6f6d85, 0xb9b6c8, 0x7d7a93, 0x9c98ae, 0x5f5d73];

/**
 * Zen Garden. The rules keep the stones; the scene is the sand. Drag to rake four grooves along
 * your finger, each with a lit edge so it reads as cut into the sand; switch to Stone and tap to
 * set a stone or lift it. Smooth rakes the sand flat again. Done when it looks right to you.
 */
export class ZenScene extends Scene {
  private grooves!: GameObjects.Graphics;
  private stonesG!: GameObjects.Graphics;
  private bar!: GameObjects.Graphics;
  private labels: GameObjects.Text[] = [];
  private ring!: GameObjects.Graphics;
  private tool: 'rake' | 'stone' = 'rake';
  private lastPoint: { x: number; y: number } | null = null;
  private focus = 0;
  private strokes = 0;

  constructor(private readonly session: Session<ZenMove>) {
    super('zen-garden');
  }

  private get state(): ZenState {
    return this.session.state as ZenState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    const tray = this.add.graphics();
    tray.fillStyle(toHex(DARK.peach), 1);
    tray.fillRoundedRect(TRAY.x - 14, TRAY.y - 14 + 8, TRAY.w + 28, TRAY.h + 28, 26);
    tray.fillStyle(toHex(COLORS.peach), 1);
    tray.fillRoundedRect(TRAY.x - 14, TRAY.y - 14, TRAY.w + 28, TRAY.h + 28, 26);
    tray.fillStyle(SAND, 1);
    tray.fillRoundedRect(TRAY.x, TRAY.y, TRAY.w, TRAY.h, 16);
    this.grooves = this.add.graphics().setDepth(1);
    this.stonesG = this.add.graphics().setDepth(2);
    this.bar = this.add.graphics().setDepth(3);
    this.labels = ['Rake', 'Stone', 'Smooth', 'Done'].map((t, i) => sharpText(this, 90 + i * 140, BAR_Y, t, 22, '#FFFFFF').setFontStyle('bold').setDepth(4));
    this.ring = focusRing(this, CW - 8, CH - 8, 16);
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      this.ring.setVisible(false);
      if (Math.abs(p.worldY - BAR_Y) < 30) return this.button(Math.round((p.worldX - 90) / 140));
      if (!this.inTray(p.worldX, p.worldY) || !this.session.isHumanTurn()) return;
      if (this.tool === 'stone') return this.toggleStone(this.cellAt(p.worldX, p.worldY));
      this.lastPoint = { x: p.worldX, y: p.worldY };
    });
    this.input.on('pointermove', (p: { worldX: number; worldY: number; isDown: boolean }) => {
      if (!p.isDown || this.tool !== 'rake' || !this.lastPoint) return;
      const x = Math.max(TRAY.x + 20, Math.min(TRAY.x + TRAY.w - 20, p.worldX));
      const y = Math.max(TRAY.y + 20, Math.min(TRAY.y + TRAY.h - 20, p.worldY));
      if (Math.hypot(x - this.lastPoint.x, y - this.lastPoint.y) < 6) return;
      this.rake(this.lastPoint, { x, y });
      this.lastPoint = { x, y };
    });
    const up = () => (this.lastPoint = null);
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
    onKeys(this, (key) => this.key(key));
    const off = this.session.subscribe(() => this.draw());
    this.events.once('shutdown', off);
    this.draw();
  }

  private inTray(x: number, y: number): boolean {
    return x > TRAY.x && x < TRAY.x + TRAY.w && y > TRAY.y && y < TRAY.y + TRAY.h;
  }

  private cellAt(x: number, y: number): number {
    const col = Math.min(ZEN_COLS - 1, Math.floor((x - TRAY.x) / CW));
    const row = Math.min(ZEN_ROWS - 1, Math.floor((y - TRAY.y) / CH));
    return row * ZEN_COLS + col;
  }

  private cellXY(i: number): { x: number; y: number } {
    return { x: TRAY.x + (i % ZEN_COLS) * CW + CW / 2, y: TRAY.y + Math.floor(i / ZEN_COLS) * CH + CH / 2 };
  }

  /** Four tines along the stroke: a dark groove and a lit edge beside each. */
  private rake(a: { x: number; y: number }, b: { x: number; y: number }): void {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const g = this.grooves;
    for (const k of [-1.5, -0.5, 0.5, 1.5]) {
      const ox = nx * k * 11;
      const oy = ny * k * 11;
      g.lineStyle(5, GROOVE, 1);
      g.lineBetween(a.x + ox, a.y + oy, b.x + ox, b.y + oy);
      g.lineStyle(2, SHINE, 1);
      g.lineBetween(a.x + ox + nx * 3, a.y + oy + ny * 3, b.x + ox + nx * 3, b.y + oy + ny * 3);
    }
    // A soft scrape now and then as the tines go.
    if (++this.strokes % 12 === 0) cue('pull');
  }

  private toggleStone(cell: number): void {
    const move = `s${cell}`;
    if (!this.state.legalMoves(0).includes(move)) return cue('buzz');
    cue(this.state.stones[cell]! >= 0 ? 'tap' : 'thud');
    this.session.play(move);
  }

  private button(i: number): void {
    if (!this.session.isHumanTurn() || this.state.result) return;
    if (i === 0) this.tool = 'rake';
    else if (i === 1) this.tool = 'stone';
    else if (i === 2) {
      // Smoothed flat: the grooves fade away.
      cue('roll');
      this.tweens.add({ targets: this.grooves, alpha: 0, duration: 350, onComplete: () => this.grooves.clear().setAlpha(1) });
    } else if (i === 3) {
      cue('win');
      this.session.play('done');
      return;
    } else return;
    cue('tap');
    this.draw();
  }

  private key(key: string): boolean {
    const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -ZEN_COLS, ArrowDown: ZEN_COLS } as Record<string, number>)[key];
    if (step !== undefined) {
      const col = this.focus % ZEN_COLS;
      if (!((step === -1 && col === 0) || (step === 1 && col === ZEN_COLS - 1))) {
        const next = this.focus + step;
        if (next >= 0 && next < ZEN_COLS * ZEN_ROWS) this.focus = next;
      }
      const { x, y } = this.cellXY(this.focus);
      moveRing(this, this.ring, x, y);
      return true;
    }
    if (key === 'Enter' || key === ' ') {
      if (this.session.isHumanTurn()) this.toggleStone(this.focus);
      return true;
    }
    if (key === 'r' || key === 'R') {
      // A straight line across the row the ring is on.
      const y = this.cellXY(this.focus).y;
      this.rake({ x: TRAY.x + 20, y }, { x: TRAY.x + TRAY.w - 20, y });
      return true;
    }
    if (key === 's' || key === 'S') {
      this.button(2);
      return true;
    }
    if (key === 'd' || key === 'D') {
      this.button(3);
      return true;
    }
    return false;
  }

  private draw(): void {
    const state = this.state;
    const g = this.stonesG.clear();
    state.stones.forEach((s, i) => {
      if (s < 0) return;
      const { x, y } = this.cellXY(i);
      // Each stone its own shape: a squashed, tilted oval, with the sand raked round it in a ring.
      const w = 34 + ((s * 7) % 5) * 6;
      const h = 24 + ((s * 3) % 4) * 5;
      g.lineStyle(3, GROOVE, 1);
      g.strokeEllipse(x, y, w + 26, h + 24);
      g.lineStyle(2, SHINE, 1);
      g.strokeEllipse(x, y - 2, w + 30, h + 28);
      g.fillStyle(0x000000, 0.12);
      g.fillEllipse(x + 4, y + 6, w, h);
      g.fillStyle(STONE_GREYS[s % STONE_GREYS.length]!, 1);
      g.fillEllipse(x, y, w, h);
      g.fillStyle(0xffffff, 0.3);
      g.fillEllipse(x - w * 0.18, y - h * 0.22, w * 0.4, h * 0.3);
    });
    const b = this.bar.clear();
    const live = !state.result;
    ['Rake', 'Stone', 'Smooth', 'Done'].forEach((_, i) => {
      const x = 90 + i * 140;
      const on = i === 0 ? this.tool === 'rake' : i === 1 ? this.tool === 'stone' : true;
      const color = i === 3 ? COLORS.mint : on ? COLORS.grape : COLORS.line;
      const lip = i === 3 ? DARK.mint : on ? DARK.grape : '#D8D3E6';
      b.fillStyle(toHex(lip), 1);
      b.fillRoundedRect(x - 64, BAR_Y - 26 + 5, 128, 52, 26);
      b.fillStyle(toHex(color), 1);
      b.fillRoundedRect(x - 64, BAR_Y - 26, 128, 52, 26);
      this.labels[i]!.setColor(on || i === 3 ? '#FFFFFF' : COLORS.soft).setVisible(live);
    });
    if (!live) b.clear();
  }
}

export function zenStatus(state: ZenState): string | undefined {
  if (state.result) return undefined;
  return state.count ? `${state.count} ${state.count === 1 ? 'stone' : 'stones'} in the garden` : 'Rake the sand, set a stone or two';
}

export function zenResult(state: ZenState): string | undefined {
  return state.result ? 'A calm garden. Breathe out.' : undefined;
}
