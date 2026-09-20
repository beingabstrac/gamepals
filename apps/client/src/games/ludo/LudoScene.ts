import { absoluteSquare, HOME, LAST_TRACK, SAFE_SQUARES, YARD, type LudoEvent, type LudoMove, type LudoState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera } from '../crisp';
import { applySpeed } from '../../autoplay';
import { onKeys } from '../keys';
const CELL = 40;
const SIZE = 15 * CELL;
export const LUDO_SIZE = { width: SIZE, height: SIZE };

export const LUDO_COLORS = [COLORS.tomato, COLORS.mint, COLORS.sunny, COLORS.sky];
export const LUDO_COLOR_NAMES = ['Red', 'Green', 'Yellow', 'Blue'];
const COLOR_HEX = LUDO_COLORS.map(toHex);
const DARK_HEX = [DARK.tomato, DARK.mint, DARK.sunny, DARK.sky].map(toHex);
const CELL_LINE = 0xe9e4f5;
const STAR = 0xd9d2f0;
const TOKEN_RADIUS = CELL * 0.38;
const HOP_MS = 120;
const HOP_HEIGHT = 16;

/** The 52 shared track squares as [col, row], clockwise from red's start square. */
const TRACK: readonly (readonly [number, number])[] = [
  [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
  [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0],
  [7, 0],
  [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
  [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6],
  [14, 7],
  [14, 8], [13, 8], [12, 8], [11, 8], [10, 8], [9, 8],
  [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14],
  [7, 14],
  [6, 14], [6, 13], [6, 12], [6, 11], [6, 10], [6, 9],
  [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  [0, 7],
  [0, 6],
];

const HOME_COLUMNS: readonly (readonly (readonly [number, number])[])[] = [
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
];

const YARD_ORIGINS: readonly (readonly [number, number])[] = [
  [0, 0],
  [9, 0],
  [9, 9],
  [0, 9],
];

/** Where finished tokens gather inside their color's triangle. */
const HOME_SPOTS: readonly (readonly [number, number])[] = [
  [6.5, 7.5],
  [7.5, 6.5],
  [8.5, 7.5],
  [7.5, 8.5],
];

const cellCenter = ([col, row]: readonly [number, number]) => ({ x: (col + 0.5) * CELL, y: (row + 0.5) * CELL });

function tokenPoint(color: number, progress: number, token: number): { x: number; y: number } {
  if (progress === YARD) {
    const [ox, oy] = YARD_ORIGINS[color]!;
    return { x: (ox + (token % 2 ? 4 : 2)) * CELL, y: (oy + (token < 2 ? 2 : 4)) * CELL };
  }
  if (progress === HOME) {
    const [hx, hy] = HOME_SPOTS[color]!;
    return { x: hx * CELL, y: hy * CELL };
  }
  if (progress > LAST_TRACK) return cellCenter(HOME_COLUMNS[color]![progress - LAST_TRACK - 1]!);
  return cellCenter(TRACK[absoluteSquare(color, progress)!]!);
}

function drawStar(g: GameObjects.Graphics, x: number, y: number, radius: number, color: number): void {
  g.fillStyle(color, 1);
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? radius : radius * 0.45;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fillPath();
}

export class LudoScene extends Scene {
  private tokens: GameObjects.Container[][] = [];
  private handledEvent: LudoEvent | null = null;

  constructor(private readonly session: Session<LudoMove>) {
    super('ludo');
  }

  private get state(): LudoState {
    return this.session.state as LudoState;
  }

  create(): void {
    fitCamera(this, SIZE, SIZE);
    applySpeed(this);
    this.drawBoard();
    const state = this.state;

    this.tokens = state.tokens.map((list, seat) => {
      const color = state.colorOf(seat);
      return list.map((progress, token) => {
        const point = tokenPoint(color, progress, token);
        const shadow = this.add.circle(0, 4, TOKEN_RADIUS, 0x2b2a3a, 0.16);
        const body = this.add.circle(0, 0, TOKEN_RADIUS, COLOR_HEX[color]).setStrokeStyle(4, 0xffffff);
        const dot = this.add.circle(0, 0, TOKEN_RADIUS * 0.42, DARK_HEX[color]);
        body.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          if (this.session.state.currentSeat === seat) this.session.play(token);
        });
        return this.add.container(point.x, point.y, [shadow, body, dot]);
      });
    });

    // Keyboard: R or Space rolls, 1–4 moves that token. Space is left alone when a button has focus,
    // so a focused Roll button doesn't roll twice.
    onKeys(this, (key) => {
      if (!this.session.isHumanTurn()) return false;
      const now = this.state;
      const onButton = document.activeElement instanceof HTMLButtonElement;
      if (now.phase === 'roll' && (key === 'r' || key === 'R' || (key === ' ' && !onButton))) {
        this.session.play('roll');
        return true;
      }
      const digit = Number(key);
      if (now.phase === 'move' && Number.isInteger(digit) && digit >= 1 && digit <= 4) {
        this.session.play(digit - 1);
        return true;
      }
      return false;
    });

    this.handledEvent = state.lastEvent;
    this.layout();
    this.updateHighlights();

    const unsubscribe = this.session.subscribe(() => this.onChange());
    this.events.once('shutdown', unsubscribe);
  }

  private onChange(): void {
    const event = this.state.lastEvent;
    if (event && event !== this.handledEvent) {
      this.handledEvent = event;
      this.animate(event);
    } else {
      this.updateHighlights();
    }
  }

  private animate(event: LudoEvent): void {
    this.clearHighlights();
    const state = this.state;
    const color = state.colorOf(event.seat);
    const mover = this.tokens[event.seat]![event.token]!;
    mover.setDepth(5);

    // Hop square by square in little arcs; leaving the yard is one bigger jump.
    const steps: number[] = [];
    if (event.from === YARD) steps.push(0);
    else for (let p = event.from + 1; p <= event.to; p++) steps.push(p);

    let from = { x: mover.x, y: mover.y };
    steps.forEach((progress, i) => {
      const start = from;
      const end = tokenPoint(color, progress, event.token);
      const height = event.from === YARD ? HOP_HEIGHT * 2.5 : HOP_HEIGHT;
      this.tweens.addCounter({
        from: 0,
        to: 1,
        delay: i * HOP_MS,
        duration: HOP_MS - 10,
        ease: 'Sine.easeInOut',
        onUpdate: (tween) => {
          const t = tween.getValue() ?? 1;
          mover.setPosition(start.x + (end.x - start.x) * t, start.y + (end.y - start.y) * t - Math.sin(Math.PI * t) * height);
        },
        onComplete: () => {
          // Land with a small squash.
          this.tweens.add({ targets: mover, scaleX: 1.14, scaleY: 0.84, duration: 55, yoyo: true, ease: 'Quad.easeOut' });
        },
      });
      from = end;
    });

    this.time.delayedCall(steps.length * HOP_MS + 60, () => {
      mover.setDepth(0);
      for (const capture of event.captured) {
        const victim = this.tokens[capture.seat]![capture.token]!;
        const home = tokenPoint(state.colorOf(capture.seat), YARD, capture.token);
        victim.setDepth(6);
        this.tweens.add({
          targets: victim,
          x: home.x,
          y: home.y,
          angle: 360,
          duration: 520,
          ease: 'Back.easeInOut',
          onComplete: () => victim.setAngle(0).setDepth(0),
        });
      }
      if (event.captured.length > 0) this.cameras.main.shake(180, 0.006);
      if (event.to === HOME) this.tweens.add({ targets: mover, scale: 1.4, duration: 160, yoyo: true, ease: 'Back.easeOut' });
      this.time.delayedCall(event.captured.length > 0 ? 540 : 0, () => {
        this.layout();
        this.updateHighlights();
      });
    });
  }

  /** Places every token, fanning out tokens that share a spot. */
  private layout(): void {
    const state = this.state;
    const groups = new Map<string, GameObjects.Container[]>();
    const targets = new Map<GameObjects.Container, { x: number; y: number }>();
    state.tokens.forEach((list, seat) => {
      list.forEach((progress, token) => {
        const container = this.tokens[seat]![token]!;
        const point = tokenPoint(state.colorOf(seat), progress, token);
        targets.set(container, point);
        const key = `${Math.round(point.x)},${Math.round(point.y)}`;
        groups.set(key, [...(groups.get(key) ?? []), container]);
      });
    });
    for (const group of groups.values()) {
      group.forEach((container, i) => {
        const point = targets.get(container)!;
        const offset = (i - (group.length - 1) / 2) * 9;
        container.setPosition(point.x + offset, point.y - Math.abs(offset) * 0.3);
        container.setScale(group.length > 1 ? 0.85 : 1);
      });
    }
  }

  private clearHighlights(): void {
    for (const list of this.tokens) {
      for (const container of list) {
        this.tweens.killTweensOf(container);
        container.setScale(1);
      }
    }
  }

  /** Legal tokens bob gently while a local player chooses. */
  private updateHighlights(): void {
    this.clearHighlights();
    this.layout();
    const state = this.state;
    if (!this.session.isHumanTurn() || state.phase !== 'move') return;
    for (const move of state.legalMoves(state.currentSeat)) {
      if (typeof move !== 'number') continue;
      const container = this.tokens[state.currentSeat]![move]!;
      container.setDepth(4);
      this.tweens.add({ targets: container, scale: 1.18, y: container.y - 4, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  private drawBoard(): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(0, 0, SIZE, SIZE, 26);
    g.lineStyle(3, CELL_LINE, 1);
    g.strokeRoundedRect(1.5, 1.5, SIZE - 3, SIZE - 3, 26);

    TRACK.forEach(([col, row], index) => {
      const startColor = [0, 13, 26, 39].indexOf(index);
      g.fillStyle(startColor >= 0 ? COLOR_HEX[startColor]! : 0xffffff, 1);
      g.fillRoundedRect(col * CELL + 2, row * CELL + 2, CELL - 4, CELL - 4, 7);
      g.lineStyle(2, CELL_LINE, 1);
      g.strokeRoundedRect(col * CELL + 2, row * CELL + 2, CELL - 4, CELL - 4, 7);
      if (SAFE_SQUARES.has(index) && startColor < 0) drawStar(g, (col + 0.5) * CELL, (row + 0.5) * CELL, 12, STAR);
    });

    HOME_COLUMNS.forEach((cells, color) => {
      g.fillStyle(COLOR_HEX[color]!, 1);
      for (const [col, row] of cells) g.fillRoundedRect(col * CELL + 2, row * CELL + 2, CELL - 4, CELL - 4, 7);
    });

    YARD_ORIGINS.forEach(([ox, oy], color) => {
      g.fillStyle(DARK_HEX[color]!, 1);
      g.fillRoundedRect(ox * CELL + 6, oy * CELL + 12, 6 * CELL - 12, 6 * CELL - 12, 26);
      g.fillStyle(COLOR_HEX[color]!, 1);
      g.fillRoundedRect(ox * CELL + 6, oy * CELL + 6, 6 * CELL - 12, 6 * CELL - 12, 26);
      g.fillStyle(0xffffff, 1);
      g.fillRoundedRect((ox + 1) * CELL, (oy + 1) * CELL, 4 * CELL, 4 * CELL, 22);
      for (let token = 0; token < 4; token++) {
        const { x, y } = tokenPoint(color, YARD, token);
        g.fillStyle(COLOR_HEX[color]!, 0.25);
        g.fillCircle(x, y, TOKEN_RADIUS + 6);
      }
    });

    const a = 6 * CELL;
    const b = 9 * CELL;
    const c = SIZE / 2;
    const triangles: readonly [number, number, number, number][] = [
      [a, a, a, b],
      [a, a, b, a],
      [b, a, b, b],
      [a, b, b, b],
    ];
    triangles.forEach(([x1, y1, x2, y2], color) => {
      g.fillStyle(COLOR_HEX[color]!, 1);
      g.fillTriangle(x1, y1, x2, y2, c, c);
    });
  }
}
