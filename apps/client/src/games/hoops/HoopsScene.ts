import {
  BOARD,
  COURT,
  FLOOR_Y,
  HOOPS_BALL_R,
  HOOPS_CANVAS,
  HOOPS_STEP,
  HOOPS_TIERS,
  hoopsBotInput,
  newHoops,
  perfectThrow,
  RIM,
  stepHoops,
  type HoopsEvents,
  type HoopsInput,
  type HoopsState,
  type Seat,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { COLORS, DARK, toHex } from '../../theme';
import type { RealtimeSceneOptions } from '../air-hockey/AirHockeyScene';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed, SPEED } from '../../autoplay';
import { facing, isPerson, onDuelKeys } from '../duel';

export const HOOPS_SIZE = { width: HOOPS_CANVAS.width, height: HOOPS_CANVAS.height };
export const HOOPS_COLORS = [COLORS.sky, COLORS.tomato];

const W = HOOPS_CANVAS.width;
const H = HOOPS_CANVAS.height;
const SEAT_HEX = HOOPS_COLORS.map(toHex);
const SEAT_DARK = [DARK.sky, DARK.tomato].map(toHex);
const BALL = toHex(COLORS.peach);
const BALL_DARK = toHex(DARK.peach);
const WOOD = toHex('#E8B878');
const WOOD_DARK = toHex('#C98F5A');
/** A flick's speed, px a second on the canvas, to a throw's speed. */
const FLICK = 0.55;

interface Flick {
  readonly seat: Seat;
  samples: { x: number; y: number; t: number }[];
}

/**
 * Basketball Hoops. The rules fly both balls, each in its own court; the scene gives each player
 * their half of the phone as a little side-on court (the top one turned round), with a backboard,
 * a rim and a net that swings when the ball drops through.
 */
export class HoopsScene extends Scene {
  private state: HoopsState;
  private accumulator = 0;
  private clockTime = 0;
  private ended = false;
  private flicks = new Map<number, Flick>();
  private queued: [HoopsInput['throw'], HoopsInput['throw']] = [null, null];
  /** Keyboard throws: a power meter that swings until the second press. */
  private meter: [number | null, number | null] = [null, null];
  private courts: GameObjects.Container[] = [];
  private art: GameObjects.Graphics[] = [];
  private scoreTexts: GameObjects.Text[] = [];
  private clocks: GameObjects.Text[] = [];
  private calls: GameObjects.Text[] = [];
  private banner!: GameObjects.Text;
  private swing: [number, number] = [0, 0];
  private spin: [number, number] = [0, 0];

  constructor(private readonly options: RealtimeSceneOptions) {
    super('hoops');
    this.state = newHoops(options.seed);
  }

  /** A canvas point in `seat`'s own court frame. */
  private local(seat: Seat, x: number, y: number): { x: number; y: number } {
    return seat === 0 ? { x, y: y - H / 2 } : { x: W - x, y: H / 2 - y };
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.input.addPointer(3);
    for (const seat of [0, 1] as const) {
      const court = this.add.container(seat === 0 ? 0 : W, H / 2).setAngle(seat === 0 ? 0 : 180);
      const back = this.add.graphics();
      this.drawCourt(back, seat);
      const art = this.add.graphics();
      const call = sharpText(this, (RIM.front + RIM.back) / 2 - 60, RIM.y - 70, '', 34, COLORS.ink).setFontStyle('bold').setStroke('#FFFFFF', 6).setAlpha(0);
      court.add([back, art, call]);
      this.courts.push(court);
      this.art.push(art);
      this.calls.push(call);
    }
    // Scores and clocks sit in world space, so they can face whoever is reading them.
    this.scoreTexts = [0, 1].map((seat) =>
      sharpText(this, seat === 0 ? 150 : W - 150, seat === 0 ? H * 0.72 : H * 0.28, '0', 100, HOOPS_COLORS[seat]!)
        .setAlpha(0.3)
        .setDepth(-1)
        .setFontStyle('bold')
        .setAngle(facing(this.options.seats, seat as Seat)),
    );
    const people = this.options.seats.filter((c) => c.kind === 'human').length;
    this.clocks = (people === 2 ? [0, 1] : [0]).map((seat) =>
      sharpText(this, W / 2, H / 2 + (people === 2 ? (seat === 0 ? 22 : -22) : 0), '', 26, COLORS.ink)
        .setFontStyle('bold')
        .setDepth(5)
        .setAngle(people === 2 ? (seat === 0 ? 0 : 180) : facing(this.options.seats, 0)),
    );
    this.banner = sharpText(this, W / 2, H / 2, '', 50, COLORS.ink).setDepth(10).setFontStyle('bold').setStroke('#FFFFFF', 8);
    this.input.on('pointerdown', (p: { id: number; worldX: number; worldY: number }) => {
      const seat: Seat = p.worldY > H / 2 ? 0 : 1;
      if (this.options.seats[seat]?.kind !== 'human') return;
      this.flicks.set(p.id, { seat, samples: [{ x: p.worldX, y: p.worldY, t: this.time.now / 1000 }] });
    });
    this.input.on('pointermove', (p: { id: number; worldX: number; worldY: number }) => {
      const flick = this.flicks.get(p.id);
      if (!flick) return;
      flick.samples.push({ x: p.worldX, y: p.worldY, t: this.time.now / 1000 });
      if (flick.samples.length > 30) flick.samples.shift();
    });
    const release = (p: { id: number; worldX: number; worldY: number }) => {
      const flick = this.flicks.get(p.id);
      this.flicks.delete(p.id);
      if (!flick) return;
      // The speed of the last tenth of a second or so of the flick, turned into the court's frame.
      const end = { x: p.worldX, y: p.worldY, t: this.time.now / 1000 };
      const start = flick.samples.find((s) => end.t - s.t <= 0.12) ?? flick.samples[0]!;
      const dt = Math.max(end.t - start.t, 1 / 60);
      const a = this.local(flick.seat, start.x, start.y);
      const b = this.local(flick.seat, end.x, end.y);
      if (Math.hypot(b.x - a.x, b.y - a.y) < 25) return;
      this.queued[flick.seat] = { vx: ((b.x - a.x) / dt) * FLICK, vy: ((b.y - a.y) / dt) * FLICK };
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
    // Keyboard: Space (or Shift for the top player) starts the power meter, a second press throws.
    onDuelKeys(this, this.options.seats, (seat, action) => {
      if (action !== 'tap' || this.state.courts[seat].phase !== 'ready') return;
      const m = this.meter[seat];
      if (m === null) {
        this.meter[seat] = this.clockTime;
        return;
      }
      this.meter[seat] = null;
      const t = perfectThrow(this.state.courts[seat].spot);
      const k = 0.85 + 0.3 * this.power(m);
      this.queued[seat] = { vx: t.vx * k, vy: t.vy * k };
    });
    this.shout('Ready…');
    this.options.onScore([0, 0]);
  }

  /** The meter swings from 0 to 1 and back, a full swing a second; the middle is the right throw. */
  private power(since: number): number {
    const t = ((this.clockTime - since) * 1.2) % 2;
    return t < 1 ? t : 2 - t;
  }

  update(_time: number, delta: number): void {
    const dt = (Math.min(delta, 100) * SPEED) / 1000;
    this.clockTime += dt;
    if (!this.ended) {
      this.accumulator += dt;
      while (this.accumulator >= HOOPS_STEP) {
        this.accumulator -= HOOPS_STEP;
        const was = this.state.phase;
        const { state, events } = stepHoops(this.state, [this.inputFor(0), this.inputFor(1)]);
        this.state = state;
        if (was === 'countdown' && state.phase === 'play') this.shout('Go!');
        for (const seat of [0, 1] as const) this.spin[seat] += state.courts[seat].ball.vx * HOOPS_STEP * 0.02;
        this.handle(events);
        if (state.result) {
          this.ended = true;
          this.time.delayedCall(1000, () => this.options.onEnd(state.result!));
          break;
        }
      }
    }
    this.swing = [this.swing[0] * 0.93, this.swing[1] * 0.93];
    this.draw();
  }

  private inputFor(seat: Seat): HoopsInput {
    const controller = this.options.seats[seat];
    if (controller?.kind === 'bot') return hoopsBotInput(this.state, seat, HOOPS_TIERS[controller.tier]);
    const t = this.queued[seat];
    this.queued[seat] = null;
    return { throw: t };
  }

  private handle(events: HoopsEvents): void {
    if (events.thrown.length) this.options.onCue('tap');
    if (events.rim.length) this.options.onCue('clang');
    if (events.board.length) this.options.onCue('thud');
    for (const { seat, swish } of events.scored) {
      this.options.onCue('goal');
      this.options.onScore(this.state.scores);
      this.swing[seat] = 1;
      const text = this.scoreTexts[seat]!;
      text.setText(String(this.state.scores[seat]));
      this.tweens.add({ targets: text, scale: 1.3, duration: 160, yoyo: true, ease: 'Back.easeOut' });
      if (swish) this.call(seat, 'Swish!');
    }
    if (events.buzzer) {
      this.options.onCue('gong');
      this.shout(this.state.phase === 'golden' ? 'Level! Next basket wins' : 'Time!');
    }
  }

  private call(seat: Seat, text: string): void {
    const t = this.calls[seat]!;
    this.tweens.killTweensOf(t);
    t.setText(text).setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: t, scale: 1, duration: 180, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: 500, duration: 250 });
  }

  private shout(text: string): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setAlpha(1).setScale(0.6).setAngle(facing(this.options.seats, 0));
    this.tweens.add({ targets: this.banner, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 800, duration: 250 });
  }

  /** The parts of a court that never move: the floor, the pole and the backboard. */
  private drawCourt(g: GameObjects.Graphics, seat: Seat): void {
    g.fillStyle(SEAT_HEX[seat]!, 0.07);
    g.fillRect(0, 0, COURT.width, COURT.height);
    g.fillStyle(WOOD_DARK, 1);
    g.fillRect(0, FLOOR_Y, COURT.width, COURT.height - FLOOR_Y);
    g.fillStyle(WOOD, 1);
    g.fillRect(0, FLOOR_Y, COURT.width, 8);
    // The pole and its arm.
    g.fillStyle(toHex(COLORS.soft), 1);
    g.fillRoundedRect(572, BOARD.top + 40, 12, FLOOR_Y - BOARD.top - 40, 5);
    g.fillRect(BOARD.x + 6, BOARD.top + 70, 22, 8);
    // The backboard, with its square.
    g.fillStyle(SEAT_DARK[seat]!, 1);
    g.fillRoundedRect(BOARD.x - 2, BOARD.top - 2, 14, BOARD.bottom - BOARD.top + 4, 4);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(BOARD.x, BOARD.top, 8, BOARD.bottom - BOARD.top, 3);
    g.fillStyle(SEAT_HEX[seat]!, 1);
    g.fillRect(BOARD.x, RIM.y - 50, 8, 40);
  }

  private draw(): void {
    const s = this.state;
    for (const seat of [0, 1] as const) {
      const g = this.art[seat]!.clear();
      const court = s.courts[seat];
      const b = court.ball;
      // The net hangs below the rim, swinging when a ball drops through.
      const sway = Math.sin(this.clockTime * 30) * this.swing[seat] * 8;
      g.lineStyle(3, 0xffffff, 1);
      for (let k = 0; k <= 4; k++) {
        const top = RIM.front + ((RIM.back - RIM.front) * k) / 4;
        const bottom = RIM.front + 18 + ((RIM.back - RIM.front - 36) * k) / 4 + sway;
        g.lineBetween(top, RIM.y, bottom, RIM.y + 48 + this.swing[seat] * 10);
      }
      g.lineStyle(2, toHex(COLORS.line), 1);
      g.lineBetween(RIM.front + 8, RIM.y + 24, RIM.back - 8, RIM.y + 24);
      // The ball's shadow on the floor, then the ball: in front of the net, behind the rim's front.
      const lift = Math.max(0, FLOOR_Y - b.y);
      g.fillStyle(0x000000, 0.12 * Math.max(0.3, 1 - lift / 400));
      g.fillEllipse(b.x, FLOOR_Y + 4, HOOPS_BALL_R * 2 * Math.max(0.5, 1 - lift / 600), 8);
      const show = court.phase !== 'done' || court.made;
      if (show) {
        g.fillStyle(BALL_DARK, 1);
        g.fillCircle(b.x, b.y + 2, HOOPS_BALL_R);
        g.fillStyle(BALL, 1);
        g.fillCircle(b.x, b.y, HOOPS_BALL_R);
        const a = this.spin[seat];
        g.lineStyle(2.5, toHex(COLORS.ink), 0.55);
        g.lineBetween(b.x + Math.cos(a) * HOOPS_BALL_R, b.y + Math.sin(a) * HOOPS_BALL_R, b.x - Math.cos(a) * HOOPS_BALL_R, b.y - Math.sin(a) * HOOPS_BALL_R);
        g.strokeCircle(b.x + Math.cos(a + Math.PI / 2) * HOOPS_BALL_R * 1.1, b.y + Math.sin(a + Math.PI / 2) * HOOPS_BALL_R * 1.1, HOOPS_BALL_R * 0.8);
        g.fillStyle(0xffffff, 0.35);
        g.fillCircle(b.x - 7, b.y - 7, 5);
      }
      // The rim, drawn over the ball so a basket drops behind its front edge.
      g.fillStyle(toHex(DARK.tomato), 1);
      g.fillRoundedRect(RIM.front - RIM.r, RIM.y - 3, RIM.back - RIM.front + 2 * RIM.r + 12, 7, 3);
      g.fillStyle(toHex(COLORS.tomato), 1);
      g.fillRoundedRect(RIM.front - RIM.r, RIM.y - 4, RIM.back - RIM.front + 2 * RIM.r + 12, 5, 2.5);
      // A keyboard throw's meter, beside the ball; the middle is just right.
      const m = this.meter[seat];
      if (m !== null && isPerson(this.options.seats, seat) && court.phase === 'ready') {
        const p = this.power(m);
        g.fillStyle(toHex(COLORS.line), 1);
        g.fillRoundedRect(b.x - 50, b.y + 36, 100, 12, 6);
        g.fillStyle(toHex(COLORS.mint), 1);
        g.fillRect(b.x - 6, b.y + 36, 12, 12);
        g.fillStyle(toHex(COLORS.grape), 1);
        g.fillCircle(b.x - 50 + p * 100, b.y + 42, 9);
      }
    }
    const left = Math.ceil(s.clock);
    const text = s.phase === 'golden' ? 'Next basket wins' : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    for (const c of this.clocks) c.setText(text).setColor(left <= 10 && s.phase === 'play' ? COLORS.tomato : COLORS.ink);
  }
}
