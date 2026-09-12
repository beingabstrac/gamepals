import { winningLine, type Cell, type TicTacToeMove, type TicTacToeState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import type { Session } from '../../session';

const SIZE = 600;
const CELL = SIZE / 3;
const PAD = 36;
const GRID_COLOR = 0x6b72b8;
const SEAT_COLORS = [0x4f8cff, 0xff6b6b];
const MARK_RADIUS = CELL / 2 - 42;
const MARK_WIDTH = 18;

const cellCenter = (index: number) => ({
  x: (index % 3) * CELL + CELL / 2,
  y: Math.floor(index / 3) * CELL + CELL / 2,
});

function drawMark(g: GameObjects.Graphics, seat: number, x: number, y: number): void {
  const r = MARK_RADIUS;
  g.lineStyle(MARK_WIDTH, SEAT_COLORS[seat] ?? 0xffffff, 1);
  if (seat === 0) {
    g.lineBetween(x - r, y - r, x + r, y + r);
    g.lineBetween(x + r, y - r, x - r, y + r);
  } else {
    g.strokeCircle(x, y, r);
  }
}

export class TicTacToeScene extends Scene {
  private marks!: GameObjects.Graphics;
  private shownMoves = 0;
  private winShown = false;

  constructor(private readonly session: Session<TicTacToeMove>) {
    super('tic-tac-toe');
  }

  create(): void {
    const grid = this.add.graphics();
    grid.fillStyle(GRID_COLOR, 1);
    for (let i = 1; i < 3; i++) {
      grid.fillRoundedRect(i * CELL - 5, PAD, 10, SIZE - 2 * PAD, 5);
      grid.fillRoundedRect(PAD, i * CELL - 5, SIZE - 2 * PAD, 10, 5);
    }
    grid.setAlpha(0);
    this.tweens.add({ targets: grid, alpha: 1, duration: 250 });

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

    // Pop the newest mark in with a little overshoot, then bake it into the board.
    const seat = (this.session.state as TicTacToeState).board[last];
    if (seat === null || seat === undefined) return;
    const { x, y } = cellCenter(last);
    const pop = this.add.graphics().setPosition(x, y);
    drawMark(pop, seat, 0, 0);
    pop.setScale(0.2).setAlpha(0.6);
    this.tweens.add({
      targets: pop,
      scale: 1,
      alpha: 1,
      duration: 220,
      ease: 'Back.easeOut',
      onComplete: () => {
        pop.destroy();
        this.draw(null);
      },
    });
  }

  /** Draws every mark; `hideCell` stays empty while its mark animates in. */
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
    const progress = { t: 0 };
    this.tweens.add({
      targets: progress,
      t: 1,
      duration: 280,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        strike.clear();
        strike.lineStyle(14, 0xffffff, 0.95);
        strike.lineBetween(from.x, from.y, from.x + (to.x - from.x) * progress.t, from.y + (to.y - from.y) * progress.t);
      },
      onComplete: () => {
        this.cameras.main.shake(160, 0.006);
        this.tweens.add({ targets: strike, alpha: 0.45, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      },
    });
  }
}
