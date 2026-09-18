import {
  coveredBy,
  nextTo,
  rankOf,
  rowOfPlace,
  TRIPEAKS_CARDS,
  TRIPEAKS_DRAW,
  TRIPEAKS_ROWS,
  TRIPEAKS_UNDO,
  type TriPeaksMove,
  type TriPeaksState,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import type { Session } from '../../session';
import { fitCamera, sharpText } from '../crisp';
import { drawSlot, flipTo, jitter, makeCard, placeAt, RANKS, setFace, slideTo, stopSlide, type CardView } from '../cards/view';
import { hintBusFor, type HintBus } from '../cards/hintBus';
import { focusRing, isPress, moveRing, onKeys } from '../keys';

const W = 820;
const H = 860;
export const TRIPEAKS_SIZE = { width: W, height: H };

const CW = 78;
const CH = 110;
const STEP_Y = CH * 0.36;
const TOP_Y = 22 + CH / 2;
const BASE_GAP = (W - 10 * CW) / 11;
const FOOT_Y = H - CH / 2 - 16;
const MOVE_MS = 190;
const TABLE = 0xd8f0e2;
const SLOT = 0x8ed0aa;
const LIFT = 9;
const DECK_X = W / 2 - CW * 0.85;
const WASTE_X = W / 2 + CW * 0.85;

/** The base row is a plain row of ten; the peaks above sit over the gaps between them. */
const baseX = (place: number) => BASE_GAP + place * (CW + BASE_GAP) + CW / 2;
function placeAtIndex(index: number): { x: number; y: number } {
  const row = rowOfPlace(index);
  if (row === TRIPEAKS_ROWS.length - 1) return { x: baseX(index - 18), y: TOP_Y + 3 * STEP_Y };
  // A card sits halfway between the two it rests on.
  const over = coveredBy(index)!;
  const left = placeAtIndex(over[0]);
  const right = placeAtIndex(over[1]);
  return { x: (left.x + right.x) / 2, y: TOP_Y + row * STEP_Y };
}

interface Spot {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  readonly up: boolean;
  /** The board place, or null for the deck and the waste. */
  readonly place: number | null;
  readonly takeable: boolean;
}

function layout(state: TriPeaksState): Map<number, Spot> {
  const spots = new Map<number, Spot>();
  state.board.forEach((card, i) => {
    if (card === null) return;
    const where = placeAtIndex(i);
    const free = state.free(i);
    spots.set(card, { x: where.x, y: where.y, depth: 100 + i, up: !state.down[i], place: i, takeable: free && nextTo(card, state.wasteTop) });
  });
  state.stock.forEach((card, i) => spots.set(card, { x: DECK_X, y: FOOT_Y, depth: i, up: false, place: null, takeable: false }));
  state.waste.forEach((card, i) => {
    spots.set(card, { x: WASTE_X + Math.min(3, state.waste.length - 1 - i) * -7, y: FOOT_Y, depth: 300 + i, up: true, place: null, takeable: false });
  });
  return spots;
}

export class TriPeaksScene extends Scene {
  private readonly bus: HintBus<TriPeaksMove>;
  private views = new Map<number, CardView>();
  private spots = new Map<number, Spot>();
  private keyPlace = TRIPEAKS_CARDS - 1;
  private ring?: GameObjects.Graphics;
  private banner?: GameObjects.Text;
  private runText?: GameObjects.Text;
  private deckText?: GameObjects.Text;

  constructor(private readonly session: Session<TriPeaksMove>) {
    super('tripeaks');
    this.bus = hintBusFor(session);
  }

  private get state(): TriPeaksState {
    return this.session.state as TriPeaksState;
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
    // Keyboard: arrows walk the cards that can be taken, Enter takes one, D turns a card.
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
    drawSlot(g, DECK_X, FOOT_Y, CW, CH, SLOT);
    drawSlot(g, WASTE_X, FOOT_Y, CW, CH, SLOT);
    this.deckText = sharpText(this, DECK_X, FOOT_Y - CH / 2 - 16, '', 22, '#3f9e73').setDepth(4000);
    this.runText = sharpText(this, WASTE_X, FOOT_Y - CH / 2 - 16, '', 22, '#3f9e73').setDepth(4000);
    this.banner = sharpText(this, W / 2, FOOT_Y + CH / 2 + 12, '', 24, '#3f9e73').setVisible(false).setDepth(4000);
  }

  private sync(animate: boolean, deal = false): void {
    const state = this.state;
    this.spots = layout(state);
    let order = 0;
    for (const [card, spot] of [...this.spots].sort((a, b) => a[1].depth - b[1].depth)) {
      const view = this.views.get(card)!;
      const box = view.box;
      box.setAngle(0);
      if (spot.up !== view.up) {
        // Cards are dealt already turned; a card uncovered in play turns over where it lies.
        if (animate && !deal) flipTo(this, view, spot.up, MOVE_MS * 0.4);
        else setFace(view, spot.up);
      } else box.setScale(1);
      // Cards you can take right now stand a little proud of the rest.
      const y = spot.y - (spot.takeable ? LIFT : 0);
      const moving = Math.abs(box.x - spot.x) > 0.5 || Math.abs(box.y - y) > 0.5;
      if (moving && animate) slideTo(this, view, spot.x, y, spot.depth, { duration: MOVE_MS, delay: deal ? order++ * 12 : 0 });
      else placeAt(view, spot.x, y, spot.depth);
      box.setVisible(true);
    }
    for (const [card, view] of this.views) if (!this.spots.has(card)) view.box.setVisible(false);
    this.deckText?.setText(state.stock.length ? `${state.stock.length} left` : 'Deck is out');
    this.runText?.setText(state.run > 1 ? `Run of ${state.run}` : '');
    this.banner?.setVisible(false);
    if (state.result && animate) this.celebrate();
    else if (this.ring?.visible) this.showKeyFocus();
  }

  private takeable(): number[] {
    const state = this.state;
    const list: number[] = [];
    for (let i = 0; i < TRIPEAKS_CARDS; i++) if (state.free(i) && nextTo(state.board[i]!, state.wasteTop)) list.push(i);
    return list;
  }

  private key(key: string): boolean {
    const state = this.state;
    if (state.result) return false;
    if (key === 'd' || key === 'D') {
      if (state.legalMoves(0).includes(TRIPEAKS_DRAW)) this.session.play(TRIPEAKS_DRAW);
      else this.say('Deck is out');
      return true;
    }
    if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown') {
      const open = this.takeable();
      if (!open.length) {
        this.say('Nothing to take. Turn a card.');
        return true;
      }
      const step = key === 'ArrowLeft' || key === 'ArrowUp' ? open.length - 1 : 1;
      const now = open.indexOf(this.keyPlace);
      this.keyPlace = open[(Math.max(0, now) + step) % open.length]!;
      this.showKeyFocus();
      return true;
    }
    if (isPress(key) && this.ring?.visible) {
      const open = this.takeable();
      if (open.includes(this.keyPlace)) this.session.play(`t${this.keyPlace}`);
      else if (open.length) {
        this.keyPlace = open[0]!;
        this.showKeyFocus();
      }
      return true;
    }
    return false;
  }

  private showKeyFocus(): void {
    if (!this.ring) return;
    const open = this.takeable();
    if (open.length && !open.includes(this.keyPlace)) this.keyPlace = open[0]!;
    const card = this.state.board[this.keyPlace];
    const spot = card === null || card === undefined ? undefined : this.spots.get(card);
    moveRing(this, this.ring, spot?.x ?? W / 2, spot?.y ?? TOP_Y);
  }

  private press(x: number, y: number): void {
    const state = this.state;
    if (state.result) return;
    if (Math.abs(x - DECK_X) <= CW / 2 && Math.abs(y - FOOT_Y) <= CH / 2) {
      if (state.legalMoves(0).includes(TRIPEAKS_DRAW)) this.session.play(TRIPEAKS_DRAW);
      else this.say('Deck is out');
      return;
    }
    const found = this.hit(x, y);
    if (!found || found.spot.place === null) return;
    const place = found.spot.place;
    if (!state.free(place)) {
      this.say('That card is still covered');
      return;
    }
    if (found.spot.takeable) this.session.play(`t${place}`);
    else {
      this.say(`Take a card one either side of ${this.faceOf(state.wasteTop)}`);
      this.shake(found.card);
    }
  }

  private faceOf(card: number): string {
    return RANKS[rankOf(card) - 1]!;
  }

  private hit(x: number, y: number): { card: number; spot: Spot } | null {
    let best: { card: number; spot: Spot } | null = null;
    for (const [card, spot] of this.spots) {
      if (spot.place === null) continue;
      if (Math.abs(x - spot.x) > CW / 2 || Math.abs(y - spot.y) > CH / 2) continue;
      if (!best || spot.depth > best.spot.depth) best = { card, spot };
    }
    return best;
  }

  private shake(card: number): void {
    const box = this.views.get(card)!.box;
    this.tweens.add({ targets: box, angle: { from: -6, to: 6 }, duration: 60, yoyo: true, repeat: 2, onComplete: () => box.setAngle(0) });
  }

  private say(text: string): void {
    if (!this.banner) return;
    this.banner.setText(text).setVisible(true).setAlpha(1);
    this.tweens.add({ targets: this.banner, alpha: 0.3, duration: 220, yoyo: true, repeat: 2 });
  }

  /** Hint: the card worth taking wiggles, or the deck does. */
  private pointAt(move: TriPeaksMove): void {
    const state = this.state;
    const card = move === TRIPEAKS_DRAW ? state.stock[state.stock.length - 1] : state.board[Number(move.slice(1))];
    if (card !== null && card !== undefined) this.shake(card);
  }

  /** Winning: the whole deck rains down the table. */
  private celebrate(): void {
    let i = 0;
    for (const [card, view] of this.views) {
      stopSlide(this, view);
      setFace(view, true);
      const box = view.box;
      box.setVisible(true).setDepth(3000 + i);
      const delay = 300 + i * 20;
      this.tweens.add({ targets: box, x: 40 + jitter(card) * (W - 80), duration: 1000, delay, ease: 'Sine.easeOut' });
      this.tweens.add({ targets: box, y: FOOT_Y, duration: 1000, delay, ease: 'Bounce.easeOut' });
      this.tweens.add({ targets: box, angle: (jitter(card + 9) - 0.5) * 80, duration: 1000, delay });
      i++;
    }
  }
}

export const triPeaksStatus = (state: TriPeaksState): string => {
  if (!state.result && state.legalMoves(0).every((play) => play === TRIPEAKS_UNDO)) return 'No moves left. Undo, or start a new deal.';
  if (state.run > 1) return `${state.left} left · run of ${state.run}`;
  return `${state.left} of ${TRIPEAKS_CARDS} left`;
};
