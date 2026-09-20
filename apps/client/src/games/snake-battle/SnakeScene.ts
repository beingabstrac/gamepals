import {
  createRng,
  GRID,
  newSnakeGame,
  SNAKE_STEP,
  SNAKE_TIERS,
  snakeBotTurn,
  snakeTurn,
  stepSnake,
  type GridCell,
  type Dir,
  type Rng,
  type Seat,
  type SnakeEvents,
  type SnakeState,
  type Turn,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { COLORS, DARK, toHex } from '../../theme';
import type { RealtimeSceneOptions } from '../air-hockey/AirHockeyScene';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed, SPEED } from '../../autoplay';
import { onDuelKeys } from '../duel';
const W = 600;
const H = 900;
export const SNAKE_SIZE = { width: W, height: H };

const CELL = 30;
const BOARD_X = (W - GRID.cols * CELL) / 2;
const BOARD_Y = (H - GRID.rows * CELL) / 2;
const TILE = [0xb3efcc, 0xa2e8bf];
const SEAT_HEX = [toHex(COLORS.sky), toHex(COLORS.tomato)];
const SEAT_DARK = [toHex(DARK.sky), toHex(DARK.tomato)];
const BUTTON_RADIUS = 40;

/** Center of a grid cell in canvas pixels. */
const px = (c: GridCell) => ({ x: BOARD_X + (c.x + 0.5) * CELL, y: BOARD_Y + (c.y + 0.5) * CELL });
const smooth = (t: number) => t * t * (3 - 2 * t);

interface TurnButton {
  readonly seat: Seat;
  readonly turn: Turn;
  readonly x: number;
  readonly y: number;
  readonly view: GameObjects.Container;
}

export class SnakeScene extends Scene {
  private state: SnakeState;
  private readonly rng: Rng;
  private accumulator = 0;
  private lastTicks = -1;
  private ended = false;

  private snakes!: GameObjects.Graphics;
  private fruit!: GameObjects.Container;
  private banner!: GameObjects.Text;
  private buttons: TurnButton[] = [];

  constructor(private readonly options: RealtimeSceneOptions) {
    super('snake-battle');
    this.rng = createRng(options.seed);
    this.state = newSnakeGame(options.seed);
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.input.addPointer(3);
    this.drawBoard();
    this.snakes = this.add.graphics().setDepth(3);
    this.fruit = this.makeFruit();
    this.banner = sharpText(this, W / 2, H / 2, '', 64, COLORS.ink).setDepth(10);
    this.makeButtons();
    this.showCountdown();

    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      for (const button of this.buttons) {
        if (Math.hypot(p.worldX - button.x, p.worldY - button.y) > BUTTON_RADIUS + 14) continue;
        if (this.options.seats[button.seat]?.kind !== 'human') return;
        this.steer(button.seat, button.turn);
        return;
      }
    });
    // Keyboard: the arrow keys steer the bottom snake, A and D the top one.
    onDuelKeys(this, this.options.seats, (seat, action) => {
      if (action === 'left') this.steer(seat, -1);
      if (action === 'right') this.steer(seat, 1);
    });

    this.options.onScore([0, 0]);
    this.draw(1);
  }

  update(_time: number, delta: number): void {
    if (this.ended) return;
    this.accumulator += Math.min(delta, 100) * SPEED / 1000;
    while (this.accumulator >= SNAKE_STEP) {
      this.accumulator -= SNAKE_STEP;
      const before = this.state;
      const { state, events } = stepSnake(this.state);
      this.state = state;
      if (before.phase === 'roundOver' && state.phase === 'countdown') this.showCountdown();
      if (before.phase === 'countdown' && state.phase === 'play') this.shout('Go!');
      this.handle(events);
      this.runBots();
      if (state.result && state.phase === 'roundOver') {
        this.ended = true;
        this.time.delayedCall(900, () => this.options.onEnd(state.result!));
        break;
      }
    }
    const progress = this.state.phase === 'play' ? Math.min(this.state.tickTimer / this.state.interval, 1) : 1;
    this.draw(smooth(progress));
  }

  /** Bots decide once per move, right after each tick (and at the start of play). */
  private runBots(): void {
    if (this.state.phase !== 'play' || this.state.ticks === this.lastTicks) return;
    this.lastTicks = this.state.ticks;
    for (const seat of [0, 1] as Seat[]) {
      const controller = this.options.seats[seat];
      if (controller?.kind !== 'bot') continue;
      const turn = snakeBotTurn(this.state, seat, SNAKE_TIERS[controller.tier], this.rng.next(), this.rng.next() * 2 - 1);
      if (turn !== 0) this.state = snakeTurn(this.state, seat, turn);
    }
  }

  private handle(events: SnakeEvents): void {
    if (events.ate[0] || events.ate[1]) {
      this.options.onCue('place');
      this.popFruit();
    }
    if (events.roundOver) {
      const round = this.state.lastRound;
      this.options.onCue('thud');
      this.cameras.main.shake(260, 0.01);
      if (round) {
        this.shout(round.winner === null ? 'Head-on!' : this.state.result ? 'Winner!' : 'Crash!');
        this.options.onScore(this.state.rounds);
      }
    }
  }

  private popFruit(): void {
    this.fruit.setScale(0);
    this.tweens.add({ targets: this.fruit, scale: 1, duration: 360, ease: 'Back.easeOut' });
  }

  private showCountdown(): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(`Round ${this.state.rounds[0] + this.state.rounds[1] + 1}`).setAlpha(1).setScale(0.7);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 360, ease: 'Back.easeOut' });
    this.popFruit();
  }

  private shout(text: string): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: this.banner, scale: 1.1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 600, duration: 300 });
  }

  /** Draws both snakes gliding `t` (0–1) of the way from their previous cells to their current ones. */
  private draw(t: number): void {
    const g = this.snakes;
    g.clear();
    const { snakes, previous, phase, lastRound } = this.state;
    const pos = px(this.state.fruit);
    this.fruit.setPosition(pos.x, pos.y);

    snakes.forEach((snake, seat) => {
      const prev = previous[seat]!;
      const points = snake.body.map((cell, i) => {
        const from = px(prev[Math.min(i, prev.length - 1)] ?? cell);
        const to = px(cell);
        return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
      });
      const crashed = phase === 'roundOver' && lastRound?.crashed[seat];
      const color = crashed ? 0xb9b6c9 : SEAT_HEX[seat]!;
      const dark = crashed ? 0x9b98ad : SEAT_DARK[seat]!;

      // A rounded tube: thick joined strokes plus round joints, tapering toward the tail.
      for (let i = points.length - 1; i > 0; i--) {
        const a = points[i]!;
        const b = points[i - 1]!;
        const width = CELL * (0.62 + 0.2 * (1 - i / points.length));
        g.lineStyle(width + 6, dark, 1);
        g.lineBetween(a.x, a.y + 3, b.x, b.y + 3);
        g.lineStyle(width, color, 1);
        g.lineBetween(a.x, a.y, b.x, b.y);
        g.fillStyle(color, 1);
        g.fillCircle(a.x, a.y, width / 2);
      }

      const head = points[0]!;
      g.fillStyle(dark, 1);
      g.fillCircle(head.x, head.y + 3, CELL * 0.5);
      g.fillStyle(color, 1);
      g.fillCircle(head.x, head.y, CELL * 0.5);
      this.drawFace(g, head, snake.dir, crashed ?? false);
    });
  }

  private drawFace(g: GameObjects.Graphics, head: { x: number; y: number }, dir: Dir, crashed: boolean): void {
    const fx = [0, 1, 0, -1][dir]!;
    const fy = [-1, 0, 1, 0][dir]!;
    const sx = -fy;
    const sy = fx;
    for (const side of [-1, 1]) {
      const ex = head.x + fx * 5 + sx * side * 7;
      const ey = head.y + fy * 5 + sy * side * 7;
      g.fillStyle(0xffffff, 1);
      g.fillCircle(ex, ey, 5.5);
      g.fillStyle(0x2b2a3a, 1);
      if (crashed) {
        g.lineStyle(2.5, 0x2b2a3a, 1);
        g.lineBetween(ex - 3, ey - 3, ex + 3, ey + 3);
        g.lineBetween(ex + 3, ey - 3, ex - 3, ey + 3);
      } else {
        g.fillCircle(ex + fx * 1.5, ey + fy * 1.5, 2.8);
      }
    }
  }

  private makeFruit(): GameObjects.Container {
    const g = this.add.graphics();
    g.fillStyle(toHex(DARK.tomato), 1);
    g.fillCircle(0, 3, 12);
    g.fillStyle(toHex(COLORS.tomato), 1);
    g.fillCircle(0, 0, 12);
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(-4, -4, 3.5);
    g.fillStyle(toHex(COLORS.mint), 1);
    g.fillEllipse(6, -12, 12, 6);
    return this.add.container(0, 0, [g]).setDepth(2);
  }

  /** Two big turn buttons in each player's corners; the top player's left is the screen's right. */
  /** Turn a snake by tap or key, and press the matching button so it's clear what happened. */
  private steer(seat: Seat, turn: Turn): void {
    this.state = snakeTurn(this.state, seat, turn);
    this.options.onCue('tap');
    const button = this.buttons.find((b) => b.seat === seat && b.turn === turn);
    if (!button) return;
    // Scale each axis on its own: left buttons are mirrored (scaleX -1), and tweening the combined
    // `scale` averaged that to 0, so left buttons vanished after the first press.
    const view = button.view;
    const baseX = Math.sign(view.scaleX) || 1;
    this.tweens.killTweensOf(view);
    view.setScale(baseX, 1);
    this.tweens.add({ targets: view, scaleX: baseX * 0.86, scaleY: 0.86, duration: 70, yoyo: true, ease: 'Quad.easeOut' });
  }

  private makeButtons(): void {
    const specs: { seat: Seat; turn: Turn; x: number; y: number }[] = [
      { seat: 0, turn: -1, x: 70, y: H - 46 },
      { seat: 0, turn: 1, x: W - 70, y: H - 46 },
      { seat: 1, turn: -1, x: W - 70, y: 46 },
      { seat: 1, turn: 1, x: 70, y: 46 },
    ];
    this.buttons = specs.map((spec) => {
      const g = this.add.graphics();
      g.fillStyle(SEAT_DARK[spec.seat]!, 1);
      g.fillCircle(0, 5, BUTTON_RADIUS);
      g.fillStyle(SEAT_HEX[spec.seat]!, 1);
      g.fillCircle(0, 0, BUTTON_RADIUS);
      // A curved arrow showing which way the snake will turn.
      g.lineStyle(7, 0xffffff, 1);
      g.beginPath();
      const flip = spec.turn;
      g.arc(0, 4, 16, Math.PI * 1.1, Math.PI * 1.9, false);
      g.strokePath();
      const tipX = flip === 1 ? 14 : -14;
      g.fillStyle(0xffffff, 1);
      g.fillTriangle(tipX - 8, -6, tipX + 8, -6, tipX, 6);
      const view = this.add.container(spec.x, spec.y, [g]).setDepth(5).setAngle(spec.seat === 1 ? 180 : 0);
      // A bot doesn't need buttons: only show the controls of people who are playing.
      view.setVisible(this.options.seats[spec.seat]?.kind === 'human');
      if (flip === -1) view.setScale(-1, 1);
      return { ...spec, view };
    });
  }

  private drawBoard(): void {
    const g = this.add.graphics();
    g.fillStyle(toHex(DARK.mint), 1);
    g.fillRoundedRect(BOARD_X - 10, BOARD_Y - 4, GRID.cols * CELL + 20, GRID.rows * CELL + 20, 24);
    g.fillStyle(toHex(COLORS.mint), 1);
    g.fillRoundedRect(BOARD_X - 10, BOARD_Y - 10, GRID.cols * CELL + 20, GRID.rows * CELL + 20, 24);
    for (let y = 0; y < GRID.rows; y++) {
      for (let x = 0; x < GRID.cols; x++) {
        g.fillStyle(TILE[(x + y) % 2]!, 1);
        g.fillRect(BOARD_X + x * CELL, BOARD_Y + y * CELL, CELL, CELL);
      }
    }
  }
}
