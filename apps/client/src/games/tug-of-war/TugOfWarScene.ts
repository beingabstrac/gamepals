import {
  createRng,
  newTugGame,
  nextBotTapDelay,
  stepTug,
  TUG_STEP,
  TUG_TIERS,
  tugTap,
  type Rng,
  type Seat,
  type TugState,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { COLORS, DARK, toHex } from '../../theme';
import type { RealtimeSceneOptions } from '../air-hockey/AirHockeyScene';
import { fitCamera, sharpText } from '../crisp';
import { drawHalves, onHalfTap } from '../duel';

const W = 600;
const H = 900;
export const TUG_OF_WAR_SIZE = { width: W, height: H };

const SEAT_HEX = [toHex(COLORS.sky), toHex(COLORS.tomato)];
const SEAT_DARK = [toHex(DARK.sky), toHex(DARK.tomato)];
const TINTS: readonly [number, number] = [0xe3f0ff, 0xffe5e5];
const ROPE = 0xd9a86c;
const ROPE_DARK = 0xb98649;
/** The marker travels this far from the middle before someone wins. */
const TRAVEL = 290;

export class TugOfWarScene extends Scene {
  private state: TugState = newTugGame();
  private readonly rng: Rng;
  private accumulator = 0;
  private clock = 0;
  private nextBotTap: [number, number] = [0, 0];
  private lastPullSound = -1;
  private ended = false;

  private rope!: GameObjects.Graphics;
  private knot!: GameObjects.Container;
  private pullers: GameObjects.Container[] = [];
  private banner!: GameObjects.Text;
  private hints: GameObjects.Text[] = [];

  constructor(private readonly options: RealtimeSceneOptions) {
    super('tug-of-war');
    this.rng = createRng(options.seed);
  }

  create(): void {
    fitCamera(this, W, H);
    drawHalves(this, W, H, TINTS);

    const lines = this.add.graphics();
    lines.fillStyle(0x2b2a3a, 0.18);
    for (let x = 30; x < W - 30; x += 30) {
      lines.fillRoundedRect(x, H / 2 + TRAVEL - 2, 18, 4, 2);
      lines.fillRoundedRect(x, H / 2 - TRAVEL - 2, 18, 4, 2);
    }

    this.rope = this.add.graphics();

    // Hints sit in the open middle of each half (clear of the pullers) and above the rope.
    this.hints = [0, 1].map((seat) =>
      sharpText(this, W / 2, seat === 0 ? H / 2 + 170 : H / 2 - 170, 'TAP TAP TAP!', 38, seat === 0 ? COLORS.sky : COLORS.tomato)
        .setAngle(seat === 1 ? 180 : 0)
        .setAlpha(0.85)
        .setDepth(2),
    );
    this.tweens.add({ targets: this.hints, alpha: 0.35, duration: 500, yoyo: true, repeat: -1 });
    this.knot = this.add.container(W / 2, H / 2, [
      this.add.circle(0, 0, 20, toHex(COLORS.sunny)).setStrokeStyle(5, 0xffffff),
      this.add.triangle(26, -18, 0, 0, 34, 12, 0, 24, toHex(COLORS.sunny)),
    ]);
    this.pullers = [0, 1].map((seat) => this.makePuller(seat as Seat));

    this.banner = sharpText(this, W / 2, H / 2, 'Ready…', 64, COLORS.ink);
    this.tweens.add({ targets: this.banner, scale: 1.15, duration: 400, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });

    for (const seat of [0, 1] as const) {
      const controller = this.options.seats[seat];
      if (controller?.kind === 'bot') this.nextBotTap[seat] = this.state.countdown + nextBotTapDelay(TUG_TIERS[controller.tier], this.rng);
    }

    onHalfTap(this, H, (seat) => {
      if (this.options.seats[seat]?.kind === 'human') this.tap(seat);
    });
    this.drawRope();
    this.options.onScore([0, 0]);
  }

  /** A round blob pulling on its end of the rope. */
  private makePuller(seat: Seat): GameObjects.Container {
    const body = this.add.graphics();
    body.fillStyle(SEAT_DARK[seat]!, 1);
    body.fillRoundedRect(-44, -36, 88, 80, 38);
    body.fillStyle(SEAT_HEX[seat]!, 1);
    body.fillRoundedRect(-44, -42, 88, 80, 38);
    body.fillStyle(0x2b2a3a, 1);
    body.fillCircle(-14, -8, 6);
    body.fillCircle(14, -8, 6);
    body.fillStyle(toHex(COLORS.bubblegum), 0.6);
    body.fillCircle(-26, 8, 7);
    body.fillCircle(26, 8, 7);
    body.lineStyle(5, 0x2b2a3a, 1);
    body.beginPath();
    body.arc(0, 8, 10, 0.2, Math.PI - 0.2, false);
    body.strokePath();
    const y = seat === 0 ? H / 2 + TRAVEL + 70 : H / 2 - TRAVEL - 70;
    return this.add.container(W / 2, y, [body]).setAngle(seat === 1 ? 180 : 0);
  }

  private tap(seat: Seat): void {
    const before = this.state;
    this.state = tugTap(this.state, seat);
    if (this.state === before) return;
    this.options.onScore(this.state.taps);
    if (this.clock - this.lastPullSound > 0.07) {
      this.lastPullSound = this.clock;
      this.options.onCue('pull');
    }
    const puller = this.pullers[seat];
    if (puller) {
      this.tweens.killTweensOf(puller);
      puller.setScale(1);
      // Lean back and squash with every pull.
      this.tweens.add({ targets: puller, scaleX: 1.12, scaleY: 0.88, duration: 70, yoyo: true, ease: 'Quad.easeOut' });
    }
  }

  update(_time: number, delta: number): void {
    if (this.ended) return;
    this.accumulator += Math.min(delta, 100) / 1000;
    const wasCounting = this.state.countdown > 0;

    while (this.accumulator >= TUG_STEP) {
      this.accumulator -= TUG_STEP;
      this.clock += TUG_STEP;
      this.state = stepTug(this.state);
      for (const seat of [0, 1] as const) {
        const controller = this.options.seats[seat];
        if (controller?.kind !== 'bot') continue;
        while (this.clock >= this.nextBotTap[seat]) {
          this.tap(seat);
          this.nextBotTap[seat] += nextBotTapDelay(TUG_TIERS[controller.tier], this.rng);
        }
      }
      if (this.state.result) break;
    }

    if (wasCounting && this.state.countdown === 0) {
      this.banner.setText('Pull!');
      this.options.onCue('go');
      this.tweens.add({ targets: this.banner, scale: 1.6, alpha: 0, duration: 600, ease: 'Cubic.easeOut' });
    }

    this.drawRope();
    if (this.state.result) {
      this.ended = true;
      const winner = this.state.result.winners[0] ?? 0;
      const loser = winner === 0 ? 1 : 0;
      const winnerBlob = this.pullers[winner];
      const loserBlob = this.pullers[loser];
      if (winnerBlob) this.tweens.add({ targets: winnerBlob, y: winnerBlob.y + (winner === 0 ? -30 : 30), duration: 220, yoyo: true, repeat: 2, ease: 'Quad.easeOut' });
      if (loserBlob) this.tweens.add({ targets: loserBlob, angle: loserBlob.angle + 90, y: H / 2, duration: 500, ease: 'Back.easeIn' });
      this.cameras.main.shake(220, 0.008);
      this.options.onEnd(this.state.result);
    }
  }

  private drawRope(): void {
    const markerY = H / 2 + this.state.rope * TRAVEL;
    const topY = this.pullers[1]?.y ?? 80;
    const bottomY = this.pullers[0]?.y ?? H - 80;
    // A little sideways wobble while the rope is moving makes it feel taut and alive.
    const wobble = Math.sin(this.clock * 18) * Math.min(Math.abs(this.state.velocity) * 40, 8);
    const g = this.rope;
    g.clear();
    g.lineStyle(18, ROPE_DARK, 1);
    g.lineBetween(W / 2 + 2, topY, W / 2 + 2 + wobble, markerY);
    g.lineBetween(W / 2 + 2 + wobble, markerY, W / 2 + 2, bottomY);
    g.lineStyle(14, ROPE, 1);
    g.lineBetween(W / 2, topY, W / 2 + wobble, markerY);
    g.lineBetween(W / 2 + wobble, markerY, W / 2, bottomY);
    this.knot.setPosition(W / 2 + wobble, markerY);
  }
}
