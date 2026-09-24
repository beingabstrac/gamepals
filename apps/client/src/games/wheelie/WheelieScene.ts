import {
  FLIP,
  newWheelie,
  PX_PER_M,
  stepWheelie,
  wheelieTotal,
  WHEELIE_CANVAS,
  WHEELIE_RIDES,
  WHEELIE_STEP,
  WHEELIE_TIERS,
  wheelieBotInput,
  type Seat,
  type WheelieEvents,
  type WheelieInput,
  type WheelieState,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { COLORS, DARK, toHex } from '../../theme';
import type { RealtimeSceneOptions } from '../air-hockey/AirHockeyScene';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed, SPEED } from '../../autoplay';
import { facing, heldTaps } from '../duel';

export const WHEELIE_SIZE = { width: WHEELIE_CANVAS.width, height: WHEELIE_CANVAS.height };
export const WHEELIE_COLORS = [COLORS.sky, COLORS.tomato];

const W = WHEELIE_CANVAS.width;
const H = WHEELIE_CANVAS.height;
const SEAT_HEX = WHEELIE_COLORS.map(toHex);
const SEAT_DARK = [DARK.sky, DARK.tomato].map(toHex);
/** Each half, seen side on: the ground, and the back wheel's axle. */
const GROUND = 390;
const AXLE = { x: 170, y: 360 };
const WHEEL_R = 30;
const BASE = 115;
const BUMP_EVERY = 90;

/**
 * Wheelie. The rules balance both bikes; the scene draws each player's half as a road seen side
 * on (the top one turned round), the bike pivoting on its back wheel, the bumps rolling past, and
 * the metres as they count. Each player's half is their throttle.
 */
export class WheelieScene extends Scene {
  private state: WheelieState;
  private accumulator = 0;
  private ended = false;
  private fingers = new Map<number, Seat>();
  private keys: (seat: Seat) => boolean = () => false;
  private art: GameObjects.Graphics[] = [];
  private metres: GameObjects.Text[] = [];
  private rides: GameObjects.Text[] = [];
  private calls: GameObjects.Text[] = [];
  private banner!: GameObjects.Text;

  constructor(private readonly options: RealtimeSceneOptions) {
    super('wheelie');
    this.state = newWheelie(options.seed);
  }

  /** A height in `seat`'s half, turned into the canvas. */
  private worldY(seat: Seat, y: number): number {
    return seat === 0 ? H / 2 + y : H / 2 - y;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.input.addPointer(3);
    for (const seat of [0, 1] as const) {
      const half = this.add.container(seat === 0 ? 0 : W, H / 2).setAngle(seat === 0 ? 0 : 180);
      const art = this.add.graphics();
      half.add(art);
      this.art.push(art);
    }
    // Words sit in world space so they can face whoever is reading them.
    for (const seat of [0, 1] as const) {
      const angle = facing(this.options.seats, seat);
      this.metres.push(sharpText(this, W / 2 + 90, this.worldY(seat, 70), '', 44, WHEELIE_COLORS[seat]!).setFontStyle('bold').setDepth(3).setAngle(angle));
      this.rides.push(sharpText(this, W / 2 + 90, this.worldY(seat, 118), '', 22, COLORS.soft).setDepth(3).setAngle(angle));
      this.calls.push(sharpText(this, W / 2 + 90, this.worldY(seat, 170), '', 34, COLORS.ink).setFontStyle('bold').setStroke('#FFFFFF', 6).setDepth(4).setAngle(angle).setAlpha(0));
    }
    this.banner = sharpText(this, W / 2, H / 2, '', 46, COLORS.ink).setDepth(10).setFontStyle('bold').setStroke('#FFFFFF', 8);
    // Each finger holds the throttle of the half it came down in, until it lifts.
    this.input.on('pointerdown', (p: { id: number; worldY: number }) => {
      const seat: Seat = p.worldY > H / 2 ? 0 : 1;
      if (this.options.seats[seat]?.kind === 'human') this.fingers.set(p.id, seat);
    });
    const lift = (p: { id: number }) => this.fingers.delete(p.id);
    this.input.on('pointerup', lift);
    this.input.on('pointerupoutside', lift);
    this.keys = heldTaps(this, this.options.seats);
    this.shout('Ready…');
    this.options.onScore([0, 0]);
  }

  update(_time: number, delta: number): void {
    if (!this.ended) {
      this.accumulator += (Math.min(delta, 100) * SPEED) / 1000;
      while (this.accumulator >= WHEELIE_STEP) {
        this.accumulator -= WHEELIE_STEP;
        const was = this.state.phase;
        const { state, events } = stepWheelie(this.state, [this.inputFor(0), this.inputFor(1)]);
        this.state = state;
        if (was === 'countdown' && state.phase === 'ride') this.shout('Go!');
        this.handle(events);
        if (state.result) {
          this.ended = true;
          this.time.delayedCall(1200, () => this.options.onEnd(state.result!));
          break;
        }
      }
    }
    this.draw();
  }

  private inputFor(seat: Seat): WheelieInput {
    const controller = this.options.seats[seat];
    if (controller?.kind === 'bot') return wheelieBotInput(this.state, seat, WHEELIE_TIERS[controller.tier]);
    return { held: this.keys(seat) || [...this.fingers.values()].includes(seat) };
  }

  private handle(events: WheelieEvents): void {
    if (events.lifted.length) this.options.onCue('pull');
    if (events.bumped.length) this.options.onCue('tap');
    for (const seat of events.landed) {
      const r = this.state.riders[seat];
      const m = r.scores[r.scores.length - 1] ?? 0;
      this.options.onCue(m > 0 ? 'place' : 'buzz');
      this.call(seat, m > 0 ? `${m.toFixed(1)} m!` : 'No wheelie');
    }
    for (const seat of events.flipped) {
      this.options.onCue('thud');
      this.cameras.main.shake(200, 0.01);
      this.call(seat, 'Over! 0 m');
    }
    if (events.landed.length || events.flipped.length) this.options.onScore([Math.round(wheelieTotal(this.state.riders[0])), Math.round(wheelieTotal(this.state.riders[1]))]);
    if (this.state.result) {
      const [winner] = this.state.result.winners;
      this.shout(winner === undefined ? 'All level!' : `${winner === 0 ? 'Blue' : 'Red'} wins!`);
    }
  }

  private call(seat: Seat, text: string): void {
    const t = this.calls[seat]!;
    this.tweens.killTweensOf(t);
    t.setText(text).setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: t, scale: 1, duration: 180, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: 700, duration: 250 });
  }

  private shout(text: string): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setAlpha(1).setScale(0.6).setAngle(facing(this.options.seats, 0));
    this.tweens.add({ targets: this.banner, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 800, duration: 250 });
  }

  private wheel(g: GameObjects.Graphics, x: number, y: number, turn: number): void {
    g.fillStyle(toHex(COLORS.ink), 1);
    g.fillCircle(x, y, WHEEL_R);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(x, y, WHEEL_R - 9);
    g.lineStyle(3, toHex(COLORS.soft), 1);
    for (let k = 0; k < 3; k++) {
      const a = turn + (k * Math.PI) / 3;
      g.lineBetween(x - Math.cos(a) * (WHEEL_R - 9), y - Math.sin(a) * (WHEEL_R - 9), x + Math.cos(a) * (WHEEL_R - 9), y + Math.sin(a) * (WHEEL_R - 9));
    }
    g.fillStyle(toHex(COLORS.ink), 1);
    g.fillCircle(x, y, 5);
  }

  private draw(): void {
    const s = this.state;
    for (const seat of [0, 1] as const) {
      const g = this.art[seat]!.clear();
      const r = s.riders[seat];
      g.fillStyle(SEAT_HEX[seat]!, 0.08);
      g.fillRect(0, 0, W, H / 2);
      // The road and its bumps rolling past, hills far off to show the speed.
      for (let k = -1; k < 5; k++) {
        const x = ((((k * 260 - r.road * 0.3) % 1300) + 1300) % 1300) - 130;
        g.fillStyle(toHex('#DCEFD2'), 1);
        g.fillEllipse(x, GROUND, 300, 150);
      }
      g.fillStyle(toHex('#C9C2E0'), 1);
      g.fillRect(0, GROUND, W, H / 2 - GROUND);
      g.fillStyle(0xffffff, 0.8);
      for (let x = -(r.road % 80); x < W; x += 80) g.fillRect(x, GROUND + 22, 40, 6);
      const first = Math.floor(r.road / BUMP_EVERY);
      for (let k = first; k < first + 8; k++) {
        const x = AXLE.x + (k * BUMP_EVERY - r.road);
        g.fillStyle(toHex(COLORS.soft), 1);
        g.fillEllipse(x, GROUND, 26, 10);
      }
      // The bike, pivoting on its back wheel.
      const a = Math.min(r.angle, FLIP);
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const at = (along: number, up: number) => ({ x: AXLE.x + cos * along - sin * up, y: AXLE.y - sin * along - cos * up });
      const front = at(BASE, 0);
      const turn = r.road / WHEEL_R;
      this.wheel(g, AXLE.x, AXLE.y, turn);
      this.wheel(g, front.x, front.y, turn);
      const seatAt = at(40, 34);
      const bars = at(BASE - 16, 52);
      g.lineStyle(9, SEAT_DARK[seat]!, 1);
      g.lineBetween(AXLE.x, AXLE.y, seatAt.x, seatAt.y);
      g.lineBetween(seatAt.x, seatAt.y, bars.x, bars.y);
      g.lineBetween(bars.x, bars.y, front.x, front.y);
      g.fillStyle(SEAT_HEX[seat]!, 1);
      const tank = [at(30, 20), at(84, 26), at(80, 44), at(36, 40)];
      g.beginPath();
      g.moveTo(tank[0]!.x, tank[0]!.y);
      for (const p of tank.slice(1)) g.lineTo(p.x, p.y);
      g.closePath();
      g.fillPath();
      // The rider: a round body leaning back, a helmet in the player's color.
      const body = at(36, 70);
      const head = at(30, 108);
      g.fillStyle(toHex(COLORS.ink), 1);
      g.fillCircle(body.x, body.y, 20);
      g.lineStyle(7, toHex(COLORS.ink), 1);
      g.lineBetween(body.x, body.y, bars.x, bars.y);
      g.fillStyle(SEAT_HEX[seat]!, 1);
      g.fillCircle(head.x, head.y, 18);
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(head.x + cos * 8, head.y - sin * 8, 6);
      // Words for this rider.
      const live = r.phase === 'up' ? r.wheelie / PX_PER_M : r.phase === 'rolling' ? 0 : (r.scores[r.scores.length - 1] ?? 0);
      this.metres[seat]!.setText(r.phase === 'done' ? `${wheelieTotal(r).toFixed(1)} m` : `${live.toFixed(1)} m`);
      this.rides[seat]!.setText(r.phase === 'done' ? 'All three rides done' : `Ride ${r.ride + 1} of ${WHEELIE_RIDES} · total ${wheelieTotal(r).toFixed(1)} m`);
    }
  }
}
