import { CHIMES, type ChimeMove, type ChimeState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import type { SoundName } from '../../sfx';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { onKeys } from '../keys';

const W = 600;
const H = 760;
export const CHIME_SIZE = { width: W, height: H };
export const CHIME_TINTS = [COLORS.mint];

const BAR_Y = 70;
const GAP = 66;
const FIRST_X = W / 2 - (GAP * (CHIMES - 1)) / 2;
const STRING = 48;
const TUBE_W = 36;
/** Longest (lowest) on the left. */
const LENGTHS = [330, 305, 280, 255, 232, 210, 190];
const GRAVITY = 1700;
const DAMPING = 0.35;
const BUTTON_Y = 700;
const TINTS = [COLORS.tomato, COLORS.peach, COLORS.sunny, COLORS.mint, COLORS.sky, COLORS.grape, COLORS.bubblegum] as const;
const DARKS = [DARK.tomato, DARK.peach, DARK.sunny, DARK.mint, DARK.sky, DARK.grape, DARK.bubblegum] as const;

interface Tube {
  view: GameObjects.Container;
  glow: GameObjects.Graphics;
  x: number;
  /** Pivot to the middle of the tube: the length of the pendulum. */
  arm: number;
  angle: number;
  spin: number;
  rangAt: number;
}

/**
 * Wind Chimes. The rules keep which tubes have rung; the scene hangs seven bamboo tubes as
 * pendulums, lets a tap or a swipe push them, knocks neighbours together when they meet (each
 * knock rings both), and blows a gust through them on Wind.
 */
export class ChimeScene extends Scene {
  private tubes: Tube[] = [];
  private gustUntil = 0;
  private swipe: { x: number; y: number } | null = null;
  /** Set while this scene sends a ring it has already played, so the move does not push the tube again. */
  private ringingHere = false;

  constructor(private readonly session: Session<ChimeMove>) {
    super('wind-chimes');
  }

  private get state(): ChimeState {
    return this.session.state as ChimeState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    const g = this.add.graphics();
    g.fillStyle(toHex(DARK.peach), 1);
    g.fillRoundedRect(FIRST_X - 60, BAR_Y - 16 + 6, GAP * (CHIMES - 1) + 120, 30, 15);
    g.fillStyle(toHex(COLORS.peach), 1);
    g.fillRoundedRect(FIRST_X - 60, BAR_Y - 16, GAP * (CHIMES - 1) + 120, 30, 15);
    g.lineStyle(4, toHex(COLORS.ink), 1);
    g.lineBetween(W / 2, BAR_Y - 16, W / 2, 10);
    this.tubes = LENGTHS.map((len, i) => this.makeTube(i, len));
    // The Wind button.
    g.fillStyle(toHex(DARK.sky), 1);
    g.fillRoundedRect(W / 2 - 110, BUTTON_Y - 28 + 6, 220, 56, 28);
    g.fillStyle(toHex(COLORS.sky), 1);
    g.fillRoundedRect(W / 2 - 110, BUTTON_Y - 28, 220, 56, 28);
    sharpText(this, W / 2, BUTTON_Y, 'Wind', 26, '#FFFFFF').setFontStyle('bold');
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.down(p.worldX, p.worldY));
    this.input.on('pointermove', (p: { worldX: number; worldY: number; isDown: boolean }) => p.isDown && this.move(p.worldX, p.worldY));
    this.input.on('pointerup', () => (this.swipe = null));
    onKeys(this, (key) => {
      const n = Number(key);
      if (n >= 1 && n <= CHIMES) return this.strike(n - 1, 1.4), true;
      if (key === 'w' || key === 'W' || key === ' ' || key === 'Enter') return this.gust(), true;
      return false;
    });
    const off = this.session.subscribe(() => this.changed());
    this.events.once('shutdown', off);
  }

  private makeTube(i: number, len: number): Tube {
    const body = this.add.graphics();
    body.lineStyle(3, toHex(COLORS.ink), 0.8);
    body.lineBetween(0, 0, 0, STRING);
    body.fillStyle(toHex(DARKS[i]!), 1);
    body.fillRoundedRect(-TUBE_W / 2 + 3, STRING, TUBE_W, len, 14);
    body.fillStyle(toHex(TINTS[i]!), 1);
    body.fillRoundedRect(-TUBE_W / 2, STRING, TUBE_W, len, 14);
    // Bamboo nodes, and a light stripe down one side.
    body.fillStyle(toHex(DARKS[i]!), 1);
    for (const at of [0.33, 0.66]) body.fillRect(-TUBE_W / 2, STRING + len * at - 3, TUBE_W, 6);
    body.fillStyle(0xffffff, 0.35);
    body.fillRoundedRect(-TUBE_W / 2 + 6, STRING + 10, 6, len - 20, 3);
    const glow = this.add.graphics();
    glow.fillStyle(0xffffff, 1);
    glow.fillRoundedRect(-TUBE_W / 2, STRING, TUBE_W, len, 14);
    glow.setAlpha(0);
    const star = this.add.graphics();
    star.fillStyle(toHex(COLORS.sunny), 1);
    star.fillCircle(0, 0, 7);
    star.setPosition(0, STRING + len + 22).setVisible(!!this.state.rung[i]).setName('star');
    const x = FIRST_X + i * GAP;
    const view = this.add.container(x, BAR_Y, [body, glow, star]).setDepth(2);
    return { view, glow, x, arm: STRING + len / 2, angle: 0, spin: 0, rangAt: -1000 };
  }

  private down(x: number, y: number): void {
    if (Math.abs(y - BUTTON_Y) < 30 && Math.abs(x - W / 2) < 110) return this.gust();
    this.swipe = { x, y };
    const i = this.tubeAt(x, y);
    if (i >= 0) this.strike(i, x < this.tubes[i]!.x ? 1.2 : -1.2);
  }

  /** The tube drawn under a point, if any. */
  private tubeAt(x: number, y: number): number {
    return this.tubes.findIndex((t, i) => {
      const along = y - BAR_Y;
      const cx = t.x + Math.sin(t.angle) * along;
      return along > STRING && along < STRING + LENGTHS[i]! && Math.abs(x - cx) < TUBE_W / 2 + 6;
    });
  }

  /** A finger brushed across the tubes pushes each it passes, the way it was going. */
  private move(x: number, y: number): void {
    const s = this.swipe;
    if (!s) return;
    this.tubes.forEach((t, i) => {
      const along = y - BAR_Y;
      if (along < STRING || along > STRING + LENGTHS[i]!) return;
      const cx = t.x + Math.sin(t.angle) * along;
      if ((s.x - cx) * (x - cx) < 0) this.strike(i, Math.sign(x - s.x) * Math.min(3, Math.abs(x - s.x) * 0.05 + 0.6));
    });
    this.swipe = { x, y };
  }

  /** Pushes a tube and rings it. */
  private strike(i: number, push: number): void {
    const t = this.tubes[i]!;
    t.spin += push;
    this.ring(i);
  }

  private ring(i: number): void {
    const t = this.tubes[i]!;
    const now = this.time.now;
    if (now - t.rangAt < 90) return;
    t.rangAt = now;
    cue(`chime${i}` as SoundName);
    this.tweens.killTweensOf(t.glow);
    t.glow.setAlpha(0.55);
    this.tweens.add({ targets: t.glow, alpha: 0, duration: 420 });
    if (!this.state.rung[i] && this.session.isHumanTurn() && !this.state.result) {
      this.ringingHere = true;
      this.session.play(`r${i}`);
      this.ringingHere = false;
    }
  }

  private gust(): void {
    this.gustUntil = this.time.now + 1400;
    cue('pull');
  }

  private changed(): void {
    const i = this.state.last;
    if (i === null) return;
    const star = this.tubes[i]!.view.getByName('star') as GameObjects.Graphics;
    star.setVisible(true).setScale(0);
    this.tweens.add({ targets: star, scale: 1, duration: 260, ease: 'Back.easeOut' });
    if (this.state.result) this.time.delayedCall(200, () => cue('win'));
    // A ring from a bot (in test mode) has not been played yet: push the tube for it.
    if (!this.ringingHere) this.strike(i, 1.3);
  }

  update(time: number, delta: number): void {
    const dt = Math.min(delta, 40) / 1000;
    const gusting = time < this.gustUntil;
    this.tubes.forEach((t, i) => {
      let force = -(GRAVITY / t.arm) * Math.sin(t.angle) - DAMPING * t.spin;
      if (gusting) force += Math.sin(time / 170 + i * 1.7) * 6 + 2;
      t.spin += force * dt;
      t.angle += t.spin * dt;
      t.angle = Math.max(-0.6, Math.min(0.6, t.angle));
    });
    // Neighbours that meet knock: they swap how fast they were going (a little lost) and both ring.
    for (let i = 0; i < CHIMES - 1; i++) {
      const a = this.tubes[i]!;
      const b = this.tubes[i + 1]!;
      const ax = a.x + Math.sin(a.angle) * a.arm;
      const bx = b.x + Math.sin(b.angle) * b.arm;
      const va = a.spin * a.arm;
      const vb = b.spin * b.arm;
      if (bx - ax < TUBE_W && va - vb > 0) {
        a.spin = (vb * 0.85) / a.arm;
        b.spin = (va * 0.85) / b.arm;
        if (va - vb > 25) {
          this.ring(i);
          this.ring(i + 1);
        }
      }
    }
    for (const t of this.tubes) t.view.setRotation(-t.angle);
  }

  layoutCheck(): { name: string; top: number; bottom: number }[] {
    return [
      { name: 'the chimes', top: 10, bottom: BAR_Y + STRING + LENGTHS[0]! + 40 },
      { name: 'the wind button', top: BUTTON_Y - 28, bottom: BUTTON_Y + 34 },
    ];
  }
}

export function chimeStatus(state: ChimeState): string | undefined {
  if (state.result) return undefined;
  const left = state.rung.filter((r) => !r).length;
  return `${left} ${left === 1 ? 'chime' : 'chimes'} still to ring`;
}

export function chimeResult(state: ChimeState): string | undefined {
  return state.result ? 'Every chime rang.' : undefined;
}
