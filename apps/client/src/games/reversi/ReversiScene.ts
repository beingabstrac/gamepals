import { discOf, placeDisc, REVERSI_EMPTY, type ReversiEvent, type ReversiMove, type ReversiState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { ROOM, ROOM_COLORS, ROOM_TONES, tone } from '../../look';
import { roomInset, roomTable } from '../room';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed } from '../../autoplay';
import { focusRing, isPress, moveRing, onKeys } from '../keys';

const SIZE = 640;
export const REVERSI_SIZE = { width: SIZE, height: SIZE };
const MARGIN = 32;
const CELL = (SIZE - MARGIN * 2) / 8;
const RADIUS = CELL * 0.4;
const BOARD = toHex(COLORS.mint);
const GRID = tone(0xfff4dc, ROOM_TONES.parchment);
/** Dark discs are ink; light discs are white with a sky-blue lip, so "Light" still has a color. */
const FACE = [toHex(COLORS.ink), 0xffffff];
const LIP = [0x16151f, toHex(COLORS.sky)];

const center = (sq: number) => ({ x: MARGIN + (sq % 8) * CELL + CELL / 2, y: MARGIN + Math.floor(sq / 8) * CELL + CELL / 2 });

export class ReversiScene extends Scene {
  private discs = new Map<number, { view: GameObjects.Container; face: GameObjects.Graphics }>();
  private dots!: GameObjects.Graphics;
  private banner!: GameObjects.Text;
  private cursor = 27;
  private ring!: GameObjects.Graphics;

  constructor(private readonly session: Session<ReversiMove>) {
    super('reversi');
  }

  private get state(): ReversiState {
    return this.session.state as ReversiState;
  }

  create(): void {
    fitCamera(this, SIZE, SIZE);
    applySpeed(this);
    this.drawBoard();
    this.dots = this.add.graphics().setDepth(1);
    this.state.board.forEach((disc, sq) => {
      if (disc !== REVERSI_EMPTY) this.addDisc(sq, disc === discOf(0) ? 0 : 1, true);
    });
    this.banner = sharpText(this, SIZE / 2, SIZE / 2, '', 44, COLORS.ink).setDepth(10).setAlpha(0);

    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      const col = Math.floor((p.worldX - MARGIN) / CELL);
      const row = Math.floor((p.worldY - MARGIN) / CELL);
      if (col >= 0 && col < 8 && row >= 0 && row < 8) this.place(row * 8 + col);
    });

    // Keyboard: arrows move a ring; Enter or Space places a disc there.
    this.ring = focusRing(this, CELL - 6, CELL - 6, 14);
    onKeys(this, (key) => {
      const steps: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      const step = steps[key];
      if (step) {
        const row = Math.min(7, Math.max(0, Math.floor(this.cursor / 8) + step[0]));
        const col = Math.min(7, Math.max(0, (this.cursor % 8) + step[1]));
        this.cursor = row * 8 + col;
        const { x, y } = center(this.cursor);
        moveRing(this, this.ring, x, y);
        return true;
      }
      if (isPress(key) && this.ring.visible) {
        this.place(this.cursor);
        return true;
      }
      return false;
    });

    const unsubscribe = this.session.subscribe(() => this.onChange());
    this.events.once('shutdown', unsubscribe);
    this.drawDots();
  }

  private drawBoard(): void {
    const g = this.add.graphics();
    if (ROOM) {
      roomTable(g, SIZE, SIZE, MARGIN);
      g.fillStyle(ROOM_COLORS.felt, 1);
      g.fillRect(MARGIN, MARGIN, SIZE - MARGIN * 2, SIZE - MARGIN * 2);
      roomInset(g, MARGIN, MARGIN, SIZE - MARGIN * 2, SIZE - MARGIN * 2);
    } else {
      g.fillStyle(toHex(DARK.mint), 1);
      g.fillRoundedRect(8, 14, SIZE - 16, SIZE - 16, 28);
      g.fillStyle(BOARD, 1);
      g.fillRoundedRect(8, 8, SIZE - 16, SIZE - 16, 28);
    }
    g.lineStyle(3, GRID, 0.9);
    for (let i = 0; i <= 8; i++) {
      g.lineBetween(MARGIN + i * CELL, MARGIN, MARGIN + i * CELL, SIZE - MARGIN);
      g.lineBetween(MARGIN, MARGIN + i * CELL, SIZE - MARGIN, MARGIN + i * CELL);
    }
    // The four little dots on a real board.
    g.fillStyle(GRID, 1);
    for (const [r, c] of [[2, 2], [2, 6], [6, 2], [6, 6]]) g.fillCircle(MARGIN + c! * CELL, MARGIN + r! * CELL, 5);
  }

  private paint(face: GameObjects.Graphics, seat: 0 | 1): void {
    face.clear();
    face.fillStyle(LIP[seat]!, 1);
    face.fillCircle(0, 4, RADIUS);
    face.fillStyle(FACE[seat]!, 1);
    face.fillCircle(0, 0, RADIUS);
    face.lineStyle(3, seat === 0 ? 0x44425a : toHex(COLORS.sky), 0.5);
    face.strokeCircle(0, 0, RADIUS * 0.62);
  }

  private addDisc(sq: number, seat: 0 | 1, instant: boolean): GameObjects.Container {
    const face = this.add.graphics();
    this.paint(face, seat);
    const { x, y } = center(sq);
    const view = this.add.container(x, y, [face]).setDepth(2);
    this.discs.set(sq, { view, face });
    if (!instant) {
      // Drop in from above with a bounce.
      view.setY(y - 60).setScale(1.25).setAlpha(0);
      this.tweens.add({ targets: view, y, scale: 1, alpha: 1, duration: 320, ease: 'Bounce.easeOut' });
    }
    return view;
  }

  private place(sq: number): void {
    if (!this.session.isHumanTurn()) return;
    const move = placeDisc(sq);
    if (this.state.legalMoves(this.state.currentSeat).includes(move)) this.session.play(move);
  }

  /** Soft dots on every legal square, only when a person is choosing. */
  private drawDots(): void {
    const g = this.dots.clear();
    const state = this.state;
    if (state.result || !this.session.isHumanTurn()) return;
    for (const move of state.legalMoves(state.currentSeat)) {
      if (!move.startsWith('m')) continue;
      const { x, y } = center(Number(move.slice(1)));
      g.fillStyle(0xffffff, 0.7);
      g.fillCircle(x, y, RADIUS * 0.28);
    }
  }

  private shout(text: string): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setAlpha(1).setScale(0.7);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 900, duration: 300 });
  }

  private onChange(): void {
    const event = this.state.last;
    this.dots.clear();
    if (!event) {
      this.drawDots();
      return;
    }
    this.animate(event);
  }

  /** The new disc drops in; trapped discs flip with a squeeze, rippling out from it. */
  private animate(event: ReversiEvent): void {
    if (event.square === null) {
      this.shout(event.seat === 0 ? 'Dark passes' : 'Light passes');
      this.time.delayedCall(300, () => this.drawDots());
      return;
    }
    const seat = event.seat as 0 | 1;
    this.addDisc(event.square, seat, false);
    const from = center(event.square);
    let last = 0;
    for (const sq of event.flipped) {
      const disc = this.discs.get(sq);
      if (!disc) continue;
      const to = center(sq);
      const delay = 140 + (Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y)) / CELL) * 70;
      last = Math.max(last, delay);
      this.tweens.add({
        targets: disc.view,
        scaleX: 0,
        duration: 80,
        delay,
        ease: 'Quad.easeIn',
        onComplete: () => {
          this.paint(disc.face, seat);
          this.tweens.add({ targets: disc.view, scaleX: 1, duration: 110, ease: 'Back.easeOut' });
        },
      });
    }
    if (event.flipped.length >= 5) this.time.delayedCall(last + 120, () => this.cameras.main.shake(120, 0.003));
    this.time.delayedCall(last + 260, () => {
      this.drawDots();
      if (this.state.result) this.celebrate();
    });
  }

  private celebrate(): void {
    const winner = this.state.result?.winners[0];
    if (winner === undefined) return;
    let i = 0;
    for (const [sq, disc] of this.discs) {
      if (this.state.board[sq] !== discOf(winner)) continue;
      this.tweens.add({ targets: disc.view, y: disc.view.y - 12, duration: 180, delay: 200 + i++ * 25, yoyo: true, ease: 'Sine.easeOut' });
    }
  }
}
