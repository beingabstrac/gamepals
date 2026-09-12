import { winningLine, type TicTacToeMove, type TicTacToeState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import type { Session } from '../../session';

const SIZE = 600;
const CELL = SIZE / 3;
const PAD = 36;
const GRID_COLOR = 0x5a5f80;
const SEAT_COLORS = [0x4f8cff, 0xff6b6b];

const cellCenter = (index: number) => ({
  x: (index % 3) * CELL + CELL / 2,
  y: Math.floor(index / 3) * CELL + CELL / 2,
});

export class TicTacToeScene extends Scene {
  private marks!: GameObjects.Graphics;

  constructor(private readonly session: Session<TicTacToeMove>) {
    super('tic-tac-toe');
  }

  create(): void {
    const grid = this.add.graphics();
    grid.lineStyle(10, GRID_COLOR, 1);
    for (let i = 1; i < 3; i++) {
      grid.lineBetween(i * CELL, PAD, i * CELL, SIZE - PAD);
      grid.lineBetween(PAD, i * CELL, SIZE - PAD, i * CELL);
    }

    this.marks = this.add.graphics();

    for (let index = 0; index < 9; index++) {
      const { x, y } = cellCenter(index);
      this.add
        .zone(x, y, CELL, CELL)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.session.play(index));
    }

    const unsubscribe = this.session.subscribe(() => this.redraw());
    this.events.once('shutdown', unsubscribe);
    this.redraw();
  }

  private redraw(): void {
    const { board } = this.session.state as TicTacToeState;
    const g = this.marks;
    g.clear();

    board.forEach((cell, index) => {
      if (cell === null) return;
      const { x, y } = cellCenter(index);
      const r = CELL / 2 - 40;
      g.lineStyle(16, SEAT_COLORS[cell] ?? 0xffffff, 1);
      if (cell === 0) {
        g.lineBetween(x - r, y - r, x + r, y + r);
        g.lineBetween(x + r, y - r, x - r, y + r);
      } else {
        g.strokeCircle(x, y, r);
      }
    });

    const line = winningLine(board);
    if (line) {
      const from = cellCenter(line[0]);
      const to = cellCenter(line[2]);
      g.lineStyle(12, 0xffffff, 0.85);
      g.lineBetween(from.x, from.y, to.x, to.y);
    }
  }
}
