import {
  cardLabel,
  meldsIn,
  rummyDiscard,
  rummyDrawDiscard,
  rummyDrawStock,
  rummyLayOff,
  rummyMeld,
  handValue,
  type RummyMove,
  type RummyState,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { slotFill, tableFill, tableInk } from '../../look';
import { applySpeed } from '../../autoplay';
import type { Session } from '../../session';
import { COLORS, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { drawSlot, makeCard, placeAt, setFace, slideTo, type CardView } from '../cards/view';
import { HandPrivacy } from '../cards/privacy';
import { labelReport, type LabelReport } from '../cards/labels';
import { focusRing, isPress, moveRing, onKeys } from '../keys';

const W = 780;
const H = 860;
export const RUMMY_SIZE = { width: W, height: H };

const CW = 78;
const CH = 110;
const MELD_CW = 54;
const MELD_CH = 76;
const TABLE = tableFill(0xdff0f6);
const SLOT = slotFill(0x9cc8d9);
const MOVE_MS = 220;
const HAND_Y = H - CH / 2 - 74;
const PILE_Y = 300;
/** The deck and the pile go down the left, so the melds get the width they need. */
const DECK_X = 92;
const PILE_X = 196;
/** Melds laid on the table fill the space beside the piles, in rows. */
const MELDS_LEFT = 268;
const MELDS_TOP = 296;
const MELD_ROW = 80;
const BUTTON_Y = 620;
export const RUMMY_COLORS = [COLORS.sky, COLORS.tomato, COLORS.mint, COLORS.sunny];
export const RUMMY_NAMES = ['Blue', 'Red', 'Green', 'Yellow'];

interface Spot {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  readonly up: boolean;
  readonly small: boolean;
  /** Your own card on your turn: tapping it throws it, or lays it off when it fits. */
  readonly mine: boolean;
}

interface Button {
  readonly label: string;
  readonly move: RummyMove;
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

export class RummyScene extends Scene {
  private privacy!: HandPrivacy;
  private views = new Map<number, CardView>();
  private spots = new Map<number, Spot>();
  private seatText: GameObjects.Text[] = [];
  private deckText?: GameObjects.Text;
  private countText?: GameObjects.Text;
  private banner?: GameObjects.Text;
  private buttonRow?: GameObjects.Container;
  private buttons: Button[] = [];
  private keyCard = 0;
  private ring?: GameObjects.Graphics;

  constructor(private readonly session: Session<RummyMove>) {
    super('rummy');
  }

  private get state(): RummyState {
    return this.session.state as RummyState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    const g = this.add.graphics();
    g.fillStyle(TABLE, 1);
    g.fillRoundedRect(0, 0, W, H, 28);
    drawSlot(g, DECK_X, PILE_Y, CW, CH, SLOT);
    drawSlot(g, PILE_X, PILE_Y, CW, CH, SLOT);
    this.deckText = sharpText(this, DECK_X, PILE_Y + CH / 2 + 18, '', 19, tableInk('#2c6c83')).setDepth(4000);
    this.banner = sharpText(this, W / 2, 28, '', 22, tableInk('#2c6c83')).setDepth(4000);
    this.countText = sharpText(this, W / 2, H - 26, '', 21, tableInk('#2c6c83')).setDepth(4000);
    const seats = this.session.seats.length;
    for (let seat = 0; seat < seats; seat++) {
      this.seatText.push(sharpText(this, (W / (seats + 1)) * (seat + 1), 68, '', 18, tableInk('#2c6c83')).setDepth(4000));
    }
    for (let card = 0; card < 52; card++) {
      const view = makeCard(this, card, CW, CH);
      view.box.setPosition(DECK_X, PILE_Y);
      this.views.set(card, view);
    }
    this.privacy = new HandPrivacy(this, this.session.seats, { x: W / 2, y: HAND_Y - 58, width: W - 48 });
    this.sync(false);

    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.press(p.worldX, p.worldY));
    this.ring = focusRing(this, CW + 12, CH + 12, 16);
    onKeys(this, (key) => this.key(key));
    const off = this.session.subscribe(() => this.onMove());
    this.events.once('shutdown', off);
  }

  private layout(): Map<number, Spot> {
    const state = this.state;
    const spots = new Map<number, Spot>();
    const mine = this.privacy.shown;
    const yours = this.privacy.open;

    state.stock.forEach((card, i) => spots.set(card, { x: DECK_X, y: PILE_Y, depth: i, up: false, small: false, mine: false }));
    state.discard.forEach((card, i) => {
      const deep = state.discard.length - 1 - i;
      spots.set(card, { x: PILE_X + Math.min(3, deep) * -4, y: PILE_Y, depth: 150 + i, up: true, small: false, mine: false });
    });
    // Everybody else's cards sit face down under their name.
    state.hands.forEach((hand, seat) => {
      if (seat === mine) return;
      const x = (W / (state.hands.length + 1)) * (seat + 1);
      hand.forEach((card, i) => spots.set(card, { x: x + i * 5 - hand.length * 2.5, y: 146, depth: 100 + i, up: false, small: false, mine: false }));
    });
    // The melds on the table, in rows, laid out small.
    let row = 0;
    let used = 0;
    state.table.forEach((meld) => {
      const width = meld.cards.length * (MELD_CW * 0.8) + 26;
      if (used + width > W - MELDS_LEFT - 24) {
        row++;
        used = 0;
      }
      meld.cards.forEach((card, i) => {
        spots.set(card, {
          x: MELDS_LEFT + used + i * MELD_CW * 0.8,
          y: MELDS_TOP + row * MELD_ROW,
          depth: 200 + i,
          up: true,
          small: true,
          mine: false,
        });
      });
      used += width;
    });

    const hand = state.hands[mine] ?? [];
    const step = Math.min(CW * 0.72, (W - CW - 40) / Math.max(1, hand.length - 1));
    const left = W / 2 - (step * (hand.length - 1)) / 2;
    const playable = yours && state.phase === 'play' && state.currentSeat === mine;
    hand.forEach((card, i) => {
      spots.set(card, { x: left + i * step, y: HAND_Y, depth: 300 + i, up: yours, small: false, mine: playable });
    });
    return spots;
  }

  private onMove(): void {
    const state = this.state;
    this.privacy.turnChanged(state.currentSeat, state.result !== null);
    const event = state.last;
    const who = (seat?: number) => this.session.seats[seat ?? 0]?.label ?? 'They';
    if (event?.kind === 'hand') {
      if (!event.scored?.some((points) => points > 0)) this.say('The cards ran out, so nobody scores');
      else this.say(`${who(event.seat)} is out${event.rummy ? ' with a rummy' : ''}: ${Math.max(...event.scored)}`);
    } else if (event?.kind === 'meld') {
      this.say(`${who(event.seat)} puts down ${(event.cards ?? []).map(cardLabel).join(' ')}`);
    } else if (event?.kind === 'layoff') {
      this.say(`${who(event.seat)} adds ${cardLabel(event.card ?? 0)}`);
    }
    this.sync(true);
  }

  private sync(animate: boolean): void {
    const state = this.state;
    this.spots = this.layout();
    for (const [card, spot] of [...this.spots].sort((a, b) => a[1].depth - b[1].depth)) {
      const view = this.views.get(card)!;
      setFace(view, spot.up);
      view.box.setScale(spot.small ? MELD_CW / CW : 1);
      const moving = Math.abs(view.box.x - spot.x) > 0.5 || Math.abs(view.box.y - spot.y) > 0.5;
      if (moving && animate) slideTo(this, view, spot.x, spot.y, spot.depth, { duration: MOVE_MS });
      else placeAt(view, spot.x, spot.y, spot.depth);
      view.box.setVisible(true);
    }
    for (const [card, view] of this.views) if (!this.spots.has(card)) view.box.setVisible(false);

    this.deckText?.setText(`${state.stock.length} left`);
    this.session.seats.forEach((seat, i) => {
      const you = i === this.privacy.shown && this.privacy.open;
      this.seatText[i]?.setText(you ? '' : `${seat.label} ${state.scores[i]} · ${state.counts[i]} cards`);
    });
    const mine = this.privacy.shown;
    this.countText?.setText(
      this.privacy.open ? `You ${state.scores[mine]} · holding ${handValue(state.hands[mine] ?? [])}` : '',
    );
    this.privacy.draw();
    this.drawButtons();
    if (this.ring?.visible) this.showKeyFocus();
  }

  /** The melds this hand can put down, as buttons. Nobody drags cards around. */
  private choices(): Button[] {
    const state = this.state;
    const mine = this.privacy.shown;
    if (state.result || !this.privacy.open || state.currentSeat !== mine) return [];
    if (state.phase !== 'play') return [];
    const hand = state.hands[mine] ?? [];
    const legal = state.legalMoves(mine);
    const melds = meldsIn(hand).filter((meld) => legal.includes(rummyMeld(meld)));
    // The longest melds first, and at most three buttons, so the row never runs off the table.
    // Two buttons at most: a third would sit on the melds already on the table.
    const best = melds.sort((a, b) => b.length - a.length).slice(0, 2);
    return best.map((meld, i) => {
      const label = `Put down ${meld.map(cardLabel).join(' ')}`;
      const width = Math.min(360, 60 + label.length * 10);
      return { label, move: rummyMeld(meld), x: W / 2, y: BUTTON_Y - i * 56, width };
    });
  }

  private drawButtons(): void {
    this.buttonRow?.destroy();
    this.buttonRow = undefined;
    this.buttons = this.choices();
    if (!this.buttons.length) return;
    const parts: GameObjects.GameObject[] = [];
    for (const button of this.buttons) {
      const chip = this.add.graphics();
      chip.fillStyle(toHex(COLORS.mint), 1);
      chip.fillRoundedRect(button.x - button.width / 2, button.y - 22, button.width, 44, 22);
      parts.push(chip, sharpText(this, button.x, button.y, button.label, 19, '#ffffff'));
    }
    this.buttonRow = this.add.container(0, 0, parts).setDepth(4500);
  }

  private say(text: string): void {
    if (!this.banner) return;
    this.banner.setText(text).setAlpha(1);
    this.tweens.add({ targets: this.banner, alpha: 0.4, duration: 300, yoyo: true, repeat: 1 });
  }

  private press(x: number, y: number): void {
    if (this.privacy.lift()) {
      this.sync(true);
      return;
    }
    const state = this.state;
    if (state.result) return;
    for (const button of this.buttons) {
      if (Math.abs(x - button.x) <= button.width / 2 && Math.abs(y - button.y) <= 22) {
        this.play(button.move);
        return;
      }
    }
    if (state.currentSeat !== this.privacy.shown || !this.privacy.open) return;
    if (state.phase === 'draw') {
      if (Math.abs(y - PILE_Y) > CH / 2) return;
      if (Math.abs(x - DECK_X) <= CW / 2) this.play(rummyDrawStock);
      else if (Math.abs(x - PILE_X) <= CW / 2) this.play(rummyDrawDiscard);
      return;
    }
    const found = this.hit(x, y);
    if (!found || !found.spot.mine) return;
    this.play(this.moveFor(found.card));
  }

  /** A tap on your own card lays it off where it fits, and throws it away when it does not. */
  private moveFor(card: number): RummyMove {
    const state = this.state;
    const legal = state.legalMoves(this.privacy.shown);
    const layoff = state.table.findIndex((_, i) => legal.includes(rummyLayOff(i, card)));
    return layoff >= 0 ? rummyLayOff(layoff, card) : rummyDiscard(card);
  }

  private play(move: RummyMove): void {
    if (this.state.legalMoves(this.state.currentSeat).includes(move)) this.session.play(move);
    else this.sync(true);
  }

  private hit(x: number, y: number): { card: number; spot: Spot } | null {
    let best: { card: number; spot: Spot } | null = null;
    for (const [card, spot] of this.spots) {
      if (spot.depth < 300) continue;
      if (Math.abs(x - spot.x) > CW * 0.36 || Math.abs(y - spot.y) > CH / 2) continue;
      if (!best || spot.depth > best.spot.depth) best = { card, spot };
    }
    return best;
  }

  private mineNow(): number[] {
    const state = this.state;
    if (state.result || !this.privacy.open || state.currentSeat !== this.privacy.shown || state.phase !== 'play') return [];
    return [...(state.hands[this.privacy.shown] ?? [])];
  }

  private key(key: string): boolean {
    if (this.privacy.lift()) {
      this.sync(true);
      return true;
    }
    const state = this.state;
    if (state.result) return false;
    if (state.phase === 'draw' && this.privacy.open && state.currentSeat === this.privacy.shown) {
      if (key === 'ArrowLeft' || key === '1') {
        this.play(rummyDrawStock);
        return true;
      }
      if (key === 'ArrowRight' || key === '2' || isPress(key)) {
        this.play(rummyDrawDiscard);
        return true;
      }
      return false;
    }
    // Melds answer to the number keys, in the order the buttons are stacked.
    if (this.buttons.length && key >= '1' && key <= '2') {
      const button = this.buttons[Number(key) - 1];
      if (button) {
        this.play(button.move);
        return true;
      }
    }
    const open = this.mineNow();
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      if (!open.length) return true;
      const now = open.indexOf(this.keyCard);
      const step = key === 'ArrowLeft' ? open.length - 1 : 1;
      this.keyCard = open[(Math.max(0, now) + step) % open.length]!;
      this.showKeyFocus();
      return true;
    }
    if (isPress(key) && this.ring?.visible) {
      if (!open.length) return true;
      this.play(this.moveFor(open.includes(this.keyCard) ? this.keyCard : open[0]!));
      return true;
    }
    return false;
  }

  private showKeyFocus(): void {
    if (!this.ring) return;
    const open = this.mineNow();
    if (open.length && !open.includes(this.keyCard)) this.keyCard = open[0]!;
    const spot = this.spots.get(this.keyCard);
    moveRing(this, this.ring, spot?.x ?? W / 2, spot?.y ?? HAND_Y);
  }

  /** Test mode only: whether any label runs off the table or sits on a card. */
  labelCheck(): LabelReport {
    const cards = [...this.spots.values()].map((spot) => ({
      x: spot.x,
      y: spot.y,
      w: spot.small ? MELD_CW : CW,
      h: spot.small ? MELD_CH : CH,
    }));
    const extra = [this.countText, this.deckText, this.banner].filter((text): text is GameObjects.Text => !!text);
    return labelReport([...this.seatText, ...extra], cards, W, H);
  }

  /** Test mode only: whose hand is on screen, whether it is covered, and how much of it shows. */
  handCheck(): { shown: number; covered: boolean; faceUp: number } {
    const mine = this.state.hands[this.privacy.shown] ?? [];
    return { shown: this.privacy.shown, covered: this.privacy.covered, faceUp: mine.filter((card) => this.views.get(card)?.up).length };
  }
}

export const rummyStatus = (state: RummyState): string | undefined => {
  if (state.result) return undefined;
  if (state.phase === 'draw') return 'Take a card from the deck or the pile';
  return 'Put melds down, then throw one away';
};

export const rummyResult = (state: RummyState): string | undefined => {
  if (!state.result) return undefined;
  if (state.scores.every((score) => score === 0)) return 'The cards ran out. Nobody scores.';
  return undefined;
};
