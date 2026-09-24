import { FANO_H, FANO_POINTS, FANO_W, fanoDirs, isStrong, type FanoMove, type FanoState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { focusRing, moveRing, onKeys } from '../keys';

const W = 720;
const H = 590;
export const FANO_CANVAS = { width: W, height: H };
export const FANO_COLORS = [COLORS.sky, COLORS.tomato];
export const FANO_NAMES = ['Blue', 'Red'];

const STEP = 80;
const BX = (W - (FANO_W - 1) * STEP) / 2;
const BY = 120;
const PIECE_R = 26;
const TOP_Y = 44;
const STOP_Y = 530;

const pointXY = (p: number) => ({ x: BX + (p % FANO_W) * STEP, y: BY + Math.floor(p / FANO_W) * STEP });

/**
 * Fanorona. The rules find the captures; the scene slides the piece and ripples the taken line off
 * the board one piece after another. Tap a piece, then a lit point. When a move could take the line
 * in front or the line behind, both light up red and you tap a piece in the one you want. In a
 * capture run the piece stays picked, and Stop ends the run.
 */
export class FanoronaScene extends Scene {
  private pieces = new Map<number, GameObjects.Container>();
  private hints!: GameObjects.Graphics;
  private ring!: GameObjects.Graphics;
  private topText!: GameObjects.Text;
  private stopButton!: GameObjects.Graphics;
  private stopText!: GameObjects.Text;
  private selected: number | null = null;
  /** A move that could take either way, waiting for the player to say which line. */
  private choosing: { from: number; to: number } | null = null;
  private focus = 22;
  private moving = 0;

  constructor(private readonly session: Session<FanoMove>) {
    super('fanorona');
  }

  private get state(): FanoState {
    return this.session.state as FanoState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.drawBoard();
    this.hints = this.add.graphics().setDepth(2);
    this.ring = focusRing(this, PIECE_R * 2 + 12, PIECE_R * 2 + 12, PIECE_R + 6);
    this.topText = sharpText(this, W / 2, TOP_Y, '', 24, COLORS.ink).setFontStyle('bold');
    this.stopButton = this.add.graphics().setDepth(3);
    this.stopText = sharpText(this, W / 2, STOP_Y, 'Stop here', 26, '#FFFFFF').setFontStyle('bold').setDepth(4);
    this.state.board.forEach((b, p) => b !== -1 && this.pieces.set(p, this.makePiece(b, p)));
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      this.ring.setVisible(false);
      if (this.state.chain && Math.abs(p.worldY - STOP_Y) < 30 && Math.abs(p.worldX - W / 2) < 110) return this.play('stop');
      const col = Math.round((p.worldX - BX) / STEP);
      const row = Math.round((p.worldY - BY) / STEP);
      if (col < 0 || col >= FANO_W || row < 0 || row >= FANO_H) return;
      this.tap(row * FANO_W + col);
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

  /** A piece still sliding or a line still coming off. See `apps/client/src/games/busy.ts`. */
  busy(): boolean {
    return this.moving > 0;
  }

  private drawBoard(): void {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(toHex(DARK.mint), 1);
    g.fillRoundedRect(BX - 40, BY - 40 + 8, (FANO_W - 1) * STEP + 80, (FANO_H - 1) * STEP + 80, 28);
    g.fillStyle(toHex(COLORS.mint), 1);
    g.fillRoundedRect(BX - 40, BY - 40, (FANO_W - 1) * STEP + 80, (FANO_H - 1) * STEP + 80, 28);
    g.lineStyle(5, 0xffffff, 0.9);
    for (let p = 0; p < FANO_POINTS; p++) {
      const a = pointXY(p);
      for (const [dx, dy] of fanoDirs(p)) {
        // Each line once: only the ones going right or down from here.
        if (dy < 0 || (dy === 0 && dx < 0)) continue;
        const x = (p % FANO_W) + dx;
        const y = Math.floor(p / FANO_W) + dy;
        if (x < 0 || x >= FANO_W || y >= FANO_H) continue;
        const b = pointXY(y * FANO_W + x);
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
    }
    for (let p = 0; p < FANO_POINTS; p++) {
      const { x, y } = pointXY(p);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(x, y, isStrong(p) ? 8 : 6);
    }
  }

  private makePiece(seat: number, p: number): GameObjects.Container {
    const g = this.add.graphics();
    g.fillStyle(toHex(seat === 0 ? DARK.sky : DARK.tomato), 1);
    g.fillCircle(0, 4, PIECE_R);
    g.fillStyle(toHex(seat === 0 ? COLORS.sky : COLORS.tomato), 1);
    g.fillCircle(0, 0, PIECE_R);
    g.fillStyle(0xffffff, 0.75);
    g.fillCircle(-8, -8, 5);
    const { x, y } = pointXY(p);
    return this.add.container(x, y, [g]).setDepth(5);
  }

  private changed(): void {
    const state = this.state;
    const last = state.last;
    this.choosing = null;
    this.selected = state.chain ? state.chain.at : null;
    const piece = last ? this.pieces.get(last.from) : undefined;
    if (!last || !piece || this.pieces.get(last.to) === piece) return this.refresh();
    this.pieces.delete(last.from);
    this.pieces.set(last.to, piece);
    const { x, y } = pointXY(last.to);
    this.moving++;
    piece.setDepth(7);
    this.tweens.add({
      targets: piece,
      x,
      y,
      duration: 200,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        piece.setDepth(5);
        this.tweens.add({ targets: piece, scaleX: { from: 1.15, to: 1 }, scaleY: { from: 0.86, to: 1 }, duration: 150, ease: 'Back.easeOut' });
        cue(last.captured.length ? 'capture' : 'place');
        // The taken line ripples off, nearest first.
        last.captured.forEach((p, i) => this.pop(p, i * 70));
        if (last.captured.length >= 3) this.shout(pointXY(last.captured[0]!), `${last.captured.length}!`);
        this.moving--;
        this.refresh();
      },
    });
    this.refresh();
  }

  private pop(p: number, delay: number): void {
    const piece = this.pieces.get(p);
    if (!piece) return;
    this.pieces.delete(p);
    this.moving++;
    this.tweens.add({ targets: piece, scale: 1.45, alpha: 0, delay, duration: 240, ease: 'Cubic.easeOut', onComplete: () => (piece.destroy(), this.moving--, this.refresh()) });
  }

  private shout(at: { x: number; y: number }, text: string): void {
    const t = sharpText(this, at.x, at.y - 40, text, 32, COLORS.bubblegum).setFontStyle('bold').setStroke('#FFFFFF', 7).setDepth(20).setScale(0.6);
    this.tweens.add({ targets: t, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, y: at.y - 80, alpha: 0, delay: 600, duration: 350, onComplete: () => t.destroy() });
  }

  private play(move: FanoMove): void {
    if (!this.session.isHumanTurn() || this.busy()) return;
    if (this.state.legalMoves(this.state.currentSeat).includes(move)) this.session.play(move);
  }

  /** The moves from `from` to `to`, by kind: a paika, an approach, a withdrawal. */
  private movesTo(from: number, to: number): FanoMove[] {
    const base = `m${from}-${to}`;
    return this.state.legalMoves(this.state.currentSeat).filter((m) => m === base || m === `${base}a` || m === `${base}w`);
  }

  private tap(p: number): void {
    const state = this.state;
    if (!this.session.isHumanTurn() || this.busy()) return;
    const seat = state.currentSeat;
    if (this.choosing) {
      // Which line: a tap on a piece in the one in front takes that, one behind takes the other.
      const { from, to } = this.choosing;
      if (state.taken(from, to, 'a', seat).includes(p)) return this.play(`m${from}-${to}a`);
      if (state.taken(from, to, 'w', seat).includes(p)) return this.play(`m${from}-${to}w`);
      this.choosing = null;
      return this.refresh();
    }
    if (state.board[p] === seat && !state.chain) {
      this.selected = this.selected === p ? null : p;
      cue('tap');
      return this.refresh();
    }
    if (this.selected === null) return;
    const moves = this.movesTo(this.selected, p);
    if (moves.length === 1) return this.play(moves[0]!);
    if (moves.length === 2) {
      this.choosing = { from: this.selected, to: p };
      cue('tap');
      return this.refresh();
    }
    if (!state.chain) {
      this.selected = null;
      this.refresh();
    }
  }

  private key(key: string): boolean {
    const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -FANO_W, ArrowDown: FANO_W } as Record<string, number>)[key];
    if (step !== undefined) {
      const col = this.focus % FANO_W;
      if ((step === -1 && col === 0) || (step === 1 && col === FANO_W - 1)) return true;
      const next = this.focus + step;
      if (next >= 0 && next < FANO_POINTS) this.focus = next;
      const { x, y } = pointXY(this.focus);
      moveRing(this, this.ring, x, y);
      return true;
    }
    if (key === 'Enter' || key === ' ') {
      this.tap(this.focus);
      return true;
    }
    if (this.choosing && (key === 'a' || key === 'w')) {
      this.play(`m${this.choosing.from}-${this.choosing.to}${key}`);
      return true;
    }
    if (key === 's' || key === 'S') {
      if (this.state.chain) this.play('stop');
      return true;
    }
    if (key === 'Escape' && !this.state.chain) {
      this.selected = null;
      this.choosing = null;
      this.refresh();
      return true;
    }
    return false;
  }

  private refresh(): void {
    const state = this.state;
    const count = (seat: number) => state.board.filter((b) => b === seat).length;
    this.topText.setText(`Blue ${count(0)}  ·  Red ${count(1)}`);
    const g = this.hints.clear();
    const live = this.session.isHumanTurn() && !this.busy() && !state.result;
    this.stopButton.clear();
    const showStop = live && !!state.chain;
    this.stopText.setVisible(showStop);
    if (showStop) {
      this.stopButton.fillStyle(toHex(DARK.grape), 1);
      this.stopButton.fillRoundedRect(W / 2 - 110, STOP_Y - 28 + 6, 220, 56, 28);
      this.stopButton.fillStyle(toHex(COLORS.grape), 1);
      this.stopButton.fillRoundedRect(W / 2 - 110, STOP_Y - 28, 220, 56, 28);
    }
    if (!live) return;
    const seat = state.currentSeat;
    const moves = state.legalMoves(seat).filter((m) => m !== 'stop');
    if (this.choosing) {
      const { from, to } = this.choosing;
      for (const p of [...state.taken(from, to, 'a', seat), ...state.taken(from, to, 'w', seat)]) {
        const { x, y } = pointXY(p);
        g.lineStyle(5, toHex(COLORS.bubblegum), 1);
        g.strokeCircle(x, y, PIECE_R + 5);
      }
      return;
    }
    const froms = new Set(moves.map((m) => Number(m.slice(1).split('-')[0])));
    for (const from of froms) {
      const { x, y } = pointXY(from);
      g.lineStyle(from === this.selected ? 6 : 3, toHex(COLORS.grape), from === this.selected ? 1 : 0.55);
      g.strokeCircle(x, y, PIECE_R + 5);
    }
    if (this.selected !== null) {
      for (const m of moves) {
        const [from, rest] = m.slice(1).split('-');
        if (Number(from) !== this.selected) continue;
        const { x, y } = pointXY(Number.parseInt(rest!, 10));
        g.fillStyle(toHex(COLORS.grape), 0.4);
        g.fillCircle(x, y, 12);
      }
    }
  }

  /** The bands the board keeps to, for the layout check. */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    return [
      { name: 'count', top: TOP_Y - 16, bottom: TOP_Y + 16 },
      { name: 'board', top: BY - 40, bottom: BY + (FANO_H - 1) * STEP + 48 },
      { name: 'stop', top: STOP_Y - 28, bottom: STOP_Y + 34 },
    ];
  }
}

export function fanoStatus(state: FanoState, names: readonly string[]): string | undefined {
  if (state.result) return undefined;
  const name = names[state.currentSeat] ?? FANO_NAMES[state.currentSeat];
  if (state.chain) return `${name} can take again, or stop`;
  const captures = state.captures(state.currentSeat).length > 0;
  return captures ? `${name} must take` : `${name} to move`;
}
