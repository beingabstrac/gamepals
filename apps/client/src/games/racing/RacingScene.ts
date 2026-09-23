import {
  createRng,
  LAPS,
  newRace,
  RACE_CANVAS,
  RACE_STEP,
  RACE_TIERS,
  raceBotInput,
  stepRace,
  TRACK_WIDTH,
  TRACKS,
  type RaceEvents,
  type RaceInput,
  type RaceState,
  type Rng,
  type Seat,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { COLORS, DARK, toHex } from '../../theme';
import type { RealtimeSceneOptions } from '../air-hockey/AirHockeyScene';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed, SPEED } from '../../autoplay';
import { facing, heldDuelKeys, isPerson, seatForY } from '../duel';

export const RACE_SIZE = { width: RACE_CANVAS.width, height: RACE_CANVAS.height };
export const RACE_COLORS = [COLORS.sky, COLORS.tomato];

const W = RACE_CANVAS.width;
const H = RACE_CANVAS.height;
const SEAT_HEX = RACE_COLORS.map(toHex);
const SEAT_DARK = [toHex(DARK.sky), toHex(DARK.tomato)];

/**
 * Racing. The rules step the race; the scene turns each player's held side of the screen into a
 * steer, draws the track as one smooth road, and counts the lights down. The cars drive themselves.
 */
export class RacingScene extends Scene {
  private state: RaceState;
  private readonly rng: Rng;
  private accumulator = 0;
  private clock = 0;
  private noise: [number, number] = [0, 0];
  private noiseTimer = 0;
  /** Fingers down, and which way each is steering its player's car. */
  private touches = new Map<number, { seat: Seat; turn: number }>();
  private held: (seat: Seat) => { x: number; y: number } = () => ({ x: 0, y: 0 });
  private ended = false;
  private lastBump = -1;
  private shownLight = -1;

  private cars: GameObjects.Container[] = [];
  private laps: GameObjects.Text[] = [];
  private banner!: GameObjects.Text;

  constructor(private readonly options: RealtimeSceneOptions) {
    super('racing');
    this.rng = createRng(options.seed);
    this.state = newRace(options.seed);
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.input.addPointer(3);
    this.drawTrack();
    this.cars = [0, 1].map((seat) => this.makeCar(seat as Seat));
    this.laps = [0, 1].map((seat) =>
      sharpText(this, seat === 0 ? 90 : W - 90, seat === 0 ? H - 26 : 26, `Lap 1/${LAPS}`, 24, RACE_COLORS[seat]!)
        .setFontStyle('bold')
        .setAngle(facing(this.options.seats, seat as Seat))
        .setDepth(12),
    );
    for (const seat of [0, 1] as const) {
      const hint = sharpText(this, W / 2, seat === 0 ? H - 60 : 60, 'Hold left or right to steer', 22, COLORS.ink).setDepth(12);
      hint.setAngle(facing(this.options.seats, seat)).setVisible(isPerson(this.options.seats, seat));
      this.tweens.add({ targets: hint, alpha: 0, delay: 4500, duration: 600 });
    }
    this.banner = sharpText(this, W / 2, H / 2, '', 90, COLORS.ink).setDepth(20).setFontStyle('bold');

    const press = (p: { id: number; worldX: number; worldY: number }) => {
      const seat = seatForY(p.worldY, H);
      if (this.options.seats[seat]?.kind !== 'human') return;
      // Your right, as you hold the phone: the top player, turned round, has theirs on our left.
      const right = facing(this.options.seats, seat) === 180 ? p.worldX < W / 2 : p.worldX >= W / 2;
      this.touches.set(p.id, { seat, turn: right ? 1 : -1 });
    };
    this.input.on('pointerdown', press);
    this.input.on('pointermove', (p: { id: number; worldX: number; worldY: number; isDown: boolean }) => {
      if (p.isDown && this.touches.has(p.id)) press(p);
    });
    const release = (p: { id: number }) => this.touches.delete(p.id);
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
    this.held = heldDuelKeys(this, this.options.seats);

    this.sync();
    this.options.onScore([0, 0]);
  }

  private makeCar(seat: Seat): GameObjects.Container {
    const g = this.add.graphics();
    g.fillStyle(0x2b2a3a, 0.18);
    g.fillRoundedRect(-19, -9, 42, 24, 8);
    g.fillStyle(toHex(COLORS.ink), 1);
    for (const [x, y] of [
      [-12, -13],
      [8, -13],
      [-12, 9],
      [8, 9],
    ] as const)
      g.fillRoundedRect(x, y, 10, 5, 2);
    g.fillStyle(SEAT_DARK[seat]!, 1);
    g.fillRoundedRect(-21, -11, 42, 22, 9);
    g.fillStyle(SEAT_HEX[seat]!, 1);
    g.fillRoundedRect(-20, -10, 40, 18, 8);
    g.fillStyle(0xffffff, 0.9);
    g.fillRoundedRect(3, -7, 9, 12, 3);
    g.fillStyle(toHex(COLORS.sunny), 1);
    g.fillCircle(18, -6, 2.5);
    g.fillCircle(18, 4, 2.5);
    return this.add.container(0, 0, [g]).setDepth(6);
  }

  update(_time: number, delta: number): void {
    const dt = (Math.min(delta, 100) * SPEED) / 1000;
    if (!this.ended) {
      this.accumulator += dt;
      this.noiseTimer -= dt;
      if (this.noiseTimer <= 0) {
        this.noise = [this.rng.next() * 2 - 1, this.rng.next() * 2 - 1];
        this.noiseTimer = 0.3;
      }
      while (this.accumulator >= RACE_STEP) {
        this.accumulator -= RACE_STEP;
        this.clock += RACE_STEP;
        const before = this.state.phase;
        const { state, events } = stepRace(this.state, [this.inputFor(0), this.inputFor(1)]);
        this.state = state;
        this.handle(events);
        if (before === 'countdown' && state.phase === 'race') this.light('Go!');
        if (state.result) {
          this.ended = true;
          this.light('Finish!');
          this.time.delayedCall(900, () => this.options.onEnd(state.result!));
          break;
        }
      }
    }
    if (this.state.phase === 'countdown') {
      // Three lights, a second or so each: 3, 2, 1.
      const left = Math.ceil(this.state.timer / 0.6);
      if (left !== this.shownLight && left >= 1 && left <= 3) {
        this.shownLight = left;
        this.light(String(left));
        this.options.onCue('tap');
      }
    }
    this.sync();
  }

  private inputFor(seat: Seat): RaceInput {
    const controller = this.options.seats[seat];
    if (controller?.kind === 'bot') {
      const tier = RACE_TIERS[controller.tier];
      return raceBotInput(this.state, seat, tier, this.noise[seat]);
    }
    let turn = 0;
    for (const touch of this.touches.values()) if (touch.seat === seat) turn = touch.turn;
    if (turn === 0) turn = Math.sign(this.held(seat).x);
    return { turn };
  }

  private handle(events: RaceEvents): void {
    if (events.bump > 0 && this.clock - this.lastBump > 0.25) {
      this.lastBump = this.clock;
      this.options.onCue('hit');
      this.cameras.main.shake(90, 0.004);
    }
    events.lap.forEach((lapped, seat) => {
      if (!lapped) return;
      this.options.onCue('place');
      this.options.onScore(this.state.cars.map((car) => car.laps));
      const text = this.laps[seat];
      if (text) this.tweens.add({ targets: text, scale: 1.35, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
    });
  }

  private light(text: string): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setAlpha(1).setScale(0.5);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 450, duration: 250 });
  }

  private sync(): void {
    this.state.cars.forEach((car, seat) => {
      this.cars[seat]?.setPosition(car.x, car.y).setRotation(car.angle);
      this.laps[seat]?.setText(`Lap ${Math.min(LAPS, car.laps + 1)}/${LAPS}`);
    });
  }

  /** The track: grass, a white edge, the road laid as one smooth band, a dashed middle and the start line. */
  private drawTrack(): void {
    const line = TRACKS[this.state.track]!.line;
    const g = this.add.graphics();
    g.fillStyle(toHex(COLORS.mint), 1);
    g.fillRect(0, 0, W, H);
    g.fillStyle(toHex(DARK.mint), 1);
    for (let i = 0; i < 40; i++) g.fillCircle(this.rng.next() * W, this.rng.next() * H, 3 + this.rng.next() * 4);
    g.fillStyle(0xffffff, 1);
    for (const p of line) g.fillCircle(p.x, p.y, TRACK_WIDTH / 2 + 6);
    g.fillStyle(0x6f6d85, 1);
    for (const p of line) g.fillCircle(p.x, p.y, TRACK_WIDTH / 2);
    g.lineStyle(4, 0xffffff, 0.7);
    for (let i = 0; i < line.length; i += 4) {
      const a = line[i]!;
      const b = line[(i + 1) % line.length]!;
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
    // The start line: a chequered band across the road.
    const a = line[0]!;
    const b = line[1]!;
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);
    const squares = 8;
    for (let i = 0; i < squares; i++) {
      for (let row = 0; row < 2; row++) {
        const t = (i / squares - 0.5) * TRACK_WIDTH + TRACK_WIDTH / squares / 2;
        const cx = a.x + nx * t + Math.cos(angle) * (row * 8 - 4);
        const cy = a.y + ny * t + Math.sin(angle) * (row * 8 - 4);
        g.fillStyle((i + row) % 2 === 0 ? 0xffffff : toHex(COLORS.ink), 1);
        g.fillCircle(cx, cy, TRACK_WIDTH / squares / 2);
      }
    }
  }
}
