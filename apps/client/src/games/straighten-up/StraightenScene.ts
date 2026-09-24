import { LEVEL, TILT_MAX, turnMove, type StraightenMove, type StraightenState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera } from '../crisp';
import { focusRing, moveRing, onKeys } from '../keys';

const W = 600;
const H = 860;
export const STRAIGHTEN_CANVAS = { width: W, height: H };
export const STRAIGHTEN_COLORS = [COLORS.peach];

/** Where each frame hangs: its nail, and the frame's size below it. */
interface Hang {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}
const LAYOUTS: Record<number, readonly Hang[]> = {
  3: [
    { x: 300, y: 70, w: 260, h: 190 },
    { x: 165, y: 390, w: 200, h: 240 },
    { x: 440, y: 420, w: 210, h: 170 },
  ],
  5: [
    { x: 160, y: 60, w: 200, h: 160 },
    { x: 430, y: 70, w: 190, h: 190 },
    { x: 300, y: 330, w: 240, h: 170 },
    { x: 150, y: 590, w: 190, h: 190 },
    { x: 440, y: 600, w: 200, h: 170 },
  ],
  7: [
    { x: 155, y: 50, w: 190, h: 150 },
    { x: 430, y: 60, w: 190, h: 170 },
    { x: 120, y: 300, w: 150, h: 190 },
    { x: 310, y: 300, w: 160, h: 150 },
    { x: 500, y: 310, w: 130, h: 170 },
    { x: 180, y: 580, w: 210, h: 160 },
    { x: 450, y: 590, w: 180, h: 200 },
  ],
};
const FRAME_COLORS = [COLORS.peach, COLORS.sky, COLORS.mint, COLORS.grape, COLORS.bubblegum, COLORS.sunny, COLORS.tomato];
const FRAME_DARK = [DARK.peach, DARK.sky, DARK.mint, DARK.grape, DARK.bubblegum, DARK.sunny, DARK.tomato];
const STRING = 34;

/**
 * Straighten Up. The rules keep each frame's tilt; the scene hangs every frame from a nail on two
 * strings, turns it round the nail as you push it, shows a little spirit level under each, and
 * clicks it straight with a settle when it comes level.
 */
export class StraightenScene extends Scene {
  private frames: GameObjects.Container[] = [];
  private bubbles: GameObjects.Graphics[] = [];
  private ring!: GameObjects.Graphics;
  private hold: { i: number; from: number; start: number } | null = null;
  private focus = 0;

  constructor(private readonly session: Session<StraightenMove>) {
    super('straighten-up');
  }

  private get state(): StraightenState {
    return this.session.state as StraightenState;
  }

  private get hangs(): readonly Hang[] {
    return LAYOUTS[this.state.tilts.length] ?? LAYOUTS[3]!;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.drawWall();
    this.hangs.forEach((h, i) => {
      const box = this.frame(h, i);
      box.setAngle(this.state.tilts[i]!);
      this.frames.push(box);
    });
    this.ring = focusRing(this, 60, 60, 30);
    this.drawBubbles();
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      this.ring.setVisible(false);
      const i = this.hangs.findIndex((h) => Math.abs(p.worldX - h.x) < h.w / 2 + 10 && p.worldY > h.y && p.worldY < h.y + STRING + h.h + 10);
      if (i < 0 || !this.session.isHumanTurn() || this.state.result) return;
      this.hold = { i, from: this.state.tilts[i]!, start: this.pushAngle(i, p.worldX, p.worldY) };
      cue('tap');
    });
    this.input.on('pointermove', (p: { worldX: number; worldY: number; isDown: boolean }) => {
      if (!this.hold || !p.isDown) return;
      const { i, from, start } = this.hold;
      const deg = Math.max(-TILT_MAX, Math.min(TILT_MAX, from + (this.pushAngle(i, p.worldX, p.worldY) - start)));
      this.frames[i]!.setAngle(deg);
      this.drawBubbles();
    });
    this.input.on('pointerup', () => {
      const h = this.hold;
      this.hold = null;
      if (!h) return;
      this.turn(h.i, Math.round(this.frames[h.i]!.angle));
    });
    onKeys(this, (key) => this.key(key));
    const off = this.session.subscribe(() => this.changed());
    this.events.once('shutdown', off);
  }

  /** The angle, in degrees, from a frame's nail to the finger: pushing a frame turns it round the nail. */
  private pushAngle(i: number, x: number, y: number): number {
    const h = this.hangs[i]!;
    return (-Math.atan2(x - h.x, y - h.y) * 180) / Math.PI;
  }

  private turn(i: number, deg: number): void {
    const move = turnMove(i, deg);
    if (!this.state.legalMoves(0).includes(move)) {
      this.frames[i]!.setAngle(this.state.tilts[i]!);
      this.drawBubbles();
      return;
    }
    this.session.play(move);
  }

  private key(key: string): boolean {
    const n = this.state.tilts.length;
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      this.focus = (this.focus + (key === 'ArrowLeft' ? n - 1 : 1)) % n;
      const h = this.hangs[this.focus]!;
      moveRing(this, this.ring, h.x, h.y);
      return true;
    }
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      if (!this.session.isHumanTurn() || this.state.result) return true;
      const t = this.state.tilts[this.focus]!;
      this.turn(this.focus, Math.max(-TILT_MAX, Math.min(TILT_MAX, t + (key === 'ArrowUp' ? 2 : -2))));
      return true;
    }
    return false;
  }

  private changed(): void {
    const s = this.state;
    const i = s.last;
    if (i === null) return;
    const t = s.tilts[i]!;
    const box = this.frames[i]!;
    if (t === 0) {
      // Level: it clicks straight and settles with a little swing.
      cue(s.result ? 'win' : 'place');
      this.tweens.add({ targets: box, angle: { from: box.angle, to: 0 }, duration: 380, ease: 'Elastic.easeOut' });
    } else {
      cue('tap');
      this.tweens.add({ targets: box, angle: t, duration: 120 });
    }
    this.time.delayedCall(400, () => this.drawBubbles());
    this.drawBubbles();
  }

  private frame(h: Hang, i: number): GameObjects.Container {
    const g = this.add.graphics();
    const color = FRAME_COLORS[i % FRAME_COLORS.length]!;
    const dark = FRAME_DARK[i % FRAME_DARK.length]!;
    const top = STRING;
    // Strings from the nail to the frame's top corners.
    g.lineStyle(3, toHex(COLORS.soft), 1);
    g.lineBetween(0, 0, -h.w * 0.3, top);
    g.lineBetween(0, 0, h.w * 0.3, top);
    g.fillStyle(0x000000, 0.1);
    g.fillRoundedRect(-h.w / 2 + 6, top + 8, h.w, h.h, 14);
    g.fillStyle(toHex(dark), 1);
    g.fillRoundedRect(-h.w / 2, top + 4, h.w, h.h, 14);
    g.fillStyle(toHex(color), 1);
    g.fillRoundedRect(-h.w / 2, top, h.w, h.h, 14);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(-h.w / 2 + 14, top + 14, h.w - 28, h.h - 28, 8);
    this.picture(g, this.state.pictures[i]!, 0, top + h.h / 2, Math.min(h.w, h.h) * 0.32);
    const bubble = this.add.graphics();
    this.bubbles[i] = bubble;
    const box = this.add.container(h.x, h.y, [g, bubble]);
    // The nail, drawn on the wall, not turning with the frame.
    const nail = this.add.graphics().setDepth(3);
    nail.fillStyle(toHex(COLORS.ink), 1);
    nail.fillCircle(h.x, h.y, 6);
    nail.fillStyle(0xffffff, 0.5);
    nail.fillCircle(h.x - 2, h.y - 2, 2);
    return box;
  }

  /** A tiny spirit level under each frame: the bubble sits in the middle, and goes green, when it is straight. */
  private drawBubbles(): void {
    this.hangs.forEach((h, i) => {
      const g = this.bubbles[i]!.clear();
      const y = STRING + h.h - 12;
      const angle = this.frames[i]?.angle ?? this.state.tilts[i]!;
      const level = Math.abs(angle) <= LEVEL;
      g.fillStyle(0xffffff, 1);
      g.fillRoundedRect(-34, y - 7, 68, 14, 7);
      g.lineStyle(2, toHex(level ? COLORS.mint : COLORS.line), 1);
      g.strokeRoundedRect(-34, y - 7, 68, 14, 7);
      // The bubble rises to the high end, as a real one does.
      const off = Math.max(-26, Math.min(26, angle * 1.2));
      g.fillStyle(toHex(level ? COLORS.mint : COLORS.sunny), 1);
      g.fillCircle(off, y, 5);
    });
  }

  private picture(g: GameObjects.Graphics, kind: number, x: number, y: number, s: number): void {
    const c = (hex: string) => toHex(hex);
    switch (kind) {
      case 0: // sun
        g.fillStyle(c(COLORS.sunny), 1);
        g.fillCircle(x, y, s * 0.5);
        for (let k = 0; k < 8; k++) {
          const a = (k * Math.PI) / 4;
          g.fillCircle(x + Math.cos(a) * s * 0.78, y + Math.sin(a) * s * 0.78, s * 0.1);
        }
        break;
      case 1: // tree
        g.fillStyle(c('#C98F5A'), 1);
        g.fillRect(x - s * 0.1, y, s * 0.2, s * 0.6);
        g.fillStyle(c(COLORS.mint), 1);
        g.fillCircle(x, y - s * 0.15, s * 0.5);
        break;
      case 2: // heart
        g.fillStyle(c(COLORS.tomato), 1);
        g.fillCircle(x - s * 0.25, y - s * 0.15, s * 0.3);
        g.fillCircle(x + s * 0.25, y - s * 0.15, s * 0.3);
        g.fillTriangle(x - s * 0.54, y - s * 0.05, x + s * 0.54, y - s * 0.05, x, y + s * 0.55);
        break;
      case 3: // boat
        g.fillStyle(c(COLORS.sky), 1);
        g.fillRect(x - s * 0.8, y + s * 0.4, s * 1.6, s * 0.2);
        g.fillStyle(c(COLORS.peach), 1);
        g.fillTriangle(x - s * 0.6, y + s * 0.1, x + s * 0.6, y + s * 0.1, x + s * 0.4, y + s * 0.4);
        g.fillTriangle(x - s * 0.6, y + s * 0.1, x - s * 0.4, y + s * 0.4, x + s * 0.4, y + s * 0.4);
        g.fillStyle(c(COLORS.bubblegum), 1);
        g.fillTriangle(x, y - s * 0.6, x, y + s * 0.05, x + s * 0.45, y + s * 0.05);
        break;
      case 4: // cat face
        g.fillStyle(c(COLORS.peach), 1);
        g.fillTriangle(x - s * 0.5, y - s * 0.2, x - s * 0.2, y - s * 0.45, x - s * 0.45, y - s * 0.7);
        g.fillTriangle(x + s * 0.5, y - s * 0.2, x + s * 0.2, y - s * 0.45, x + s * 0.45, y - s * 0.7);
        g.fillCircle(x, y, s * 0.5);
        g.fillStyle(c(COLORS.ink), 1);
        g.fillCircle(x - s * 0.18, y - s * 0.05, s * 0.06);
        g.fillCircle(x + s * 0.18, y - s * 0.05, s * 0.06);
        break;
      case 5: // flower
        g.fillStyle(c(COLORS.bubblegum), 1);
        for (let k = 0; k < 5; k++) {
          const a = (k * Math.PI * 2) / 5;
          g.fillCircle(x + Math.cos(a) * s * 0.32, y + Math.sin(a) * s * 0.32, s * 0.22);
        }
        g.fillStyle(c(COLORS.sunny), 1);
        g.fillCircle(x, y, s * 0.18);
        break;
      case 6: // mountain
        g.fillStyle(c(COLORS.grape), 1);
        g.fillTriangle(x - s * 0.8, y + s * 0.5, x + s * 0.2, y + s * 0.5, x - s * 0.3, y - s * 0.4);
        g.fillStyle(c(COLORS.sky), 1);
        g.fillTriangle(x - s * 0.2, y + s * 0.5, x + s * 0.8, y + s * 0.5, x + s * 0.3, y - s * 0.6);
        g.fillStyle(0xffffff, 1);
        g.fillTriangle(x + s * 0.18, y - s * 0.38, x + s * 0.42, y - s * 0.38, x + s * 0.3, y - s * 0.6);
        break;
      default: {
        // star
        const pts: { x: number; y: number }[] = [];
        for (let k = 0; k < 10; k++) {
          const a = -Math.PI / 2 + (k * Math.PI) / 5;
          const r = k % 2 === 0 ? s * 0.6 : s * 0.25;
          pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
        }
        g.fillStyle(c(COLORS.sunny), 1);
        g.beginPath();
        g.moveTo(pts[0]!.x, pts[0]!.y);
        for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
        g.closePath();
        g.fillPath();
      }
    }
  }

  private drawWall(): void {
    const g = this.add.graphics();
    g.fillStyle(toHex('#FFF6EC'), 1);
    g.fillRect(0, 0, W, H);
    g.fillStyle(toHex('#FBE9D6'), 1);
    for (let x = 0; x < W; x += 60) g.fillRect(x, 0, 30, H);
  }

  /** The bands the wall keeps to, for the layout check: the lowest frame, swung, still fits. */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    const low = Math.max(...this.hangs.map((h) => h.y + STRING + h.h));
    return [{ name: 'wall', top: 20, bottom: low + 20 }];
  }
}

export function straightenStatus(state: StraightenState): string | undefined {
  if (state.result) return undefined;
  return `${state.straight} of ${state.tilts.length} straight`;
}

export function straightenResult(state: StraightenState): string | undefined {
  if (!state.result) return undefined;
  return 'All straight. Ahh, much better.';
}
