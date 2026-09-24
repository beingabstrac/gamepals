import { CRADLE_BALLS, type CradleMove, type CradleState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { onKeys } from '../keys';

const W = 600;
const H = 720;
export const CRADLE_CANVAS = { width: W, height: H };
export const CRADLE_COLORS = [COLORS.sky];

const R = 34;
const TOP = 150;
const LEN = 260;
const CX = W / 2;
const DONE_Y = 650;
/** Swing speed: a quarter swing takes about a third of a second, like a desk toy's. */
const OMEGA = 4.6;
const DECAY = 0.965;
/** The furthest a ball can be pulled: any more and the end ball leaves the frame. */
const MAX = 0.5;

const BALL_COLORS = [COLORS.tomato, COLORS.sunny, COLORS.mint, COLORS.sky, COLORS.bubblegum];
const BALL_DARK = [DARK.tomato, DARK.sunny, DARK.mint, DARK.sky, DARK.bubblegum];
const restX = (i: number) => CX + (i - (CRADLE_BALLS - 1) / 2) * R * 2;

/**
 * Newton's Cradle. The rules count the swings; the scene is the toy. Pull a ball (and the ones
 * beside it) out to the side and let go: the whole row behaves as one pendulum, the pulled group
 * showing it on one side and the same number of balls on the far side showing it on the other,
 * each crossing a click, a little lower every time.
 */
export class CradleScene extends Scene {
  private g!: GameObjects.Graphics;
  private doneText!: GameObjects.Text;
  /** A pull in progress: which side and how many, at what angle. */
  private pull: { side: 'l' | 'r'; n: number; angle: number } | null = null;
  /** The swing: how many balls, its size, and the time since it started. */
  private swing: { n: number; amp: number; t: number; sign: number } | null = null;

  constructor(private readonly session: Session<CradleMove>) {
    super('newtons-cradle');
  }

  private get state(): CradleState {
    return this.session.state as CradleState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.g = this.add.graphics();
    this.doneText = sharpText(this, CX, DONE_Y, 'Done', 26, '#FFFFFF').setFontStyle('bold').setDepth(3);
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      if (Math.abs(p.worldY - DONE_Y) < 30 && Math.abs(p.worldX - CX) < 110) return this.finish();
      if (!this.session.isHumanTurn() || this.state.result) return;
      // Grab a ball: everything from it to the near end comes out with it.
      const k = [...Array(CRADLE_BALLS).keys()].find((i) => Math.hypot(p.worldX - this.ballXY(i).x, p.worldY - this.ballXY(i).y) < R + 10);
      if (k === undefined) return;
      const left = k < (CRADLE_BALLS - 1) / 2 || (k === (CRADLE_BALLS - 1) / 2 && p.worldX < CX);
      const n = Math.min(CRADLE_BALLS - 1, left ? k + 1 : CRADLE_BALLS - k);
      this.swing = null;
      this.pull = { side: left ? 'l' : 'r', n, angle: 0 };
      cue('tap');
    });
    this.input.on('pointermove', (p: { worldX: number; worldY: number; isDown: boolean }) => {
      if (!this.pull || !p.isDown) return;
      const pivot = this.pull.side === 'l' ? restX(this.pull.n - 1) : restX(CRADLE_BALLS - this.pull.n);
      let angle = Math.atan2(p.worldX - pivot, Math.max(40, p.worldY - TOP));
      angle = this.pull.side === 'l' ? Math.max(-MAX, Math.min(0, angle)) : Math.min(MAX, Math.max(0, angle));
      this.pull.angle = angle;
    });
    const up = () => this.release();
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
    onKeys(this, (key) => this.key(key));
  }

  private release(): void {
    const pull = this.pull;
    this.pull = null;
    if (!pull || Math.abs(pull.angle) < 0.05) return;
    this.letGo(pull.side, pull.n, Math.abs(pull.angle));
  }

  private letGo(side: 'l' | 'r', n: number, amp: number): void {
    if (!this.session.isHumanTurn() || this.state.result) return;
    this.swing = { n, amp, t: 0, sign: side === 'l' ? -1 : 1 };
    this.session.play(`${side}${n}`);
  }

  private finish(): void {
    if (!this.session.isHumanTurn() || this.state.result) return;
    cue('win');
    this.session.play('done');
  }

  private key(key: string): boolean {
    const n = Number(key);
    // 1 to 4 let that many go from the left; 6 to 9, one to four from the right.
    if (Number.isInteger(n) && n >= 1 && n <= 4) {
      this.letGo('l', n, 0.7);
      return true;
    }
    if (Number.isInteger(n) && n >= 6 && n <= 9) {
      this.letGo('r', n - 5, 0.7);
      return true;
    }
    if (key === 'd' || key === 'D' || key === 'Enter') {
      this.finish();
      return true;
    }
    return false;
  }

  /** Each ball's angle right now: the pull, or the swing shown by the group on its side. */
  private angles(): number[] {
    const a = Array<number>(CRADLE_BALLS).fill(0);
    if (this.pull) {
      for (let k = 0; k < this.pull.n; k++) a[this.pull.side === 'l' ? k : CRADLE_BALLS - 1 - k] = this.pull.angle;
      return a;
    }
    if (!this.swing) return a;
    const { n, amp, t, sign } = this.swing;
    const theta = sign * amp * Math.cos(OMEGA * t);
    for (let k = 0; k < n; k++) {
      if (theta < 0) a[k] = theta;
      else a[CRADLE_BALLS - 1 - k] = theta;
    }
    return a;
  }

  private ballXY(i: number, angle = 0): { x: number; y: number } {
    return { x: restX(i) + Math.sin(angle) * LEN, y: TOP + Math.cos(angle) * LEN };
  }

  update(_time: number, delta: number): void {
    if (this.swing) {
      const s = this.swing;
      const before = Math.cos(OMEGA * s.t);
      s.t += Math.min(delta, 50) / 1000;
      const after = Math.cos(OMEGA * s.t);
      // Through the middle: a click, and a little lower every time.
      if (Math.sign(before) !== Math.sign(after)) {
        cue(s.amp > 0.2 ? 'clang' : 'tap');
        s.amp *= DECAY;
        if (s.amp < 0.03) this.swing = null;
      }
    }
    this.draw();
  }

  private draw(): void {
    const g = this.g.clear();
    const angles = this.angles();
    // The frame: a base, two posts and the top bar.
    // Posts at the edges, so a ball swung right out never passes through one.
    const x0 = 30;
    const x1 = W - 30;
    const base = TOP + LEN + R + 40;
    g.fillStyle(toHex(DARK.sky), 1);
    g.fillRoundedRect(x0 - 14, base + 6, x1 - x0 + 28, 34, 17);
    g.fillStyle(toHex(COLORS.sky), 1);
    g.fillRoundedRect(x0 - 14, base, x1 - x0 + 28, 34, 17);
    g.fillStyle(toHex(COLORS.grape), 1);
    g.fillRoundedRect(x0 - 6, TOP - 16, 14, base - TOP + 20, 7);
    g.fillRoundedRect(x1 - 8, TOP - 16, 14, base - TOP + 20, 7);
    g.fillRoundedRect(x0 - 6, TOP - 22, x1 - x0 + 14, 16, 8);
    for (let i = 0; i < CRADLE_BALLS; i++) {
      const b = this.ballXY(i, angles[i]!);
      // Shadow on the base, strings, then the ball.
      g.fillStyle(0x000000, 0.08);
      g.fillEllipse(b.x, base - 4, R * 1.6, 10);
      g.lineStyle(2, toHex(COLORS.soft), 0.8);
      g.lineBetween(restX(i) - 14, TOP - 8, b.x, b.y);
      g.lineBetween(restX(i) + 14, TOP - 8, b.x, b.y);
      // Candy balls, not steel: the app is bright colors throughout.
      g.fillStyle(toHex(BALL_DARK[i % BALL_DARK.length]!), 1);
      g.fillCircle(b.x, b.y + 3, R);
      g.fillStyle(toHex(BALL_COLORS[i % BALL_COLORS.length]!), 1);
      g.fillCircle(b.x, b.y, R);
      g.fillStyle(0xffffff, 0.85);
      g.fillEllipse(b.x - R * 0.35, b.y - R * 0.38, R * 0.7, R * 0.45);
    }
    const live = !this.state.result;
    this.doneText.setVisible(live);
    if (live) {
      g.fillStyle(toHex(DARK.mint), 1);
      g.fillRoundedRect(CX - 110, DONE_Y - 28 + 6, 220, 56, 28);
      g.fillStyle(toHex(COLORS.mint), 1);
      g.fillRoundedRect(CX - 110, DONE_Y - 28, 220, 56, 28);
    }
  }
}

export function cradleStatus(state: CradleState): string | undefined {
  if (state.result) return undefined;
  return state.swings ? `${state.swings} ${state.swings === 1 ? 'swing' : 'swings'}` : 'Pull a ball out and let go';
}

export function cradleResult(state: CradleState): string | undefined {
  return state.result ? `${state.swings} ${state.swings === 1 ? 'swing' : 'swings'}. Very calm.` : undefined;
}
