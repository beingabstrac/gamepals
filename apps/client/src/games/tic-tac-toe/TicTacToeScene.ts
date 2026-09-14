import { winningLine, type Cell, type TicTacToeMove, type TicTacToeState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import type { Session } from '../../session';
import { COLORS, toHex } from '../../theme';
import { fitCamera } from '../crisp';
import { applySpeed } from '../../autoplay';
const SIZE = 600;
export const TIC_TAC_TOE_SIZE = { width: SIZE, height: SIZE };

const CELL = SIZE / 3;
const PAD = 40;
const GRID_COLOR = 0xcdbff7;
const SEAT_COLORS = [toHex(COLORS.tomato), toHex(COLORS.sky)];
const INK = toHex(COLORS.ink);
const MARK_RADIUS = CELL / 2 - 46;
const MARK_WIDTH = 20;

const cellCenter = (index: number) => ({
  x: (index % 3) * CELL + CELL / 2,
  y: Math.floor(index / 3) * CELL + CELL / 2,
});

/** A stroke with round caps, drawn `t` (0–1) of the way from a to b — like a pen. */
function penLine(g: GameObjects.Graphics, ax: number, ay: number, bx: number, by: number, t: number, width: number, color: number): void {
  if (t <= 0) return;
  const ex = ax + (bx - ax) * t;
  const ey = ay + (by - ay) * t;
  g.lineStyle(width, color, 1);
  g.lineBetween(ax, ay, ex, ey);
  g.fillStyle(color, 1);
  g.fillCircle(ax, ay, width / 2);
  g.fillCircle(ex, ey, width / 2);
}

/** X is two strokes, O is one loop; `t` animates the drawing. */
function drawMark(g: GameObjects.Graphics, seat: number, x: number, y: number, t = 1): void {
  const r = MARK_RADIUS;
  const color = SEAT_COLORS[seat] ?? INK;
  if (seat === 0) {
    penLine(g, x - r, y - r, x + r, y + r, Math.min(t * 2, 1), MARK_WIDTH, color);
    penLine(g, x + r, y - r, x - r, y + r, Math.max((t - 0.5) * 2, 0), MARK_WIDTH, color);
    return;
  }
  const start = -Math.PI / 2;
  const end = start + Math.PI * 2 * t;
  g.lineStyle(MARK_WIDTH, color, 1);
  g.beginPath();
  g.arc(x, y, r, start, end, false);
  g.strokePath();
  g.fillStyle(color, 1);
  g.fillCircle(x + Math.cos(start) * r, y + Math.sin(start) * r, MARK_WIDTH / 2);
  g.fillCircle(x + Math.cos(end) * r, y + Math.sin(end) * r, MARK_WIDTH / 2);
}

export class TicTacToeScene extends Scene {
  private marks!: GameObjects.Graphics;
  private shownMoves = 0;
  private winShown = false;

  constructor(private readonly session: Session<TicTacToeMove>) {
    super('tic-tac-toe');
  }

  create(): void {
    fitCamera(this, SIZE, SIZE);
    applySpeed(this);

    const grid = this.add.graphics();
    grid.fillStyle(GRID_COLOR, 1);
    for (let i = 1; i < 3; i++) {
      grid.fillRoundedRect(i * CELL - 6, PAD, 12, SIZE - 2 * PAD, 6);
      grid.fillRoundedRect(PAD, i * CELL - 6, SIZE - 2 * PAD, 12, 6);
    }
    grid.setAlpha(0).setY(12);
    this.tweens.add({ targets: grid, alpha: 1, y: 0, duration: 420, ease: 'Back.easeOut' });

    this.marks = this.add.graphics();

    for (let index = 0; index < 9; index++) {
      const { x, y } = cellCenter(index);
      this.add
        .zone(x, y, CELL, CELL)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.session.play(index));
    }

    this.shownMoves = this.session.moves.length;
    const unsubscribe = this.session.subscribe(() => this.onChange());
    this.events.once('shutdown', unsubscribe);
    this.draw(null);
  }

  private onChange(): void {
    const { moves } = this.session;
    if (moves.length <= this.shownMoves) {
      this.draw(null);
      return;
    }
    this.shownMoves = moves.length;
    const last = moves[moves.length - 1]!;
    this.draw(last);

    const seat = (this.session.state as TicTacToeState).board[last];
    if (seat === null || seat === undefined) return;
    const { x, y } = cellCenter(last);

    // Draw the new mark like a pen stroke, then give it a little squash as it "lands".
    const pen = this.add.graphics().setPosition(x, y);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: seat === 0 ? 300 : 280,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        pen.clear();
        drawMark(pen, seat, 0, 0, tween.getValue() ?? 1);
      },
      onComplete: () => {
        this.tweens.add({
          targets: pen,
          scaleX: 1.1,
          scaleY: 0.9,
          duration: 70,
          yoyo: true,
          ease: 'Quad.easeOut',
          onComplete: () => {
            pen.destroy();
            this.draw(null);
          },
        });
      },
    });
  }

  /** Draws every settled mark; `hideCell` stays empty while its mark is being drawn. */
  private draw(hideCell: number | null): void {
    const { board } = this.session.state as TicTacToeState;
    const g = this.marks;
    g.clear();
    board.forEach((cell, index) => {
      if (cell === null || index === hideCell) return;
      const { x, y } = cellCenter(index);
      drawMark(g, cell, x, y);
    });
    if (hideCell === null) this.showWin(board);
  }

  private showWin(board: readonly Cell[]): void {
    const line = winningLine(board);
    if (!line || this.winShown) return;
    this.winShown = true;

    const from = cellCenter(line[0]);
    const to = cellCenter(line[2]);
    const strike = this.add.graphics();
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 320,
      ease: 'Cubic.easeOut',
      onUpdate: (tween) => {
        strike.clear();
        penLine(strike, from.x, from.y, to.x, to.y, tween.getValue() ?? 1, 14, INK);
      },
      onComplete: () => this.cameras.main.shake(140, 0.004),
    });
  }
}
