import { TAFL_ATTACKER, TAFL_DEFENDER, TAFL_KING, TAFL_CORNERS, TAFL_SIZE, TAFL_SQUARES, THRONE, type TaflMove, type TaflState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { focusRing, moveRing, onKeys } from '../keys';

const W = 600;
const H = 700;
export const TAFL_CANVAS = { width: W, height: H };
export const TAFL_COLORS = [COLORS.tomato, COLORS.sky];
export const TAFL_NAMES = ['Attackers', 'Defenders'];

const CELL = 50;
const BX = (W - TAFL_SIZE * CELL) / 2;
const BY = 110;
const PIECE_R = 19;
const TOP_Y = 44;

const cellXY = (p: number) => ({ x: BX + (p % TAFL_SIZE) * CELL + CELL / 2, y: BY + Math.floor(p / TAFL_SIZE) * CELL + CELL / 2 });

/**
 * Hnefatafl. The rules keep the board; the scene slides each piece along its line, pops the ones it
 * traps, and crowns the king. Tap one of your pieces, then a lit square on its row or column.
 */
export class TaflScene extends Scene {
  private pieces = new Map<number, GameObjects.Container>();
  private hints!: GameObjects.Graphics;
  private ring!: GameObjects.Graphics;
  private topText!: GameObjects.Text;
  private selected: number | null = null;
  private focus = THRONE;
  private moving = 0;

  constructor(private readonly session: Session<TaflMove>) {
    super('tafl');
  }

  private get state(): TaflState {
    return this.session.state as TaflState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.drawBoard();
    this.hints = this.add.graphics().setDepth(2);
    this.ring = focusRing(this, CELL, CELL, 12);
    this.topText = sharpText(this, W / 2, TOP_Y, '', 24, COLORS.ink).setFontStyle('bold');
    this.state.board.forEach((piece, p) => piece && this.pieces.set(p, this.makePiece(piece, p)));
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      this.ring.setVisible(false);
      const col = Math.floor((p.worldX - BX) / CELL);
      const row = Math.floor((p.worldY - BY) / CELL);
      if (col >= 0 && col < TAFL_SIZE && row >= 0 && row < TAFL_SIZE) this.tap(row * TAFL_SIZE + col);
    });
    onKeys(this, (key) => this.key(key));
    const off = this.session.subscribe(() => this.changed());
    this.session.holdBots = () => this.busy();
    this.events.once('shutdown', () => {
      off();
      this.session.holdBots = null;
    });
    this.refresh();
  }

  /** A piece still sliding or popping. See `apps/client/src/games/busy.ts`. */
  busy(): boolean {
    return this.moving > 0;
  }

  private drawBoard(): void {
    const g = this.add.graphics().setDepth(0);
    const size = TAFL_SIZE * CELL;
    g.fillStyle(toHex(DARK.peach), 1);
    g.fillRoundedRect(BX - 14, BY - 14 + 8, size + 28, size + 28, 24);
    g.fillStyle(toHex(COLORS.peach), 1);
    g.fillRoundedRect(BX - 14, BY - 14, size + 28, size + 28, 24);
    for (let p = 0; p < TAFL_SQUARES; p++) {
      const { x, y } = cellXY(p);
      const special = p === THRONE || TAFL_CORNERS.includes(p);
      g.fillStyle(special ? toHex(COLORS.sunny) : (p + Math.floor(p / TAFL_SIZE)) % 2 ? 0xfff4e8 : 0xffffff, 1);
      g.fillRoundedRect(x - CELL / 2 + 2, y - CELL / 2 + 2, CELL - 4, CELL - 4, 8);
      if (special) {
        // The king's squares carry his mark: a small crown.
        g.fillStyle(toHex(DARK.sunny), 1);
        g.fillTriangle(x - 12, y + 7, x - 12, y - 6, x - 4, y + 1);
        g.fillTriangle(x - 5, y + 7, x, y - 9, x + 5, y + 7);
        g.fillTriangle(x + 12, y + 7, x + 12, y - 6, x + 4, y + 1);
        g.fillRect(x - 12, y + 5, 24, 5);
      }
    }
  }

  private makePiece(piece: number, p: number): GameObjects.Container {
    const g = this.add.graphics();
    const attacker = piece === TAFL_ATTACKER;
    const main = toHex(attacker ? COLORS.tomato : COLORS.sky);
    const lip = toHex(attacker ? DARK.tomato : DARK.sky);
    g.fillStyle(lip, 1);
    g.fillCircle(0, 3, PIECE_R);
    g.fillStyle(main, 1);
    g.fillCircle(0, 0, PIECE_R);
    if (piece === TAFL_KING) {
      g.fillStyle(toHex(COLORS.sunny), 1);
      g.fillTriangle(-11, 6, -11, -7, -3, 0);
      g.fillTriangle(-5, 6, 0, -10, 5, 6);
      g.fillTriangle(11, 6, 11, -7, 3, 0);
      g.fillRect(-11, 4, 22, 5);
    } else {
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(-6, -6, 4);
    }
    const { x, y } = cellXY(p);
    return this.add.container(x, y, [g]).setDepth(5);
  }

  private changed(): void {
    const state = this.state;
    const last = state.last;
    this.selected = null;
    if (!last) return this.refresh();
    const piece = this.pieces.get(last.from);
    if (piece) {
      this.pieces.delete(last.from);
      this.pieces.set(last.to, piece);
      const { x, y } = cellXY(last.to);
      this.moving++;
      piece.setDepth(7);
      this.tweens.add({
        targets: piece,
        x,
        y,
        duration: 220,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          piece.setDepth(5);
          this.tweens.add({ targets: piece, scaleX: { from: 1.18, to: 1 }, scaleY: { from: 0.85, to: 1 }, duration: 160, ease: 'Back.easeOut' });
          cue(last.captured.length ? 'capture' : 'place');
          for (const p of last.captured) this.pop(p);
          if (state.result && state.board[last.to] === TAFL_KING && TAFL_CORNERS.includes(last.to)) this.shout(cellXY(last.to), 'Escaped!', COLORS.sky);
          else if (state.result?.winners[0] === 0 && state.board.indexOf(TAFL_KING) >= 0) this.shout(cellXY(state.king), 'Caught!', COLORS.tomato);
          this.moving--;
          this.refresh();
        },
      });
    }
    this.refresh();
  }

  private pop(p: number): void {
    const piece = this.pieces.get(p);
    if (!piece) return;
    this.pieces.delete(p);
    this.moving++;
    this.cameras.main.shake(90, 0.003);
    this.tweens.add({ targets: piece, scale: 1.5, alpha: 0, duration: 280, ease: 'Cubic.easeOut', onComplete: () => (piece.destroy(), this.moving--) });
  }

  private shout(at: { x: number; y: number }, text: string, color: string): void {
    const t = sharpText(this, at.x, at.y - 34, text, 30, color).setFontStyle('bold').setStroke('#FFFFFF', 7).setDepth(20).setScale(0.6);
    this.tweens.add({ targets: t, scale: 1, duration: 220, ease: 'Back.easeOut' });
  }

  private tap(p: number): void {
    const state = this.state;
    if (!this.session.isHumanTurn() || this.busy()) return;
    const seat = state.currentSeat;
    const mine = (piece: number) => (seat === 0 ? piece === TAFL_ATTACKER : piece === TAFL_DEFENDER || piece === TAFL_KING);
    if (mine(state.board[p]!)) {
      this.selected = this.selected === p ? null : p;
      cue('tap');
      return this.refresh();
    }
    if (this.selected === null) return;
    const move = `m${this.selected}-${p}`;
    if (state.legalMoves(seat).includes(move)) this.session.play(move);
    else {
      this.selected = null;
      this.refresh();
    }
  }

  private key(key: string): boolean {
    const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -TAFL_SIZE, ArrowDown: TAFL_SIZE } as Record<string, number>)[key];
    if (step !== undefined) {
      const col = this.focus % TAFL_SIZE;
      if ((step === -1 && col === 0) || (step === 1 && col === TAFL_SIZE - 1)) return true;
      const next = this.focus + step;
      if (next >= 0 && next < TAFL_SQUARES) this.focus = next;
      const { x, y } = cellXY(this.focus);
      moveRing(this, this.ring, x, y);
      return true;
    }
    if (key === 'Enter' || key === ' ') {
      this.tap(this.focus);
      return true;
    }
    if (key === 'Escape') {
      this.selected = null;
      this.refresh();
      return true;
    }
    return false;
  }

  /** The line along the top, the last move, and for the player to move: their pieces, or where the picked one can go. */
  private refresh(): void {
    const state = this.state;
    const attackers = state.board.filter((p) => p === TAFL_ATTACKER).length;
    const defenders = state.board.filter((p) => p === TAFL_DEFENDER).length;
    this.topText.setText(`Attackers ${attackers}  ·  Defenders ${defenders} and the king`);
    const g = this.hints.clear();
    const last = state.last;
    if (last) {
      for (const p of [last.from, last.to]) {
        const { x, y } = cellXY(p);
        g.fillStyle(toHex(COLORS.grape), 0.14);
        g.fillRoundedRect(x - CELL / 2 + 2, y - CELL / 2 + 2, CELL - 4, CELL - 4, 8);
      }
    }
    if (!this.session.isHumanTurn() || this.busy() || state.result) return;
    if (this.selected !== null) {
      const { x, y } = cellXY(this.selected);
      g.lineStyle(5, toHex(COLORS.grape), 1);
      g.strokeCircle(x, y, PIECE_R + 5);
      for (const to of state.destinations(this.selected)) {
        const d = cellXY(to);
        g.fillStyle(toHex(COLORS.grape), 0.35);
        g.fillCircle(d.x, d.y, 8);
      }
    }
  }

  /** The bands the board keeps to, for the layout check. */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    return [
      { name: 'count', top: TOP_Y - 16, bottom: TOP_Y + 16 },
      { name: 'board', top: BY - 14, bottom: BY + TAFL_SIZE * CELL + 22 },
    ];
  }
}

export function taflStatus(state: TaflState, names: readonly string[]): string | undefined {
  if (state.result) return undefined;
  const name = names[state.currentSeat] ?? TAFL_NAMES[state.currentSeat];
  return state.currentSeat === 0 ? `${name} to move: trap the king` : `${name} to move: get the king to a corner`;
}
