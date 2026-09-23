import { chordMove, flagMove, revealMove, type SweeperMove, type SweeperState } from '@gamepals/rules';
import { Scene, type GameObjects, type Time } from 'phaser';
import { applySpeed } from '../../autoplay';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { arrow, focusRing, isPress, moveRing, onKeys } from '../keys';
import { sweeperUiFor, type SweeperUi } from './ui';

const W = 720;
const H = 1040;
export const SWEEPER_SIZE = { width: W, height: H };

const PAD = 14;
const GAP = 4;
/** How long a press has to be held to flag instead of dig. */
const LONG_PRESS_MS = 380;
/** A press that wanders further than this is a drag, not a tap. */
const DRAG_MAX = 26;
const COVER = toHex(COLORS.mint);
const COVER_LIP = toHex(DARK.mint);
const GROUND = 0xf4f1fb;
/** The classic reading of the numbers, in our colours: blue 1, green 2, red 3, and on up. */
const NUMBER_COLORS = ['', COLORS.sky, COLORS.mint, COLORS.tomato, COLORS.grape, COLORS.peach, COLORS.bubblegum, COLORS.ink, COLORS.soft];

/**
 * Sweeper. Every cover, flag and mine on screen is worked out from the state each time it changes,
 * and animations are only how one picture turns into the next. That is the lesson of Q1: a scene
 * that keeps its own copy of the board and walks it toward the rules can fall behind them, and one
 * that reconciles against the rules every time cannot.
 */
export class SweeperScene extends Scene {
  private readonly ui: SweeperUi;
  private cell = 0;
  private pitch = 0;
  private x0 = 0;
  private y0 = 0;
  private readonly covers = new Map<number, GameObjects.Graphics>();
  private readonly flags = new Map<number, GameObjects.Container>();
  private readonly numbers = new Map<number, GameObjects.Text>();
  private readonly mines = new Map<number, GameObjects.Container>();
  private readonly crosses = new Map<number, GameObjects.Graphics>();
  private press: { cell: number; x: number; y: number; long: boolean } | null = null;
  private pressTimer?: Time.TimerEvent;
  private cursor = 0;
  private ring?: GameObjects.Graphics;
  /** Until when the last move is still playing out, for the result sheet and the gallery. */
  private busyUntil = 0;

  constructor(private readonly session: Session<SweeperMove>) {
    super('sweeper');
    this.ui = sweeperUiFor(session);
  }

  private get state(): SweeperState {
    return this.session.state as SweeperState;
  }

  private centre(cell: number): { x: number; y: number } {
    const { w } = this.state;
    return { x: this.x0 + (cell % w) * this.pitch + this.cell / 2, y: this.y0 + Math.floor(cell / w) * this.pitch + this.cell / 2 };
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    const { w, h } = this.state;
    this.cell = Math.min((W - PAD * 2 - GAP * (w - 1)) / w, (H - PAD * 2 - GAP * (h - 1)) / h);
    this.pitch = this.cell + GAP;
    const gridW = w * this.pitch - GAP;
    const gridH = h * this.pitch - GAP;
    this.x0 = (W - gridW) / 2;
    this.y0 = (H - gridH) / 2;
    this.cursor = Math.floor(h / 2) * w + Math.floor(w / 2);

    const bed = this.add.graphics();
    bed.fillStyle(0xe6e0f4, 1);
    bed.fillRoundedRect(this.x0 - 10, this.y0 - 10 + 6, gridW + 20, gridH + 20, 24);
    bed.fillStyle(0xffffff, 1);
    bed.fillRoundedRect(this.x0 - 10, this.y0 - 10, gridW + 20, gridH + 20, 24);
    for (let cell = 0; cell < w * h; cell++) {
      const { x, y } = this.centre(cell);
      bed.fillStyle(GROUND, 1);
      bed.fillRoundedRect(x - this.cell / 2, y - this.cell / 2, this.cell, this.cell, this.cell * 0.2);
    }

    this.ring = focusRing(this, this.cell + 12, this.cell + 12, this.cell * 0.24);
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.pointerDown(p.worldX, p.worldY));
    this.input.on('pointerup', (p: { worldX: number; worldY: number }) => this.pointerUp(p.worldX, p.worldY));
    onKeys(this, (key) => this.key(key));

    this.sync(false);
    const unsubscribe = this.session.subscribe(() => this.sync(true));
    this.events.once('shutdown', () => {
      unsubscribe();
      this.pressTimer?.remove();
    });
  }

  /** Still showing the last move. See `apps/client/src/games/busy.ts`. */
  busy(): boolean {
    return this.time.now < this.busyUntil;
  }

  private lost(): boolean {
    return !!this.state.result && this.state.result.winners.length === 0;
  }

  /** What the rules say this square should look like right now, including how the game ended. */
  private wants(cell: number): { cover: boolean; flag: boolean; mine: boolean; cross: boolean } {
    const state = this.state;
    const isMine = !!state.mines?.[cell];
    const flagged = state.flags[cell]! && !state.open[cell];
    const won = !!state.result && state.result.winners.length > 0;
    const lost = this.lost();
    return {
      // A lost board shows every mine it was hiding, except under a flag that was right.
      cover: !state.open[cell] && !(lost && isMine && !flagged),
      // A won board flags every mine, the way every version has always finished.
      flag: flagged || (won && isMine),
      mine: lost && isMine && !flagged,
      cross: lost && flagged && !isMine,
    };
  }

  private sync(animate: boolean): void {
    const state = this.state;
    const last = new Map(state.last.map((cell, i) => [cell, i]));
    const origin = state.boom ?? state.last[0] ?? this.cursor;
    let longest = 0;
    for (let cell = 0; cell < state.cells; cell++) {
      const want = this.wants(cell);
      const delay = this.delayFor(cell, origin, last);
      longest = Math.max(longest, delay);

      const cover = this.covers.get(cell);
      if (want.cover && !cover) this.covers.set(cell, this.makeCover(cell));
      if (!want.cover && cover) {
        // Out of the map now rather than when the tween ends, so the next sync cannot trip over it.
        this.covers.delete(cell);
        if (animate) this.lift(cover, delay, cell);
        else cover.destroy();
      }

      const count = state.counts?.[cell] ?? 0;
      if (state.open[cell] && !state.mines?.[cell] && count > 0 && !this.numbers.has(cell)) {
        const { x, y } = this.centre(cell);
        const label = sharpText(this, x, y, String(count), this.cell * 0.56, NUMBER_COLORS[count]!).setFontStyle('bold').setDepth(1);
        this.numbers.set(cell, label);
        if (animate) {
          label.setScale(0.4).setAlpha(0);
          this.tweens.add({ targets: label, scale: 1, alpha: 1, duration: 180, delay: delay + 60, ease: 'Back.easeOut' });
        }
      }

      this.toggle(this.flags, cell, want.flag, () => this.makeFlag(cell), animate, delay);
      this.toggle(this.mines, cell, want.mine, () => this.makeMine(cell), animate, delay);
      this.toggleCross(cell, want.cross);
    }
    if (animate) {
      this.busyUntil = this.time.now + longest + 320;
      if (state.boom !== null) this.cameras.main.shake(260, 0.008);
    }
  }

  /** Squares open outward from where it started, so a big flood reads as a wave rather than a blink. */
  private delayFor(cell: number, origin: number, last: ReadonlyMap<number, number>): number {
    const { w } = this.state;
    const index = last.get(cell);
    if (index === undefined && !this.state.result) return 0;
    const dx = (cell % w) - (origin % w);
    const dy = Math.floor(cell / w) - Math.floor(origin / w);
    return Math.min(Math.hypot(dx, dy) * 26, 520);
  }

  private toggle(
    views: Map<number, GameObjects.Container>,
    cell: number,
    wanted: boolean,
    make: () => GameObjects.Container,
    animate: boolean,
    delay: number,
  ): void {
    const view = views.get(cell);
    if (wanted && !view) {
      const made = make();
      views.set(cell, made);
      if (animate) {
        const y = made.y;
        made.setY(y - this.cell * 0.4).setAlpha(0);
        this.tweens.add({ targets: made, y, alpha: 1, duration: 260, delay, ease: 'Bounce.easeOut' });
      }
    } else if (!wanted && view) {
      views.delete(cell);
      view.destroy();
    }
  }

  private toggleCross(cell: number, wanted: boolean): void {
    const view = this.crosses.get(cell);
    if (wanted && !view) {
      const { x, y } = this.centre(cell);
      const r = this.cell * 0.3;
      const g = this.add.graphics().setDepth(4);
      g.lineStyle(this.cell * 0.09, toHex(COLORS.ink), 1);
      g.lineBetween(x - r, y - r, x + r, y + r);
      g.lineBetween(x - r, y + r, x + r, y - r);
      this.crosses.set(cell, g);
    } else if (!wanted && view) {
      this.crosses.delete(cell);
      view.destroy();
    }
  }

  private makeCover(cell: number): GameObjects.Graphics {
    const { x, y } = this.centre(cell);
    const size = this.cell;
    const g = this.add.graphics().setDepth(2).setPosition(x, y);
    g.fillStyle(COVER_LIP, 1);
    g.fillRoundedRect(-size / 2, -size / 2 + 4, size, size - 2, size * 0.2);
    g.fillStyle(COVER, 1);
    g.fillRoundedRect(-size / 2, -size / 2, size, size - 5, size * 0.2);
    return g;
  }

  /** A cover lifting away: it rises, shrinks and fades, so the square underneath is revealed. */
  private lift(cover: GameObjects.Graphics, delay: number, cell: number): void {
    this.tweens.add({
      targets: cover,
      scale: 0.3,
      alpha: 0,
      y: cover.y - this.cell * 0.25,
      // Alternate squares tip opposite ways, so a flood looks scattered without being random.
      angle: ((cell + Math.floor(cell / this.state.w)) % 2 === 0 ? -1 : 1) * 18,
      duration: 220,
      delay,
      ease: 'Quad.easeIn',
      onComplete: () => cover.destroy(),
    });
  }

  private makeFlag(cell: number): GameObjects.Container {
    const { x, y } = this.centre(cell);
    const s = this.cell;
    const g = this.add.graphics();
    g.fillStyle(toHex(COLORS.ink), 1);
    g.fillRoundedRect(-s * 0.06, -s * 0.3, s * 0.09, s * 0.56, s * 0.04);
    g.fillRoundedRect(-s * 0.2, s * 0.22, s * 0.36, s * 0.08, s * 0.04);
    g.fillStyle(toHex(COLORS.tomato), 1);
    g.fillTriangle(s * 0.03, -s * 0.3, s * 0.3, -s * 0.16, s * 0.03, -s * 0.02);
    return this.add.container(x, y - 2, [g]).setDepth(3);
  }

  private makeMine(cell: number): GameObjects.Container {
    const { x, y } = this.centre(cell);
    const s = this.cell;
    const parts: GameObjects.GameObject[] = [];
    if (cell === this.state.boom) {
      const plate = this.add.graphics();
      plate.fillStyle(toHex(COLORS.tomato), 1);
      plate.fillRoundedRect(-s / 2, -s / 2, s, s, s * 0.2);
      parts.push(plate);
    }
    const g = this.add.graphics();
    g.lineStyle(s * 0.07, toHex(COLORS.ink), 1);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.lineBetween(Math.cos(a) * s * 0.12, Math.sin(a) * s * 0.12, Math.cos(a) * s * 0.34, Math.sin(a) * s * 0.34);
    }
    g.fillStyle(toHex(COLORS.ink), 1);
    g.fillCircle(0, 0, s * 0.24);
    g.fillStyle(0xffffff, 0.75);
    g.fillCircle(-s * 0.08, -s * 0.08, s * 0.06);
    parts.push(g);
    return this.add.container(x, y, parts).setDepth(3);
  }

  private cellAt(x: number, y: number): number | null {
    const { w, h } = this.state;
    const col = Math.floor((x - this.x0) / this.pitch);
    const row = Math.floor((y - this.y0) / this.pitch);
    if (col < 0 || row < 0 || col >= w || row >= h) return null;
    return row * w + col;
  }

  private pointerDown(x: number, y: number): void {
    const cell = this.cellAt(x, y);
    if (cell === null) return;
    this.press = { cell, x, y, long: false };
    this.pressTimer?.remove();
    // Held long enough, a press flags instead of digging, whatever the toggle says.
    this.pressTimer = this.time.delayedCall(LONG_PRESS_MS, () => {
      const press = this.press;
      if (!press || press.cell !== cell || this.state.open[cell]) return;
      press.long = true;
      this.flag(cell);
    });
  }

  private pointerUp(x: number, y: number): void {
    const press = this.press;
    this.press = null;
    this.pressTimer?.remove();
    if (!press || press.long) return;
    if (Math.hypot(x - press.x, y - press.y) > DRAG_MAX) return;
    this.act(press.cell);
  }

  /** A plain tap: dig, flag if the toggle says so, or sweep round a finished number. */
  private act(cell: number): void {
    const state = this.state;
    if (state.result || !this.session.isHumanTurn()) return;
    if (state.open[cell]) {
      if (state.legalMoves(0).includes(chordMove(cell))) this.session.play(chordMove(cell));
      else this.shake(this.numbers.get(cell));
      return;
    }
    if (this.ui.flagging) {
      this.flag(cell);
      return;
    }
    // A flag is there to stop exactly this, so it wobbles instead of letting the dig through.
    if (state.flags[cell]) {
      this.shake(this.flags.get(cell));
      return;
    }
    this.session.play(revealMove(cell));
  }

  private flag(cell: number): void {
    const state = this.state;
    if (state.result || !this.session.isHumanTurn()) return;
    if (state.legalMoves(0).includes(flagMove(cell))) this.session.play(flagMove(cell));
  }

  private shake(target: GameObjects.GameObject | undefined): void {
    if (!target) return;
    this.tweens.add({ targets: target, angle: { from: -8, to: 8 }, duration: 55, yoyo: true, repeat: 1, onComplete: () => (target as GameObjects.Container).setAngle(0) });
  }

  private key(key: string): boolean {
    const { w, h } = this.state;
    const step = arrow(key);
    if (step) {
      const col = Math.min(w - 1, Math.max(0, (this.cursor % w) + step[0]));
      const row = Math.min(h - 1, Math.max(0, Math.floor(this.cursor / w) + step[1]));
      this.cursor = row * w + col;
      const { x, y } = this.centre(this.cursor);
      if (this.ring) moveRing(this, this.ring, x, y);
      return true;
    }
    if (isPress(key)) {
      this.act(this.cursor);
      return true;
    }
    if (key.toLowerCase() === 'f') {
      this.flag(this.cursor);
      return true;
    }
    return false;
  }

  /**
   * Whether what is drawn is what the rules say, for the Q1 check in `e2e/wordlayout.spec.ts`. The
   * question is only presence: covers, flags and mines are each drawn from the state every time it
   * changes, so a square is either right or on its way to being right.
   */
  boardCheck(): { settled: number; wrong: number; note: string } {
    let settled = 0;
    let wrong = 0;
    let note = '';
    for (let cell = 0; cell < this.state.cells; cell++) {
      const want = this.wants(cell);
      settled++;
      for (const [name, has, should] of [
        ['a cover', this.covers.has(cell), want.cover],
        ['a flag', this.flags.has(cell), want.flag],
        ['a mine', this.mines.has(cell), want.mine],
      ] as const) {
        if (has !== should) {
          wrong++;
          note = `square ${cell} ${should ? 'should have' : 'should not have'} ${name}`;
        }
      }
    }
    return { settled, wrong, note };
  }
}
