import {
  CLASSIC_GRID,
  CLASSIC_STEP,
  classicSnakeBotHeading,
  classicSnakeSteer,
  newClassicSnake,
  stepClassicSnake,
  type SnakeCell,
  type ClassicSnakeEvents,
  type ClassicSnakeState,
  type Heading,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { COLORS, DARK, toHex } from '../../theme';
import type { RealtimeSceneOptions } from '../air-hockey/AirHockeyScene';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed, SPEED } from '../../autoplay';
import { storage } from '../../platform';

const W = 600;
const H = 860;
export const CLASSIC_SNAKE_SIZE = { width: W, height: H };
/** Best score, saved on the device (native Preferences in the apps). */
export const CLASSIC_SNAKE_BEST_KEY = 'gamepals.best.classic-snake';

const CELL = 34;
const BOARD_X = (W - CLASSIC_GRID.cols * CELL) / 2;
const BOARD_Y = (H - CLASSIC_GRID.rows * CELL) / 2;
const TILE = [0xb3efcc, 0xa2e8bf];
const BODY = toHex(COLORS.sky);
const BODY_DARK = toHex(DARK.sky);
/** A drag this long counts as a swipe; each swipe turns right away, so quick zig-zags work. */
const SWIPE = 22;
/** The autoplay bot stops steering after this many fruit (see runBot). */
const AUTOPLAY_FRUIT = 25;
const KEYS: Record<string, Heading> = { ArrowUp: 0, w: 0, ArrowRight: 1, d: 1, ArrowDown: 2, s: 2, ArrowLeft: 3, a: 3 };

const px = (c: SnakeCell) => ({ x: BOARD_X + (c.x + 0.5) * CELL, y: BOARD_Y + (c.y + 0.5) * CELL });
const smooth = (t: number) => t * t * (3 - 2 * t);

export class ClassicSnakeScene extends Scene {
  private state: ClassicSnakeState;
  private readonly bot: boolean;
  private accumulator = 0;
  private ended = false;
  private drag: { x: number; y: number } | null = null;

  private snake!: GameObjects.Graphics;
  private fruit!: GameObjects.Container;
  private banner!: GameObjects.Text;

  constructor(private readonly options: RealtimeSceneOptions) {
    super('classic-snake');
    this.state = newClassicSnake(options.seed);
    this.bot = options.seats[0]?.kind === 'bot';
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.drawBoard();
    this.snake = this.add.graphics().setDepth(3);
    this.fruit = this.makeFruit();
    this.banner = sharpText(this, W / 2, H / 2, '', 60, COLORS.ink).setDepth(10);
    const best = Number(storage.get(CLASSIC_SNAKE_BEST_KEY) ?? 0) || 0;
    this.shout(best > 0 ? `Best: ${best}` : 'Ready?', 900);

    // Swipe to steer; the drag restarts after each turn so quick double turns work.
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      this.drag = { x: p.worldX, y: p.worldY };
    });
    this.input.on('pointermove', (p: { worldX: number; worldY: number; isDown: boolean }) => {
      if (!this.drag || !p.isDown) return;
      const dx = p.worldX - this.drag.x;
      const dy = p.worldY - this.drag.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE) return;
      this.steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0);
      this.drag = { x: p.worldX, y: p.worldY };
    });
    this.input.on('pointerup', () => {
      this.drag = null;
    });
    // Keyboard: arrow keys or W A S D.
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      const heading = KEYS[event.key.length === 1 ? event.key.toLowerCase() : event.key];
      if (heading === undefined || event.metaKey || event.ctrlKey) return;
      event.preventDefault();
      this.steer(heading);
    });

    this.options.onScore([0]);
    this.draw(1);
  }

  private steer(heading: Heading): void {
    if (this.bot || this.ended) return;
    const before = this.state.queue.length;
    this.state = classicSnakeSteer(this.state, heading);
    if (this.state.queue.length > before) this.options.onCue('tap');
  }

  update(_time: number, delta: number): void {
    if (this.ended) return;
    this.accumulator += (Math.min(delta, 100) * SPEED) / 1000;
    while (this.accumulator >= CLASSIC_STEP) {
      this.accumulator -= CLASSIC_STEP;
      const before = this.state;
      const { state, events } = stepClassicSnake(this.state);
      this.state = state;
      if (before.phase === 'countdown' && state.phase === 'play') {
        this.shout('Go!');
        this.runBot();
      }
      this.handle(events);
      if (events.tick) this.runBot();
      if (state.phase === 'over') {
        this.end();
        break;
      }
    }
    const progress = this.state.phase === 'play' ? Math.min(this.state.tickTimer / this.state.interval, 1) : 1;
    this.draw(smooth(progress));
  }

  /**
   * Autoplay only: the bot decides right after each move. Tests need a real game and a real crash, not a
   * 100-fruit marathon, so after 25 fruit the bot stops steering and runs into a wall.
   */
  private runBot(): void {
    if (!this.bot || this.state.phase !== 'play' || this.state.eaten >= AUTOPLAY_FRUIT) return;
    this.state = classicSnakeSteer(this.state, classicSnakeBotHeading(this.state));
  }

  private handle(events: ClassicSnakeEvents): void {
    if (events.ate) {
      this.options.onCue('place');
      this.options.onScore([this.state.eaten]);
      this.fruit.setScale(0);
      this.tweens.add({ targets: this.fruit, scale: 1, duration: 320, ease: 'Back.easeOut' });
    }
    if (events.crashed) {
      this.options.onCue('thud');
      this.cameras.main.shake(260, 0.01);
      this.shout('Crash!');
    }
  }

  private end(): void {
    this.ended = true;
    const score = this.state.eaten;
    const best = Number(storage.get(CLASSIC_SNAKE_BEST_KEY) ?? 0) || 0;
    if (score > best) storage.set(CLASSIC_SNAKE_BEST_KEY, String(score));
    if (this.state.result?.winners.length) this.shout('Board full!');
    else if (score > best && score > 0) this.time.delayedCall(500, () => this.shout('New best!'));
    this.time.delayedCall(1100, () => this.options.onEnd(this.state.result!));
  }

  private shout(text: string, hold = 600): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: this.banner, scale: 1.1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: hold, duration: 300 });
  }

  /** Draws the snake gliding `t` (0–1) of the way from its previous cells to its current ones. */
  private draw(t: number): void {
    const g = this.snake.clear();
    const { body, previous, fruit, phase, heading } = this.state;
    if (fruit) {
      const pos = px(fruit);
      this.fruit.setVisible(true).setPosition(pos.x, pos.y);
    } else this.fruit.setVisible(false);

    const crashed = phase === 'over' && !this.state.result?.winners.length;
    const color = crashed ? 0xb9b6c9 : BODY;
    const dark = crashed ? 0x9b98ad : BODY_DARK;
    const points = body.map((cell, i) => {
      const from = px(previous[Math.min(i, previous.length - 1)] ?? cell);
      const to = px(cell);
      return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
    });

    // A rounded tube, thicker at the head and tapering toward the tail.
    for (let i = points.length - 1; i > 0; i--) {
      const a = points[i]!;
      const b = points[i - 1]!;
      const width = CELL * (0.58 + 0.22 * (1 - i / points.length));
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
    this.drawFace(g, head, heading, crashed);
  }

  private drawFace(g: GameObjects.Graphics, head: { x: number; y: number }, dir: Heading, crashed: boolean): void {
    const fx = [0, 1, 0, -1][dir]!;
    const fy = [-1, 0, 1, 0][dir]!;
    const sx = -fy;
    const sy = fx;
    for (const side of [-1, 1]) {
      const ex = head.x + fx * 6 + sx * side * 8;
      const ey = head.y + fy * 6 + sy * side * 8;
      g.fillStyle(0xffffff, 1);
      g.fillCircle(ex, ey, 6);
      g.fillStyle(0x2b2a3a, 1);
      if (crashed) {
        g.lineStyle(2.5, 0x2b2a3a, 1);
        g.lineBetween(ex - 3, ey - 3, ex + 3, ey + 3);
        g.lineBetween(ex + 3, ey - 3, ex - 3, ey + 3);
      } else {
        g.fillCircle(ex + fx * 1.6, ey + fy * 1.6, 3);
      }
    }
  }

  private makeFruit(): GameObjects.Container {
    const g = this.add.graphics();
    g.fillStyle(toHex(DARK.tomato), 1);
    g.fillCircle(0, 3, 13);
    g.fillStyle(toHex(COLORS.tomato), 1);
    g.fillCircle(0, 0, 13);
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(-4, -4, 4);
    g.fillStyle(toHex(COLORS.mint), 1);
    g.fillEllipse(6, -13, 12, 6);
    return this.add.container(0, 0, [g]).setDepth(2);
  }

  private drawBoard(): void {
    const g = this.add.graphics();
    const w = CLASSIC_GRID.cols * CELL;
    const h = CLASSIC_GRID.rows * CELL;
    g.fillStyle(toHex(DARK.mint), 1);
    g.fillRoundedRect(BOARD_X - 10, BOARD_Y - 4, w + 20, h + 20, 24);
    g.fillStyle(toHex(COLORS.mint), 1);
    g.fillRoundedRect(BOARD_X - 10, BOARD_Y - 10, w + 20, h + 20, 24);
    for (let y = 0; y < CLASSIC_GRID.rows; y++) {
      for (let x = 0; x < CLASSIC_GRID.cols; x++) {
        g.fillStyle(TILE[(x + y) % 2]!, 1);
        g.fillRect(BOARD_X + x * CELL, BOARD_Y + y * CELL, CELL, CELL);
      }
    }
  }
}
