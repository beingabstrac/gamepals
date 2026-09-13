import {
  createRng,
  GOAL_CENTER_X,
  GOAL_HALF_WIDTH,
  GOAL_LINE_Y,
  keeperFor,
  KEEPER_BODY,
  kickerFor,
  newPenaltyGame,
  PENALTY_TIERS,
  penaltyBotDive,
  penaltyBotShot,
  penaltyDive,
  penaltyKeeperTarget,
  penaltyShoot,
  PK_CANVAS,
  PK_STEP,
  shotHeight,
  shotX,
  SPOT_Y,
  stepPenalty,
  type KickOutcome,
  type PenaltyState,
  type Rng,
  type Seat,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { COLORS, DARK, toHex } from '../../theme';
import type { RealtimeSceneOptions } from '../air-hockey/AirHockeyScene';
import { fitCamera, sharpText } from '../crisp';
import { seatForY } from '../duel';

export const PENALTY_SIZE = { width: PK_CANVAS.width, height: PK_CANVAS.height };

const W = PK_CANVAS.width;
const H = PK_CANVAS.height;
const GRASS = [0x8fe0a5, 0x7fd598];
const SEAT_HEX = [toHex(COLORS.sky), toHex(COLORS.tomato)];
const SEAT_DARK = [toHex(DARK.sky), toHex(DARK.tomato)];
const GOAL_DEPTH = 40;
const LIFT = 70;
const BOT_SHOT_DELAY = 1.1;

const OUTCOME_TEXT: Record<KickOutcome, string> = {
  goal: 'GOAL!',
  saved: 'Saved!',
  post: 'Off the post!',
  over: 'Over the bar!',
  wide: 'Wide!',
  'too-slow': 'Too slow!',
};

interface Drag {
  readonly seat: Seat;
  readonly x: number;
  readonly y: number;
  readonly t: number;
  fired: boolean;
}

export class PenaltyScene extends Scene {
  private state: PenaltyState = newPenaltyGame();
  private readonly rng: Rng;
  private accumulator = 0;
  private clock = 0;
  private aimTime = 0;
  private sinceKick = 0;
  private botRead = 0;
  private botDelay = BOT_SHOT_DELAY;
  private drags = new Map<number, Drag>();
  private ended = false;

  private goals: GameObjects.Container[] = [];
  private keeper!: GameObjects.Container;
  private kicker!: GameObjects.Container;
  private ball!: GameObjects.Container;
  private shadow!: GameObjects.Ellipse;
  private dots!: GameObjects.Graphics;
  private callout!: GameObjects.Text;
  private hints: GameObjects.Text[] = [];

  constructor(private readonly options: RealtimeSceneOptions) {
    super('penalty-kicks');
    this.rng = createRng(options.seed);
  }

  create(): void {
    fitCamera(this, W, H);
    this.input.addPointer(3);
    this.drawPitch();
    this.goals = [0, 1].map((seat) => this.makeGoal(seat as Seat));
    this.dots = this.add.graphics();
    this.shadow = this.add.ellipse(0, 0, 26, 14, 0x2b2a3a, 0.2);
    this.keeper = this.add.container(0, 0).setDepth(4);
    this.kicker = this.add.container(0, 0).setDepth(3);
    this.ball = this.add.container(0, 0, this.makeBall()).setDepth(6);
    this.callout = sharpText(this, W / 2, H / 2, '', 64, COLORS.ink).setDepth(10).setAlpha(0);
    this.hints = [0, 1].map((seat) => sharpText(this, W / 2, seat === 0 ? H - 30 : 30, '', 24, COLORS.ink).setAlpha(0.75).setAngle(seat === 1 ? 180 : 0));

    this.input.on('pointerdown', (p: { id: number; worldX: number; worldY: number }) => {
      const seat = seatForY(p.worldY, H);
      if (this.options.seats[seat]?.kind !== 'human') return;
      this.drags.set(p.id, { seat, x: p.worldX, y: p.worldY, t: this.clock, fired: false });
      if (seat === keeperFor(this.state.kicks.length)) this.state = penaltyKeeperTarget(this.state, seat, p.worldX);
    });
    this.input.on('pointermove', (p: { id: number; worldX: number; worldY: number }) => this.onMove(p));
    const release = (p: { id: number }) => this.drags.delete(p.id);
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);

    this.setupKick();
    this.options.onScore([0, 0]);
  }

  private onMove(p: { id: number; worldX: number; worldY: number }): void {
    const drag = this.drags.get(p.id);
    if (!drag) return;
    const kickIndex = this.state.kicks.length;
    const dx = p.worldX - drag.x;
    const dy = p.worldY - drag.y;
    const elapsed = Math.max(this.clock - drag.t, 0.03);

    if (drag.seat === keeperFor(kickIndex)) {
      // Keeper: drag to shuffle; a fast sideways flick commits to a dive.
      if (!drag.fired && Math.abs(dx) > 40 && Math.abs(dx) / elapsed > 900) {
        drag.fired = true;
        this.state = penaltyDive(this.state, drag.seat, dx > 0 ? 1 : -1);
      } else {
        this.state = penaltyKeeperTarget(this.state, drag.seat, p.worldX);
      }
      return;
    }

    if (drag.seat === kickerFor(kickIndex) && !drag.fired) {
      // Kicker: swipe toward the goal. Direction picks where it crosses the goal line; speed is power.
      const toward = drag.seat === 0 ? -dy : dy;
      if (toward < 50) return;
      drag.fired = true;
      const keeper = keeperFor(kickIndex);
      const distance = Math.abs(GOAL_LINE_Y[keeper] - SPOT_Y[keeper]);
      const crossX = GOAL_CENTER_X + (dx / Math.abs(dy)) * distance;
      const speed = Math.hypot(dx, dy) / elapsed;
      this.shoot(drag.seat, { aim: (crossX - GOAL_CENTER_X) / GOAL_HALF_WIDTH, power: Math.min(Math.max(speed / 2600, 0.2), 1), curl: 0 });
    }
  }

  private shoot(seat: Seat, shot: { aim: number; power: number; curl: number }): void {
    const before = this.state;
    this.state = penaltyShoot(this.state, seat, shot);
    if (this.state === before) return;
    this.sinceKick = 0;
    this.options.onCue('hit');
    for (const hint of this.hints) hint.setText('');
    // Kicker lunges into the ball.
    const dir = seat === 0 ? -1 : 1;
    this.tweens.add({ targets: this.kicker, y: this.kicker.y + dir * 26, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
  }

  /** Places the kicker, keeper and ball for the next kick and shows whose turn it is. */
  private setupKick(): void {
    const index = this.state.kicks.length;
    const keeper = keeperFor(index);
    const kicker = kickerFor(index);
    this.aimTime = 0;
    this.botDelay = BOT_SHOT_DELAY + this.rng.next() * 0.8;
    this.botRead = this.rng.next();

    this.keeper.removeAll(true).add(this.makeBlob(keeper, true)).setAngle(keeper === 1 ? 180 : 0).setScale(1);
    this.kicker.removeAll(true).add(this.makeBlob(kicker, false)).setAngle(kicker === 1 ? 180 : 0).setScale(1);
    this.kicker.setPosition(GOAL_CENTER_X + 30, SPOT_Y[keeper] + (keeper === 1 ? 70 : -70));
    this.goals.forEach((goal, seat) => this.tweens.add({ targets: goal, alpha: seat === keeper ? 1 : 0.35, duration: 300 }));

    const kickerHuman = this.options.seats[kicker]?.kind === 'human';
    const keeperHuman = this.options.seats[keeper]?.kind === 'human';
    this.hints[kicker]?.setText(kickerHuman ? 'Swipe toward the goal to shoot' : '');
    this.hints[keeper]?.setText(keeperHuman ? 'Drag to move · flick to dive' : '');
    this.say(kickerHuman ? 'Your kick!' : `${this.options.seats[kicker]?.label ?? 'Bot'} to kick`, kicker, false);
    this.drawDots();
    this.sync();
  }

  update(_time: number, delta: number): void {
    if (this.ended) return;
    this.accumulator += Math.min(delta, 100) / 1000;
    while (this.accumulator >= PK_STEP) {
      this.accumulator -= PK_STEP;
      this.clock += PK_STEP;
      this.runBots();
      const before = this.state;
      const { state, events } = stepPenalty(this.state);
      this.state = state;
      if (before.phase === 'flight') this.sinceKick += PK_STEP;
      if (events.outcome) this.onOutcome(events.outcome);
      if (before.phase === 'result' && state.phase === 'aim') this.setupKick();
      if (state.result && state.phase === 'result' && !this.ended && before.phase !== 'result') {
        this.ended = true;
        this.time.delayedCall(1200, () => this.options.onEnd(state.result!));
      }
    }
    this.sync();
  }

  private runBots(): void {
    const index = this.state.kicks.length;
    const kicker = kickerFor(index);
    const keeper = keeperFor(index);
    const kickerBot = this.options.seats[kicker];
    const keeperBot = this.options.seats[keeper];
    if (this.state.phase === 'aim') {
      this.aimTime += PK_STEP;
      if (kickerBot?.kind === 'bot' && this.aimTime >= this.botDelay) {
        const noise: [number, number, number] = [this.rng.next() * 2 - 1, this.rng.next() * 2 - 1, this.rng.next() * 2 - 1];
        this.shoot(kicker, penaltyBotShot(PENALTY_TIERS[kickerBot.tier], noise));
      }
    }
    if (keeperBot?.kind === 'bot' && this.state.phase === 'flight') {
      const dive = penaltyBotDive(this.state, PENALTY_TIERS[keeperBot.tier], this.botRead, this.sinceKick);
      if (dive !== 0) this.state = penaltyDive(this.state, keeper, dive);
    }
  }

  private onOutcome(outcome: KickOutcome): void {
    const kicker = kickerFor(this.state.kicks.length - 1);
    const keeper = kicker === 0 ? 1 : 0;
    this.say(OUTCOME_TEXT[outcome], outcome === 'saved' ? keeper : kicker, true);
    if (outcome === 'goal') {
      this.options.onCue('goal');
      const goal = this.goals[keeper];
      // The net bulges and wobbles.
      if (goal) this.tweens.add({ targets: goal, scaleY: 1.12, duration: 90, yoyo: true, repeat: 2, ease: 'Sine.easeInOut' });
      this.cameras.main.shake(180, 0.006);
    } else if (outcome === 'saved') {
      this.options.onCue('thud');
    } else if (outcome === 'post') {
      this.options.onCue('clang');
      this.cameras.main.shake(140, 0.005);
    } else {
      this.options.onCue('buzz');
    }
    this.drawDots();
    const goals = [0, 1].map((seat) => this.state.kicks.filter((k) => k.kicker === seat && k.outcome === 'goal').length);
    this.options.onScore(goals);
  }

  private say(text: string, towardSeat: Seat, big: boolean): void {
    this.tweens.killTweensOf(this.callout);
    this.callout
      .setText(text)
      .setFontSize(big ? 64 : 40)
      .setAngle(towardSeat === 1 ? 180 : 0)
      .setAlpha(1)
      .setScale(0.6);
    this.tweens.add({ targets: this.callout, scale: 1, duration: 280, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.callout, alpha: 0, delay: big ? 1000 : 900, duration: 300 });
  }

  private sync(): void {
    const index = this.state.kicks.length;
    const keeper = this.state.phase === 'result' ? keeperFor(index - 1) : keeperFor(index);
    const lineY = GOAL_LINE_Y[keeper];
    const spotY = SPOT_Y[keeper];

    // Keeper on the line; a dive tips the body over sideways.
    const diveAngle = this.state.dive * Math.min(this.state.diveT / 0.2, 1) * 75;
    this.keeper.setPosition(this.state.keeperX, lineY + (keeper === 1 ? 26 : -26));
    this.keeper.setAngle((keeper === 1 ? 180 : 0) + (keeper === 1 ? -diveAngle : diveAngle));

    const shot = this.state.shot;
    if (!shot || this.state.phase === 'aim') {
      this.ball.setPosition(GOAL_CENTER_X, spotY).setScale(1);
      this.shadow.setPosition(GOAL_CENTER_X, spotY + 4);
      return;
    }
    // Ball flies from the spot to the goal line, bending with curl and rising with its height.
    const t = Math.min(this.state.flightT / this.state.flightDuration, this.state.phase === 'result' ? 1 : 0.999);
    const endX = shotX(shot);
    const bend = Math.sin(Math.PI * t) * shot.curl * 40;
    const x = GOAL_CENTER_X + (endX - GOAL_CENTER_X) * t + bend;
    const y = spotY + (lineY - spotY) * t;
    const height = shotHeight(shot.power) * t;
    this.shadow.setPosition(x, y + 4);
    this.ball.setPosition(x, y - height * LIFT).setScale(1 + height * 0.4);
    this.ball.setRotation(this.clock * 14 * shot.power);
  }

  private drawDots(): void {
    const g = this.dots;
    g.clear();
    for (const seat of [0, 1] as Seat[]) {
      const own = this.state.kicks.filter((k) => k.kicker === seat);
      const slots = Math.max(5, own.length);
      const y = seat === 0 ? H / 2 + 50 : H / 2 - 50;
      for (let i = 0; i < slots; i++) {
        const x = 40 + i * 30;
        const outcome = own[i]?.outcome;
        g.fillStyle(outcome === undefined ? 0xffffff : outcome === 'goal' ? toHex(COLORS.mint) : toHex(COLORS.tomato), outcome === undefined ? 0.5 : 1);
        g.fillCircle(seat === 0 ? x : W - x, y, 10);
        g.lineStyle(3, SEAT_HEX[seat]!, 1);
        g.strokeCircle(seat === 0 ? x : W - x, y, 10);
      }
    }
  }

  private makeBall(): GameObjects.GameObject[] {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(0, 0, 12);
    g.lineStyle(2, 0xd9d3ea, 1);
    g.strokeCircle(0, 0, 12);
    g.fillStyle(0x2b2a3a, 1);
    g.fillCircle(0, 0, 4);
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5;
      g.fillCircle(Math.cos(angle) * 8.5, Math.sin(angle) * 8.5, 2.4);
    }
    return [g];
  }

  /** A round player; keepers wear big white gloves. */
  private makeBlob(seat: Seat, keeper: boolean): GameObjects.Graphics {
    const g = this.add.graphics();
    g.fillStyle(0x2b2a3a, 0.14);
    g.fillEllipse(0, 6, 64, 40);
    if (keeper) {
      g.fillStyle(0xffffff, 1);
      g.fillCircle(-KEEPER_BODY - 8, -4, 13);
      g.fillCircle(KEEPER_BODY + 8, -4, 13);
      g.lineStyle(3, SEAT_DARK[seat]!, 1);
      g.strokeCircle(-KEEPER_BODY - 8, -4, 13);
      g.strokeCircle(KEEPER_BODY + 8, -4, 13);
    }
    g.fillStyle(SEAT_DARK[seat]!, 1);
    g.fillCircle(0, 4, 30);
    g.fillStyle(SEAT_HEX[seat]!, 1);
    g.fillCircle(0, 0, 30);
    g.fillStyle(0x2b2a3a, 1);
    g.fillCircle(-10, -6, 4.5);
    g.fillCircle(10, -6, 4.5);
    g.lineStyle(3.5, 0x2b2a3a, 1);
    g.beginPath();
    g.arc(0, 4, 8, 0.3, Math.PI - 0.3, false);
    g.strokePath();
    return g;
  }

  private makeGoal(keeper: Seat): GameObjects.Container {
    const g = this.add.graphics();
    const back = keeper === 1 ? -GOAL_DEPTH : GOAL_DEPTH;
    const x0 = GOAL_CENTER_X - GOAL_HALF_WIDTH;
    const x1 = GOAL_CENTER_X + GOAL_HALF_WIDTH;
    g.fillStyle(0xf4f1ff, 0.9);
    g.fillRect(x0, Math.min(0, back), x1 - x0, Math.abs(back));
    g.lineStyle(1.5, 0xc9c2e6, 1);
    for (let x = x0 + 15; x < x1; x += 15) g.lineBetween(x, 0, x, back);
    for (let d = 10; d < Math.abs(back); d += 10) g.lineBetween(x0, Math.sign(back) * d, x1, Math.sign(back) * d);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(x0 - 8, Math.min(0, back) - 4, 12, Math.abs(back) + 8, 6);
    g.fillRoundedRect(x1 - 4, Math.min(0, back) - 4, 12, Math.abs(back) + 8, 6);
    g.fillRect(x0 - 4, -3, x1 - x0 + 8, 6);
    return this.add.container(0, GOAL_LINE_Y[keeper], [g]).setDepth(2);
  }

  private drawPitch(): void {
    const g = this.add.graphics();
    for (let y = 0, i = 0; y < H; y += 90, i++) {
      g.fillStyle(GRASS[i % 2]!, 1);
      g.fillRect(0, y, W, 90);
    }
    g.lineStyle(5, 0xffffff, 0.9);
    g.lineBetween(0, H / 2, W, H / 2);
    g.strokeCircle(W / 2, H / 2, 70);
    for (const keeper of [0, 1] as Seat[]) {
      const line = GOAL_LINE_Y[keeper];
      const dir = keeper === 1 ? 1 : -1;
      g.lineBetween(20, line, W - 20, line);
      g.strokeRect(70, Math.min(line, line + dir * 210), W - 140, 210);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(GOAL_CENTER_X, SPOT_Y[keeper], 6);
    }
  }
}
