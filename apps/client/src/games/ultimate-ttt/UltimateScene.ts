import { LINES, ultimateSquare, type UltimateMove, type UltimateState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { ROOM_TONES, tone } from '../../look';
import type { Session } from '../../session';
import { COLORS, toHex } from '../../theme';
import { fitCamera } from '../crisp';
import { applySpeed } from '../../autoplay';
import { arrow, focusRing, isPress, moveRing, onKeys } from '../keys';

const SIZE = 630;
export const ULTIMATE_SIZE = { width: SIZE, height: SIZE };

const BIG = SIZE / 3;
const INSET = 14;
const SMALL = (BIG - INSET * 2) / 3;
const SEAT_HEX = [toHex(COLORS.tomato), toHex(COLORS.sky)];
const INK = toHex(COLORS.ink);
const GRID = tone(0xcdbff7, ROOM_TONES.line);
const SUNNY = toHex(COLORS.sunny);

/** Where the small boards are, for plain-language messages. */
export const BOARD_NAMES = ['top-left', 'top', 'top-right', 'left', 'middle', 'right', 'bottom-left', 'bottom', 'bottom-right'];

const boardOrigin = (board: number) => ({ x: (board % 3) * BIG, y: Math.floor(board / 3) * BIG });
function squareCenter(square: number): { x: number; y: number } {
  const board = Math.floor(square / 9);
  const cell = square % 9;
  const o = boardOrigin(board);
  return { x: o.x + INSET + ((cell % 3) + 0.5) * SMALL, y: o.y + INSET + (Math.floor(cell / 3) + 0.5) * SMALL };
}
const boardCenter = (board: number) => ({ x: boardOrigin(board).x + BIG / 2, y: boardOrigin(board).y + BIG / 2 });

/** The square at a column and row of the whole 9 by 9 grid. */
const gridSquare = (gx: number, gy: number) => (Math.floor(gy / 3) * 3 + Math.floor(gx / 3)) * 9 + (gy % 3) * 3 + (gx % 3);
const gridOf = (square: number) => {
  const board = Math.floor(square / 9);
  const cell = square % 9;
  return { gx: (board % 3) * 3 + (cell % 3), gy: Math.floor(board / 3) * 3 + Math.floor(cell / 3) };
};

/** X is two strokes, O is a ring; round caps like a marker pen. */
function drawMark(g: GameObjects.Graphics, seat: number, x: number, y: number, r: number, width: number): void {
  const color = SEAT_HEX[seat] ?? INK;
  g.lineStyle(width, color, 1);
  g.fillStyle(color, 1);
  if (seat === 0) {
    for (const [ax, ay, bx, by] of [[x - r, y - r, x + r, y + r], [x + r, y - r, x - r, y + r]] as const) {
      g.lineBetween(ax, ay, bx, by);
      g.fillCircle(ax, ay, width / 2);
      g.fillCircle(bx, by, width / 2);
    }
  } else {
    g.strokeCircle(x, y, r);
  }
}

export class UltimateScene extends Scene {
  private layer!: GameObjects.Graphics;
  private shownMoves = 0;
  private cursor = 40;
  private ring!: GameObjects.Graphics;

  constructor(private readonly session: Session<UltimateMove>) {
    super('ultimate-ttt');
  }

  private get state(): UltimateState {
    return this.session.state as UltimateState;
  }

  create(): void {
    fitCamera(this, SIZE, SIZE);
    applySpeed(this);
    this.layer = this.add.graphics();

    this.add
      .zone(SIZE / 2, SIZE / 2, SIZE, SIZE)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (p: { worldX: number; worldY: number }) => {
        const board = Math.min(2, Math.floor(p.worldX / BIG)) + Math.min(2, Math.floor(p.worldY / BIG)) * 3;
        const o = boardOrigin(board);
        const col = Math.floor((p.worldX - o.x - INSET) / SMALL);
        const row = Math.floor((p.worldY - o.y - INSET) / SMALL);
        if (col < 0 || col > 2 || row < 0 || row > 2) return;
        this.play(board * 9 + row * 3 + col);
      });

    // Keyboard: arrows move over the 81 squares, skipping ones you can't play; Enter or Space plays.
    this.ring = focusRing(this, SMALL - 6, SMALL - 6, 12);
    onKeys(this, (key) => {
      const step = arrow(key);
      if (step) {
        this.moveCursor(step[0], step[1]);
        return true;
      }
      if (isPress(key) && this.ring.visible) {
        this.play(this.cursor);
        return true;
      }
      return false;
    });

    this.shownMoves = this.session.moves.length;
    const unsubscribe = this.session.subscribe(() => this.onChange());
    this.events.once('shutdown', unsubscribe);
    this.draw();
  }

  private legalSquares(): number[] {
    const state = this.state;
    return state.legalMoves(state.currentSeat).map(ultimateSquare);
  }

  private play(square: number): void {
    if (!this.session.isHumanTurn()) return;
    if (this.legalSquares().includes(square)) this.session.play(`u${square}`);
  }

  private moveCursor(dx: number, dy: number): void {
    const legal = new Set(this.legalSquares());
    let { gx, gy } = gridOf(this.cursor);
    for (let i = 0; i < 9; i++) {
      gx += dx;
      gy += dy;
      if (gx < 0 || gx > 8 || gy < 0 || gy > 8) return this.showCursor();
      if (legal.has(gridSquare(gx, gy))) {
        this.cursor = gridSquare(gx, gy);
        break;
      }
    }
    this.showCursor();
  }

  private showCursor(): void {
    const { x, y } = squareCenter(this.cursor);
    moveRing(this, this.ring, x, y);
  }

  private onChange(): void {
    const moves = this.session.moves;
    const before = this.shownMoves;
    this.shownMoves = moves.length;
    this.draw();
    if (moves.length <= before) return;
    const state = this.state;
    const square = state.last;
    if (square === null) return;
    const seat = state.cells[square]!;
    const board = Math.floor(square / 9);

    // The new mark pops in with a squash.
    const { x, y } = squareCenter(square);
    const pop = this.add.graphics().setPosition(x, y).setScale(0.3).setDepth(4);
    drawMark(pop, seat, 0, 0, SMALL * 0.26, 7);
    this.tweens.add({ targets: pop, scale: 1, duration: 200, ease: 'Back.easeOut', onComplete: () => pop.destroy() });

    // A small board just won: its big mark stamps down.
    if (typeof state.boards[board] === 'number') {
      const c = boardCenter(board);
      const stamp = this.add.graphics().setPosition(c.x, c.y).setScale(1.7).setAlpha(0).setDepth(5);
      drawMark(stamp, seat, 0, 0, BIG * 0.3, 20);
      this.tweens.add({
        targets: stamp,
        scale: 1,
        alpha: 1,
        duration: 260,
        ease: 'Back.easeIn',
        onComplete: () => {
          this.cameras.main.shake(120, 0.004);
          this.tweens.add({ targets: stamp, alpha: 0, delay: 200, duration: 200, onComplete: () => stamp.destroy() });
        },
      });
    }

    // The board the next player is sent to pulses once so the eye follows the send.
    if (!state.result && state.active !== null) {
      const o = boardOrigin(state.active);
      const pulse = this.add.graphics().setDepth(3);
      pulse.lineStyle(8, SUNNY, 1);
      pulse.strokeRoundedRect(o.x + 5, o.y + 5, BIG - 10, BIG - 10, 20);
      this.tweens.add({ targets: pulse, alpha: 0, duration: 520, ease: 'Sine.easeOut', onComplete: () => pulse.destroy() });
    }

    // Keep the keyboard ring on a square that can be played.
    const legal = this.legalSquares();
    if (legal.length && !legal.includes(this.cursor)) {
      this.cursor = legal.includes(40) ? 40 : legal[Math.floor(legal.length / 2)]!;
      if (this.ring.visible) this.showCursor();
    }
  }

  private draw(): void {
    const state = this.state;
    const g = this.layer.clear();
    // When every open board is live ("play anywhere"), highlighting them all says nothing,
    // so the glow is kept for when your choice is actually narrowed down.
    const open = state.boards.filter((mark) => mark === null).length;
    const anywhere = state.liveBoards.length >= open;
    const live = new Set(anywhere ? [] : state.liveBoards);

    for (let board = 0; board < 9; board++) {
      const o = boardOrigin(board);
      const mark = state.boards[board];
      // Tile: sunny glow when live, soft when not.
      g.fillStyle(tone(0xe9e4f5, ROOM_TONES.line), 1);
      g.fillRoundedRect(o.x + 6, o.y + 10, BIG - 12, BIG - 12, 20);
      g.fillStyle(live.has(board) ? 0xfff3c4 : 0xffffff, 1);
      g.fillRoundedRect(o.x + 6, o.y + 6, BIG - 12, BIG - 12, 20);
      if (live.has(board)) {
        g.lineStyle(4, SUNNY, 1);
        g.strokeRoundedRect(o.x + 6, o.y + 6, BIG - 12, BIG - 12, 20);
      }
      // Small grid.
      g.fillStyle(GRID, 1);
      for (let i = 1; i < 3; i++) {
        g.fillRoundedRect(o.x + INSET + i * SMALL - 2, o.y + INSET + 6, 4, BIG - INSET * 2 - 12, 2);
        g.fillRoundedRect(o.x + INSET + 6, o.y + INSET + i * SMALL - 2, BIG - INSET * 2 - 12, 4, 2);
      }
      for (let cell = 0; cell < 9; cell++) {
        const square = board * 9 + cell;
        const seat = state.cells[square];
        if (seat === null || seat === undefined) continue;
        const { x, y } = squareCenter(square);
        if (square === state.last) {
          g.fillStyle(SUNNY, 0.45);
          g.fillCircle(x, y, SMALL * 0.42);
        }
        drawMark(g, seat, x, y, SMALL * 0.26, 7);
      }
      // A closed board fades; a won one wears its big mark.
      if (mark !== null) {
        g.fillStyle(mark === 'full' ? 0xd8d4e4 : 0xffffff, mark === 'full' ? 0.55 : 0.72);
        g.fillRoundedRect(o.x + 6, o.y + 6, BIG - 12, BIG - 12, 20);
        if (typeof mark === 'number') {
          const c = boardCenter(board);
          drawMark(g, mark, c.x, c.y, BIG * 0.3, 20);
        }
      } else if (!anywhere && !live.has(board) && !state.result) {
        g.fillStyle(0xffffff, 0.35);
        g.fillRoundedRect(o.x + 6, o.y + 6, BIG - 12, BIG - 12, 20);
      }
    }

    // The winning line across the big board.
    if (state.result && !state.result.draw) {
      const winner = state.result.winners[0];
      const line = LINES.find((l) => l.every((b) => state.boards[b] === winner));
      if (line) {
        const a = boardCenter(line[0]);
        const b = boardCenter(line[2]);
        g.lineStyle(16, INK, 1);
        g.lineBetween(a.x, a.y, b.x, b.y);
        g.fillStyle(INK, 1);
        g.fillCircle(a.x, a.y, 8);
        g.fillCircle(b.x, b.y, 8);
      }
    }
  }
}
