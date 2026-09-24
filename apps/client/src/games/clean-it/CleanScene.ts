import { CLEAN_COATS, CLEAN_COLS, CLEAN_ROWS, type CleanMove, type CleanState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera } from '../crisp';
import { focusRing, moveRing, onKeys } from '../keys';

const W = 600;
const H = 800;
export const CLEAN_CANVAS = { width: W, height: H };
export const CLEAN_COLORS = [COLORS.sky];

const CELL = 45;
const AREA = { x: (W - CLEAN_COLS * CELL) / 2, y: 40, w: CLEAN_COLS * CELL, h: CLEAN_ROWS * CELL };
/** The grime on each thing: window smudges, coin tarnish, rug mud. */
const GRIME: Record<string, number> = { window: 0x8f8ba3, coin: 0x4d6b4a, rug: 0x8a5a33 };

/**
 * Clean It. The rules keep how many coats of dirt are on each spot; the scene draws the thing
 * underneath (a window onto a sunny day, a gold coin, a stripy rug), the grime over it as soft
 * overlapping blotches, a cloth that follows your finger, and sparkles when it is clean.
 */
export class CleanScene extends Scene {
  private dirt!: GameObjects.Graphics;
  private cloth!: GameObjects.Container;
  private ring!: GameObjects.Graphics;
  private lastCell = -1;
  private focus = Math.floor((CLEAN_COLS * CLEAN_ROWS) / 2);
  private sparkled = false;

  constructor(private readonly session: Session<CleanMove>) {
    super('clean-it');
  }

  private get state(): CleanState {
    return this.session.state as CleanState;
  }

  private cellAt(x: number, y: number): number | null {
    const col = Math.floor((x - AREA.x) / CELL);
    const row = Math.floor((y - AREA.y) / CELL);
    return col < 0 || row < 0 || col >= CLEAN_COLS || row >= CLEAN_ROWS ? null : row * CLEAN_COLS + col;
  }

  private cellXY(i: number): { x: number; y: number } {
    return { x: AREA.x + (i % CLEAN_COLS) * CELL + CELL / 2, y: AREA.y + Math.floor(i / CLEAN_COLS) * CELL + CELL / 2 };
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.drawThing(this.add.graphics());
    this.dirt = this.add.graphics().setDepth(2);
    const cloth = this.add.graphics();
    cloth.fillStyle(toHex(DARK.sky), 1);
    cloth.fillRoundedRect(-34, -26 + 5, 68, 52, 16);
    cloth.fillStyle(toHex(COLORS.sky), 1);
    cloth.fillRoundedRect(-34, -26, 68, 52, 16);
    cloth.lineStyle(3, 0xffffff, 0.5);
    for (let k = -2; k <= 2; k++) cloth.lineBetween(-26, k * 9, 26, k * 9);
    this.cloth = this.add.container(0, 0, [cloth]).setDepth(4).setVisible(false);
    this.ring = focusRing(this, CELL * 2, CELL * 2, 16);
    this.drawDirt();
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      this.ring.setVisible(false);
      this.lastCell = -1;
      this.rub(p.worldX, p.worldY);
    });
    this.input.on('pointermove', (p: { worldX: number; worldY: number; isDown: boolean }) => p.isDown && this.rub(p.worldX, p.worldY));
    this.input.on('pointerup', () => this.cloth.setVisible(false));
    onKeys(this, (key) => {
      const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -CLEAN_COLS, ArrowDown: CLEAN_COLS } as Record<string, number>)[key];
      if (step !== undefined) {
        const col = this.focus % CLEAN_COLS;
        if (!((step === -1 && col === 0) || (step === 1 && col === CLEAN_COLS - 1))) this.focus = Math.max(0, Math.min(CLEAN_COLS * CLEAN_ROWS - 1, this.focus + step));
        const c = this.cellXY(this.focus);
        moveRing(this, this.ring, c.x, c.y);
        return true;
      }
      if (key === 'Enter' || key === ' ') {
        this.wipe(this.focus);
        return true;
      }
      return false;
    });
    const off = this.session.subscribe(() => this.changed());
    this.events.once('shutdown', off);
  }

  private rub(x: number, y: number): void {
    this.cloth.setVisible(true).setPosition(x, y);
    const cell = this.cellAt(x, y);
    if (cell === null || cell === this.lastCell) return;
    this.lastCell = cell;
    this.wipe(cell);
  }

  private wipe(cell: number): void {
    if (!this.session.isHumanTurn() || this.state.result) return;
    const move = `w${cell}`;
    if (!this.state.legalMoves(0).includes(move)) return;
    this.session.play(move);
  }

  private changed(): void {
    this.drawDirt();
    const s = this.state;
    if (s.result && !this.sparkled) {
      this.sparkled = true;
      cue('win');
      this.sparkle();
    } else if (s.wipes % 3 === 0) cue('tap');
  }

  /** Little four-point stars popping all over, the shine of something clean. */
  private sparkle(): void {
    for (let k = 0; k < 14; k++) {
      const x = AREA.x + ((k * 97) % AREA.w);
      const y = AREA.y + ((k * 151) % AREA.h);
      const star = this.add.graphics().setDepth(5).setPosition(x, y).setScale(0);
      star.fillStyle(0xffffff, 1);
      star.fillTriangle(-4, 0, 4, 0, 0, -18);
      star.fillTriangle(-4, 0, 4, 0, 0, 18);
      star.fillTriangle(0, -4, 0, 4, -18, 0);
      star.fillTriangle(0, -4, 0, 4, 18, 0);
      this.tweens.add({ targets: star, scale: 1.2, angle: 45, duration: 280, delay: k * 60, yoyo: true, onComplete: () => star.destroy() });
    }
  }

  private drawDirt(): void {
    const g = this.dirt.clear();
    const s = this.state;
    const color = GRIME[s.thing] ?? 0x8f8ba3;
    s.dirt.forEach((d, i) => {
      if (!d) return;
      const { x, y } = this.cellXY(i);
      // Soft overlapping blobs, a little off-centre each, so the grime looks smeared, not tiled.
      const jx = (((i * 37) % 11) - 5) * 1.6;
      const jy = (((i * 53) % 11) - 5) * 1.6;
      g.fillStyle(color, (d / CLEAN_COATS) * 0.8);
      g.fillCircle(x + jx, y + jy, CELL * 0.78);
    });
  }

  private drawThing(g: GameObjects.Graphics): void {
    const { x, y, w, h } = AREA;
    const thing = this.state.thing;
    if (thing === 'window') {
      // A sunny day through a wooden window.
      g.fillStyle(toHex('#BFE3FF'), 1);
      g.fillRect(x, y, w, h);
      g.fillStyle(toHex(COLORS.sunny), 1);
      g.fillCircle(x + w * 0.72, y + h * 0.22, 60);
      // Two hills and a strip of grass, all kept inside the window.
      g.fillStyle(toHex('#7FD89B'), 1);
      g.fillEllipse(x + w * 0.3, y + h * 0.82, w * 0.6, h * 0.36);
      g.fillStyle(toHex('#5CC47E'), 1);
      g.fillEllipse(x + w * 0.75, y + h * 0.86, w * 0.5, h * 0.28);
      g.fillRect(x, y + h * 0.9, w, h * 0.1);
      g.fillStyle(0xffffff, 1);
      g.fillEllipse(x + w * 0.3, y + h * 0.18, 120, 44);
      g.fillEllipse(x + w * 0.38, y + h * 0.16, 90, 50);
      g.lineStyle(22, toHex('#C98F5A'), 1);
      g.strokeRect(x, y, w, h);
      g.lineStyle(14, toHex('#C98F5A'), 1);
      g.lineBetween(x + w / 2, y, x + w / 2, y + h);
      g.lineBetween(x, y + h / 2, x + w, y + h / 2);
    } else if (thing === 'coin') {
      // A big gold coin with a star, on a soft cloth.
      g.fillStyle(toHex('#F4F1FB'), 1);
      g.fillRect(x, y, w, h);
      const cx = x + w / 2;
      const cy = y + h / 2;
      g.fillStyle(toHex(DARK.sunny), 1);
      g.fillCircle(cx, cy + 10, 240);
      g.fillStyle(toHex(COLORS.sunny), 1);
      g.fillCircle(cx, cy, 240);
      g.lineStyle(10, toHex(DARK.sunny), 1);
      g.strokeCircle(cx, cy, 205);
      const star: { x: number; y: number }[] = [];
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + (k * Math.PI) / 5;
        const r = k % 2 === 0 ? 120 : 50;
        star.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
      }
      g.fillStyle(toHex(DARK.sunny), 1);
      g.beginPath();
      g.moveTo(star[0]!.x, star[0]!.y);
      for (const p of star.slice(1)) g.lineTo(p.x, p.y);
      g.closePath();
      g.fillPath();
      g.fillStyle(0xffffff, 0.35);
      g.fillEllipse(cx - 90, cy - 110, 90, 40);
    } else {
      // A stripy rug with a row of diamonds and tassels.
      const stripes = [COLORS.tomato, COLORS.sunny, COLORS.mint, COLORS.sky, COLORS.grape, COLORS.peach];
      const band = h / 12;
      for (let k = 0; k < 12; k++) {
        g.fillStyle(toHex(stripes[k % stripes.length]!), 1);
        g.fillRect(x, y + k * band, w, band);
      }
      g.fillStyle(0xffffff, 0.85);
      for (let k = 0; k < 6; k++) {
        const cx = x + (k + 0.5) * (w / 6);
        const cy = y + h / 2;
        g.fillTriangle(cx - 30, cy, cx + 30, cy, cx, cy - 50);
        g.fillTriangle(cx - 30, cy, cx + 30, cy, cx, cy + 50);
      }
      g.lineStyle(4, toHex('#E9D3B0'), 1);
      for (let tx = x + 6; tx < x + w; tx += 16) {
        g.lineBetween(tx, y, tx, y - 14);
        g.lineBetween(tx, y + h, tx, y + h + 14);
      }
    }
  }

  /** The bands the page keeps to, for the layout check. */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    return [{ name: 'thing', top: AREA.y - 16, bottom: AREA.y + AREA.h + 16 }];
  }
}

export function cleanStatus(state: CleanState): string | undefined {
  if (state.result) return undefined;
  return `${state.clean}% clean`;
}

export function cleanResult(state: CleanState): string | undefined {
  if (!state.result) return undefined;
  return `Sparkling! ${state.wipes} wipes.`;
}
