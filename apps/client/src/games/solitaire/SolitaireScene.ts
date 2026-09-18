import { bestMoveFrom, DRAW_MOVE, suitOf, SUIT_SYMBOLS, type SolitaireMove, type SolitaireState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import type { Session } from '../../session';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed } from '../../autoplay';
import { drawSlot, jitter, makeCard, placeAt, setFace, slideTo, stopSlide, type CardView } from '../cards/view';
import { focusRing, isPress, moveRing, onKeys } from '../keys';
import { solitaireUiFor, type SolitaireUi } from './ui';

const W = 700;
const H = 1000;
export const SOLITAIRE_SIZE = { width: W, height: H };

const CW = 88;
const CH = 124;
const GAP = (W - 7 * CW) / 8;
const colX = (c: number) => GAP + c * (CW + GAP) + CW / 2;
const TOP_Y = 16 + CH / 2;
const TAB_Y = TOP_Y + CH + 26;
const DOWN_STEP = 18;
const UP_STEP = 38;
const MOVE_MS = 230;
const DRAG_MIN = 10;
const TABLE = 0xbdeed6;
const SLOT = 0x8fdcb6;

interface Spot {
  readonly x: number;
  readonly y: number;
  readonly up: boolean;
  readonly depth: number;
  /** Where this card can be picked up from, or null when it can't be. */
  readonly source: string | null;
}

interface Drag {
  readonly source: string;
  readonly cards: number[];
  readonly startX: number;
  readonly startY: number;
  readonly from: { x: number; y: number }[];
  lastX: number;
  moved: boolean;
}

/** Where every card sits for a given state. */
function layout(state: SolitaireState): Map<number, Spot> {
  const spots = new Map<number, Spot>();
  state.stock.forEach((card, i) => spots.set(card, { x: colX(0), y: TOP_Y, up: false, depth: i, source: null }));
  const fan = state.draw === 3 ? Math.min(3, state.waste.length) : 1;
  state.waste.forEach((card, i) => {
    const k = i - (state.waste.length - fan);
    const top = i === state.waste.length - 1;
    spots.set(card, { x: colX(1) + Math.max(0, k) * 24, y: TOP_Y, up: true, depth: 100 + i, source: top ? 'w' : null });
  });
  state.foundations.forEach((pile, s) =>
    pile.forEach((card, i) => spots.set(card, { x: colX(3 + s), y: TOP_Y, up: true, depth: 200 + i, source: i === pile.length - 1 ? `f${s}` : null })),
  );
  state.tableau.forEach((column, c) => {
    const steps = column.cards.slice(0, -1).map((_, i) => (i < column.down ? DOWN_STEP : UP_STEP));
    const total = steps.reduce((a, b) => a + b, 0);
    const room = H - 12 - CH / 2 - TAB_Y;
    const squeeze = total > room ? room / total : 1;
    let y = TAB_Y;
    column.cards.forEach((card, i) => {
      const up = i >= column.down;
      spots.set(card, { x: colX(c), y, up, depth: 300 + c * 30 + i, source: up ? `t${c}:${i}` : null });
      y += (steps[i] ?? 0) * squeeze;
    });
  });
  return spots;
}

export class SolitaireScene extends Scene {
  private readonly ui: SolitaireUi;
  private views = new Map<number, CardView>();
  private spots = new Map<number, Spot>();
  private drag: Drag | null = null;
  /** Keyboard focus: 0 is the waste, 1–7 are the columns; depth is where in a column's face-up run. */
  private keyPile = 1;
  private keyDepth: number | null = null;
  private ring?: GameObjects.Graphics;

  constructor(private readonly session: Session<SolitaireMove>) {
    super('solitaire');
    this.ui = solitaireUiFor(session);
  }

  private get state(): SolitaireState {
    return this.session.state as SolitaireState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.drawTable();
    for (let card = 0; card < 52; card++) this.views.set(card, this.newCardView(card));
    // Deal: every card starts on the deck and flies out to its place.
    this.sync(true, true);

    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.press(p.worldX, p.worldY));
    this.input.on('pointermove', (p: { worldX: number; worldY: number; isDown: boolean }) => {
      if (p.isDown) this.dragTo(p.worldX, p.worldY);
    });
    this.input.on('pointerup', (p: { worldX: number; worldY: number }) => this.release(p.worldX, p.worldY));

    // Keyboard: Left/Right pick a pile (the waste or a column), Up/Down pick how much of a column's run,
    // Enter or Space makes the best move for it, D draws.
    this.ring = focusRing(this, CW + 12, CH + 12, 16);
    onKeys(this, (key) => this.key(key));

    const offSession = this.session.subscribe(() => this.sync(true));
    const offHint = this.ui.onHint((move) => this.pointAt(move));
    this.events.once('shutdown', () => {
      offSession();
      offHint();
    });
  }

  private drawTable(): void {
    const g = this.add.graphics();
    g.fillStyle(TABLE, 1);
    g.fillRoundedRect(0, 0, W, H, 28);
    const slot = (x: number, y: number) => drawSlot(g, x, y, CW, CH, SLOT);
    slot(colX(0), TOP_Y);
    sharpText(this, colX(0), TOP_Y, '↻', 40, '#5fc796');
    for (let s = 0; s < 4; s++) {
      slot(colX(3 + s), TOP_Y);
      sharpText(this, colX(3 + s), TOP_Y, SUIT_SYMBOLS[s]!, 44, '#5fc796');
    }
    for (let c = 0; c < 7; c++) slot(colX(c), TAB_Y);
  }

  private newCardView(card: number): CardView {
    const view = makeCard(this, card, CW, CH);
    view.box.setPosition(colX(0), TOP_Y);
    return view;
  }

  /** Moves every card to where the state says it belongs. */
  private sync(animate: boolean, deal = false): void {
    const state = this.state;
    this.spots = layout(state);
    let order = 0;
    for (const [card, spot] of [...this.spots].sort((a, b) => a[1].depth - b[1].depth)) {
      const view = this.views.get(card)!;
      const box = view.box;
      box.setAngle(0);
      const moving = Math.abs(box.x - spot.x) > 0.5 || Math.abs(box.y - spot.y) > 0.5;
      const delay = deal && spot.depth >= 300 ? order++ * 28 : 0;
      if (spot.up !== view.up) {
        if (animate) {
          // Flip: squeeze to an edge, swap faces, open back up.
          this.tweens.add({
            targets: box,
            scaleX: 0,
            duration: 90,
            delay: delay + (moving ? MOVE_MS * 0.5 : 0),
            onComplete: () => {
              setFace(view, spot.up);
              this.tweens.add({ targets: box, scaleX: 1, duration: 110, ease: 'Back.easeOut' });
            },
          });
        } else setFace(view, spot.up);
      } else box.setScale(1);
      if (moving && animate) slideTo(this, view, spot.x, spot.y, spot.depth, { duration: MOVE_MS, delay });
      else placeAt(view, spot.x, spot.y, spot.depth);
    }
    if (state.result && animate) this.celebrate();
    else if (this.ring?.visible) this.showKeyFocus();
  }

  private key(key: string): boolean {
    const state = this.state;
    if (state.result) return false;
    if (key === 'd' || key === 'D') {
      this.session.play(DRAW_MOVE);
      return true;
    }
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      this.keyPile = (this.keyPile + (key === 'ArrowLeft' ? 7 : 1)) % 8;
      this.keyDepth = null;
      this.showKeyFocus();
      return true;
    }
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      const column = this.keyPile > 0 ? state.tableau[this.keyPile - 1] : undefined;
      if (column && column.cards.length > column.down) {
        // Up takes more of the run (starts deeper), Down takes less.
        const start = this.keyDepth ?? column.down;
        this.keyDepth = Math.min(column.cards.length - 1, Math.max(column.down, start + (key === 'ArrowUp' ? -1 : 1)));
      }
      this.showKeyFocus();
      return true;
    }
    if (isPress(key) && this.ring?.visible) {
      const source = this.keySource();
      const move = source ? bestMoveFrom(state, source) : null;
      if (move) this.session.play(move);
      else if (source) {
        const box = this.views.get(state.cardsAt(source)[0]!)!.box;
        this.tweens.add({ targets: box, angle: { from: -6, to: 6 }, duration: 60, yoyo: true, repeat: 2, onComplete: () => box.setAngle(0) });
      }
      return true;
    }
    return false;
  }

  /** The pick-up spot under the keyboard focus, or null when that pile has nothing to give. */
  private keySource(): string | null {
    const state = this.state;
    if (this.keyPile === 0) return state.waste.length ? 'w' : null;
    const column = state.tableau[this.keyPile - 1]!;
    if (column.cards.length <= column.down) return null;
    const index = Math.min(column.cards.length - 1, Math.max(column.down, this.keyDepth ?? column.down));
    return `t${this.keyPile - 1}:${index}`;
  }

  private showKeyFocus(): void {
    if (!this.ring) return;
    const source = this.keySource();
    const card = source ? this.state.cardsAt(source)[0] : undefined;
    const spot = card === undefined ? undefined : this.spots.get(card);
    const x = spot?.x ?? (this.keyPile === 0 ? colX(1) : colX(this.keyPile - 1));
    const y = spot?.y ?? (this.keyPile === 0 ? TOP_Y : TAB_Y);
    moveRing(this, this.ring, x, y);
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
    const onDeck = Math.abs(x - colX(0)) <= CW / 2 && Math.abs(y - TOP_Y) <= CH / 2;
    if (onDeck) {
      this.session.play(DRAW_MOVE);
      return;
    }
    const found = this.hit(x, y);
    if (!found?.spot.source) return;
    const source = found.spot.source;
    const cards = this.state.cardsAt(source);
    cards.forEach((card, i) => {
      const view = this.views.get(card)!;
      stopSlide(this, view);
      view.box.setDepth(2000 + i);
    });
    this.drag = {
      source,
      cards,
      startX: x,
      startY: y,
      from: cards.map((card) => ({ x: this.views.get(card)!.box.x, y: this.views.get(card)!.box.y })),
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
      const from = drag.from[i]!;
      box.setPosition(from.x + x - drag.startX, from.y + y - drag.startY);
      box.setAngle(box.angle + (tilt - box.angle) * 0.35);
    });
  }

  private release(x: number, y: number): void {
    const drag = this.drag;
    this.drag = null;
    if (!drag) return;
    const state = this.state;
    let move: SolitaireMove | null;
    if (!drag.moved) move = bestMoveFrom(state, drag.source);
    else move = this.dropMove(drag.source, drag.cards[0]!, x, y);
    if (move && state.legalMoves(0).includes(move)) {
      this.session.play(move);
      return;
    }
    // Nowhere to go: slide back and give a small shake.
    this.sync(true);
    const first = this.views.get(drag.cards[0]!)!.box;
    if (!drag.moved) this.tweens.add({ targets: first, angle: { from: -6, to: 6 }, duration: 60, yoyo: true, repeat: 2, onComplete: () => first.setAngle(0) });
  }

  private dropMove(source: string, head: number, x: number, y: number): SolitaireMove | null {
    const col = Math.max(0, Math.min(6, Math.round((x - GAP - CW / 2) / (CW + GAP))));
    if (y < TOP_Y + CH / 2 + 13) return col >= 3 ? `${source}>f${suitOf(head)}` : null;
    return `${source}>t${col}`;
  }

  /** Hint: the card to move wiggles (or the deck, when drawing is the best move). */
  private pointAt(move: SolitaireMove): void {
    const source = move === DRAW_MOVE ? null : move.split('>')[0]!;
    const cards = source ? this.state.cardsAt(source) : this.state.stock.slice(-1);
    for (const card of cards) {
      const box = this.views.get(card)!.box;
      this.tweens.add({ targets: box, angle: { from: -7, to: 7 }, duration: 90, yoyo: true, repeat: 3, onComplete: () => box.setAngle(0) });
    }
  }

  /** Winning: the cards leap off the piles and bounce down the table, one after another. */
  private celebrate(): void {
    let i = 0;
    for (let rank = 13; rank >= 1; rank--) {
      for (let s = 0; s < 4; s++) {
        const card = s * 13 + rank - 1;
        const view = this.views.get(card)!;
        stopSlide(this, view);
        const box = view.box;
        const delay = 400 + i * 55;
        const drift = (jitter(card) - 0.5) * 520;
        box.setDepth(3000 + i);
        this.tweens.add({ targets: box, x: Math.max(CW / 2, Math.min(W - CW / 2, box.x + drift)), duration: 1100, delay, ease: 'Sine.easeOut' });
        this.tweens.add({ targets: box, y: H - CH / 2 - 6, duration: 1100, delay, ease: 'Bounce.easeOut' });
        this.tweens.add({ targets: box, angle: (jitter(card + 7) - 0.5) * 50, duration: 1100, delay });
        i++;
      }
    }
  }
}
