import { UR_OFF, UR_PIECES, UR_ROSETTES, type Seat, type UrMove, type UrState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { facing, isPerson } from '../duel';
import { focusRing, moveRing, onKeys } from '../keys';

const W = 600;
const H = 900;
export const UR_SIZE = { width: W, height: H };
export const UR_COLORS = [COLORS.sky, COLORS.tomato];
export const UR_NAMES = ['Blue', 'Red'];

const CELL = 96;
const X0 = (W - 3 * CELL) / 2;
const Y0 = 70;
const PIECE_R = 30;
const SEAT_HEX = UR_COLORS.map(toHex);
const SEAT_DARK = [toHex(DARK.sky), toHex(DARK.tomato)];
/** Each player's own column: Blue on the right, Red on the left, the shared row down the middle. */
const OWN_COL = [2, 0];

/** The board as the tablet has it, stood on end: 8 long, 3 wide, with a gap in the two outer rows. */
const cellExists = (col: number, row: number): boolean => col === 1 || row <= 1 || row >= 4;
const cellXY = (col: number, row: number) => ({ x: X0 + col * CELL + CELL / 2, y: Y0 + row * CELL + CELL / 2 });

/** Where square `pos` of `seat`'s path is on screen: down their own column, up the middle, back into their own. */
function pathXY(seat: Seat, pos: number): { x: number; y: number } {
  const own = OWN_COL[seat]!;
  if (pos <= 4) return cellXY(own, 3 + pos);
  if (pos <= 12) return cellXY(1, 12 - pos);
  return cellXY(own, pos - 13);
}

const isRosetteCell = (col: number, row: number): boolean => (col !== 1 && (row === 7 || row === 1)) || (col === 1 && row === 4);

/**
 * The Royal Game of Ur. The rules throw the dice and move the pieces; the scene draws the board on
 * end so it fits a phone, hops each piece square by square along its path, flies a knocked-off piece
 * home in an arc, and holds the bots until the hop has landed.
 */
export class UrScene extends Scene {
  private pieces: GameObjects.Container[][] = [[], []];
  /** Which square each piece is on, as the scene last showed it. */
  private where: number[][] = [[], []];
  private dice: GameObjects.Graphics[] = [];
  private rollLabels: GameObjects.Text[] = [];
  private hints!: GameObjects.Graphics;
  private ring!: GameObjects.Graphics;
  private focus = 0;
  private moving = 0;
  private rollingUntil = 0;
  private shownThrows = 0;

  constructor(private readonly session: Session<UrMove>) {
    super('ur');
  }

  private get state(): UrState {
    return this.session.state as UrState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.drawBoard();
    this.hints = this.add.graphics().setDepth(3);
    for (const seat of [0, 1] as const) {
      for (let i = 0; i < UR_PIECES; i++) {
        this.pieces[seat]!.push(this.makePiece(seat));
        this.where[seat]!.push(0);
      }
      const d = this.add.graphics().setDepth(4);
      this.dice.push(d);
      const { x, y } = this.diceXY(seat);
      const label = sharpText(this, x, y + 58, 'Roll', 24, COLORS.ink).setFontStyle('bold').setDepth(4);
      label.setAngle(facing(this.session.seats, seat));
      this.rollLabels.push(label);
    }
    this.ring = focusRing(this, PIECE_R * 2 + 12, PIECE_R * 2 + 12, PIECE_R + 6);
    this.layout(false);
    this.drawDice(this.state.dice);
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.press(p.worldX, p.worldY));
    onKeys(this, (key) => this.key(key));
    const off = this.session.subscribe(() => this.changed());
    this.session.holdBots = () => this.busy();
    this.events.once('shutdown', () => {
      off();
      this.session.holdBots = null;
    });
    this.refresh();
  }

  /** A hop or a throw is still showing. See `apps/client/src/games/busy.ts`. */
  busy(): boolean {
    return this.moving > 0 || this.time.now < this.rollingUntil;
  }

  private diceXY(seat: Seat): { x: number; y: number } {
    const own = OWN_COL[seat]!;
    const top = cellXY(own, 2);
    return { x: top.x, y: top.y + CELL / 2 - 16 };
  }

  private stackXY(seat: Seat, square: number, index: number): { x: number; y: number } {
    const x = seat === 0 ? W - 46 : 46;
    // Waiting pieces sit by the start of their path, finished ones by the end.
    if (square === 0) return { x, y: Y0 + 4 * CELL + 34 + index * 50 };
    return { x, y: Y0 + 30 + index * 40 };
  }

  private drawBoard(): void {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0xe6e0f4, 1);
    g.fillRoundedRect(X0 - 14, Y0 - 14 + 8, 3 * CELL + 28, 8 * CELL + 28, 30);
    g.fillStyle(0xf4f1fb, 1);
    g.fillRoundedRect(X0 - 14, Y0 - 14, 3 * CELL + 28, 8 * CELL + 28, 30);
    for (let col = 0; col < 3; col++) {
      for (let row = 0; row < 8; row++) {
        if (!cellExists(col, row)) continue;
        const { x, y } = cellXY(col, row);
        const shared = col === 1;
        g.fillStyle(shared ? toHex(DARK.sunny) : 0xd8d0ee, 1);
        g.fillRoundedRect(x - CELL / 2 + 4, y - CELL / 2 + 8, CELL - 8, CELL - 8, 18);
        g.fillStyle(shared ? toHex(COLORS.sunny) : 0xffffff, 1);
        g.fillRoundedRect(x - CELL / 2 + 4, y - CELL / 2 + 4, CELL - 8, CELL - 8, 18);
        if (isRosetteCell(col, row)) this.rosette(g, x, y);
      }
    }
    // Where each player comes on and goes off, as small arrows in their own column.
    for (const seat of [0, 1] as const) {
      const start = pathXY(seat, 1);
      const end = pathXY(seat, 14);
      g.fillStyle(SEAT_HEX[seat]!, 0.5);
      g.fillTriangle(start.x - 10, start.y - CELL / 2 - 6, start.x + 10, start.y - CELL / 2 - 6, start.x, start.y - CELL / 2 + 6);
      g.fillTriangle(end.x - 10, end.y - CELL / 2 + 2, end.x + 10, end.y - CELL / 2 + 2, end.x, end.y - CELL / 2 - 10);
    }
  }

  private rosette(g: GameObjects.Graphics, x: number, y: number): void {
    g.fillStyle(toHex(COLORS.bubblegum), 1);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.fillCircle(x + Math.cos(a) * 20, y + Math.sin(a) * 20, 11);
    }
    g.fillStyle(0xffffff, 1);
    g.fillCircle(x, y, 12);
    g.fillStyle(toHex(COLORS.sunny), 1);
    g.fillCircle(x, y, 6);
  }

  private makePiece(seat: Seat): GameObjects.Container {
    const g = this.add.graphics();
    g.fillStyle(SEAT_DARK[seat]!, 1);
    g.fillCircle(0, 4, PIECE_R);
    g.fillStyle(SEAT_HEX[seat]!, 1);
    g.fillCircle(0, 0, PIECE_R);
    // Five dots, as on the pieces found with the board.
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(0, 0, 4.5);
    for (const [dx, dy] of [[-11, -11], [11, -11], [-11, 11], [11, 11]]) g.fillCircle(dx!, dy!, 4.5);
    return this.add.container(0, 0, [g]).setDepth(5);
  }

  /** Puts every piece where the state has it, moving each one that is not already there. */
  private layout(animate: boolean): void {
    for (const seat of [0, 1] as const) {
      const target = this.state.pieces[seat].slice();
      const where = this.where[seat]!;
      // Keep every piece that is already on a square the state still has; move the rest.
      const free: number[] = [];
      const left = target.slice();
      where.forEach((square, i) => {
        const at = left.indexOf(square);
        if (at >= 0) left.splice(at, 1);
        else free.push(i);
      });
      free.forEach((i, k) => (where[i] = left[k]!));
      const counts = new Map<number, number>();
      where.forEach((square, i) => {
        const piece = this.pieces[seat]![i]!;
        let pos: { x: number; y: number };
        if (square === 0 || square === UR_OFF) {
          const n = counts.get(square) ?? 0;
          counts.set(square, n + 1);
          pos = this.stackXY(seat, square, n);
          piece.setScale(square === UR_OFF ? 0.7 : 0.85);
        } else {
          pos = pathXY(seat, square);
          piece.setScale(1);
        }
        if (!animate) piece.setPosition(pos.x, pos.y);
      });
    }
  }

  private changed(): void {
    const state = this.state;
    const last = state.last;
    if (state.throws !== this.shownThrows) {
      this.shownThrows = state.throws;
      this.roll(state);
    }
    if (last && this.where[last.seat]!.filter((s) => s === last.from).length > state.pieces[last.seat].filter((s) => s === last.from).length) {
      this.hop(last.seat, last.from, last.to, last.captured, last.again && !state.result);
    }
    this.refresh();
  }

  /** The throw: the dice tumble for a moment, then settle on what the rules threw. */
  private roll(state: UrState): void {
    const seat: Seat = state.passed ? (state.currentSeat === 0 ? 1 : 0) : state.currentSeat;
    this.rollingUntil = this.time.now + 420;
    cue('roll');
    const dice = this.dice[seat]!;
    this.tweens.add({ targets: dice, angle: { from: -12, to: 0 }, duration: 380, ease: 'Back.easeOut' });
    let frames = 0;
    const tumble = this.time.addEvent({
      delay: 60,
      repeat: 5,
      callback: () => {
        frames++;
        this.drawDiceFor(seat, [frames % 2, (frames + 1) % 2, frames % 3 === 0 ? 1 : 0, 1 - (frames % 2)]);
        if (frames >= 6) {
          tumble.remove();
          this.drawDice(state.dice);
          if (state.passed) this.shout(this.diceXY(seat), state.value === 0 ? 'Nought!' : 'No move', COLORS.soft);
          this.refresh();
        }
      },
    });
  }

  private drawDice(dice: readonly number[] | null): void {
    const seat: Seat = this.state.passed ? (this.state.currentSeat === 0 ? 1 : 0) : this.state.currentSeat;
    for (const s of [0, 1] as const) this.drawDiceFor(s, s === seat && dice ? dice : null);
  }

  /** Four little pyramids: a white tip counts one. */
  private drawDiceFor(seat: Seat, dice: readonly number[] | null): void {
    const g = this.dice[seat]!.clear();
    const { x, y } = this.diceXY(seat);
    g.setPosition(x, y);
    [-1, 1].forEach((dy, row) =>
      [-1, 1].forEach((dx, col) => {
        const i = row * 2 + col;
        const cx = dx * 20;
        const cy = dy * 22 - 6;
        g.fillStyle(toHex(DARK.grape), 1);
        g.fillTriangle(cx - 17, cy + 15, cx + 17, cy + 15, cx, cy - 15);
        g.fillStyle(dice ? toHex(COLORS.grape) : 0xc9c2e0, 1);
        g.fillTriangle(cx - 15, cy + 12, cx + 15, cy + 12, cx, cy - 13);
        if (dice?.[i]) {
          g.fillStyle(0xffffff, 1);
          g.fillCircle(cx, cy - 4, 5);
        }
      }),
    );
  }

  private hop(seat: Seat, from: number, to: number, captured: boolean, again: boolean): void {
    const where = this.where[seat]!;
    const index = where.indexOf(from);
    if (index < 0) return this.layout(false);
    where[index] = to;
    const piece = this.pieces[seat]![index]!.setDepth(7);
    const steps: { x: number; y: number }[] = [];
    for (let s = from + 1; s <= to; s++) steps.push(s === UR_OFF ? this.stackXY(seat, UR_OFF, where.filter((w) => w === UR_OFF).length - 1) : pathXY(seat, s));
    this.moving++;
    const next = (i: number): void => {
      if (i >= steps.length) {
        piece.setDepth(5);
        this.moving--;
        this.tweens.add({ targets: piece, scaleY: { from: 0.8, to: to === UR_OFF ? 0.7 : 1 }, scaleX: { from: 1.15, to: to === UR_OFF ? 0.7 : 1 }, duration: 180, ease: 'Back.easeOut' });
        cue(captured ? 'capture' : 'place');
        if (captured) this.knock(seat === 0 ? 1 : 0, to);
        if (again) this.shout(pathXY(seat, to), 'Again!', COLORS.bubblegum);
        if (to === UR_OFF) this.shout(steps[steps.length - 1]!, 'Home!', COLORS.mint);
        this.layout(false);
        this.refresh();
        return;
      }
      const p = steps[i]!;
      this.tweens.add({ targets: piece, x: p.x, y: p.y, scale: 1.12, duration: 120, ease: 'Sine.easeInOut', onComplete: () => next(i + 1) });
    };
    next(0);
  }

  /** A knocked-off piece flies back to the start in an arc. */
  private knock(seat: Seat, square: number): void {
    const where = this.where[seat]!;
    const index = where.indexOf(square);
    if (index < 0) return;
    where[index] = 0;
    const piece = this.pieces[seat]![index]!;
    const home = this.stackXY(seat, 0, where.filter((w) => w === 0).length - 1);
    const sx = piece.x;
    const sy = piece.y;
    this.moving++;
    this.shout({ x: sx, y: sy }, 'Knocked off!', COLORS.tomato);
    this.cameras.main.shake(120, 0.004);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 520,
      ease: 'Quad.easeInOut',
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;
        piece.setPosition(sx + (home.x - sx) * t, sy + (home.y - sy) * t - Math.sin(t * Math.PI) * 120);
        piece.setAngle(t * 360);
      },
      onComplete: () => {
        piece.setAngle(0);
        this.moving--;
        this.layout(false);
      },
    });
  }

  private shout(at: { x: number; y: number }, text: string, color: string): void {
    const t = sharpText(this, at.x, at.y - 40, text, 28, color).setFontStyle('bold').setStroke('#FFFFFF', 7).setDepth(20);
    t.setScale(0.6);
    this.tweens.add({ targets: t, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, y: at.y - 80, alpha: 0, delay: 600, duration: 350, onComplete: () => t.destroy() });
  }

  private movable(): number[] {
    const state = this.state;
    return state.legalMoves(state.currentSeat).filter((m) => m !== 'roll').map((m) => Number(m.slice(1)));
  }

  /** Glow the pieces that can go and ghost the squares they would land on. */
  private refresh(): void {
    const state = this.state;
    const g = this.hints.clear();
    const mine = this.session.isHumanTurn() && !this.busy();
    for (const seat of [0, 1] as const) {
      const turn = state.currentSeat === seat && !state.result;
      const label = this.rollLabels[seat]!;
      label.setVisible(isPerson(this.session.seats, seat) || !this.session.seats.some((s) => s.kind === 'human'));
      label.setText(turn && state.phase === 'roll' ? 'Roll' : turn ? `${state.value}` : '');
      label.setColor(turn && state.phase === 'roll' ? COLORS.grape : COLORS.ink);
    }
    if (!mine || state.phase !== 'move') return;
    const seat = state.currentSeat;
    for (const from of this.movable()) {
      const src = from === 0 ? this.stackXY(seat, 0, 0) : pathXY(seat, from);
      const to = from + state.value;
      const dst = to === UR_OFF ? this.stackXY(seat, UR_OFF, state.pieces[seat].filter((p) => p === UR_OFF).length) : pathXY(seat, to);
      g.lineStyle(5, toHex(COLORS.grape), 0.9);
      g.strokeCircle(src.x, src.y, PIECE_R + 6);
      g.fillStyle(SEAT_HEX[seat]!, 0.35);
      g.fillCircle(dst.x, dst.y, PIECE_R - 4);
      if (UR_ROSETTES.has(to)) {
        g.lineStyle(3, toHex(COLORS.bubblegum), 1);
        g.strokeCircle(dst.x, dst.y, PIECE_R);
      }
    }
  }

  private press(x: number, y: number): void {
    this.ring.setVisible(false);
    const state = this.state;
    if (!this.session.isHumanTurn() || this.busy()) return;
    if (state.phase === 'roll') {
      this.session.play('roll');
      return;
    }
    const seat = state.currentSeat;
    // A tap on a piece that can go, or on the square it would land on.
    for (const from of this.movable()) {
      const src = from === 0 ? this.stackXY(seat, 0, 0) : pathXY(seat, from);
      const to = from + state.value;
      const dst = to === UR_OFF ? this.stackXY(seat, UR_OFF, 0) : pathXY(seat, to);
      const nearWaiting = from === 0 && Math.abs(x - src.x) < 40 && y > Y0 + 4 * CELL;
      if (Math.hypot(x - src.x, y - src.y) < PIECE_R + 14 || nearWaiting || Math.hypot(x - dst.x, y - dst.y) < PIECE_R + 10) {
        this.session.play(`m${from}`);
        return;
      }
    }
  }

  private key(key: string): boolean {
    const state = this.state;
    if (!this.session.isHumanTurn() || this.busy()) return false;
    if (state.phase === 'roll') {
      if (key !== ' ' && key !== 'Enter') return false;
      this.session.play('roll');
      return true;
    }
    const froms = this.movable();
    const n = Number(key);
    if (Number.isInteger(n) && n >= 1 && n <= froms.length) {
      this.session.play(`m${froms[n - 1]}`);
      return true;
    }
    if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown') {
      this.focus = (this.focus + (key === 'ArrowRight' || key === 'ArrowDown' ? 1 : froms.length - 1)) % froms.length;
      const from = froms[this.focus]!;
      const p = from === 0 ? this.stackXY(state.currentSeat, 0, 0) : pathXY(state.currentSeat, from);
      moveRing(this, this.ring, p.x, p.y);
      return true;
    }
    if (key === ' ' || key === 'Enter') {
      this.session.play(`m${froms[this.focus % froms.length]}`);
      this.ring.setVisible(false);
      return true;
    }
    return false;
  }
}

export function urStatus(state: UrState, names: readonly string[]): string | undefined {
  if (state.result) return undefined;
  const name = names[state.currentSeat] ?? UR_NAMES[state.currentSeat];
  const home = state.pieces[state.currentSeat].filter((p) => p === UR_OFF).length;
  const now = state.phase === 'roll' ? `${name} to throw` : `${name} threw ${state.value}`;
  return `${now}. ${home} of 7 home`;
}
