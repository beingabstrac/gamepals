import { placePieceMove, type JigsawMove, type JigsawState, type PieceSides } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import type { Session } from '../../session';
import { DPR, fitCamera } from '../crisp';
import { arrow, focusRing, isPress, moveRing, onKeys } from '../keys';
import { PICTURE_H, PICTURE_W, pictureSvg } from './pictures';
import { jigsawUiFor, type JigsawUi } from './ui';

const W = 720;
const H = 1040;
export const JIGSAW_SIZE = { width: W, height: H };

/** The board: the picture at full size, 4 by 3. */
const BW = 660;
const BH = (BW * PICTURE_H) / PICTURE_W;
const BX = (W - BW) / 2;
const BY = 34;
/** The tray under it, where the loose pieces wait. */
const TRAY_TOP = BY + BH + 30;
const TRAY_BOTTOM = H - 16;
/** How big a knob is, against the smaller side of a piece, and the room left round a piece for it. */
const KNOB = 0.22;
const MARGIN = 0.27;
/** A drop this close to where a piece belongs, against the smaller side of a piece, snaps it in. */
const SNAP = 0.42;
/** A press that moves less than this is a tap, not a drag. */
const TAP_MAX = 12;

/** Each scene's pieces get their own texture names, so two puzzles can never share one. */
let scenes = 0;

interface PieceView {
  readonly image: GameObjects.Image;
  place: 'tray' | 'board';
}

/**
 * Jigsaw. The picture is drawn once as SVG, and every piece is cut out of it on a canvas along its
 * own outline, so the pieces fit because they come from the same picture along the same lines.
 * Where each piece belongs (tray or board) is read from the state every time it changes.
 */
export class JigsawScene extends Scene {
  private readonly ui: JigsawUi;
  private readonly prefix = `jigsaw-${++scenes}`;
  private readonly views: PieceView[] = [];
  private cw = 0;
  private ch = 0;
  private trayScale = 1;
  private ready = false;
  private held: { piece: number; dx: number; dy: number; x: number; y: number; moved: boolean } | null = null;
  private selected: number | null = null;
  private cursor = 0;
  private boardCursor = 0;
  private ring?: GameObjects.Graphics;
  private busyUntil = 0;

  constructor(private readonly session: Session<JigsawMove>) {
    super('jigsaw');
    this.ui = jigsawUiFor(session);
  }

  private get state(): JigsawState {
    return this.session.state as JigsawState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    const { cols, rows } = this.state;
    this.cw = BW / cols;
    this.ch = BH / rows;
    const k = Math.min(this.cw, this.ch);
    const box = { w: this.cw + 2 * MARGIN * k, h: this.ch + 2 * MARGIN * k };
    const slotW = (W - 32) / cols;
    const slotH = (TRAY_BOTTOM - TRAY_TOP) / rows;
    this.trayScale = Math.min((slotW - 6) / box.w, (slotH - 6) / box.h, 0.9);

    const mat = this.add.graphics();
    mat.fillStyle(0xe6e0f4, 1);
    mat.fillRoundedRect(BX - 10, BY - 10 + 6, BW + 20, BH + 20, 22);
    mat.fillStyle(0xffffff, 1);
    mat.fillRoundedRect(BX - 10, BY - 10, BW + 20, BH + 20, 22);
    mat.fillStyle(0xf4f1fb, 1);
    mat.fillRect(BX, BY, BW, BH);

    this.ring = focusRing(this, this.cw + 10, this.ch + 10, 14);
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.down(p.worldX, p.worldY));
    this.input.on('pointermove', (p: { worldX: number; worldY: number; isDown: boolean }) => p.isDown && this.drag(p.worldX, p.worldY));
    this.input.on('pointerup', (p: { worldX: number; worldY: number }) => this.up(p.worldX, p.worldY));
    onKeys(this, (key) => this.key(key));

    const unsubscribe = this.session.subscribe(() => this.sync(true));
    const unwatch = this.ui.subscribe(() => this.dim());
    // The textures go with the game: every game gets its own Phaser instance, destroyed when you leave.
    this.events.once('shutdown', () => {
      unsubscribe();
      unwatch();
    });
    void this.cut();
  }

  /** Still cutting, or still showing the last move. See `apps/client/src/games/busy.ts`. */
  busy(): boolean {
    return !this.ready || this.time.now < this.busyUntil;
  }

  /** Draws the picture, cuts every piece out of it, and lays them out. */
  private async cut(): Promise<void> {
    const state = this.state;
    const picture = document.createElement('canvas');
    picture.width = Math.round(BW * DPR);
    picture.height = Math.round(BH * DPR);
    // A blob is same-origin, so the canvas it is drawn on is not tainted and WebGL will take it; some
    // browsers taint a canvas for an SVG from a data URL.
    const url = URL.createObjectURL(new Blob([pictureSvg(state.picture, picture.width, picture.height)], { type: 'image/svg+xml' }));
    const image = new Image();
    // `onload` rather than `decode()`, which Safari has been known to refuse for SVG. A picture that
    // will not draw still leaves a puzzle of plain pieces, rather than no puzzle.
    await new Promise<void>((resolve) => {
      image.onload = () => resolve();
      image.onerror = () => resolve();
      image.src = url;
    });
    URL.revokeObjectURL(url);
    if (!this.sys.isActive()) return;
    const pctx = picture.getContext('2d')!;
    pctx.fillStyle = '#FFFFFF';
    pctx.fillRect(0, 0, picture.width, picture.height);
    if (image.complete && image.naturalWidth > 0) pctx.drawImage(image, 0, 0, picture.width, picture.height);

    // The faint picture on the board that shows where things go; fainter on Hard.
    this.textures.addCanvas(`${this.prefix}-ghost`, picture);
    this.add
      .image(BX + BW / 2, BY + BH / 2, `${this.prefix}-ghost`)
      .setScale(1 / DPR)
      .setAlpha(state.level === 'hard' ? 0.12 : 0.22);

    const k = Math.min(this.cw, this.ch);
    const m = MARGIN * k;
    for (let piece = 0; piece < state.pieces; piece++) {
      const col = piece % state.cols;
      const row = Math.floor(piece / state.cols);
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil((this.cw + 2 * m) * DPR);
      canvas.height = Math.ceil((this.ch + 2 * m) * DPR);
      const ctx = canvas.getContext('2d')!;
      ctx.scale(DPR, DPR);
      ctx.translate(m, m);
      outline(ctx, this.cw, this.ch, state.sides(piece), k * KNOB);
      ctx.save();
      ctx.clip();
      ctx.drawImage(picture, -col * this.cw, -row * this.ch, BW, BH);
      ctx.restore();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(43, 42, 58, 0.25)';
      ctx.stroke();
      this.textures.addCanvas(`${this.prefix}-${piece}`, canvas);
      const home = this.home(piece);
      const img = this.add.image(home.x, home.y, `${this.prefix}-${piece}`).setScale(1 / DPR);
      this.views.push({ image: img, place: 'board' });
    }
    this.ready = true;
    this.sync(false);
    this.dim();
  }

  /** Where a piece belongs on the board: the middle of its cell. */
  private home(piece: number): { x: number; y: number } {
    const { cols } = this.state;
    return { x: BX + (piece % cols) * this.cw + this.cw / 2, y: BY + Math.floor(piece / cols) * this.ch + this.ch / 2 };
  }

  /** Where a loose piece waits: its own place in the tray, which never moves while it waits. */
  private slot(piece: number): { x: number; y: number } {
    const { cols, rows, trayOrder } = this.state;
    const i = trayOrder.indexOf(piece);
    const slotW = (W - 32) / cols;
    const slotH = (TRAY_BOTTOM - TRAY_TOP) / rows;
    return { x: 16 + (i % cols) * slotW + slotW / 2, y: TRAY_TOP + Math.floor(i / cols) * slotH + slotH / 2 };
  }

  private sync(animate: boolean): void {
    if (!this.ready) return;
    const state = this.state;
    let longest = 0;
    this.views.forEach((view, piece) => {
      const want = state.placed[piece] ? 'board' : 'tray';
      if (view.place === want && animate) return;
      view.place = want;
      const image = view.image;
      this.tweens.killTweensOf(image);
      if (want === 'board') {
        const { x, y } = this.home(piece);
        image.setDepth(10);
        if (animate) {
          // In it goes: a small overshoot and a settle, the click of a piece finding its place.
          this.tweens.add({ targets: image, x, y, scale: 1.08 / DPR, alpha: 1, duration: 150, ease: 'Quad.easeOut', onComplete: () => this.tweens.add({ targets: image, scale: 1 / DPR, duration: 160, ease: 'Back.easeOut' }) });
          longest = 330;
        } else image.setPosition(x, y).setScale(1 / DPR).setAlpha(1);
      } else {
        const { x, y } = this.slot(piece);
        image.setDepth(20 + state.trayOrder.indexOf(piece)).setPosition(x, y).setScale(this.trayScale / DPR);
      }
    });
    if (this.selected !== null && state.placed[this.selected]) this.selected = null;
    this.busyUntil = this.time.now + longest;
    if (animate && state.result) this.time.delayedCall(longest, () => this.cameras.main.flash(260, 255, 255, 255));
    this.dim();
  }

  /** With Edges first on, the middle pieces step back; the one picked up always stands out. */
  private dim(): void {
    const state = this.state;
    this.views.forEach((view, piece) => {
      if (view.place === 'board') return;
      const back = this.ui.edgesFirst && !state.isEdge(piece);
      view.image.setAlpha(back ? 0.3 : 1);
    });
  }

  /** The loose piece under a point, the top one if they overlap. */
  private pieceAt(x: number, y: number): number | null {
    let best: number | null = null;
    let bestDepth = -1;
    this.views.forEach((view, piece) => {
      if (view.place !== 'tray') return;
      const image = view.image;
      const halfW = (this.cw / 2) * (image.scale * DPR) + 6;
      const halfH = (this.ch / 2) * (image.scale * DPR) + 6;
      if (Math.abs(x - image.x) <= halfW && Math.abs(y - image.y) <= halfH && image.depth > bestDepth) {
        best = piece;
        bestDepth = image.depth;
      }
    });
    return best;
  }

  private cellAt(x: number, y: number): number | null {
    const { cols, rows } = this.state;
    const col = Math.floor((x - BX) / this.cw);
    const row = Math.floor((y - BY) / this.ch);
    if (col < 0 || row < 0 || col >= cols || row >= rows) return null;
    return row * cols + col;
  }

  private canPlay(): boolean {
    return this.ready && !this.state.result && this.session.isHumanTurn();
  }

  private down(x: number, y: number): void {
    if (!this.canPlay()) return;
    const piece = this.pieceAt(x, y);
    if (piece === null) {
      // A tap on the board with a piece picked up tries it there.
      const cell = this.cellAt(x, y);
      if (cell !== null && this.selected !== null) this.tryAt(this.selected, cell);
      return;
    }
    const image = this.views[piece]!.image;
    this.tweens.killTweensOf(image);
    this.held = { piece, dx: image.x - x, dy: image.y - y, x, y, moved: false };
    image.setDepth(200).setAlpha(1);
    // Picked up, it grows to its size on the board, so what you drag is what will fit.
    this.tweens.add({ targets: image, scale: 1.04 / DPR, duration: 120, ease: 'Quad.easeOut' });
  }

  private drag(x: number, y: number): void {
    const held = this.held;
    if (!held) return;
    if (Math.hypot(x - held.x, y - held.y) > TAP_MAX) held.moved = true;
    if (!held.moved) return;
    // Held a little above the finger, so the finger does not hide it.
    this.views[held.piece]!.image.setPosition(x + held.dx * 0.3, y + held.dy * 0.3 - 20);
  }

  private up(x: number, y: number): void {
    const held = this.held;
    this.held = null;
    if (!held) return;
    const piece = held.piece;
    const image = this.views[piece]!.image;
    if (!held.moved) {
      // A tap picks a piece up to be placed with a second tap, or puts it down again.
      this.selected = this.selected === piece ? null : piece;
      this.back(piece);
      return;
    }
    const home = this.home(piece);
    if (Math.hypot(image.x - home.x, image.y - home.y) <= SNAP * Math.min(this.cw, this.ch)) {
      this.selected = null;
      this.session.play(placePieceMove(piece));
    } else this.back(piece, true);
  }

  /** A piece goes back to its place in the tray; a wrong drop wobbles on the way. */
  private back(piece: number, wrong = false): void {
    const image = this.views[piece]!.image;
    const { x, y } = this.slot(piece);
    const lifted = this.selected === piece;
    this.tweens.killTweensOf(image);
    this.tweens.add({
      targets: image,
      x,
      y: lifted ? y - 10 : y,
      scale: (lifted ? this.trayScale * 1.12 : this.trayScale) / DPR,
      duration: 240,
      ease: 'Back.easeOut',
      onComplete: () => {
        image.setDepth(lifted ? 150 : 20 + this.state.trayOrder.indexOf(piece));
        if (wrong) this.tweens.add({ targets: image, angle: { from: -6, to: 6 }, duration: 60, yoyo: true, repeat: 1, onComplete: () => image.setAngle(0) });
      },
    });
    this.views.forEach((view, other) => {
      if (other !== piece && view.place === 'tray' && this.selected !== other) {
        const spot = this.slot(other);
        if (view.image.y !== spot.y) this.tweens.add({ targets: view.image, y: spot.y, scale: this.trayScale / DPR, duration: 160 });
      }
    });
    this.dim();
  }

  /** Tries a picked-up piece in a cell: in if it is its own, back with a wobble if not. */
  private tryAt(piece: number, cell: number): void {
    if (cell === piece) {
      this.selected = null;
      this.session.play(placePieceMove(piece));
      return;
    }
    this.selected = null;
    this.back(piece, true);
  }

  private key(key: string): boolean {
    if (!this.canPlay()) return false;
    const state = this.state;
    const loose = state.trayOrder.filter((piece) => !state.placed[piece]);
    if (loose.length === 0) return false;
    const step = arrow(key);
    if (this.selected === null) {
      if (!loose.includes(this.cursor)) this.cursor = loose[0]!;
      if (step) {
        // Walk the tray in its own grid, skipping the empty places.
        const { cols } = state;
        const at = state.trayOrder.indexOf(this.cursor);
        const target = at + step[0] + step[1] * cols;
        const candidates = loose.map((piece) => ({ piece, i: state.trayOrder.indexOf(piece) }));
        const next = candidates.reduce((best, c) => (Math.abs(c.i - target) < Math.abs(best.i - target) && c.i !== at ? c : best), { piece: this.cursor, i: 1e9 });
        if (next.i !== 1e9) this.cursor = next.piece;
        const image = this.views[this.cursor]!.image;
        if (this.ring) moveRing(this, this.ring, image.x, image.y);
        return true;
      }
      if (isPress(key)) {
        this.selected = this.cursor;
        this.back(this.cursor);
        const home = this.home(this.boardCursor);
        if (this.ring) moveRing(this, this.ring, home.x, home.y);
        return true;
      }
      return false;
    }
    if (step) {
      const { cols, rows } = state;
      const col = Math.min(cols - 1, Math.max(0, (this.boardCursor % cols) + step[0]));
      const row = Math.min(rows - 1, Math.max(0, Math.floor(this.boardCursor / cols) + step[1]));
      this.boardCursor = row * cols + col;
      const home = this.home(this.boardCursor);
      if (this.ring) moveRing(this, this.ring, home.x, home.y);
      return true;
    }
    if (isPress(key)) {
      this.tryAt(this.selected, this.boardCursor);
      return true;
    }
    if (key === 'Escape') {
      const piece = this.selected;
      this.selected = null;
      this.back(piece);
      return true;
    }
    return false;
  }

  /** Whether every piece is where the rules say, for the Q1 check in `e2e/wordlayout.spec.ts`. */
  boardCheck(): { settled: number; wrong: number; note: string } {
    let settled = 0;
    let wrong = 0;
    let note = '';
    if (!this.ready) return { settled, wrong, note };
    this.views.forEach((view, piece) => {
      if (this.tweens.isTweening(view.image) || this.held?.piece === piece) return;
      settled++;
      const want = this.state.placed[piece] ? this.home(piece) : this.slot(piece);
      const image = view.image;
      // A picked-up piece sits a little above its place in the tray.
      if (Math.abs(image.x - want.x) > 2 || Math.abs(image.y - want.y) > (this.selected === piece ? 12 : 2)) {
        wrong++;
        note = `piece ${piece} is at ${Math.round(image.x)},${Math.round(image.y)}, the rules put it at ${Math.round(want.x)},${Math.round(want.y)}`;
      }
    });
    return { settled, wrong, note };
  }
}

/**
 * A piece's outline, clockwise from its top left corner, with a knob or a hole on each side that
 * has one. The knob is symmetric about the middle of its side, so the neighbour traced the other way
 * round draws exactly the same curve and the two fit.
 */
function outline(ctx: CanvasRenderingContext2D, w: number, h: number, sides: PieceSides, knob: number): void {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  edge(ctx, 0, 0, w, 0, 0, -1, sides.top, knob);
  edge(ctx, w, 0, w, h, 1, 0, sides.right, knob);
  edge(ctx, w, h, 0, h, 0, 1, sides.bottom, knob);
  edge(ctx, 0, h, 0, 0, -1, 0, sides.left, knob);
  ctx.closePath();
}

function edge(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, nx: number, ny: number, side: number, knob: number): void {
  if (side === 0) {
    ctx.lineTo(bx, by);
    return;
  }
  const s = side * knob;
  const p = (t: number, v: number): [number, number] => [ax + (bx - ax) * t + nx * v * s, ay + (by - ay) * t + ny * v * s];
  const curve = (a: [number, number], b: [number, number], c: [number, number]) => ctx.bezierCurveTo(a[0], a[1], b[0], b[1], c[0], c[1]);
  ctx.lineTo(...p(0.36, 0));
  curve(p(0.41, 0), p(0.43, 0.35), p(0.39, 0.55));
  curve(p(0.33, 0.85), p(0.43, 1), p(0.5, 1));
  curve(p(0.57, 1), p(0.67, 0.85), p(0.61, 0.55));
  curve(p(0.57, 0.35), p(0.59, 0), p(0.64, 0));
  ctx.lineTo(bx, by);
}
