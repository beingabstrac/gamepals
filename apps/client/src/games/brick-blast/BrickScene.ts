import {
  BRICK_BALL_R,
  BRICK_CANVAS,
  BRICK_STEP,
  BRICK_TIERS,
  BRICK_WIN,
  brickBotInput,
  brickRect,
  isTough,
  newBrickBlast,
  PADDLE,
  PADDLE_Y,
  stepBrick,
  WALL,
  type BrickEvents,
  type BrickInput,
  type BrickState,
  type Seat,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { COLORS, DARK, toHex } from '../../theme';
import type { RealtimeSceneOptions } from '../air-hockey/AirHockeyScene';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed, SPEED } from '../../autoplay';
import { facing, heldDuelKeys, seatForY } from '../duel';

export const BRICK_SIZE = { width: BRICK_CANVAS.width, height: BRICK_CANVAS.height };
export const BRICK_COLORS = [COLORS.sky, COLORS.tomato];

const W = BRICK_CANVAS.width;
const H = BRICK_CANVAS.height;
const SEAT_HEX = BRICK_COLORS.map(toHex);
const SEAT_DARK = [DARK.sky, DARK.tomato].map(toHex);
/** Row colors, top to bottom: the tough middle rows are the grape pair. */
const ROW_COLORS = [COLORS.sunny, COLORS.peach, COLORS.grape, COLORS.grape, COLORS.mint, COLORS.bubblegum];
const ROW_DARK = [DARK.sunny, DARK.peach, DARK.grape, DARK.grape, DARK.mint, DARK.bubblegum];

/**
 * Brick Blast. The rules move both balls and keep the wall; the scene draws the bricks (a crack
 * across a tough one that has been hit), both paddles, the balls in the color of whoever touched
 * them last, and pops each brick into bits.
 */
export class BrickScene extends Scene {
  private state: BrickState;
  private accumulator = 0;
  private ended = false;
  private want: [number | null, number | null] = [null, null];
  private fingers = new Map<number, Seat>();
  private held: (seat: Seat) => { x: number; y: number } = () => ({ x: 0, y: 0 });
  private g!: GameObjects.Graphics;
  private scoreTexts: GameObjects.Text[] = [];
  private banner!: GameObjects.Text;
  private squash: [number, number] = [0, 0];

  constructor(private readonly options: RealtimeSceneOptions) {
    super('brick-blast');
    this.state = newBrickBlast(options.seed);
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.input.addPointer(3);
    this.scoreTexts = [0, 1].map((seat) =>
      sharpText(this, W / 2, seat === 0 ? H * 0.78 : H * 0.22, '0', 110, BRICK_COLORS[seat]!)
        .setAlpha(0.28)
        .setFontStyle('bold')
        .setAngle(facing(this.options.seats, seat as Seat)),
    );
    this.g = this.add.graphics().setDepth(2);
    this.banner = sharpText(this, W / 2, H / 2, '', 52, COLORS.ink).setDepth(10).setFontStyle('bold').setStroke('#FFFFFF', 8);
    // Each finger drives the paddle of the half it came down in, wherever it wanders after.
    const steer = (p: { id: number; worldX: number; worldY: number }, down: boolean) => {
      const seat = down ? seatForY(p.worldY, H) : this.fingers.get(p.id);
      if (seat === undefined || this.options.seats[seat]?.kind !== 'human') return;
      if (down) this.fingers.set(p.id, seat);
      this.want[seat] = p.worldX;
    };
    this.input.on('pointerdown', (p: { id: number; worldX: number; worldY: number }) => steer(p, true));
    this.input.on('pointermove', (p: { id: number; worldX: number; worldY: number; isDown: boolean }) => p.isDown && steer(p, false));
    const lift = (p: { id: number }) => this.fingers.delete(p.id);
    this.input.on('pointerup', lift);
    this.input.on('pointerupoutside', lift);
    this.held = heldDuelKeys(this, this.options.seats);
    this.shout('Ready…');
    this.options.onScore([0, 0]);
  }

  update(_time: number, delta: number): void {
    if (!this.ended) {
      this.accumulator += (Math.min(delta, 100) * SPEED) / 1000;
      while (this.accumulator >= BRICK_STEP) {
        this.accumulator -= BRICK_STEP;
        const was = this.state.phase;
        const { state, events } = stepBrick(this.state, [this.inputFor(0), this.inputFor(1)]);
        this.state = state;
        if (was === 'countdown' && state.phase === 'play') this.shout('Go!');
        this.handle(events);
        if (state.result) {
          this.ended = true;
          this.time.delayedCall(900, () => this.options.onEnd(state.result!));
          break;
        }
      }
    }
    this.squash = [this.squash[0] * 0.85, this.squash[1] * 0.85];
    this.draw();
  }

  private inputFor(seat: Seat): BrickInput {
    const controller = this.options.seats[seat];
    if (controller?.kind === 'bot') return brickBotInput(this.state, seat, BRICK_TIERS[controller.tier]);
    const slide = this.held(seat).x;
    if (slide) return { x: this.state.paddles[seat] + slide * 200 };
    return { x: this.want[seat] };
  }

  private handle(events: BrickEvents): void {
    if (events.paddle !== null) {
      this.options.onCue('hit');
      this.squash[events.paddle] = 1;
    }
    if (events.wall) this.options.onCue('wall');
    for (const i of events.cracked) {
      this.options.onCue('thud');
      this.pop(i, 4);
    }
    for (const i of events.broken) {
      this.options.onCue('capture');
      this.pop(i, 9);
    }
    if (events.rebuilt) {
      this.options.onCue('gong');
      this.shout('New wall!');
    }
    if (events.goal !== null) {
      const seat = events.goal;
      this.options.onCue('goal');
      this.options.onScore(this.state.scores);
      this.cameras.main.shake(180, 0.008);
      const text = this.scoreTexts[seat]!;
      text.setText(String(this.state.scores[seat]));
      this.tweens.add({ targets: text, scale: 1.35, duration: 180, yoyo: true, ease: 'Back.easeOut' });
      if (this.state.scores[seat] >= BRICK_WIN) this.shout(`${seat === 0 ? 'Blue' : 'Red'} wins!`);
    }
  }

  /** Bits of a brick flying off: a few for a crack, a burst for a break. */
  private pop(i: number, count: number): void {
    const r = brickRect(i);
    const row = Math.floor(i / WALL.cols);
    const color = toHex(ROW_COLORS[row]!);
    for (let k = 0; k < count; k++) {
      const bit = this.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, 12, 10, color).setDepth(4);
      const a = (k / count) * Math.PI * 2 + 0.3;
      this.tweens.add({
        targets: bit,
        x: bit.x + Math.cos(a) * 70,
        y: bit.y + Math.sin(a) * 40 + 50,
        angle: 180,
        alpha: 0,
        duration: 420,
        ease: 'Quad.easeOut',
        onComplete: () => bit.destroy(),
      });
    }
  }

  private shout(text: string): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 650, duration: 250 });
  }

  private draw(): void {
    const s = this.state;
    const g = this.g.clear();
    // The halves, each tinted for whoever guards it.
    g.fillStyle(SEAT_HEX[1]!, 0.07);
    g.fillRect(0, 0, W, H / 2);
    g.fillStyle(SEAT_HEX[0]!, 0.07);
    g.fillRect(0, H / 2, W, H / 2);
    // The wall.
    s.bricks.forEach((hits, i) => {
      if (!hits) return;
      const r = brickRect(i);
      const row = Math.floor(i / WALL.cols);
      g.fillStyle(toHex(ROW_DARK[row]!), 1);
      g.fillRoundedRect(r.x, r.y + 4, r.w, r.h, 9);
      g.fillStyle(toHex(ROW_COLORS[row]!), 1);
      g.fillRoundedRect(r.x, r.y, r.w, r.h - 2, 9);
      g.fillStyle(0xffffff, 0.3);
      g.fillRoundedRect(r.x + 8, r.y + 5, r.w - 16, 6, 3);
      if (isTough(i) && hits === 1) {
        // A zigzag crack across a tough brick that has been hit once.
        g.lineStyle(3, 0xffffff, 0.9);
        g.beginPath();
        g.moveTo(r.x + 10, r.y + 8);
        g.lineTo(r.x + 26, r.y + 20);
        g.lineTo(r.x + 38, r.y + 10);
        g.lineTo(r.x + 56, r.y + 26);
        g.strokePath();
      }
    });
    // Paddles, squashing a little as they hit.
    for (const seat of [0, 1] as const) {
      const x = s.paddles[seat];
      const sq = this.squash[seat];
      const w = PADDLE.w * (1 + sq * 0.12);
      const h = PADDLE.h * (1 - sq * 0.25);
      const y = PADDLE_Y[seat] - h / 2;
      g.fillStyle(SEAT_DARK[seat]!, 1);
      g.fillRoundedRect(x - w / 2, y + 5, w, h, h / 2);
      g.fillStyle(SEAT_HEX[seat]!, 1);
      g.fillRoundedRect(x - w / 2, y, w, h, h / 2);
      g.fillStyle(0xffffff, 0.35);
      g.fillRoundedRect(x - w / 2 + 14, y + 4, w - 28, 5, 2.5);
    }
    // The balls, in the color of whoever sent them.
    for (const b of s.balls) {
      g.fillStyle(0x000000, 0.1);
      g.fillCircle(b.x + 3, b.y + 5, BRICK_BALL_R);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(b.x, b.y, BRICK_BALL_R + 3);
      g.fillStyle(SEAT_HEX[b.owner]!, 1);
      g.fillCircle(b.x, b.y, BRICK_BALL_R);
      g.fillStyle(0xffffff, 0.55);
      g.fillCircle(b.x - 3, b.y - 3, 3.5);
    }
  }
}
