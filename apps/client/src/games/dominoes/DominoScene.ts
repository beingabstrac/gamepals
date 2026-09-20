import { DOMINO_TILES, type DominoEvent, type DominoMove, type DominoState, type Placed } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import type { Session } from '../../session';
import { COLORS, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed } from '../../autoplay';
import { focusRing, isPress, moveRing, onKeys } from '../keys';

const W = 720;
const H = 660;
export const DOMINO_SIZE = { width: W, height: H };
export const DOMINO_COLORS = [COLORS.tomato, COLORS.mint, COLORS.sunny, COLORS.sky];
export const DOMINO_NAMES = ['Red', 'Green', 'Yellow', 'Blue'];

const LINE_TOP = 64;
const LINE_H = 380;
const ROW_W = 660;
const ROW_H = 74;
const TW = 58;
const TH = 29;
const LINE_GAP = 4;
const HAND_Y = 556;
const HW = 62;
const HH = 124;
const IVORY = 0xfffaf0;
const LIP = 0xe3dccd;
const INK = toHex(COLORS.ink);
const SUNNY = toHex(COLORS.sunny);
const GRAPE = toHex(COLORS.grape);
const SEAT_HEX = DOMINO_COLORS.map(toHex);
const PIP_HEX = [INK, ...[COLORS.tomato, COLORS.sky, COLORS.mint, COLORS.grape, COLORS.bubblegum, COLORS.peach].map(toHex)];
const PIPS: Record<number, readonly (readonly [number, number])[]> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

const isDouble = (tile: number) => DOMINO_TILES[tile]![0] === DOMINO_TILES[tile]![1];
const tileOf = (move: DominoMove) => Number(move.slice(1, -1));
type Side = 'L' | 'R';
type Point = { x: number; y: number };

/** An ivory tile with a divider and candy pips; `a` is the left (or top) half. */
function drawTile(g: GameObjects.Graphics, a: number, b: number, w: number, h: number, outline?: number): void {
  g.clear();
  g.fillStyle(LIP, 1);
  g.fillRoundedRect(-w / 2, -h / 2 + 4, w, h, 7);
  g.fillStyle(IVORY, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 7);
  if (outline !== undefined) {
    g.lineStyle(4, outline, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 7);
  }
  const horizontal = w > h;
  const s = Math.min(w, h);
  g.fillStyle(LIP, 1);
  if (horizontal) g.fillRect(-1.5, -h / 2 + 5, 3, h - 10);
  else g.fillRect(-w / 2 + 5, -1.5, w - 10, 3);
  const halves: [number, number, number][] = horizontal ? [[-s / 2, 0, a], [s / 2, 0, b]] : [[0, -s / 2, a], [0, s / 2, b]];
  for (const [cx, cy, value] of halves) {
    g.fillStyle(PIP_HEX[value] ?? INK, 1);
    for (const [px, py] of PIPS[value] ?? []) g.fillCircle(cx + px * s * 0.26, cy + py * s * 0.26, s * 0.085);
  }
}

interface Spot {
  x: number;
  y: number;
  angle: number;
  dir: 1 | -1;
  w: number;
}

/** The line snakes in centred rows, turning back at each row; doubles stand crossways. */
function layoutLine(line: readonly Placed[]): Spot[] {
  const widths = line.map((p) => (isDouble(p.tile) ? TH : TW));
  const rows: number[][] = [];
  let current: number[] = [];
  let used = 0;
  widths.forEach((w, i) => {
    const add = w + (current.length ? LINE_GAP : 0);
    if (current.length && used + add > ROW_W) {
      rows.push(current);
      current = [i];
      used = w;
    } else {
      current.push(i);
      used += add;
    }
  });
  if (current.length) rows.push(current);
  const spots: Spot[] = [];
  const top = LINE_TOP + (LINE_H - rows.length * ROW_H) / 2 + ROW_H / 2;
  rows.forEach((row, r) => {
    const rowWidth = row.reduce((sum, i) => sum + widths[i]!, 0) + LINE_GAP * (row.length - 1);
    const dir: 1 | -1 = r % 2 === 0 ? 1 : -1;
    let x = dir === 1 ? W / 2 - rowWidth / 2 : W / 2 + rowWidth / 2;
    for (const i of row) {
      const w = widths[i]!;
      spots[i] = { x: x + (dir * w) / 2, y: top + r * ROW_H, angle: dir === 1 ? 0 : 180, dir, w };
      x += dir * (w + LINE_GAP);
    }
  });
  return spots;
}

interface Target extends Point {
  angle: number;
  w: number;
  h: number;
  a: number;
  b: number;
  outline?: number;
}

export class DominoScene extends Scene {
  private sprites = new Map<number, GameObjects.Graphics>();
  private handSpots = new Map<number, Point>();
  private endPoints: Partial<Record<Side, Point>> = {};
  private chips!: GameObjects.Graphics;
  private chipText: GameObjects.Text[] = [];
  private ends!: GameObjects.Graphics;
  private cover!: GameObjects.Graphics;
  private coverText!: GameObjects.Text;
  private banner!: GameObjects.Text;
  private ring!: GameObjects.Graphics;
  private pending: number | null = null;
  private cursor: number | null = null;
  private side: Side = 'L';
  /** With several people on one device, whose hand has been uncovered this turn. */
  private revealed: number | null = null;
  private seen: DominoEvent | null = null;

  constructor(private readonly session: Session<DominoMove>) {
    super('dominoes');
  }

  private get state(): DominoState {
    return this.session.state as DominoState;
  }

  private people(): number[] {
    return this.session.seats.flatMap((s, i) => (s.kind === 'human' ? [i] : []));
  }

  /** Whose tiles are shown face up at the bottom, if anyone's. */
  private viewer(): number | null {
    const people = this.people();
    if (people.length === 1) return people[0]!;
    const seat = this.state.currentSeat;
    return people.length > 1 && this.revealed === seat ? seat : null;
  }

  private covered(): boolean {
    const state = this.state;
    const people = this.people();
    return people.length > 1 && people.includes(state.currentSeat) && this.revealed !== state.currentSeat && state.phase === 'play' && !state.result;
  }

  private myTurn(): boolean {
    const state = this.state;
    return this.session.isHumanTurn() && state.phase === 'play' && !state.result && this.viewer() === state.currentSeat;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.seen = this.state.last;

    const table = this.add.graphics();
    table.fillStyle(0xc7ead8, 1);
    table.fillRoundedRect(0, 50, W, LINE_H + 36, 36);
    table.fillStyle(0xdff5ea, 1);
    table.fillRoundedRect(0, 44, W, LINE_H + 36, 36);
    table.fillStyle(0xf3efe6, 1);
    table.fillRoundedRect(10, HAND_Y - HH / 2 - 30, W - 20, HH + 56, 30);

    this.chips = this.add.graphics();
    this.chipText = this.state.hands.map((_, seat) => sharpText(this, this.chipPos(seat).x + 8, 22, '', 16, COLORS.ink));
    this.ends = this.add.graphics().setDepth(1);
    this.cover = this.add.graphics().setDepth(20);
    this.coverText = sharpText(this, W / 2, HAND_Y, '', 22, COLORS.ink).setDepth(21);
    this.banner = sharpText(this, W / 2, LINE_TOP + LINE_H / 2, '', 30, COLORS.ink).setDepth(30).setAlpha(0).setStroke('#ffffff', 10);
    this.ring = focusRing(this, HW + 14, HH + 14, 12);

    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.tap(p.worldX, p.worldY));
    onKeys(this, (key) => this.key(key));

    const unsubscribe = this.session.subscribe(() => this.onChange());
    this.events.once('shutdown', unsubscribe);
    this.sync(false);
  }

  /**
   * The chips and the tiles, for the layout check. A settled gallery shot showed a domino sitting
   * on every player's name with the table empty, which is either a real overlap or something the
   * picture cannot tell apart from one. This measures it rather than guessing.
   */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    const ys = [...this.sprites.values()].map((g) => g.y);
    return [
      { name: 'chips', top: 22 - 17, bottom: 22 + 17 },
      // No tiles on the board yet is not an overlap, so an empty board reports the table top.
      { name: 'tiles', top: ys.length ? Math.min(...ys) - TH : 44, bottom: ys.length ? Math.max(...ys) + TH : 45 },
    ];
  }

  private chipPos(seat: number): Point {
    const players = this.state.players;
    return { x: ((seat + 0.5) * W) / players, y: 22 };
  }

  private playableTiles(): number[] {
    const state = this.state;
    if (!this.myTurn()) return [];
    const legal = new Set(state.legalMoves(state.currentSeat).filter((m) => m[0] === 'p').map(tileOf));
    return state.hands[state.currentSeat]!.filter((t) => legal.has(t));
  }

  private movesFor(tile: number): DominoMove[] {
    const state = this.state;
    return state.legalMoves(state.currentSeat).filter((m) => m[0] === 'p' && tileOf(m) === tile);
  }

  /** Puts every tile where it belongs, sliding in any that are new from `spawn`. */
  private sync(animate: boolean, spawn?: Point): void {
    const state = this.state;
    const targets = new Map<number, Target>();
    const spots = layoutLine(state.line);
    state.line.forEach((p, i) => {
      const spot = spots[i]!;
      const upright = isDouble(p.tile);
      targets.set(p.tile, { x: spot.x, y: spot.y, angle: spot.angle, w: upright ? TH : TW, h: upright ? TW : TH, a: p.left, b: p.right });
    });

    this.handSpots.clear();
    const viewer = this.viewer();
    if (viewer !== null) {
      const hand = state.hands[viewer]!;
      const playable = new Set(this.playableTiles());
      const step = Math.min(HW + 8, (W - 60) / Math.max(1, hand.length));
      const x0 = W / 2 - (step * (hand.length - 1)) / 2;
      hand.forEach((tile, k) => {
        const [a, b] = DOMINO_TILES[tile]!;
        const lift = tile === this.pending ? -22 : playable.has(tile) ? -12 : 0;
        const x = x0 + k * step;
        this.handSpots.set(tile, { x, y: HAND_Y });
        targets.set(tile, { x, y: HAND_Y + lift, angle: 0, w: HW, h: HH, a, b, outline: tile === this.pending ? GRAPE : playable.has(tile) ? SUNNY : undefined });
      });
    }

    for (const [tile, g] of this.sprites) {
      if (!targets.has(tile)) {
        g.destroy();
        this.sprites.delete(tile);
      }
    }
    for (const [tile, t] of targets) {
      let g = this.sprites.get(tile);
      if (!g) {
        g = this.add.graphics().setDepth(2);
        const start = spawn ?? t;
        g.setPosition(start.x, start.y);
        this.sprites.set(tile, g);
      }
      drawTile(g, t.a, t.b, t.w, t.h, t.outline);
      this.tweens.killTweensOf(g);
      if (animate) this.tweens.add({ targets: g, x: t.x, y: t.y, angle: t.angle, duration: 260, ease: 'Back.easeOut' });
      else g.setPosition(t.x, t.y).setAngle(t.angle);
    }

    // Where a tile that fits both ends can go.
    this.endPoints = {};
    const g = this.ends.clear();
    if (this.pending !== null && spots.length) {
      const first = spots[0]!;
      const last = spots[spots.length - 1]!;
      this.endPoints = {
        L: { x: first.x - first.dir * (first.w / 2 + 22), y: first.y },
        R: { x: last.x + last.dir * (last.w / 2 + 22), y: last.y },
      };
      for (const side of ['L', 'R'] as const) {
        const p = this.endPoints[side]!;
        g.fillStyle(GRAPE, side === this.side ? 0.55 : 0.25);
        g.fillCircle(p.x, p.y, 22);
      }
    }

    this.drawChips();
    const covered = this.covered();
    this.cover.clear();
    if (covered) {
      this.cover.fillStyle(toHex(COLORS.grape), 1);
      this.cover.fillRoundedRect(10, HAND_Y - HH / 2 - 30, W - 20, HH + 56, 30);
    }
    this.coverText.setText(covered ? `${DOMINO_NAMES[state.currentSeat]}, tap to see your tiles` : '').setColor('#ffffff');
    if (this.cursor !== null && !this.handSpots.has(this.cursor)) this.cursor = null;
  }

  /** Name, tiles left and score for every player; the player on turn gets a colored ring. */
  private drawChips(): void {
    const state = this.state;
    const g = this.chips.clear();
    const width = Math.min(200, W / state.players - 12);
    state.hands.forEach((hand, seat) => {
      const { x, y } = this.chipPos(seat);
      g.fillStyle(0xffffff, 1);
      g.fillRoundedRect(x - width / 2, y - 17, width, 34, 17);
      if (seat === state.currentSeat && !state.result) {
        g.lineStyle(4, SEAT_HEX[seat]!, 1);
        g.strokeRoundedRect(x - width / 2, y - 17, width, 34, 17);
      }
      g.fillStyle(SEAT_HEX[seat]!, 1);
      g.fillCircle(x - width / 2 + 18, y, 8);
      this.chipText[seat]!.setText(`${DOMINO_NAMES[seat]} · ${hand.length} · ${state.scores[seat]} pts`).setX(x + 8);
    });
  }

  private reveal(): void {
    this.revealed = this.state.currentSeat;
    this.sync(true);
  }

  private tap(x: number, y: number): void {
    if (this.covered()) {
      if (y > HAND_Y - HH / 2 - 30) this.reveal();
      return;
    }
    if (!this.myTurn()) return;
    if (this.pending !== null) {
      for (const side of ['L', 'R'] as const) {
        const p = this.endPoints[side];
        if (p && Math.hypot(x - p.x, y - p.y) < 36) {
          this.playTile(this.pending, side);
          return;
        }
      }
    }
    // Later tiles are drawn on top, so check them first when the hand is fanned.
    for (const [tile, spot] of [...this.handSpots].reverse()) {
      if (Math.abs(x - spot.x) < HW / 2 + 3 && Math.abs(y - spot.y) < HH / 2 + 24) {
        this.choose(tile);
        return;
      }
    }
    if (this.pending !== null) {
      this.pending = null;
      this.sync(true);
    }
  }

  /** One way to play it: play. Two (both ends): ask which end. None: a little no-shake. */
  private choose(tile: number): void {
    const moves = this.movesFor(tile);
    if (moves.length === 1) {
      this.playTile(tile, moves[0]!.slice(-1) as Side);
      return;
    }
    if (moves.length === 2) {
      this.pending = tile;
      this.side = 'L';
      this.sync(true);
      return;
    }
    const g = this.sprites.get(tile);
    if (g) this.tweens.add({ targets: g, x: g.x + 6, duration: 50, yoyo: true, repeat: 2 });
  }

  private playTile(tile: number, side: Side): void {
    this.pending = null;
    this.session.play(`p${tile}${side}`);
  }

  /** Arrows pick a tile, Up and Down switch the end, Enter or Space plays; Enter also draws, passes or deals. */
  private key(key: string): boolean {
    const state = this.state;
    if (this.covered()) {
      if (!isPress(key)) return false;
      this.reveal();
      return true;
    }
    if (!this.session.isHumanTurn()) return false;
    const moves = state.legalMoves(state.currentSeat);
    const onButton = document.activeElement instanceof HTMLButtonElement;
    if (moves.length && moves[0]![0] !== 'p') {
      if (!isPress(key) || onButton) return false;
      this.session.play(moves[0]!);
      return true;
    }
    if (!this.myTurn()) return false;
    const playable = this.playableTiles();
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      const at = this.cursor === null ? -1 : playable.indexOf(this.cursor);
      const next = at < 0 ? 0 : (at + (key === 'ArrowRight' ? 1 : playable.length - 1)) % playable.length;
      this.cursor = playable[next] ?? null;
      this.pending = this.cursor !== null && this.movesFor(this.cursor).length === 2 ? this.cursor : null;
      this.side = 'L';
      this.sync(true);
      const spot = this.cursor === null ? undefined : this.handSpots.get(this.cursor);
      if (spot) moveRing(this, this.ring, spot.x, spot.y - 12);
      return true;
    }
    if ((key === 'ArrowUp' || key === 'ArrowDown') && this.pending !== null) {
      this.side = this.side === 'L' ? 'R' : 'L';
      this.sync(true);
      return true;
    }
    if (isPress(key) && !onButton && this.cursor !== null && this.ring.visible) {
      const options = this.movesFor(this.cursor);
      const move = options.find((m) => m.endsWith(this.side)) ?? options[0];
      if (move) this.playTile(this.cursor, move.slice(-1) as Side);
      return true;
    }
    return false;
  }

  private shout(text: string, hold = 900): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 240, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: hold, duration: 280 });
  }

  private onChange(): void {
    const state = this.state;
    const event = state.last;
    if (event === this.seen || !event) {
      this.sync(true);
      return;
    }
    this.seen = event;
    const several = this.people().length > 1;
    switch (event.kind) {
      case 'play': {
        const fromHand = this.sprites.has(event.tile);
        this.pending = null;
        this.cursor = null;
        if (several) this.revealed = null;
        this.sync(true, fromHand ? undefined : this.chipPos(event.seat));
        const g = this.sprites.get(event.tile);
        if (g) this.time.delayedCall(260, () => this.tweens.add({ targets: g, scaleX: 1.12, scaleY: 1.12, duration: 80, yoyo: true }));
        break;
      }
      case 'draw':
        this.sync(true, { x: W - 60, y: LINE_TOP + 20 });
        break;
      case 'pass': {
        if (several) this.revealed = null;
        this.shout(`${DOMINO_NAMES[event.seat]} passes`, 600);
        const text = this.chipText[event.seat]!;
        this.tweens.add({ targets: text, x: text.x + 6, duration: 50, yoyo: true, repeat: 3 });
        this.sync(true);
        break;
      }
      case 'handEnd': {
        this.sync(true);
        const message =
          event.winner === null
            ? 'Blocked and tied. No points'
            : `${DOMINO_NAMES[event.winner]} ${event.blocked ? 'has the fewest pips' : 'goes out'}: +${event.points}`;
        this.shout(message, 1600);
        this.cameras.main.shake(140, 0.004);
        break;
      }
      case 'deal':
        for (const g of this.sprites.values()) g.destroy();
        this.sprites.clear();
        this.pending = null;
        this.cursor = null;
        this.revealed = null;
        this.sync(true, { x: W / 2, y: LINE_TOP + LINE_H / 2 });
        break;
    }
  }
}
