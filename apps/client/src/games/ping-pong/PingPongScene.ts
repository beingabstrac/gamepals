import {
  createRng,
  isHittable,
  NET_HEIGHT,
  NET_Y,
  newPingPongGame,
  PING_PONG_TIERS,
  pingPongBotSwing,
  PP_CANVAS,
  PP_STEP,
  PP_TABLE,
  stepPingPong,
  swing,
  type BotNoise,
  type PingPongEvents,
  type PingPongState,
  type PointReason,
  type Rng,
  type Seat,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { COLORS, DARK, toHex } from '../../theme';
import type { RealtimeSceneOptions } from '../air-hockey/AirHockeyScene';
import { fitCamera, sharpText } from '../crisp';
import { facing, seatForY } from '../duel';

export const PING_PONG_SIZE = { width: PP_CANVAS.width, height: PP_CANVAS.height };

const W = PP_CANVAS.width;
const H = PP_CANVAS.height;
const TABLE = toHex(COLORS.sky);
const TABLE_EDGE = toHex(DARK.sky);
const SEAT_HEX = [toHex(COLORS.sky), toHex(COLORS.tomato)];
const SEAT_DARK = [toHex(DARK.sky), toHex(DARK.tomato)];
const BALL_RADIUS = 11;
/** How far up the screen the ball is drawn per unit of height (its shadow stays on the table). */
const LIFT = 0.45;
/** A drag of this many px toward the net counts as a swing. */
const SWIPE_DISTANCE = 45;
const BOT_SERVE_DELAY = 0.9;

const REASON_TEXT: Record<PointReason, string> = {
  missed: 'Missed it!',
  'double-bounce': 'Two bounces!',
  out: 'Out!',
  net: 'Net!',
  'own-side': 'Own side!',
  'bad-serve': 'Fault!',
};

interface Drag {
  readonly seat: Seat;
  readonly x: number;
  readonly y: number;
  readonly t: number;
  fired: boolean;
}

export class PingPongScene extends Scene {
  private state: PingPongState = newPingPongGame();
  private readonly rng: Rng;
  private accumulator = 0;
  private clock = 0;
  private serveWait = 0;
  private noise: [BotNoise, BotNoise];
  private lastHitter: Seat | null = null;
  private drags = new Map<number, Drag>();
  private fingerX: [number | null, number | null] = [null, null];
  private ended = false;

  private ball!: GameObjects.Container;
  private shadow!: GameObjects.Ellipse;
  private paddles: GameObjects.Container[] = [];
  private scoreTexts: GameObjects.Text[] = [];
  private callout!: GameObjects.Text;
  private serveHint!: GameObjects.Text;

  constructor(private readonly options: RealtimeSceneOptions) {
    super('ping-pong');
    this.rng = createRng(options.seed);
    this.noise = [this.roll(), this.roll()];
  }

  private roll(): BotNoise {
    return [this.rng.next() * 2 - 1, this.rng.next() * 2 - 1, this.rng.next() * 2 - 1, this.rng.next() * 2 - 1];
  }

  create(): void {
    fitCamera(this, W, H);
    this.input.addPointer(3);
    this.drawTable();

    this.scoreTexts = [0, 1].map((seat) =>
      sharpText(this, W / 2, seat === 0 ? H * 0.7 : H * 0.3, '0', 110, '#ffffff')
        .setAlpha(0.45)
        .setAngle(facing(this.options.seats, seat as Seat)),
    );

    this.shadow = this.add.ellipse(0, 0, BALL_RADIUS * 2.2, BALL_RADIUS * 1.4, 0x2b2a3a, 0.22);
    this.paddles = [0, 1].map((seat) => this.makePaddle(seat as Seat));
    this.ball = this.add.container(0, 0, [this.add.circle(0, 0, BALL_RADIUS, 0xffffff).setStrokeStyle(3, 0xffe9b8)]).setDepth(5);

    this.callout = sharpText(this, W / 2, NET_Y, '', 54, COLORS.ink).setDepth(8).setAlpha(0);
    this.serveHint = sharpText(this, W / 2, H - 40, 'Swipe up to serve', 28, COLORS.ink).setAlpha(0.7);
    this.tweens.add({ targets: this.serveHint, alpha: 0.25, duration: 600, yoyo: true, repeat: -1 });

    this.input.on('pointerdown', (p: { id: number; worldX: number; worldY: number }) => {
      const seat = seatForY(p.worldY, H);
      if (this.options.seats[seat]?.kind !== 'human') return;
      this.drags.set(p.id, { seat, x: p.worldX, y: p.worldY, t: this.clock, fired: false });
      this.fingerX[seat] = p.worldX;
    });
    this.input.on('pointermove', (p: { id: number; worldX: number; worldY: number }) => {
      const drag = this.drags.get(p.id);
      if (!drag) return;
      this.fingerX[drag.seat] = p.worldX;
      if (drag.fired) return;
      const toward = drag.seat === 0 ? drag.y - p.worldY : p.worldY - drag.y;
      if (toward < SWIPE_DISTANCE) return;
      drag.fired = true;
      const elapsed = Math.max(this.clock - drag.t, 0.03);
      const dx = p.worldX - drag.x;
      const speed = Math.hypot(dx, p.worldY - drag.y) / elapsed;
      this.swing(drag.seat, { aim: dx / 160, power: Math.min(Math.max(speed / 2400, 0.15), 1) });
    });
    const release = (p: { id: number }) => this.drags.delete(p.id);
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);

    this.sync();
  }

  private makePaddle(seat: Seat): GameObjects.Container {
    const blade = this.add.graphics();
    blade.fillStyle(0xc98f5a, 1);
    blade.fillRoundedRect(-7, 20, 14, 38, 7);
    blade.fillStyle(SEAT_DARK[seat]!, 1);
    blade.fillCircle(0, 4, 34);
    blade.fillStyle(SEAT_HEX[seat]!, 1);
    blade.fillCircle(0, 0, 34);
    blade.fillStyle(0xffffff, 0.25);
    blade.fillCircle(-10, -10, 10);
    const y = seat === 0 ? PP_TABLE.y1 + 40 : PP_TABLE.y0 - 40;
    return this.add.container(W / 2, y, [blade]).setAngle(seat === 1 ? 180 : 0).setDepth(6);
  }

  private swing(seat: Seat, input: { aim: number; power: number }): void {
    const before = this.state;
    const wasServe = before.phase === 'serve';
    this.state = swing(this.state, seat, input);
    const paddle = this.paddles[seat];
    if (!paddle) return;
    // The paddle always swings, so a whiff is visible too.
    const base = seat === 1 ? 180 : 0;
    this.tweens.killTweensOf(paddle);
    paddle.setAngle(base).setScale(1);
    this.tweens.add({ targets: paddle, angle: base + (input.aim >= 0 ? 28 : -28), scale: 1.15, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
    if (this.state !== before) {
      this.options.onCue('hit');
      if (wasServe) this.serveHint.setVisible(false);
      this.tweens.add({ targets: this.ball, scaleX: 1.3, scaleY: 0.75, duration: 60, yoyo: true });
    }
  }

  update(_time: number, delta: number): void {
    if (this.ended) return;
    this.accumulator += Math.min(delta, 100) / 1000;

    while (this.accumulator >= PP_STEP) {
      this.accumulator -= PP_STEP;
      this.clock += PP_STEP;
      this.runBots();
      const { state, events } = stepPingPong(this.state);
      this.state = state;
      if (state.lastHitter !== this.lastHitter) {
        this.lastHitter = state.lastHitter;
        this.noise = [this.roll(), this.roll()];
      }
      this.handle(events);
      if (state.result) {
        this.ended = true;
        this.options.onEnd(state.result);
        break;
      }
    }
    this.sync();
  }

  private runBots(): void {
    if (this.state.phase === 'serve') this.serveWait += PP_STEP;
    else this.serveWait = 0;
    for (const seat of [0, 1] as Seat[]) {
      const controller = this.options.seats[seat];
      if (controller?.kind !== 'bot') continue;
      if (this.state.phase === 'serve' && this.serveWait < BOT_SERVE_DELAY) continue;
      const decision = pingPongBotSwing(this.state, seat, PING_PONG_TIERS[controller.tier], this.noise[seat]);
      if (decision) this.swing(seat, decision);
    }
  }

  private handle(events: PingPongEvents): void {
    if (events.bounce) {
      this.options.onCue('wall');
      this.tweens.add({ targets: this.ball, scaleX: 1.25, scaleY: 0.8, duration: 50, yoyo: true });
    }
    if (events.let) this.say('Let! Serve again', this.state.server);
    if (events.point !== null) {
      const winner = events.point;
      this.options.onCue(events.net ? 'buzz' : 'goal');
      this.cameras.main.shake(160, 0.005);
      const text = this.scoreTexts[winner];
      if (text) {
        text.setText(String(this.state.scores[winner]));
        this.tweens.add({ targets: text, scale: 1.35, alpha: 0.85, duration: 180, yoyo: true, ease: 'Back.easeOut' });
      }
      const reason = this.state.lastPoint?.reason;
      if (reason) this.say(REASON_TEXT[reason], winner);
      this.options.onScore(this.state.scores);
    }
  }

  /** A short call-out facing the player it's for. */
  private say(text: string, towardSeat: Seat): void {
    this.tweens.killTweensOf(this.callout);
    this.callout.setText(text).setAngle(facing(this.options.seats, towardSeat)).setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: this.callout, scale: 1, duration: 280, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.callout, alpha: 0, delay: 800, duration: 300 });
  }

  private sync(): void {
    const { ball, phase, server } = this.state;
    this.shadow.setPosition(ball.x, ball.y).setAlpha(Math.max(0.08, 0.22 - ball.z / 1500));
    this.ball.setPosition(ball.x, ball.y - ball.z * LIFT);
    const lift = 1 + ball.z / 500;
    if (!this.tweens.isTweening(this.ball)) this.ball.setScale(lift);

    this.serveHint.setVisible(phase === 'serve' && this.options.seats[server]?.kind === 'human');
    this.serveHint.setPosition(W / 2, server === 0 ? H - 22 : 22).setAngle(facing(this.options.seats, server));

    // Paddles: people's follow their finger; bots glide toward the ball.
    for (const seat of [0, 1] as Seat[]) {
      const paddle = this.paddles[seat];
      if (!paddle) continue;
      const controller = this.options.seats[seat];
      let targetX: number;
      if (controller?.kind === 'bot') targetX = isHittable(this.state, seat) || phase === 'rally' ? ball.x : W / 2;
      else targetX = this.fingerX[seat] ?? W / 2;
      paddle.setX(paddle.x + (Math.min(Math.max(targetX, 60), W - 60) - paddle.x) * 0.25);
    }
  }

  private drawTable(): void {
    const g = this.add.graphics();
    const { x0, x1, y0, y1 } = PP_TABLE;
    g.fillStyle(TABLE_EDGE, 1);
    g.fillRoundedRect(x0, y0 + 10, x1 - x0, y1 - y0, 16);
    g.fillStyle(TABLE, 1);
    g.fillRoundedRect(x0, y0, x1 - x0, y1 - y0, 16);
    g.lineStyle(6, 0xffffff, 1);
    g.strokeRoundedRect(x0 + 3, y0 + 3, x1 - x0 - 6, y1 - y0 - 6, 14);
    g.lineStyle(3, 0xffffff, 0.8);
    g.lineBetween((x0 + x1) / 2, y0 + 6, (x0 + x1) / 2, y1 - 6);

    // Net: a band across the middle with posts; its height is shown by a soft shadow.
    g.fillStyle(0x2b2a3a, 0.12);
    g.fillRect(x0 - 16, NET_Y + 2, x1 - x0 + 32, 12);
    g.fillStyle(0xf4f1ff, 1);
    g.fillRect(x0 - 16, NET_Y - NET_HEIGHT * LIFT, x1 - x0 + 32, NET_HEIGHT * LIFT);
    g.fillStyle(0x2b2a3a, 0.85);
    g.fillRect(x0 - 16, NET_Y - NET_HEIGHT * LIFT, x1 - x0 + 32, 4);
    g.fillStyle(toHex(COLORS.ink), 1);
    g.fillRoundedRect(x0 - 22, NET_Y - NET_HEIGHT * LIFT - 4, 10, NET_HEIGHT * LIFT + 8, 4);
    g.fillRoundedRect(x1 + 12, NET_Y - NET_HEIGHT * LIFT - 4, 10, NET_HEIGHT * LIFT + 8, 4);
  }
}
