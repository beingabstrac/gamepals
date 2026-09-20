import { slideMove, type SlidingMove, type SlidingState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { ROOM_TONES, tone, ROOM } from '../../look';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed } from '../../autoplay';
import { onKeys } from '../keys';

const SIZE = 600;
export const SLIDING_SIZE = { width: SIZE, height: SIZE };
const PAD = 18;
const GAP = 10;
const SLIDE_MS = 110;
const SWIPE_MIN = 26;
/** Each tile is colored by the row it belongs in, so finished rows are easy to see. */
const ROW_COLORS = [COLORS.tomato, COLORS.peach, COLORS.sunny, COLORS.mint, COLORS.sky];
const ROW_DARK = [DARK.tomato, DARK.peach, DARK.sunny, DARK.mint, DARK.sky];

export class SlidingScene extends Scene {
  private views = new Map<number, GameObjects.Container>();
  private n = 3;
  private cell = 0;
  private start: { x: number; y: number } | null = null;

  constructor(private readonly session: Session<SlidingMove>) {
    super('sliding-puzzle');
  }

  private get state(): SlidingState {
    return this.session.state as SlidingState;
  }

  private pos(cell: number): { x: number; y: number } {
    return {
      x: PAD + (cell % this.n) * (this.cell + GAP) + this.cell / 2,
      y: PAD + Math.floor(cell / this.n) * (this.cell + GAP) + this.cell / 2,
    };
  }

  create(): void {
    fitCamera(this, SIZE, SIZE);
    applySpeed(this);
    this.n = this.state.n;
    this.cell = (SIZE - PAD * 2 - GAP * (this.n - 1)) / this.n;

    const frame = this.add.graphics();
    frame.fillStyle(ROOM ? 0xe9cfa0 : 0xe6e0f4, 1);
    frame.fillRoundedRect(0, 8, SIZE, SIZE - 8, 30);
    if (ROOM) frame.fillGradientStyle(0xfffdf6, 0xfffdf6, 0xfff0d4, 0xfff0d4, 1);
    else frame.fillStyle(tone(0xffffff, ROOM_TONES.panel), 1);
    frame.fillRoundedRect(0, 0, SIZE, SIZE - 8, 30);
    for (let cell = 0; cell < this.n * this.n; cell++) {
      const { x, y } = this.pos(cell);
      // The empty bed under a tile, shaded where the frame overhangs it.
      frame.fillStyle(ROOM ? 0xecd7ac : 0xf1edfa, 1);
      frame.fillRoundedRect(x - this.cell / 2, y - this.cell / 2, this.cell, this.cell, 18);
      if (ROOM) {
        frame.fillStyle(0xd8bd8a, 0.5);
        frame.fillRoundedRect(x - this.cell / 2, y - this.cell / 2, this.cell, this.cell * 0.2, 12);
      }
    }

    this.state.tiles.forEach((tile, cell) => {
      if (!tile) return;
      const view = this.makeTile(tile, cell);
      view.setScale(0);
      this.tweens.add({ targets: view, scale: 1, duration: 280, delay: 40 + cell * 18, ease: 'Back.easeOut' });
    });

    // Tap a tile in the space's row or column, or swipe a tile toward the space.
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      this.start = { x: p.worldX, y: p.worldY };
    });
    this.input.on('pointerup', (p: { worldX: number; worldY: number }) => {
      const start = this.start;
      this.start = null;
      if (!start) return;
      const dx = p.worldX - start.x;
      const dy = p.worldY - start.y;
      if (Math.hypot(dx, dy) < SWIPE_MIN) this.tapAt(start.x, start.y);
      else if (Math.abs(dx) > Math.abs(dy)) this.slideToward(Math.sign(dx), 0);
      else this.slideToward(0, Math.sign(dy));
    });
    // Keyboard: an arrow slides the tile next to the space in that direction.
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    onKeys(this, (key) => {
      const dir = arrows[key];
      if (!dir) return false;
      this.slideToward(dir[0], dir[1]);
      return true;
    });

    const unsubscribe = this.session.subscribe(() => this.animate());
    this.events.once('shutdown', unsubscribe);
  }

  private makeTile(tile: number, cell: number): GameObjects.Container {
    const { x, y } = this.pos(cell);
    const size = this.cell;
    const row = Math.floor((tile - 1) / this.n);
    const g = this.add.graphics();
    if (ROOM) {
      g.fillStyle(0x7a4a14, 0.2);
      g.fillRoundedRect(-this.cell / 2, -this.cell / 2 + 7, this.cell, this.cell, 18);
    }
    g.fillStyle(toHex(ROW_DARK[row % ROW_DARK.length]!), 1);
    g.fillRoundedRect(-size / 2, -size / 2 + 6, size, size - 2, 18);
    g.fillStyle(toHex(ROW_COLORS[row % ROW_COLORS.length]!), 1);
    g.fillRoundedRect(-size / 2, -size / 2, size, size - 4, 18);
    const fontSize = this.n === 3 ? 84 : this.n === 4 ? 64 : 50;
    const label = sharpText(this, 0, -2, String(tile), fontSize, row === 2 ? COLORS.ink : '#ffffff').setFontStyle('bold');
    const view = this.add.container(x, y, [g, label]);
    this.views.set(tile, view);
    return view;
  }

  private tapAt(x: number, y: number): void {
    const col = Math.floor((x - PAD) / (this.cell + GAP));
    const row = Math.floor((y - PAD) / (this.cell + GAP));
    if (col < 0 || col >= this.n || row < 0 || row >= this.n) return;
    this.tryMove(row * this.n + col);
  }

  /** Slide the tile beside the space in direction (dx, dy), for swipes and arrow keys. */
  private slideToward(dx: number, dy: number): void {
    const { gap } = this.state;
    const row = Math.floor(gap / this.n) - dy;
    const col = (gap % this.n) - dx;
    if (row < 0 || row >= this.n || col < 0 || col >= this.n) {
      this.nudge(dx, dy);
      return;
    }
    this.tryMove(row * this.n + col);
  }

  private tryMove(cell: number): void {
    const move = slideMove(cell);
    if (this.state.legalMoves(0).includes(move)) {
      this.session.play(move);
      return;
    }
    const view = this.views.get(this.state.tiles[cell] ?? 0);
    if (view) this.tweens.add({ targets: view, angle: { from: -4, to: 4 }, duration: 50, yoyo: true, repeat: 1, onComplete: () => view.setAngle(0) });
  }

  /** Nothing can slide that way: the whole board gives a tiny push, so the swipe doesn't feel ignored. */
  private nudge(dx: number, dy: number): void {
    const cam = this.cameras.main;
    this.tweens.add({ targets: cam, scrollX: cam.scrollX - dx * 4, scrollY: cam.scrollY - dy * 4, duration: 60, yoyo: true });
  }

  private animate(): void {
    const state = this.state;
    state.last.forEach((step, i) => {
      const view = this.views.get(step.tile);
      if (!view) return;
      const { x, y } = this.pos(step.to);
      this.tweens.killTweensOf(view);
      this.tweens.add({ targets: view, x, y, duration: SLIDE_MS, delay: i * 12, ease: 'Quad.easeOut' });
    });
    if (state.result) {
      // Solved: a pop wave rolls from the top-left tile to the last one.
      this.time.delayedCall(SLIDE_MS + 60, () => {
        state.tiles.forEach((tile, cell) => {
          const view = this.views.get(tile);
          if (view) this.tweens.add({ targets: view, scale: 1.12, duration: 140, delay: cell * 45, yoyo: true, ease: 'Sine.easeOut' });
        });
        this.cameras.main.shake(120, 0.003);
      });
    }
  }
}
