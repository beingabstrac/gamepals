import {
  RUN_BLOCK,
  blocksNear,
  CORRIDOR,
  GRAVITY_CANVAS,
  GRAVITY_TIERS,
  gravityBotInput,
  newGravityRun,
  RUN_LIVES,
  RUN_STEP,
  RUNNER,
  stepGravity,
  type GravityEvents,
  type GravityInput,
  type GravityState,
  type Seat,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { COLORS, DARK, toHex } from '../../theme';
import type { RealtimeSceneOptions } from '../air-hockey/AirHockeyScene';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed, SPEED } from '../../autoplay';
import { facing, onDuelKeys, onHalfTap } from '../duel';

export const GRAVITY_SIZE = { width: GRAVITY_CANVAS.width, height: GRAVITY_CANVAS.height };
export const GRAVITY_COLORS = [COLORS.sky, COLORS.tomato];

const W = GRAVITY_CANVAS.width;
const H = GRAVITY_CANVAS.height;
const SEAT_HEX = GRAVITY_COLORS.map(toHex);
const SEAT_DARK = [DARK.sky, DARK.tomato].map(toHex);

/**
 * Gravity Run. The rules run both corridors; the scene gives each player their half of the phone
 * as a corridor seen side on (the top one turned round), the runner as a round blob that turns
 * upside down on the ceiling and squashes when it lands, blocks sliding past, and hearts.
 */
export class GravityScene extends Scene {
  private state: GravityState;
  private accumulator = 0;
  private ended = false;
  private queued: [boolean, boolean] = [false, false];
  private art: GameObjects.Graphics[] = [];
  private banner!: GameObjects.Text;
  private squash: [number, number] = [0, 0];

  constructor(private readonly options: RealtimeSceneOptions) {
    super('gravity-run');
    this.state = newGravityRun(options.seed);
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    for (const seat of [0, 1] as const) {
      const half = this.add.container(seat === 0 ? 0 : W, H / 2).setAngle(seat === 0 ? 0 : 180);
      const art = this.add.graphics();
      half.add(art);
      this.art.push(art);
    }
    this.banner = sharpText(this, W / 2, H / 2, '', 50, COLORS.ink).setDepth(10).setFontStyle('bold').setStroke('#FFFFFF', 8);
    // A tap anywhere in your half flips your runner; so do Space and Shift.
    onHalfTap(this, H, (seat) => {
      if (this.options.seats[seat]?.kind === 'human') this.queued[seat] = true;
    });
    onDuelKeys(this, this.options.seats, (seat, action) => {
      if (action === 'tap' || action === 'up' || action === 'down') this.queued[seat] = true;
    });
    this.shout('Ready…');
    this.options.onScore([RUN_LIVES, RUN_LIVES]);
  }

  update(_time: number, delta: number): void {
    if (!this.ended) {
      this.accumulator += (Math.min(delta, 100) * SPEED) / 1000;
      while (this.accumulator >= RUN_STEP) {
        this.accumulator -= RUN_STEP;
        const was = this.state.phase;
        const { state, events } = stepGravity(this.state, [this.inputFor(0), this.inputFor(1)]);
        this.state = state;
        if (was === 'countdown' && state.phase === 'run') this.shout('Go!');
        this.handle(events);
        if (state.result) {
          this.ended = true;
          this.time.delayedCall(1000, () => this.options.onEnd(state.result!));
          break;
        }
      }
    }
    this.squash = [this.squash[0] * 0.85, this.squash[1] * 0.85];
    this.draw();
  }

  private inputFor(seat: Seat): GravityInput {
    const controller = this.options.seats[seat];
    if (controller?.kind === 'bot') return gravityBotInput(this.state, seat, GRAVITY_TIERS[controller.tier]);
    const flip = this.queued[seat];
    this.queued[seat] = false;
    return { flip };
  }

  private handle(events: GravityEvents): void {
    if (events.flipped.length) this.options.onCue('tap');
    for (const seat of events.landed) this.squash[seat] = 1;
    for (const seat of events.bumped) {
      this.options.onCue(events.out.includes(seat) ? 'goal' : 'thud');
      this.cameras.main.shake(180, 0.01);
    }
    if (events.bumped.length) this.options.onScore([this.state.runners[0].lives, this.state.runners[1].lives]);
    if (events.out.length) {
      const [out] = events.out;
      this.shout(events.out.length > 1 ? 'Both out!' : `${out === 0 ? 'Red' : 'Blue'} wins!`);
    }
  }

  private shout(text: string): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setAlpha(1).setScale(0.6).setAngle(facing(this.options.seats, 0));
    this.tweens.add({ targets: this.banner, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 800, duration: 250 });
  }

  private draw(): void {
    const s = this.state;
    const near = blocksNear(s.seed, s.distance, W);
    for (const seat of [0, 1] as const) {
      const g = this.art[seat]!.clear();
      const r = s.runners[seat];
      g.fillStyle(SEAT_HEX[seat]!, 0.07);
      g.fillRect(0, 0, W, H / 2);
      // Floor and ceiling, with stripes that roll past to show the speed.
      g.fillStyle(toHex(DARK.grape), 1);
      g.fillRect(0, CORRIDOR.floor, W, 14);
      g.fillRect(0, CORRIDOR.ceiling - 14, W, 14);
      g.fillStyle(toHex(COLORS.grape), 1);
      for (let x = -(s.distance % 60); x < W; x += 60) {
        g.fillRect(x, CORRIDOR.floor, 30, 14);
        g.fillRect(x + 30, CORRIDOR.ceiling - 14, 30, 14);
      }
      // Blocks sticking out of the floor or down from the ceiling.
      for (const b of near) {
        const x = b.at - s.distance + RUNNER.x;
        const y = b.top ? CORRIDOR.ceiling : CORRIDOR.floor - RUN_BLOCK.h;
        g.fillStyle(toHex(DARK.sunny), 1);
        g.fillRoundedRect(x, y + 5, RUN_BLOCK.w, RUN_BLOCK.h - 5, 12);
        g.fillStyle(toHex(COLORS.sunny), 1);
        g.fillRoundedRect(x, y, RUN_BLOCK.w, RUN_BLOCK.h - 5, 12);
        g.fillStyle(0xffffff, 0.35);
        g.fillRoundedRect(x + 8, y + 8, RUN_BLOCK.w - 16, 8, 4);
      }
      // The runner: a round blob, feet toward whichever way gravity pulls, blinking when safe.
      const blink = r.safe > 0 && Math.floor(r.safe * 10) % 2 === 0;
      if (r.lives > 0 && !blink) {
        const sq = this.squash[seat];
        const w = RUNNER.w * (1 + sq * 0.25);
        const h = RUNNER.h * (1 - sq * 0.2);
        const d = r.down;
        const cx = RUNNER.x;
        const cy = r.y + d * (RUNNER.h - h) / 2;
        g.fillStyle(SEAT_DARK[seat]!, 1);
        g.fillEllipse(cx, cy + d * 3, w, h);
        g.fillStyle(SEAT_HEX[seat]!, 1);
        g.fillEllipse(cx, cy, w, h);
        g.fillStyle(0xffffff, 1);
        g.fillCircle(cx + 6, cy - d * 8, 6);
        g.fillStyle(toHex(COLORS.ink), 1);
        g.fillCircle(cx + 8, cy - d * 8, 3);
        // Little feet on the side it stands on.
        g.fillStyle(toHex(COLORS.ink), 1);
        g.fillEllipse(cx - 8, cy + d * (h / 2), 12, 6);
        g.fillEllipse(cx + 8, cy + d * (h / 2), 12, 6);
      }
      // Hearts, at the player's end of their half.
      for (let i = 0; i < RUN_LIVES; i++) {
        const x = W - 40 - i * 40;
        const y = H / 2 - 30;
        g.fillStyle(i < r.lives ? toHex(COLORS.tomato) : 0xd8d3e6, 1);
        g.fillCircle(x - 7, y - 4, 9);
        g.fillCircle(x + 7, y - 4, 9);
        g.fillTriangle(x - 15, y, x + 15, y, x, y + 16);
      }
    }
  }
}
