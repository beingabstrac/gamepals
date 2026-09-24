import {
  LAP,
  lapsDone,
  newSlotCars,
  SLOT_CANVAS,
  SLOT_LAPS,
  SLOT_STEP,
  SLOT_TIERS,
  SLOT_TRACK,
  slotAt,
  slotBotInput,
  stepSlot,
  type Seat,
  type SlotEvents,
  type SlotInput,
  type SlotState,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { COLORS, DARK, toHex } from '../../theme';
import type { RealtimeSceneOptions } from '../air-hockey/AirHockeyScene';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed, SPEED } from '../../autoplay';
import { facing, heldTaps } from '../duel';

export const SLOT_SIZE = { width: SLOT_CANVAS.width, height: SLOT_CANVAS.height };
export const SLOT_COLORS = [COLORS.sky, COLORS.tomato];

const W = SLOT_CANVAS.width;
const H = SLOT_CANVAS.height;
const SEAT_HEX = SLOT_COLORS.map(toHex);
const SEAT_DARK = [DARK.sky, DARK.tomato].map(toHex);

/**
 * Slot Cars. The rules drive both cars round their lanes; the scene draws the track (two grooves
 * that cross halfway down each straight), the toy cars, the start line, and a car tumbling off a
 * bend it took too fast. Each player's half of the phone is their throttle.
 */
export class SlotScene extends Scene {
  private state: SlotState;
  private accumulator = 0;
  private ended = false;
  private fingers = new Map<number, Seat>();
  private keys: (seat: Seat) => boolean = () => false;
  private g!: GameObjects.Graphics;
  private laps: GameObjects.Text[] = [];
  private banner!: GameObjects.Text;
  private spin: [number, number] = [0, 0];

  constructor(private readonly options: RealtimeSceneOptions) {
    super('slot-cars');
    this.state = newSlotCars(options.seed);
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.input.addPointer(3);
    this.drawTrack();
    this.g = this.add.graphics().setDepth(2);
    this.laps = [0, 1].map((seat) =>
      sharpText(this, W / 2, seat === 0 ? 560 : 340, '', 34, SLOT_COLORS[seat]!)
        .setFontStyle('bold')
        .setDepth(3)
        .setAngle(facing(this.options.seats, seat as Seat)),
    );
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
      while (this.accumulator >= SLOT_STEP) {
        this.accumulator -= SLOT_STEP;
        const was = this.state.phase;
        const { state, events } = stepSlot(this.state, [this.inputFor(0), this.inputFor(1)]);
        this.state = state;
        if (was === 'countdown' && state.phase === 'race') this.shout('Go!');
        this.handle(events);
        if (state.result) {
          this.ended = true;
          this.time.delayedCall(1200, () => this.options.onEnd(state.result!));
          break;
        }
      }
    }
    for (const seat of [0, 1] as const) if (this.state.cars[seat].off > 0) this.spin[seat] += delta * 0.012 * SPEED;
    this.draw();
  }

  private inputFor(seat: Seat): SlotInput {
    const controller = this.options.seats[seat];
    if (controller?.kind === 'bot') return slotBotInput(this.state, seat, SLOT_TIERS[controller.tier]);
    return { held: this.keys(seat) || [...this.fingers.values()].includes(seat) };
  }

  private handle(events: SlotEvents): void {
    for (const seat of events.crashed) {
      this.options.onCue('thud');
      this.cameras.main.shake(160, 0.008);
      this.spin[seat] = 0;
    }
    if (events.back.length) this.options.onCue('tap');
    for (const seat of events.lap) {
      const done = Math.min(lapsDone(this.state.cars[seat]), SLOT_LAPS);
      this.options.onScore([Math.min(lapsDone(this.state.cars[0]), SLOT_LAPS), Math.min(lapsDone(this.state.cars[1]), SLOT_LAPS)]);
      this.options.onCue(done >= SLOT_LAPS ? 'goal' : 'place');
      const t = this.laps[seat]!;
      this.tweens.add({ targets: t, scale: 1.3, duration: 150, yoyo: true, ease: 'Back.easeOut' });
    }
    if (this.state.result) {
      const [winner] = this.state.result.winners;
      this.shout(winner === undefined ? 'Dead heat!' : `${winner === 0 ? 'Blue' : 'Red'} wins!`);
    }
  }

  private shout(text: string): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setAlpha(1).setScale(0.6).setAngle(facing(this.options.seats, 0));
    this.tweens.add({ targets: this.banner, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 800, duration: 250 });
  }

  private drawTrack(): void {
    const g = this.add.graphics();
    const { cx, top, bottom, r, lane } = SLOT_TRACK;
    const wide = lane * 2 + 44;
    // Grass, then the track as a thick band round the middle line.
    g.fillStyle(toHex('#E6F5DC'), 1);
    g.fillRoundedRect(8, 8, W - 16, H - 16, 30);
    g.lineStyle(wide + 10, toHex(DARK.grape), 1);
    this.stadium(g, cx, top + 5, bottom + 5, r);
    g.lineStyle(wide, toHex(COLORS.grape), 1);
    this.stadium(g, cx, top, bottom, r);
    // The two grooves, each a thin line along its own lane.
    for (const l of [0, 1] as const) {
      g.lineStyle(4, 0xffffff, 0.85);
      g.beginPath();
      for (let s = 0; s <= LAP; s += 6) {
        const p = slotAt(l, s);
        if (s === 0) g.moveTo(p.x, p.y);
        else g.lineTo(p.x, p.y);
      }
      g.closePath();
      g.strokePath();
    }
    // The start line, chequered across the right straight.
    const y = bottom;
    for (let i = 0; i < 8; i++)
      for (let j = 0; j < 2; j++) {
        g.fillStyle((i + j) % 2 ? 0xffffff : toHex(COLORS.ink), 1);
        g.fillRect(cx + r - wide / 2 + (i * wide) / 8, y - 8 + j * 8, wide / 8, 8);
      }
  }

  private stadium(g: GameObjects.Graphics, cx: number, top: number, bottom: number, r: number): void {
    g.beginPath();
    g.arc(cx, top, r, Math.PI, 0, false);
    g.lineTo(cx + r, bottom);
    g.arc(cx, bottom, r, 0, Math.PI, false);
    g.closePath();
    g.strokePath();
  }

  /** A little slot car: a rounded body in the player's color, a white stripe and a windscreen. */
  private car(g: GameObjects.Graphics, x: number, y: number, angle: number, seat: Seat): void {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const at = (f: number, s: number) => ({ x: x + cos * f - sin * s, y: y + sin * f + cos * s });
    const quad = (f0: number, f1: number, s0: number, s1: number, color: number, alpha = 1) => {
      const p = [at(f0, s0), at(f1, s0), at(f1, s1), at(f0, s1)];
      g.fillStyle(color, alpha);
      g.beginPath();
      g.moveTo(p[0]!.x, p[0]!.y);
      for (const q of p.slice(1)) g.lineTo(q.x, q.y);
      g.closePath();
      g.fillPath();
    };
    quad(-20, 22, -14, 14, 0x000000, 0.15);
    quad(-18, 20, -13, 13, SEAT_DARK[seat]!);
    quad(-20, 18, -12, 12, SEAT_HEX[seat]!);
    quad(-18, 16, -3, 3, 0xffffff, 0.8);
    quad(2, 10, -9, 9, 0xffffff, 0.7);
  }

  private draw(): void {
    const s = this.state;
    const g = this.g.clear();
    for (const seat of [0, 1] as const) {
      const car = s.cars[seat];
      if (car.off > 0 && car.flew) {
        // Tumbling on the grass until the marshal comes.
        this.car(g, car.flew.x, car.flew.y, car.flew.angle + this.spin[seat], seat);
      } else {
        const p = slotAt(seat as 0 | 1, car.s);
        this.car(g, p.x, p.y, p.angle, seat);
      }
      const lap = Math.min(lapsDone(car) + 1, SLOT_LAPS);
      this.laps[seat]!.setText(s.finished[seat] !== null ? 'Done!' : `Lap ${lap} of ${SLOT_LAPS}`);
    }
  }
}
