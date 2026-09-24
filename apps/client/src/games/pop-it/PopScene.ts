import { popCells, type PopMove, type PopState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { focusRing, moveRing, onKeys } from '../keys';

const W = 600;
const H = 760;
export const POP_CANVAS = { width: W, height: H };
export const POP_COLORS = [COLORS.bubblegum];

const STEP = 60;
const R = 25;
const FLIP_Y = 690;
/** Rainbow rows, top to bottom; the far side runs the other way round. */
const RAINBOW = [COLORS.tomato, COLORS.peach, COLORS.sunny, COLORS.mint, COLORS.sky, COLORS.grape, COLORS.bubblegum, COLORS.tomato, COLORS.peach];
const RAINBOW_DARK = [DARK.tomato, DARK.peach, DARK.sunny, DARK.mint, DARK.sky, DARK.grape, DARK.bubblegum, DARK.tomato, DARK.peach];

/**
 * Pop It. The rules count the bubbles; the scene is the toy: rainbow domes that sink with a pop
 * when pressed, a drag that pops a whole run, and a flip that turns the sheet over with every
 * bubble up again. No clock, no score to chase.
 */
export class PopScene extends Scene {
  private g!: GameObjects.Graphics;
  private flipText!: GameObjects.Text;
  private ring!: GameObjects.Graphics;
  private cells: { col: number; row: number }[] = [];
  private dragging = false;
  private pressed = new Set<number>();
  private squash = new Map<number, number>();
  private focus = 0;

  constructor(private readonly session: Session<PopMove>) {
    super('pop-it');
  }

  private get state(): PopState {
    return this.session.state as PopState;
  }

  private cellXY(i: number): { x: number; y: number } {
    const c = this.cells[i]!;
    const cols = Math.max(...this.cells.map((k) => k.col)) + 1;
    const rows = Math.max(...this.cells.map((k) => k.row)) + 1;
    return { x: W / 2 + (c.col - (cols - 1) / 2) * STEP, y: 70 + (FLIP_Y - 120) / 2 + (c.row - (rows - 1) / 2) * STEP };
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.cells = popCells(this.state.shape);
    this.g = this.add.graphics();
    this.flipText = sharpText(this, W / 2, FLIP_Y, 'Flip it over', 28, '#FFFFFF').setFontStyle('bold').setDepth(3);
    this.ring = focusRing(this, R * 2 + 12, R * 2 + 12, R + 6);
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      this.ring.setVisible(false);
      if (this.state.allDown && Math.abs(p.worldY - FLIP_Y) < 34) return this.flip();
      this.dragging = true;
      this.pressed.clear();
      this.pressAt(p.worldX, p.worldY);
    });
    this.input.on('pointermove', (p: { worldX: number; worldY: number; isDown: boolean }) => {
      if (this.dragging && p.isDown) this.pressAt(p.worldX, p.worldY);
    });
    const up = () => (this.dragging = false);
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
    onKeys(this, (key) => this.key(key));
    const off = this.session.subscribe(() => this.changed());
    this.events.once('shutdown', off);
    this.draw();
  }

  update(time: number): void {
    let any = false;
    for (const [i, t] of this.squash) {
      if (time - t > 220) this.squash.delete(i);
      else any = true;
    }
    if (any) this.draw();
  }

  private pressAt(x: number, y: number): void {
    const i = this.cells.findIndex((_, k) => {
      const c = this.cellXY(k);
      return Math.hypot(x - c.x, y - c.y) < R + 4;
    });
    if (i < 0 || this.pressed.has(i)) return;
    this.pressed.add(i);
    this.press(i);
  }

  private press(i: number): void {
    if (!this.session.isHumanTurn() || this.state.down[i]) return;
    this.session.play(`p${i}`);
  }

  private flip(): void {
    if (!this.session.isHumanTurn() || !this.state.legalMoves(0).includes('flip')) return;
    cue('roll');
    // The sheet turns over: squeezed flat, then open again with every bubble up.
    this.tweens.add({
      targets: this.g,
      scaleX: 0.02,
      x: W / 2,
      duration: 180,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.session.play('flip');
        this.tweens.add({ targets: this.g, scaleX: 1, x: 0, duration: 220, ease: 'Back.easeOut' });
      },
    });
  }

  private changed(): void {
    const last = this.state.last;
    if (last !== null) {
      this.squash.set(last, this.time.now);
      cue('tap');
    }
    if (this.state.result) cue('win');
    this.draw();
  }

  private key(key: string): boolean {
    const n = this.cells.length;
    if (key === 'ArrowRight' || key === 'ArrowLeft' || key === 'ArrowUp' || key === 'ArrowDown') {
      this.focus = (this.focus + (key === 'ArrowRight' || key === 'ArrowDown' ? 1 : n - 1)) % n;
      const { x, y } = this.cellXY(this.focus);
      moveRing(this, this.ring, x, y);
      return true;
    }
    if (key === ' ' || key === 'Enter') {
      if (this.state.allDown) this.flip();
      else this.press(this.focus);
      return true;
    }
    if (key === 'f' || key === 'F') {
      this.flip();
      return true;
    }
    return false;
  }

  private draw(): void {
    const state = this.state;
    const g = this.g.clear();
    const rows = Math.max(...this.cells.map((k) => k.row)) + 1;
    // The squashy base, as a rounded outline round every bubble.
    for (let i = 0; i < this.cells.length; i++) {
      const { x, y } = this.cellXY(i);
      g.fillStyle(0xe6e0f4, 1);
      g.fillCircle(x, y + 6, STEP * 0.62);
    }
    for (let i = 0; i < this.cells.length; i++) {
      const { x, y } = this.cellXY(i);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(x, y, STEP * 0.62);
    }
    this.cells.forEach((c, i) => {
      const { x, y } = this.cellXY(i);
      const band = state.side === 0 ? c.row : rows - 1 - c.row;
      const color = toHex(RAINBOW[band % RAINBOW.length]!);
      const dark = toHex(RAINBOW_DARK[band % RAINBOW_DARK.length]!);
      const down = state.down[i];
      const squash = this.squash.has(i) ? 1 - (this.time.now - this.squash.get(i)!) / 220 : 0;
      if (!down) {
        // Up: a dome, lip below, a highlight on top.
        g.fillStyle(dark, 1);
        g.fillCircle(x, y + 4, R);
        g.fillStyle(color, 1);
        g.fillCircle(x, y, R);
        g.fillStyle(0xffffff, 0.5);
        g.fillEllipse(x - R * 0.3, y - R * 0.35, R * 0.7, R * 0.4);
      } else {
        // Down: a dip, darker, the light caught on its lower edge; it wobbles for a moment after the pop.
        const r = R * (1 - squash * 0.12);
        g.fillStyle(dark, 1);
        g.fillCircle(x, y + 2, r);
        g.fillStyle(color, 0.85);
        g.fillCircle(x, y + 3, r * 0.8);
        g.fillStyle(0xffffff, 0.35);
        g.fillEllipse(x + r * 0.2, y + r * 0.45, r * 0.8, r * 0.25);
      }
    });
    const showFlip = state.allDown && !state.result;
    this.flipText.setVisible(showFlip);
    if (showFlip) {
      g.fillStyle(toHex(DARK.bubblegum), 1);
      g.fillRoundedRect(W / 2 - 130, FLIP_Y - 30 + 6, 260, 60, 30);
      g.fillStyle(toHex(COLORS.bubblegum), 1);
      g.fillRoundedRect(W / 2 - 130, FLIP_Y - 30, 260, 60, 30);
    }
  }
}

export function popStatus(state: PopState): string | undefined {
  if (state.result) return undefined;
  const left = state.down.filter((d) => !d).length;
  if (!left) return 'All popped. Flip it over!';
  return state.side === 0 ? `${left} to pop on this side` : `${left} to pop on the other side`;
}

export function popResult(state: PopState): string | undefined {
  return state.result ? `Both sides popped: ${state.pops} pops. Ahh.` : undefined;
}
