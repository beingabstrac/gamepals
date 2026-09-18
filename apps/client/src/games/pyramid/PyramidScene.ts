import {
  PAIR_TO,
  PYRAMID_CARDS,
  PYRAMID_DRAW,
  PYRAMID_PASSES,
  PYRAMID_REDEAL,
  PYRAMID_ROWS,
  PYRAMID_UNDO,
  PYRAMID_WASTE,
  rankOf,
  rowOfIndex,
  rowStart,
  type PyramidMove,
  type PyramidState,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import type { Session } from '../../session';
import { fitCamera, sharpText } from '../crisp';
import { drawSlot, jitter, makeCard, placeAt, setFace, slideTo, stopSlide, type CardView } from '../cards/view';
import { hintBusFor, type HintBus } from '../cards/hintBus';
import { focusRing, isPress, moveRing, onKeys } from '../keys';

const W = 760;
const H = 900;
export const PYRAMID_SIZE = { width: W, height: H };

const CW = 86;
const CH = 121;
/** Cards in a row sit half a card apart, so each one rests on the two below. */
const STEP_X = CW * 0.58;
const STEP_Y = CH * 0.42;
const TOP_Y = 24 + CH / 2;
const FOOT_Y = H - CH / 2 - 16;
const MOVE_MS = 200;
const TABLE = 0xffe6f2;
const SLOT = 0xf0a8ce;
const LIFT = 10;

const rowY = (row: number) => TOP_Y + row * STEP_Y;
const placeX = (row: number, place: number) => W / 2 + (place - row / 2) * STEP_X;
const DECK_X = W / 2 - CW * 0.8;
const WASTE_X = W / 2 + CW * 0.8;

interface Spot {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  /** The pyramid place this card is in, or null when it is in the deck or the waste. */
  readonly place: number | null;
  readonly free: boolean;
}

/** Where every card sits: the pyramid, the deck on the left, the waste on the right. */
function layout(state: PyramidState): Map<number, Spot> {
  const spots = new Map<number, Spot>();
  state.pyramid.forEach((card, i) => {
    if (card === null) return;
    const row = rowOfIndex(i);
    spots.set(card, { x: placeX(row, i - rowStart(row)), y: rowY(row), depth: 100 + i, place: i, free: state.free(i) });
  });
  state.stock.forEach((card, i) => spots.set(card, { x: DECK_X, y: FOOT_Y, depth: i, place: null, free: false }));
  state.waste.forEach((card, i) => {
    const top = i === state.waste.length - 1;
    spots.set(card, { x: WASTE_X + Math.min(2, state.waste.length - 1 - i) * -8, y: FOOT_Y, depth: 200 + i, place: null, free: top });
  });
  return spots;
}

export class PyramidScene extends Scene {
  private readonly bus: HintBus<PyramidMove>;
  private views = new Map<number, CardView>();
  private spots = new Map<number, Spot>();
  /** The card the player has picked up, by pyramid place, or 'w' for the waste top. */
  private picked: number | 'w' | null = null;
  private keyPlace = PYRAMID_CARDS - 1;
  private ring?: GameObjects.Graphics;
  private banner?: GameObjects.Text;
  private passText?: GameObjects.Text;

  constructor(private readonly session: Session<PyramidMove>) {
    super('pyramid');
    this.bus = hintBusFor(session);
  }

  private get state(): PyramidState {
    return this.session.state as PyramidState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.drawTable();
    for (let card = 0; card < 52; card++) {
      const view = makeCard(this, card, CW, CH);
      view.box.setPosition(DECK_X, FOOT_Y);
      this.views.set(card, view);
    }
    this.sync(true, true);

    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.press(p.worldX, p.worldY));
    // Keyboard: arrows walk the free cards, Enter picks one up, D turns a card.
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
    for (let row = 0; row < PYRAMID_ROWS; row++) {
      for (let place = 0; place <= row; place++) drawSlot(g, placeX(row, place), rowY(row), CW, CH, SLOT);
    }
    drawSlot(g, DECK_X, FOOT_Y, CW, CH, SLOT);
    drawSlot(g, WASTE_X, FOOT_Y, CW, CH, SLOT);
    sharpText(this, W / 2, FOOT_Y - CH / 2 - 18, 'Pairs that make 13', 24, '#c2568f').setDepth(4000);
    this.passText = sharpText(this, DECK_X, FOOT_Y + CH / 2 + 16, '', 22, '#c2568f').setDepth(4000);
    this.banner = sharpText(this, W / 2, FOOT_Y + CH / 2 + 16, '', 24, '#c2568f').setVisible(false).setDepth(4000);
  }

  private sync(animate: boolean, deal = false): void {
    const state = this.state;
    this.spots = layout(state);
    let order = 0;
    for (const [card, spot] of [...this.spots].sort((a, b) => a[1].depth - b[1].depth)) {
      const view = this.views.get(card)!;
      const box = view.box;
      box.setAngle(0).setScale(1);
      // The deck is face down; everything on the table is face up.
      setFace(view, spot.place !== null || spot.depth >= 200);
      const lift = this.liftFor(card, spot);
      const y = spot.y - lift;
      const moving = Math.abs(box.x - spot.x) > 0.5 || Math.abs(box.y - y) > 0.5;
      if (moving && animate) slideTo(this, view, spot.x, y, spot.depth, { duration: MOVE_MS, delay: deal ? order++ * 14 : 0 });
      else placeAt(view, spot.x, y, spot.depth);
      view.box.setVisible(true);
    }
    // Cards already taken leave the table.
    for (const [card, view] of this.views) if (!this.spots.has(card)) view.box.setVisible(false);
    this.passText?.setText(state.pass >= PYRAMID_PASSES ? 'Last pass' : `Pass ${state.pass} of ${PYRAMID_PASSES}`);
    this.banner?.setVisible(false);
    if (state.result && animate) this.celebrate();
    else if (this.ring?.visible) this.showKeyFocus();
  }

  /** A picked-up card, and every card that would pair with it, stand a little proud. */
  private liftFor(card: number, spot: Spot): number {
    if (this.picked === null || !spot.free) return 0;
    const pickedCard = this.pickedCard();
    if (pickedCard === null) return 0;
    if (card === pickedCard) return LIFT * 1.6;
    return rankOf(card) + rankOf(pickedCard) === PAIR_TO ? LIFT : 0;
  }

  private pickedCard(): number | null {
    const state = this.state;
    if (this.picked === 'w') return state.wasteTop;
    if (this.picked === null) return null;
    return state.pyramid[this.picked] ?? null;
  }

  private key(key: string): boolean {
    const state = this.state;
    if (state.result) return false;
    if (key === 'd' || key === 'D') {
      const move = state.legalMoves(0).includes(PYRAMID_DRAW) ? PYRAMID_DRAW : PYRAMID_REDEAL;
      if (state.legalMoves(0).includes(move)) this.session.play(move);
      return true;
    }
    if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown') {
      const open = this.freePlaces();
      if (!open.length) return true;
      const step = key === 'ArrowLeft' || key === 'ArrowUp' ? open.length - 1 : 1;
      const now = open.indexOf(this.keyPlace);
      this.keyPlace = open[(Math.max(0, now) + step) % open.length]!;
      this.showKeyFocus();
      return true;
    }
    if (isPress(key) && this.ring?.visible) {
      this.choose(this.keyPlace);
      return true;
    }
    return false;
  }

  private freePlaces(): number[] {
    const open: number[] = [];
    for (let i = 0; i < PYRAMID_CARDS; i++) if (this.state.free(i)) open.push(i);
    return open;
  }

  private showKeyFocus(): void {
    if (!this.ring) return;
    const card = this.state.pyramid[this.keyPlace];
    const spot = card === null || card === undefined ? undefined : this.spots.get(card);
    if (!spot) {
      const open = this.freePlaces();
      if (!open.length) return;
      this.keyPlace = open[0]!;
    }
    const next = this.state.pyramid[this.keyPlace];
    const where = next === null || next === undefined ? undefined : this.spots.get(next);
    moveRing(this, this.ring, where?.x ?? W / 2, where?.y ?? TOP_Y);
  }

  private press(x: number, y: number): void {
    const state = this.state;
    if (state.result) return;
    if (Math.abs(x - DECK_X) <= CW / 2 && Math.abs(y - FOOT_Y) <= CH / 2) {
      const moves = state.legalMoves(0);
      if (moves.includes(PYRAMID_DRAW)) this.session.play(PYRAMID_DRAW);
      else if (moves.includes(PYRAMID_REDEAL)) this.session.play(PYRAMID_REDEAL);
      else this.say('The deck is spent');
      return;
    }
    const found = this.hit(x, y);
    if (!found) return;
    if (found.spot.place === null) this.choose('w');
    else this.choose(found.spot.place);
  }

  /** Picks a card up, or takes the pair when one is already up. */
  private choose(place: number | 'w'): void {
    const state = this.state;
    const card = place === 'w' ? state.wasteTop : state.pyramid[place];
    if (card === null || card === undefined) return;
    if (place !== 'w' && !state.free(place)) {
      this.say('That card is still covered');
      return;
    }
    if (rankOf(card) === PAIR_TO) {
      this.play(place === 'w' ? PYRAMID_WASTE : `p${place}`);
      return;
    }
    if (this.picked === null || this.picked === place) {
      this.picked = this.picked === place ? null : place;
      this.sync(true);
      return;
    }
    const other = this.pickedCard();
    const picked = this.picked;
    if (other !== null && picked !== null && rankOf(other) + rankOf(card) === PAIR_TO) {
      const move =
        place === 'w' ? `p${picked}.w` : picked === 'w' ? `p${place}.w` : `p${Math.min(picked, place)}.${Math.max(picked, place)}`;
      this.play(move);
      return;
    }
    // Not a pair: pick up the new card instead.
    this.picked = place;
    this.sync(true);
  }

  private play(move: PyramidMove): void {
    this.picked = null;
    if (this.state.legalMoves(0).includes(move)) this.session.play(move);
    else this.sync(true);
  }

  private hit(x: number, y: number): { card: number; spot: Spot } | null {
    let best: { card: number; spot: Spot } | null = null;
    for (const [card, spot] of this.spots) {
      if (spot.place === null && spot.depth < 200) continue; // The deck is not a card you can take.
      if (Math.abs(x - spot.x) > CW / 2 || Math.abs(y - spot.y) > CH / 2) continue;
      if (!best || spot.depth > best.spot.depth) best = { card, spot };
    }
    return best;
  }

  private say(text: string): void {
    if (!this.banner) return;
    this.banner.setText(text).setVisible(true).setAlpha(1);
    this.tweens.add({ targets: this.banner, alpha: 0.3, duration: 220, yoyo: true, repeat: 2 });
  }

  /** Hint: the cards worth taking wiggle, or the deck does. */
  private pointAt(move: PyramidMove): void {
    const state = this.state;
    const cards: number[] = [];
    if (move === PYRAMID_DRAW || move === PYRAMID_REDEAL) {
      const top = state.stock[state.stock.length - 1] ?? state.waste[0];
      if (top !== undefined) cards.push(top);
    } else if (move === PYRAMID_WASTE) {
      const top = state.wasteTop;
      if (top !== null) cards.push(top);
    } else {
      for (const part of move.slice(1).split('.')) {
        const card = part === 'w' ? state.wasteTop : state.pyramid[Number(part)];
        if (card !== null && card !== undefined) cards.push(card);
      }
    }
    for (const card of cards) {
      const box = this.views.get(card)!.box;
      this.tweens.add({ targets: box, angle: { from: -7, to: 7 }, duration: 90, yoyo: true, repeat: 3, onComplete: () => box.setAngle(0) });
    }
  }

  /** Winning: the whole deck rains down the table. */
  private celebrate(): void {
    let i = 0;
    for (const [card, view] of this.views) {
      stopSlide(this, view);
      const box = view.box;
      box.setVisible(true).setDepth(3000 + i);
      const delay = 300 + i * 22;
      this.tweens.add({ targets: box, x: 40 + jitter(card) * (W - 80), duration: 1000, delay, ease: 'Sine.easeOut' });
      this.tweens.add({ targets: box, y: FOOT_Y, duration: 1000, delay, ease: 'Bounce.easeOut' });
      this.tweens.add({ targets: box, angle: (jitter(card + 3) - 0.5) * 80, duration: 1000, delay });
      i++;
    }
  }
}

export const pyramidStatus = (state: PyramidState): string => {
  if (!state.result && state.legalMoves(0).every((play) => play === PYRAMID_UNDO)) return 'No moves left. Undo, or start a new deal.';
  return `${state.left} of ${PYRAMID_CARDS} left`;
};
