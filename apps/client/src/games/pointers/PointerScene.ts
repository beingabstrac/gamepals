import { POINTER_DIRS, POINTER_LIVES, type PointerMove, type PointerState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera } from '../crisp';
import { focusRing, moveRing, onKeys } from '../keys';

const W = 600;
const H = 720;
export const POINTER_CANVAS = { width: W, height: H };
export const POINTER_COLORS = [COLORS.mint];

const GRID = { x: 30, y: 110, w: 540 };
const DIR_COLORS = [COLORS.sky, COLORS.mint, COLORS.tomato, COLORS.grape];
const DIR_DARK = [DARK.sky, DARK.mint, DARK.tomato, DARK.grape];

/**
 * Pointers. The rules know which arrows have a clear road; the scene draws each as a candy tile
 * with its arrow, flies a free one off the board the way it points, and bumps a blocked one into
 * its neighbor and back while a heart goes.
 */
export class PointerScene extends Scene {
  private tiles = new Map<number, GameObjects.Container>();
  private hearts!: GameObjects.Graphics;
  private ring!: GameObjects.Graphics;
  private focus = 0;
  private moving = 0;

  constructor(private readonly session: Session<PointerMove>) {
    super('pointers');
  }

  private get state(): PointerState {
    return this.session.state as PointerState;
  }

  private get cell(): number {
    return GRID.w / this.state.size;
  }

  private cellXY(i: number): { x: number; y: number } {
    const n = this.state.size;
    return { x: GRID.x + (i % n) * this.cell + this.cell / 2, y: GRID.y + Math.floor(i / n) * this.cell + this.cell / 2 };
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    const board = this.add.graphics();
    board.fillStyle(0xe6e0f4, 1);
    board.fillRoundedRect(GRID.x - 10, GRID.y - 10 + 6, GRID.w + 20, GRID.w + 20, 22);
    board.fillStyle(0xf4f1fb, 1);
    board.fillRoundedRect(GRID.x - 10, GRID.y - 10, GRID.w + 20, GRID.w + 20, 22);
    this.hearts = this.add.graphics();
    this.ring = focusRing(this, this.cell - 4, this.cell - 4, 12);
    this.state.arrows.forEach((d, i) => d >= 0 && this.tiles.set(i, this.makeTile(d, i)));
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      this.ring.setVisible(false);
      const n = this.state.size;
      const col = Math.floor((p.worldX - GRID.x) / this.cell);
      const row = Math.floor((p.worldY - GRID.y) / this.cell);
      if (col >= 0 && row >= 0 && col < n && row < n) this.tap(row * n + col);
    });
    onKeys(this, (key) => this.key(key));
    const off = this.session.subscribe(() => this.changed());
    this.session.holdBots = () => this.busy();
    this.events.once('shutdown', () => {
      off();
      this.session.holdBots = null;
    });
    this.drawHearts();
  }

  busy(): boolean {
    return this.moving > 0;
  }

  private makeTile(dir: number, i: number): GameObjects.Container {
    const c = this.cell;
    const g = this.add.graphics();
    const s = c - 8;
    g.fillStyle(toHex(DIR_DARK[dir]!), 1);
    g.fillRoundedRect(-s / 2, -s / 2 + 5, s, s, s * 0.22);
    g.fillStyle(toHex(DIR_COLORS[dir]!), 1);
    g.fillRoundedRect(-s / 2, -s / 2, s, s, s * 0.22);
    // The arrow, drawn pointing up and turned.
    const a = this.add.graphics();
    a.fillStyle(0xffffff, 1);
    a.fillTriangle(0, -s * 0.32, s * 0.24, -s * 0.02, -s * 0.24, -s * 0.02);
    a.fillRect(-s * 0.08, -s * 0.04, s * 0.16, s * 0.34);
    a.setAngle(dir * 90);
    const { x, y } = this.cellXY(i);
    return this.add.container(x, y, [g, a]).setDepth(2);
  }

  private tap(i: number): void {
    if (!this.session.isHumanTurn() || this.busy() || this.state.result) return;
    if (this.state.arrows[i]! < 0) return;
    this.session.play(`t${i}`);
  }

  private changed(): void {
    const last = this.state.last;
    if (!last) return;
    const tile = this.tiles.get(last.cell);
    if (!tile) return;
    const dir = (this.state.arrows[last.cell] ?? -1) >= 0 ? this.state.arrows[last.cell]! : this.dirOf(tile);
    const [dx, dy] = POINTER_DIRS[dir]!;
    this.moving++;
    if (last.out) {
      // Off it goes, the way it points, and out of the board.
      this.tiles.delete(last.cell);
      cue('place');
      tile.setDepth(5);
      this.tweens.add({ targets: tile, x: tile.x + dx * 700, y: tile.y + dy * 700, duration: 420, ease: 'Cubic.easeIn', onComplete: () => (tile.destroy(), this.moving--) });
    } else {
      // Bump: a lunge into whatever is in the way, and back.
      cue('thud');
      this.cameras.main.shake(100, 0.004);
      this.tweens.add({ targets: tile, x: tile.x + dx * this.cell * 0.3, y: tile.y + dy * this.cell * 0.3, duration: 90, yoyo: true, ease: 'Quad.easeOut', onComplete: () => this.moving-- });
    }
    if (this.state.result) cue(this.state.result.winners.length ? 'win' : 'lose');
    this.drawHearts();
  }

  /** The direction a tile shows, read from its arrow. */
  private dirOf(tile: GameObjects.Container): number {
    const arrow = tile.list[1] as GameObjects.Graphics;
    return ((Math.round(arrow.angle / 90) % 4) + 4) % 4;
  }

  private key(key: string): boolean {
    const n = this.state.size;
    const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -n, ArrowDown: n } as Record<string, number>)[key];
    if (step !== undefined) {
      const col = this.focus % n;
      if (!((step === -1 && col === 0) || (step === 1 && col === n - 1))) {
        const next = this.focus + step;
        if (next >= 0 && next < n * n) this.focus = next;
      }
      const { x, y } = this.cellXY(this.focus);
      moveRing(this, this.ring, x, y);
      return true;
    }
    if (key === 'Enter' || key === ' ') {
      this.tap(this.focus);
      return true;
    }
    return false;
  }

  private drawHearts(): void {
    const g = this.hearts.clear();
    for (let i = 0; i < POINTER_LIVES; i++) {
      const x = W / 2 + (i - (POINTER_LIVES - 1) / 2) * 56;
      const y = 50;
      const on = i < this.state.lives;
      g.fillStyle(on ? toHex(COLORS.tomato) : 0xe6e0f4, 1);
      g.fillCircle(x - 9, y - 5, 12);
      g.fillCircle(x + 9, y - 5, 12);
      g.fillTriangle(x - 20, y, x + 20, y, x, y + 22);
    }
  }

  /** The bands the board keeps to, for the layout check. */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    return [
      { name: 'hearts', top: 30, bottom: 74 },
      { name: 'grid', top: GRID.y - 10, bottom: GRID.y + GRID.w + 16 },
    ];
  }
}

export function pointerStatus(state: PointerState): string | undefined {
  if (state.result) return undefined;
  return `${state.left} ${state.left === 1 ? 'arrow' : 'arrows'} to clear`;
}

export function pointerResult(state: PointerState): string | undefined {
  if (!state.result) return undefined;
  return state.result.winners.length ? `Clear! ${state.lives === POINTER_LIVES ? 'Not a single bump. 🎉' : `${state.lives} ${state.lives === 1 ? 'heart' : 'hearts'} left.`}` : 'Out of hearts.';
}
