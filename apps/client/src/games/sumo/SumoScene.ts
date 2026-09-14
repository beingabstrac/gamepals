import {
  createRng,
  newSumoGame,
  RING,
  stepSumo,
  SUMO_CANVAS,
  SUMO_STEP,
  SUMO_TIERS,
  sumoBotInput,
  WRESTLER_RADIUS,
  type Rng,
  type Seat,
  type SumoEvents,
  type SumoInput,
  type SumoState,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { COLORS, DARK, toHex } from '../../theme';
import type { RealtimeSceneOptions } from '../air-hockey/AirHockeyScene';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed, SPEED } from '../../autoplay';
import { facing, isPerson, seatForY } from '../duel';

export const SUMO_SIZE = { width: SUMO_CANVAS.width, height: SUMO_CANVAS.height };

const W = SUMO_CANVAS.width;
const H = SUMO_CANVAS.height;
const CLAY = 0xf6d2ad;
const CLAY_DARK = 0xe9b98b;
const STRAW = 0xd6b273;
const STRAW_DARK = 0xb8924f;
const SEAT_HEX = [toHex(COLORS.sky), toHex(COLORS.tomato)];
const SEAT_DARK = [toHex(DARK.sky), toHex(DARK.tomato)];
/** Drag this far from where you touched for full steering. */
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

export class SumoScene extends Scene {
  private state: SumoState = newSumoGame();
  private readonly rng: Rng;
  private accumulator = 0;
  private clock = 0;
  private history: { t: number; state: SumoState }[] = [];
  private noise: [number, number] = [0, 0];
  private noiseTimer = 0;
  private touches = new Map<number, Touch>();
  private steer: [{ x: number; y: number } | null, { x: number; y: number } | null] = [null, null];
  private shoveQueued: [boolean, boolean] = [false, false];
  private lastClashSound = -1;
  private ended = false;

  private bodies: GameObjects.Container[] = [];
  private banner!: GameObjects.Text;
  private hints: GameObjects.Text[] = [];

  constructor(private readonly options: RealtimeSceneOptions) {
    super('sumo');
    this.rng = createRng(options.seed);
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.input.addPointer(3);
    this.drawRing();

    this.hints = [0, 1].map((seat) =>
      sharpText(this, W / 2, seat === 0 ? H - 45 : 45, 'Drag to move. Tap to shove.', 26, COLORS.soft)
        .setAngle(facing(this.options.seats, seat as Seat))
        .setVisible(isPerson(this.options.seats, seat as Seat)),
    );
    this.bodies = [0, 1].map((seat) => this.makeWrestler(seat as Seat));
    this.banner = sharpText(this, W / 2, RING.y, '', 70, COLORS.ink).setDepth(10);
    this.showCountdown();

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
      if (!touch.moved && this.clock - touch.t < TAP_MS / 1000) this.shoveQueued[touch.seat] = true;
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);

    this.sync();
    this.options.onScore([0, 0]);
  }

  /** A round wrestler seen from above: body, belt, and a cheerful face. */
  private makeWrestler(seat: Seat): GameObjects.Container {
    const g = this.add.graphics();
    const r = WRESTLER_RADIUS;
    g.fillStyle(0x2b2a3a, 0.14);
    g.fillEllipse(0, 8, r * 2.1, r * 1.7);
    g.fillStyle(0xffe0c2, 1);
    g.fillCircle(0, 0, r);
    g.lineStyle(12, SEAT_HEX[seat]!, 1);
    g.strokeCircle(0, 0, r - 12);
    g.fillStyle(SEAT_DARK[seat]!, 1);
    g.fillCircle(0, r - 14, 9);
    g.fillStyle(0x2b2a3a, 1);
    g.fillCircle(-12, -10, 5);
    g.fillCircle(12, -10, 5);
    g.fillStyle(toHex(COLORS.bubblegum), 0.6);
    g.fillCircle(-22, 2, 6);
    g.fillCircle(22, 2, 6);
    g.lineStyle(4, 0x2b2a3a, 1);
    g.beginPath();
    g.arc(0, 0, 9, 0.3, Math.PI - 0.3, false);
    g.strokePath();
    g.fillStyle(0x2b2a3a, 1);
    g.fillEllipse(0, -r + 10, 22, 14);
    return this.add.container(0, 0, [g]).setDepth(4);
  }

  update(_time: number, delta: number): void {
    if (this.ended) return;
    this.accumulator += Math.min(delta, 100) * SPEED / 1000;
    this.noiseTimer -= Math.min(delta, 100) * SPEED / 1000;
    if (this.noiseTimer <= 0) {
      this.noise = [this.rng.next() * 2 - 1, this.rng.next() * 2 - 1];
      this.noiseTimer = 0.4;
    }

    while (this.accumulator >= SUMO_STEP) {
      this.accumulator -= SUMO_STEP;
      this.clock += SUMO_STEP;
      const before = this.state.phase;
      const inputs: [SumoInput, SumoInput] = [this.inputFor(0), this.inputFor(1)];
      const { state, events } = stepSumo(this.state, inputs);
      this.state = state;
      this.history.push({ t: this.clock, state });
      while (this.history.length > 0 && this.history[0]!.t < this.clock - HISTORY_SECONDS) this.history.shift();
      this.handle(events);
      if (before !== 'countdown' && state.phase === 'countdown') this.showCountdown();
      if (before === 'countdown' && state.phase === 'bout') this.shout('Hakkeyoi!');
      if (state.result) {
        this.ended = true;
        this.time.delayedCall(700, () => this.options.onEnd(state.result!));
        break;
      }
    }
    this.sync();
  }

  private inputFor(seat: Seat): SumoInput {
    const controller = this.options.seats[seat];
    if (controller?.kind === 'bot') {
      const tier = SUMO_TIERS[controller.tier];
      // Bots react to where the opponent was a moment ago, but know where they are themselves.
      const cutoff = this.clock - tier.reactionMs / 1000;
      let seen = this.history[0]?.state ?? this.state;
      for (const entry of this.history) {
        if (entry.t > cutoff) break;
        seen = entry.state;
      }
      const view: SumoState = {
        ...this.state,
        wrestlers: seat === 0 ? [this.state.wrestlers[0], seen.wrestlers[1]] : [seen.wrestlers[0], this.state.wrestlers[1]],
      };
      return sumoBotInput(view, seat, tier, this.noise[seat]);
    }
    const shove = this.shoveQueued[seat];
    this.shoveQueued[seat] = false;
    return { steer: this.steer[seat], shove };
  }

  private handle(events: SumoEvents): void {
    events.shove.forEach((shoved, seat) => {
      if (!shoved) return;
      const body = this.bodies[seat];
      if (body) this.tweens.add({ targets: body, scale: 1.12, duration: 80, yoyo: true, ease: 'Quad.easeOut' });
      this.dust(this.state.wrestlers[seat as Seat]);
    });
    if (events.clash > 150 && this.clock - this.lastClashSound > 0.12) {
      this.lastClashSound = this.clock;
      this.options.onCue('thud');
      const [a, b] = this.state.wrestlers;
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      // Squash both bodies along the line of impact.
      for (const body of this.bodies) {
        body.setRotation(angle);
        this.tweens.add({ targets: body, scaleX: 0.86, scaleY: 1.1, duration: 70, yoyo: true, ease: 'Quad.easeOut' });
      }
      if (events.clash > 500) this.cameras.main.shake(120, 0.006);
    }
    if (events.boutOver !== null) {
      this.options.onCue('gong');
      this.cameras.main.shake(260, 0.012);
      this.options.onScore(this.state.bouts);
      this.shout(this.state.result ? 'Yokozuna!' : 'Out!');
      for (const hint of this.hints) this.tweens.add({ targets: hint, alpha: 0, duration: 400 });
    }
  }

  private dust(at: { x: number; y: number }): void {
    for (let i = 0; i < 6; i++) {
      const angle = this.rng.next() * Math.PI * 2;
      const puff = this.add.circle(at.x, at.y, 8 + this.rng.next() * 8, 0xffffff, 0.7).setDepth(3);
      this.tweens.add({
        targets: puff,
        x: at.x + Math.cos(angle) * 60,
        y: at.y + Math.sin(angle) * 60,
        alpha: 0,
        scale: 1.6,
        duration: 420,
        ease: 'Cubic.easeOut',
        onComplete: () => puff.destroy(),
      });
    }
  }

  private showCountdown(): void {
    this.banner.setText('Ready…').setAlpha(1).setScale(0.7);
    this.tweens.killTweensOf(this.banner);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 360, ease: 'Back.easeOut' });
  }

  private shout(text: string): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: this.banner, scale: 1.1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 650, duration: 300 });
  }

  private sync(): void {
    this.state.wrestlers.forEach((w, seat) => {
      const body = this.bodies[seat];
      if (!body) return;
      body.setPosition(w.x, w.y);
      // Teeter near the edge: a little wobble grows as you get close to the bales.
      const edge = RING.radius - Math.hypot(w.x - RING.x, w.y - RING.y);
      if (!this.tweens.isTweening(body)) {
        const wobble = edge < 50 && this.state.phase === 'bout' ? Math.sin(this.clock * 30) * (1 - edge / 50) * 0.12 : 0;
        const face = Math.atan2(RING.y - w.y, RING.x - w.x);
        body.setRotation(face + Math.PI / 2 + wobble);
      }
    });
  }

  private drawRing(): void {
    const g = this.add.graphics();
    g.fillStyle(CLAY_DARK, 1);
    g.fillCircle(RING.x, RING.y + 12, RING.radius + 36);
    g.fillStyle(CLAY, 1);
    g.fillCircle(RING.x, RING.y, RING.radius + 36);
    // Straw bales mark the edge.
    g.lineStyle(20, STRAW_DARK, 1);
    g.strokeCircle(RING.x, RING.y + 3, RING.radius + 8);
    g.lineStyle(18, STRAW, 1);
    g.strokeCircle(RING.x, RING.y, RING.radius + 8);
    // The two white start lines.
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(RING.x - 36, RING.y + 40, 72, 8, 4);
    g.fillRoundedRect(RING.x - 36, RING.y - 48, 72, 8, 4);
  }
}
