import {
  heartsPass,
  heartsPlay,
  heartsValue,
  PASS_COUNT,
  SUIT_SYMBOLS,
  suitOf,
  type HeartsMove,
  type HeartsState,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { makeCard, placeAt, setFace, slideTo, type CardView } from '../cards/view';
import { HandPrivacy } from '../cards/privacy';
import { labelReport, type LabelReport } from '../cards/labels';
import { focusRing, isPress, moveRing, onKeys } from '../keys';

const W = 800;
const H = 900;
export const HEARTS_SIZE = { width: W, height: H };

const CW = 82;
const CH = 116;
const TABLE = 0xffe3ea;
const MOVE_MS = 240;
const HAND_Y = H - CH / 2 - 40;
const MIDDLE = { x: W / 2, y: 400 };
/** Where each seat's card lands in the trick, clockwise from the player holding the phone. */
const TRICK_AT = [
  { x: 0, y: 110 },
  { x: -150, y: 0 },
  { x: 0, y: -110 },
  { x: 150, y: 0 },
];
const LIFT = 16;
/** The banner goes in the empty band between the trick and the hand, not over the far pile. */
const BANNER_Y = 600;
/** Seat labels: the two at the sides sit above their pile, which is what the table has room for. */
const SIDE_LABEL = { x: 76, y: 400 };

export const HEARTS_COLORS = [COLORS.tomato, COLORS.mint, COLORS.sunny, COLORS.sky];
export const HEARTS_NAMES = ['Red', 'Green', 'Yellow', 'Blue'];

interface Spot {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  readonly up: boolean;
  /** This card is in your hand and can be played or picked to pass. */
  readonly mine: boolean;
  readonly lift: number;
}

export class HeartsScene extends Scene {
  private privacy!: HandPrivacy;
  private views = new Map<number, CardView>();
  private spots = new Map<number, Spot>();
  /** The three cards picked to pass, while the passing lasts. */
  private picked: number[] = [];
  private seatText: GameObjects.Text[] = [];
  private banner?: GameObjects.Text;
  private passButton?: GameObjects.Container;
  private keyCard = 0;
  private ring?: GameObjects.Graphics;

  constructor(private readonly session: Session<HeartsMove>) {
    super('hearts');
  }

  private get state(): HeartsState {
    return this.session.state as HeartsState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    const g = this.add.graphics();
    g.fillStyle(TABLE, 1);
    g.fillRoundedRect(0, 0, W, H, 28);
    this.banner = sharpText(this, W / 2, BANNER_Y, '', 26, '#b3475f').setDepth(4000);
    // The other three seats, across the top and down the sides.
    const spots = [
      { x: W / 2, y: H - 20 },
      { x: SIDE_LABEL.x, y: SIDE_LABEL.y },
      { x: W / 2, y: 54 },
      { x: W - SIDE_LABEL.x, y: SIDE_LABEL.y },
    ];
    for (let seat = 0; seat < 4; seat++) {
      const side = seat === 1 || seat === 3;
      this.seatText.push(sharpText(this, spots[seat]!.x, spots[seat]!.y, '', side ? 17 : 21, '#b3475f').setDepth(4000));
    }
    for (let card = 0; card < 52; card++) {
      const view = makeCard(this, card, CW, CH);
      view.box.setPosition(MIDDLE.x, MIDDLE.y);
      this.views.set(card, view);
    }
    this.privacy = new HandPrivacy(this, this.session.seats, { x: W / 2, y: HAND_Y - 60, width: W - 48 });
    this.sync(false);

    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.press(p.worldX, p.worldY));
    this.ring = focusRing(this, CW + 12, CH + 12, 16);
    onKeys(this, (key) => this.key(key));
    const off = this.session.subscribe(() => this.onMove());
    this.events.once('shutdown', off);
  }

  /** Where the seat sits on screen, with the player holding the phone at the bottom. */
  private place(seat: number): number {
    return (seat - this.privacy.shown + 4) % 4;
  }

  private layout(): Map<number, Spot> {
    const state = this.state;
    const spots = new Map<number, Spot>();
    const mine = this.privacy.shown;
    const yours = this.privacy.open;

    state.hands.forEach((hand, seat) => {
      if (seat === mine) return;
      // Everybody else holds a fan of backs beside their name.
      const at = TRICK_AT[this.place(seat)]!;
      hand.forEach((card, i) =>
        spots.set(card, { x: MIDDLE.x + at.x * 1.9 + i * 3, y: MIDDLE.y + at.y * 1.9, depth: 100 + i, up: false, mine: false, lift: 0 }),
      );
    });
    // The trick in the middle, one card in front of whoever played it.
    state.trick.forEach((play, i) => {
      const at = TRICK_AT[this.place(play.seat)]!;
      spots.set(play.card, { x: MIDDLE.x + at.x, y: MIDDLE.y + at.y, depth: 400 + i, up: true, mine: false, lift: 0 });
    });

    const hand = state.hands[mine] ?? [];
    const step = Math.min(CW * 0.66, (W - CW - 40) / Math.max(1, hand.length - 1));
    const left = W / 2 - (step * (hand.length - 1)) / 2;
    const playable = yours && state.currentSeat === mine ? state.playable(mine) : [];
    hand.forEach((card, i) => {
      const canPlay = state.phase === 'pass' ? yours && state.currentSeat === mine : playable.includes(card);
      spots.set(card, {
        x: left + i * step,
        y: HAND_Y,
        depth: 300 + i,
        up: yours,
        mine: canPlay,
        lift: this.picked.includes(card) ? LIFT * 1.6 : canPlay ? LIFT * 0.4 : 0,
      });
    });
    return spots;
  }

  private onMove(): void {
    const state = this.state;
    this.privacy.turnChanged(state.currentSeat, state.result !== null);
    this.picked = [];
    const event = state.last;
    if (event?.kind === 'trick' || event?.kind === 'hand') {
      const who = this.session.seats[event.took!]?.label ?? 'They';
      this.say(event.points ? `${who} takes ${event.points}` : `${who} takes it`);
    } else if (event?.moon !== undefined) this.say(`${this.session.seats[event.moon]?.label} shot the moon!`);
    else if (event?.broke) this.say('Hearts are broken');
    this.sync(true);
  }

  private sync(animate: boolean): void {
    const state = this.state;
    this.spots = this.layout();
    for (const [card, spot] of [...this.spots].sort((a, b) => a[1].depth - b[1].depth)) {
      const view = this.views.get(card)!;
      setFace(view, spot.up);
      const y = spot.y - spot.lift;
      const moving = Math.abs(view.box.x - spot.x) > 0.5 || Math.abs(view.box.y - y) > 0.5;
      if (moving && animate) slideTo(this, view, spot.x, y, spot.depth, { duration: MOVE_MS });
      else placeAt(view, spot.x, y, spot.depth);
      view.box.setVisible(true);
    }
    for (const [card, view] of this.views) if (!this.spots.has(card)) view.box.setVisible(false);

    this.session.seats.forEach((seat, i) => {
      const you = i === this.privacy.shown && this.privacy.open;
      this.seatText[this.place(i)]?.setText(`${you ? 'You' : seat.label}: ${state.scores[i]} (+${state.taken[i]})`);
    });
    this.privacy.draw();
    this.drawPassButton();
    if (this.ring?.visible) this.showKeyFocus();
  }

  /** While passing, a button that sends the three cards on once they are picked. */
  private drawPassButton(): void {
    this.passButton?.destroy();
    this.passButton = undefined;
    const state = this.state;
    if (state.phase !== 'pass' || !this.privacy.open || state.currentSeat !== this.privacy.shown) return;
    const ready = this.picked.length === PASS_COUNT;
    const where = ['across', 'to the left', 'across', 'to the right'][state.passTo] ?? 'on';
    const panel = this.add.graphics();
    panel.fillStyle(ready ? toHex(DARK.tomato) : 0xe9d2d8, 1);
    panel.fillRoundedRect(-150, -34, 300, 68, 24);
    this.passButton = this.add
      .container(W / 2, HAND_Y - CH / 2 - 60, [
        panel,
        sharpText(this, 0, 0, ready ? `Pass ${where}` : `Pick ${PASS_COUNT - this.picked.length} more`, 26, ready ? '#ffffff' : '#9a7a84'),
      ])
      .setDepth(4500);
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
    if (state.phase === 'pass' && this.picked.length === PASS_COUNT && Math.abs(y - (HAND_Y - CH / 2 - 60)) < 40 && Math.abs(x - W / 2) < 150) {
      this.play(heartsPass(this.picked));
      return;
    }
    const found = this.hit(x, y);
    if (!found) return;
    if (!found.spot.mine) {
      if (state.phase === 'play' && state.currentSeat === this.privacy.shown) this.say(this.why(found.card));
      return;
    }
    if (state.phase === 'pass') {
      this.picked = this.picked.includes(found.card)
        ? this.picked.filter((card) => card !== found.card)
        : [...this.picked, found.card].slice(-PASS_COUNT);
      this.sync(true);
      return;
    }
    this.play(heartsPlay(found.card));
  }

  /** Why a card will not go, in the words somebody would use at a table. */
  private why(card: number): string {
    const state = this.state;
    const led = state.trick.length ? suitOf(state.trick[0]!.card) : null;
    if (led !== null && suitOf(card) !== led) return `Follow ${SUIT_SYMBOLS[led]}`;
    if (led === null && suitOf(card) === 1 && !state.broken) return 'Hearts are not broken yet';
    if (state.tricks.length === 0 && heartsValue(card) > 0) return 'No points on the first trick';
    return 'Not that one';
  }

  private play(move: HeartsMove): void {
    this.picked = [];
    if (this.state.legalMoves(this.state.currentSeat).includes(move)) this.session.play(move);
    else this.sync(true);
  }

  private hit(x: number, y: number): { card: number; spot: Spot } | null {
    let best: { card: number; spot: Spot } | null = null;
    for (const [card, spot] of this.spots) {
      if (spot.depth < 300 || spot.depth >= 400) continue;
      if (Math.abs(x - spot.x) > CW * 0.34 || Math.abs(y - (spot.y - spot.lift)) > CH / 2) continue;
      if (!best || spot.depth > best.spot.depth) best = { card, spot };
    }
    return best;
  }

  private mineNow(): number[] {
    const state = this.state;
    if (state.result || !this.privacy.open || state.currentSeat !== this.privacy.shown) return [];
    return state.phase === 'pass' ? [...(state.hands[this.privacy.shown] ?? [])] : state.playable(this.privacy.shown);
  }

  private key(key: string): boolean {
    if (this.privacy.lift()) {
      this.sync(true);
      return true;
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
      const card = open.includes(this.keyCard) ? this.keyCard : open[0]!;
      if (this.state.phase === 'pass') {
        this.picked = this.picked.includes(card) ? this.picked.filter((c) => c !== card) : [...this.picked, card].slice(-PASS_COUNT);
        if (this.picked.length === PASS_COUNT) this.play(heartsPass(this.picked));
        else this.sync(true);
        return true;
      }
      this.play(heartsPlay(card));
      return true;
    }
    return false;
  }

  private showKeyFocus(): void {
    if (!this.ring) return;
    const open = this.mineNow();
    if (open.length && !open.includes(this.keyCard)) this.keyCard = open[0]!;
    const spot = this.spots.get(this.keyCard);
    moveRing(this, this.ring, spot?.x ?? W / 2, (spot?.y ?? HAND_Y) - (spot?.lift ?? 0));
  }

  /** Test mode only: whether any seat label runs off the table or sits on a card. */
  labelCheck(): LabelReport {
    const cards = [...this.spots.values()].map((spot) => ({ x: spot.x, y: spot.y, w: CW, h: CH }));
    return labelReport(this.seatText, cards, W, H);
  }

  /** Test mode only: whose hand is on screen, whether it is covered, and how much of it shows. */
  handCheck(): { shown: number; covered: boolean; faceUp: number } {
    const mine = this.state.hands[this.privacy.shown] ?? [];
    return { shown: this.privacy.shown, covered: this.privacy.covered, faceUp: mine.filter((card) => this.views.get(card)?.up).length };
  }
}

export const heartsStatus = (state: HeartsState): string | undefined => {
  if (state.result) return undefined;
  if (state.phase === 'pass') return 'Pick three to pass';
  const low = Math.min(...state.scores);
  const leader = state.scores.indexOf(low);
  return state.broken ? `Hearts broken · ${HEARTS_NAMES[leader]} lowest` : `Hearts not broken yet`;
};
