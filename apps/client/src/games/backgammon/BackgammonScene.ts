import type { BackgammonEvent, BackgammonMove, BackgammonState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { ROOM_TONES, tone } from '../../look';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed } from '../../autoplay';
import { arrow, isPress, onKeys } from '../keys';

const W = 760;
const H = 620;
export const BACKGAMMON_SIZE = { width: W, height: H };
export const BACKGAMMON_NAMES = ['Blue', 'Red'];
export const BACKGAMMON_COLORS = [COLORS.sky, COLORS.tomato];

const EDGE = 20;
const BAR_X = 340;
const BAR_W = 44;
const TRAY_X = 700;
const SLOT = 50;
const CHECKER = 21;
const POINT_H = 232;
const SEAT_HEX = BACKGAMMON_COLORS.map(toHex);
const SEAT_DARK = [DARK.sky, DARK.tomato].map(toHex);
const POINT_LIGHT = 0xffe9cf;
const POINT_DARK = tone(0xc9b6f5, ROOM_TONES.woodSquare);
const SUNNY = toHex(COLORS.sunny);
const INK = toHex(COLORS.ink);

type Point = { x: number; y: number };
/** Where a tap can land: a point, the bar, or the tray. */
type Spot = number | 'bar' | 'off';

/** Points 0–11 run along the bottom (0 at the right), 12–23 along the top (12 at the left). */
function pointX(point: number): number {
  if (point < 6) return TRAY_X - 45 - point * SLOT;
  if (point < 12) return BAR_X - 22 - (point - 6) * SLOT;
  if (point < 18) return EDGE + 25 + (point - 12) * SLOT;
  return BAR_X + 22 + (point - 18) * SLOT;
}
const isBottom = (point: number) => point < 12;

function checkerAt(point: number, index: number): Point {
  const x = pointX(point);
  const step = Math.min(2 * CHECKER + 2, (POINT_H - 20) / Math.max(5, index + 1));
  return isBottom(point) ? { x, y: H - 34 - CHECKER - index * step } : { x, y: 34 + CHECKER + index * step };
}

export class BackgammonScene extends Scene {
  private boardG!: GameObjects.Graphics;
  private piecesG!: GameObjects.Graphics;
  private hintsG!: GameObjects.Graphics;
  private counts: GameObjects.Text[] = [];
  private banner!: GameObjects.Text;
  private selected: Spot | null = null;
  private cursor = 0;
  private ringVisible = false;
  private seen: BackgammonEvent | null = null;

  constructor(private readonly session: Session<BackgammonMove>) {
    super('backgammon');
  }

  private get state(): BackgammonState {
    return this.session.state as BackgammonState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.seen = this.state.last;
    this.boardG = this.add.graphics();
    this.hintsG = this.add.graphics().setDepth(1);
    this.piecesG = this.add.graphics().setDepth(2);
    this.counts = [0, 1].map((seat) => sharpText(this, TRAY_X + 25, seat === 0 ? H - 20 : 20, '', 18, COLORS.ink).setDepth(3));
    this.banner = sharpText(this, W / 2, H / 2, '', 30, COLORS.ink).setDepth(10).setAlpha(0).setStroke('#ffffff', 10);

    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.tap(p.worldX, p.worldY));
    onKeys(this, (key) => this.key(key));

    const unsubscribe = this.session.subscribe(() => this.onChange());
    this.events.once('shutdown', unsubscribe);
    this.draw();
  }

  private myTurn(): boolean {
    const state = this.state;
    return !state.result && state.phase === 'move' && this.session.isHumanTurn();
  }

  /** Moves available from a spot, as [target spot, move]. */
  private movesFrom(spot: Spot): { to: Spot; move: BackgammonMove }[] {
    const state = this.state;
    const seat = state.currentSeat;
    return state.legalMoves(seat).flatMap((move) => {
      if (move[0] === 'e' && spot === 'bar') return [{ to: Number(move.slice(1)) as Spot, move }];
      if (move[0] === 'o' && Number(move.slice(1)) === spot) return [{ to: 'off' as Spot, move }];
      if (move[0] === 'm') {
        const [from, to] = move.slice(1).split('.').map(Number);
        if (from === spot) return [{ to: to! as Spot, move }];
      }
      return [];
    });
  }

  private spotAt(x: number, y: number): Spot | null {
    if (x > TRAY_X - 20) return 'off';
    if (Math.abs(x - BAR_X) < BAR_W / 2 + 6) return 'bar';
    for (let point = 0; point < 24; point++) {
      if (Math.abs(x - pointX(point)) > SLOT / 2) continue;
      if (isBottom(point) === y > H / 2) return point;
    }
    return null;
  }

  private tap(x: number, y: number): void {
    if (!this.myTurn()) return;
    const spot = this.spotAt(x, y);
    if (spot === null) return;
    if (this.selected !== null) {
      const target = this.movesFrom(this.selected).find((m) => m.to === spot);
      if (target) {
        this.selected = null;
        this.session.play(target.move);
        return;
      }
    }
    this.selected = this.movesFrom(spot).length > 0 ? spot : null;
    this.draw();
  }

  private key(key: string): boolean {
    if (!this.myTurn()) return false;
    const step = arrow(key);
    if (step) {
      if (step[0] !== 0) this.cursor = (this.cursor + (isBottom(this.cursor) ? -step[0] : step[0]) + 24) % 24;
      else this.cursor = 23 - this.cursor;
      this.ringVisible = true;
      this.draw();
      return true;
    }
    if (isPress(key)) {
      this.ringVisible = true;
      const bar = this.state.board.bar[this.state.currentSeat] > 0;
      this.tapSpot(bar && this.selected === null ? 'bar' : this.cursor);
      return true;
    }
    return false;
  }

  private tapSpot(spot: Spot): void {
    if (this.selected !== null) {
      const target = this.movesFrom(this.selected).find((m) => m.to === spot);
      if (target) {
        this.selected = null;
        this.session.play(target.move);
        return;
      }
    }
    this.selected = this.movesFrom(spot).length > 0 ? spot : null;
    this.draw();
  }

  private draw(): void {
    const state = this.state;
    const g = this.boardG.clear();
    g.fillStyle(toHex(DARK.peach), 1);
    g.fillRoundedRect(0, 8, W, H - 16, 24);
    g.fillStyle(toHex(COLORS.peach), 1);
    g.fillRoundedRect(0, 0, W, H - 16, 24);
    g.fillStyle(0xfff6ea, 1);
    g.fillRect(EDGE, 24, TRAY_X - 40 - EDGE, H - 64);
    // The bar down the middle and the tray at the side.
    g.fillStyle(toHex(DARK.peach), 1);
    g.fillRect(BAR_X - BAR_W / 2, 24, BAR_W, H - 64);
    g.fillStyle(0xfff6ea, 1);
    g.fillRoundedRect(TRAY_X - 16, 24, 62, H - 64, 12);

    for (let point = 0; point < 24; point++) {
      const x = pointX(point);
      g.fillStyle(point % 2 === 0 ? POINT_DARK : POINT_LIGHT, 1);
      if (isBottom(point)) g.fillTriangle(x - SLOT / 2 + 3, H - 34, x + SLOT / 2 - 3, H - 34, x, H - 34 - POINT_H);
      else g.fillTriangle(x - SLOT / 2 + 3, 34, x + SLOT / 2 - 3, 34, x, 34 + POINT_H);
    }

    const hints = this.hintsG.clear();
    if (this.selected !== null) {
      for (const { to } of this.movesFrom(this.selected)) {
        const spot = to === 'off' ? { x: TRAY_X + 14, y: state.currentSeat === 0 ? H - 70 : 70 } : checkerAt(to as number, Math.abs(state.board.points[to as number]!));
        hints.fillStyle(SUNNY, 0.85);
        hints.fillCircle(spot.x, spot.y, 13);
      }
      const from = this.selected === 'bar' ? { x: BAR_X, y: state.currentSeat === 0 ? H / 2 + 70 : H / 2 - 70 } : checkerAt(this.selected as number, Math.abs(state.board.points[this.selected as number]!) - 1);
      hints.lineStyle(5, SUNNY, 1);
      hints.strokeCircle(from.x, from.y, CHECKER + 4);
    }
    if (this.ringVisible) {
      const x = pointX(this.cursor);
      hints.lineStyle(4, toHex(COLORS.grape), 1);
      hints.strokeRoundedRect(x - SLOT / 2 + 2, isBottom(this.cursor) ? H - 34 - POINT_H : 34, SLOT - 4, POINT_H, 8);
    }

    this.drawCheckers();
  }

  private drawCheckers(): void {
    const state = this.state;
    // Stack labels are text objects, so clear the old ones before drawing this pass.
    this.children.list.filter((child) => child.name.startsWith('stack')).forEach((child) => child.destroy());
    const g = this.piecesG.clear();
    const checker = (x: number, y: number, seat: number) => {
      g.fillStyle(SEAT_DARK[seat]!, 1);
      g.fillCircle(x, y + 3, CHECKER);
      g.fillStyle(SEAT_HEX[seat]!, 1);
      g.fillCircle(x, y, CHECKER);
      g.fillStyle(0xffffff, 0.75);
      g.fillCircle(x, y, CHECKER * 0.45);
    };
    state.board.points.forEach((count, point) => {
      const seat = count > 0 ? 0 : 1;
      const total = Math.abs(count);
      for (let i = 0; i < Math.min(total, 5); i++) {
        const { x, y } = checkerAt(point, i);
        checker(x, y, seat);
      }
      if (total > 5) {
        const { x, y } = checkerAt(point, 4);
        sharpText(this, x, y, String(total), 18, COLORS.ink).setDepth(3).setName(`stack${point}`);
      }
    });
    // The bar in the middle, and the tray at the side.
    [0, 1].forEach((seat) => {
      for (let i = 0; i < state.board.bar[seat]!; i++) {
        checker(BAR_X, seat === 0 ? H / 2 + 70 + i * 20 : H / 2 - 70 - i * 20, seat);
      }
      for (let i = 0; i < state.board.off[seat]!; i++) {
        g.fillStyle(SEAT_HEX[seat]!, 1);
        const y = seat === 0 ? H - 44 - i * 11 : 44 + i * 11;
        g.fillRoundedRect(TRAY_X - 8, y - 4, 46, 9, 4);
      }
      this.counts[seat]!.setText(state.board.off[seat] ? `${state.board.off[seat]} off` : '');
    });
    // Dice for the turn in progress.
    if (state.phase === 'move' && state.rolled.length) {
      state.rolled.forEach((value, i) => {
        const x = (state.currentSeat === 0 ? 470 : 150) + i * 62;
        g.fillStyle(tone(0xffffff, ROOM_TONES.panel), 1);
        g.fillRoundedRect(x - 24, H / 2 - 24, 48, 48, 12);
        g.lineStyle(3, INK, 0.25);
        g.strokeRoundedRect(x - 24, H / 2 - 24, 48, 48, 12);
        g.fillStyle(INK, 1);
        const spots: Record<number, readonly (readonly [number, number])[]> = {
          1: [[0, 0]],
          2: [[-1, -1], [1, 1]],
          3: [[-1, -1], [0, 0], [1, 1]],
          4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
          5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
          6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
        };
        for (const [px, py] of spots[value] ?? []) g.fillCircle(x + px * 12, H / 2 + py * 12, 4.5);
        // A die still to be used stays bright; a spent one fades.
        if (!state.dice.includes(value)) {
          g.fillStyle(0xfff6ea, 0.55);
          g.fillRoundedRect(x - 24, H / 2 - 24, 48, 48, 12);
        }
      });
    }
  }

  private shout(text: string): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setAlpha(1).setScale(0.7);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 800, duration: 260 });
  }

  private onChange(): void {
    const event = this.state.last;
    if (event && event !== this.seen) {
      this.seen = event;
      this.selected = null;
      if (event.kind === 'move' && event.hit) {
        this.shout('Hit!');
        this.cameras.main.shake(120, 0.004);
      }
      if (event.kind === 'pass') this.shout('No move, turn over');
    }
    this.draw();
  }
}
