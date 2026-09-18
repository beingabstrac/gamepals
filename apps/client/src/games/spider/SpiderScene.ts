import { SPIDER_COLUMNS, SPIDER_DEAL, spiderMoveFrom, type SpiderMove, type SpiderState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import type { Session } from '../../session';
import { fitCamera, sharpText } from '../crisp';
import { drawSlot, jitter, makeCard, setFace, type CardView } from '../cards/view';
import { hintBusFor, type HintBus } from '../cards/hintBus';
import { focusRing, isPress, moveRing, onKeys } from '../keys';

const W = 820;
const H = 1060;
export const SPIDER_SIZE = { width: W, height: H };

const CW = 70;
const CH = 99;
const GAP = (W - SPIDER_COLUMNS * CW) / (SPIDER_COLUMNS + 1);
const colX = (c: number) => GAP + c * (CW + GAP) + CW / 2;
const TAB_Y = 16 + CH / 2;
const DOWN_STEP = 15;
const UP_STEP = 30;
const FOOT_Y = H - CH / 2 - 14;
const MOVE_MS = 200;
const DRAG_MIN = 10;
const TABLE = 0xffe2c4;
const SLOT = 0xf0b878;
/** Cards in play: two packs. */
const PACK = 104;

interface Spot {
  readonly x: number;
  readonly y: number;
  readonly up: boolean;
  readonly depth: number;
  /** The column and index this card can be picked up from, or null when it can't be. */
  readonly source: { column: number; index: number } | null;
}

interface Drag {
  readonly column: number;
  readonly count: number;
  readonly cards: number[];
  readonly startX: number;
  readonly startY: number;
  readonly at: { x: number; y: number }[];
  lastX: number;
  moved: boolean;
}

/** Where every card sits: the stock bottom right, finished runs bottom left, the rest in columns. */
function layout(state: SpiderState, done: readonly number[]): Map<number, Spot> {
  const spots = new Map<number, Spot>();
  state.stock.forEach((card, i) => spots.set(card, { x: W - CW / 2 - 16 - i * 2, y: FOOT_Y, up: false, depth: i, source: null }));
  done.forEach((card, i) => spots.set(card, { x: 16 + CW / 2 + Math.floor(i / 13) * 34, y: FOOT_Y, up: true, depth: 100 + i, source: null }));
  state.columns.forEach((column, c) => {
    const run = state.runLength(c);
    const steps = column.cards.slice(0, -1).map((_, i) => (i < column.down ? DOWN_STEP : UP_STEP));
    const total = steps.reduce((a, b) => a + b, 0);
    const room = FOOT_Y - CH / 2 - 18 - TAB_Y;
    const squeeze = total > room ? room / total : 1;
    let y = TAB_Y;
    column.cards.forEach((card, i) => {
      const movable = i >= column.cards.length - run;
      spots.set(card, { x: colX(c), y, up: i >= column.down, depth: 300 + c * 30 + i, source: movable ? { column: c, index: i } : null });
      y += (steps[i] ?? 0) * squeeze;
    });
  });
  return spots;
}

export class SpiderScene extends Scene {
  private readonly bus: HintBus<SpiderMove>;
  private views = new Map<number, CardView>();
  private spots = new Map<number, Spot>();
  /** Cards lifted off the board as finished runs, in the order they left. */
  private done: number[] = [];
  private drag: Drag | null = null;
  private keyColumn = 0;
  private keyDepth: number | null = null;
  private ring?: GameObjects.Graphics;
  private banner?: GameObjects.Text;
  private dealsLeft?: GameObjects.Text;

  constructor(private readonly session: Session<SpiderMove>) {
    super('spider');
    this.bus = hintBusFor(session);
  }

  private get state(): SpiderState {
    return this.session.state as SpiderState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.drawTable();
    const start = this.state;
    for (const card of [...start.columns.flatMap((column) => column.cards), ...start.stock]) {
      const view = makeCard(this, card, CW, CH);
      view.box.setPosition(W - CW / 2 - 16, FOOT_Y);
      this.views.set(card, view);
    }
    this.sync(true, true);

    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.press(p.worldX, p.worldY));
    this.input.on('pointermove', (p: { worldX: number; worldY: number; isDown: boolean }) => {
      if (p.isDown) this.dragTo(p.worldX, p.worldY);
    });
    this.input.on('pointerup', (p: { worldX: number; worldY: number }) => this.release(p.worldX, p.worldY));

    // Keyboard: Left/Right pick a column, Up/Down take more or less of its run, Enter moves it, D deals.
    this.ring = focusRing(this, CW + 12, CH + 12, 16);
    onKeys(this, (key) => this.key(key));

    const offSession = this.session.subscribe(() => this.sync(true));
    const offHint = this.bus.onHint((move) => this.pointAt(move));
    this.events.once('shutdown', () => {
      offSession();
      offHint();
    });
  }

  private drawTable(): void {
    const g = this.add.graphics();
    g.fillStyle(TABLE, 1);
    g.fillRoundedRect(0, 0, W, H, 28);
    for (let c = 0; c < SPIDER_COLUMNS; c++) drawSlot(g, colX(c), TAB_Y, CW, CH, SLOT);
    drawSlot(g, W - CW / 2 - 16, FOOT_Y, CW, CH, SLOT);
    // How many rows are still in the deck, on the deck itself.
    this.dealsLeft = sharpText(this, W - CW / 2 - 16, FOOT_Y - CH / 2 - 16, '', 24, '#b3672a').setDepth(4000);
    drawSlot(g, 16 + CW / 2, FOOT_Y, CW, CH, SLOT);
    sharpText(this, 16 + CW / 2, FOOT_Y, '★', 34, '#d99450');
    this.banner = sharpText(this, W / 2, FOOT_Y, 'Tap the deck for a new row', 26, '#b3672a').setDepth(4000);
  }

  /** Cards in the state that we have not made a view for yet never happens: the deal makes them all. */
  private viewOf(card: number): CardView {
    let view = this.views.get(card);
    if (!view) {
      view = makeCard(this, card, CW, CH);
      this.views.set(card, view);
    }
    return view;
  }

  private sync(animate: boolean, deal = false): void {
    const state = this.state;
    // Cards that left the board since the last look are finished runs.
    const onBoard = new Set([...state.columns.flatMap((column) => column.cards), ...state.stock, ...this.done]);
    for (const card of this.views.keys()) if (!onBoard.has(card)) this.done.push(card);
    this.spots = layout(state, this.done);
    let order = 0;
    for (const [card, spot] of [...this.spots].sort((a, b) => a[1].depth - b[1].depth)) {
      const view = this.viewOf(card);
      const box = view.box;
      this.tweens.killTweensOf(box);
      box.setAngle(0);
      const moving = Math.abs(box.x - spot.x) > 0.5 || Math.abs(box.y - spot.y) > 0.5;
      const delay = deal && spot.depth >= 300 ? order++ * 14 : 0;
      if (spot.up !== view.up) {
        if (animate) {
          // Flip: squeeze to an edge, swap faces, open back up.
          this.tweens.add({
            targets: box,
            scaleX: 0,
            duration: 80,
            delay: delay + (moving ? MOVE_MS * 0.5 : 0),
            onComplete: () => {
              setFace(view, spot.up);
              this.tweens.add({ targets: box, scaleX: 1, duration: 100, ease: 'Back.easeOut' });
            },
          });
        } else setFace(view, spot.up);
      } else box.setScale(1);
      if (moving && animate) {
        box.setDepth(1000 + spot.depth);
        this.tweens.add({
          targets: box,
          x: spot.x,
          y: spot.y,
          duration: MOVE_MS,
          delay,
          ease: 'Cubic.easeOut',
          onComplete: () => box.setDepth(spot.depth),
        });
      } else box.setPosition(spot.x, spot.y).setDepth(spot.depth);
    }
    this.banner?.setVisible(!state.result && state.stock.length > 0);
    const deals = Math.ceil(state.stock.length / SPIDER_COLUMNS);
    this.dealsLeft?.setText(deals ? `${deals} left` : '');
    if (state.last?.kind === 'run') this.sweepRun();
    if (state.result && animate) this.celebrate();
    else if (this.ring?.visible) this.showKeyFocus();
  }

  private key(key: string): boolean {
    const state = this.state;
    if (state.result) return false;
    if (key === 'd' || key === 'D') {
      if (state.legalMoves(0).includes(SPIDER_DEAL)) this.session.play(SPIDER_DEAL);
      return true;
    }
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      this.keyColumn = (this.keyColumn + (key === 'ArrowLeft' ? SPIDER_COLUMNS - 1 : 1)) % SPIDER_COLUMNS;
      this.keyDepth = null;
      this.showKeyFocus();
      return true;
    }
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      const column = state.columns[this.keyColumn]!;
      const run = state.runLength(this.keyColumn);
      if (run > 0) {
        const deepest = column.cards.length - run;
        const start = this.keyDepth ?? column.cards.length - 1;
        this.keyDepth = Math.min(column.cards.length - 1, Math.max(deepest, start + (key === 'ArrowUp' ? -1 : 1)));
      }
      this.showKeyFocus();
      return true;
    }
    if (isPress(key) && this.ring?.visible) {
      const index = this.keyIndex();
      const column = state.columns[this.keyColumn]!;
      if (index === null) return true;
      const move = spiderMoveFrom(state, this.keyColumn, column.cards.length - index);
      if (move) this.session.play(move);
      else this.shake(column.cards[index]!);
      return true;
    }
    return false;
  }

  /** Which card in the focused column the keyboard has hold of, or null when it has nothing. */
  private keyIndex(): number | null {
    const column = this.state.columns[this.keyColumn]!;
    const run = this.state.runLength(this.keyColumn);
    if (run === 0) return null;
    const deepest = column.cards.length - run;
    return Math.min(column.cards.length - 1, Math.max(deepest, this.keyDepth ?? column.cards.length - 1));
  }

  private showKeyFocus(): void {
    if (!this.ring) return;
    const index = this.keyIndex();
    const card = index === null ? undefined : this.state.columns[this.keyColumn]!.cards[index];
    const spot = card === undefined ? undefined : this.spots.get(card);
    moveRing(this, this.ring, spot?.x ?? colX(this.keyColumn), spot?.y ?? TAB_Y);
  }

  private hit(x: number, y: number): Spot | null {
    let best: Spot | null = null;
    for (const spot of this.spots.values()) {
      if (Math.abs(x - spot.x) > CW / 2 || Math.abs(y - spot.y) > CH / 2) continue;
      if (!best || spot.depth > best.depth) best = spot;
    }
    return best;
  }

  private press(x: number, y: number): void {
    const state = this.state;
    if (state.result) return;
    const onStock = Math.abs(x - (W - CW / 2 - 16)) <= CW / 2 + 12 && Math.abs(y - FOOT_Y) <= CH / 2;
    if (onStock) {
      if (state.legalMoves(0).includes(SPIDER_DEAL)) this.session.play(SPIDER_DEAL);
      else if (state.stock.length) {
        this.say('Fill the empty column before dealing');
        const top = state.stock[state.stock.length - 1];
        if (top !== undefined) this.shake(top);
      }
      return;
    }
    const spot = this.hit(x, y);
    if (!spot?.source) return;
    const { column, index } = spot.source;
    const cards = state.columns[column]!.cards.slice(index);
    cards.forEach((card, i) => this.viewOf(card).box.setDepth(2000 + i));
    this.drag = {
      column,
      count: cards.length,
      cards,
      startX: x,
      startY: y,
      at: cards.map((card) => ({ x: this.viewOf(card).box.x, y: this.viewOf(card).box.y })),
      lastX: x,
      moved: false,
    };
  }

  private dragTo(x: number, y: number): void {
    const drag = this.drag;
    if (!drag) return;
    if (!drag.moved && Math.hypot(x - drag.startX, y - drag.startY) < DRAG_MIN) return;
    drag.moved = true;
    const tilt = Math.max(-10, Math.min(10, (x - drag.lastX) * 0.8));
    drag.lastX = x;
    drag.cards.forEach((card, i) => {
      const box = this.viewOf(card).box;
      const at = drag.at[i]!;
      box.setPosition(at.x + x - drag.startX, at.y + y - drag.startY);
      box.setAngle(box.angle + (tilt - box.angle) * 0.35);
    });
  }

  private release(x: number, y: number): void {
    const drag = this.drag;
    this.drag = null;
    if (!drag) return;
    let move: SpiderMove | null;
    if (drag.moved) {
      // A drop has to land on the columns: the deck and the finished runs are not places to play.
      const onColumns = y < FOOT_Y - CH / 2 - 8;
      const to = Math.max(0, Math.min(SPIDER_COLUMNS - 1, Math.round((x - GAP - CW / 2) / (CW + GAP))));
      move = !onColumns || to === drag.column ? null : `m${drag.column}.${to}.${drag.count}`;
    } else move = spiderMoveFrom(this.state, drag.column, drag.count);
    if (move && this.state.legalMoves(0).includes(move)) {
      this.session.play(move);
      return;
    }
    this.sync(true);
    if (!drag.moved) this.shake(drag.cards[0]!);
  }

  private shake(card: number): void {
    const box = this.viewOf(card).box;
    this.tweens.add({ targets: box, angle: { from: -6, to: 6 }, duration: 60, yoyo: true, repeat: 2, onComplete: () => box.setAngle(0) });
  }

  /** A finished run leaves the board with a flourish on its way to the tray. */
  private sweepRun(): void {
    this.done.slice(-13).forEach((card, i) => {
      const box = this.viewOf(card).box;
      box.setDepth(4000 + i);
      this.tweens.add({ targets: box, angle: 360, duration: 520, delay: i * 26, ease: 'Cubic.easeOut', onComplete: () => box.setAngle(0) });
      this.tweens.add({ targets: box, scale: { from: 1.18, to: 1 }, duration: 520, delay: i * 26, ease: 'Back.easeOut' });
    });
  }

  private say(text: string): void {
    if (!this.banner) return;
    this.banner.setText(text).setVisible(true).setAlpha(1);
    this.tweens.add({ targets: this.banner, alpha: 0.35, duration: 200, yoyo: true, repeat: 2 });
  }

  /** Hint: the run that should move wiggles, or the deck bounces when a deal is the move. */
  private pointAt(move: SpiderMove): void {
    if (move === SPIDER_DEAL) {
      const top = this.state.stock[this.state.stock.length - 1];
      if (top !== undefined) this.shake(top);
      return;
    }
    const [from] = move.slice(1).split('.').map(Number) as [number];
    const count = Number(move.split('.')[2]);
    this.state.columns[from]!.cards.slice(-count).forEach((card) => this.shake(card));
  }

  /** Winning: the finished runs fan out and tumble across the table. */
  private celebrate(): void {
    this.done.slice(0, PACK).forEach((card, i) => {
      const box = this.viewOf(card).box;
      const delay = 300 + i * 22;
      box.setDepth(3000 + i);
      this.tweens.add({ targets: box, x: 40 + jitter(card) * (W - 80), duration: 900, delay, ease: 'Sine.easeOut' });
      this.tweens.add({ targets: box, y: FOOT_Y, duration: 900, delay, ease: 'Bounce.easeOut' });
      this.tweens.add({ targets: box, angle: (jitter(card + 5) - 0.5) * 90, duration: 900, delay });
    });
  }
}

export const spiderStatus = (state: SpiderState): string => {
  const deals = Math.ceil(state.stock.length / SPIDER_COLUMNS);
  return `${state.done} of 8 runs · ${deals} ${deals === 1 ? 'deal' : 'deals'} left`;
};
