import { takeTileMove, TRAY_SIZE, UNDO_TILE_MOVE, type TileMatchState, type TileMove } from '@gamepals/rules';
import { Scene, type GameObjects, type Tweens } from 'phaser';
import { applySpeed } from '../../autoplay';
import type { Session } from '../../session';
import { COLORS, toHex } from '../../theme';
import { fitCamera } from '../crisp';
import { arrow, focusRing, isPress, moveRing, onKeys } from '../keys';
import { drawPicture } from './pictures';

const W = 720;
const H = 1040;
export const TILE_MATCH_SIZE = { width: W, height: H };

/** A tile's face, and the lip under it that makes it look thick. */
const TW = 92;
const TH = 100;
const LIP = 8;
/** How far up each layer sits, so a stack reads as a stack. */
const LIFT = 7;
const TRAY_SCALE = 0.84;
const TRAY_H = 128;
const TRAY_GAP = 36;
/** A tile's flight into the tray, and the pop of a three. */
const FLY_MS = 300;
const POP_MS = 220;
const ARC = 90;

const FACE = toHex(COLORS.paper);
const EDGE = 0xd9d2ec;
const INK = toHex(COLORS.ink);

type Place = 'board' | 'gone' | `tray${number}`;

interface TileView {
  readonly box: GameObjects.Container;
  readonly shade: GameObjects.Graphics;
  place: Place;
}

/**
 * Tile Match. Where each tile belongs (on the board, in a place in the tray, or cleared) is worked
 * out from the state every time it changes, and the tweens only carry a tile from where it was to
 * where it belongs. A take plays in three beats: the tile flies in while the tray makes room, a
 * three pops, and the tray closes up.
 */
export class TileMatchScene extends Scene {
  private readonly views: TileView[] = [];
  private x0 = 0;
  private y0 = 0;
  private trayY = 0;
  private tray!: GameObjects.Container;
  private cursor = -1;
  private ring?: GameObjects.Graphics;
  private busyUntil = 0;
  /** Tiles in the air. A counter tween moves them, and `getTweensOf` does not see those. */
  private readonly flights = new Map<number, Tweens.Tween>();

  constructor(private readonly session: Session<TileMove>) {
    super('tile-match');
  }

  private get state(): TileMatchState {
    return this.session.state as TileMatchState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    const state = this.state;
    const layers = Math.max(1, ...state.tiles.map((t) => t.z + 1));
    const boardH = 7 * TH + LIP;
    const top = (H - ((layers - 1) * LIFT + boardH + TRAY_GAP + TRAY_H)) / 2;
    this.x0 = (W - 7 * TW) / 2;
    this.y0 = top + (layers - 1) * LIFT;
    this.trayY = this.y0 + boardH + TRAY_GAP + TRAY_H / 2;

    const panel = this.add.graphics();
    const width = 7 * TW + 24;
    panel.fillStyle(0xe6e0f4, 1);
    panel.fillRoundedRect(-width / 2, -TRAY_H / 2 + 6, width, TRAY_H, 30);
    panel.fillStyle(0xffffff, 1);
    panel.fillRoundedRect(-width / 2, -TRAY_H / 2, width, TRAY_H, 30);
    for (let slot = 0; slot < TRAY_SIZE; slot++) {
      panel.fillStyle(0xf4f1fb, 1);
      panel.fillRoundedRect(this.slotX(slot) - W / 2 - (TW * TRAY_SCALE) / 2, -(TH * TRAY_SCALE) / 2, TW * TRAY_SCALE, TH * TRAY_SCALE, 16);
    }
    this.tray = this.add.container(W / 2, this.trayY, [panel]).setDepth(15000);

    state.tiles.forEach((_, tile) => this.views.push(this.makeTile(tile)));
    this.place(false);

    this.ring = focusRing(this, TW + 12, TH + 12, 20);
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.tap(p.worldX, p.worldY));
    onKeys(this, (key) => this.key(key));
    const unsubscribe = this.session.subscribe(() => this.place(true));
    this.events.once('shutdown', unsubscribe);
  }

  /** Still showing the last move. See `apps/client/src/games/busy.ts`. */
  busy(): boolean {
    return this.time.now < this.busyUntil;
  }

  private boardPoint(tile: number): { x: number; y: number } {
    const t = this.state.tiles[tile]!;
    return { x: this.x0 + (t.x + 1) * (TW / 2), y: this.y0 + (t.y + 1) * (TH / 2) - t.z * LIFT };
  }

  private slotX(slot: number): number {
    return this.x0 + slot * TW + TW / 2;
  }

  private boardDepth(tile: number): number {
    const t = this.state.tiles[tile]!;
    return t.z * 1000 + t.y * 20 + t.x;
  }

  private makeTile(tile: number): TileView {
    const { x, y } = this.boardPoint(tile);
    const g = this.add.graphics();
    g.fillStyle(EDGE, 1);
    g.fillRoundedRect(-TW / 2 + 2, -TH / 2 + LIP, TW - 4, TH - 4, 16);
    g.fillStyle(FACE, 1);
    g.fillRoundedRect(-TW / 2 + 2, -TH / 2, TW - 4, TH - 4, 16);
    g.lineStyle(3, 0xece8f5, 1);
    g.strokeRoundedRect(-TW / 2 + 2, -TH / 2, TW - 4, TH - 4, 16);
    const picture = this.add.graphics().setPosition(0, -2);
    drawPicture(picture, this.state.symbols[tile]!, TW * 0.34);
    const shade = this.add.graphics();
    shade.fillStyle(INK, 1);
    shade.fillRoundedRect(-TW / 2 + 2, -TH / 2, TW - 4, TH - 4 + LIP, 16);
    shade.setAlpha(0);
    const box = this.add.container(x, y, [g, picture, shade]).setDepth(this.boardDepth(tile));
    return { box, shade, place: 'board' };
  }

  /** Where each tile belongs now, by the rules. */
  private wanted(): Place[] {
    const state = this.state;
    return state.tiles.map((_, tile): Place => {
      if (state.onBoard[tile]) return 'board';
      const slot = state.tray.indexOf(tile);
      return slot >= 0 ? `tray${slot}` : 'gone';
    });
  }

  private place(animate: boolean): void {
    const state = this.state;
    const want = this.wanted();
    const last = state.last;
    const now = this.time.now;
    let longest = 0;

    if (animate && last && !last.undo && state.previous) {
      // Beat one: the tile flies to where it lands, and the tray makes room for it.
      const before = [...state.previous.tray];
      before.splice(last.slot, 0, last.tile);
      before.forEach((tile, slot) => {
        if (tile !== last.tile) this.slide(tile, slot, 0);
      });
      this.fly(last.tile, this.slotX(last.slot), this.trayY, TRAY_SCALE, 20000 + last.slot, !last.cleared.includes(last.tile));
      longest = FLY_MS;
      if (last.cleared.length) {
        // Beat two: the three pop. Beat three: the tray closes up.
        // Beat one's slides and the flight are both done by then, so nothing is interrupted.
        for (const tile of last.cleared) this.pop(tile, FLY_MS + 20, false);
        state.tray.forEach((tile, slot) => this.slide(tile, slot, FLY_MS + POP_MS));
        longest = FLY_MS + POP_MS + 240;
      }
      want.forEach((place, tile) => (this.views[tile]!.place = place));
    } else {
      want.forEach((place, tile) => {
        const view = this.views[tile]!;
        if (view.place === place) return;
        if (place === 'board') {
          const { x, y } = this.boardPoint(tile);
          if (animate) this.fly(tile, x, y, 1, this.boardDepth(tile), true);
          else view.box.setPosition(x, y).setScale(1).setAlpha(1).setVisible(true).setDepth(this.boardDepth(tile));
        } else if (place === 'gone') {
          if (animate) this.pop(tile, 0, true);
          else view.box.setVisible(false);
        } else {
          const slot = Number(place.slice(4));
          if (view.place === 'gone') this.settle(tile);
          if (view.place === 'gone') view.box.setVisible(true).setAlpha(1).setScale(0.2).setPosition(this.slotX(slot), this.trayY);
          if (animate) this.slide(tile, slot, 0);
          else view.box.setPosition(this.slotX(slot), this.trayY).setScale(TRAY_SCALE).setDepth(20000 + slot);
        }
        view.place = place;
        longest = Math.max(longest, animate ? FLY_MS : 0);
      });
    }
    this.shade(animate);
    this.busyUntil = now + longest + 80;
    if (animate && state.result) this.time.delayedCall(longest, () => this.finish());
  }

  /** A tile arcs through the air to a spot, turning to the size it will be there, and lands with a squash. */
  private fly(tile: number, x: number, y: number, scale: number, depth: number, squash: boolean): void {
    const box = this.views[tile]!.box;
    this.settle(tile);
    const from = { x: box.x, y: box.y, scale: box.scale };
    box.setDepth(30000).setVisible(true).setAlpha(1).setAngle(0);
    const flight = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: FLY_MS,
      ease: 'Quad.easeInOut',
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;
        box.setPosition(from.x + (x - from.x) * t, from.y + (y - from.y) * t - Math.sin(Math.PI * t) * ARC);
        box.setScale(from.scale + (scale - from.scale) * t);
      },
      onComplete: () => {
        this.flights.delete(tile);
        box.setPosition(x, y).setScale(scale).setDepth(depth);
        // A tile that makes a three pops instead, so it does not squash as well.
        if (squash) this.tweens.add({ targets: box, scaleY: scale * 0.9, scaleX: scale * 1.06, duration: 70, yoyo: true, ease: 'Quad.easeOut' });
      },
    });
    this.flights.set(tile, flight);
  }

  /**
   * Stops whatever is moving a tile, where it is, before it is sent somewhere new. Without this a
   * flight still in the air when the next take comes would land the tile in the place it was headed
   * before the tray shifted: the drift Q1 was about.
   */
  private settle(tile: number): void {
    this.flights.get(tile)?.remove();
    this.flights.delete(tile);
    this.tweens.killTweensOf(this.views[tile]!.box);
  }

  private slide(tile: number, slot: number, delay: number): void {
    const box = this.views[tile]!.box;
    this.settle(tile);
    this.tweens.add({ targets: box, x: this.slotX(slot), y: this.trayY, scale: TRAY_SCALE, duration: 200, delay, ease: 'Back.easeOut', onStart: () => box.setDepth(20000 + slot) });
  }

  /** A three pops and goes. `interrupt` is false when the tile is still landing and should finish first. */
  private pop(tile: number, delay: number, interrupt: boolean): void {
    const box = this.views[tile]!.box;
    if (interrupt) this.settle(tile);
    this.tweens.add({
      targets: box,
      scale: TRAY_SCALE * 1.25,
      y: this.trayY - 26,
      duration: POP_MS / 2,
      delay,
      ease: 'Quad.easeOut',
      yoyo: true,
      onComplete: () => this.tweens.add({ targets: box, scale: 0, alpha: 0, duration: 120, onComplete: () => box.setVisible(false) }),
    });
  }

  /** Covered tiles go darker, so the free ones stand out. */
  private shade(animate: boolean): void {
    const state = this.state;
    this.views.forEach((view, tile) => {
      const alpha = state.onBoard[tile] && !state.isFree(tile) ? 0.34 : 0;
      if (view.shade.alpha === alpha) return;
      if (animate) this.tweens.add({ targets: view.shade, alpha, duration: 180, delay: 120 });
      else view.shade.setAlpha(alpha);
    });
  }

  private finish(): void {
    const result = this.state.result;
    if (!result) return;
    if (result.winners.length === 0) {
      this.cameras.main.shake(260, 0.007);
      return;
    }
    this.tweens.add({ targets: this.tray, scaleX: 1.05, scaleY: 0.9, duration: 130, yoyo: true, ease: 'Quad.easeOut' });
  }

  /** The tile drawn on top at a point, if any. */
  private tileAt(x: number, y: number): number | null {
    const state = this.state;
    let best: number | null = null;
    for (let tile = 0; tile < state.tiles.length; tile++) {
      if (!state.onBoard[tile]) continue;
      const p = this.boardPoint(tile);
      if (Math.abs(x - p.x) > TW / 2 || y < p.y - TH / 2 || y > p.y + TH / 2 + LIP) continue;
      if (best === null || this.boardDepth(tile) > this.boardDepth(best)) best = tile;
    }
    return best;
  }

  private tap(x: number, y: number): void {
    const tile = this.tileAt(x, y);
    if (tile !== null) this.take(tile);
  }

  private take(tile: number): void {
    const state = this.state;
    if (state.result || !this.session.isHumanTurn()) return;
    if (!state.isFree(tile)) {
      const box = this.views[tile]!.box;
      this.tweens.add({ targets: box, angle: { from: -5, to: 5 }, duration: 50, yoyo: true, repeat: 1, onComplete: () => box.setAngle(0) });
      return;
    }
    this.session.play(takeTileMove(tile));
  }

  private key(key: string): boolean {
    const state = this.state;
    if (key.toLowerCase() === 'u') {
      if (state.legalMoves(0).includes(UNDO_TILE_MOVE) && this.session.isHumanTurn()) this.session.play(UNDO_TILE_MOVE);
      return true;
    }
    const free = state.tiles.flatMap((_, tile) => (state.isFree(tile) ? [tile] : []));
    if (free.length === 0) return false;
    if (!free.includes(this.cursor)) this.cursor = free[0]!;
    const step = arrow(key);
    if (step) {
      // The nearest free tile that way, weighing straight ahead over off to the side.
      const from = this.boardPoint(this.cursor);
      let best = this.cursor;
      let score = Infinity;
      for (const tile of free) {
        const p = this.boardPoint(tile);
        const ahead = (p.x - from.x) * step[0] + (p.y - from.y) * step[1];
        if (ahead <= 1) continue;
        const aside = Math.abs((p.x - from.x) * step[1]) + Math.abs((p.y - from.y) * step[0]);
        if (ahead + aside * 2 < score) {
          score = ahead + aside * 2;
          best = tile;
        }
      }
      this.cursor = best;
      const p = this.boardPoint(best);
      if (this.ring) moveRing(this, this.ring, p.x, p.y + LIP / 2);
      return true;
    }
    if (isPress(key)) {
      this.take(this.cursor);
      return true;
    }
    return false;
  }

  /**
   * Whether every tile is where the rules say, for the Q1 check in `e2e/wordlayout.spec.ts`: on the
   * board at its own spot, in its place in the tray, or gone. Only asked of tiles that are not moving.
   */
  boardCheck(): { settled: number; wrong: number; note: string } {
    const want = this.wanted();
    let settled = 0;
    let wrong = 0;
    let note = '';
    this.views.forEach((view, tile) => {
      if (this.tweens.isTweening(view.box) || this.busy()) return;
      settled++;
      const place = want[tile]!;
      const box = view.box;
      let off = '';
      if (place === 'gone') {
        if (box.visible && box.alpha > 0.05) off = 'still showing';
      } else {
        const target = place === 'board' ? this.boardPoint(tile) : { x: this.slotX(Number(place.slice(4))), y: this.trayY };
        if (!box.visible) off = 'hidden';
        else if (Math.hypot(box.x - target.x, box.y - target.y) > 2) off = `at ${Math.round(box.x)},${Math.round(box.y)} not ${Math.round(target.x)},${Math.round(target.y)}`;
      }
      if (off) {
        wrong++;
        note = `tile ${tile} should be ${place} and is ${off}`;
      }
    });
    return { settled, wrong, note };
  }
}
