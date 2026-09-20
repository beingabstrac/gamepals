import { LADDERS, SNAKES, type SnakesEvent, type SnakesMove, type SnakesState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { ROOM_TONES, tone } from '../../look';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed } from '../../autoplay';
import { onKeys } from '../keys';

const CELL = 60;
const BOARD = CELL * 10;
const TRAY = 76;
const W = BOARD;
const H = BOARD + TRAY;
export const SNAKES_SIZE = { width: W, height: H };

export const SNAKES_SEAT_COLORS = [COLORS.tomato, COLORS.mint, COLORS.sunny, COLORS.sky];
export const SNAKES_SEAT_NAMES = ['Red', 'Green', 'Yellow', 'Blue'];
const SEAT_HEX = SNAKES_SEAT_COLORS.map(toHex);
const SEAT_DARK = [DARK.tomato, DARK.mint, DARK.sunny, DARK.sky].map(toHex);
const SNAKE_HEX = [COLORS.grape, COLORS.bubblegum, COLORS.mint, COLORS.peach, COLORS.sky, COLORS.tomato, COLORS.grape, COLORS.bubblegum].map(toHex);
const INK = 0x2b2a3a;
const TOKEN_R = 15;
const HOP_MS = 110;
const HOP_HEIGHT = 18;

type Point = { x: number; y: number };

/** Centre of a square. Rows wind back and forth: 1–10 left to right on the bottom row, 11–20 right to left above it. */
function squarePoint(square: number): Point {
  const i = square - 1;
  const row = Math.floor(i / 10);
  const col = row % 2 === 0 ? i % 10 : 9 - (i % 10);
  return { x: (col + 0.5) * CELL, y: (9 - row + 0.5) * CELL };
}

/** Start spots in the tray under the board, one per seat. */
const startPoint = (seat: number): Point => ({ x: W / 2 + (seat - 1.5) * 56, y: BOARD + TRAY / 2 });

/** A wiggly body from head to tail, used both to draw a snake and to slide a token down it. */
function snakeBody(head: number, tail: number): Point[] {
  const a = squarePoint(head);
  const b = squarePoint(tail);
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const nx = -(b.y - a.y) / length;
  const ny = (b.x - a.x) / length;
  const amp = Math.min(24, length * 0.12);
  const waves = Math.max(1.5, length / 160);
  const points: Point[] = [];
  const steps = Math.ceil(length / 6);
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const wobble = Math.sin(t * Math.PI * 2 * waves) * amp * Math.sin(Math.PI * Math.min(1, t * 1.4));
    points.push({ x: a.x + (b.x - a.x) * t + nx * wobble, y: a.y + (b.y - a.y) * t + ny * wobble });
  }
  return points;
}

/** The point a fraction `t` of the way along a list of points. */
function along(points: readonly Point[], t: number): Point {
  const f = Math.min(1, Math.max(0, t)) * (points.length - 1);
  const i = Math.min(points.length - 2, Math.floor(f));
  const k = f - i;
  const p = points[i]!;
  const q = points[i + 1]!;
  return { x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k };
}

export class SnakesScene extends Scene {
  private tokens: GameObjects.Container[] = [];
  /** Positions as drawn, which trail the real state while a move plays out. */
  private shown: number[] = [];
  private queue: SnakesEvent[] = [];
  private running = false;
  private seen: SnakesEvent | null = null;
  private banner!: GameObjects.Text;
  private bodies = new Map<number, Point[]>();

  constructor(private readonly session: Session<SnakesMove>) {
    super('snakes-and-ladders');
  }

  private get state(): SnakesState {
    return this.session.state as SnakesState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    const state = this.state;
    this.shown = state.positions.slice();
    this.seen = state.last;
    this.drawBoard();

    this.tokens = state.positions.map((_, seat) => {
      const shadow = this.add.circle(0, 4, TOKEN_R, INK, 0.18);
      const body = this.add.circle(0, 0, TOKEN_R, SEAT_HEX[seat]).setStrokeStyle(4, 0xffffff);
      const dot = this.add.circle(0, 0, TOKEN_R * 0.42, SEAT_DARK[seat]);
      return this.add.container(0, 0, [shadow, body, dot]).setDepth(5);
    });
    this.banner = sharpText(this, W / 2, BOARD / 2, '', 40, COLORS.ink).setDepth(20).setAlpha(0).setStroke('#ffffff', 10);
    this.layout();

    // Tap anywhere to roll on your turn. Keyboard: Space, Enter or R. A focused Roll button handles its own keys.
    this.input.on('pointerdown', () => this.roll());
    onKeys(this, (key) => {
      const onButton = document.activeElement instanceof HTMLButtonElement;
      if (key === 'r' || key === 'R' || ((key === ' ' || key === 'Enter') && !onButton)) {
        this.roll();
        return true;
      }
      return false;
    });

    const unsubscribe = this.session.subscribe(() => this.onChange());
    this.events.once('shutdown', unsubscribe);
  }

  private roll(): void {
    if (this.running || this.queue.length > 0 || !this.session.isHumanTurn()) return;
    this.session.play('roll');
  }

  private onChange(): void {
    const event = this.state.last;
    if (event && event !== this.seen) {
      this.seen = event;
      this.queue.push(event);
    }
    this.next();
  }

  /** Moves play out one at a time, even when a bot rolls again quickly. */
  private next(): void {
    if (this.running) return;
    const event = this.queue.shift();
    if (!event) {
      this.shown = this.state.positions.slice();
      this.layout();
      return;
    }
    this.running = true;
    this.animate(event, () => {
      this.running = false;
      this.next();
    });
  }

  private shout(text: string): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setAlpha(1).setScale(0.7);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 240, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 800, duration: 300 });
  }

  private animate(event: SnakesEvent, done: () => void): void {
    if (event.lostTurn) {
      this.shout('Three 6s in a row. Turn over!');
      this.time.delayedCall(700, done);
      return;
    }
    const mover = this.tokens[event.seat]!;
    this.tweens.killTweensOf(mover);
    mover.setScale(1).setDepth(10);
    if (event.bounced) this.shout('Too far, bounce back');

    // Hop square by square in little arcs.
    let from: Point = { x: mover.x, y: mover.y };
    event.path.forEach((square, i) => {
      const start = from;
      const end = squarePoint(square);
      this.tweens.addCounter({
        from: 0,
        to: 1,
        delay: i * HOP_MS,
        duration: HOP_MS - 10,
        ease: 'Sine.easeInOut',
        onUpdate: (tween) => {
          const t = tween.getValue() ?? 1;
          mover.setPosition(start.x + (end.x - start.x) * t, start.y + (end.y - start.y) * t - Math.sin(Math.PI * t) * HOP_HEIGHT);
        },
        onComplete: () => {
          this.tweens.add({ targets: mover, scaleX: 1.14, scaleY: 0.84, duration: 55, yoyo: true, ease: 'Quad.easeOut' });
        },
      });
      from = end;
    });

    const landed = event.jump ? event.jump.to : (event.path[event.path.length - 1] ?? event.from);
    const finish = () => {
      this.shown[event.seat] = landed;
      mover.setDepth(5).setAngle(0);
      if (landed === 100) this.tweens.add({ targets: mover, scale: 1.5, duration: 200, yoyo: true, repeat: 2, ease: 'Back.easeOut' });
      else if (event.again) this.shout('Six! Roll again');
      this.layout();
      this.time.delayedCall(event.again ? 450 : 150, done);
    };

    this.time.delayedCall(event.path.length * HOP_MS + 60, () => {
      const jump = event.jump;
      if (!jump) return finish();
      const square = event.path[event.path.length - 1]!;
      if (jump.kind === 'ladder') {
        this.shout(`Ladder! Up to ${jump.to}`);
        const top = squarePoint(jump.to);
        this.tweens.add({ targets: mover, x: top.x, y: top.y, duration: 560, ease: 'Sine.easeInOut', onComplete: finish });
      } else {
        this.shout(`Snake! Down to ${jump.to}`);
        this.cameras.main.shake(140, 0.004);
        const body = this.bodies.get(square)!;
        this.tweens.addCounter({
          from: 0,
          to: 1,
          duration: 760,
          ease: 'Sine.easeIn',
          onUpdate: (tween) => {
            const t = tween.getValue() ?? 1;
            const p = along(body, t);
            mover.setPosition(p.x, p.y).setAngle(Math.sin(t * Math.PI * 6) * 18);
          },
          onComplete: finish,
        });
      }
    });
  }

  /** Places every token; tokens sharing a square sit side by side. The player to roll bobs gently. */
  private layout(): void {
    const groups = new Map<number, number[]>();
    this.shown.forEach((square, seat) => {
      if (square > 0) groups.set(square, [...(groups.get(square) ?? []), seat]);
    });
    this.shown.forEach((square, seat) => {
      const token = this.tokens[seat]!;
      this.tweens.killTweensOf(token);
      if (square === 0) {
        const p = startPoint(seat);
        token.setPosition(p.x, p.y).setScale(1);
        return;
      }
      const group = groups.get(square)!;
      const offset = (group.indexOf(seat) - (group.length - 1) / 2) * 14;
      const p = squarePoint(square);
      token.setPosition(p.x + offset, p.y - Math.abs(offset) * 0.3).setScale(group.length > 1 ? 0.8 : 1);
    });
    const state = this.state;
    if (!state.result && !this.running && this.queue.length === 0 && this.session.isHumanTurn()) {
      const token = this.tokens[state.currentSeat]!;
      this.tweens.add({ targets: token, scale: token.scale * 1.18, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  private drawBoard(): void {
    const g = this.add.graphics();
    g.fillStyle(tone(0xe9e4f5, ROOM_TONES.line), 1);
    g.fillRoundedRect(0, 6, W, BOARD, 24);
    g.fillStyle(tone(0xffffff, ROOM_TONES.panel), 1);
    g.fillRoundedRect(0, 0, W, BOARD, 24);
    for (let square = 1; square <= 100; square++) {
      const { x, y } = squarePoint(square);
      const col = Math.floor(x / CELL);
      const row = Math.floor(y / CELL);
      const fill = square === 100 ? toHex(COLORS.sunny) : (col + row) % 2 ? 0xfff1dc : 0xffffff;
      g.fillStyle(fill, 1);
      g.fillRoundedRect(x - CELL / 2 + 2, y - CELL / 2 + 2, CELL - 4, CELL - 4, 10);
      sharpText(this, x - CELL / 2 + 15, y - CELL / 2 + 13, String(square), 14, COLORS.ink).setAlpha(square === 100 ? 1 : 0.45);
    }
    g.fillStyle(0xf3efe6, 1);
    g.fillRoundedRect(W / 2 - 130, BOARD + 12, 260, TRAY - 20, 26);
    sharpText(this, W / 2 - 170, BOARD + TRAY / 2, 'Start', 16, COLORS.ink).setAlpha(0.4);

    // Ladders: two sunny rails with rungs, under the snakes.
    const ladders = this.add.graphics().setDepth(1);
    for (const [foot, top] of Object.entries(LADDERS)) {
      const a = squarePoint(Number(foot));
      const b = squarePoint(top);
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      const nx = (-(b.y - a.y) / length) * 12;
      const ny = ((b.x - a.x) / length) * 12;
      const rungs = Math.floor(length / 26);
      for (const [width, color] of [[9, toHex(DARK.sunny)], [5, toHex(COLORS.sunny)]] as const) {
        ladders.lineStyle(width, color, 1);
        ladders.lineBetween(a.x + nx, a.y + ny, b.x + nx, b.y + ny);
        ladders.lineBetween(a.x - nx, a.y - ny, b.x - nx, b.y - ny);
        for (let r = 1; r < rungs; r++) {
          const t = r / rungs;
          const cx = a.x + (b.x - a.x) * t;
          const cy = a.y + (b.y - a.y) * t;
          ladders.lineBetween(cx + nx, cy + ny, cx - nx, cy - ny);
        }
      }
    }

    // Snakes: a chunky candy body that thins to the tail, with a friendly face at the head.
    const snakes = this.add.graphics().setDepth(2);
    Object.entries(SNAKES).forEach(([head, tail], index) => {
      const body = snakeBody(Number(head), tail);
      this.bodies.set(Number(head), body);
      const color = SNAKE_HEX[index % SNAKE_HEX.length]!;
      const radius = (i: number) => 11 - (i / body.length) * 6;
      snakes.fillStyle(INK, 0.16);
      body.forEach((p, i) => snakes.fillCircle(p.x, p.y + 3, radius(i) + 1));
      snakes.fillStyle(color, 1);
      body.forEach((p, i) => snakes.fillCircle(p.x, p.y, radius(i)));
      snakes.fillStyle(0xffffff, 0.35);
      body.forEach((p, i) => i % 5 === 2 && snakes.fillCircle(p.x - 2, p.y - 2, radius(i) * 0.35));
      const h = body[0]!;
      const n = body[Math.min(4, body.length - 1)]!;
      const dx = h.x - n.x;
      const dy = h.y - n.y;
      const d = Math.hypot(dx, dy) || 1;
      snakes.fillStyle(toHex(COLORS.tomato), 1);
      snakes.fillTriangle(h.x + (dx / d) * 22, h.y + (dy / d) * 22, h.x + (dx / d) * 12 - (dy / d) * 3, h.y + (dy / d) * 12 + (dx / d) * 3, h.x + (dx / d) * 12 + (dy / d) * 3, h.y + (dy / d) * 12 - (dx / d) * 3);
      snakes.fillStyle(color, 1);
      snakes.fillCircle(h.x, h.y, 15);
      for (const side of [-1, 1]) {
        const ex = h.x + (dx / d) * 4 + (-dy / d) * 6 * side;
        const ey = h.y + (dy / d) * 4 + (dx / d) * 6 * side;
        snakes.fillStyle(tone(0xffffff, ROOM_TONES.panel), 1);
        snakes.fillCircle(ex, ey, 4.5);
        snakes.fillStyle(INK, 1);
        snakes.fillCircle(ex + (dx / d) * 1.5, ey + (dy / d) * 1.5, 2.2);
      }
    });
  }
}
