import { CheckerPiece, isKing, ownerOf, type CheckersEvent, type CheckersMove, type CheckersState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { ROOM, ROOM_COLORS, ROOM_TONES, tone } from '../../look';
import { roomInset, roomTable } from '../room';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera } from '../crisp';
import { applySpeed } from '../../autoplay';
import { focusRing, isPress, moveRing, onKeys } from '../keys';

const SIZE = 640;
export const CHECKERS_SIZE = { width: SIZE, height: SIZE };
const MARGIN = 32;
const CELL = (SIZE - MARGIN * 2) / 8;
const LIGHT = tone(0xfff4dc, ROOM_TONES.parchment);
const DARK_SQUARE = ROOM ? ROOM_COLORS.squareDark : toHex(COLORS.mint);
const LAST_MOVE = toHex(COLORS.sunny);
const TARGET = 0xffffff;
/** Black (ink) for seat 0, red (tomato) for seat 1. */
const PIECE_COLOR = [toHex(COLORS.ink), toHex(COLORS.tomato)];
const PIECE_DARK = [0x16151f, toHex(DARK.tomato)];
const CROWN = toHex(COLORS.sunny);
const HOP_MS = 200;
const RADIUS = CELL * 0.38;

const center = (sq: number) => ({ x: MARGIN + (sq % 8) * CELL + CELL / 2, y: MARGIN + Math.floor(sq / 8) * CELL + CELL / 2 });

export class CheckersScene extends Scene {
  private pieces = new Map<number, GameObjects.Container>();
  private marks!: GameObjects.Graphics;
  private selected: number | null = null;
  private busy = false;
  private cursor = 57;
  private ring!: GameObjects.Graphics;

  constructor(private readonly session: Session<CheckersMove>) {
    super('checkers');
  }

  private get state(): CheckersState {
    return this.session.state as CheckersState;
  }

  create(): void {
    fitCamera(this, SIZE, SIZE);
    applySpeed(this);
    this.drawBoard();
    this.marks = this.add.graphics().setDepth(1);
    this.state.board.forEach((piece, sq) => {
      if (piece === CheckerPiece.empty) return;
      const view = this.makePiece(piece, sq);
      view.setScale(0);
      this.tweens.add({ targets: view, scale: 1, duration: 280, delay: 30 + sq * 6, ease: 'Back.easeOut' });
    });

    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      const col = Math.floor((p.worldX - MARGIN) / CELL);
      const row = Math.floor((p.worldY - MARGIN) / CELL);
      if (col >= 0 && col < 8 && row >= 0 && row < 8) this.tap(row * 8 + col);
    });

    // Keyboard: arrows move a ring over the board; Enter or Space works like a tap.
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
        this.tap(this.cursor);
        return true;
      }
      return false;
    });

    const unsubscribe = this.session.subscribe(() => this.onChange());
    this.events.once('shutdown', unsubscribe);
    this.drawMarks();
  }

  private drawBoard(): void {
    const g = this.add.graphics();
    if (ROOM) roomTable(g, SIZE, SIZE, MARGIN);
    else {
      g.fillStyle(toHex(DARK.mint), 1);
      g.fillRoundedRect(8, 14, SIZE - 16, SIZE - 16, 28);
      g.fillStyle(tone(0xffffff, ROOM_TONES.panel), 1);
      g.fillRoundedRect(8, 8, SIZE - 16, SIZE - 16, 28);
    }
    for (let sq = 0; sq < 64; sq++) {
      const dark = (Math.floor(sq / 8) + (sq % 8)) % 2 === 1;
      g.fillStyle(dark ? DARK_SQUARE : LIGHT, 1);
      g.fillRect(MARGIN + (sq % 8) * CELL, MARGIN + Math.floor(sq / 8) * CELL, CELL, CELL);
      if (ROOM) {
        g.fillStyle(0xffffff, dark ? 0.06 : 0.14);
        g.fillRect(MARGIN + (sq % 8) * CELL, MARGIN + Math.floor(sq / 8) * CELL, CELL, CELL * 0.36);
      }
    }
    if (ROOM) roomInset(g, MARGIN, MARGIN, SIZE - MARGIN * 2, SIZE - MARGIN * 2);
  }

  private makePiece(piece: number, sq: number): GameObjects.Container {
    const seat = ownerOf(piece) as 0 | 1;
    const g = this.add.graphics();
    g.fillStyle(PIECE_DARK[seat]!, 1);
    g.fillCircle(0, 5, RADIUS);
    g.fillStyle(PIECE_COLOR[seat]!, 1);
    g.fillCircle(0, 0, RADIUS);
    g.lineStyle(4, 0xffffff, 0.35);
    g.strokeCircle(0, 0, RADIUS * 0.66);
    const { x, y } = center(sq);
    const view = this.add.container(x, y, [g]).setDepth(2);
    if (isKing(piece)) view.add(this.makeCrown());
    this.pieces.set(sq, view);
    return view;
  }

  private makeCrown(): GameObjects.Graphics {
    const crown = this.add.graphics();
    crown.fillStyle(CROWN, 1);
    const w = RADIUS * 0.95;
    crown.beginPath();
    crown.moveTo(-w, 6);
    crown.lineTo(-w, -8);
    crown.lineTo(-w / 2, 0);
    crown.lineTo(0, -12);
    crown.lineTo(w / 2, 0);
    crown.lineTo(w, -8);
    crown.lineTo(w, 6);
    crown.closePath();
    crown.fillPath();
    crown.setName('crown');
    return crown;
  }

  /** Destinations for the selected piece: the end square of each of its legal moves. */
  private targetsFor(from: number): Map<number, CheckersMove> {
    const targets = new Map<number, CheckersMove>();
    for (const move of this.state.legalMoves(this.state.currentSeat)) {
      const path = move.split('-').map(Number);
      if (path[0] === from && !targets.has(path[path.length - 1]!)) targets.set(path[path.length - 1]!, move);
    }
    return targets;
  }

  private tap(sq: number): void {
    if (this.busy || !this.session.isHumanTurn()) return;
    if (this.selected !== null) {
      const move = this.targetsFor(this.selected).get(sq);
      if (move) {
        this.selected = null;
        this.session.play(move);
        return;
      }
    }
    const movable = this.state.movablePieces();
    if (movable.includes(sq)) this.selected = this.selected === sq ? null : sq;
    else {
      if (ownerOf(this.state.board[sq] ?? 0) === this.state.currentSeat) {
        // One of your pieces that can't move now (another one must jump): a small shake says so.
        const view = this.pieces.get(sq);
        if (view) this.tweens.add({ targets: view, angle: { from: -8, to: 8 }, duration: 55, yoyo: true, repeat: 2, onComplete: () => view.setAngle(0) });
      }
      this.selected = null;
    }
    this.drawMarks();
  }

  /** Last move, the selected piece, where it can go, and (when a jump is required) the pieces that must jump. */
  private drawMarks(): void {
    const g = this.marks.clear();
    const state = this.state;
    const last = state.last;
    if (last) {
      for (const sq of [last.path[0]!, last.path[last.path.length - 1]!]) {
        g.fillStyle(LAST_MOVE, 0.45);
        g.fillRect(MARGIN + (sq % 8) * CELL, MARGIN + Math.floor(sq / 8) * CELL, CELL, CELL);
      }
    }
    for (const view of this.pieces.values()) {
      this.tweens.killTweensOf(view);
      view.setScale(1);
    }
    if (state.result || !this.session.isHumanTurn()) return;
    const mustJump = state.legalMoves(state.currentSeat).some((m) => {
      const [a, b] = m.split('-').map(Number) as [number, number];
      return Math.abs(Math.floor(a / 8) - Math.floor(b / 8)) === 2;
    });
    if (mustJump) {
      for (const sq of state.movablePieces()) {
        const view = this.pieces.get(sq);
        if (view) this.tweens.add({ targets: view, scale: 1.1, duration: 360, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    }
    if (this.selected !== null) {
      const { x, y } = center(this.selected);
      g.lineStyle(6, toHex(COLORS.sunny), 1);
      g.strokeCircle(x, y, RADIUS + 6);
      for (const target of this.targetsFor(this.selected).keys()) {
        const c = center(target);
        g.fillStyle(TARGET, 0.85);
        g.fillCircle(c.x, c.y, RADIUS * 0.42);
        g.lineStyle(4, toHex(COLORS.sunny), 1);
        g.strokeCircle(c.x, c.y, RADIUS * 0.42);
      }
    }
  }

  private onChange(): void {
    const event = this.state.last;
    this.selected = null;
    if (!event) {
      this.drawMarks();
      return;
    }
    this.animate(event);
  }

  /** Slide a step, or hop jump by jump; taken pieces pop off; a crown drops on a new king. */
  private animate(event: CheckersEvent): void {
    const view = this.pieces.get(event.path[0]!);
    if (!view) return;
    this.busy = true;
    this.pieces.delete(event.path[0]!);
    view.setDepth(5);
    const jumping = event.captured.length > 0;
    const hops = event.path.slice(1);
    hops.forEach((sq, i) => {
      const from = i === 0 ? center(event.path[0]!) : center(hops[i - 1]!);
      const to = center(sq);
      this.tweens.addCounter({
        from: 0,
        to: 1,
        delay: i * HOP_MS,
        duration: HOP_MS - 10,
        ease: 'Sine.easeInOut',
        onUpdate: (tween) => {
          const t = tween.getValue() ?? 1;
          const lift = jumping ? Math.sin(Math.PI * t) * 34 : 0;
          view.setPosition(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t - lift);
        },
        onComplete: () => {
          if (!jumping) return;
          // The piece that was jumped pops and flies off the board.
          const taken = this.pieces.get(event.captured[i]!);
          if (taken) {
            this.pieces.delete(event.captured[i]!);
            this.tweens.add({
              targets: taken,
              scale: 1.3,
              duration: 90,
              yoyo: true,
              onComplete: () =>
                this.tweens.add({
                  targets: taken,
                  x: taken.x < SIZE / 2 ? -60 : SIZE + 60,
                  y: taken.y - 80,
                  angle: 200,
                  alpha: 0,
                  duration: 420,
                  ease: 'Cubic.easeIn',
                  onComplete: () => taken.destroy(),
                }),
            });
          }
          this.tweens.add({ targets: view, scaleX: 1.12, scaleY: 0.88, duration: 60, yoyo: true });
        },
      });
    });
    this.time.delayedCall(hops.length * HOP_MS + 40, () => {
      const end = event.path[event.path.length - 1]!;
      view.setDepth(2);
      this.pieces.set(end, view);
      if (event.crowned) {
        const crown = this.makeCrown();
        crown.setY(-90).setAlpha(0);
        view.add(crown);
        this.tweens.add({ targets: crown, y: 0, alpha: 1, duration: 360, ease: 'Bounce.easeOut' });
      }
      if (event.captured.length > 1) this.cameras.main.shake(140, 0.004);
      this.busy = false;
      this.drawMarks();
      if (this.state.result) this.celebrate();
    });
  }

  private celebrate(): void {
    const winner = this.state.result?.winners[0];
    if (winner === undefined) return;
    let i = 0;
    for (const [sq, view] of this.pieces) {
      if (ownerOf(this.state.board[sq] ?? 0) !== winner) continue;
      this.tweens.add({ targets: view, y: view.y - 18, duration: 200, delay: 200 + i++ * 60, yoyo: true, ease: 'Sine.easeOut' });
    }
  }
}
