import {
  ARENA,
  BALLOON_R,
  balloonOf,
  BUMPER_CANVAS,
  BUMPER_STEP,
  BUMPER_TIERS,
  bumperBotInput,
  CAR_R,
  createRng,
  newBumpers,
  stepBumpers,
  wallsIn,
  type BumperEvents,
  type BumperInput,
  type BumperState,
  type Rng,
  type Seat,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { COLORS, DARK, toHex } from '../../theme';
import type { RealtimeSceneOptions } from '../air-hockey/AirHockeyScene';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed, SPEED } from '../../autoplay';
import { facing, heldDuelKeys, isPerson, onDuelKeys, seatForY } from '../duel';

export const BUMPER_SIZE = { width: BUMPER_CANVAS.width, height: BUMPER_CANVAS.height };

const W = BUMPER_CANVAS.width;
const H = BUMPER_CANVAS.height;
const SEAT_HEX = [toHex(COLORS.sky), toHex(COLORS.tomato)];
const SEAT_DARK = [toHex(DARK.sky), toHex(DARK.tomato)];
const STICK_RANGE = 70;
const TAP_MS = 220;
const HISTORY_SECONDS = 0.35;

interface Touch {
  readonly seat: Seat;
  readonly x: number;
  readonly y: number;
  readonly t: number;
  moved: boolean;
}

/**
 * Balloon Bumpers. The rules run the arena at a fixed step; the scene draws two bumper cars with a
 * balloon on a string behind each, the walls as they close in, and bursts a balloon when it pops.
 * Each half of the screen steers its own car: drag to drive, tap to dash.
 */
export class BumperScene extends Scene {
  private state: BumperState = newBumpers();
  private readonly rng: Rng;
  private accumulator = 0;
  private clock = 0;
  private history: { t: number; state: BumperState }[] = [];
  private noise: [number, number] = [0, 0];
  private noiseTimer = 0;
  private touches = new Map<number, Touch>();
  private steer: [{ x: number; y: number } | null, { x: number; y: number } | null] = [null, null];
  private dashQueued: [boolean, boolean] = [false, false];
  private held: (seat: Seat) => { x: number; y: number } = () => ({ x: 0, y: 0 });
  private lastBump = -1;
  private ended = false;
  private cars: GameObjects.Container[] = [];
  private strings!: GameObjects.Graphics;
  private walls!: GameObjects.Graphics;
  private banner!: GameObjects.Text;
  private hints: GameObjects.Text[] = [];

  constructor(private readonly options: RealtimeSceneOptions) {
    super('balloon-bumpers');
    this.rng = createRng(options.seed);
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.input.addPointer(3);
    const floor = this.add.graphics();
    floor.fillStyle(toHex(DARK.grape), 1);
    floor.fillRoundedRect(ARENA.left - 14, ARENA.top - 14 + 8, ARENA.right - ARENA.left + 28, ARENA.bottom - ARENA.top + 28, 34);
    floor.fillStyle(toHex(COLORS.grape), 1);
    floor.fillRoundedRect(ARENA.left - 14, ARENA.top - 14, ARENA.right - ARENA.left + 28, ARENA.bottom - ARENA.top + 28, 34);
    floor.fillStyle(toHex('#F4EEFF'), 1);
    floor.fillRoundedRect(ARENA.left, ARENA.top, ARENA.right - ARENA.left, ARENA.bottom - ARENA.top, 24);
    this.walls = this.add.graphics().setDepth(1);
    this.strings = this.add.graphics().setDepth(5);
    this.hints = [0, 1].map((seat) =>
      sharpText(this, W / 2, seat === 0 ? H - 26 : 26, 'Drag to drive. Tap to dash.', 24, COLORS.soft)
        .setAngle(facing(this.options.seats, seat as Seat))
        .setVisible(isPerson(this.options.seats, seat as Seat)),
    );
    this.cars = [0, 1].map((seat) => this.makeCar(seat as Seat));
    this.banner = sharpText(this, W / 2, H / 2, '', 64, COLORS.ink).setDepth(10);
    this.shout('Ready…', false);

    this.input.on('pointerdown', (p: { id: number; worldX: number; worldY: number }) => {
      const seat = seatForY(p.worldY, H);
      if (this.options.seats[seat]?.kind !== 'human') return;
      this.touches.set(p.id, { seat, x: p.worldX, y: p.worldY, t: this.clock, moved: false });
    });
    this.input.on('pointermove', (p: { id: number; worldX: number; worldY: number; isDown: boolean }) => {
      const touch = this.touches.get(p.id);
      if (!touch || !p.isDown) return;
      const dx = p.worldX - touch.x;
      const dy = p.worldY - touch.y;
      if (Math.hypot(dx, dy) > 12) touch.moved = true;
      this.steer[touch.seat] = { x: dx / STICK_RANGE, y: dy / STICK_RANGE };
    });
    const release = (p: { id: number }) => {
      const touch = this.touches.get(p.id);
      if (!touch) return;
      this.touches.delete(p.id);
      this.steer[touch.seat] = null;
      if (!touch.moved && this.clock - touch.t < TAP_MS / 1000) this.dashQueued[touch.seat] = true;
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
    this.held = heldDuelKeys(this, this.options.seats);
    onDuelKeys(this, this.options.seats, (seat, action) => {
      if (action === 'tap') this.dashQueued[seat] = true;
    });
    this.sync();
    this.options.onScore([0, 0]);
  }

  /** A round bumper car from above: a rubber ring, a colored body and a driver facing forward. */
  private makeCar(seat: Seat): GameObjects.Container {
    const g = this.add.graphics();
    g.fillStyle(0x2b2a3a, 0.16);
    g.fillEllipse(0, 8, CAR_R * 2.1, CAR_R * 1.8);
    g.fillStyle(toHex(COLORS.ink), 1);
    g.fillCircle(0, 0, CAR_R);
    g.fillStyle(SEAT_DARK[seat]!, 1);
    g.fillCircle(0, 0, CAR_R - 6);
    g.fillStyle(SEAT_HEX[seat]!, 1);
    g.fillCircle(0, -2, CAR_R - 9);
    // The driver, looking the way the car faces (+x in the container).
    g.fillStyle(0xffe0c2, 1);
    g.fillCircle(4, 0, 13);
    g.fillStyle(toHex(COLORS.ink), 1);
    g.fillCircle(10, -5, 2.4);
    g.fillCircle(10, 5, 2.4);
    g.fillStyle(0xffffff, 0.8);
    g.fillRoundedRect(CAR_R - 16, -12, 8, 24, 4);
    return this.add.container(0, 0, [g]).setDepth(4);
  }

  update(_time: number, delta: number): void {
    if (this.ended) return;
    const step = (Math.min(delta, 100) * SPEED) / 1000;
    this.accumulator += step;
    this.noiseTimer -= step;
    if (this.noiseTimer <= 0) {
      this.noise = [this.rng.next() * 2 - 1, this.rng.next() * 2 - 1];
      this.noiseTimer = 0.35;
    }
    while (this.accumulator >= BUMPER_STEP) {
      this.accumulator -= BUMPER_STEP;
      this.clock += BUMPER_STEP;
      const before = this.state.phase;
      const { state, events } = stepBumpers(this.state, [this.inputFor(0), this.inputFor(1)]);
      this.state = state;
      this.history.push({ t: this.clock, state });
      while (this.history.length > 0 && this.history[0]!.t < this.clock - HISTORY_SECONDS) this.history.shift();
      this.handle(events);
      if (before !== 'countdown' && state.phase === 'countdown') this.shout('Ready…', false);
      if (before === 'countdown' && state.phase === 'play') this.shout('Go!');
      if (state.result) {
        this.ended = true;
        this.time.delayedCall(800, () => this.options.onEnd(state.result!));
        break;
      }
    }
    this.sync();
  }

  private inputFor(seat: Seat): BumperInput {
    const controller = this.options.seats[seat];
    if (controller?.kind === 'bot') {
      const tier = BUMPER_TIERS[controller.tier];
      // Bots see the other car as it was a moment ago, and themselves as they are.
      const cutoff = this.clock - tier.reactionMs / 1000;
      let seen = this.history[0]?.state ?? this.state;
      for (const entry of this.history) {
        if (entry.t > cutoff) break;
        seen = entry.state;
      }
      const view: BumperState = { ...this.state, cars: seat === 0 ? [this.state.cars[0], seen.cars[1]] : [seen.cars[0], this.state.cars[1]] };
      return bumperBotInput(view, seat, tier, this.noise[seat]);
    }
    const dash = this.dashQueued[seat];
    this.dashQueued[seat] = false;
    const key = this.held(seat);
    return { steer: this.steer[seat] ?? (key.x || key.y ? key : null), dash };
  }

  private handle(events: BumperEvents): void {
    events.dash.forEach((dashed, seat) => {
      if (!dashed) return;
      const car = this.cars[seat]!;
      this.tweens.add({ targets: car, scale: 1.12, duration: 90, yoyo: true });
      this.options.onCue('pull');
    });
    if (events.bump > 120 && this.clock - this.lastBump > 0.12) {
      this.lastBump = this.clock;
      this.options.onCue('thud');
      for (const car of this.cars) this.tweens.add({ targets: car, scaleX: 0.88, scaleY: 1.08, duration: 70, yoyo: true });
      if (events.bump > 450) this.cameras.main.shake(110, 0.006);
    }
    if (events.wall > 200 && this.clock - this.lastBump > 0.12) {
      this.lastBump = this.clock;
      this.options.onCue('wall');
    }
    if (events.pop !== null) {
      const loser = events.pop === 0 ? 1 : 0;
      this.burst(balloonOf(this.state.cars[loser]!, this.state.timer), loser);
      this.options.onCue('capture');
      this.cameras.main.shake(220, 0.01);
      this.options.onScore(this.state.pops);
      this.shout(this.state.result ? 'Champion!' : 'Pop!');
      for (const hint of this.hints) this.tweens.add({ targets: hint, alpha: 0, duration: 400 });
    }
    if (events.timeUp) {
      this.options.onCue('gong');
      this.shout(this.state.result ? 'Full time' : 'Time!');
    }
  }

  /** Bits of balloon flying off where it popped. */
  private burst(at: { x: number; y: number }, seat: number): void {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + this.rng.next() * 0.4;
      const bit = this.add.rectangle(at.x, at.y, 10, 6, SEAT_HEX[seat]!).setDepth(8).setRotation(a);
      this.tweens.add({ targets: bit, x: at.x + Math.cos(a) * 80, y: at.y + Math.sin(a) * 80, alpha: 0, angle: 360, duration: 480, ease: 'Cubic.easeOut', onComplete: () => bit.destroy() });
    }
  }

  private shout(text: string, fade = true): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: this.banner, scale: 1.08, duration: 260, ease: 'Back.easeOut' });
    if (fade) this.tweens.add({ targets: this.banner, alpha: 0, delay: 650, duration: 300 });
  }

  private sync(): void {
    const s = this.state;
    const g = this.strings.clear();
    s.cars.forEach((c, seat) => {
      const car = this.cars[seat]!;
      car.setPosition(c.x, c.y).setRotation(c.heading);
      if (s.phase === 'popped' && s.lastPop !== null && s.lastPop !== seat) return;
      // The balloon trails on its string behind the car, swaying a little.
      const b = balloonOf(c, s.phase === 'play' ? s.timer : 0);
      const sway = Math.sin(this.clock * 3 + seat) * 4;
      const back = { x: c.x - Math.cos(c.heading) * CAR_R, y: c.y - Math.sin(c.heading) * CAR_R };
      g.lineStyle(2, toHex(COLORS.ink), 0.7);
      g.lineBetween(back.x, back.y, b.x + sway, b.y);
      g.fillStyle(SEAT_DARK[seat]!, 1);
      g.fillCircle(b.x + sway, b.y + 2, BALLOON_R);
      g.fillStyle(SEAT_HEX[seat]!, 1);
      g.fillCircle(b.x + sway, b.y, BALLOON_R);
      g.fillStyle(0xffffff, 0.55);
      g.fillCircle(b.x + sway - 6, b.y - 6, 5);
    });
    // The walls closing in, once a round has gone on a while.
    const w = this.walls.clear();
    const inset = s.phase === 'play' ? wallsIn(s.timer) : 0;
    if (inset > 0) {
      w.fillStyle(toHex(COLORS.grape), 0.9);
      w.fillRect(ARENA.left, ARENA.top, ARENA.right - ARENA.left, inset);
      w.fillRect(ARENA.left, ARENA.bottom - inset, ARENA.right - ARENA.left, inset);
      w.fillRect(ARENA.left, ARENA.top, inset, ARENA.bottom - ARENA.top);
      w.fillRect(ARENA.right - inset, ARENA.top, inset, ARENA.bottom - ARENA.top);
    }
  }
}
