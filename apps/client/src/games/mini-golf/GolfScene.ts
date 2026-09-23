import { COURSE_H, COURSE_W, CUP_R, GOLF_R, strokeMove, type GolfMove, type GolfState, type Hole, type Outline, type StrokeEvent } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { arrow, onKeys } from '../keys';

const W = 720;
const H = 1040;
export const GOLF_SIZE = { width: W, height: H };

/** The score strip across the top, then the course below it. */
const STRIP = 96;
const S = Math.min((W - 40) / COURSE_W, (H - STRIP - 24) / COURSE_H);
const X0 = (W - COURSE_W * S) / 2;
const Y0 = STRIP + (H - STRIP - COURSE_H * S) / 2;
/** The pause after a stroke stops before the next one can be taken. */
const SETTLE_MS = 450;
/** A pull this long, in pixels, is full power. */
const FULL_PULL = 230;

const px = (x: number) => X0 + x * S;
const py = (y: number) => Y0 + y * S;

/** Each player's ball has a ring in their colour, so it is clear whose ball is on the course. */
export const GOLF_COLORS = [COLORS.tomato, COLORS.sky, COLORS.sunny, COLORS.grape];

/**
 * Mini Golf. Like Pool, the rules roll each stroke out and hand back the ball's path, and this scene
 * plays it back: a ball in water sinks and comes back where it was hit, a ball in the cup drops, and
 * when a hole is done the next one slides in.
 */
export class GolfScene extends Scene {
  private course!: GameObjects.Container;
  private shownHole = -1;
  private ball!: GameObjects.Container;
  private ring!: GameObjects.Graphics;
  private guide!: GameObjects.Graphics;
  private strip: GameObjects.Text[] = [];
  private aim = -Math.PI / 2;
  private power = 45;
  private pull: { x: number; y: number } | null = null;
  private playing: { frames: readonly number[]; frameMs: number; start: number; events: readonly StrokeEvent[]; heard: number } | null = null;
  private busyUntil = 0;
  private shift = false;

  constructor(private readonly session: Session<GolfMove>) {
    super('mini-golf');
  }

  private get state(): GolfState {
    return this.session.state as GolfState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.course = this.add.container(0, 0);
    this.guide = this.add.graphics().setDepth(5);
    this.ring = this.add.graphics();
    const r = GOLF_R * S * 1.25;
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.18);
    shadow.fillCircle(2, 3, r);
    const body = this.add.graphics();
    body.fillStyle(0xffffff, 1);
    body.fillCircle(0, 0, r);
    this.ball = this.add.container(0, 0, [shadow, body, this.ring]).setDepth(10);
    this.drawStrip();

    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.down(p.worldX, p.worldY));
    this.input.on('pointermove', (p: { worldX: number; worldY: number; isDown: boolean }) => p.isDown && this.move(p.worldX, p.worldY));
    this.input.on('pointerup', () => this.up());
    onKeys(this, (key) => this.key(key));
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => (this.shift = event.shiftKey));
    this.input.keyboard?.on('keyup', (event: KeyboardEvent) => (this.shift = event.shiftKey));

    this.settle();
    const unsubscribe = this.session.subscribe(() => this.sync());
    // A bot waits for the last stroke to stop rolling on screen before it takes its own.
    this.session.holdBots = () => this.busy();
    this.events.once('shutdown', () => {
      unsubscribe();
      this.session.holdBots = null;
    });
  }

  /** Still playing a stroke, or bringing on the next hole. See `apps/client/src/games/busy.ts`. */
  busy(): boolean {
    return this.playing !== null || this.time.now < this.busyUntil;
  }

  private drawCourse(hole: Hole): void {
    this.course.removeAll(true);
    const g = this.add.graphics();
    const fill = (outline: Outline, color: number, alpha = 1) => {
      g.fillStyle(color, alpha);
      g.beginPath();
      outline.forEach((p, i) => (i === 0 ? g.moveTo(px(p.x), py(p.y)) : g.lineTo(px(p.x), py(p.y))));
      g.closePath();
      g.fillPath();
    };
    const edge = (outline: Outline, width: number, color: number) => {
      g.lineStyle(width, color, 1);
      g.beginPath();
      outline.forEach((p, i) => (i === 0 ? g.moveTo(px(p.x), py(p.y)) : g.lineTo(px(p.x), py(p.y))));
      g.closePath();
      g.strokePath();
    };
    // The rail round the green: a wide peach edge drawn first, the green over it.
    edge(hole.green, 26, toHex(DARK.peach));
    edge(hole.green, 18, toHex(COLORS.peach));
    fill(hole.green, toHex(COLORS.mint));
    for (const sand of hole.sand) fill(sand, toHex(COLORS.sunny));
    for (const water of hole.water) {
      fill(water, toHex(COLORS.sky));
      const top = Math.min(...water.map((p) => p.y));
      const bottom = Math.max(...water.map((p) => p.y));
      const left = Math.min(...water.map((p) => p.x));
      const right = Math.max(...water.map((p) => p.x));
      g.lineStyle(3, 0xffffff, 0.6);
      for (let y = top + 50; y < bottom; y += 70) {
        for (let x = left + 30; x < right - 40; x += 80) {
          g.beginPath();
          g.arc(px(x + 15), py(y), 10, Math.PI * 1.1, Math.PI * 1.9);
          g.strokePath();
        }
      }
    }
    for (const slope of hole.slopes) {
      // Chevrons pointing downhill.
      const len = Math.sqrt(slope.ax * slope.ax + slope.ay * slope.ay);
      const ux = slope.ax / len;
      const uy = slope.ay / len;
      const xs = slope.area.map((p) => p.x);
      const ys = slope.area.map((p) => p.y);
      g.lineStyle(4, 0xffffff, 0.35);
      for (let y = Math.min(...ys) + 60; y < Math.max(...ys); y += 140) {
        for (let x = Math.min(...xs) + 60; x < Math.max(...xs); x += 140) {
          const cx = px(x);
          const cy = py(y);
          g.lineBetween(cx - uy * 10 - ux * 8, cy + ux * 10 - uy * 8, cx + ux * 8, cy + uy * 8);
          g.lineBetween(cx + uy * 10 - ux * 8, cy - ux * 10 - uy * 8, cx + ux * 8, cy + uy * 8);
        }
      }
    }
    for (const block of hole.blocks) {
      fill(block, toHex(DARK.peach));
      edge(block, 6, toHex(COLORS.peach));
    }
    // The tee mat and the cup with its flag.
    g.fillStyle(0xffffff, 0.45);
    g.fillRoundedRect(px(hole.tee.x) - 22, py(hole.tee.y) - 14, 44, 28, 8);
    g.fillStyle(toHex(COLORS.ink), 1);
    g.fillCircle(px(hole.cup.x), py(hole.cup.y), CUP_R * S);
    g.lineStyle(4, toHex(COLORS.ink), 1);
    g.lineBetween(px(hole.cup.x), py(hole.cup.y), px(hole.cup.x), py(hole.cup.y) - 70);
    g.fillStyle(toHex(COLORS.tomato), 1);
    g.fillTriangle(px(hole.cup.x), py(hole.cup.y) - 70, px(hole.cup.x) + 36, py(hole.cup.y) - 58, px(hole.cup.x), py(hole.cup.y) - 46);
    const name = sharpText(this, W / 2, Y0 + 24, `${this.state.holeIndex + 1}. ${hole.name}  ·  par ${hole.par}`, 22, COLORS.ink);
    name.setAlpha(0.7);
    this.course.add([g, name]);
  }

  private drawStrip(): void {
    for (const text of this.strip) text.destroy();
    this.strip = [];
    const state = this.state;
    const names = this.session.seats.map((s) => s.label);
    const width = (W - 40) / state.players;
    for (let p = 0; p < state.players; p++) {
      const over = state.total(p) - state.parSoFar(p);
      const score = state.parSoFar(p) === 0 ? '0' : `${state.total(p)} (${over === 0 ? 'par' : over > 0 ? `+${over}` : over})`;
      const x = 20 + width * p + width / 2;
      const text = sharpText(this, x, 48, `${names[p] ?? `Player ${p + 1}`}  ${score}`, 24, p === state.currentSeat && !state.result ? GOLF_COLORS[p]! : COLORS.soft);
      text.setFontStyle(p === state.currentSeat && !state.result ? 'bold' : '600');
      this.strip.push(text);
    }
  }

  /** The ball where the rules say, the right hole drawn, and the aim for whoever is up. */
  private settle(): void {
    const state = this.state;
    this.playing = null;
    if (this.shownHole !== state.holeIndex) {
      this.shownHole = state.holeIndex;
      this.drawCourse(state.hole);
      this.course.setAlpha(0).setX(40);
      this.tweens.add({ targets: this.course, alpha: 1, x: 0, duration: 260, ease: 'Quad.easeOut' });
      this.busyUntil = Math.max(this.busyUntil, this.time.now + 280);
      this.aim = Math.atan2(state.hole.cup.y - state.ball.y, state.hole.cup.x - state.ball.x);
    }
    this.ring.clear();
    this.ring.lineStyle(4, toHex(GOLF_COLORS[state.currentSeat] ?? COLORS.ink), 1);
    this.ring.strokeCircle(0, 0, GOLF_R * S * 1.25);
    this.ball.setVisible(!state.result || state.last?.outcome.end !== 'cup').setAlpha(1).setScale(1).setPosition(px(state.ball.x), py(state.ball.y));
    this.drawStrip();
    this.drawGuide();
  }

  private sync(): void {
    const last = this.state.last;
    if (!last) {
      this.settle();
      return;
    }
    this.guide.clear();
    this.ball.setVisible(true).setAlpha(1).setScale(1).setPosition(px(last.from.x), py(last.from.y));
    this.playing = { frames: last.outcome.frames, frameMs: last.outcome.frameMs, start: this.time.now, events: last.outcome.events, heard: 0 };
    cue('tap');
  }

  update(): void {
    const play = this.playing;
    if (!play) return;
    const elapsed = this.time.now - play.start;
    const count = play.frames.length / 2;
    const index = Math.min(count - 1, Math.floor(elapsed / play.frameMs));
    this.ball.setPosition(px(play.frames[index * 2]!), py(play.frames[index * 2 + 1]!));
    while (play.heard < play.events.length && play.events[play.heard]!.t <= elapsed) {
      const event = play.events[play.heard++]!;
      if (event.kind === 'wall' && event.speed > 0.3) cue('wall');
    }
    if (index < count - 1) return;
    const last = this.state.last!;
    this.playing = null;
    if (last.outcome.end === 'cup') {
      cue('win');
      this.tweens.add({ targets: this.ball, scale: 0.2, alpha: 0, duration: 220, ease: 'Quad.easeIn', onComplete: () => this.settle() });
      this.busyUntil = this.time.now + 260 + SETTLE_MS;
      return;
    }
    if (last.outcome.end === 'water') {
      cue('lose');
      this.tweens.add({ targets: this.ball, scale: 0.5, alpha: 0, duration: 260, onComplete: () => this.settle() });
      this.busyUntil = this.time.now + 300 + SETTLE_MS;
      return;
    }
    this.busyUntil = this.time.now + SETTLE_MS;
    this.settle();
  }

  private canHit(): boolean {
    return !this.playing && !this.state.result && this.session.isHumanTurn() && this.time.now >= this.busyUntil;
  }

  /** A dotted line from the ball: the direction, and its length the power. */
  private drawGuide(): void {
    const g = this.guide.clear();
    if (this.playing || !this.session.isHumanTurn() || this.state.result) return;
    const ball = this.state.ball;
    const length = 40 + this.power * 2.6;
    const dots = Math.max(3, Math.round(length / 22));
    g.fillStyle(0xffffff, 0.95);
    for (let i = 1; i <= dots; i++) {
      const d = (i / dots) * length + GOLF_R * S;
      g.fillCircle(px(ball.x) + Math.cos(this.aim) * d, py(ball.y) + Math.sin(this.aim) * d, i === dots ? 6 : 4);
    }
  }

  private down(x: number, y: number): void {
    if (!this.canHit()) return;
    this.pull = { x, y };
  }

  private move(x: number, y: number): void {
    if (!this.pull || !this.canHit()) return;
    // Pulling back aims the other way, like a slingshot, and the pull is the power.
    const dx = this.pull.x - x;
    const dy = this.pull.y - y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 8) return;
    this.aim = Math.atan2(dy, dx);
    this.power = Math.round(Math.min(100, (d / FULL_PULL) * 100));
    this.drawGuide();
  }

  private up(): void {
    const pull = this.pull;
    this.pull = null;
    if (!pull || !this.canHit()) return;
    if (this.power >= 3) this.hit();
  }

  private hit(): void {
    const move = strokeMove(Math.round(Math.cos(this.aim) * 10_000), Math.round(Math.sin(this.aim) * 10_000), this.power);
    if (!this.state.allows(move)) return;
    this.session.play(move);
  }

  private key(key: string): boolean {
    if (!this.canHit()) return false;
    const step = arrow(key);
    if (step && step[0] !== 0) {
      this.aim += step[0] * (Math.PI / 180) * (this.shift ? 0.2 : 2);
      this.drawGuide();
      return true;
    }
    if (step && step[1] !== 0) {
      this.power = Math.min(100, Math.max(1, this.power - step[1] * 5));
      this.drawGuide();
      return true;
    }
    if (key === ' ' || key === 'Enter') {
      this.hit();
      return true;
    }
    return false;
  }

  /** The score strip and the course, top to bottom, for `e2e/wordlayout.spec.ts`. */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    return [
      { name: 'the scores', top: 30, bottom: 66 },
      { name: 'the course', top: Y0 - 14, bottom: Y0 + COURSE_H * S },
    ];
  }
}
