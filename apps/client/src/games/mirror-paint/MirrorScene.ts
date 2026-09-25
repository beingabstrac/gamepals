import { MIRROR_BRUSHES, MIRROR_COLORS, MIRROR_WAYS, type MirrorMove, type MirrorState } from '@gamepals/rules';
import { Scene, type GameObjects, type Textures } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { arrow, onKeys } from '../keys';

const W = 600;
const H = 900;
export const MIRROR_SIZE = { width: W, height: H };
export const MIRROR_TINTS = [COLORS.bubblegum];

const CX = W / 2;
const CY = 320;
const RADIUS = 270;
/** The paint is drawn at twice the size and shown at half, so lines stay crisp. */
const RES = 2;
const WAYS_Y = 640;
const COLORS_Y = 720;
const TOOLS_Y = 810;
const PAINT = [COLORS.tomato, COLORS.peach, COLORS.sunny, COLORS.mint, COLORS.sky, COLORS.grape, COLORS.bubblegum];

/**
 * Mirror Paint. The rules keep the settings and count strokes; the scene paints: every point of a
 * stroke is turned round the middle into each slice and mirrored across it, on a 2D canvas that
 * is shown as a texture.
 */
export class MirrorScene extends Scene {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private texture!: Textures.CanvasTexture;
  private dirty = true;
  private ui!: GameObjects.Graphics;
  private pen: { x: number; y: number } | null = null;
  private keyPen = { x: 60, y: -40, drawing: false };
  /** Set while a finger or a key sends a stroke it has already painted (the play is synchronous). */
  private paintedHere = false;

  constructor(private readonly session: Session<MirrorMove>) {
    super('mirror-paint');
  }

  private get state(): MirrorState {
    return this.session.state as MirrorState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    const g = this.add.graphics();
    g.fillStyle(toHex('#E6E0F4'), 1);
    g.fillCircle(CX, CY + 8, RADIUS + 12);
    g.fillStyle(toHex('#F4F1FB'), 1);
    g.fillCircle(CX, CY, RADIUS + 12);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = RADIUS * 2 * RES;
    this.ctx = this.canvas.getContext('2d')!;
    const c = this.ctx;
    c.beginPath();
    c.arc(RADIUS * RES, RADIUS * RES, RADIUS * RES, 0, Math.PI * 2);
    c.clip();
    c.lineCap = 'round';
    c.lineJoin = 'round';
    this.wipe();
    const key = `mirror-${Date.now()}`;
    this.texture = this.textures.addCanvas(key, this.canvas)!;
    this.events.once('shutdown', () => this.textures.remove(key));
    this.add.image(CX - RADIUS, CY - RADIUS, this.texture).setOrigin(0, 0).setScale(1 / RES);
    this.ui = this.add.graphics();
    MIRROR_WAYS.forEach((n, k) => sharpText(this, this.waysX(k), WAYS_Y, `${n * 2}`, 22, COLORS.ink).setFontStyle('bold').setDepth(1));
    sharpText(this, W / 2 + 60, TOOLS_Y, 'Clear', 22, '#FFFFFF').setFontStyle('bold').setDepth(1);
    sharpText(this, W / 2 + 200, TOOLS_Y, 'Done', 22, '#FFFFFF').setFontStyle('bold').setDepth(1);
    this.drawUi();
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.down(p.worldX, p.worldY));
    this.input.on('pointermove', (p: { worldX: number; worldY: number; isDown: boolean }) => p.isDown && this.move(p.worldX, p.worldY));
    this.input.on('pointerup', () => this.lift());
    onKeys(this, (key) => this.key(key));
    const off = this.session.subscribe(() => this.changed());
    this.events.once('shutdown', off);
  }

  private waysX(k: number): number {
    return W / 2 + (k - 1.5) * 90;
  }

  private colorX(k: number): number {
    return W / 2 + (k - 3) * 70;
  }

  private brushX(k: number): number {
    return 70 + k * 56;
  }

  private send(move: MirrorMove): void {
    if (!this.session.isHumanTurn() || this.state.result) return;
    if (this.state.legalMoves(0).includes(move)) this.session.play(move);
  }

  private wipe(): void {
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.dirty = true;
  }

  /** One piece of a stroke, copied into every slice and mirrored across each. */
  private segment(ax: number, ay: number, bx: number, by: number): void {
    const s = this.state;
    const ways = MIRROR_WAYS[s.ways]!;
    const c = this.ctx;
    c.strokeStyle = PAINT[s.color]!;
    c.lineWidth = MIRROR_BRUSHES[s.brush]! * RES;
    const mid = RADIUS * RES;
    c.beginPath();
    for (let k = 0; k < ways; k++) {
      const t = (k * Math.PI * 2) / ways;
      const cos = Math.cos(t);
      const sin = Math.sin(t);
      for (const flip of [1, -1]) {
        const turn = (x: number, y: number) => [mid + (x * cos - y * flip * sin) * RES, mid + (x * sin + y * flip * cos) * RES] as const;
        const [x1, y1] = turn(ax, ay);
        const [x2, y2] = turn(bx, by);
        c.moveTo(x1, y1);
        c.lineTo(x2, y2);
      }
    }
    c.stroke();
    this.dirty = true;
  }

  private down(x: number, y: number): void {
    if (Math.abs(y - WAYS_Y) < 26) {
      const k = MIRROR_WAYS.findIndex((_, i) => Math.abs(x - this.waysX(i)) < 40);
      if (k >= 0) this.send(`w${k}`);
      return;
    }
    if (Math.abs(y - COLORS_Y) < 30) {
      const k = PAINT.findIndex((_, i) => Math.abs(x - this.colorX(i)) < 30);
      if (k >= 0) this.send(`k${k}`);
      return;
    }
    if (Math.abs(y - TOOLS_Y) < 30) {
      const b = MIRROR_BRUSHES.findIndex((_, i) => Math.abs(x - this.brushX(i)) < 26);
      if (b >= 0) return this.send(`b${b}`);
      if (Math.abs(x - (W / 2 + 60)) < 60) return this.send('clear');
      if (Math.abs(x - (W / 2 + 200)) < 60) return this.send('done');
      return;
    }
    if (Math.hypot(x - CX, y - CY) > RADIUS || this.state.result) return;
    this.pen = { x: x - CX, y: y - CY };
    // A tap leaves a dot.
    this.segment(this.pen.x, this.pen.y, this.pen.x + 0.1, this.pen.y);
  }

  private move(x: number, y: number): void {
    if (!this.pen || this.state.result) return;
    const next = { x: x - CX, y: y - CY };
    this.segment(this.pen.x, this.pen.y, next.x, next.y);
    this.pen = next;
  }

  private lift(): void {
    if (!this.pen) return;
    this.pen = null;
    this.strokeSent();
  }

  private strokeSent(): void {
    this.paintedHere = true;
    this.send('s');
    this.paintedHere = false;
  }

  private key(key: string): boolean {
    const n = Number(key);
    if (n >= 1 && n <= MIRROR_COLORS) return this.send(`k${n - 1}`), true;
    if (key === 'm' || key === 'M') return this.send(`w${(this.state.ways + 1) % MIRROR_WAYS.length}`), true;
    if (key === 'b' || key === 'B') return this.send(`b${(this.state.brush + 1) % MIRROR_BRUSHES.length}`), true;
    if (key === 'c' || key === 'C') return this.send('clear'), true;
    if (key === 'd' || key === 'D') return this.send('done'), true;
    const step = arrow(key);
    if (step) {
      // The arrows draw from a pen of their own; Space or Enter lifts it.
      const p = this.keyPen;
      const nx = Math.max(-RADIUS, Math.min(RADIUS, p.x + step[0] * 14));
      const ny = Math.max(-RADIUS, Math.min(RADIUS, p.y + step[1] * 14));
      this.segment(p.x, p.y, nx, ny);
      this.keyPen = { x: nx, y: ny, drawing: true };
      return true;
    }
    if ((key === ' ' || key === 'Enter') && this.keyPen.drawing) {
      this.keyPen.drawing = false;
      this.strokeSent();
      return true;
    }
    return false;
  }

  private changed(): void {
    const s = this.state;
    const last = s.last;
    if (!last) return;
    if (last === 'done') return void cue('win');
    if (last === 'clear') {
      this.wipe();
      cue('pull');
      return;
    }
    if (last === 's') {
      // A stroke from a bot (in test mode) paints a loop of its own; a finger's is already there.
      if (!this.paintedHere) {
        const k = s.strokes;
        const r0 = 40 + ((k * 53) % 180);
        let prev = { x: r0, y: 0 };
        for (let t = 1; t <= 24; t++) {
          const a = (t / 24) * Math.PI * 0.9 + k;
          const r = r0 + Math.sin(t / 3 + k) * 30;
          const next = { x: Math.cos(a) * r, y: Math.sin(a) * r };
          if (t > 1) this.segment(prev.x, prev.y, next.x, next.y);
          prev = next;
        }
      }
      cue('tap');
      return;
    }
    cue('place');
    this.drawUi();
  }

  update(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.texture.refresh();
  }

  private drawUi(): void {
    const g = this.ui.clear();
    const s = this.state;
    MIRROR_WAYS.forEach((_, k) => {
      const x = this.waysX(k);
      const on = k === s.ways;
      g.fillStyle(toHex(on ? DARK.bubblegum : '#D9D3EC'), 1);
      g.fillRoundedRect(x - 36, WAYS_Y - 24 + 5, 72, 48, 24);
      g.fillStyle(toHex(on ? COLORS.bubblegum : '#FFFFFF'), 1);
      g.fillRoundedRect(x - 36, WAYS_Y - 24, 72, 48, 24);
    });
    PAINT.forEach((c, k) => {
      const x = this.colorX(k);
      if (k === s.color) {
        g.fillStyle(toHex(COLORS.ink), 1);
        g.fillCircle(x, COLORS_Y, 30);
      }
      g.fillStyle(toHex(c), 1);
      g.fillCircle(x, COLORS_Y, 24);
    });
    MIRROR_BRUSHES.forEach((size, k) => {
      const x = this.brushX(k);
      g.fillStyle(toHex(k === s.brush ? COLORS.ink : '#D9D3EC'), 1);
      g.fillCircle(x, TOOLS_Y, 24);
      g.fillStyle(toHex(PAINT[s.color]!), 1);
      g.fillCircle(x, TOOLS_Y, size / 2 + 3);
    });
    for (const [x, color, dark] of [
      [W / 2 + 60, COLORS.sky, DARK.sky],
      [W / 2 + 200, COLORS.mint, DARK.mint],
    ] as const) {
      g.fillStyle(toHex(dark), 1);
      g.fillRoundedRect(x - 60, TOOLS_Y - 26 + 5, 120, 52, 26);
      g.fillStyle(toHex(color), 1);
      g.fillRoundedRect(x - 60, TOOLS_Y - 26, 120, 52, 26);
    }
  }

  layoutCheck(): { name: string; top: number; bottom: number }[] {
    return [
      { name: 'the canvas', top: CY - RADIUS - 12, bottom: CY + RADIUS + 20 },
      { name: 'mirrors', top: WAYS_Y - 24, bottom: WAYS_Y + 29 },
      { name: 'colors', top: COLORS_Y - 30, bottom: COLORS_Y + 30 },
      { name: 'tools', top: TOOLS_Y - 26, bottom: TOOLS_Y + 31 },
    ];
  }
}

export function mirrorStatus(state: MirrorState): string | undefined {
  if (state.result) return undefined;
  return state.strokes ? `${state.strokes} ${state.strokes === 1 ? 'stroke' : 'strokes'}` : 'Drag in the circle to paint';
}

export function mirrorResult(state: MirrorState): string | undefined {
  return state.result ? `A pattern in ${state.strokes} ${state.strokes === 1 ? 'stroke' : 'strokes'}.` : undefined;
}
