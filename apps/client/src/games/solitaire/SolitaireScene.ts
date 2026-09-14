import { bestMoveFrom, DRAW_MOVE, isRed, rankOf, suitOf, SUIT_SYMBOLS, type SolitaireMove, type SolitaireState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed } from '../../autoplay';
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
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
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

interface CardView {
  readonly box: GameObjects.Container;
  readonly front: GameObjects.Container;
  readonly back: GameObjects.Graphics;
  up: boolean;
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

/** Small repeatable wobble per card, so the win cascade looks lively without randomness. */
const jitter = (n: number) => ((Math.imul(n + 1, 0x9e3779b1) >>> 0) % 1000) / 1000;

export class SolitaireScene extends Scene {
  private readonly ui: SolitaireUi;
  private views = new Map<number, CardView>();
  private spots = new Map<number, Spot>();
  private drag: Drag | null = null;

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
    for (let card = 0; card < 52; card++) this.views.set(card, this.makeCard(card));
    // Deal: every card starts on the deck and flies out to its place.
    this.sync(true, true);

    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.press(p.worldX, p.worldY));
    this.input.on('pointermove', (p: { worldX: number; worldY: number; isDown: boolean }) => {
      if (p.isDown) this.dragTo(p.worldX, p.worldY);
    });
    this.input.on('pointerup', (p: { worldX: number; worldY: number }) => this.release(p.worldX, p.worldY));

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
    const slot = (x: number, y: number) => {
      g.lineStyle(3, SLOT, 1);
      g.strokeRoundedRect(x - CW / 2, y - CH / 2, CW, CH, 12);
    };
    slot(colX(0), TOP_Y);
    sharpText(this, colX(0), TOP_Y, '↻', 40, '#5fc796');
    for (let s = 0; s < 4; s++) {
      slot(colX(3 + s), TOP_Y);
      sharpText(this, colX(3 + s), TOP_Y, SUIT_SYMBOLS[s]!, 44, '#5fc796');
    }
    for (let c = 0; c < 7; c++) slot(colX(c), TAB_Y);
  }

  private makeCard(card: number): CardView {
    const shadow = this.add.graphics();
    shadow.fillStyle(0x2b2a3a, 0.14);
    shadow.fillRoundedRect(-CW / 2, -CH / 2 + 4, CW, CH, 12);

    const back = this.add.graphics();
    back.fillStyle(toHex(DARK.mint), 1);
    back.fillRoundedRect(-CW / 2, -CH / 2, CW, CH, 12);
    back.lineStyle(3, 0xffffff, 0.9);
    back.strokeRoundedRect(-CW / 2 + 7, -CH / 2 + 7, CW - 14, CH - 14, 8);
    back.fillStyle(0xffffff, 0.35);
    for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) back.fillCircle(-20 + col * 20, -36 + row * 24, 4);

    const color = isRed(card) ? COLORS.tomato : COLORS.ink;
    const rank = rankOf(card);
    const suit = SUIT_SYMBOLS[suitOf(card)]!;
    const face = this.add.graphics();
    face.fillStyle(0xffffff, 1);
    face.fillRoundedRect(-CW / 2, -CH / 2, CW, CH, 12);
    face.lineStyle(2, 0xdcd6ee, 1);
    face.strokeRoundedRect(-CW / 2, -CH / 2, CW, CH, 12);
    const parts: GameObjects.GameObject[] = [
      face,
      sharpText(this, -CW / 2 + 17, -CH / 2 + 19, RANKS[rank - 1]!, rank === 10 ? 22 : 27, color).setFontStyle('bold'),
      sharpText(this, -CW / 2 + 17, -CH / 2 + 43, suit, 20, color),
    ];
    if (rank > 10) {
      // Picture cards: the letter in a bubble of the suit's color.
      const bubble = this.add.graphics();
      bubble.fillStyle(toHex(color), 0.14);
      bubble.fillCircle(6, 16, 28);
      parts.push(bubble, sharpText(this, 6, 16, RANKS[rank - 1]!, 38, color).setFontStyle('bold'));
    } else {
      parts.push(sharpText(this, 6, 18, suit, 54, color));
    }
    const front = this.add.container(0, 0, parts);
    const box = this.add.container(colX(0), TOP_Y, [shadow, back, front]);
    front.setVisible(false);
    return { box, front, back, up: false };
  }

  private setFace(view: CardView, up: boolean): void {
    view.up = up;
    view.front.setVisible(up);
    view.back.setVisible(!up);
  }

  /** Moves every card to where the state says it belongs. */
  private sync(animate: boolean, deal = false): void {
    const state = this.state;
    this.spots = layout(state);
    let order = 0;
    for (const [card, spot] of [...this.spots].sort((a, b) => a[1].depth - b[1].depth)) {
      const view = this.views.get(card)!;
      const box = view.box;
      this.tweens.killTweensOf(box);
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
              this.setFace(view, spot.up);
              this.tweens.add({ targets: box, scaleX: 1, duration: 110, ease: 'Back.easeOut' });
            },
          });
        } else this.setFace(view, spot.up);
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
      } else {
        box.setPosition(spot.x, spot.y).setDepth(spot.depth);
      }
    }
    if (state.result && animate) this.celebrate();
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
    cards.forEach((card, i) => this.views.get(card)!.box.setDepth(2000 + i));
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
        const box = this.views.get(card)!.box;
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
