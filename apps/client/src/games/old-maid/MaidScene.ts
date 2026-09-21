import { MAID_QUEEN, rankOf, takeMove, type MaidMove, type MaidState } from '@gamepals/rules';
import { playerName } from '../../outcome';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import type { Session } from '../../session';
import { COLORS } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { makeCard, placeAt, RANKS, setFace, slideTo, stopSlide, type CardView } from '../cards/view';
import { labelReport, type LabelReport } from '../cards/labels';
import { HandPrivacy } from '../cards/privacy';
import { focusRing, isPress, moveRing, onKeys } from '../keys';

const W = 760;
const H = 820;
export const MAID_SIZE = { width: W, height: H };

const CW = 80;
const CH = 113;
const TABLE = 0xf5e6ff;
const MOVE_MS = 230;
const HAND_Y = H - CH / 2 - 34;
const OFFER_Y = 250;
const LIFT = 16;
export const MAID_COLORS = [COLORS.grape, COLORS.mint, COLORS.sunny, COLORS.tomato];
export const MAID_NAMES = ['Purple', 'Green', 'Yellow', 'Red'];

interface Spot {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  readonly up: boolean;
  /** The place in the offered fan this card sits in, when it is there to be taken. */
  readonly pick: number | null;
}

export class MaidScene extends Scene {
  private privacy!: HandPrivacy;
  private views = new Map<number, CardView>();
  private spots = new Map<number, Spot>();
  private seatText: GameObjects.Text[] = [];
  private banner?: GameObjects.Text;
  private offerText?: GameObjects.Text;
  private keyPick = 0;
  private ring?: GameObjects.Graphics;

  constructor(private readonly session: Session<MaidMove>) {
    super('old-maid');
  }

  private get state(): MaidState {
    return this.session.state as MaidState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    const g = this.add.graphics();
    g.fillStyle(TABLE, 1);
    g.fillRoundedRect(0, 0, W, H, 28);
    this.offerText = sharpText(this, W / 2, OFFER_Y - CH / 2 - 26, '', 24, '#7a4dae').setDepth(4000);
    this.banner = sharpText(this, W / 2, OFFER_Y + CH / 2 + 30, '', 26, '#7a4dae').setDepth(4000);
    const seats = this.session.seats.length;
    for (let seat = 0; seat < seats; seat++) {
      this.seatText.push(sharpText(this, (W / (seats + 1)) * (seat + 1), 30, '', 21, '#7a4dae').setDepth(4000));
    }
    for (let card = 0; card < 52; card++) {
      const view = makeCard(this, card, CW, CH);
      view.box.setPosition(W / 2, OFFER_Y);
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

  /** Where every card sits: your hand at the bottom, the offered fan in the middle, the rest away. */
  private layout(): Map<number, Spot> {
    const state = this.state;
    const spots = new Map<number, Spot>();
    const seats = state.hands.length;
    const offering = state.offering;
    const yours = this.privacy.open;
    const mine = this.privacy.shown;

    state.hands.forEach((hand, seat) => {
      if (seat === mine) return;
      if (seat === offering && !state.result) {
        // The fan being held out: face down, and every card in it can be taken.
        const step = Math.min(CW * 0.66, (W - CW - 60) / Math.max(1, hand.length - 1));
        const left = W / 2 - (step * (hand.length - 1)) / 2;
        hand.forEach((card, i) => spots.set(card, { x: left + i * step, y: OFFER_Y, depth: 200 + i, up: false, pick: i }));
        return;
      }
      const x = (W / (seats + 1)) * (seat + 1);
      hand.forEach((card, i) => spots.set(card, { x: x + i * 4 - hand.length * 2, y: 112, depth: 100 + i, up: false, pick: null }));
    });

    const hand = state.hands[mine] ?? [];
    const step = Math.min(CW * 0.7, (W - CW - 40) / Math.max(1, hand.length - 1));
    const left = W / 2 - (step * (hand.length - 1)) / 2;
    hand.forEach((card, i) => spots.set(card, { x: left + i * step, y: HAND_Y, depth: 300 + i, up: yours, pick: null }));
    return spots;
  }

  private onMove(): void {
    const state = this.state;
    this.privacy.turnChanged(state.currentSeat, state.result !== null);
    const event = state.last;
    if (event) {
      if (event.paired) this.say(`Pair of ${RANKS[event.paired - 1]}s`);
      else if (event.out.length) this.say(`${this.session.seats[event.out[0]!]?.label ?? 'They'} are out`);
      else this.say('');
    }
    this.sync(true);
  }

  private sync(animate: boolean): void {
    const state = this.state;
    this.spots = this.layout();
    for (const [card, spot] of [...this.spots].sort((a, b) => a[1].depth - b[1].depth)) {
      const view = this.views.get(card)!;
      setFace(view, spot.up);
      const lift = spot.pick !== null && spot.pick === this.keyPick && this.ring?.visible ? LIFT : 0;
      const moving = Math.abs(view.box.x - spot.x) > 0.5 || Math.abs(view.box.y - (spot.y - lift)) > 0.5;
      if (moving && animate) slideTo(this, view, spot.x, spot.y - lift, spot.depth, { duration: MOVE_MS });
      else placeAt(view, spot.x, spot.y - lift, spot.depth);
      view.box.setVisible(true);
    }
    for (const [card, view] of this.views) if (!this.spots.has(card)) view.box.setVisible(false);

    this.session.seats.forEach((seat, i) => {
      const you = i === this.privacy.shown && this.privacy.open;
      const out = state.out(i as 0);
      this.seatText[i]?.setText(out ? `${seat.label}: out` : `${you ? 'You' : seat.label}: ${state.counts[i]}`);
    });
    const who = this.session.seats[state.offering]?.label ?? '';
    this.offerText?.setText(state.result ? '' : `Take one from ${state.offering === this.privacy.shown ? 'your hand' : who}`);
    this.privacy.draw();
    if (state.result && animate) this.celebrate();
    else if (this.ring?.visible) this.showKeyFocus();
  }

  private say(text: string): void {
    if (!this.banner) return;
    this.banner.setText(text).setAlpha(1);
    if (text) this.tweens.add({ targets: this.banner, alpha: 0.35, duration: 260, yoyo: true, repeat: 1 });
  }

  private press(x: number, y: number): void {
    if (this.privacy.lift()) {
      this.sync(true);
      return;
    }
    if (this.state.result) return;
    let best: { pick: number; depth: number } | null = null;
    for (const spot of this.spots.values()) {
      if (spot.pick === null) continue;
      if (Math.abs(x - spot.x) > CW * 0.36 || Math.abs(y - spot.y) > CH / 2) continue;
      if (!best || spot.depth > best.depth) best = { pick: spot.pick, depth: spot.depth };
    }
    if (best) this.play(takeMove(best.pick));
  }

  private play(move: MaidMove): void {
    if (this.state.legalMoves(this.state.currentSeat).includes(move)) this.session.play(move);
    else this.sync(true);
  }

  private picks(): number {
    const state = this.state;
    if (state.result || state.currentSeat !== this.privacy.shown || !this.privacy.open) return 0;
    return state.hands[state.offering]!.length;
  }

  private key(key: string): boolean {
    if (this.privacy.lift()) {
      this.sync(true);
      return true;
    }
    const picks = this.picks();
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      if (!picks) return true;
      this.keyPick = (this.keyPick + (key === 'ArrowLeft' ? picks - 1 : 1)) % picks;
      this.sync(true);
      return true;
    }
    if (isPress(key) && this.ring?.visible) {
      if (picks) this.play(takeMove(Math.min(this.keyPick, picks - 1)));
      return true;
    }
    return false;
  }

  private showKeyFocus(): void {
    if (!this.ring) return;
    const picks = this.picks();
    if (picks && this.keyPick >= picks) this.keyPick = 0;
    const spot = [...this.spots.values()].find((s) => s.pick === this.keyPick);
    moveRing(this, this.ring, spot?.x ?? W / 2, spot?.y ?? OFFER_Y);
  }

  /** Winning: the old maid is turned over for everybody to see. */
  private celebrate(): void {
    const left = this.state.hands.flat();
    for (const [card, view] of this.views) {
      stopSlide(this, view);
      if (!left.includes(card)) view.box.setVisible(false);
    }
    const maid = left[0];
    if (maid === undefined) return;
    const view = this.views.get(maid)!;
    setFace(view, true);
    view.box.setVisible(true).setDepth(5000);
    this.tweens.add({ targets: view.box, x: W / 2, y: H / 2, scale: 1.4, duration: 600, ease: 'Back.easeOut' });
    this.tweens.add({ targets: view.box, angle: { from: -8, to: 8 }, duration: 260, yoyo: true, repeat: 3, delay: 600 });
  }

  /** Test mode only: whose hand is on screen, whether it is covered, and how much of it shows. */
  /** Test mode only: whether any seat label runs off the table, sits on a card or touches another. */
  labelCheck(): LabelReport {
    const cards = [...this.spots.values()].map((spot) => ({ x: spot.x, y: spot.y, w: CW, h: CH }));
    return labelReport(this.seatText, cards, W, H);
  }

  handCheck(): { shown: number; covered: boolean; faceUp: number } {
    const mine = this.state.hands[this.privacy.shown] ?? [];
    return { shown: this.privacy.shown, covered: this.privacy.covered, faceUp: mine.filter((card) => this.views.get(card)?.up).length };
  }
}

export const maidStatus = (state: MaidState): string | undefined => {
  if (state.result) return undefined;
  const left = state.hands.reduce((sum, hand) => sum + hand.length, 0);
  return `${left} cards left`;
};

/**
 * Who was left holding it, named the way every other game names a player: "Nova (Purple)". This
 * used to be handed the colours instead of the people, so the sheet said "Purple is the old maid!"
 * directly above a running score reading "Nova 0 · Pip 1 · Zed 1 · Bo 1", naming the same player
 * two different ways in the same breath.
 */
export const maidResult = (state: MaidState, labels: readonly string[], sides: readonly string[]): string | undefined => {
  if (!state.result) return undefined;
  const loser = state.hands.findIndex((hand) => hand.length);
  if (loser === -1) return undefined;
  const card = state.hands[loser]![0]!;
  const name = playerName(labels, sides, loser);
  return rankOf(card) === MAID_QUEEN ? `${name} is the old maid!` : `${name} is left holding it!`;
};
