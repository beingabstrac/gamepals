import {
  BISHOP,
  colorOf,
  KING,
  KNIGHT,
  PAWN,
  QUEEN,
  readMove,
  ROOK,
  squareName,
  typeOf,
  type ChessEvent,
  type ChessMove,
  type ChessState,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import type { Session } from '../../session';
import { COLORS, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed } from '../../autoplay';
import { arrow, isPress, onKeys } from '../keys';
import { hex, ROOM, ROOM_COLORS } from '../../look';

const W = 600;
const H = 600;
/** The games room look needs room for a wooden frame around the squares. */
const PAD = ROOM ? 32 : 12;
const CELL = (W - PAD * 2) / 8;
export const CHESS_SIZE = { width: W, height: H };

const LIGHT = ROOM ? ROOM_COLORS.square : 0xfff1dc;
const DARK_SQUARE = ROOM ? ROOM_COLORS.squareDark : 0xc9b6f5;
const INK = ROOM ? ROOM_COLORS.ink : toHex(COLORS.ink);
const SUNNY = ROOM ? ROOM_COLORS.glow : toHex(COLORS.sunny);
const TOMATO = toHex(COLORS.tomato);
const WHITE_PIECE = ROOM ? ROOM_COLORS.white : 0xfffdf8;
const BLACK_PIECE = ROOM ? ROOM_COLORS.black : 0x3b3a4a;
const PROMOTIONS: readonly number[] = [QUEEN, ROOK, BISHOP, KNIGHT];
const PROMO_LETTER: Record<number, string> = { [QUEEN]: 'q', [ROOK]: 'r', [BISHOP]: 'b', [KNIGHT]: 'n' };

type Point = { x: number; y: number };

/**
 * Our own piece shapes, drawn flat: no chess font, no borrowed art. Each piece is built in a
 * box about 44 units wide so it fills its square, and every piece stands on the same base.
 */
function drawPiece(g: GameObjects.Graphics, piece: number, scale = 1): void {
  const white = colorOf(piece) === 0;
  const fill = white ? WHITE_PIECE : BLACK_PIECE;
  const line = white ? INK : (ROOM ? 0x8b7a5c : 0xf3efe6);
  const s = scale;
  const path = (points: readonly (readonly [number, number])[]) => {
    g.beginPath();
    points.forEach(([x, y], i) => (i === 0 ? g.moveTo(x * s, y * s) : g.lineTo(x * s, y * s)));
    g.closePath();
    g.fillPath();
    g.strokePath();
  };
  const disc = (x: number, y: number, r: number) => {
    g.fillCircle(x * s, y * s, r * s);
    g.strokeCircle(x * s, y * s, r * s);
  };
  /** The foot every piece shares. */
  const foot = () => {
    g.fillStyle(fill, 1);
    g.fillRoundedRect(-17 * s, 14 * s, 34 * s, 10 * s, 5 * s);
    g.strokeRoundedRect(-17 * s, 14 * s, 34 * s, 10 * s, 5 * s);
  };

  g.save();
  g.translateCanvas(0, 3 * s);
  g.fillStyle(fill, 1);
  g.lineStyle(3 * s, line, 1);
  switch (typeOf(piece)) {
    case PAWN:
      path([[-9, 14], [-5, -2], [5, -2], [9, 14]]);
      foot();
      disc(0, -9, 8);
      break;
    case ROOK:
      path([[-11, 14], [-8, -6], [8, -6], [11, 14]]);
      foot();
      g.fillStyle(fill, 1);
      g.fillRoundedRect(-15 * s, -20 * s, 30 * s, 15 * s, 3 * s);
      g.strokeRoundedRect(-15 * s, -20 * s, 30 * s, 15 * s, 3 * s);
      // Two battlement notches, cut in the square colour behind the piece.
      g.fillStyle(line, 1);
      for (const x of [-5.5, 5.5]) g.fillRoundedRect((x - 3) * s, -21 * s, 6 * s, 8 * s, 2 * s);
      break;
    case BISHOP:
      path([[-10, 14], [-6, -4], [6, -4], [10, 14]]);
      foot();
      g.fillStyle(fill, 1);
      path([[-9, -4], [-9, -12], [0, -26], [9, -12], [9, -4]]);
      g.lineStyle(3 * s, line, 1);
      g.lineBetween(-4 * s, -14 * s, 4 * s, -8 * s);
      break;
    case KNIGHT:
      // A horse's head facing right: jaw, muzzle, ears and mane in one silhouette.
      path([
        [-11, 14], [-7, 2], [-11, -4], [-8, -13], [-2, -19], [-5, -26], [2, -22],
        [6, -26], [9, -18], [16, -9], [14, -2], [5, 0], [9, 14],
      ]);
      foot();
      g.fillStyle(line, 1);
      g.fillCircle(3 * s, -14 * s, 2 * s);
      break;
    case QUEEN:
      path([[-12, 14], [-8, -2], [8, -2], [12, 14]]);
      foot();
      g.fillStyle(fill, 1);
      path([[-14, -2], [-14, -18], [-7, -9], [0, -22], [7, -9], [14, -18], [14, -2]]);
      for (const [x, y] of [[-14, -21], [0, -25], [14, -21]] as const) {
        g.fillStyle(fill, 1);
        disc(x, y, 3.5);
      }
      break;
    case KING:
      path([[-12, 14], [-8, -4], [8, -4], [12, 14]]);
      foot();
      g.fillStyle(fill, 1);
      g.fillRoundedRect(-14 * s, -19 * s, 28 * s, 15 * s, 5 * s);
      g.strokeRoundedRect(-14 * s, -19 * s, 28 * s, 15 * s, 5 * s);
      g.fillStyle(fill, 1);
      path([[-3, -19], [-3, -24], [-7, -24], [-7, -28], [-3, -28], [-3, -32], [3, -32], [3, -28], [7, -28], [7, -24], [3, -24], [3, -19]]);
      break;
  }
  g.restore();
}

export class ChessScene extends Scene {
  private boardG!: GameObjects.Graphics;
  private piecesG!: GameObjects.Graphics;
  private hintsG!: GameObjects.Graphics;
  private promoG!: GameObjects.Graphics;
  private ringG!: GameObjects.Graphics;
  private banner!: GameObjects.Text;
  private flipped = false;
  private selected: number | null = null;
  private cursor = 4;
  private ringVisible = false;
  /** A pawn is on the last row and the player is choosing what it becomes. */
  private promoting: { from: number; to: number } | null = null;
  private seen: ChessEvent | null = null;
  private busy = false;

  constructor(private readonly session: Session<ChessMove>) {
    super('chess');
  }

  private get state(): ChessState {
    return this.session.state as ChessState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    // Against a bot, the person's pieces sit at the bottom.
    const people = this.session.seats.flatMap((seat, i) => (seat.kind === 'human' ? [i] : []));
    this.flipped = people.length === 1 && people[0] === 1;
    this.seen = this.state.last;
    this.boardG = this.add.graphics();
    this.hintsG = this.add.graphics().setDepth(2);
    this.piecesG = this.add.graphics().setDepth(3);
    this.ringG = this.add.graphics().setDepth(4);
    this.promoG = this.add.graphics().setDepth(6);
    this.banner = sharpText(this, W / 2, H / 2, '', 34, COLORS.ink).setDepth(10).setAlpha(0).setStroke('#ffffff', 10);

    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.tap(p.worldX, p.worldY));
    onKeys(this, (key) => this.key(key));

    const unsubscribe = this.session.subscribe(() => this.onChange());
    this.events.once('shutdown', unsubscribe);
    this.drawBoard();
    this.drawPieces();
    if (ROOM) this.drawCoords();
  }

  /** Brass letters and numbers on the frame, the way a real board has them. */
  private drawCoords(): void {
    for (let i = 0; i < 8; i++) {
      const file = this.flipped ? 7 - i : i;
      const rank = this.flipped ? i : 7 - i;
      const at = PAD + (i + 0.5) * CELL;
      sharpText(this, at, H - PAD / 2 - 2, 'abcdefgh'[file]!, 15, hex(ROOM_COLORS.brass)).setDepth(1).setAlpha(0.85);
      sharpText(this, PAD / 2 + 1, at, String(rank + 1), 15, hex(ROOM_COLORS.brass)).setDepth(1).setAlpha(0.85);
    }
  }

  private center(square: number): Point {
    const file = square & 7;
    const rank = square >> 3;
    const col = this.flipped ? 7 - file : file;
    const row = this.flipped ? rank : 7 - rank;
    return { x: PAD + (col + 0.5) * CELL, y: PAD + (row + 0.5) * CELL };
  }

  private squareAt(x: number, y: number): number {
    const col = Math.floor((x - PAD) / CELL);
    const row = Math.floor((y - PAD) / CELL);
    if (col < 0 || col > 7 || row < 0 || row > 7) return -1;
    const file = this.flipped ? 7 - col : col;
    const rank = this.flipped ? row : 7 - row;
    return rank * 8 + file;
  }

  private myTurn(): boolean {
    return !this.busy && !this.state.result && this.session.isHumanTurn();
  }

  /** Legal moves from a square, as [target square, promotion letter]. */
  private movesFrom(from: number): { to: number; promotion?: string }[] {
    const state = this.state;
    return state
      .legalMoves(state.currentSeat)
      .filter((move) => readMove(move).from === from)
      .map((move) => ({ to: readMove(move).to, ...(move.length > 4 ? { promotion: move[4]! } : {}) }));
  }

  private drawBoard(): void {
    const g = this.boardG.clear();
    if (ROOM) this.drawRoom(g);
    else {
      g.fillStyle(0xe9e4f5, 1);
      g.fillRoundedRect(0, 6, W, H - 12, 22);
      g.fillStyle(0xffffff, 1);
      g.fillRoundedRect(0, 0, W, H - 12, 22);
    }
    for (let square = 0; square < 64; square++) {
      const { x, y } = this.center(square);
      const dark = (((square >> 3) + (square & 7)) & 1) === 0;
      g.fillStyle(dark ? DARK_SQUARE : LIGHT, 1);
      g.fillRect(x - CELL / 2, y - CELL / 2, CELL, CELL);
      if (ROOM) {
        // Light falls from the top, so every square is a shade brighter at its top edge.
        g.fillStyle(0xffffff, dark ? 0.07 : 0.16);
        g.fillRect(x - CELL / 2, y - CELL / 2, CELL, CELL * 0.38);
        g.fillStyle(0x000000, 0.08);
        g.fillRect(x - CELL / 2, y + CELL * 0.26, CELL, CELL * 0.24);
      }
    }
    if (ROOM) {
      // The board is sunk into its frame, so the frame casts a shadow onto the top two rows.
      g.fillStyle(0x000000, 0.16);
      g.fillRect(PAD, PAD, W - PAD * 2, 10);
      g.fillStyle(0x000000, 0.1);
      g.fillRect(PAD, PAD, 10, H - PAD * 2);
      g.lineStyle(2, ROOM_COLORS.brassDark, 0.9);
      g.strokeRect(PAD - 1, PAD - 1, W - PAD * 2 + 2, H - PAD * 2 + 2);
    }
    // The last move, so you can see what just happened.
    const last = this.state.last;
    if (last) {
      for (const square of [last.move.from, last.move.to]) {
        const { x, y } = this.center(square);
        g.fillStyle(SUNNY, 0.45);
        g.fillRect(x - CELL / 2, y - CELL / 2, CELL, CELL);
      }
    }
  }

  /** Felt under a walnut frame with a brass rail, lit from the top of the screen. */
  private drawRoom(g: GameObjects.Graphics): void {
    g.fillGradientStyle(ROOM_COLORS.felt, ROOM_COLORS.felt, ROOM_COLORS.feltDark, ROOM_COLORS.feltDark, 1);
    g.fillRoundedRect(0, 0, W, H, 20);
    g.fillGradientStyle(ROOM_COLORS.woodLight, ROOM_COLORS.woodLight, ROOM_COLORS.woodDark, ROOM_COLORS.woodDark, 1);
    g.fillRoundedRect(8, 8, W - 16, H - 16, 16);
    // A lighter strip along the top of the frame, the way a waxed edge catches the light.
    g.fillStyle(0xffffff, 0.1);
    g.fillRoundedRect(8, 8, W - 16, 14, 8);
    g.fillStyle(ROOM_COLORS.wood, 1);
    g.fillRoundedRect(14, 14, W - 28, H - 28, 12);
    // Grain: a few long, faint lines along the frame, which is most of what says "wood".
    for (let i = 0; i < 14; i++) {
      const y = 18 + i * ((H - 36) / 14) + (i % 3) * 1.5;
      g.lineStyle(1.5, i % 2 ? ROOM_COLORS.woodDark : ROOM_COLORS.woodLight, 0.16);
      g.lineBetween(16, y, W - 16, y + (i % 4) - 1.5);
    }
    g.lineStyle(2.5, ROOM_COLORS.brass, 0.8);
    g.strokeRoundedRect(17, 17, W - 34, H - 34, 10);
  }

  /** All pieces, leaving out `skip` while its piece is sliding. */
  private drawPieces(skip = -1): void {
    const g = this.piecesG.clear();
    this.state.board.forEach((piece, square) => {
      if (piece === 0 || square === skip) return;
      const { x, y } = this.center(square);
      if (ROOM) {
        // A piece standing on a board throws a shadow, and that is most of what makes it look solid.
        g.fillStyle(0x000000, 0.28);
        g.fillEllipse(x + 3, y + CELL * 0.3, CELL * 0.56, CELL * 0.18);
      }
      g.save();
      g.translateCanvas(x, y);
      drawPiece(g, piece, CELL / 57);
      g.restore();
    });
    this.drawHints();
  }

  /** Dots for quiet moves, rings for captures, and a ring around the piece you picked up. */
  private drawHints(): void {
    const g = this.hintsG.clear();
    const state = this.state;
    if (state.result) return;
    if (this.selected !== null) {
      const from = this.center(this.selected);
      g.lineStyle(5, SUNNY, 1);
      g.strokeRoundedRect(from.x - CELL / 2 + 3, from.y - CELL / 2 + 3, CELL - 6, CELL - 6, 8);
      for (const move of this.movesFrom(this.selected)) {
        const { x, y } = this.center(move.to);
        if (state.board[move.to] !== 0) {
          g.lineStyle(6, SUNNY, 0.95);
          g.strokeCircle(x, y, CELL / 2 - 6);
        } else {
          g.fillStyle(SUNNY, 0.9);
          g.fillCircle(x, y, 10);
        }
      }
    }
    if (this.ringVisible) {
      const { x, y } = this.center(this.cursor);
      this.ringG.clear();
      this.ringG.lineStyle(4, toHex(COLORS.grape), 1);
      this.ringG.strokeRoundedRect(x - CELL / 2 + 2, y - CELL / 2 + 2, CELL - 4, CELL - 4, 8);
    } else {
      this.ringG.clear();
    }
  }

  /** Four big buttons over the board when a pawn reaches the last row. */
  private drawPromotion(): void {
    const g = this.promoG.clear();
    if (!this.promoting) return;
    const color = this.state.currentSeat;
    const top = H / 2 - CELL / 2;
    const left = W / 2 - CELL * 2;
    g.fillStyle(0x2b2a3a, 0.35);
    g.fillRect(0, 0, W, H);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(left - 10, top - 18, CELL * 4 + 20, CELL + 36, 18);
    PROMOTIONS.forEach((type, i) => {
      const x = left + (i + 0.5) * CELL;
      g.fillStyle(0xfff1dc, 1);
      g.fillRoundedRect(x - CELL / 2 + 4, top + 4, CELL - 8, CELL - 8, 12);
      g.save();
      g.translateCanvas(x, top + CELL / 2);
      drawPiece(g, type | (color === 1 ? 8 : 0), CELL / 60);
      g.restore();
    });
  }

  private promotionAt(x: number, y: number): number | null {
    if (!this.promoting) return null;
    const top = H / 2 - CELL / 2;
    const left = W / 2 - CELL * 2;
    if (y < top || y > top + CELL) return null;
    const index = Math.floor((x - left) / CELL);
    return index >= 0 && index < 4 ? PROMOTIONS[index]! : null;
  }

  private tap(x: number, y: number): void {
    if (this.promoting) {
      const piece = this.promotionAt(x, y);
      if (piece !== null) {
        const { from, to } = this.promoting;
        this.promoting = null;
        this.drawPromotion();
        this.play(`${squareName(from)}${squareName(to)}${PROMO_LETTER[piece]}`);
      } else {
        this.promoting = null;
        this.drawPromotion();
        this.drawHints();
      }
      return;
    }
    const square = this.squareAt(x, y);
    if (square < 0) return;
    this.pick(square);
  }

  /** Tap a piece to pick it up, tap a dot to move there, tap it again to put it down. */
  private pick(square: number): void {
    if (!this.myTurn()) return;
    const state = this.state;
    if (this.selected !== null) {
      const moves = this.movesFrom(this.selected).filter((m) => m.to === square);
      if (moves.length > 1 || moves[0]?.promotion) {
        this.promoting = { from: this.selected, to: square };
        this.selected = null;
        this.drawHints();
        this.drawPromotion();
        return;
      }
      if (moves.length === 1) {
        const from = this.selected;
        this.selected = null;
        this.play(`${squareName(from)}${squareName(square)}`);
        return;
      }
    }
    const piece = state.board[square]!;
    this.selected = piece !== 0 && colorOf(piece) === state.currentSeat && this.movesFrom(square).length > 0 ? square : null;
    this.drawHints();
  }

  private play(move: ChessMove): void {
    this.selected = null;
    this.session.play(move);
  }

  private key(key: string): boolean {
    if (!this.myTurn()) return false;
    const step = arrow(key);
    if (step) {
      const file = Math.min(7, Math.max(0, (this.cursor & 7) + (this.flipped ? -step[0] : step[0])));
      const rank = Math.min(7, Math.max(0, (this.cursor >> 3) + (this.flipped ? step[1] : -step[1])));
      this.cursor = rank * 8 + file;
      this.ringVisible = true;
      this.drawHints();
      return true;
    }
    if (isPress(key)) {
      this.ringVisible = true;
      this.pick(this.cursor);
      return true;
    }
    if (key === 'Escape' && this.selected !== null) {
      this.selected = null;
      this.drawHints();
      return true;
    }
    return false;
  }

  private shout(text: string): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setAlpha(1).setScale(0.7);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 700, duration: 260 });
  }

  private onChange(): void {
    const event = this.state.last;
    if (!event || event === this.seen) {
      this.drawBoard();
      this.drawPieces();
      return;
    }
    this.seen = event;
    this.selected = null;
    this.promoting = null;
    this.drawPromotion();
    this.animate(event);
  }

  /** The piece slides over with a little arc; captures pop, castling slides the rook too. */
  private animate(event: ChessEvent): void {
    this.busy = true;
    const from = this.center(event.move.from);
    const to = this.center(event.move.to);
    this.drawBoard();
    this.drawPieces(event.move.from);

    if (event.captured !== 0) {
      const taken = this.center(event.capturedSquare);
      const pop = this.add.graphics().setPosition(taken.x, taken.y).setDepth(2);
      drawPiece(pop, event.captured, CELL / 57);
      this.tweens.add({ targets: pop, scale: 0.2, alpha: 0, angle: 30, duration: 220, ease: 'Back.easeIn', onComplete: () => pop.destroy() });
    }

    const mover = this.add.graphics().setPosition(from.x, from.y).setDepth(5);
    drawPiece(mover, event.piece, CELL / 57);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 240,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 1;
        mover.setPosition(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t - Math.sin(Math.PI * t) * 16);
      },
      onComplete: () => {
        mover.destroy();
        this.busy = false;
        this.drawBoard();
        this.drawPieces();
        if (event.check) this.flashCheck();
      },
    });

    if (event.castleRook) {
      const rookFrom = this.center(event.castleRook.from);
      const rookTo = this.center(event.castleRook.to);
      const rook = this.add.graphics().setPosition(rookFrom.x, rookFrom.y).setDepth(4);
      drawPiece(rook, this.state.board[event.castleRook.to] ?? 4, CELL / 57);
      this.tweens.add({ targets: rook, x: rookTo.x, y: rookTo.y, duration: 260, ease: 'Sine.easeInOut', onComplete: () => rook.destroy() });
    }
  }

  /** The checked king's square flashes and shakes. */
  private flashCheck(): void {
    const state = this.state;
    const king = state.board.findIndex((p) => typeOf(p) === KING && colorOf(p) === state.currentSeat);
    if (king < 0) return;
    const { x, y } = this.center(king);
    const flash = this.add.graphics().setDepth(1);
    flash.fillStyle(TOMATO, 0.55);
    flash.fillRect(x - CELL / 2, y - CELL / 2, CELL, CELL);
    this.tweens.add({ targets: flash, alpha: 0, duration: 700, ease: 'Sine.easeOut', onComplete: () => flash.destroy() });
    this.cameras.main.shake(140, 0.004);
    this.shout(state.result ? 'Checkmate!' : 'Check!');
  }
}
