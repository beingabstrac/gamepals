import { pourMove, TUBE_SIZE, type ColorSortMove, type ColorSortState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import type { Session } from '../../session';
import { COLORS, toHex } from '../../theme';
import { fitCamera } from '../crisp';
import { applySpeed } from '../../autoplay';
import { focusRing, isPress, moveRing, onKeys } from '../keys';
import { colorSortUiFor } from './ui';

const W = 640;
const H = 720;
export const COLOR_SORT_SIZE = { width: W, height: H };

const LAYER = 44;
const TUBE_W = 66;
const TUBE_H = LAYER * TUBE_SIZE + 26;
const ROW_GAP = 70;
const LIFT = 26;
const GLASS_LINE = 0xcfc6ec;
const CORK = 0xc98f5a;
/** Ten colors that are easy to tell apart; each also gets its own white mark for color-blind players. */
const PALETTE = [COLORS.tomato, COLORS.sky, COLORS.mint, COLORS.sunny, COLORS.grape, COLORS.peach, COLORS.bubblegum, '#2B2A3A', '#00B8C8', '#8D6E63'].map(toHex);

function drawMark(g: GameObjects.Graphics, kind: number, x: number, y: number, r: number): void {
  g.fillStyle(0xffffff, 0.9);
  g.lineStyle(3, 0xffffff, 0.9);
  const poly = (points: [number, number][]) => {
    g.beginPath();
    g.moveTo(x + points[0]![0], y + points[0]![1]);
    for (const [px, py] of points.slice(1)) g.lineTo(x + px, y + py);
    g.closePath();
    g.fillPath();
  };
  switch (kind % 10) {
    case 0:
      g.fillCircle(x, y, r * 0.7);
      break;
    case 1:
      poly([[0, -r], [r * 0.9, r * 0.7], [-r * 0.9, r * 0.7]]);
      break;
    case 2:
      g.fillRect(x - r * 0.65, y - r * 0.65, r * 1.3, r * 1.3);
      break;
    case 3:
      poly([[0, -r], [r * 0.8, 0], [0, r], [-r * 0.8, 0]]);
      break;
    case 4:
      g.strokeCircle(x, y, r * 0.7);
      break;
    case 5:
      g.fillRect(x - r * 0.25, y - r, r * 0.5, r * 2);
      g.fillRect(x - r, y - r * 0.25, r * 2, r * 0.5);
      break;
    case 6:
      g.fillRect(x - r, y - r * 0.3, r * 2, r * 0.6);
      break;
    case 7:
      g.lineBetween(x - r * 0.7, y - r * 0.7, x + r * 0.7, y + r * 0.7);
      g.lineBetween(x + r * 0.7, y - r * 0.7, x - r * 0.7, y + r * 0.7);
      break;
    case 8:
      g.fillRect(x - r * 0.3, y - r, r * 0.6, r * 2);
      break;
    default:
      g.fillCircle(x - r * 0.45, y, r * 0.35);
      g.fillCircle(x + r * 0.45, y, r * 0.35);
  }
}

export class ColorSortScene extends Scene {
  private tubes: GameObjects.Container[] = [];
  private layers: GameObjects.Graphics[] = [];
  private spots: { x: number; y: number }[] = [];
  private selected: number | null = null;
  private cursor = 0;
  private ring!: GameObjects.Graphics;

  constructor(private readonly session: Session<ColorSortMove>) {
    super('color-sort');
  }

  private get state(): ColorSortState {
    return this.session.state as ColorSortState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.layout();

    this.state.tubes.forEach((_, i) => {
      const glass = this.add.graphics();
      glass.fillStyle(0x2b2a3a, 0.07);
      glass.fillRoundedRect(-TUBE_W / 2, -TUBE_H / 2 + 6, TUBE_W, TUBE_H, { tl: 10, tr: 10, bl: 32, br: 32 });
      glass.fillStyle(0xffffff, 1);
      glass.fillRoundedRect(-TUBE_W / 2, -TUBE_H / 2, TUBE_W, TUBE_H, { tl: 10, tr: 10, bl: 32, br: 32 });
      glass.lineStyle(4, GLASS_LINE, 1);
      glass.strokeRoundedRect(-TUBE_W / 2, -TUBE_H / 2, TUBE_W, TUBE_H, { tl: 10, tr: 10, bl: 32, br: 32 });
      const layers = this.add.graphics();
      const spot = this.spots[i]!;
      const tube = this.add.container(spot.x, spot.y, [glass, layers]);
      tube.setScale(0);
      this.tweens.add({ targets: tube, scale: 1, duration: 300, delay: 40 + i * 40, ease: 'Back.easeOut' });
      this.tubes.push(tube);
      this.layers.push(layers);
      this.drawLayers(i);
    });

    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      const i = this.spots.findIndex((s) => Math.abs(p.worldX - s.x) <= TUBE_W / 2 + 12 && Math.abs(p.worldY - s.y) <= TUBE_H / 2 + LIFT);
      if (i >= 0) this.pick(i);
    });

    // Keyboard: 1–9 and 0 pick tubes; or arrows to move and Enter or Space to pick.
    this.ring = focusRing(this, TUBE_W + 18, TUBE_H + 18, 24);
    onKeys(this, (key) => {
      if (/^[0-9]$/.test(key)) {
        const i = key === '0' ? 9 : Number(key) - 1;
        if (i < this.tubes.length) this.pick(i);
        return true;
      }
      if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown') {
        const step = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1;
        this.cursor = (this.cursor + step + this.tubes.length) % this.tubes.length;
        const spot = this.spots[this.cursor]!;
        moveRing(this, this.ring, spot.x, spot.y);
        return true;
      }
      if (isPress(key) && this.ring.visible) {
        this.pick(this.cursor);
        return true;
      }
      return false;
    });

    const offSession = this.session.subscribe(() => this.onChange());
    const offHint = colorSortUiFor(this.session).onHint((move) => this.showHint(move));
    this.events.once('shutdown', () => {
      offSession();
      offHint();
    });
  }

  private layout(): void {
    const n = this.state.tubes.length;
    const perRow = n <= 6 ? n : Math.ceil(n / 2);
    const rows = Math.ceil(n / perRow);
    const gapX = Math.min(34, (W - perRow * TUBE_W) / (perRow + 1));
    const totalH = rows * TUBE_H + (rows - 1) * ROW_GAP;
    const y0 = (H - totalH) / 2 + TUBE_H / 2 + LIFT / 2;
    this.spots = Array.from({ length: n }, (_, i) => {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const count = Math.min(perRow, n - row * perRow);
      const startX = (W - (count * TUBE_W + (count - 1) * gapX)) / 2 + TUBE_W / 2;
      return { x: startX + col * (TUBE_W + gapX), y: y0 + row * (TUBE_H + ROW_GAP) };
    });
  }

  private drawLayers(i: number): void {
    const g = this.layers[i]!.clear();
    const tube = this.state.tubes[i] ?? [];
    tube.forEach((color, k) => {
      const bottom = TUBE_H / 2 - 8 - k * LAYER;
      const x = -TUBE_W / 2 + 8;
      const w = TUBE_W - 16;
      g.fillStyle(PALETTE[color % PALETTE.length]!, 1);
      if (k === 0) g.fillRoundedRect(x, bottom - LAYER + 2, w, LAYER - 2, { tl: 6, tr: 6, bl: 24, br: 24 });
      else g.fillRoundedRect(x, bottom - LAYER + 2, w, LAYER - 2, 6);
      drawMark(g, color, 0, bottom - LAYER / 2 + 1, 8);
    });
    if (tube.length === TUBE_SIZE && tube.every((c) => c === tube[0])) {
      // A finished tube gets its cork.
      g.fillStyle(CORK, 1);
      g.fillRoundedRect(-TUBE_W / 2 + 12, -TUBE_H / 2 - 14, TUBE_W - 24, 20, 8);
    }
  }

  private setLifted(i: number | null): void {
    if (this.selected !== null && this.selected !== i) {
      const old = this.tubes[this.selected]!;
      this.tweens.add({ targets: old, y: this.spots[this.selected]!.y, duration: 150, ease: 'Quad.easeOut' });
    }
    this.selected = i;
    if (i !== null) this.tweens.add({ targets: this.tubes[i]!, y: this.spots[i]!.y - LIFT, duration: 170, ease: 'Back.easeOut' });
  }

  private shake(i: number): void {
    const tube = this.tubes[i]!;
    this.tweens.add({ targets: tube, angle: { from: -5, to: 5 }, duration: 55, yoyo: true, repeat: 2, onComplete: () => tube.setAngle(0) });
  }

  /** Tap or key on a tube: lift it, or pour the lifted tube into it. */
  private pick(i: number): void {
    if (!this.session.isHumanTurn()) return;
    const state = this.state;
    if (this.selected === null) {
      if (state.tubes[i]!.length > 0) this.setLifted(i);
      else this.shake(i);
      return;
    }
    if (this.selected === i) {
      this.setLifted(null);
      return;
    }
    const move = pourMove(this.selected, i);
    if (state.legalMoves(0).includes(move)) {
      this.session.play(move);
      return;
    }
    this.shake(i);
    if (state.tubes[i]!.length > 0) this.setLifted(i);
  }

  private onChange(): void {
    const state = this.state;
    const pour = state.last;
    const lifted = this.selected;
    this.selected = null;
    if (!pour) {
      // Undo: everything back in place.
      this.tubes.forEach((tube, i) => {
        this.tweens.killTweensOf(tube);
        tube.setPosition(this.spots[i]!.x, this.spots[i]!.y).setAngle(0).setScale(1).setDepth(0);
        this.drawLayers(i);
      });
      return;
    }
    if (lifted !== null && lifted !== pour.from) this.tweens.add({ targets: this.tubes[lifted]!, y: this.spots[lifted]!.y, duration: 150 });

    // Pour: the tube swings over, tilts, and the color streams across.
    const source = this.tubes[pour.from]!;
    const from = this.spots[pour.from]!;
    const to = this.spots[pour.to]!;
    const tilt = to.x >= from.x ? 38 : -38;
    this.settleTubes(pour.from);
    this.tweens.killTweensOf(source);
    source.setScale(1).setAngle(0).setDepth(5);
    this.tweens.add({
      targets: source,
      x: from.x + (to.x - from.x) * 0.55,
      y: to.y - TUBE_H / 2 - 40,
      angle: tilt,
      duration: 170,
      ease: 'Quad.easeOut',
      onComplete: () => {
        const stream = this.add.graphics().setDepth(4);
        stream.fillStyle(PALETTE[pour.color % PALETTE.length]!, 1);
        stream.fillRoundedRect(to.x - 6, to.y - TUBE_H / 2 - 26, 12, 40 + (TUBE_SIZE - (state.tubes[pour.to]!.length - pour.count)) * LAYER * 0.4, 6);
        this.drawLayers(pour.from);
        this.drawLayers(pour.to);
        const target = this.tubes[pour.to]!;
        this.tweens.add({ targets: target, scaleY: 0.95, duration: 70, yoyo: true, ease: 'Quad.easeOut' });
        this.tweens.add({ targets: stream, alpha: 0, duration: 200, delay: 60, onComplete: () => stream.destroy() });
        this.tweens.add({
          targets: source,
          x: from.x,
          y: from.y,
          angle: 0,
          duration: 200,
          delay: 90,
          ease: 'Quad.easeInOut',
          onComplete: () => source.setDepth(0),
        });
        const done = state.tubes[pour.to]!;
        if (done.length === TUBE_SIZE && done.every((c) => c === done[0])) {
          this.tweens.add({ targets: target, scale: 1.08, duration: 140, yoyo: true, delay: 120, ease: 'Back.easeOut' });
        }
        if (state.result) this.celebrate();
      },
    });
  }

  /**
   * Puts every tube that is not pouring back where it belongs. `killTweensOf` takes the entry pop
   * and any unfinished return with it, so a tube caught inside the opening stagger kept whatever
   * size its tween died at: the gallery caught two tubes smaller than the third and one left
   * hanging above its place. A tube with a tween still running is left alone to finish.
   */
  private settleTubes(pouring: number): void {
    this.tubes.forEach((tube, i) => {
      if (i === pouring || this.tweens.getTweensOf(tube).length > 0) return;
      const spot = this.spots[i]!;
      tube.setPosition(spot.x, spot.y).setAngle(0).setScale(1).setDepth(0);
    });
  }

  /**
   * Whether every tube that has come to rest is its proper size and in its proper place. A tube
   * picked up sits one LIFT higher, which is a place; anything else is a tween that died.
   */
  boardCheck(): { settled: number; shown: number; placed: number; worst: string } {
    let settled = 0;
    let shown = 0;
    let placed = 0;
    // What the wrong size actually was, because a tube left at 0 never got its entry pop and one
    // left near 0.95 came back from a squash that started before the pop had finished. They are
    // different faults and the number is the only thing that tells them apart.
    let worst = '';
    let worstOff = 0;
    this.tubes.forEach((tube, i) => {
      if (this.tweens.getTweensOf(tube).length > 0) return;
      settled++;
      const off = Math.max(Math.abs(tube.scaleX - 1), Math.abs(tube.scaleY - 1));
      if (off < 0.05) shown++;
      else if (off > worstOff) {
        worstOff = off;
        worst = `tube ${i} at ${tube.scaleX.toFixed(2)}x${tube.scaleY.toFixed(2)}`;
      }
      const spot = this.spots[i]!;
      const up = spot.y - tube.y;
      if (Math.abs(tube.x - spot.x) < 2 && up >= -2 && up <= LIFT + 2 && Math.abs(tube.angle) < 1) placed++;
    });
    return { settled, shown, placed, worst };
  }

  private celebrate(): void {
    this.tubes.forEach((tube, i) => {
      this.tweens.add({ targets: tube, y: this.spots[i]!.y - 34, duration: 220, delay: 300 + i * 70, yoyo: true, ease: 'Sine.easeOut' });
    });
  }

  /** Hint: the tube to pour from bounces, then the tube to pour into. */
  private showHint(move: ColorSortMove): void {
    const [from, to] = move.slice(1).split(':').map(Number) as [number, number];
    [from, to].forEach((i, k) => {
      const tube = this.tubes[i];
      if (tube) this.tweens.add({ targets: tube, y: this.spots[i]!.y - 16, duration: 160, delay: k * 360, yoyo: true, repeat: 1, ease: 'Sine.easeOut' });
    });
  }
}
