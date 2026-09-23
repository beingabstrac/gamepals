import { BEAUTY, REBIRTH, SENET_OFF, SENET_PIECES, WATER, type Seat, type SenetMove, type SenetState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { facing, isPerson } from '../duel';
import { focusRing, moveRing, onKeys } from '../keys';

const W = 600;
const H = 960;
export const SENET_SIZE = { width: W, height: H };
export const SENET_COLORS = [COLORS.sky, COLORS.tomato];
export const SENET_NAMES = ['Blue', 'Red'];

const CELL = 84;
const X0 = (W - 3 * CELL) / 2;
const Y0 = 70;
const PIECE_R = 27;
const SEAT_HEX = SENET_COLORS.map(toHex);
const SEAT_DARK = [toHex(DARK.sky), toHex(DARK.tomato)];

/** Square 1 to 30 on screen: the three rows of the board stood on end, snaking down, up and down. */
function squareXY(square: number): { x: number; y: number } {
  const col = Math.floor((square - 1) / 10);
  const step = (square - 1) % 10;
  const row = col === 1 ? 9 - step : step;
  return { x: X0 + col * CELL + CELL / 2, y: Y0 + row * CELL + CELL / 2 };
}

/**
 * Senet. The rules throw the sticks and move the pieces; the scene hops each piece square by square
 * along the snake, slides a swapped piece back past it, washes a piece from the water back to
 * Rebirth, and holds the bots until everything has landed.
 */
export class SenetScene extends Scene {
  private pieces: GameObjects.Container[][] = [[], []];
  private where: number[][] = [[], []];
  private sticks: GameObjects.Graphics[] = [];
  private labels: GameObjects.Text[] = [];
  private hints!: GameObjects.Graphics;
  private ring!: GameObjects.Graphics;
  private focus = 0;
  private moving = 0;
  private rollingUntil = 0;
  private shownThrows = 0;

  constructor(private readonly session: Session<SenetMove>) {
    super('senet');
  }

  private get state(): SenetState {
    return this.session.state as SenetState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.drawBoard();
    this.hints = this.add.graphics().setDepth(3);
    for (const seat of [0, 1] as const) {
      this.state.pieces[seat].forEach((square) => {
        this.pieces[seat]!.push(this.makePiece(seat));
        this.where[seat]!.push(square);
      });
      this.sticks.push(this.add.graphics().setDepth(4));
      const { x, y } = this.sticksXY(seat);
      const label = sharpText(this, x, y + 92, '', 24, COLORS.ink).setFontStyle('bold').setDepth(4);
      label.setAngle(facing(this.session.seats, seat));
      this.labels.push(label);
    }
    this.ring = focusRing(this, PIECE_R * 2 + 12, PIECE_R * 2 + 12, PIECE_R + 6);
    this.layout();
    this.drawSticks(this.state.sticks);
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

  /** Each player's sticks sit on their own side, near the top. */
  private sticksXY(seat: Seat): { x: number; y: number } {
    return { x: seat === 0 ? W - X0 / 2 : X0 / 2, y: Y0 + 90 };
  }

  private offXY(seat: Seat, index: number): { x: number; y: number } {
    return { x: seat === 0 ? W - X0 / 2 : X0 / 2, y: H - 70 - index * 46 };
  }

  private drawBoard(): void {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0xe6e0f4, 1);
    g.fillRoundedRect(X0 - 14, Y0 - 14 + 8, 3 * CELL + 28, 10 * CELL + 28, 28);
    g.fillStyle(0xf4f1fb, 1);
    g.fillRoundedRect(X0 - 14, Y0 - 14, 3 * CELL + 28, 10 * CELL + 28, 28);
    for (let square = 1; square <= 30; square++) {
      const { x, y } = squareXY(square);
      const special = square === REBIRTH || square >= BEAUTY;
      g.fillStyle(special ? toHex(DARK.sunny) : 0xd8d0ee, 1);
      g.fillRoundedRect(x - CELL / 2 + 4, y - CELL / 2 + 8, CELL - 8, CELL - 8, 16);
      g.fillStyle(special ? toHex(COLORS.sunny) : 0xffffff, 1);
      g.fillRoundedRect(x - CELL / 2 + 4, y - CELL / 2 + 4, CELL - 8, CELL - 8, 16);
      this.mark(g, square, x, y);
    }
    // The way round: a dotted line down, up and down again.
    g.fillStyle(toHex(COLORS.grape), 0.25);
    for (let square = 1; square < 30; square++) {
      const a = squareXY(square);
      const b = squareXY(square + 1);
      g.fillCircle((a.x + b.x) / 2, (a.y + b.y) / 2, 4);
    }
  }

  /** The houses at the end, each with its own sign, drawn simply. */
  private mark(g: GameObjects.Graphics, square: number, x: number, y: number): void {
    const ink = toHex(COLORS.ink);
    if (square === REBIRTH) {
      g.lineStyle(5, ink, 1);
      g.strokeEllipse(x, y - 14, 18, 22);
      g.lineBetween(x, y - 3, x, y + 24);
      g.lineBetween(x - 13, y + 4, x + 13, y + 4);
    } else if (square === BEAUTY) {
      g.fillStyle(toHex(COLORS.bubblegum), 1);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.fillCircle(x + Math.cos(a) * 17, y + Math.sin(a) * 17, 9);
      }
      g.fillStyle(0xffffff, 1);
      g.fillCircle(x, y, 10);
    } else if (square === WATER) {
      g.lineStyle(5, toHex(COLORS.sky), 1);
      for (const dy of [-12, 0, 12]) {
        g.beginPath();
        g.moveTo(x - 22, y + dy);
        for (let i = 1; i <= 8; i++) g.lineTo(x - 22 + i * 5.5, y + dy + (i % 2 ? -5 : 5));
        g.strokePath();
      }
    } else if (square >= 28) {
      // Three, two and one strokes: the throw that bears a piece off from here.
      const count = 31 - square;
      g.fillStyle(ink, 1);
      for (let i = 0; i < count; i++) g.fillRoundedRect(x - (count - 1) * 9 + i * 18 - 3.5, y - 16, 7, 32, 3.5);
    }
  }

  private makePiece(seat: Seat): GameObjects.Container {
    const g = this.add.graphics();
    g.fillStyle(SEAT_DARK[seat]!, 1);
    // Blue plays the spools, Red the cones, as on the old boards: different shapes as well as colors.
    if (seat === 0) {
      g.fillCircle(0, 4, PIECE_R);
      g.fillStyle(SEAT_HEX[seat]!, 1);
      g.fillCircle(0, 0, PIECE_R);
      g.fillStyle(0xffffff, 0.85);
      g.fillCircle(0, 0, 8);
    } else {
      g.fillTriangle(-PIECE_R, PIECE_R * 0.8 + 4, PIECE_R, PIECE_R * 0.8 + 4, 0, -PIECE_R + 4);
      g.fillStyle(SEAT_HEX[seat]!, 1);
      g.fillTriangle(-PIECE_R, PIECE_R * 0.8, PIECE_R, PIECE_R * 0.8, 0, -PIECE_R);
      g.fillStyle(0xffffff, 0.85);
      g.fillCircle(0, 4, 6);
    }
    return this.add.container(0, 0, [g]).setDepth(5);
  }

  /** Every piece where the state has it. */
  private layout(): void {
    for (const seat of [0, 1] as const) {
      const target = this.state.pieces[seat].slice();
      const where = this.where[seat]!;
      const left = target.slice();
      const free: number[] = [];
      where.forEach((square, i) => {
        const at = left.indexOf(square);
        if (at >= 0) left.splice(at, 1);
        else free.push(i);
      });
      free.forEach((i, k) => (where[i] = left[k]!));
      let off = 0;
      where.forEach((square, i) => {
        const piece = this.pieces[seat]![i]!;
        const pos = square === SENET_OFF ? this.offXY(seat, off++) : squareXY(square);
        piece.setPosition(pos.x, pos.y).setScale(square === SENET_OFF ? 0.75 : 1);
      });
    }
  }

  private changed(): void {
    const state = this.state;
    if (state.throws !== this.shownThrows) {
      this.shownThrows = state.throws;
      this.roll(state);
    }
    const last = state.last;
    if (last && this.where[last.seat]!.includes(last.from) && !this.movedAlready(last.seat, last.from)) this.hop(state);
    this.refresh();
  }

  /** True when the scene already shows the move the state last made. */
  private movedAlready(seat: Seat, from: number): boolean {
    return this.where[seat]!.filter((s) => s === from).length <= this.state.pieces[seat].filter((s) => s === from).length;
  }

  private roll(state: SenetState): void {
    const seat = this.thrower(state);
    this.rollingUntil = this.time.now + 420;
    cue('roll');
    let frames = 0;
    const tumble = this.time.addEvent({
      delay: 60,
      repeat: 5,
      callback: () => {
        frames++;
        this.drawSticksFor(seat, [frames % 2, (frames + 1) % 2, frames % 3 === 0 ? 1 : 0, (frames >> 1) % 2]);
        if (frames >= 6) {
          tumble.remove();
          this.drawSticks(state.sticks);
          if (state.passed) this.shout(this.sticksXY(seat), 'No move', COLORS.soft);
          this.refresh();
        }
      },
    });
  }

  /** Who threw the last sticks: the player to move, unless a lost throw handed the turn over. */
  private thrower(state: SenetState): Seat {
    if (!state.passed) return state.currentSeat;
    const value = state.value;
    const kept = value === 1 || value === 4 || value === 5;
    return kept ? state.currentSeat : state.currentSeat === 0 ? 1 : 0;
  }

  private drawSticks(sticks: readonly number[] | null): void {
    const seat = this.thrower(this.state);
    for (const s of [0, 1] as const) this.drawSticksFor(s, s === seat && sticks ? sticks : null);
  }

  /** Four flat sticks, white on one side. */
  private drawSticksFor(seat: Seat, sticks: readonly number[] | null): void {
    const g = this.sticks[seat]!.clear();
    const { x, y } = this.sticksXY(seat);
    for (let i = 0; i < 4; i++) {
      const sx = x - 30 + i * 20;
      const white = sticks?.[i] === 1;
      g.fillStyle(toHex(DARK.peach), 1);
      g.fillRoundedRect(sx - 7, y - 58 + 4, 14, 116, 7);
      g.fillStyle(sticks ? (white ? 0xffffff : toHex(COLORS.peach)) : 0xd8d0ee, 1);
      g.fillRoundedRect(sx - 7, y - 58, 14, 116, 7);
    }
  }

  private hop(state: SenetState): void {
    const last = state.last!;
    const where = this.where[last.seat]!;
    const index = where.indexOf(last.from);
    if (index < 0) return this.layout();
    where[index] = last.landed;
    const piece = this.pieces[last.seat]![index]!.setDepth(7);
    const steps: { x: number; y: number }[] = [];
    const dir = last.backward ? -1 : 1;
    const end = last.to === SENET_OFF ? 30 : last.to;
    for (let s = last.from + dir; dir > 0 ? s <= end : s >= end; s += dir) steps.push(squareXY(s));
    if (last.to === SENET_OFF) steps.push(this.offXY(last.seat, where.filter((w) => w === SENET_OFF).length - 1));
    const other: Seat = last.seat === 0 ? 1 : 0;
    this.moving++;
    const next = (i: number): void => {
      if (i >= steps.length) return this.landed(state, piece, other);
      const p = steps[i]!;
      this.tweens.add({ targets: piece, x: p.x, y: p.y, scale: 1.12, duration: 110, ease: 'Sine.easeInOut', onComplete: () => next(i + 1) });
    };
    next(0);
  }

  private landed(state: SenetState, piece: GameObjects.Container, other: Seat): void {
    const last = state.last!;
    const done = () => {
      piece.setDepth(5);
      this.moving--;
      this.layout();
      this.refresh();
    };
    this.tweens.add({ targets: piece, scaleY: { from: 0.8, to: last.to === SENET_OFF ? 0.75 : 1 }, scaleX: { from: 1.15, to: last.to === SENET_OFF ? 0.75 : 1 }, duration: 160, ease: 'Back.easeOut' });
    cue(last.swapped ? 'capture' : 'place');
    if (last.swapped) {
      // The piece that was there slides back to where the mover came from.
      const theirs = this.where[other]!;
      const at = theirs.indexOf(last.to);
      if (at >= 0) {
        theirs[at] = last.from;
        const p = squareXY(last.from);
        this.moving++;
        this.shout(squareXY(last.to), 'Swap!', COLORS.tomato);
        this.tweens.add({ targets: this.pieces[other]![at]!, x: p.x, y: p.y, duration: 360, ease: 'Back.easeInOut', onComplete: () => this.moving-- });
      }
    }
    if (last.to === SENET_OFF) this.shout(this.offXY(last.seat, 0), 'Off!', COLORS.mint);
    if (last.to === WATER) {
      // In the water: washed back to Rebirth, with a splash.
      this.shout(squareXY(WATER), 'Splash!', COLORS.sky);
      const p = squareXY(last.landed);
      this.tweens.add({ targets: piece, x: p.x, y: p.y, angle: { from: -20, to: 0 }, duration: 520, delay: 200, ease: 'Cubic.easeInOut', onComplete: done });
      return;
    }
    const again = !state.result && state.currentSeat === last.seat;
    if (again) this.shout(squareXY(last.landed === SENET_OFF ? 30 : last.landed), 'Again!', COLORS.bubblegum);
    done();
  }

  private shout(at: { x: number; y: number }, text: string, color: string): void {
    const t = sharpText(this, at.x, at.y - 36, text, 26, color).setFontStyle('bold').setStroke('#FFFFFF', 7).setDepth(20);
    t.setScale(0.6);
    this.tweens.add({ targets: t, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, y: at.y - 76, alpha: 0, delay: 600, duration: 350, onComplete: () => t.destroy() });
  }

  private movable(): number[] {
    const state = this.state;
    return state.legalMoves(state.currentSeat).filter((m) => m !== 'roll').map((m) => Number(m.slice(1)));
  }

  private destination(from: number): { x: number; y: number } {
    const state = this.state;
    const { backward } = state.options(state.currentSeat, state.value);
    const to = state.target(state.currentSeat, from, state.value, backward);
    if (to === null) return squareXY(from);
    return to === SENET_OFF ? this.offXY(state.currentSeat, state.pieces[state.currentSeat].filter((p) => p === SENET_OFF).length) : squareXY(to);
  }

  private refresh(): void {
    const state = this.state;
    const g = this.hints.clear();
    for (const seat of [0, 1] as const) {
      const turn = state.currentSeat === seat && !state.result;
      const label = this.labels[seat]!;
      label.setVisible(isPerson(this.session.seats, seat) || !this.session.seats.some((s) => s.kind === 'human'));
      label.setText(turn && state.phase === 'roll' ? 'Throw' : turn ? `${state.value}` : '');
      label.setColor(turn && state.phase === 'roll' ? COLORS.grape : COLORS.ink);
    }
    if (!this.session.isHumanTurn() || this.busy() || state.phase !== 'move') return;
    const { backward } = state.options(state.currentSeat, state.value);
    for (const from of this.movable()) {
      const src = squareXY(from);
      const dst = this.destination(from);
      g.lineStyle(5, toHex(backward ? COLORS.peach : COLORS.grape), 0.9);
      g.strokeCircle(src.x, src.y, PIECE_R + 6);
      g.fillStyle(SEAT_HEX[state.currentSeat]!, 0.35);
      g.fillCircle(dst.x, dst.y, PIECE_R - 4);
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
    for (const from of this.movable()) {
      const src = squareXY(from);
      const dst = this.destination(from);
      if (Math.hypot(x - src.x, y - src.y) < PIECE_R + 12 || Math.hypot(x - dst.x, y - dst.y) < PIECE_R + 6) {
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
    if (key.startsWith('Arrow')) {
      this.focus = (this.focus + (key === 'ArrowRight' || key === 'ArrowDown' ? 1 : froms.length - 1)) % froms.length;
      const p = squareXY(froms[this.focus]!);
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

export function senetStatus(state: SenetState, names: readonly string[]): string | undefined {
  if (state.result) return undefined;
  const name = names[state.currentSeat] ?? SENET_NAMES[state.currentSeat];
  const off = state.pieces[state.currentSeat].filter((p) => p === SENET_OFF).length;
  if (state.phase === 'roll') return `${name} to throw. ${off} of ${SENET_PIECES} off`;
  const { backward } = state.options(state.currentSeat, state.value);
  return `${name} threw ${state.value}${backward ? ', and must go back' : ''}. ${off} of ${SENET_PIECES} off`;
}
