import {
  AIR_HOCKEY_TIERS,
  airHockeyBotTarget,
  createRng,
  GOAL_WIDTH,
  MALLET_RADIUS,
  newAirHockeyGame,
  PUCK_RADIUS,
  STEP,
  stepAirHockey,
  TABLE,
  type AirHockeyState,
  type GameResult,
  type MalletInput,
  type Point,
  type Rng,
  type Seat,
  type StepEvents,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import type { SeatController } from '../../session';
import type { SoundName } from '../../sfx';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';

export interface RealtimeSceneOptions {
  readonly seats: readonly SeatController[];
  readonly seed: number;
  onScore(scores: readonly number[]): void;
  onEnd(result: GameResult): void;
  onCue(name: SoundName): void;
}

export const AIR_HOCKEY_SIZE = { width: TABLE.width, height: TABLE.height };
export const AIR_HOCKEY_COLORS = [COLORS.sky, COLORS.tomato];

const SEAT_HEX = AIR_HOCKEY_COLORS.map(toHex);
const SEAT_DARK = [toHex(DARK.sky), toHex(DARK.tomato)];
const RAIL = toHex(DARK.sky);
const ICE = 0xeef7ff;
const MARKINGS = 0xbfdcff;
const PUCK_COLOR = toHex(COLORS.ink);
const PUCK_GLOW = toHex(COLORS.sunny);
const HUMAN_SPEED = 3200;
const TRAIL_LENGTH = 12;
const HISTORY_SECONDS = 0.4;

export class AirHockeyScene extends Scene {
  private state: AirHockeyState = newAirHockeyGame();
  private readonly rng: Rng;
  private accumulator = 0;
  private clock = 0;
  private history: { t: number; state: AirHockeyState }[] = [];
  private noise: [number, number] = [0, 0];
  private noiseTimer = 0;
  private lastSound: Partial<Record<SoundName, number>> = {};
  private ended = false;

  private puck!: GameObjects.Container;
  private puckGlow!: GameObjects.Arc;
  private mallets: GameObjects.Container[] = [];
  private trail!: GameObjects.Graphics;
  private trailPoints: Point[] = [];
  private scoreTexts: GameObjects.Text[] = [];

  constructor(private readonly options: RealtimeSceneOptions) {
    super('air-hockey');
    this.rng = createRng(options.seed);
  }

  create(): void {
    fitCamera(this, TABLE.width, TABLE.height);
    this.input.addPointer(3);
    this.drawTable();

    const { width: w, height: h } = TABLE;
    this.scoreTexts = [0, 1].map((seat) =>
      sharpText(this, w - 70, seat === 0 ? h / 2 + 80 : h / 2 - 80, '0', 88, AIR_HOCKEY_COLORS[seat] ?? COLORS.ink)
        .setAlpha(0.35)
        // The top player sits on the other side of the phone.
        .setAngle(seat === 1 ? 180 : 0),
    );

    this.trail = this.add.graphics();

    this.mallets = [0, 1].map((seat) => {
      const color = SEAT_HEX[seat]!;
      return this.add.container(0, 0, [
        this.add.circle(0, 6, MALLET_RADIUS, 0x2b2a3a, 0.12),
        this.add.circle(0, 0, MALLET_RADIUS, color).setStrokeStyle(5, 0xffffff, 1),
        this.add.circle(0, 0, MALLET_RADIUS * 0.62, SEAT_DARK[seat] ?? color),
        this.add.circle(0, 0, MALLET_RADIUS * 0.34, 0xffffff),
      ]);
    });

    this.puckGlow = this.add.circle(0, 0, PUCK_RADIUS + 12, PUCK_GLOW, 0.22);
    this.puck = this.add.container(0, 0, [
      this.puckGlow,
      this.add.circle(0, 0, PUCK_RADIUS, PUCK_COLOR).setStrokeStyle(5, PUCK_GLOW, 1),
      this.add.circle(0, 0, PUCK_RADIUS * 0.4, PUCK_GLOW),
    ]);

    this.syncObjects();
  }

  update(_time: number, delta: number): void {
    if (this.ended) return;
    // Cap the frame time so a tab switch doesn't fast-forward the match.
    const dt = Math.min(delta, 100) / 1000;
    this.accumulator += dt;

    this.noiseTimer -= dt;
    if (this.noiseTimer <= 0) {
      this.noise = [this.rng.next() * 2 - 1, this.rng.next() * 2 - 1];
      this.noiseTimer = 0.6;
    }

    const humanTargets = this.readHumanTargets();
    while (this.accumulator >= STEP) {
      this.accumulator -= STEP;
      this.clock += STEP;
      const inputs: [MalletInput, MalletInput] = [this.inputFor(0, humanTargets[0]), this.inputFor(1, humanTargets[1])];
      const { state, events } = stepAirHockey(this.state, inputs);
      this.state = state;
      this.history.push({ t: this.clock, state });
      while (this.history.length > 0 && this.history[0]!.t < this.clock - HISTORY_SECONDS) this.history.shift();
      this.handleEvents(events);
      if (state.result) {
        this.ended = true;
        this.options.onEnd(state.result);
        break;
      }
    }
    this.syncObjects();
  }

  /** Each finger steers the mallet on the half of the table it touches. */
  private readHumanTargets(): [Point | null, Point | null] {
    const targets: [Point | null, Point | null] = [null, null];
    for (const pointer of this.input.manager.pointers) {
      if (!pointer.isDown) continue;
      const seat: Seat = pointer.worldY > TABLE.height / 2 ? 0 : 1;
      if (this.options.seats[seat]?.kind === 'human') targets[seat] = { x: pointer.worldX, y: pointer.worldY };
    }
    return targets;
  }

  private inputFor(seat: Seat, humanTarget: Point | null): MalletInput {
    const controller = this.options.seats[seat];
    if (controller?.kind !== 'bot') return { target: humanTarget, maxSpeed: HUMAN_SPEED };
    const tier = AIR_HOCKEY_TIERS[controller.tier];
    // Bots react to where the puck was a moment ago, but always know their own mallet.
    const seen = this.snapshotAgo(tier.reactionMs / 1000);
    const view: AirHockeyState = { ...seen, mallets: this.state.mallets };
    return { target: airHockeyBotTarget(view, seat, tier, this.noise[seat]), maxSpeed: tier.maxSpeed };
  }

  private snapshotAgo(seconds: number): AirHockeyState {
    const cutoff = this.clock - seconds;
    let seen = this.history[0]?.state ?? this.state;
    for (const entry of this.history) {
      if (entry.t > cutoff) break;
      seen = entry.state;
    }
    return seen;
  }

  private play(name: SoundName, minGapSeconds: number): void {
    const last = this.lastSound[name] ?? -Infinity;
    if (this.clock - last < minGapSeconds) return;
    this.lastSound[name] = this.clock;
    this.options.onCue(name);
  }

  private handleEvents(events: StepEvents): void {
    if (events.hit > 120) {
      this.play('hit', 0.06);
      this.tweens.add({ targets: this.puckGlow, scale: 1.8, alpha: 0.5, duration: 90, yoyo: true });
    }
    if (events.wall) this.play('wall', 0.08);
    if (events.goal !== null) {
      const scorer = events.goal;
      this.play('goal', 0.3);
      this.cameras.main.shake(260, 0.012);
      const color = SEAT_HEX[scorer]!;
      this.cameras.main.flash(220, (color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff);
      this.burst(TABLE.width / 2, scorer === 0 ? 0 : TABLE.height, color);
      const text = this.scoreTexts[scorer];
      if (text) {
        text.setText(String(this.state.scores[scorer]));
        this.tweens.add({ targets: text, scale: 1.5, alpha: 0.9, duration: 180, yoyo: true, ease: 'Back.easeOut' });
      }
      this.trailPoints = [];
      this.options.onScore(this.state.scores);
    }
  }

  /** Sparks flying out of the goal mouth. */
  private burst(x: number, y: number, color: number): void {
    for (let i = 0; i < 18; i++) {
      const angle = (y === 0 ? 0 : Math.PI) + (this.rng.next() * Math.PI);
      const distance = 80 + this.rng.next() * 160;
      const spark = this.add.circle(x, y, 5 + this.rng.next() * 6, i % 3 === 0 ? 0xffffff : color);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.3,
        duration: 500 + this.rng.next() * 300,
        ease: 'Cubic.easeOut',
        onComplete: () => spark.destroy(),
      });
    }
  }

  private syncObjects(): void {
    const { puck, mallets } = this.state;
    this.puck.setPosition(puck.x, puck.y);
    mallets.forEach((m, seat) => this.mallets[seat]?.setPosition(m.x, m.y));

    // Fading trail behind a fast puck.
    this.trailPoints.push({ x: puck.x, y: puck.y });
    if (this.trailPoints.length > TRAIL_LENGTH) this.trailPoints.shift();
    const speed = Math.hypot(puck.vx, puck.vy);
    this.trail.clear();
    if (speed > 200) {
      this.trailPoints.forEach((p, i) => {
        const t = (i + 1) / this.trailPoints.length;
        this.trail.fillStyle(PUCK_GLOW, 0.25 * t);
        this.trail.fillCircle(p.x, p.y, PUCK_RADIUS * (0.4 + 0.6 * t));
      });
    }
  }

  private drawTable(): void {
    const g = this.add.graphics();
    const { width: w, height: h } = TABLE;

    // Light ice with a solid rail: flat colors, no glow gradients.
    g.fillStyle(ICE, 1);
    g.fillRoundedRect(0, 0, w, h, 48);
    g.lineStyle(10, RAIL, 1);
    g.strokeRoundedRect(5, 5, w - 10, h - 10, 44);

    g.lineStyle(5, MARKINGS, 1);
    g.lineBetween(24, h / 2, w - 24, h / 2);
    g.strokeCircle(w / 2, h / 2, 80);
    g.fillStyle(MARKINGS, 1);
    g.fillCircle(w / 2, h / 2, 9);

    // Goal creases and mouths in each player's color.
    g.lineStyle(4, SEAT_HEX[1]!, 0.7);
    g.beginPath();
    g.arc(w / 2, 0, 130, 0, Math.PI, false);
    g.strokePath();
    g.lineStyle(4, SEAT_HEX[0]!, 0.7);
    g.beginPath();
    g.arc(w / 2, h, 130, Math.PI, Math.PI * 2, false);
    g.strokePath();

    g.fillStyle(SEAT_HEX[1]!, 1);
    g.fillRoundedRect(w / 2 - GOAL_WIDTH / 2, 0, GOAL_WIDTH, 14, 7);
    g.fillStyle(SEAT_HEX[0]!, 1);
    g.fillRoundedRect(w / 2 - GOAL_WIDTH / 2, h - 14, GOAL_WIDTH, 14, 7);
  }
}
