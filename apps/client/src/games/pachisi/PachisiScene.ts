import {
  isCastle,
  PACHISI_HOME,
  PACHISI_PIECES,
  PACHISI_WAITING,
  pachisiCell,
  pachisiGrid,
  type PachisiColumn,
  type PachisiMove,
  type PachisiState,
  type Seat,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { focusRing, moveRing, onKeys } from '../keys';

const W = 640;
const H = 640;
export const PACHISI_SIZE = { width: W, height: H };
/** Partners share a feel: the cool pair against the warm pair. */
const SEAT_COLOR = [COLORS.sky, COLORS.tomato, COLORS.grape, COLORS.peach];
const SEAT_LIP = [DARK.sky, DARK.tomato, DARK.grape, DARK.peach];
export const pachisiColors = (players: number): string[] => (players === 2 ? [COLORS.sky, COLORS.tomato] : SEAT_COLOR.slice(0, players));
export const pachisiNames = (players: number): string[] => (players === 2 ? ['Blue', 'Red'] : ['Blue', 'Red', 'Purple', 'Orange'].slice(0, players));

const CELL = 32;
const BX = (W - 19 * CELL) / 2;
const BY = (H - 19 * CELL) / 2;
const PIECE_R = 12;

const gridXY = (gx: number, gy: number) => ({ x: BX + gx * CELL + CELL / 2, y: BY + gy * CELL + CELL / 2 });

/** The empty corner beside each arm, where its waiting pieces sit and its shells are thrown. */
function cornerXY(arm: number): { x: number; y: number } {
  const corners = [
    { x: 4, y: 14.5 },
    { x: 14.5, y: 14 },
    { x: 14, y: 3.5 },
    { x: 3.5, y: 4 },
  ];
  const c = corners[arm]!;
  return gridXY(c.x, c.y);
}

/**
 * Pachisi. The rules throw the cowries and move the pieces; the scene draws the cross, throws the
 * shells in the player's own corner, hops a piece square by square round the board, and arcs a hit
 * piece back to its corner. Bots wait until the hop has landed.
 */
export class PachisiScene extends Scene {
  private pieces: GameObjects.Container[][] = [];
  private shells: GameObjects.Graphics[] = [];
  private labels: GameObjects.Text[] = [];
  private hints!: GameObjects.Graphics;
  private ring!: GameObjects.Graphics;
  private focus = 0;
  private moving = 0;
  private rollingUntil = 0;
  private shownThrows = 0;
  private hidden = new Set<string>();

  constructor(private readonly session: Session<PachisiMove>) {
    super('pachisi');
  }

  private get state(): PachisiState {
    return this.session.state as PachisiState;
  }

  private colorOf(seat: Seat): string {
    return pachisiColors(this.state.players)[seat]!;
  }

  private lipOf(seat: Seat): string {
    return this.state.players === 2 ? [DARK.sky, DARK.tomato][seat]! : SEAT_LIP[seat]!;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.drawBoard();
    this.hints = this.add.graphics().setDepth(3);
    const state = this.state;
    for (let seat = 0; seat < state.players; seat++) {
      this.pieces.push(Array.from({ length: PACHISI_PIECES }, () => this.makePiece(seat)));
      this.shells.push(this.add.graphics().setDepth(4));
      const c = cornerXY(state.arm(seat));
      this.labels.push(sharpText(this, c.x, c.y + 96, '', 22, COLORS.ink).setFontStyle('bold').setDepth(4));
    }
    this.ring = focusRing(this, PIECE_R * 2 + 14, PIECE_R * 2 + 14, PIECE_R + 7);
    this.layout();
    this.drawShells();
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

  /** A hop, a hit or a throw is still showing. See `apps/client/src/games/busy.ts`. */
  busy(): boolean {
    return this.moving > 0 || this.time.now < this.rollingUntil;
  }

  private drawBoard(): void {
    const g = this.add.graphics().setDepth(0);
    const cells: { x: number; y: number; castle: boolean; arm: number; col: PachisiColumn }[] = [];
    for (let arm = 0; arm < 4; arm++) {
      for (const col of ['prev', 'mid', 'next'] as const) {
        for (let row = 0; row < 8; row++) {
          const { x, y } = pachisiGrid({ arm, col, row });
          cells.push({ ...gridXY(x, y), castle: isCastle({ arm, col, row }), arm, col });
        }
      }
    }
    for (const c of cells) {
      g.fillStyle(0xd8d0ee, 1);
      g.fillRoundedRect(c.x - CELL / 2 + 1.5, c.y - CELL / 2 + 3.5, CELL - 3, CELL - 3, 7);
      g.fillStyle(c.castle ? toHex(COLORS.sunny) : c.col === 'mid' ? 0xf4f1fb : 0xffffff, 1);
      g.fillRoundedRect(c.x - CELL / 2 + 1.5, c.y - CELL / 2 + 1.5, CELL - 3, CELL - 3, 7);
      if (c.castle) {
        // The castle's cross, as it is sewn on the cloth.
        g.lineStyle(3, toHex(DARK.sunny), 1);
        g.lineBetween(c.x - 8, c.y - 8, c.x + 8, c.y + 8);
        g.lineBetween(c.x - 8, c.y + 8, c.x + 8, c.y - 8);
      }
    }
    // The Charkoni, where every piece starts and ends.
    const mid = gridXY(9, 9);
    g.fillStyle(toHex(DARK.grape), 1);
    g.fillRoundedRect(mid.x - CELL * 1.5 + 2, mid.y - CELL * 1.5 + 5, CELL * 3 - 4, CELL * 3 - 4, 16);
    g.fillStyle(toHex(COLORS.grape), 1);
    g.fillRoundedRect(mid.x - CELL * 1.5 + 2, mid.y - CELL * 1.5 + 2, CELL * 3 - 4, CELL * 3 - 4, 16);
    // Each seat's middle column gets a light wash of its color, so you can see your own road home.
    for (let seat = 0; seat < this.state.players; seat++) {
      const arm = this.state.arm(seat);
      for (let row = 0; row < 7; row++) {
        const { x, y } = pachisiGrid({ arm, col: 'mid', row });
        const p = gridXY(x, y);
        g.fillStyle(toHex(this.colorOf(seat)), 0.22);
        g.fillRoundedRect(p.x - CELL / 2 + 1.5, p.y - CELL / 2 + 1.5, CELL - 3, CELL - 3, 7);
      }
    }
  }

  private makePiece(seat: Seat): GameObjects.Container {
    const g = this.add.graphics();
    g.fillStyle(toHex(this.lipOf(seat)), 1);
    g.fillCircle(0, 3, PIECE_R);
    g.fillStyle(toHex(this.colorOf(seat)), 1);
    g.fillCircle(0, 0, PIECE_R);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(-3, -4, 3.5);
    return this.add.container(0, 0, [g]).setDepth(5);
  }

  /** Where a piece is drawn: its square (nudged when it shares one), its corner, or home in the middle. */
  private spot(seat: Seat, piece: number, positions = this.state.pieces): { x: number; y: number } {
    const state = this.state;
    const at = positions[seat]![piece]!;
    const arm = state.arm(seat);
    if (at === PACHISI_WAITING) {
      const c = cornerXY(arm);
      return { x: c.x + ((piece % 2) - 0.5) * 38, y: c.y - 40 + Math.floor(piece / 2) * 36 };
    }
    if (at >= PACHISI_HOME) {
      // Home: back in the Charkoni, on the side of your own arm.
      const g = pachisiGrid({ arm, col: 'mid', row: 0 });
      const p = gridXY(9 + (g.x - 9) * 0.55, 9 + (g.y - 9) * 0.55);
      return { x: p.x + (piece - 1.5) * 9, y: p.y + (piece % 2) * 4 };
    }
    const cell = pachisiCell(arm, at);
    const g = pachisiGrid(cell);
    const p = gridXY(g.x, g.y);
    // Share a square and you sit a little apart, so every piece can still be seen and tapped.
    const mates = state.occupants(cell);
    const index = mates.findIndex(([s, q]) => s === seat && q === piece);
    if (mates.length <= 1 || index < 0) return p;
    const a = (index / mates.length) * Math.PI * 2;
    return { x: p.x + Math.cos(a) * 7, y: p.y + Math.sin(a) * 7 };
  }

  private layout(): void {
    this.pieces.forEach((list, seat) =>
      list.forEach((piece, i) => {
        if (this.hidden.has(`${seat}.${i}`)) return;
        const p = this.spot(seat, i);
        const home = this.state.pieces[seat]![i]! >= PACHISI_HOME;
        piece.setPosition(p.x, p.y).setScale(home ? 0.7 : 1);
      }),
    );
  }

  private changed(): void {
    const state = this.state;
    if (state.throws !== this.shownThrows) {
      this.shownThrows = state.throws;
      this.roll(state);
    }
    const last = state.last;
    if (last && !this.hidden.has(`${last.seat}.${last.piece}`) && this.lastShown !== last) {
      this.lastShown = last;
      this.hop(state);
    }
    this.refresh();
  }

  private lastShown: PachisiState['last'] = null;

  /** Who threw the shells showing: the player to move, unless a wasted throw passed the turn on. */
  private thrower(state: PachisiState): Seat {
    if (!state.passed) return state.currentSeat;
    const grace = [6, 10, 25].includes(state.value);
    if (grace) return state.currentSeat;
    // The turn went on to the next player still playing; the thrower is the one before them.
    for (let n = 1; n <= state.players; n++) {
      const s = (state.currentSeat - n + state.players) % state.players;
      if (state.pieces[s]!.some((p) => p !== PACHISI_HOME)) return s;
    }
    return state.currentSeat;
  }

  private roll(state: PachisiState): void {
    const seat = this.thrower(state);
    this.rollingUntil = this.time.now + 420;
    cue('roll');
    let frames = 0;
    const tumble = this.time.addEvent({
      delay: 60,
      repeat: 5,
      callback: () => {
        frames++;
        this.drawShellsFor(seat, Array.from({ length: 6 }, (_, i) => (frames + i) % 2));
        if (frames >= 6) {
          tumble.remove();
          this.drawShells();
          const c = cornerXY(state.arm(seat));
          if (state.passed) this.shout(c, 'No move', COLORS.soft);
          else if ([6, 10, 25].includes(state.value)) this.shout(c, `${state.value}! Grace`, COLORS.bubblegum);
          this.refresh();
        }
      },
    });
  }

  private drawShells(): void {
    const state = this.state;
    const seat = this.thrower(state);
    for (let s = 0; s < state.players; s++) this.drawShellsFor(s, s === seat ? state.shells : null);
  }

  /** Six cowries: mouth up is white with a slit, mouth down is the humped back. */
  private drawShellsFor(seat: Seat, shells: readonly number[] | null): void {
    const g = this.shells[seat]!.clear();
    const c = cornerXY(this.state.arm(seat));
    for (let i = 0; i < 6; i++) {
      const x = c.x - 55 + i * 22;
      const y = c.y + 60;
      const up = shells?.[i] === 1;
      g.fillStyle(toHex(DARK.sunny), 1);
      g.fillEllipse(x, y + 2, 16, 24);
      g.fillStyle(shells ? (up ? 0xffffff : toHex(COLORS.sunny)) : 0xe6e0f4, 1);
      g.fillEllipse(x, y, 16, 24);
      if (up) {
        g.lineStyle(2.5, toHex(COLORS.ink), 1);
        g.lineBetween(x, y - 7, x, y + 7);
      }
    }
  }

  private hop(state: PachisiState): void {
    const last = state.last!;
    const piece = this.pieces[last.seat]![last.piece]!;
    const arm = state.arm(last.seat);
    const steps: { x: number; y: number }[] = [];
    const first = Math.max(0, last.from + 1);
    if (last.from === PACHISI_WAITING) steps.push(this.spot(last.seat, last.piece));
    else {
      for (let i = first; i <= Math.min(last.to, PACHISI_HOME - 1); i++) {
        const g = pachisiGrid(pachisiCell(arm, i));
        steps.push(gridXY(g.x, g.y));
      }
      if (last.to >= PACHISI_HOME || steps.length === 0) steps.push(this.spot(last.seat, last.piece));
      else steps[steps.length - 1] = this.spot(last.seat, last.piece);
    }
    // Long throws hop faster, so a 25 does not hold the table up.
    const each = Math.max(28, Math.min(90, 700 / steps.length));
    this.moving++;
    piece.setDepth(7);
    const next = (i: number): void => {
      if (i >= steps.length) {
        piece.setDepth(5);
        this.tweens.add({ targets: piece, scaleX: { from: 1.25, to: last.to >= PACHISI_HOME ? 0.7 : 1 }, scaleY: { from: 0.8, to: last.to >= PACHISI_HOME ? 0.7 : 1 }, duration: 160, ease: 'Back.easeOut' });
        cue(last.captured.length ? 'capture' : 'place');
        for (const [s, p] of last.captured) this.sendBack(s, p);
        if (last.captured.length) this.shout(this.spot(last.seat, last.piece), 'Hit!', COLORS.tomato);
        if (last.to >= PACHISI_HOME) this.shout(gridXY(9, 9), 'Home!', COLORS.mint);
        this.moving--;
        this.layout();
        this.refresh();
        return;
      }
      const p = steps[i]!;
      this.tweens.add({ targets: piece, x: p.x, y: p.y, scale: 1.15, duration: each, ease: 'Sine.easeInOut', onComplete: () => next(i + 1) });
    };
    next(0);
  }

  /** A hit piece flies back to its corner in an arc. */
  private sendBack(seat: Seat, index: number): void {
    const piece = this.pieces[seat]![index]!;
    const key = `${seat}.${index}`;
    const home = this.spot(seat, index);
    const sx = piece.x;
    const sy = piece.y;
    this.hidden.add(key);
    this.moving++;
    this.cameras.main.shake(110, 0.004);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 560,
      ease: 'Quad.easeInOut',
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;
        piece.setPosition(sx + (home.x - sx) * t, sy + (home.y - sy) * t - Math.sin(t * Math.PI) * 110).setAngle(t * 360);
      },
      onComplete: () => {
        piece.setAngle(0);
        this.hidden.delete(key);
        this.moving--;
        this.layout();
        this.refresh();
      },
    });
  }

  private shout(at: { x: number; y: number }, text: string, color: string): void {
    const t = sharpText(this, at.x, at.y - 30, text, 24, color).setFontStyle('bold').setStroke('#FFFFFF', 6).setDepth(20).setScale(0.6);
    this.tweens.add({ targets: t, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, y: at.y - 64, alpha: 0, delay: 650, duration: 350, onComplete: () => t.destroy() });
  }

  /** The moves on offer, each with the piece it moves and where that piece would land. */
  private options(): { move: PachisiMove; from: { x: number; y: number }; to: { x: number; y: number } }[] {
    const state = this.state;
    const seat = state.currentSeat;
    const arm = state.arm(seat);
    return state.legalMoves(seat).filter((m) => m !== 'roll').map((move) => {
      if (move === 'e') {
        const piece = state.pieces[seat]!.indexOf(PACHISI_WAITING);
        const g = pachisiGrid(pachisiCell(arm, 0));
        return { move, from: this.spot(seat, piece), to: gridXY(g.x, g.y) };
      }
      const piece = Number(move.slice(1));
      const to = state.target(seat, piece, state.value)!;
      const g = to >= PACHISI_HOME ? { x: 9, y: 9 } : pachisiGrid(pachisiCell(arm, to));
      return { move, from: this.spot(seat, piece), to: gridXY(g.x, g.y) };
    });
  }

  private refresh(): void {
    const state = this.state;
    const g = this.hints.clear();
    for (let seat = 0; seat < state.players; seat++) {
      const turn = state.currentSeat === seat && !state.result;
      this.labels[seat]!.setText(turn && state.phase === 'roll' ? 'Throw' : turn ? `${state.value}` : '').setColor(turn && state.phase === 'roll' ? COLORS.grape : COLORS.ink);
    }
    if (!this.session.isHumanTurn() || this.busy() || state.phase !== 'move') return;
    for (const option of this.options()) {
      g.lineStyle(4, toHex(COLORS.grape), 0.95);
      g.strokeCircle(option.from.x, option.from.y, PIECE_R + 5);
      g.fillStyle(toHex(this.colorOf(state.currentSeat)), 0.4);
      g.fillCircle(option.to.x, option.to.y, PIECE_R - 2);
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
    // The nearest piece that can go, or ghost where one would land, within a finger's reach.
    let best: PachisiMove | null = null;
    let near = 30;
    for (const option of this.options()) {
      for (const p of [option.from, option.to]) {
        const d = Math.hypot(x - p.x, y - p.y);
        if (d < near) {
          near = d;
          best = option.move;
        }
      }
    }
    if (best) this.session.play(best);
  }

  private key(key: string): boolean {
    const state = this.state;
    if (!this.session.isHumanTurn() || this.busy()) return false;
    if (state.phase === 'roll') {
      if (key !== ' ' && key !== 'Enter') return false;
      this.session.play('roll');
      return true;
    }
    const options = this.options();
    const n = Number(key);
    if (Number.isInteger(n) && n >= 1 && n <= options.length) {
      this.session.play(options[n - 1]!.move);
      return true;
    }
    if (key.startsWith('Arrow')) {
      this.focus = (this.focus + (key === 'ArrowRight' || key === 'ArrowDown' ? 1 : options.length - 1)) % options.length;
      const p = options[this.focus]!.from;
      moveRing(this, this.ring, p.x, p.y);
      return true;
    }
    if (key === ' ' || key === 'Enter') {
      this.session.play(options[this.focus % options.length]!.move);
      this.ring.setVisible(false);
      return true;
    }
    return false;
  }
}

export function pachisiStatus(state: PachisiState, names: readonly string[]): string | undefined {
  if (state.result) return undefined;
  const seat = state.currentSeat;
  const name = names[seat] ?? pachisiNames(state.players)[seat];
  const home = state.pieces[seat]!.filter((p) => p >= PACHISI_HOME).length;
  const now = state.phase === 'roll' ? `${name} to throw` : `${name} threw ${state.value}`;
  return `${now}. ${home} of ${PACHISI_PIECES} home`;
}
