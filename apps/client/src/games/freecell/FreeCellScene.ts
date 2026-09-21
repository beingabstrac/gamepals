import {
  FREECELL_CELLS as CELLS,
  FREECELL_COLUMNS as COLUMNS,
  freeCellMoveFrom,
  freeCellSafeMove,
  FREECELL_UNDO,
  SUIT_SYMBOLS,
  type FreeCellMove,
  type FreeCellState,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import type { Session } from '../../session';
import { fitCamera, sharpText } from '../crisp';
import { drawSlot, jitter, makeCard, placeAt, setFace, slideTo, stopSlide, type CardView } from '../cards/view';
import { fanReport } from '../cards/fan';
import { hintBusFor, type HintBus } from '../cards/hintBus';
import { focusRing, isPress, moveRing, onKeys } from '../keys';

const W = 760;
const H = 790;
export const FREECELL_SIZE = { width: W, height: H };

const CW = 80;
const CH = 113;
const GAP = (W - COLUMNS * CW) / (COLUMNS + 1);
const spotX = (slot: number) => GAP + slot * (CW + GAP) + CW / 2;
/** The top row splits in two: cells lean left, foundations lean right, with a gap between them. */
const LEAN = 12;
const topX = (slot: number) => spotX(slot) + (slot < CELLS ? -LEAN : LEAN);
const TOP_Y = 14 + CH / 2;
const TAB_Y = TOP_Y + CH + 30;
const STEP = 36;
const ROOM = H - 14 - CH / 2 - TAB_Y;
const MOVE_MS = 200;
const DRAG_MIN = 10;
const TABLE = 0xc9e3ff;
const SLOT = 0x8cbdf0;
/** Piles the keyboard walks through: the eight columns, then the four free cells. */
const KEY_PILES = COLUMNS + CELLS;

interface Spot {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  /** Where this card can be picked up from, or null when it can't be. */
  readonly source: string | null;
  /** In a run, but further up it than the free cells can carry. */
  readonly blocked?: boolean;
}

interface Drag {
  readonly from: string;
  readonly count: number;
  readonly cards: number[];
  readonly startX: number;
  readonly startY: number;
  readonly at: { x: number; y: number }[];
  lastX: number;
  moved: boolean;
}

/** How many cards a column can actually hand over: its run, capped by what the free cells allow. */
const grabbable = (state: FreeCellState, column: number): number => Math.min(state.runLength(column), state.maxMove(false));

/** Where every card sits for a given state. Cards that are home sit on their foundation. */
function layout(state: FreeCellState): Map<number, Spot> {
  const spots = new Map<number, Spot>();
  state.cells.forEach((card, i) => {
    if (card !== null) spots.set(card, { x: topX(i), y: TOP_Y, depth: 100 + i, source: `f${i}` });
  });
  state.foundations.forEach((top, suit) => {
    for (let rank = 1; rank <= top; rank++) spots.set(suit * 13 + rank - 1, { x: topX(CELLS + suit), y: TOP_Y, depth: 200 + rank, source: null });
  });
  state.columns.forEach((cards, c) => {
    const run = grabbable(state, c);
    const total = Math.max(0, cards.length - 1) * STEP;
    const squeeze = total > ROOM ? ROOM / total : 1;
    const inRun = state.runLength(c);
    cards.forEach((card, i) => {
      // Only the run at the bottom of a column can be picked up, and only as far as the cells carry.
      const movable = i >= cards.length - run;
      const blocked = !movable && i >= cards.length - inRun;
      spots.set(card, { x: spotX(c), y: TAB_Y + i * STEP * squeeze, depth: 300 + c * 30 + i, source: movable ? `t${c}:${i}` : null, blocked });
    });
  });
  return spots;
}

/** The cards that travel together when a place is picked up. */
function cardsAt(state: FreeCellState, source: string): number[] {
  if (source[0] === 'f') return [state.cells[Number(source.slice(1))]!];
  const [place, index] = source.split(':');
  const cards = state.columns[Number(place!.slice(1))]!;
  return cards.slice(Number(index));
}

export class FreeCellScene extends Scene {
  private readonly bus: HintBus<FreeCellMove>;
  private views = new Map<number, CardView>();
  private spots = new Map<number, Spot>();
  private drag: Drag | null = null;
  /** Keyboard focus: 0–7 are the columns, 8–11 the free cells; depth is how far up the run. */
  private keyPile = 0;
  private keyDepth: number | null = null;
  private ring?: GameObjects.Graphics;
  private banner?: GameObjects.Text;
  /** Set while a card that nothing can need is on its way home. */
  private sending?: ReturnType<Scene['time']['delayedCall']>;
  /** Move count at the last look, and whether an undo has paused the cards going home. */
  private seenMoves = 0;
  private holdHome = false;

  constructor(private readonly session: Session<FreeCellMove>) {
    super('freecell');
    this.bus = hintBusFor(session);
  }

  private get state(): FreeCellState {
    return this.session.state as FreeCellState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.drawTable();
    for (let card = 0; card < 52; card++) {
      const view = makeCard(this, card, CW, CH);
      setFace(view, true); // In FreeCell every card is face up from the first deal.
      view.box.setPosition(W / 2, -CH);
      this.views.set(card, view);
    }
    this.sync(true, true);

    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.press(p.worldX, p.worldY));
    this.input.on('pointermove', (p: { worldX: number; worldY: number; isDown: boolean }) => {
      if (p.isDown) this.dragTo(p.worldX, p.worldY);
    });
    this.input.on('pointerup', (p: { worldX: number; worldY: number }) => this.release(p.worldX, p.worldY));

    // Keyboard: Left/Right pick a pile, Up/Down take more or less of a column's run, Enter moves it.
    this.ring = focusRing(this, CW + 12, CH + 12, 16);
    onKeys(this, (key) => this.key(key));

    this.sendHome();
    const offSession = this.session.subscribe(() => this.sync(true));
    const offHint = this.bus.onHint((move) => this.pointAt(move));
    this.events.once('shutdown', () => {
      this.sending?.remove();
      offSession();
      offHint();
    });
  }

  private drawTable(): void {
    const g = this.add.graphics();
    g.fillStyle(TABLE, 1);
    g.fillRoundedRect(0, 0, W, H, 28);
    for (let i = 0; i < CELLS; i++) {
      drawSlot(g, topX(i), TOP_Y, CW, CH, SLOT);
      sharpText(this, topX(i), TOP_Y, 'free', 22, '#6aa4e0');
    }
    for (let suit = 0; suit < 4; suit++) {
      // Home piles sit on a paler patch, so the four cells and the four homes never read as one row.
      g.fillStyle(0xdceeff, 1);
      g.fillRoundedRect(topX(CELLS + suit) - CW / 2, TOP_Y - CH / 2, CW, CH, 12);
      drawSlot(g, topX(CELLS + suit), TOP_Y, CW, CH, SLOT);
      sharpText(this, topX(CELLS + suit), TOP_Y, SUIT_SYMBOLS[suit]!, 42, '#6aa4e0');
    }
    sharpText(this, (topX(CELLS - 1) + topX(CELLS)) / 2, TOP_Y, '›', 30, '#a9cdf0');
    for (let c = 0; c < COLUMNS; c++) drawSlot(g, spotX(c), TAB_Y, CW, CH, SLOT);
    this.banner = sharpText(this, W / 2, TAB_Y - 17, '', 24, '#3d7cc0').setVisible(false).setDepth(4000);
  }

  private say(text: string): void {
    if (!this.banner) return;
    this.banner.setText(text).setVisible(true).setAlpha(1);
    this.tweens.add({ targets: this.banner, alpha: 0.3, duration: 220, yoyo: true, repeat: 2 });
  }

  /** Cards nothing can need go home by themselves, one every so often so the eye can follow. */
  private sendHome(): void {
    this.sending?.remove();
    // After an undo they stay put: taking a move back and watching it happen again is maddening.
    if (this.state.moves < this.seenMoves) this.holdHome = true;
    else if (this.state.moves > this.seenMoves) this.holdHome = false;
    this.seenMoves = this.state.moves;
    if (this.holdHome || this.state.result || this.drag) return;
    const move = freeCellSafeMove(this.state);
    if (!move) return;
    this.sending = this.time.delayedCall(220, () => {
      if (this.state.result || this.drag) return;
      const again = freeCellSafeMove(this.state);
      if (again) this.session.play(again);
    });
  }

  /** Moves every card to where the state says it belongs. */
  /**
   * Whether a covered card still shows its corner index. A card with another on top of it shows
   * only the strip down to the next card's top edge, and the fan stepped less far than the index
   * reaches, so every card but the bottom of a column showed a rank with its suit cut off.
   */
  fanCheck(): { checked: number; tight: number; worst: number } {
    const index = [...this.views.values()][0]?.index ?? 0;
    // Every card in a FreeCell column is face up, so every covered one has to stay readable.
    const columns = this.state.columns.map((cards) => ({
      cards: cards.map((card) => ({ y: this.spots.get(card)!.y, up: true })),
    }));
    return fanReport(columns, index, ROOM);
  }

  private sync(animate: boolean, deal = false): void {
    this.banner?.setVisible(false);
    this.spots = layout(this.state);
    let order = 0;
    for (const [card, spot] of [...this.spots].sort((a, b) => a[1].depth - b[1].depth)) {
      const view = this.views.get(card)!;
      const box = view.box;
      box.setAngle(0).setScale(1);
      const moving = Math.abs(box.x - spot.x) > 0.5 || Math.abs(box.y - spot.y) > 0.5;
      if (moving && animate) {
        slideTo(this, view, spot.x, spot.y, spot.depth, { duration: MOVE_MS, delay: deal ? order++ * 16 : 0, ease: deal ? 'Back.easeOut' : 'Cubic.easeOut' });
      } else placeAt(view, spot.x, spot.y, spot.depth);
    }
    if (this.state.result && animate) this.celebrate();
    else {
      if (this.ring?.visible) this.showKeyFocus();
      if (animate) this.sendHome();
    }
  }

  private key(key: string): boolean {
    if (this.state.result) return false;
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      this.keyPile = (this.keyPile + (key === 'ArrowLeft' ? KEY_PILES - 1 : 1)) % KEY_PILES;
      this.keyDepth = null;
      this.showKeyFocus();
      return true;
    }
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      const cards = this.keyPile < COLUMNS ? this.state.columns[this.keyPile]! : [];
      if (cards.length) {
        const deepest = cards.length - grabbable(this.state, this.keyPile);
        const start = this.keyDepth ?? cards.length - 1;
        this.keyDepth = Math.min(cards.length - 1, Math.max(deepest, start + (key === 'ArrowUp' ? -1 : 1)));
      }
      this.showKeyFocus();
      return true;
    }
    if (isPress(key) && this.ring?.visible) {
      const source = this.keySource();
      const move = source ? this.moveFor(source) : null;
      if (move) this.session.play(move);
      else if (source) this.shake(cardsAt(this.state, source)[0]!);
      return true;
    }
    return false;
  }

  /** The pick-up spot under the keyboard focus, or null when that pile is empty. */
  private keySource(): string | null {
    if (this.keyPile >= COLUMNS) {
      const cell = this.keyPile - COLUMNS;
      return this.state.cells[cell] === null ? null : `f${cell}`;
    }
    const cards = this.state.columns[this.keyPile]!;
    if (!cards.length) return null;
    const deepest = cards.length - grabbable(this.state, this.keyPile);
    return `t${this.keyPile}:${Math.min(cards.length - 1, Math.max(deepest, this.keyDepth ?? cards.length - 1))}`;
  }

  private showKeyFocus(): void {
    if (!this.ring) return;
    const source = this.keySource();
    const spot = source ? this.spots.get(cardsAt(this.state, source)[0]!) : undefined;
    const x = spot?.x ?? (this.keyPile < COLUMNS ? spotX(this.keyPile) : topX(this.keyPile - COLUMNS));
    const y = spot?.y ?? (this.keyPile < COLUMNS ? TAB_Y : TOP_Y);
    moveRing(this, this.ring, x, y);
  }

  /** The best move for a picked-up place, tap-style. */
  private moveFor(source: string): FreeCellMove | null {
    const [place] = source.split(':');
    return freeCellMoveFrom(this.state, place!, cardsAt(this.state, source).length);
  }

  private hit(x: number, y: number): { card: number; spot: Spot } | null {
    let best: { card: number; spot: Spot } | null = null;
    for (const [card, spot] of this.spots) {
      if (Math.abs(x - spot.x) > CW / 2 || Math.abs(y - spot.y) > CH / 2) continue;
      if (!best || spot.depth > best.spot.depth) best = { card, spot };
    }
    return best;
  }

  private press(x: number, y: number): void {
    if (this.state.result) return;
    const found = this.hit(x, y);
    if (found?.spot.blocked) {
      this.say('Not enough free cells for that many');
      return;
    }
    if (!found?.spot.source) return;
    const source = found.spot.source;
    const cards = cardsAt(this.state, source);
    cards.forEach((card, i) => {
      const view = this.views.get(card)!;
      stopSlide(this, view);
      view.box.setDepth(2000 + i);
    });
    this.drag = {
      from: source.split(':')[0]!,
      count: cards.length,
      cards,
      startX: x,
      startY: y,
      at: cards.map((card) => ({ x: this.views.get(card)!.box.x, y: this.views.get(card)!.box.y })),
      lastX: x,
      moved: false,
    };
  }

  private dragTo(x: number, y: number): void {
    const drag = this.drag;
    if (!drag) return;
    if (!drag.moved && Math.hypot(x - drag.startX, y - drag.startY) < DRAG_MIN) return;
    drag.moved = true;
    // The run follows the finger and leans a little in the direction it's moving.
    const tilt = Math.max(-10, Math.min(10, (x - drag.lastX) * 0.8));
    drag.lastX = x;
    drag.cards.forEach((card, i) => {
      const box = this.views.get(card)!.box;
      const at = drag.at[i]!;
      box.setPosition(at.x + x - drag.startX, at.y + y - drag.startY);
      box.setAngle(box.angle + (tilt - box.angle) * 0.35);
    });
  }

  private release(x: number, y: number): void {
    const drag = this.drag;
    this.drag = null;
    if (!drag) return;
    const play = drag.moved ? this.dropMove(drag, x, y) : freeCellMoveFrom(this.state, drag.from, drag.count);
    if (play && this.state.legalMoves(0).includes(play)) {
      this.session.play(play);
      return;
    }
    // Nowhere to go: slide back, and shake if it was a tap.
    this.sync(true);
    if (!drag.moved) this.shake(drag.cards[0]!);
  }

  /** The move a drop asks for: the place under the finger takes the run. */
  private dropMove(drag: Drag, x: number, y: number): FreeCellMove | null {
    const top = y < TOP_Y + CH / 2 + 16;
    // The top row leans away from the middle, so aim at where those places actually sit.
    const lean = top ? (x < W / 2 ? LEAN : -LEAN) : 0;
    const slot = Math.max(0, Math.min(COLUMNS - 1, Math.round((x + lean - GAP - CW / 2) / (CW + GAP))));
    const to = top ? (slot < CELLS ? `f${slot}` : `h${slot - CELLS}`) : `t${slot}`;
    if (to === drag.from) return null;
    return drag.count === 1 ? `c${drag.from}.${to}` : `c${drag.from}.${to}.${drag.count}`;
  }

  private shake(card: number): void {
    const box = this.views.get(card)!.box;
    this.tweens.add({ targets: box, angle: { from: -6, to: 6 }, duration: 60, yoyo: true, repeat: 2, onComplete: () => box.setAngle(0) });
  }

  /** Hint: the card that should move wiggles. */
  private pointAt(move: FreeCellMove): void {
    const from = move.slice(1).split('.')[0]!;
    const count = Number(move.split('.')[2] ?? 1) || 1;
    const cards = from[0] === 'f' ? [this.state.cells[Number(from.slice(1))]!] : this.state.columns[Number(from.slice(1))]!.slice(-count);
    cards.forEach((card) => this.shake(card));
  }

  /** Winning: the cards leap off the piles and bounce down the table, one after another. */
  private celebrate(): void {
    let i = 0;
    for (let rank = 13; rank >= 1; rank--) {
      for (let suit = 0; suit < 4; suit++) {
        const card = suit * 13 + rank - 1;
        const view = this.views.get(card)!;
        stopSlide(this, view);
        const box = view.box;
        const delay = 400 + i * 50;
        const drift = (jitter(card) - 0.5) * 560;
        box.setDepth(3000 + i);
        this.tweens.add({ targets: box, x: Math.max(CW / 2, Math.min(W - CW / 2, box.x + drift)), duration: 1100, delay, ease: 'Sine.easeOut' });
        this.tweens.add({ targets: box, y: H - CH / 2 - 6, duration: 1100, delay, ease: 'Bounce.easeOut' });
        this.tweens.add({ targets: box, angle: (jitter(card + 7) - 0.5) * 50, duration: 1100, delay });
        i++;
      }
    }
  }
}

export const freeCellStatus = (state: FreeCellState): string => {
  if (!state.result && state.legalMoves(0).every((play) => play === FREECELL_UNDO)) return 'No moves left. Undo, or start a new deal.';
  const home = state.foundations.reduce((sum, rank) => sum + rank, 0);
  const free = state.cells.filter((card) => card === null).length;
  return `${home} home · ${free} free ${free === 1 ? 'cell' : 'cells'}`;
};
