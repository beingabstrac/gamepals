import { MILLS, MORRIS_LINKS, MORRIS_PIECES, MORRIS_XY, type MorrisMove, type MorrisState, type Seat } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { focusRing, moveRing, onKeys } from '../keys';

const W = 600;
const H = 780;
export const MORRIS_SIZE = { width: W, height: H };
export const MORRIS_COLORS = [COLORS.sky, COLORS.tomato];
export const MORRIS_NAMES = ['Blue', 'Red'];

const STEP = 80;
const BX = (W - 6 * STEP) / 2;
const BY = 150;
const PIECE_R = 25;
const SEAT_HEX = MORRIS_COLORS.map(toHex);
const SEAT_DARK = [toHex(DARK.sky), toHex(DARK.tomato)];
/** Each player's pieces still to place: Blue along the bottom, Red along the top. */
const HAND_Y = [BY + 6 * STEP + 95, BY - 95];

const pointXY = (p: number) => ({ x: BX + MORRIS_XY[p]![0] * STEP, y: BY + MORRIS_XY[p]![1] * STEP });

/**
 * Nine Men's Morris. The rules keep the board; the scene flies each piece from its row into place,
 * slides moves along the lines, lights a mill as it closes and pops the piece it takes. Tap a point
 * to place, a piece and then a point to move, and a glowing piece to take it.
 */
export class MorrisScene extends Scene {
  private onBoard = new Map<number, GameObjects.Container>();
  private hands: GameObjects.Container[][] = [[], []];
  private hints!: GameObjects.Graphics;
  private glow!: GameObjects.Graphics;
  private ring!: GameObjects.Graphics;
  private selected: number | null = null;
  private focus = 16;
  private moving = 0;

  constructor(private readonly session: Session<MorrisMove>) {
    super('morris');
  }

  private get state(): MorrisState {
    return this.session.state as MorrisState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.drawBoard();
    this.glow = this.add.graphics().setDepth(2);
    this.hints = this.add.graphics().setDepth(3);
    this.ring = focusRing(this, PIECE_R * 2 + 16, PIECE_R * 2 + 16, PIECE_R + 8);
    this.rebuild();
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      this.ring.setVisible(false);
      const point = this.pointAt(p.worldX, p.worldY);
      if (point !== null) this.tap(point);
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

  /** A piece still flying or sliding. See `apps/client/src/games/busy.ts`. */
  busy(): boolean {
    return this.moving > 0;
  }

  private drawBoard(): void {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(toHex(DARK.sunny), 1);
    g.fillRoundedRect(BX - 40, BY - 40 + 8, 6 * STEP + 80, 6 * STEP + 80, 34);
    g.fillStyle(toHex(COLORS.sunny), 1);
    g.fillRoundedRect(BX - 40, BY - 40, 6 * STEP + 80, 6 * STEP + 80, 34);
    g.lineStyle(8, 0xffffff, 1);
    for (const [a, b] of MORRIS_LINKS) {
      const p = pointXY(a);
      const q = pointXY(b);
      g.lineBetween(p.x, p.y, q.x, q.y);
    }
    for (let p = 0; p < 24; p++) {
      const { x, y } = pointXY(p);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(x, y, 11);
      g.fillStyle(toHex(DARK.sunny), 1);
      g.fillCircle(x, y, 5);
    }
  }

  private makePiece(seat: Seat): GameObjects.Container {
    const g = this.add.graphics();
    g.fillStyle(SEAT_DARK[seat]!, 1);
    g.fillCircle(0, 4, PIECE_R);
    g.fillStyle(SEAT_HEX[seat]!, 1);
    g.fillCircle(0, 0, PIECE_R);
    g.lineStyle(4, 0xffffff, 0.6);
    g.strokeCircle(0, 0, PIECE_R - 8);
    return this.add.container(0, 0, [g]).setDepth(5);
  }

  private handXY(seat: Seat, index: number): { x: number; y: number } {
    const gap = 50;
    return { x: W / 2 + (index - (MORRIS_PIECES - 1) / 2) * gap, y: HAND_Y[seat]! };
  }

  /** Every piece where the state has it, with no motion. */
  private rebuild(): void {
    for (const piece of this.onBoard.values()) piece.destroy();
    this.onBoard.clear();
    for (const hand of this.hands) for (const piece of hand) piece.destroy();
    this.hands = [[], []];
    const state = this.state;
    for (const seat of [0, 1] as const) {
      for (let i = 0; i < state.inHand[seat]; i++) {
        const piece = this.makePiece(seat);
        const { x, y } = this.handXY(seat, i);
        this.hands[seat]!.push(piece.setPosition(x, y).setScale(0.8));
      }
    }
    state.board.forEach((who, p) => {
      if (who === -1) return;
      const piece = this.makePiece(who as Seat);
      const { x, y } = pointXY(p);
      this.onBoard.set(p, piece.setPosition(x, y));
    });
  }

  private changed(): void {
    const state = this.state;
    const last = state.last;
    this.selected = null;
    if (!last) return this.rebuild();
    if (last.kind === 'place') {
      const piece = this.hands[last.seat]!.pop();
      if (!piece) return this.rebuild();
      this.onBoard.set(last.to, piece);
      this.fly(piece, pointXY(last.to), true, last.mill ? last.to : null);
    } else if (last.kind === 'move' && last.from !== null) {
      const piece = this.onBoard.get(last.from);
      if (!piece) return this.rebuild();
      this.onBoard.delete(last.from);
      this.onBoard.set(last.to, piece);
      this.fly(piece, pointXY(last.to), false, last.mill ? last.to : null);
    } else if (last.kind === 'take') {
      const piece = this.onBoard.get(last.to);
      this.onBoard.delete(last.to);
      if (piece) this.pop(piece);
    }
    this.refresh();
  }

  /** From the row into place in an arc, or along a line: a squash as it lands, and a mill lights up. */
  private fly(piece: GameObjects.Container, to: { x: number; y: number }, arc: boolean, mill: number | null): void {
    const sx = piece.x;
    const sy = piece.y;
    this.moving++;
    piece.setDepth(7);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: arc ? 360 : 240,
      ease: 'Quad.easeInOut',
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;
        const lift = arc ? Math.sin(t * Math.PI) * 60 : 0;
        piece.setPosition(sx + (to.x - sx) * t, sy + (to.y - sy) * t - lift).setScale((arc ? 0.8 + 0.2 * t : 1) + Math.sin(t * Math.PI) * 0.12);
      },
      onComplete: () => {
        piece.setDepth(5);
        this.tweens.add({ targets: piece, scaleX: { from: 1.18, to: 1 }, scaleY: { from: 0.84, to: 1 }, duration: 180, ease: 'Back.easeOut' });
        cue(mill === null ? 'place' : 'capture');
        if (mill !== null) this.lightMill(mill);
        this.moving--;
        this.refresh();
      },
    });
  }

  private lightMill(point: number): void {
    const state = this.state;
    const who = state.board[point];
    this.tweens.killTweensOf(this.glow);
    const g = this.glow.clear();
    for (const mill of MILLS) {
      if (!mill.includes(point) || !mill.every((q) => state.board[q] === who)) continue;
      const a = pointXY(mill[0]);
      const c = pointXY(mill[2]);
      g.lineStyle(16, toHex(COLORS.bubblegum), 0.8);
      g.lineBetween(a.x, a.y, c.x, c.y);
    }
    g.setAlpha(1);
    this.tweens.add({ targets: g, alpha: 0, delay: 700, duration: 400 });
    const { x, y } = pointXY(point);
    const t = sharpText(this, x, y - 46, 'Mill!', 30, COLORS.bubblegum).setFontStyle('bold').setStroke('#FFFFFF', 7).setDepth(20).setScale(0.6);
    this.tweens.add({ targets: t, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, y: y - 86, alpha: 0, delay: 650, duration: 350, onComplete: () => t.destroy() });
  }

  private pop(piece: GameObjects.Container): void {
    this.moving++;
    this.cameras.main.shake(110, 0.004);
    this.tweens.add({
      targets: piece,
      scale: 1.5,
      alpha: 0,
      duration: 300,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        piece.destroy();
        this.moving--;
        this.refresh();
      },
    });
  }

  private pointAt(x: number, y: number): number | null {
    let best: number | null = null;
    let near = STEP * 0.45;
    for (let p = 0; p < 24; p++) {
      const q = pointXY(p);
      const d = Math.hypot(x - q.x, y - q.y);
      if (d < near) {
        near = d;
        best = p;
      }
    }
    return best;
  }

  private tap(point: number): void {
    const state = this.state;
    if (!this.session.isHumanTurn() || this.busy()) return;
    const seat = state.currentSeat;
    const moves = state.legalMoves(seat);
    if (state.taking) return this.play(moves, `x${point}`);
    if (state.stage(seat) === 'place') return this.play(moves, `p${point}`);
    if (state.board[point] === seat) {
      this.selected = this.selected === point ? null : point;
      cue('tap');
      return this.refresh();
    }
    if (this.selected !== null) this.play(moves, `m${this.selected}-${point}`);
  }

  private play(moves: readonly MorrisMove[], move: MorrisMove): void {
    if (moves.includes(move)) this.session.play(move);
  }

  private key(key: string): boolean {
    if (!this.session.isHumanTurn() || this.busy()) return false;
    const step = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, [number, number]>)[key];
    if (step) {
      // The nearest point that way, so the ring walks the board the way the eye does.
      const [fx, fy] = MORRIS_XY[this.focus]!;
      let best = this.focus;
      let score = Infinity;
      for (let p = 0; p < 24; p++) {
        const [x, y] = MORRIS_XY[p]!;
        const along = (x - fx) * step[0] + (y - fy) * step[1];
        if (along <= 0) continue;
        const across = Math.abs((x - fx) * step[1]) + Math.abs((y - fy) * step[0]);
        const d = along + across * 2;
        if (d < score) {
          score = d;
          best = p;
        }
      }
      this.focus = best;
      const { x, y } = pointXY(best);
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

  /** What can be tapped: empty points to place on, pieces that can move and where, pieces to take. */
  private refresh(): void {
    const state = this.state;
    const g = this.hints.clear();
    if (!this.session.isHumanTurn() || this.busy() || state.result) return;
    const seat = state.currentSeat;
    const moves = state.legalMoves(seat);
    if (state.taking) {
      for (const m of moves) {
        const { x, y } = pointXY(Number(m.slice(1)));
        g.lineStyle(6, toHex(COLORS.tomato), 1);
        g.strokeCircle(x, y, PIECE_R + 7);
      }
      return;
    }
    if (state.stage(seat) === 'place') {
      for (const m of moves) {
        const { x, y } = pointXY(Number(m.slice(1)));
        g.fillStyle(SEAT_HEX[seat]!, 0.3);
        g.fillCircle(x, y, 14);
      }
      return;
    }
    const froms = new Set(moves.map((m) => Number(m.slice(1).split('-')[0])));
    for (const from of froms) {
      const { x, y } = pointXY(from);
      g.lineStyle(from === this.selected ? 7 : 4, toHex(COLORS.grape), from === this.selected ? 1 : 0.6);
      g.strokeCircle(x, y, PIECE_R + 6);
    }
    if (this.selected !== null) {
      for (const m of moves) {
        const [from, to] = m.slice(1).split('-').map(Number);
        if (from !== this.selected) continue;
        const { x, y } = pointXY(to!);
        g.fillStyle(SEAT_HEX[seat]!, 0.4);
        g.fillCircle(x, y, PIECE_R - 4);
      }
    }
  }
}

export function morrisStatus(state: MorrisState, names: readonly string[]): string | undefined {
  if (state.result) return undefined;
  const seat = state.currentSeat;
  const name = names[seat] ?? MORRIS_NAMES[seat];
  if (state.taking) return `Mill! ${name} takes a piece`;
  const stage = state.stage(seat);
  if (stage === 'place') return `${name} to place. ${state.inHand[seat]} left to place`;
  return stage === 'fly' ? `${name} is down to three and can fly` : `${name} to move`;
}
