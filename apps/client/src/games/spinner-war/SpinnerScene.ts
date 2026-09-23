import {
  BOWL,
  createRng,
  FULL_SPIN,
  fromMiddle,
  newSpinnerGame,
  SPINNER_CANVAS,
  SPINNER_STEP,
  SPINNER_TIERS,
  spinnerBotInput,
  stepSpinner,
  TOP_RADIUS,
  type Rng,
  type Seat,
  type SpinnerEvents,
  type SpinnerInput,
  type SpinnerState,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { COLORS, DARK, toHex } from '../../theme';
import type { RealtimeSceneOptions } from '../air-hockey/AirHockeyScene';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed, SPEED } from '../../autoplay';
import { facing, heldDuelKeys, isPerson, onDuelKeys, seatForY } from '../duel';

export const SPINNER_SIZE = { width: SPINNER_CANVAS.width, height: SPINNER_CANVAS.height };
export const SPINNER_COLORS = [COLORS.sky, COLORS.tomato];

const W = SPINNER_CANVAS.width;
const H = SPINNER_CANVAS.height;
const SEAT_HEX = SPINNER_COLORS.map(toHex);
const SEAT_DARK = [toHex(DARK.sky), toHex(DARK.tomato)];
/** Drag this far from where you touched for a full lean. */
const STICK_RANGE = 70;
const TAP_MS = 220;
const HISTORY_SECONDS = 0.35;
/** The spin bars sit between the bowl and the edge, one on each player's side. */
const BAR_W = 300;
const BAR_H = 18;

interface Touch {
  readonly seat: Seat;
  readonly x: number;
  readonly y: number;
  readonly t: number;
  moved: boolean;
}

/**
 * Spinner War. The rules step the bowl; this scene feeds them leans and dashes, draws the tops
 * spinning as fast as their spin says, and makes every clash loud. Bots see the other top a moment
 * late, the way Sumo's do.
 */
export class SpinnerScene extends Scene {
  private state: SpinnerState = newSpinnerGame();
  private readonly rng: Rng;
  private accumulator = 0;
  private clock = 0;
  private history: { t: number; state: SpinnerState }[] = [];
  private noise: [number, number] = [0, 0];
  private noiseTimer = 0;
  private touches = new Map<number, Touch>();
  private steer: [{ x: number; y: number } | null, { x: number; y: number } | null] = [null, null];
  private dashQueued: [boolean, boolean] = [false, false];
  private held: (seat: Seat) => { x: number; y: number } = () => ({ x: 0, y: 0 });
  private lastClashSound = -1;
  private ended = false;
  private spinAngle: [number, number] = [0, 0];

  private tops: GameObjects.Container[] = [];
  private bars: GameObjects.Graphics[] = [];
  private banner!: GameObjects.Text;

  constructor(private readonly options: RealtimeSceneOptions) {
    super('spinner-war');
    this.rng = createRng(options.seed);
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.input.addPointer(3);
    this.drawBowl();
    for (const seat of [0, 1] as const) {
      const hint = sharpText(this, W / 2, seat === 0 ? H - 30 : 30, 'Drag to lean. Tap to dash.', 22, COLORS.soft);
      hint.setAngle(facing(this.options.seats, seat)).setVisible(isPerson(this.options.seats, seat));
      this.tweens.add({ targets: hint, alpha: 0, delay: 5000, duration: 600 });
    }
    this.bars = [0, 1].map(() => this.add.graphics().setDepth(6));
    this.tops = [0, 1].map((seat) => this.makeTop(seat as Seat));
    this.banner = sharpText(this, W / 2, BOWL.y, '', 64, COLORS.ink).setDepth(10);
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

  /** A battle top from above: a coloured ring of blades round a metal hub, drawn to be spun. */
  private makeTop(seat: Seat): GameObjects.Container {
    const r = TOP_RADIUS;
    const shadow = this.add.graphics();
    shadow.fillStyle(0x2b2a3a, 0.16);
    shadow.fillEllipse(4, 8, r * 2.1, r * 1.8);
    const blades = this.add.graphics();
    blades.fillStyle(SEAT_DARK[seat]!, 1);
    blades.fillCircle(0, 0, r);
    blades.fillStyle(SEAT_HEX[seat]!, 1);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      blades.beginPath();
      blades.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3);
      blades.lineTo(Math.cos(a - 0.35) * r, Math.sin(a - 0.35) * r);
      blades.lineTo(Math.cos(a + 0.5) * r * 0.92, Math.sin(a + 0.5) * r * 0.92);
      blades.closePath();
      blades.fillPath();
    }
    blades.fillStyle(0xd9d2ec, 1);
    blades.fillCircle(0, 0, r * 0.38);
    blades.fillStyle(0xffffff, 1);
    blades.fillCircle(0, 0, r * 0.22);
    blades.fillStyle(SEAT_HEX[seat]!, 1);
    blades.fillCircle(0, 0, r * 0.1);
    return this.add.container(0, 0, [shadow, blades]).setDepth(4);
  }

  update(_time: number, delta: number): void {
    const dt = (Math.min(delta, 100) * SPEED) / 1000;
    this.spinAngle = this.state.tops.map((t, i) => this.spinAngle[i]! + (t.spin / FULL_SPIN) * 28 * dt) as [number, number];
    if (!this.ended) {
      this.accumulator += dt;
      this.noiseTimer -= dt;
      if (this.noiseTimer <= 0) {
        this.noise = [this.rng.next() * 2 - 1, this.rng.next() * 2 - 1];
        this.noiseTimer = 0.4;
      }
      while (this.accumulator >= SPINNER_STEP) {
        this.accumulator -= SPINNER_STEP;
        this.clock += SPINNER_STEP;
        const before = this.state.phase;
        const { state, events } = stepSpinner(this.state, [this.inputFor(0), this.inputFor(1)]);
        this.state = state;
        this.history.push({ t: this.clock, state });
        while (this.history.length > 0 && this.history[0]!.t < this.clock - HISTORY_SECONDS) this.history.shift();
        this.handle(events);
        if (before !== 'countdown' && state.phase === 'countdown') this.shout('Ready…', false);
        if (before === 'countdown' && state.phase === 'round') this.shout('Let it rip!', true);
        if (state.result) {
          this.ended = true;
          this.time.delayedCall(800, () => this.options.onEnd(state.result!));
          break;
        }
      }
    }
    this.sync();
  }

  private inputFor(seat: Seat): SpinnerInput {
    const controller = this.options.seats[seat];
    if (controller?.kind === 'bot') {
      const tier = SPINNER_TIERS[controller.tier];
      // Bots react to where the other top was a moment ago, and know where they are themselves.
      const cutoff = this.clock - tier.reactionMs / 1000;
      let seen = this.history[0]?.state ?? this.state;
      for (const entry of this.history) {
        if (entry.t > cutoff) break;
        seen = entry.state;
      }
      const view: SpinnerState = { ...this.state, tops: seat === 0 ? [this.state.tops[0], seen.tops[1]] : [seen.tops[0], this.state.tops[1]] };
      return spinnerBotInput(view, seat, tier, this.noise[seat]);
    }
    const dash = this.dashQueued[seat];
    this.dashQueued[seat] = false;
    const key = this.held(seat);
    return { steer: this.steer[seat] ?? (key.x || key.y ? key : null), dash };
  }

  private handle(events: SpinnerEvents): void {
    events.dash.forEach((dashed, seat) => {
      if (!dashed) return;
      const top = this.tops[seat];
      if (top) this.tweens.add({ targets: top, scale: 1.15, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
      this.options.onCue('tap');
    });
    if (events.clash > 140 && this.clock - this.lastClashSound > 0.1) {
      this.lastClashSound = this.clock;
      this.options.onCue(events.clash > 400 ? 'clang' : 'hit');
      const [a, b] = this.state.tops;
      this.sparks((a.x + b.x) / 2, (a.y + b.y) / 2, Math.min(14, 4 + Math.round(events.clash / 60)));
      if (events.clash > 380) this.cameras.main.shake(140, 0.008);
    }
    if (events.roundOver) {
      this.options.onCue('gong');
      this.cameras.main.shake(240, 0.01);
      this.options.onScore(this.state.points);
      const loser = this.tops[events.roundOver.winner === 0 ? 1 : 0];
      if (loser && events.roundOver.how === 'spin-finish') this.tweens.add({ targets: loser, angle: 80, scaleX: 0.8, duration: 380, ease: 'Bounce.easeOut' });
      this.shout(this.state.result ? 'Winner!' : events.roundOver.how === 'ring-out' ? 'Ring out!' : 'Spin finish!', true);
    }
  }

  private sparks(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = this.rng.next() * Math.PI * 2;
      const spark = this.add.rectangle(x, y, 10, 4, toHex(COLORS.sunny)).setRotation(angle).setDepth(8);
      const reach = 40 + this.rng.next() * 50;
      this.tweens.add({ targets: spark, x: x + Math.cos(angle) * reach, y: y + Math.sin(angle) * reach, alpha: 0, scaleX: 0.3, duration: 260, ease: 'Cubic.easeOut', onComplete: () => spark.destroy() });
    }
  }

  private shout(text: string, fade: boolean): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: this.banner, scale: 1.05, duration: 260, ease: 'Back.easeOut' });
    if (fade) this.tweens.add({ targets: this.banner, alpha: 0, delay: 650, duration: 300 });
  }

  private sync(): void {
    this.state.tops.forEach((t, seat) => {
      const view = this.tops[seat];
      if (!view) return;
      const spinning = this.state.phase !== 'over' || t.spin > 0;
      // A top low on spin wobbles, more the closer it is to stopping.
      const wobble = t.spin < 30 && this.state.phase === 'round' ? (1 - t.spin / 30) * 6 : 0;
      view.setPosition(t.x + Math.sin(this.clock * 23 + seat) * wobble, t.y + Math.cos(this.clock * 19 + seat) * wobble);
      if (spinning && !this.tweens.isTweening(view)) view.setRotation(this.spinAngle[seat]!).setScale(1);
      // Near the lip, a top rides up it and looks a little smaller, as if further away.
      const up = Math.max(0, fromMiddle(t) - BOWL.radius * 0.7) / (BOWL.radius * 0.3);
      if (!this.tweens.isTweening(view)) view.setScale(1 - up * 0.1);
    });
    this.bars.forEach((bar, seat) => {
      const y = seat === 0 ? H - 70 : 70;
      const t = this.state.tops[seat]!;
      bar.clear();
      bar.fillStyle(0xe6e0f4, 1);
      bar.fillRoundedRect(W / 2 - BAR_W / 2, y - BAR_H / 2, BAR_W, BAR_H, BAR_H / 2);
      const fill = (BAR_W * t.spin) / FULL_SPIN;
      if (fill > 1) {
        bar.fillStyle(t.spin < 25 ? toHex(COLORS.tomato) : SEAT_HEX[seat]!, 1);
        // The second player's bar fills from their own left, the right as we look at it.
        const x = facing(this.options.seats, seat as Seat) === 180 ? W / 2 + BAR_W / 2 - fill : W / 2 - BAR_W / 2;
        bar.fillRoundedRect(x, y - BAR_H / 2, fill, BAR_H, BAR_H / 2);
      }
    });
  }

  /** The bowl, in flat rings stepping darker toward the middle, with a lip round the rim. */
  private drawBowl(): void {
    const g = this.add.graphics();
    g.fillStyle(toHex(DARK.grape), 1);
    g.fillCircle(BOWL.x, BOWL.y + 12, BOWL.radius + 30);
    g.fillStyle(toHex(COLORS.grape), 1);
    g.fillCircle(BOWL.x, BOWL.y, BOWL.radius + 30);
    const shades = [0xf4f1fb, 0xece6f8, 0xe3dbf4, 0xd9cff0, 0xcfc3ec];
    shades.forEach((shade, i) => {
      g.fillStyle(shade, 1);
      g.fillCircle(BOWL.x, BOWL.y, BOWL.radius * (1 - i * 0.18));
    });
    g.lineStyle(3, 0xffffff, 0.8);
    g.strokeCircle(BOWL.x, BOWL.y, BOWL.radius);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(BOWL.x, BOWL.y, 6);
  }
}
