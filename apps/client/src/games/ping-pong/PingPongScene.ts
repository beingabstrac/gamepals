import {
  BALL_RADIUS,
  createRng,
  newPongGame,
  PADDLE_HEIGHT,
  PADDLE_WIDTH,
  paddleY,
  PONG_STEP,
  PONG_TABLE,
  PONG_TIERS,
  pongBotTarget,
  stepPong,
  type PaddleInput,
  type PongEvents,
  type PongState,
  type Rng,
  type Seat,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import type { SoundName } from '../../sfx';
import { COLORS, DARK, toHex } from '../../theme';
import type { RealtimeSceneOptions } from '../air-hockey/AirHockeyScene';
import { fitCamera, sharpText } from '../crisp';
import { seatForY } from '../duel';

export const PING_PONG_SIZE = { width: PONG_TABLE.width, height: PONG_TABLE.height };

const COURT = toHex(COLORS.mint);
const COURT_LIP = toHex(DARK.mint);
const SEAT_HEX = [toHex(COLORS.sky), toHex(COLORS.tomato)];
const SEAT_DARK = [toHex(DARK.sky), toHex(DARK.tomato)];
const HUMAN_SPEED = 2600;
const HISTORY_SECONDS = 0.3;
const TRAIL_LENGTH = 8;

export class PingPongScene extends Scene {
  private state: PongState = newPongGame();
  private readonly rng: Rng;
  private accumulator = 0;
  private clock = 0;
  private history: { t: number; state: PongState }[] = [];
  private noise: [number, number] = [0, 0];
  private noiseTimer = 0;
  private lastSound: Partial<Record<SoundName, number>> = {};
  private ended = false;

  private ball!: GameObjects.Container;
  private paddles: GameObjects.Container[] = [];
  private trail!: GameObjects.Graphics;
  private trailPoints: { x: number; y: number }[] = [];
  private scoreTexts: GameObjects.Text[] = [];

  constructor(private readonly options: RealtimeSceneOptions) {
    super('ping-pong');
    this.rng = createRng(options.seed);
  }

  create(): void {
    const { width: w, height: h } = PONG_TABLE;
    fitCamera(this, w, h);
    this.input.addPointer(3);
    this.drawCourt();

    this.scoreTexts = [0, 1].map((seat) =>
      sharpText(this, w / 2, seat === 0 ? h * 0.72 : h * 0.28, '0', 120, '#ffffff')
        .setAlpha(0.5)
        .setAngle(seat === 1 ? 180 : 0),
    );

    this.trail = this.add.graphics();

    this.paddles = [0, 1].map((seat) => {
      const g = this.add.graphics();
      g.fillStyle(SEAT_DARK[seat]!, 1);
      g.fillRoundedRect(-PADDLE_WIDTH / 2, -PADDLE_HEIGHT / 2 + 5, PADDLE_WIDTH, PADDLE_HEIGHT, PADDLE_HEIGHT / 2);
      g.fillStyle(SEAT_HEX[seat]!, 1);
      g.fillRoundedRect(-PADDLE_WIDTH / 2, -PADDLE_HEIGHT / 2, PADDLE_WIDTH, PADDLE_HEIGHT, PADDLE_HEIGHT / 2);
      g.fillStyle(0xffffff, 0.9);
      g.fillRoundedRect(-PADDLE_WIDTH / 2 + 18, -3, PADDLE_WIDTH - 36, 6, 3);
      return this.add.container(w / 2, paddleY(seat as Seat), [g]);
    });

    this.ball = this.add.container(w / 2, h / 2, [
      this.add.circle(0, 5, BALL_RADIUS, 0x2b2a3a, 0.14),
      this.add.circle(0, 0, BALL_RADIUS, 0xffffff).setStrokeStyle(3, 0xe6e1f3),
    ]);

    this.sync();
  }

  update(_time: number, delta: number): void {
    if (this.ended) return;
    const dt = Math.min(delta, 100) / 1000;
    this.accumulator += dt;

    this.noiseTimer -= dt;
    if (this.noiseTimer <= 0) {
      this.noise = [this.rng.next() * 2 - 1, this.rng.next() * 2 - 1];
      this.noiseTimer = 0.5;
    }

    const human = this.readTouches();
    while (this.accumulator >= PONG_STEP) {
      this.accumulator -= PONG_STEP;
      this.clock += PONG_STEP;
      const inputs: [PaddleInput, PaddleInput] = [this.inputFor(0, human[0]), this.inputFor(1, human[1])];
      const { state, events } = stepPong(this.state, inputs);
      this.state = state;
      this.history.push({ t: this.clock, state });
      while (this.history.length > 0 && this.history[0]!.t < this.clock - HISTORY_SECONDS) this.history.shift();
      this.handle(events);
      if (state.result) {
        this.ended = true;
        this.options.onEnd(state.result);
        break;
      }
    }
    this.sync();
  }

  private readTouches(): [number | null, number | null] {
    const targets: [number | null, number | null] = [null, null];
    for (const pointer of this.input.manager.pointers) {
      if (!pointer.isDown) continue;
      const seat = seatForY(pointer.worldY, PONG_TABLE.height);
      if (this.options.seats[seat]?.kind === 'human') targets[seat] = pointer.worldX;
    }
    return targets;
  }

  private inputFor(seat: Seat, humanX: number | null): PaddleInput {
    const controller = this.options.seats[seat];
    if (controller?.kind !== 'bot') return { targetX: humanX, maxSpeed: HUMAN_SPEED };
    const tier = PONG_TIERS[controller.tier];
    // The bot sees the ball as it was a moment ago, but knows where both paddles are now.
    const cutoff = this.clock - tier.reactionMs / 1000;
    let seen = this.history[0]?.state ?? this.state;
    for (const entry of this.history) {
      if (entry.t > cutoff) break;
      seen = entry.state;
    }
    const view: PongState = { ...seen, paddles: this.state.paddles };
    return { targetX: pongBotTarget(view, seat, tier, this.noise[seat]), maxSpeed: tier.maxSpeed };
  }

  private play(name: SoundName, gap: number): void {
    if (this.clock - (this.lastSound[name] ?? -Infinity) < gap) return;
    this.lastSound[name] = this.clock;
    this.options.onCue(name);
  }

  private handle(events: PongEvents): void {
    if (events.hit) {
      this.play('hit', 0.05);
      // Squash the ball flat against the paddle, then let it spring back.
      this.tweens.add({ targets: this.ball, scaleX: 1.35, scaleY: 0.7, duration: 60, yoyo: true, ease: 'Quad.easeOut' });
      const seat: Seat = this.state.ball.vy < 0 ? 0 : 1;
      const paddle = this.paddles[seat];
      if (paddle) this.tweens.add({ targets: paddle, y: paddleY(seat) + (seat === 0 ? 8 : -8), duration: 60, yoyo: true, ease: 'Quad.easeOut' });
    }
    if (events.wall) this.play('wall', 0.06);
    if (events.point !== null) {
      const scorer = events.point;
      this.play('goal', 0.3);
      this.cameras.main.shake(200, 0.008);
      const text = this.scoreTexts[scorer];
      if (text) {
        text.setText(String(this.state.scores[scorer]));
        this.tweens.add({ targets: text, scale: 1.4, alpha: 0.9, duration: 180, yoyo: true, ease: 'Back.easeOut' });
      }
      this.trailPoints = [];
      this.options.onScore(this.state.scores);
    }
  }

  private sync(): void {
    const { ball, paddles } = this.state;
    this.ball.setPosition(ball.x, ball.y);
    paddles.forEach((x, seat) => this.paddles[seat]?.setX(x));

    this.trailPoints.push({ x: ball.x, y: ball.y });
    if (this.trailPoints.length > TRAIL_LENGTH) this.trailPoints.shift();
    this.trail.clear();
    if (Math.hypot(ball.vx, ball.vy) > 700 && this.state.freeze === 0) {
      this.trailPoints.forEach((p, i) => {
        const t = (i + 1) / this.trailPoints.length;
        this.trail.fillStyle(0xffffff, 0.35 * t);
        this.trail.fillCircle(p.x, p.y, BALL_RADIUS * (0.3 + 0.7 * t));
      });
    }
  }

  private drawCourt(): void {
    const { width: w, height: h } = PONG_TABLE;
    const g = this.add.graphics();
    g.fillStyle(COURT_LIP, 1);
    g.fillRoundedRect(0, 10, w, h - 10, 44);
    g.fillStyle(COURT, 1);
    g.fillRoundedRect(0, 0, w, h - 10, 44);
    g.lineStyle(6, 0xffffff, 0.9);
    g.strokeRoundedRect(22, 22, w - 44, h - 54, 30);
    g.lineStyle(4, 0xffffff, 0.8);
    g.lineBetween(w / 2, 26, w / 2, h - 36);
    // Dashed net across the middle.
    g.fillStyle(0xffffff, 1);
    for (let x = 24; x < w - 24; x += 34) g.fillRoundedRect(x, h / 2 - 4, 22, 8, 4);
  }
}
