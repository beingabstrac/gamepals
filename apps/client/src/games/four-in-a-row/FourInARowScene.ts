import { cellIndex, COLS, ROWS, type FourInARowMove, type FourInARowState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera } from '../crisp';
import { applySpeed, SPEED } from '../../autoplay';
import { focusRing, isPress, moveRing, onKeys } from '../keys';
const CELL = 100;
const FACE_HEIGHT = ROWS * CELL;
const LIP = 16;
export const FOUR_IN_A_ROW_SIZE = { width: COLS * CELL, height: FACE_HEIGHT + LIP };

const BOARD = toHex(COLORS.sky);
const BOARD_LIP = toHex(DARK.sky);
const HOLE = 0xeaf3ff;
const DISC = [toHex(COLORS.sunny), toHex(COLORS.tomato)];
const DISC_RING = [toHex(DARK.sunny), toHex(DARK.tomato)];
const RADIUS = CELL / 2 - 11;

/** Real falling: gravity in logical px/s², and how much speed survives each bounce. */
const GRAVITY = 5200;
const RESTITUTION = 0.3;
const SETTLE_SPEED = 260;

const cellCenter = (col: number, row: number) => ({
  x: col * CELL + CELL / 2,
  y: (ROWS - 1 - row) * CELL + CELL / 2,
});

interface Drop {
  readonly disc: GameObjects.Container;
  readonly targetY: number;
  vy: number;
}

export class FourInARowScene extends Scene {
  private board!: GameObjects.Graphics;
  private drop: Drop | null = null;
  private winRings: GameObjects.Graphics | null = null;
  private shownMoves = 0;

  constructor(private readonly session: Session<FourInARowMove>) {
    super('four-in-a-row');
  }

  create(): void {
    fitCamera(this, FOUR_IN_A_ROW_SIZE.width, FOUR_IN_A_ROW_SIZE.height);
    applySpeed(this);
    this.board = this.add.graphics();

    for (let col = 0; col < COLS; col++) {
      this.add
        .zone(col * CELL + CELL / 2, FACE_HEIGHT / 2, CELL, FACE_HEIGHT)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.session.play(col));
    }

    // Keyboard: 1–7 drops into a column, or arrows to pick one and Enter, Space or Down to drop.
    const ring = focusRing(this, CELL - 8, FACE_HEIGHT - 8, 40);
    let cursor = Math.floor(COLS / 2);
    onKeys(this, (key) => {
      const digit = Number(key);
      if (Number.isInteger(digit) && digit >= 1 && digit <= COLS) {
        this.session.play(digit - 1);
        return true;
      }
      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        cursor = Math.min(COLS - 1, Math.max(0, cursor + (key === 'ArrowLeft' ? -1 : 1)));
        moveRing(this, ring, cursor * CELL + CELL / 2, FACE_HEIGHT / 2);
        return true;
      }
      if ((isPress(key) || key === 'ArrowDown') && ring.visible) {
        this.session.play(cursor);
        return true;
      }
      return false;
    });

    this.shownMoves = this.session.moves.length;
    const unsubscribe = this.session.subscribe(() => this.onChange());
    this.events.once('shutdown', unsubscribe);
    this.draw(null);
  }

  update(_time: number, delta: number): void {
    const drop = this.drop;
    if (!drop) return;
    const dt = Math.min(delta, 50) * SPEED / 1000;
    drop.vy += GRAVITY * dt;
    drop.disc.y += drop.vy * dt;
    if (drop.disc.y < drop.targetY) return;

    drop.disc.y = drop.targetY;
    if (drop.vy > SETTLE_SPEED) {
      // Bounce: lose most of the speed and squash on impact (volume kept: wider as it gets shorter).
      const squash = Math.min(drop.vy / 3000, 0.25);
      this.tweens.add({ targets: drop.disc, scaleX: 1 + squash, scaleY: 1 - squash, duration: 60, yoyo: true, ease: 'Quad.easeOut' });
      drop.vy = -drop.vy * RESTITUTION;
      return;
    }
    this.drop = null;
    this.tweens.killTweensOf(drop.disc);
    drop.disc.destroy();
    this.draw(null);
  }

  /**
   * A disc falling under gravity is not a tween, so nothing else can tell. Without this the result
   * sheet says who won while the winning disc is still a row above the gap it is falling into, and
   * the gallery photographs it there.
   */
  busy(): boolean {
    return this.drop !== null;
  }

  private makeDisc(seat: number, x: number, y: number): GameObjects.Container {
    return this.add.container(x, y, [
      this.add.circle(0, 0, RADIUS, DISC[seat]),
      this.add.circle(0, 0, RADIUS - 13, DISC[seat]).setStrokeStyle(6, DISC_RING[seat] ?? 0x000000),
    ]);
  }

  private onChange(): void {
    const state = this.session.state as FourInARowState;
    const isNewMove = this.session.moves.length > this.shownMoves && state.lastMove !== null;
    this.shownMoves = this.session.moves.length;
    if (!isNewMove || state.lastMove === null) {
      this.draw(null);
      return;
    }

    // Finish any disc still bouncing, then drop the new one from above the board.
    if (this.drop) {
      this.tweens.killTweensOf(this.drop.disc);
      this.drop.disc.destroy();
      this.drop = null;
    }
    const col = state.lastMove;
    const row = (state.heights[col] ?? 1) - 1;
    const seat = state.board[cellIndex(col, row)] ?? 0;
    this.draw(cellIndex(col, row));

    const target = cellCenter(col, row);
    this.drop = { disc: this.makeDisc(seat, target.x, -RADIUS), targetY: target.y, vy: 0 };
  }

  /** Draws the board; `hideCell` stays empty while its disc is still falling. */
  private draw(hideCell: number | null): void {
    const state = this.session.state as FourInARowState;
    const g = this.board;
    g.clear();

    g.fillStyle(BOARD_LIP, 1);
    g.fillRoundedRect(0, LIP, COLS * CELL, FACE_HEIGHT, 30);
    g.fillStyle(BOARD, 1);
    g.fillRoundedRect(0, 0, COLS * CELL, FACE_HEIGHT, 30);

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const index = cellIndex(col, row);
        const disc = index === hideCell ? null : state.board[index];
        const { x, y } = cellCenter(col, row);
        if (disc === null || disc === undefined) {
          g.fillStyle(HOLE, 1);
          g.fillCircle(x, y, RADIUS);
          continue;
        }
        g.fillStyle(DISC[disc] ?? HOLE, 1);
        g.fillCircle(x, y, RADIUS);
        g.lineStyle(6, DISC_RING[disc] ?? 0x000000, 1);
        g.strokeCircle(x, y, RADIUS - 13);
      }
    }

    if (state.winLine && hideCell === null) this.showWin(state.winLine);
  }

  private showWin(line: readonly number[]): void {
    if (this.winRings) return;
    const rings = this.add.graphics();
    rings.lineStyle(8, 0xffffff, 1);
    for (const index of line) {
      const { x, y } = cellCenter(index % COLS, Math.floor(index / COLS));
      rings.strokeCircle(x, y, RADIUS - 2);
    }
    this.winRings = rings;
    this.cameras.main.shake(160, 0.005);
    this.tweens.add({ targets: rings, alpha: 0.2, duration: 480, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
}
