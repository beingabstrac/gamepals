import { FLICK_STEP, flickMove, flickRoll, FOOTBALL_R, GOAL_W, MAN_R, MEN, PITCH, type FlickBody, type FlickMove, type FlickState, type Seat } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed, SPEED } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { onKeys } from '../keys';

const W = 600;
const H = 900;
export const FLICK_SIZE = { width: W, height: H };
export const FLICK_COLORS = [COLORS.sky, COLORS.tomato];
const SEAT_HEX = [toHex(COLORS.sky), toHex(COLORS.tomato)];
const SEAT_DARK = [toHex(DARK.sky), toHex(DARK.tomato)];
const AT = { x: (W - PITCH.w) / 2, y: (H - PITCH.h) / 2 };
/** How far you pull back for a full-power flick. */
const FULL_PULL = 170;

/**
 * Flick Football. The rules roll every flick; the scene draws the pitch and the men, lets you pull
 * back from one of your men like a slingshot (the arrow shows where and how hard), and plays each
 * flick back from the same roll the rules made.
 */
export class FlickScene extends Scene {
  private bodies: GameObjects.Container[] = [];
  private aimG!: GameObjects.Graphics;
  private banner!: GameObjects.Text;
  private aiming: { man: number; x: number; y: number } | null = null;
  private keyAim = { man: 0, angle: 270, power: 60 };
  private playing: { frames: readonly (readonly FlickBody[])[]; t: number; goal: Seat | null } | null = null;
  /** After a goal, a moment to cheer before everyone walks back to their places. */
  private pauseUntil = 0;

  constructor(private readonly session: Session<FlickMove>) {
    super('flick-football');
  }

  private get state(): FlickState {
    return this.session.state as FlickState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.drawPitch();
    this.bodies = this.state.bodies.map((_, i) => this.makeBody(i));
    this.aimG = this.add.graphics().setDepth(6);
    this.banner = sharpText(this, W / 2, H / 2, '', 72, COLORS.ink).setDepth(10).setStroke('#FFFFFF', 10);
    this.place(this.state.bodies);
    this.keyAim.angle = this.state.currentSeat === 0 ? 270 : 90;
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.down(p.worldX, p.worldY));
    this.input.on('pointermove', (p: { worldX: number; worldY: number; isDown: boolean }) => {
      if (p.isDown && this.aiming) (this.aiming.x = p.worldX), (this.aiming.y = p.worldY);
    });
    this.input.on('pointerup', () => this.release());
    onKeys(this, (key) => this.key(key));
    const off = this.session.subscribe(() => this.changed());
    this.session.holdBots = () => this.busy();
    this.events.once('shutdown', () => {
      off();
      this.session.holdBots = null;
    });
  }

  busy(): boolean {
    return this.playing !== null || this.time.now < this.pauseUntil;
  }

  private drawPitch(): void {
    const g = this.add.graphics();
    const x = AT.x;
    const y = AT.y;
    // Goal nets, outside the pitch at each end.
    const mouth = AT.x + (PITCH.w - GOAL_W) / 2;
    for (const [ny, color] of [
      [y - 34, SEAT_HEX[1]!],
      [y + PITCH.h, SEAT_HEX[0]!],
    ] as const) {
      g.fillStyle(0xffffff, 1);
      g.fillRoundedRect(mouth, ny, GOAL_W, 34, 8);
      g.lineStyle(2, color, 0.5);
      for (let k = 1; k < 8; k++) g.lineBetween(mouth + (k * GOAL_W) / 8, ny, mouth + (k * GOAL_W) / 8, ny + 34);
    }
    g.fillStyle(toHex(DARK.mint), 1);
    g.fillRoundedRect(x - 10, y - 10 + 6, PITCH.w + 20, PITCH.h + 20, 26);
    g.fillStyle(toHex(COLORS.mint), 1);
    g.fillRoundedRect(x - 10, y - 10, PITCH.w + 20, PITCH.h + 20, 26);
    // Stripes, lines and the middle circle.
    g.fillStyle(0xffffff, 0.08);
    for (let k = 0; k < 8; k += 2) g.fillRect(x, y + (k * PITCH.h) / 8, PITCH.w, PITCH.h / 8);
    g.lineStyle(4, 0xffffff, 0.85);
    g.strokeRoundedRect(x, y, PITCH.w, PITCH.h, 16);
    g.lineBetween(x, y + PITCH.h / 2, x + PITCH.w, y + PITCH.h / 2);
    g.strokeCircle(x + PITCH.w / 2, y + PITCH.h / 2, 70);
    g.strokeRect(mouth - 50, y, GOAL_W + 100, 90);
    g.strokeRect(mouth - 50, y + PITCH.h - 90, GOAL_W + 100, 90);
    // The goal mouths in the side's color.
    g.lineStyle(8, SEAT_HEX[1]!, 1);
    g.lineBetween(mouth, y, mouth + GOAL_W, y);
    g.lineStyle(8, SEAT_HEX[0]!, 1);
    g.lineBetween(mouth, y + PITCH.h, mouth + GOAL_W, y + PITCH.h);
  }

  private makeBody(i: number): GameObjects.Container {
    const g = this.add.graphics();
    const isBall = i === MEN * 2;
    if (isBall) {
      g.fillStyle(0x000000, 0.18);
      g.fillCircle(2, 4, FOOTBALL_R);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(0, 0, FOOTBALL_R);
      g.fillStyle(toHex(COLORS.ink), 1);
      g.fillCircle(0, 0, 5);
      for (let k = 0; k < 5; k++) g.fillCircle(Math.cos((k * Math.PI * 2) / 5) * 11, Math.sin((k * Math.PI * 2) / 5) * 11, 2.6);
      return this.add.container(0, 0, [g]).setDepth(4);
    }
    const seat = Math.floor(i / MEN);
    g.fillStyle(0x000000, 0.18);
    g.fillCircle(2, 5, MAN_R);
    g.fillStyle(SEAT_DARK[seat]!, 1);
    g.fillCircle(0, 3, MAN_R);
    g.fillStyle(SEAT_HEX[seat]!, 1);
    g.fillCircle(0, 0, MAN_R);
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(-8, -8, 7);
    const n = sharpText(this, 0, 0, String((i % MEN) + 1), 22, '#FFFFFF').setFontStyle('bold');
    return this.add.container(0, 0, [g, n]).setDepth(3);
  }

  private place(bodies: readonly FlickBody[]): void {
    bodies.forEach((b, i) => this.bodies[i]!.setPosition(AT.x + b.x, AT.y + b.y));
  }

  private mine(): boolean {
    return this.session.isHumanTurn() && !this.state.result && !this.busy();
  }

  private down(x: number, y: number): void {
    if (!this.mine()) return;
    const seat = this.state.currentSeat;
    for (let m = 0; m < MEN; m++) {
      const b = this.state.bodies[seat * MEN + m]!;
      if (Math.hypot(AT.x + b.x - x, AT.y + b.y - y) < MAN_R + 14) {
        this.aiming = { man: m, x, y };
        return;
      }
    }
  }

  /** Pulled back from the man: the flick goes the other way, harder the further the pull. */
  private aim(): { man: number; angle: number; power: number } | null {
    const a = this.aiming;
    if (!a) return null;
    const b = this.state.bodies[this.state.currentSeat * MEN + a.man]!;
    const dx = AT.x + b.x - a.x;
    const dy = AT.y + b.y - a.y;
    const pull = Math.hypot(dx, dy);
    if (pull < 18) return null;
    return { man: a.man, angle: (Math.atan2(dy, dx) * 180) / Math.PI, power: Math.min(100, Math.max(5, (pull / FULL_PULL) * 100)) };
  }

  private release(): void {
    const shot = this.aim();
    this.aiming = null;
    this.aimG.clear();
    if (shot && this.mine()) this.session.play(flickMove(shot.man, shot.angle, shot.power));
  }

  private key(key: string): boolean {
    if (!this.mine()) return false;
    const n = Number(key);
    if (n >= 1 && n <= MEN) return (this.keyAim.man = n - 1), true;
    if (key === 'ArrowLeft') return (this.keyAim.angle -= 5), true;
    if (key === 'ArrowRight') return (this.keyAim.angle += 5), true;
    if (key === 'ArrowUp') return (this.keyAim.power = Math.min(100, this.keyAim.power + 10)), true;
    if (key === 'ArrowDown') return (this.keyAim.power = Math.max(10, this.keyAim.power - 10)), true;
    if (key === ' ' || key === 'Enter') {
      this.session.play(flickMove(this.keyAim.man, this.keyAim.angle, this.keyAim.power));
      return true;
    }
    return false;
  }

  private changed(): void {
    const s = this.state;
    const last = s.last;
    if (!last) return;
    const roll = flickRoll(last.from, last.seat * MEN + last.man, last.angle, last.power, 1);
    this.playing = { frames: roll.frames, t: 0, goal: roll.goal };
    cue('hit');
  }

  update(_time: number, delta: number): void {
    const p = this.playing;
    if (p) {
      p.t += (delta / 1000 / FLICK_STEP) * SPEED;
      const i = Math.min(p.frames.length - 1, Math.floor(p.t));
      this.place(p.frames[i]!);
      if (i >= p.frames.length - 1) this.finish(p.goal);
    }
    this.drawAim();
  }

  private finish(goal: Seat | null): void {
    this.playing = null;
    if (goal !== null) {
      cue('goal');
      this.cameras.main.shake(260, 0.01);
      this.shout(this.state.result ? 'Full time!' : 'Goal!');
      this.pauseUntil = this.time.now + 900;
      this.time.delayedCall(900, () => this.place(this.state.bodies));
    } else {
      this.place(this.state.bodies);
      this.keyAim.angle = this.state.currentSeat === 0 ? 270 : 90;
    }
  }

  private shout(text: string): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: this.banner, scale: 1.1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 700, duration: 300 });
  }

  /** The aim arrow while pulling, or the keyboard's aim; a ring round the side whose turn it is. */
  private drawAim(): void {
    const g = this.aimG.clear();
    if (this.state.result || this.busy()) return;
    const seat = this.state.currentSeat;
    for (let m = 0; m < MEN; m++) {
      const b = this.state.bodies[seat * MEN + m]!;
      g.lineStyle(3, 0xffffff, 0.7);
      g.strokeCircle(AT.x + b.x, AT.y + b.y, MAN_R + 5);
    }
    if (!this.session.isHumanTurn()) return;
    const shot = this.aim() ?? (this.aiming ? null : this.keyAim);
    if (!shot) return;
    const b = this.state.bodies[seat * MEN + shot.man]!;
    const x = AT.x + b.x;
    const y = AT.y + b.y;
    const a = (shot.angle * Math.PI) / 180;
    const len = 30 + shot.power * 1.4;
    g.lineStyle(8, toHex(COLORS.sunny), 1);
    g.lineBetween(x + Math.cos(a) * (MAN_R + 4), y + Math.sin(a) * (MAN_R + 4), x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.fillStyle(toHex(COLORS.sunny), 1);
    g.fillTriangle(
      x + Math.cos(a) * (len + 16),
      y + Math.sin(a) * (len + 16),
      x + Math.cos(a + 2.6) * 14 + Math.cos(a) * len,
      y + Math.sin(a + 2.6) * 14 + Math.sin(a) * len,
      x + Math.cos(a - 2.6) * 14 + Math.cos(a) * len,
      y + Math.sin(a - 2.6) * 14 + Math.sin(a) * len,
    );
  }

  layoutCheck(): { name: string; top: number; bottom: number }[] {
    return [
      { name: 'top goal', top: AT.y - 34, bottom: AT.y - 10 },
      { name: 'the pitch', top: AT.y - 10, bottom: AT.y + PITCH.h + 10 },
    ];
  }
}

export function flickStatus(state: FlickState, names: readonly string[]): string | undefined {
  if (state.result) return undefined;
  const who = names[state.currentSeat] ?? `Player ${state.currentSeat + 1}`;
  return `${names[0] ?? 'Blue'} ${state.goals[0]} · ${state.goals[1]} ${names[1] ?? 'Red'} · ${who} to flick`;
}

export function flickResult(state: FlickState, names: readonly string[]): string | undefined {
  if (!state.result) return undefined;
  if (state.result.draw) return `A ${state.goals[0]}-${state.goals[1]} draw.`;
  const w = state.result.winners[0]!;
  return `${names[w] ?? 'Someone'} wins ${Math.max(...state.goals)}-${Math.min(...state.goals)}!`;
}
