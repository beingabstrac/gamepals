import { CHOWKA_HOME, CHOWKA_PIECES, CHOWKA_SAFE, CHOWKA_WAITING, chowkaSquare, isChamma, type ChowkaMove, type ChowkaState, type Seat } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { focusRing, moveRing, onKeys } from '../keys';

const W = 760;
const H = 900;
export const CHOWKA_SIZE = { width: W, height: H };
/** Four players, four colors: the same set Pachisi uses. */
const SEAT_COLOR = [COLORS.sky, COLORS.tomato, COLORS.grape, COLORS.peach];
const SEAT_LIP = [DARK.sky, DARK.tomato, DARK.grape, DARK.peach];
export const chowkaColors = (players: number): string[] => (players === 2 ? [COLORS.sky, COLORS.tomato] : SEAT_COLOR.slice(0, players));
export const chowkaNames = (players: number): string[] => (players === 2 ? ['Blue', 'Red'] : ['Blue', 'Red', 'Purple', 'Orange'].slice(0, players));

const CELL = 100;
const BX = (W - 5 * CELL) / 2;
const BY = (H - 5 * CELL) / 2;
const PIECE_R = 22;

const gridXY = (gx: number, gy: number) => ({ x: BX + gx * CELL + CELL / 2, y: BY + gy * CELL + CELL / 2 });

/** The strip beside each side of the board, where its waiting pieces sit and its shells are thrown. */
function cornerXY(side: number): { x: number; y: number } {
  const places = [
    { x: W / 2, y: BY + 5 * CELL + 115 },
    { x: W - 65, y: H / 2 },
    { x: W / 2, y: BY - 115 },
    { x: 65, y: H / 2 },
  ];
  return places[side]!;
}

/**
 * Chowka Bhara. The rules throw the cowries and move the pieces; the scene draws the 5 by 5 floor
 * with its crossed safe squares, throws the shells beside each player's side, hops a piece square by
 * square, and arcs a hit piece back to its strip. Bots wait until the hop has landed.
 */
export class ChowkaScene extends Scene {
  private pieces: GameObjects.Container[][] = [];
  private shells: GameObjects.Graphics[] = [];
  private labels: GameObjects.Text[] = [];
  private hints!: GameObjects.Graphics;
  private ring!: GameObjects.Graphics;
  private focus = 0;
  private moving = 0;
  /** The dice are tumbling. A flag rather than a deadline: the hints are drawn when the tumble ends, and a
   *  deadline could still be in the future then on a slow frame, which left the pieces unlit. */
  private rolling = false;
  private shownThrows = 0;
  private hidden = new Set<string>();

  constructor(private readonly session: Session<ChowkaMove>) {
    super('chowka');
  }

  private get state(): ChowkaState {
    return this.session.state as ChowkaState;
  }

  private colorOf(seat: Seat): string {
    return chowkaColors(this.state.players)[seat]!;
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
      this.pieces.push(Array.from({ length: CHOWKA_PIECES }, () => this.makePiece(seat)));
      this.shells.push(this.add.graphics().setDepth(4));
      const c = cornerXY(state.side(seat));
      const across = state.side(seat) % 2 === 0;
      this.labels.push(sharpText(this, across ? c.x + 150 : c.x, across ? c.y : c.y + 150, '', 22, COLORS.ink).setFontStyle('bold').setDepth(4));
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
    return this.moving > 0 || this.rolling;
  }

  private drawBoard(): void {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(toHex(DARK.grape), 1);
    g.fillRoundedRect(BX - 16, BY - 16 + 8, 5 * CELL + 32, 5 * CELL + 32, 30);
    g.fillStyle(toHex(COLORS.grape), 1);
    g.fillRoundedRect(BX - 16, BY - 16, 5 * CELL + 32, 5 * CELL + 32, 30);
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        const p = gridXY(x, y);
        const safe = CHOWKA_SAFE.has(y * 5 + x);
        const inner = x >= 1 && x <= 3 && y >= 1 && y <= 3;
        g.fillStyle(0xd8d0ee, 1);
        g.fillRoundedRect(p.x - CELL / 2 + 4, p.y - CELL / 2 + 8, CELL - 8, CELL - 8, 16);
        g.fillStyle(safe ? toHex(COLORS.sunny) : inner ? 0xf4f1fb : 0xffffff, 1);
        g.fillRoundedRect(p.x - CELL / 2 + 4, p.y - CELL / 2 + 4, CELL - 8, CELL - 8, 16);
        if (safe) {
          // The safe squares carry the cross drawn on the floor.
          g.lineStyle(5, toHex(DARK.sunny), 1);
          g.lineBetween(p.x - 26, p.y - 26, p.x + 26, p.y + 26);
          g.lineBetween(p.x - 26, p.y + 26, p.x + 26, p.y - 26);
        }
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

  /** Where a piece is drawn: its square (nudged when it shares one), its strip beside the board, or home in the middle. */
  private spot(seat: Seat, piece: number): { x: number; y: number } {
    const state = this.state;
    const at = state.pieces[seat]![piece]!;
    const side = state.side(seat);
    if (at === CHOWKA_WAITING) {
      const c = cornerXY(side);
      const across = side % 2 === 0;
      return across ? { x: c.x - 90 + piece * 44, y: c.y - 32 } : { x: c.x, y: c.y - 110 + piece * 44 };
    }
    const cell = chowkaSquare(side, at);
    const p = gridXY(cell.x, cell.y);
    const mates = state.on(cell.y * 5 + cell.x);
    const index = mates.findIndex(([s, q]) => s === seat && q === piece);
    if (mates.length <= 1 || index < 0) return p;
    const a = (index / mates.length) * Math.PI * 2 + Math.PI / 4;
    return { x: p.x + Math.cos(a) * 18, y: p.y + Math.sin(a) * 18 };
  }

  private layout(): void {
    this.pieces.forEach((list, seat) =>
      list.forEach((piece, i) => {
        if (this.hidden.has(`${seat}.${i}`)) return;
        const p = this.spot(seat, i);
        const home = this.state.pieces[seat]![i]! >= CHOWKA_HOME;
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

  private lastShown: ChowkaState['last'] = null;

  /** Who threw the shells showing: the player to move, unless a wasted throw passed the turn on. */
  private thrower(state: ChowkaState): Seat {
    if (!state.passed) return state.currentSeat;
    if (isChamma(state.value)) return state.currentSeat;
    // The turn went on to the next player still playing; the thrower is the one before them.
    for (let n = 1; n <= state.players; n++) {
      const s = (state.currentSeat - n + state.players) % state.players;
      if (state.pieces[s]!.some((p) => p !== CHOWKA_HOME)) return s;
    }
    return state.currentSeat;
  }

  private roll(state: ChowkaState): void {
    const seat = this.thrower(state);
    this.rolling = true;
    cue('roll');
    let frames = 0;
    const tumble = this.time.addEvent({
      delay: 60,
      repeat: 5,
      callback: () => {
        frames++;
        this.drawShellsFor(seat, Array.from({ length: 4 }, (_, i) => (frames + i) % 2));
        if (frames >= 6) {
          tumble.remove();
          this.rolling = false;
          this.drawShells();
          const c = this.shellsXY(seat);
          if (state.passed) this.shout(c, 'No move', COLORS.soft);
          else if (isChamma(state.value)) this.shout(c, state.value === 8 ? 'Ashta! 8' : 'Chamma! 4', COLORS.bubblegum);
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

  private shellsXY(seat: Seat): { x: number; y: number } {
    const c = cornerXY(this.state.side(seat));
    const across = this.state.side(seat) % 2 === 0;
    return across ? { x: c.x - 30, y: c.y + 40 } : { x: c.x, y: c.y + 110 };
  }

  /** Four cowries: mouth up is white with a slit, mouth down is the humped back. */
  private drawShellsFor(seat: Seat, shells: readonly number[] | null): void {
    const g = this.shells[seat]!.clear();
    const c = this.shellsXY(seat);
    const across = this.state.side(seat) % 2 === 0;
    for (let i = 0; i < 4; i++) {
      const x = across ? c.x - 36 + i * 24 : c.x - 12 + (i % 2) * 24;
      const y = across ? c.y : c.y - 16 + Math.floor(i / 2) * 32;
      const up = shells?.[i] === 1;
      g.fillStyle(toHex(DARK.sunny), 1);
      g.fillEllipse(x, y + 2, 18, 26);
      g.fillStyle(shells ? (up ? 0xffffff : toHex(COLORS.sunny)) : 0xe6e0f4, 1);
      g.fillEllipse(x, y, 18, 26);
      if (up) {
        g.lineStyle(2.5, toHex(COLORS.ink), 1);
        g.lineBetween(x, y - 8, x, y + 8);
      }
    }
  }

  private hop(state: ChowkaState): void {
    const last = state.last!;
    const piece = this.pieces[last.seat]![last.piece]!;
    const side = state.side(last.seat);
    const steps: { x: number; y: number }[] = [];
    if (last.from === CHOWKA_WAITING) steps.push(this.spot(last.seat, last.piece));
    else {
      // Step by step, round the outside again if the throw carried the piece past the door.
      for (let i = last.from; i !== last.to; ) {
        i = last.to < last.from && i === 15 ? 0 : i + 1;
        const c = chowkaSquare(side, i);
        steps.push(gridXY(c.x, c.y));
      }
      if (steps.length) steps[steps.length - 1] = this.spot(last.seat, last.piece);
      else steps.push(this.spot(last.seat, last.piece));
    }
    // Long throws hop faster, so a 25 does not hold the table up.
    const each = Math.max(28, Math.min(90, 700 / steps.length));
    this.moving++;
    piece.setDepth(7);
    const next = (i: number): void => {
      if (i >= steps.length) {
        piece.setDepth(5);
        this.tweens.add({ targets: piece, scaleX: { from: 1.25, to: 1 }, scaleY: { from: 0.8, to: 1 }, duration: 160, ease: 'Back.easeOut' });
        cue(last.captured.length ? 'capture' : 'place');
        for (const [s, p] of last.captured) this.sendBack(s, p);
        if (last.captured.length) this.shout(this.spot(last.seat, last.piece), 'Hit!', COLORS.tomato);
        if (last.to >= CHOWKA_HOME) this.shout(gridXY(2, 2), 'Home!', COLORS.mint);
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
  private options(): { move: ChowkaMove; from: { x: number; y: number }; to: { x: number; y: number } }[] {
    const state = this.state;
    const seat = state.currentSeat;
    const side = state.side(seat);
    return state.legalMoves(seat).filter((m) => m !== 'roll').map((move) => {
      if (move === 'e') {
        const piece = state.pieces[seat]!.indexOf(CHOWKA_WAITING);
        const c = chowkaSquare(side, 0);
        return { move, from: this.spot(seat, piece), to: gridXY(c.x, c.y) };
      }
      const piece = Number(move.slice(1));
      const c = chowkaSquare(side, state.target(seat, piece, state.value)!);
      return { move, from: this.spot(seat, piece), to: gridXY(c.x, c.y) };
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
    let best: ChowkaMove | null = null;
    let near = 50;
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

export function chowkaStatus(state: ChowkaState, names: readonly string[]): string | undefined {
  if (state.result) return undefined;
  const seat = state.currentSeat;
  const name = names[seat] ?? chowkaNames(state.players)[seat];
  const home = state.pieces[seat]!.filter((p) => p >= CHOWKA_HOME).length;
  const now = state.phase === 'roll' ? `${name} to throw` : `${name} threw ${state.value}`;
  const door = state.hit[seat] ? '' : '. Hit someone to go inside';
  return `${now}. ${home} of ${CHOWKA_PIECES} home${door}`;
}
