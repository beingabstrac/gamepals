import { drawLine, lineTotal, type DotsMove, type DotsState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import type { Session } from '../../session';
import { COLORS, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed } from '../../autoplay';
import { focusRing, isPress, moveRing, onKeys } from '../keys';

const W = 640;
const H = 720;
export const DOTS_SIZE = { width: W, height: H };
export const DOTS_COLORS = [COLORS.sky, COLORS.tomato, COLORS.mint, COLORS.sunny];
export const DOTS_NAMES = ['Blue', 'Red', 'Green', 'Yellow'];

const TOP = 96;
const MARGIN = 40;
const LINE = 9;
const DOT = 9;
const DRAW_MS = 170;

interface Chip {
  readonly box: GameObjects.Container;
  readonly score: GameObjects.Text;
}

export class DotsScene extends Scene {
  private n = 4;
  private sp = 100;
  private x0 = 0;
  private y0 = 0;
  private lineLayer!: GameObjects.Graphics;
  private boxLayer!: GameObjects.Graphics;
  private chips: Chip[] = [];
  private initials = new Map<number, GameObjects.Text>();
  private lattice = { i: 1, j: 0 };
  private ring!: GameObjects.Graphics;

  constructor(private readonly session: Session<DotsMove>) {
    super('dots-and-boxes');
  }

  private get state(): DotsState {
    return this.session.state as DotsState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    const state = this.state;
    this.n = state.n;
    this.sp = Math.min((W - MARGIN * 2) / this.n, (H - TOP - MARGIN) / this.n);
    this.x0 = (W - this.sp * this.n) / 2;
    this.y0 = TOP + (H - TOP - this.sp * this.n) / 2;

    const tray = this.add.graphics();
    tray.fillStyle(0xe6e0f4, 1);
    tray.fillRoundedRect(this.x0 - 28, this.y0 - 22, this.sp * this.n + 56, this.sp * this.n + 56, 28);
    tray.fillStyle(0xffffff, 1);
    tray.fillRoundedRect(this.x0 - 28, this.y0 - 28, this.sp * this.n + 56, this.sp * this.n + 56, 28);
    this.boxLayer = this.add.graphics();
    this.lineLayer = this.add.graphics();
    const dots = this.add.graphics().setDepth(3);
    dots.fillStyle(toHex(COLORS.ink), 1);
    for (let r = 0; r <= this.n; r++) for (let c = 0; c <= this.n; c++) dots.fillCircle(this.x0 + c * this.sp, this.y0 + r * this.sp, DOT);
    this.makeChips();
    this.redraw();

    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      const line = this.nearestOpenLine(p.worldX, p.worldY);
      if (line !== null) this.draw(line);
    });

    // Keyboard: arrows hop between line spots, Enter or Space draws the line under the ring.
    this.ring = focusRing(this, this.sp * 0.62, this.sp * 0.62, 18);
    onKeys(this, (key) => {
      const steps: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      const step = steps[key];
      if (step) {
        this.moveLattice(step[0], step[1]);
        return true;
      }
      if (isPress(key) && this.ring.visible) {
        const line = this.latticeLine();
        if (line !== null && this.state.lines[line] === -1) this.draw(line);
        return true;
      }
      return false;
    });

    const unsubscribe = this.session.subscribe(() => this.onChange());
    this.events.once('shutdown', unsubscribe);
  }

  /** Both end dots of a line. */
  private ends(line: number): [{ x: number; y: number }, { x: number; y: number }] {
    const { n, sp, x0, y0 } = this;
    if (line < n * (n + 1)) {
      const r = Math.floor(line / n);
      const c = line % n;
      return [{ x: x0 + c * sp, y: y0 + r * sp }, { x: x0 + (c + 1) * sp, y: y0 + r * sp }];
    }
    const k = line - n * (n + 1);
    const r = Math.floor(k / (n + 1));
    const c = k % (n + 1);
    return [{ x: x0 + c * sp, y: y0 + r * sp }, { x: x0 + c * sp, y: y0 + (r + 1) * sp }];
  }

  /** The open line whose middle is closest to the tap (the whole space between two dots counts). */
  private nearestOpenLine(x: number, y: number): number | null {
    let best: number | null = null;
    let bestDist = this.sp * 0.5;
    for (let line = 0; line < lineTotal(this.n); line++) {
      if (this.state.lines[line] !== -1) continue;
      const [a, b] = this.ends(line);
      const d = Math.hypot(x - (a.x + b.x) / 2, y - (a.y + b.y) / 2);
      if (d < bestDist) {
        bestDist = d;
        best = line;
      }
    }
    return best;
  }

  private draw(line: number): void {
    if (!this.session.isHumanTurn()) return;
    this.session.play(drawLine(line));
  }

  private moveLattice(di: number, dj: number): void {
    const size = 2 * this.n;
    let { i, j } = this.lattice;
    // Step once, and again if we land on a dot or a box centre (only line spots count).
    for (let k = 0; k < 2; k++) {
      i = Math.min(size, Math.max(0, i + di));
      j = Math.min(size, Math.max(0, j + dj));
      if ((i + j) % 2 === 1) break;
    }
    this.lattice = { i, j };
    const line = this.latticeLine();
    if (line === null) return;
    const [a, b] = this.ends(line);
    moveRing(this, this.ring, (a.x + b.x) / 2, (a.y + b.y) / 2);
  }

  private latticeLine(): number | null {
    const { i, j } = this.lattice;
    const n = this.n;
    if (i % 2 === 0 && j % 2 === 1) return (i / 2) * n + (j - 1) / 2;
    if (i % 2 === 1 && j % 2 === 0) return n * (n + 1) + ((i - 1) / 2) * (n + 1) + j / 2;
    return null;
  }

  private makeChips(): void {
    const { players } = this.state;
    for (let seat = 0; seat < players; seat++) {
      const x = (W * (seat + 0.5)) / players;
      const width = Math.min(140, W / players - 12);
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 1);
      g.fillRoundedRect(-width / 2, -28, width, 56, 28);
      g.lineStyle(4, toHex(DOTS_COLORS[seat]!), 1);
      g.strokeRoundedRect(-width / 2, -28, width, 56, 28);
      const label = this.session.seats[seat]?.label ?? DOTS_NAMES[seat]!;
      const name = sharpText(this, -width / 2 + 14, 0, label.slice(0, 8), 20, COLORS.ink).setOrigin(0, 0.5);
      const score = sharpText(this, width / 2 - 22, 0, '0', 28, DOTS_COLORS[seat]!).setFontStyle('bold');
      this.chips.push({ box: this.add.container(x, TOP / 2, [g, name, score]), score });
    }
  }

  private refreshChips(): void {
    const state = this.state;
    this.chips.forEach((chip, seat) => {
      chip.score.setText(String(state.scores[seat] ?? 0));
      const active = !state.result && seat === state.currentSeat;
      this.tweens.add({ targets: chip.box, scale: active ? 1.08 : 0.94, alpha: active ? 1 : 0.6, duration: 220, ease: 'Back.easeOut' });
    });
  }

  /** Draws every settled line and claimed box; `skip` stays undrawn while it animates. */
  private redraw(skip: number | null = null): void {
    const state = this.state;
    const g = this.lineLayer.clear();
    // Faint guides for open lines, so every spot is easy to see.
    for (let line = 0; line < state.lines.length; line++) {
      const owner = state.lines[line]!;
      const [a, b] = this.ends(line);
      if (owner === -1 || line === skip) {
        g.lineStyle(LINE - 5, 0xe6e0f4, 1);
      } else {
        g.lineStyle(LINE, toHex(DOTS_COLORS[owner]!), 1);
      }
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
    const b = this.boxLayer.clear();
    state.boxes.forEach((owner, box) => {
      if (owner === -1) return;
      const x = this.x0 + (box % this.n) * this.sp;
      const y = this.y0 + Math.floor(box / this.n) * this.sp;
      b.fillStyle(toHex(DOTS_COLORS[owner]!), 0.35);
      b.fillRoundedRect(x + 8, y + 8, this.sp - 16, this.sp - 16, 12);
    });
    this.refreshChips();
  }

  private onChange(): void {
    const event = this.state.last;
    if (!event) {
      this.redraw();
      return;
    }
    // The new line draws itself from one dot to the other, like a pencil.
    this.redraw(event.line);
    const [a, b] = this.ends(event.line);
    const pencil = this.add.graphics().setDepth(2);
    const color = toHex(DOTS_COLORS[event.seat]!);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: DRAW_MS,
      ease: 'Quad.easeOut',
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 1;
        pencil.clear();
        pencil.lineStyle(LINE, color, 1);
        pencil.lineBetween(a.x, a.y, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
      },
      onComplete: () => {
        pencil.destroy();
        this.redraw();
        event.completed.forEach((box, i) => this.popBox(box, event.seat, i * 90));
        if (this.state.result) this.celebrate();
      },
    });
  }

  /** A claimed box pops in with the claimer's initial. */
  private popBox(box: number, seat: number, delay: number): void {
    const x = this.x0 + (box % this.n) * this.sp + this.sp / 2;
    const y = this.y0 + Math.floor(box / this.n) * this.sp + this.sp / 2;
    const label = (this.session.seats[seat]?.label ?? DOTS_NAMES[seat]!).slice(0, 1).toUpperCase();
    this.initials.get(box)?.destroy();
    const text = sharpText(this, x, y + 2, label, Math.round(this.sp * 0.42), DOTS_COLORS[seat]!).setFontStyle('bold').setDepth(4).setScale(0);
    this.initials.set(box, text);
    this.tweens.add({ targets: text, scale: 1, duration: 280, delay, ease: 'Back.easeOut' });
  }

  private celebrate(): void {
    const winners = this.state.result?.winners ?? [];
    this.chips.forEach((chip, seat) => {
      if (winners.includes(seat)) this.tweens.add({ targets: chip.box, y: chip.box.y - 10, duration: 200, yoyo: true, repeat: 2, ease: 'Sine.easeOut' });
    });
  }
}
