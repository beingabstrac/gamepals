import { MARBLE_BOARD, MARBLE_R, MARBLE_STEP, roll, type MarbleMove, type MarbleState, type Segment } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed, SPEED } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { onKeys } from '../keys';

const W = 560;
const H = 800;
export const MARBLE_SIZE = { width: W, height: H };
export const MARBLE_TINTS = [COLORS.grape];

const AT = { x: (W - MARBLE_BOARD.w) / 2, y: 30 };
const DROP_Y = AT.y + MARBLE_BOARD.h + 60;
const RAMP_COLORS = [COLORS.tomato, COLORS.sunny, COLORS.mint, COLORS.sky];
const RAMP_DARKS = [DARK.tomato, DARK.sunny, DARK.mint, DARK.sky];

/**
 * Marble Run. The rules keep the ramps and roll the marble; the scene draws the board, tilts a ramp
 * when its peg is tapped, and plays a drop back step by step from the same roll the rules made, so
 * what you see is exactly what counted.
 */
export class MarbleScene extends Scene {
  private board!: GameObjects.Graphics;
  private ramps!: GameObjects.Graphics;
  private marble!: GameObjects.Container;
  private rolling: { path: readonly { x: number; y: number }[]; landed: boolean; t: number } | null = null;
  /** Each ramp's tilt as drawn (1 left, 2 right, eased between) and how much of it is out (0 to 1). */
  private shown: number[] = [];
  private out: number[] = [];

  constructor(private readonly session: Session<MarbleMove>) {
    super('marble-run');
  }

  private get state(): MarbleState {
    return this.session.state as MarbleState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.board = this.add.graphics();
    this.drawBoard();
    this.ramps = this.add.graphics().setDepth(2);
    this.shown = this.state.states.map((s) => s || 1);
    this.out = this.state.states.map((s) => (s ? 1 : 0));
    const m = this.add.graphics();
    m.fillStyle(toHex(DARK.grape), 1);
    m.fillCircle(0, 2, MARBLE_R);
    m.fillStyle(toHex(COLORS.grape), 1);
    m.fillCircle(0, 0, MARBLE_R);
    m.fillStyle(0xffffff, 0.55);
    m.fillCircle(-3.5, -3.5, 3.5);
    this.marble = this.add.container(AT.x + this.state.level.start, AT.y + 30, [m]).setDepth(3);
    const g = this.add.graphics();
    g.fillStyle(toHex(DARK.grape), 1);
    g.fillRoundedRect(W / 2 - 110, DROP_Y - 28 + 6, 220, 56, 28);
    g.fillStyle(toHex(COLORS.grape), 1);
    g.fillRoundedRect(W / 2 - 110, DROP_Y - 28, 220, 56, 28);
    sharpText(this, W / 2, DROP_Y, 'Drop', 26, '#FFFFFF').setFontStyle('bold');
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.down(p.worldX, p.worldY));
    onKeys(this, (key) => {
      const n = Number(key);
      if (n >= 1 && n <= this.state.level.pegs.length) return this.send(`t${n - 1}`), true;
      if (key === ' ' || key === 'Enter') return this.send('drop'), true;
      return false;
    });
    const off = this.session.subscribe(() => this.changed());
    this.session.holdBots = () => this.busy();
    this.events.once('shutdown', () => {
      off();
      this.session.holdBots = null;
    });
  }

  busy(): boolean {
    return this.rolling !== null;
  }

  private send(move: MarbleMove): void {
    if (!this.session.isHumanTurn() || this.state.result || this.rolling) return;
    this.session.play(move);
  }

  private down(x: number, y: number): void {
    if (Math.abs(y - DROP_Y) < 30 && Math.abs(x - W / 2) < 110) return this.send('drop');
    const i = this.state.level.pegs.findIndex((p) => Math.hypot(AT.x + p.x - x, AT.y + p.y - y) < 56);
    if (i >= 0) this.send(`t${i}`);
  }

  private line(g: GameObjects.Graphics, s: Segment, width: number, color: number): void {
    g.lineStyle(width, color, 1);
    g.lineBetween(AT.x + s.x1, AT.y + s.y1, AT.x + s.x2, AT.y + s.y2);
    g.fillStyle(color, 1);
    g.fillCircle(AT.x + s.x1, AT.y + s.y1, width / 2);
    g.fillCircle(AT.x + s.x2, AT.y + s.y2, width / 2);
  }

  private drawBoard(): void {
    const g = this.board;
    const { level } = this.state;
    g.fillStyle(toHex('#D9E9FF'), 1);
    g.fillRoundedRect(AT.x - 10, AT.y - 10 + 6, MARBLE_BOARD.w + 20, MARBLE_BOARD.h + 20, 26);
    g.fillStyle(toHex('#EEF6FF'), 1);
    g.fillRoundedRect(AT.x - 10, AT.y - 10, MARBLE_BOARD.w + 20, MARBLE_BOARD.h + 20, 26);
    // Where the marble starts: a little shelf at the top.
    g.lineStyle(3, toHex(COLORS.grape), 0.35);
    g.strokeCircle(AT.x + level.start, AT.y + 30, MARBLE_R + 5);
    for (const f of level.fixed) this.line(g, f, 12, toHex('#A9A3C2'));
    // The cup.
    const l = AT.x + level.cup - 37;
    g.fillStyle(toHex(DARK.bubblegum), 1);
    g.fillRoundedRect(l - 6, AT.y + 584, 86, 50, { tl: 4, tr: 4, bl: 18, br: 18 });
    g.fillStyle(toHex(COLORS.bubblegum), 1);
    g.fillRoundedRect(l, AT.y + 588, 74, 40, { tl: 2, tr: 2, bl: 14, br: 14 });
    // Pegs.
    for (const p of level.pegs) {
      g.fillStyle(toHex(COLORS.ink), 1);
      g.fillCircle(AT.x + p.x, AT.y + p.y, 6);
    }
  }

  private drawRamps(): void {
    const g = this.ramps.clear();
    this.state.level.pegs.forEach((p, i) => {
      const shown = this.shown[i]!;
      if (this.out[i]! < 0.01) return;
      // Left (1) to right (2) eases through flat; the rules tilt a ramp 28 degrees either way.
      const tilt = -28 + 56 * (shown - 1);
      const a = (tilt * Math.PI) / 180;
      const len = 104 * this.out[i]!;
      const s: Segment = { x1: p.x - (Math.cos(a) * len) / 2, y1: p.y - (Math.sin(a) * len) / 2, x2: p.x + (Math.cos(a) * len) / 2, y2: p.y + (Math.sin(a) * len) / 2 };
      this.line(g, { ...s, y1: s.y1 + 4, y2: s.y2 + 4 }, 12, toHex(RAMP_DARKS[i]!));
      this.line(g, s, 12, toHex(RAMP_COLORS[i]!));
      g.fillStyle(toHex(COLORS.ink), 1);
      g.fillCircle(AT.x + p.x, AT.y + p.y, 5);
    });
  }

  private changed(): void {
    const s = this.state;
    const last = s.last;
    if (!last) return;
    if (last.kind === 'turn') {
      cue('tap');
      const i = last.peg;
      const target = s.states[i]!;
      // None to left grows the ramp out; left to right swings it; right to none folds it away.
      const [key, from, to] = target === 1 ? (['out', 0, 1] as const) : target === 2 ? (['shown', 1, 2] as const) : (['out', 1, 0] as const);
      if (target === 1) this.shown[i] = 1;
      this.tweens.addCounter({
        from,
        to,
        duration: 180,
        ease: target === 0 ? 'Quad.easeIn' : 'Back.easeOut',
        onUpdate: (tw) => (this[key][i] = tw.getValue() ?? to),
      });
      return;
    }
    const r = roll(s.level, s.states, 1);
    this.rolling = { path: r.path, landed: r.landed, t: 0 };
    cue('roll');
  }

  update(_time: number, delta: number): void {
    this.drawRamps();
    const r = this.rolling;
    if (!r) return;
    // One path point per rules step, played at real time (or faster in test mode).
    r.t += (delta / 1000 / MARBLE_STEP) * SPEED;
    const i = Math.min(r.path.length - 1, Math.floor(r.t));
    const p = r.path[i]!;
    this.marble.setPosition(AT.x + p.x, AT.y + p.y);
    if (i < r.path.length - 1) return;
    this.rolling = null;
    if (r.landed) {
      cue('win');
      this.tweens.add({ targets: this.marble, scaleX: 1.3, scaleY: 0.75, duration: 90, yoyo: true });
    } else {
      cue('buzz');
      this.tweens.add({
        targets: this.marble,
        alpha: 0,
        duration: 260,
        onComplete: () => this.marble.setPosition(AT.x + this.state.level.start, AT.y + 30).setAlpha(1),
      });
    }
  }

  layoutCheck(): { name: string; top: number; bottom: number }[] {
    return [
      { name: 'the board', top: AT.y - 10, bottom: AT.y + MARBLE_BOARD.h + 16 },
      { name: 'drop', top: DROP_Y - 28, bottom: DROP_Y + 34 },
    ];
  }
}

export function marbleStatus(state: MarbleState): string | undefined {
  if (state.result) return undefined;
  if (!state.drops) return 'Tap a peg to set a ramp, then Drop';
  return `${state.drops} ${state.drops === 1 ? 'drop' : 'drops'} · ${state.ramps} ${state.ramps === 1 ? 'ramp' : 'ramps'} · par ${state.level.par}`;
}

export function marbleResult(state: MarbleState): string | undefined {
  if (!state.result) return undefined;
  return state.ramps <= state.level.par ? `In the cup with ${state.ramps} ${state.ramps === 1 ? 'ramp' : 'ramps'}: par! 🎉` : `In the cup with ${state.ramps} ramps (par ${state.level.par}).`;
}
