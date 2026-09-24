import type { MazeDir, MazeState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera } from '../crisp';
import { onKeys } from '../keys';

const W = 600;
const H = 660;
export const MAZE_CANVAS = { width: W, height: H };
export const MAZE_COLORS = [COLORS.mint];

const BOARD = { x: 30, y: 60, w: 540 };
/** A swipe must travel this far (canvas px) to count. */
const SWIPE = 28;

/**
 * Maze Paint. The rules roll the ball and keep what is painted; the scene draws the maze as
 * chunky lilac walls on white floor, rolls the ball square by square with the paint following
 * it, and squashes the ball against the wall it stops at.
 */
export class MazeScene extends Scene {
  private floor!: GameObjects.Graphics;
  private paint!: GameObjects.Graphics;
  private ball!: GameObjects.Container;
  private shown: boolean[] = [];
  private rolling = false;
  private start: { x: number; y: number } | null = null;

  constructor(private readonly session: Session<MazeDir>) {
    super('maze-paint');
  }

  private get state(): MazeState {
    return this.session.state as MazeState;
  }

  private get cell(): number {
    return BOARD.w / this.state.size;
  }

  private cellXY(i: number): { x: number; y: number } {
    const n = this.state.size;
    return { x: BOARD.x + (i % n) * this.cell + this.cell / 2, y: BOARD.y + Math.floor(i / n) * this.cell + this.cell / 2 };
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.floor = this.add.graphics();
    this.paint = this.add.graphics();
    this.drawMaze();
    this.shown = [...this.state.painted];
    this.drawPaint();
    const g = this.add.graphics();
    const r = this.cell * 0.34;
    g.fillStyle(toHex(DARK.grape), 1);
    g.fillCircle(0, 3, r);
    g.fillStyle(toHex(COLORS.grape), 1);
    g.fillCircle(0, 0, r);
    g.fillStyle(0xffffff, 0.45);
    g.fillCircle(-r * 0.35, -r * 0.35, r * 0.28);
    const at = this.cellXY(this.state.ball);
    this.ball = this.add.container(at.x, at.y, [g]).setDepth(3);
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => (this.start = { x: p.worldX, y: p.worldY }));
    const swipe = (p: { worldX: number; worldY: number }) => {
      if (!this.start) return;
      const dx = p.worldX - this.start.x;
      const dy = p.worldY - this.start.y;
      if (Math.hypot(dx, dy) < SWIPE) return;
      this.start = null;
      this.roll(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : dy > 0 ? 'd' : 'u');
    };
    this.input.on('pointermove', swipe);
    this.input.on('pointerup', (p: { worldX: number; worldY: number }) => {
      swipe(p);
      this.start = null;
    });
    onKeys(this, (key) => {
      const dir = ({ ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', w: 'u', s: 'd', a: 'l', d: 'r' } as Record<string, MazeDir>)[key];
      if (!dir) return false;
      this.roll(dir);
      return true;
    });
    const off = this.session.subscribe(() => this.changed());
    this.session.holdBots = () => this.busy();
    this.events.once('shutdown', () => {
      off();
      this.session.holdBots = null;
    });
  }

  busy(): boolean {
    return this.rolling;
  }

  private roll(dir: MazeDir): void {
    if (!this.session.isHumanTurn() || this.busy() || this.state.result) return;
    if (!this.state.legalMoves(0).includes(dir)) {
      // A nudge against the wall, so the swipe was felt.
      const [dx, dy] = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] }[dir];
      cue('wall');
      this.tweens.add({ targets: this.ball, x: this.ball.x + dx! * 6, y: this.ball.y + dy! * 6, duration: 60, yoyo: true });
      return;
    }
    this.session.play(dir);
  }

  private changed(): void {
    const last = this.state.last;
    if (!last) return;
    const n = this.state.size;
    const steps: number[] = [];
    // Every square from the start of the roll to the end, in order.
    const [dx, dy] = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] }[last.dir];
    let i = last.from;
    while (i !== last.to) {
      i = i + dx! + dy! * n;
      steps.push(i);
    }
    this.rolling = true;
    cue('roll');
    const each = Math.max(28, Math.min(60, 360 / steps.length));
    const next = (k: number): void => {
      if (k >= steps.length) {
        // Squash against the wall it stopped at.
        this.tweens.add({ targets: this.ball, scaleX: dx ? 0.75 : 1.2, scaleY: dy ? 0.75 : 1.2, duration: 70, yoyo: true, onComplete: () => this.finish() });
        return;
      }
      const at = this.cellXY(steps[k]!);
      this.tweens.add({
        targets: this.ball,
        x: at.x,
        y: at.y,
        duration: each,
        onComplete: () => {
          this.shown[steps[k]!] = true;
          this.drawPaint();
          next(k + 1);
        },
      });
    };
    next(0);
  }

  private finish(): void {
    this.rolling = false;
    this.shown = [...this.state.painted];
    this.drawPaint();
    if (this.state.result) cue('win');
    else if (this.state.last?.fresh.length) cue('place');
  }

  private drawMaze(): void {
    const g = this.floor.clear();
    const s = this.state;
    const c = this.cell;
    g.fillStyle(toHex('#C9C2E0'), 1);
    g.fillRoundedRect(BOARD.x - 10, BOARD.y - 10 + 6, BOARD.w + 20, BOARD.w + 20, 26);
    g.fillStyle(toHex('#DAD4EE'), 1);
    g.fillRoundedRect(BOARD.x - 10, BOARD.y - 10, BOARD.w + 20, BOARD.w + 20, 26);
    s.open.forEach((open, i) => {
      const { x, y } = this.cellXY(i);
      if (open) {
        g.fillStyle(0xffffff, 1);
        g.fillRect(x - c / 2, y - c / 2, c, c);
      } else {
        // Walls stand up a little, with a lip.
        g.fillStyle(toHex('#B3AAD6'), 1);
        g.fillRoundedRect(x - c / 2 + 2, y - c / 2 + 5, c - 4, c - 4, c * 0.2);
        g.fillStyle(toHex('#CFC8EA'), 1);
        g.fillRoundedRect(x - c / 2 + 2, y - c / 2 + 1, c - 4, c - 6, c * 0.2);
      }
    });
  }

  private drawPaint(): void {
    const g = this.paint.clear();
    const c = this.cell;
    this.shown.forEach((on, i) => {
      if (!on || !this.state.open[i]) return;
      const { x, y } = this.cellXY(i);
      g.fillStyle(toHex(COLORS.mint), 1);
      g.fillRoundedRect(x - c / 2 + 1, y - c / 2 + 1, c - 2, c - 2, c * 0.18);
    });
  }

  /** The bands the page keeps to, for the layout check. */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    return [{ name: 'maze', top: BOARD.y - 10, bottom: BOARD.y + BOARD.w + 16 }];
  }
}

export function mazeStatus(state: MazeState): string | undefined {
  if (state.result) return undefined;
  return `${state.left} ${state.left === 1 ? 'square' : 'squares'} to paint · ${state.moves} ${state.moves === 1 ? 'roll' : 'rolls'}`;
}

export function mazeResult(state: MazeState): string | undefined {
  if (!state.result) return undefined;
  return `All painted in ${state.moves} rolls! 🎉`;
}
