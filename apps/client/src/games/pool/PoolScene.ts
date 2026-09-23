import { BALL_R, encodeShot, POCKETS, TABLE_H, TABLE_W, type TablePoint, type PoolMove, type PoolState, type ShotEvent } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { arrow, isPress, onKeys } from '../keys';

const W = 720;
const H = 1040;
export const POOL_SIZE = { width: W, height: H };

/** Pixels per millimetre of cloth, and the rail round it. */
const S = 0.355;
const RAIL = 26;
/** The table and the power bar beside it, centred together. */
const SPAN = RAIL * 2 + TABLE_W * S + 58 + 22;
const TX = (W - SPAN) / 2 + RAIL;
const TY = (H - TABLE_H * S) / 2;
/** The power bar beside the table. */
const BAR_X = TX + TABLE_W * S + RAIL + 58;
const BAR_TOP = TY + 140;
const BAR_H = TABLE_H * S - 280;

const FELT = toHex(DARK.mint);
const FELT_LINE = toHex('#0C8F59');
const RAIL_FILL = toHex(COLORS.peach);
const RAIL_LIP = toHex(DARK.peach);
const INK = toHex(COLORS.ink);
/** Ball colours, 1 to 7 (the stripes 9 to 15 share them). Six is pink here, not green, so it shows on green cloth. */
const BALL_COLORS = [COLORS.sunny, COLORS.sky, COLORS.tomato, COLORS.grape, COLORS.peach, COLORS.bubblegum, '#8E3B2F'].map(toHex);

const px = (x: number) => TX + x * S;
const py = (y: number) => TY + y * S;

/**
 * Pool. The rules play each shot out and hand back where every ball was every 16ms, so this scene
 * never simulates anything: it plays those frames back, then puts every ball where the rules say it
 * stopped. What you see is what the referee saw.
 */
export class PoolScene extends Scene {
  private readonly balls: GameObjects.Container[] = [];
  private guide!: GameObjects.Graphics;
  private stick!: GameObjects.Graphics;
  private bar!: GameObjects.Graphics;
  private calls!: GameObjects.Graphics;
  /** Where the cue ball is pointed, as an angle; it becomes whole numbers only when the shot is played. */
  private aim = -Math.PI / 2;
  private power = 60;
  private place: TablePoint | null = null;
  private call: number | null = null;
  private drag: 'aim' | 'place' | 'power' | null = null;
  private playing: { frames: readonly Float64Array[]; frameMs: number; start: number; events: readonly ShotEvent[]; heard: number } | null = null;
  private busyUntil = 0;
  private placing = false;
  private shift = false;

  constructor(private readonly session: Session<PoolMove>) {
    super('pool');
  }

  private get state(): PoolState {
    return this.session.state as PoolState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.drawTable();
    for (let ball = 0; ball < 16; ball++) this.balls.push(this.makeBall(ball));
    this.calls = this.add.graphics().setDepth(4);
    this.guide = this.add.graphics().setDepth(5);
    this.stick = this.add.graphics().setDepth(20);
    this.bar = this.add.graphics().setDepth(5);

    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.down(p.worldX, p.worldY));
    this.input.on('pointermove', (p: { worldX: number; worldY: number; isDown: boolean }) => p.isDown && this.move(p.worldX, p.worldY));
    this.input.on('pointerup', () => this.up());
    onKeys(this, (key) => this.key(key));
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => (this.shift = event.shiftKey));
    this.input.keyboard?.on('keyup', (event: KeyboardEvent) => (this.shift = event.shiftKey));

    this.settle();
    const unsubscribe = this.session.subscribe(() => this.sync());
    // A bot waits for the last shot to stop rolling on screen before it takes its own.
    this.session.holdBots = () => this.busy();
    this.events.once('shutdown', () => {
      unsubscribe();
      this.session.holdBots = null;
    });
  }

  /** Still playing the last shot. See `apps/client/src/games/busy.ts`. */
  busy(): boolean {
    return this.playing !== null || this.time.now < this.busyUntil;
  }

  private drawTable(): void {
    const g = this.add.graphics();
    const w = TABLE_W * S;
    const h = TABLE_H * S;
    g.fillStyle(RAIL_LIP, 1);
    g.fillRoundedRect(TX - RAIL, TY - RAIL + 7, w + RAIL * 2, h + RAIL * 2, 30);
    g.fillStyle(RAIL_FILL, 1);
    g.fillRoundedRect(TX - RAIL, TY - RAIL, w + RAIL * 2, h + RAIL * 2, 30);
    g.fillStyle(FELT, 1);
    g.fillRect(TX, TY, w, h);
    // The head string and the foot spot, as on a real cloth.
    g.lineStyle(2, FELT_LINE, 1);
    g.lineBetween(TX, py(TABLE_H * 0.75), TX + w, py(TABLE_H * 0.75));
    g.fillStyle(FELT_LINE, 1);
    g.fillCircle(px(TABLE_W / 2), py(TABLE_H * 0.25), 4);
    // Diamonds on the rails.
    g.fillStyle(0xffffff, 0.85);
    for (let i = 1; i < 4; i++) {
      g.fillCircle(TX + (w * i) / 4, TY - RAIL / 2, 3);
      g.fillCircle(TX + (w * i) / 4, TY + h + RAIL / 2, 3);
    }
    for (let i = 1; i < 8; i++) {
      if (i === 4) continue;
      g.fillCircle(TX - RAIL / 2, TY + (h * i) / 8, 3);
      g.fillCircle(TX + w + RAIL / 2, TY + (h * i) / 8, 3);
    }
    for (const pocket of POCKETS) {
      g.fillStyle(INK, 1);
      g.fillCircle(px(pocket.x), py(pocket.y), pocket.r * S * 0.95);
    }
  }

  private makeBall(ball: number): GameObjects.Container {
    const r = BALL_R * S;
    const g = this.add.graphics();
    if (ball === 0) {
      g.fillStyle(0xffffff, 1);
      g.fillCircle(0, 0, r);
    } else if (ball === 8) {
      g.fillStyle(INK, 1);
      g.fillCircle(0, 0, r);
    } else {
      const color = BALL_COLORS[ball > 8 ? ball - 9 : ball - 1]!;
      if (ball < 8) {
        g.fillStyle(color, 1);
        g.fillCircle(0, 0, r);
      } else {
        // A stripe: white, with a band of colour round the middle.
        g.fillStyle(0xffffff, 1);
        g.fillCircle(0, 0, r);
        g.fillStyle(color, 1);
        g.beginPath();
        const band = r * 0.56;
        const a = Math.asin(band / r);
        for (let i = 0; i <= 12; i++) {
          const t = -a + (i / 12) * 2 * a;
          g.lineTo(Math.cos(t) * r, Math.sin(t) * r);
        }
        for (let i = 0; i <= 12; i++) {
          const t = Math.PI - a + (i / 12) * 2 * a;
          g.lineTo(Math.cos(t) * r, Math.sin(t) * r);
        }
        g.closePath();
        g.fillPath();
      }
    }
    const parts: GameObjects.GameObject[] = [g];
    if (ball > 0) {
      g.fillStyle(0xffffff, 1);
      g.fillCircle(0, 0, r * 0.5);
      parts.push(sharpText(this, 0, 0.5, String(ball), r * 0.62, COLORS.ink).setFontStyle('bold'));
    }
    const shine = this.add.graphics();
    shine.fillStyle(0xffffff, 0.35);
    shine.fillCircle(-r * 0.38, -r * 0.4, r * 0.22);
    parts.push(shine);
    return this.add.container(0, 0, parts).setDepth(10);
  }

  /** Every ball where the rules say it stopped, and the controls for whoever shoots next. */
  private settle(): void {
    const state = this.state;
    this.playing = null;
    state.balls.forEach((ball, i) => {
      const view = this.balls[i]!;
      if (ball) view.setVisible(true).setAlpha(1).setScale(1).setPosition(px(ball.x), py(ball.y));
      else view.setVisible(false);
    });
    this.place = state.inHand !== 'none' ? state.defaultSpot() : null;
    this.placing = state.inHand !== 'none';
    this.call = state.onEight(state.currentSeat) ? this.suggestedCall() : null;
    if (this.place) this.balls[0]!.setVisible(true).setPosition(px(this.place.x), py(this.place.y));
    this.drawControls();
  }

  private sync(): void {
    const last = this.state.last;
    if (!last) {
      this.settle();
      return;
    }
    // The shot is played back from where the cue ball was put.
    last.from.forEach((ball, i) => {
      const view = this.balls[i]!;
      if (ball) view.setVisible(true).setAlpha(1).setScale(1).setPosition(px(ball.x), py(ball.y));
      else view.setVisible(false);
    });
    this.guide.clear();
    this.stick.clear();
    this.calls.clear();
    this.playing = { frames: last.outcome.frames, frameMs: last.outcome.frameMs, start: this.time.now, events: last.outcome.events, heard: 0 };
    cue('hit');
  }

  update(): void {
    const play = this.playing;
    if (!play) return;
    const elapsed = this.time.now - play.start;
    const index = Math.min(play.frames.length - 1, Math.floor(elapsed / play.frameMs));
    const frame = play.frames[index]!;
    for (let i = 0; i < 16; i++) {
      const x = frame[i * 2]!;
      const y = frame[i * 2 + 1]!;
      const view = this.balls[i]!;
      if (Number.isNaN(x)) {
        // Dropped: it shrinks into the pocket rather than blinking out.
        if (view.visible && view.alpha === 1) this.tweens.add({ targets: view, scale: 0.4, alpha: 0, duration: 160, onComplete: () => view.setVisible(false) });
        continue;
      }
      view.setPosition(px(x), py(y));
    }
    // The sounds of the shot, as the playback reaches them.
    while (play.heard < play.events.length && play.events[play.heard]!.t <= elapsed) {
      const event = play.events[play.heard++]!;
      if (event.kind === 'pocket') cue('place');
      else if (event.kind === 'hit' && event.speed > 0.4) cue('tap');
      else if (event.kind === 'cushion' && event.speed > 0.8) cue('wall');
    }
    if (index >= play.frames.length - 1) {
      this.busyUntil = this.time.now + 180;
      this.settle();
    }
  }

  private canShoot(): boolean {
    return !this.playing && !this.state.result && this.session.isHumanTurn();
  }

  private cuePoint(): TablePoint | null {
    return this.place ?? this.state.balls[0];
  }

  /** The pocket the 8 is heading for on the current aim, as the default call. */
  private suggestedCall(): number {
    const eight = this.state.balls[8];
    if (!eight) return 0;
    let best = 0;
    let bestScore = -Infinity;
    POCKETS.forEach((pocket, i) => {
      const dx = pocket.x - eight.x;
      const dy = pocket.y - eight.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const score = (dx * Math.cos(this.aim) + dy * Math.sin(this.aim)) / d - d / 4000;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    });
    return best;
  }

  /** The aim guide, the ghost ball, the cue stick, the power bar and the called pocket. */
  private drawControls(): void {
    const g = this.guide.clear();
    this.stick.clear();
    this.bar.clear();
    this.calls.clear();
    const state = this.state;
    const mine = this.canShoot();
    const from = this.cuePoint();
    if (!mine || !from) return;
    const dir = { x: Math.cos(this.aim), y: Math.sin(this.aim) };
    const hit = this.traceAim(from, dir);
    g.lineStyle(3, 0xffffff, 0.8);
    g.lineBetween(px(from.x), py(from.y), px(hit.at.x), py(hit.at.y));
    g.lineStyle(3, 0xffffff, 0.9);
    g.strokeCircle(px(hit.at.x), py(hit.at.y), BALL_R * S);
    if (hit.ball !== null) {
      const ball = state.balls[hit.ball]!;
      const nx = ball.x - hit.at.x;
      const ny = ball.y - hit.at.y;
      const nd = Math.sqrt(nx * nx + ny * ny);
      const legal = state.targets(state.currentSeat).includes(hit.ball);
      g.lineStyle(3, legal ? 0xffffff : toHex(COLORS.tomato), 0.9);
      g.lineBetween(px(ball.x), py(ball.y), px(ball.x + (nx / nd) * 260), py(ball.y + (ny / nd) * 260));
    }
    // The cue stick, pulled back by the power.
    const back = BALL_R * S + 10 + this.power * 0.9;
    const sx = px(from.x) - dir.x * back;
    const sy = py(from.y) - dir.y * back;
    this.stick.lineStyle(10, toHex('#C98A4B'), 1);
    this.stick.lineBetween(sx, sy, sx - dir.x * 300, sy - dir.y * 300);
    this.stick.lineStyle(10, 0xffffff, 1);
    this.stick.lineBetween(sx, sy, sx - dir.x * 14, sy - dir.y * 14);
    // The power bar.
    this.bar.fillStyle(0xe6e0f4, 1);
    this.bar.fillRoundedRect(BAR_X - 22, BAR_TOP - 8, 44, BAR_H + 16, 22);
    this.bar.fillStyle(toHex(COLORS.tomato), 1);
    const filled = (BAR_H * this.power) / 100;
    this.bar.fillRoundedRect(BAR_X - 14, BAR_TOP + BAR_H - filled, 28, filled, 14);
    // The called pocket for the 8.
    if (this.call !== null) {
      POCKETS.forEach((pocket, i) => {
        this.calls.lineStyle(i === this.call ? 6 : 3, i === this.call ? toHex(COLORS.sunny) : 0xffffff, i === this.call ? 1 : 0.5);
        this.calls.strokeCircle(px(pocket.x), py(pocket.y), pocket.r * S + 6);
      });
    }
  }

  /** Where the cue ball would first touch something along the aim: a ball, or a cushion. */
  private traceAim(from: TablePoint, dir: TablePoint): { at: TablePoint; ball: number | null } {
    let best = Infinity;
    let ball: number | null = null;
    this.state.balls.forEach((b, i) => {
      if (!b || i === 0) return;
      const ox = b.x - from.x;
      const oy = b.y - from.y;
      const along = ox * dir.x + oy * dir.y;
      if (along <= 0) return;
      const off2 = ox * ox + oy * oy - along * along;
      const reach = 4 * BALL_R * BALL_R - off2;
      if (reach < 0) return;
      const t = along - Math.sqrt(reach);
      if (t < best) {
        best = t;
        ball = i;
      }
    });
    const walls = [
      dir.x > 0 ? (TABLE_W - BALL_R - from.x) / dir.x : dir.x < 0 ? (BALL_R - from.x) / dir.x : Infinity,
      dir.y > 0 ? (TABLE_H - BALL_R - from.y) / dir.y : dir.y < 0 ? (BALL_R - from.y) / dir.y : Infinity,
    ];
    const wall = Math.min(...walls);
    if (wall < best) {
      best = wall;
      ball = null;
    }
    return { at: { x: from.x + dir.x * best, y: from.y + dir.y * best }, ball };
  }

  private toTable(x: number, y: number): TablePoint {
    return { x: (x - TX) / S, y: (y - TY) / S };
  }

  private down(x: number, y: number): void {
    if (!this.canShoot()) return;
    if (Math.abs(x - BAR_X) < 40 && y > BAR_TOP - 30 && y < BAR_TOP + BAR_H + 30) {
      this.drag = 'power';
      this.move(x, y);
      return;
    }
    const at = this.toTable(x, y);
    // A tap on a pocket calls it, when there is the 8 to call.
    if (this.call !== null) {
      const pocket = POCKETS.findIndex((p) => (p.x - at.x) * (p.x - at.x) + (p.y - at.y) * (p.y - at.y) < (p.r + 40) * (p.r + 40));
      if (pocket >= 0) {
        this.call = pocket;
        this.drawControls();
        return;
      }
    }
    const from = this.cuePoint();
    if (this.place && from && (from.x - at.x) * (from.x - at.x) + (from.y - at.y) * (from.y - at.y) < (BALL_R * 3) * (BALL_R * 3)) {
      this.drag = 'place';
      return;
    }
    this.drag = 'aim';
    this.move(x, y);
  }

  private move(x: number, y: number): void {
    if (!this.drag || !this.canShoot()) return;
    if (this.drag === 'power') {
      this.power = Math.round(Math.min(100, Math.max(1, ((BAR_TOP + BAR_H - y) / BAR_H) * 100)));
    } else if (this.drag === 'place') {
      const at = this.toTable(x, y);
      const spot = { x: Math.round(at.x), y: Math.round(at.y) };
      // The cue ball only goes where the rules would take it: on the cloth, clear of the others, and
      // behind the head string for the break.
      if (this.state.accepts(this.moveFor(spot, 50))) {
        this.place = spot;
        this.balls[0]!.setPosition(px(spot.x), py(spot.y));
      }
    } else {
      const from = this.cuePoint();
      if (!from) return;
      const at = this.toTable(x, y);
      if ((at.x - from.x) * (at.x - from.x) + (at.y - from.y) * (at.y - from.y) < 100) return;
      this.aim = Math.atan2(at.y - from.y, at.x - from.x);
      if (this.call !== null && this.state.onEight(this.state.currentSeat)) this.call = this.suggestedCall();
    }
    this.drawControls();
  }

  private up(): void {
    const was = this.drag;
    this.drag = null;
    // Letting go of the power bar plays the shot, the way pulling back a cue and letting it go does.
    if (was === 'power') this.shoot();
  }

  /** The move for the current aim and `power`, with the cue ball at `place` if it is in hand. */
  private moveFor(place: TablePoint | null, power: number): PoolMove {
    return encodeShot({
      dx: Math.round(Math.cos(this.aim) * 10_000),
      dy: Math.round(Math.sin(this.aim) * 10_000),
      power,
      place: this.state.inHand === 'none' ? null : place,
      call: this.call,
    });
  }

  private shoot(): void {
    if (!this.canShoot()) return;
    const move = this.moveFor(this.place, this.power);
    if (!this.state.accepts(move)) return;
    this.session.play(move);
  }

  private key(key: string): boolean {
    if (!this.canShoot()) return false;
    const step = arrow(key);
    if (this.placing && this.place && step) {
      const spot = { x: this.place.x + step[0] * 20, y: this.place.y + step[1] * 20 };
      if (this.state.accepts(this.moveFor(spot, 50))) {
        this.place = spot;
        this.balls[0]!.setPosition(px(spot.x), py(spot.y));
        this.drawControls();
      }
      return true;
    }
    if (this.placing && isPress(key)) {
      this.placing = false;
      return true;
    }
    if (step && step[0] !== 0) {
      // A degree a press, a tenth of one with Shift for the fine adjustments at the end.
      this.aim += step[0] * (Math.PI / 180) * (this.shift ? 0.1 : 1);
      if (this.call !== null) this.call = this.suggestedCall();
      this.drawControls();
      return true;
    }
    if (step && step[1] !== 0) {
      this.power = Math.min(100, Math.max(1, this.power - step[1] * 5));
      this.drawControls();
      return true;
    }
    if (key === ' ' || key === 'Enter') {
      this.shoot();
      return true;
    }
    return false;
  }

  /** Whether every ball is drawn where the rules say, for the Q1 check in `e2e/wordlayout.spec.ts`. */
  boardCheck(): { settled: number; wrong: number; note: string } {
    if (this.busy()) return { settled: 0, wrong: 0, note: '' };
    let wrong = 0;
    let note = '';
    this.state.balls.forEach((ball, i) => {
      const view = this.balls[i]!;
      const where = i === 0 && this.place ? this.place : ball;
      if (!where) {
        if (view.visible) {
          wrong++;
          note = `ball ${i} is down but still drawn`;
        }
        return;
      }
      if (!view.visible || Math.abs(view.x - px(where.x)) > 1 || Math.abs(view.y - py(where.y)) > 1) {
        wrong++;
        note = `ball ${i} is drawn at ${Math.round(view.x)},${Math.round(view.y)}, the rules put it at ${Math.round(px(where.x))},${Math.round(py(where.y))}`;
      }
    });
    return { settled: 16, wrong, note };
  }
}
