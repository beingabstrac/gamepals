import { SAND_COLORS, type SandMove, type SandState } from '@gamepals/rules';
import { Scene, type GameObjects, type Textures } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { onKeys } from '../keys';

const W = 600;
const H = 940;
export const SAND_CANVAS = { width: W, height: H };
export const SAND_TINTS = [COLORS.peach];

/** The jar: a grid of sand cells, each drawn four canvas pixels square. */
const GW = 130;
const GH = 180;
const PX = 4;
const JAR = { x: (W - GW * PX) / 2, y: 40 };
const PALETTE = [COLORS.tomato, COLORS.peach, COLORS.sunny, COLORS.mint, COLORS.sky, COLORS.grape, COLORS.bubblegum];
const PALETTE_Y = 820;
const BUTTON_Y = 888;
const EMPTY: [number, number, number] = [255, 250, 240];
const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

/**
 * Sand Fall. The rules count pours; this scene is the toy: a jar of falling sand, each grain
 * dropping straight down if it can, sliding off to one side if not, so it piles in soft slopes and
 * stripes. Pick a color, drag in the jar to pour, Shake to empty it, Done when you like it.
 */
export class SandScene extends Scene {
  private grid = new Uint8Array(GW * GH);
  private texture!: Textures.CanvasTexture;
  private canvas!: HTMLCanvasElement;
  private image!: ImageData;
  private color = 0;
  private pourAt: { x: number; y: number } | null = null;
  private lastSent = 0;
  private frame = 0;
  private g!: GameObjects.Graphics;

  constructor(private readonly session: Session<SandMove>) {
    super('sand-fall');
  }

  private get state(): SandState {
    return this.session.state as SandState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    const frame = this.add.graphics();
    frame.fillStyle(toHex('#E6E0F4'), 1);
    frame.fillRoundedRect(JAR.x - 16, JAR.y - 16 + 8, GW * PX + 32, GH * PX + 32, 30);
    frame.fillStyle(toHex('#F4F1FB'), 1);
    frame.fillRoundedRect(JAR.x - 16, JAR.y - 16, GW * PX + 32, GH * PX + 32, 30);
    this.canvas = document.createElement('canvas');
    this.canvas.width = GW;
    this.canvas.height = GH;
    const ctx = this.canvas.getContext('2d')!;
    this.image = ctx.createImageData(GW, GH);
    const key = `sand-${Date.now()}`;
    this.texture = this.textures.addCanvas(key, this.canvas)!;
    this.events.once('shutdown', () => this.textures.remove(key));
    this.add.image(JAR.x, JAR.y, this.texture).setOrigin(0, 0).setScale(PX);
    this.g = this.add.graphics().setDepth(2);
    sharpText(this, W / 2 - 110, BUTTON_Y, 'Shake', 24, '#FFFFFF').setFontStyle('bold').setDepth(3);
    sharpText(this, W / 2 + 110, BUTTON_Y, 'Done', 24, '#FFFFFF').setFontStyle('bold').setDepth(3);
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.down(p.worldX, p.worldY));
    this.input.on('pointermove', (p: { worldX: number; worldY: number; isDown: boolean }) => {
      if (p.isDown && this.pourAt) this.pourAt = { x: p.worldX, y: p.worldY };
    });
    this.input.on('pointerup', () => (this.pourAt = null));
    onKeys(this, (key) => {
      const n = Number(key);
      if (n >= 1 && n <= SAND_COLORS) return (this.color = n - 1), this.drawControls(), true;
      if (key === ' ' || key === 'Enter') {
        // A keyboard pour: a burst from the middle of the jar top.
        this.burst(GW / 2 + ((this.frame * 7) % 40) - 20, 400);
        this.send(`p${this.color}`);
        return true;
      }
      if (key === 's' || key === 'S') return this.shake(), true;
      if (key === 'd' || key === 'D') return this.send('done'), true;
      return false;
    });
    const off = this.session.subscribe(() => this.changed());
    this.events.once('shutdown', off);
    this.drawControls();
  }

  private send(move: SandMove): void {
    if (!this.session.isHumanTurn() || this.state.result) return;
    this.session.play(move);
  }

  private down(x: number, y: number): void {
    if (Math.abs(y - PALETTE_Y) < 34) {
      const i = PALETTE.findIndex((_, k) => Math.abs(x - this.paletteX(k)) < 30);
      if (i >= 0) {
        this.color = i;
        cue('tap');
        this.drawControls();
      }
      return;
    }
    if (Math.abs(y - BUTTON_Y) < 30) {
      if (Math.abs(x - (W / 2 - 110)) < 90) return this.shake();
      if (Math.abs(x - (W / 2 + 110)) < 90) return this.send('done');
      return;
    }
    if (x > JAR.x && x < JAR.x + GW * PX && y > JAR.y && y < JAR.y + GH * PX) this.pourAt = { x, y };
  }

  private shake(): void {
    if (!this.session.isHumanTurn() || this.state.result) return;
    this.send('shake');
  }

  private paletteX(k: number): number {
    return W / 2 + (k - (PALETTE.length - 1) / 2) * 70;
  }

  /** Drops a handful of grains around a cell. */
  private pour(cx: number, cy: number, amount: number): void {
    for (let k = 0; k < amount; k++) {
      const x = Math.round(cx + (((k * 37 + this.frame * 13) % 7) - 3));
      const y = Math.round(cy - (k % 3));
      if (x < 0 || y < 0 || x >= GW || y >= GH) continue;
      if (this.grid[y * GW + x] === 0) this.grid[y * GW + x] = this.color + 1;
    }
  }

  /** A bigger pour, for bots and keys: it falls from the top of the jar in a stream. */
  private burst(cx: number, grains: number): void {
    for (let k = 0; k < grains; k++) {
      const x = Math.round(cx + (((k * 29) % 13) - 6));
      const y = (k * 7) % 12;
      if (x >= 0 && x < GW && this.grid[y * GW + x] === 0) this.grid[y * GW + x] = this.color + 1;
    }
  }

  private changed(): void {
    const last = this.state.last;
    if (!last) return;
    if (last === 'shake') {
      this.grid.fill(0);
      this.cameras.main.shake(260, 0.012);
      cue('roll');
    } else if (last === 'done') cue('win');
    else if (!this.pourAt) {
      // A pour that did not come from a finger (a bot, in test mode): a stream at a spot of its own.
      this.color = Number(last.slice(1));
      this.burst(12 + ((this.state.pours * 37) % (GW - 24)), 180);
    }
  }

  /** One step of the sand: each grain falls, or slides off to a side, bottom rows first. */
  private stepSand(): void {
    const g = this.grid;
    const flip = this.frame % 2 === 0;
    for (let y = GH - 2; y >= 0; y--) {
      for (let i = 0; i < GW; i++) {
        const x = flip ? i : GW - 1 - i;
        const c = g[y * GW + x]!;
        if (!c) continue;
        const below = (y + 1) * GW + x;
        if (g[below] === 0) {
          g[below] = c;
          g[y * GW + x] = 0;
          continue;
        }
        const first = (x + y + this.frame) % 2 === 0 ? -1 : 1;
        for (const d of [first, -first]) {
          const nx = x + d;
          if (nx < 0 || nx >= GW) continue;
          if (g[(y + 1) * GW + nx] === 0) {
            g[(y + 1) * GW + nx] = c;
            g[y * GW + x] = 0;
            break;
          }
        }
      }
    }
  }

  update(time: number): void {
    this.frame++;
    if (this.pourAt && this.session.isHumanTurn() && !this.state.result) {
      this.pour((this.pourAt.x - JAR.x) / PX, (this.pourAt.y - JAR.y) / PX, 6);
      // The rules hear about pouring a few times a second, not every grain.
      if (time - this.lastSent > 300) {
        this.lastSent = time;
        this.send(`p${this.color}`);
      }
    }
    this.stepSand();
    this.render();
  }

  private render(): void {
    const data = this.image.data;
    const colors = [EMPTY, ...PALETTE.map(rgb)];
    for (let i = 0; i < this.grid.length; i++) {
      const [r, g, b] = colors[this.grid[i]!]!;
      data[i * 4] = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
      data[i * 4 + 3] = 255;
    }
    this.canvas.getContext('2d')!.putImageData(this.image, 0, 0);
    this.texture.refresh();
  }

  private drawControls(): void {
    const g = this.g.clear();
    PALETTE.forEach((c, k) => {
      const x = this.paletteX(k);
      if (k === this.color) {
        g.fillStyle(toHex(COLORS.ink), 1);
        g.fillCircle(x, PALETTE_Y, 30);
      }
      g.fillStyle(toHex(c), 1);
      g.fillCircle(x, PALETTE_Y, 24);
    });
    for (const [x, color, dark] of [
      [W / 2 - 110, COLORS.sky, DARK.sky],
      [W / 2 + 110, COLORS.mint, DARK.mint],
    ] as const) {
      g.fillStyle(toHex(dark), 1);
      g.fillRoundedRect(x - 90, BUTTON_Y - 28 + 6, 180, 56, 28);
      g.fillStyle(toHex(color), 1);
      g.fillRoundedRect(x - 90, BUTTON_Y - 28, 180, 56, 28);
    }
  }

  /** The bands the toy keeps to, for the layout check. */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    return [
      { name: 'jar', top: JAR.y - 16, bottom: JAR.y + GH * PX + 24 },
      { name: 'palette', top: PALETTE_Y - 30, bottom: PALETTE_Y + 30 },
      { name: 'buttons', top: BUTTON_Y - 28, bottom: BUTTON_Y + 34 },
    ];
  }
}

export function sandStatus(state: SandState): string | undefined {
  if (state.result) return undefined;
  return 'Pick a color and pour';
}

export function sandResult(state: SandState): string | undefined {
  if (!state.result) return undefined;
  return 'A jar of stripes. Lovely.';
}
