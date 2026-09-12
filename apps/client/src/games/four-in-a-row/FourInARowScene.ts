import { cellIndex, COLS, ROWS, type FourInARowMove, type FourInARowState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import type { Session } from '../../session';

const CELL = 100;
export const FOUR_IN_A_ROW_SIZE = { width: COLS * CELL, height: ROWS * CELL };

const BOARD_COLOR = 0x2d4bb3;
const HOLE_COLOR = 0x1b1d2b;
const SEAT_COLORS = [0xffd23f, 0xff6b6b];
const RADIUS = CELL / 2 - 10;

const cellCenter = (col: number, row: number) => ({
  x: col * CELL + CELL / 2,
  y: (ROWS - 1 - row) * CELL + CELL / 2,
});

export class FourInARowScene extends Scene {
  private board!: GameObjects.Graphics;
  private falling: GameObjects.Arc | null = null;
  private shownMoves = 0;

  constructor(private readonly session: Session<FourInARowMove>) {
    super('four-in-a-row');
  }

  create(): void {
    this.board = this.add.graphics();

    for (let col = 0; col < COLS; col++) {
      this.add
        .zone(col * CELL + CELL / 2, (ROWS * CELL) / 2, CELL, ROWS * CELL)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.session.play(col));
    }

    const unsubscribe = this.session.subscribe(() => this.onChange());
    this.events.once('shutdown', unsubscribe);
    this.draw(null);
  }

  private onChange(): void {
    const state = this.session.state as FourInARowState;
    const isNewMove = this.session.moves.length > this.shownMoves && state.lastMove !== null;
    this.shownMoves = this.session.moves.length;
    if (!isNewMove || state.lastMove === null) {
      this.draw(null);
      return;
    }

    // Animate the newest disc falling into place, then draw it for real.
    const col = state.lastMove;
    const row = (state.heights[col] ?? 1) - 1;
    const seat = state.board[cellIndex(col, row)] ?? 0;
    this.draw(cellIndex(col, row));

    this.falling?.destroy();
    const target = cellCenter(col, row);
    const disc = this.add.circle(target.x, -CELL / 2, RADIUS, SEAT_COLORS[seat]);
    this.children.moveBelow(disc, this.board);
    this.falling = disc;
    this.tweens.add({
      targets: disc,
      y: target.y,
      duration: 120 + (ROWS - row) * 45,
      ease: 'Bounce.easeOut',
      onComplete: () => {
        disc.destroy();
        if (this.falling === disc) this.falling = null;
        this.draw(null);
      },
    });
  }

  /** Draws the board; `hideCell` stays empty while its disc is still falling. */
  private draw(hideCell: number | null): void {
    const state = this.session.state as FourInARowState;
    const g = this.board;
    g.clear();

    // Board face with holes: discs show through as colored circles, empty holes as background.
    g.fillStyle(BOARD_COLOR, 1);
    g.fillRoundedRect(0, 0, COLS * CELL, ROWS * CELL, 24);

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const index = cellIndex(col, row);
        const disc = index === hideCell ? null : state.board[index];
        const { x, y } = cellCenter(col, row);
        g.fillStyle(disc === null || disc === undefined ? HOLE_COLOR : (SEAT_COLORS[disc] ?? 0xffffff), 1);
        g.fillCircle(x, y, RADIUS);
      }
    }

    if (state.winLine && hideCell === null) {
      g.lineStyle(8, 0xffffff, 0.9);
      for (const index of state.winLine) {
        const { x, y } = cellCenter(index % COLS, Math.floor(index / COLS));
        g.strokeCircle(x, y, RADIUS - 4);
      }
    }
  }
}
