import {
  callbreakCall,
  callbreakPlay,
  CALLBREAK_TRUMP,
  cardLabel,
  showScore,
  SUIT_SYMBOLS,
  trickRank,
  suitOf,
  type CallbreakMove,
  type CallbreakState,
  type Played,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { tableFill, tableInk, ROOM_TONES, tone } from '../../look';
import { applySpeed } from '../../autoplay';
import type { Session } from '../../session';
import { COLORS } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { makeCard, placeAt, setFace, slideTo, type CardView } from '../cards/view';
import { HandPrivacy } from '../cards/privacy';
import { labelReport, type LabelReport } from '../cards/labels';
import { focusRing, isPress, moveRing, onKeys } from '../keys';

const W = 800;
const H = 900;
export const CALLBREAK_SIZE = { width: W, height: H };

const CW = 82;
const CH = 116;
const TABLE = tableFill(0xfdf1dc);
const MOVE_MS = 240;
const HAND_Y = H - CH / 2 - 40;
const MIDDLE = { x: W / 2, y: 400 };
/** The banner sits in the empty band between the trick and the hand, clear of the far piles. */
const BANNER_Y = 600;
/** Seat labels: the two at the sides sit above their pile, which is what the table has room for. */
const SIDE_LABEL = { x: 115, y: 288 };

const TRICK_AT = [
  { x: 0, y: 110 },
  { x: -150, y: 0 },
  { x: 0, y: -110 },
  { x: 150, y: 0 },
];
const LIFT = 16;
/** The call row runs one to thirteen: there is no nil in this game. */
const CALL_FROM = 84;
const CALL_STEP = 52;
export const CALLBREAK_COLORS = [COLORS.mint, COLORS.grape, COLORS.sunny, COLORS.sky];
export const CALLBREAK_NAMES = ['Green', 'Purple', 'Yellow', 'Blue'];

interface Spot {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  readonly up: boolean;
  readonly mine: boolean;
}

export class CallbreakScene extends Scene {
  private privacy!: HandPrivacy;
  private views = new Map<number, CardView>();
  private spots = new Map<number, Spot>();
  private seatText: GameObjects.Text[] = [];
  private scoreText?: GameObjects.Text;
  private banner?: GameObjects.Text;
  private callRow?: GameObjects.Container;
  private keyCard = 0;
  private keyCall = 1;
  private ring?: GameObjects.Graphics;

  constructor(private readonly session: Session<CallbreakMove>) {
    super('callbreak');
  }

  private get state(): CallbreakState {
    return this.session.state as CallbreakState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    const g = this.add.graphics();
    g.fillStyle(TABLE, 1);
    g.fillRoundedRect(0, 0, W, H, 28);
    this.scoreText = sharpText(this, W / 2, 40, '', 22, tableInk('#2f6b4f')).setDepth(4000);
    this.banner = sharpText(this, W / 2, BANNER_Y, '', 26, tableInk('#2f6b4f')).setDepth(4000);
    const spots = [
      { x: W / 2, y: H - 20 },
      { x: SIDE_LABEL.x, y: SIDE_LABEL.y },
      { x: W / 2, y: 78 },
      { x: W - SIDE_LABEL.x, y: SIDE_LABEL.y },
    ];
    for (let seat = 0; seat < 4; seat++) {
      const side = seat === 1 || seat === 3;
      this.seatText.push(sharpText(this, spots[seat]!.x, spots[seat]!.y, '', side ? 17 : 20, tableInk('#2f6b4f')).setDepth(4000));
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
      const at = TRICK_AT[this.place(seat)]!;
      hand.forEach((card, i) =>
        spots.set(card, { x: MIDDLE.x + at.x * 1.9 + i * 3, y: MIDDLE.y + at.y * 1.9, depth: 100 + i, up: false, mine: false }),
      );
    });
    state.trick.forEach((played, i) => {
      const at = TRICK_AT[this.place(played.seat)]!;
      spots.set(played.card, { x: MIDDLE.x + at.x, y: MIDDLE.y + at.y, depth: 400 + i, up: true, mine: false });
    });

    const hand = state.hands[mine] ?? [];
    const step = Math.min(CW * 0.66, (W - CW - 40) / Math.max(1, hand.length - 1));
    const left = W / 2 - (step * (hand.length - 1)) / 2;
    const playable = yours && state.phase === 'play' && state.currentSeat === mine ? state.playable(mine) : [];
    hand.forEach((card, i) => {
      spots.set(card, { x: left + i * step, y: HAND_Y - (playable.includes(card) ? LIFT * 0.4 : 0), depth: 300 + i, up: yours, mine: playable.includes(card) });
    });
    return spots;
  }

  private onMove(): void {
    const state = this.state;
    this.privacy.turnChanged(state.currentSeat, state.result !== null);
    const event = state.last;
    if (event?.kind === 'call') {
      const who = this.session.seats[event.seat!]?.label ?? 'They';
      this.say(`${who} calls ${event.call}`);
    } else if (event?.kind === 'round' && event.scored) {
      const parts = event.scored.map((points, seat) => `${this.session.seats[seat]?.label ?? CALLBREAK_NAMES[seat]} ${points >= 0 ? '+' : ''}${showScore(points)}`);
      this.say(parts.join(', '));
    } else if (event?.kind === 'trick') {
      this.say(`${this.session.seats[event.took!]?.label ?? 'They'} takes it`);
    }
    this.sync(true);
  }

  private sync(animate: boolean): void {
    const state = this.state;
    this.spots = this.layout();
    for (const [card, spot] of [...this.spots].sort((a, b) => a[1].depth - b[1].depth)) {
      const view = this.views.get(card)!;
      setFace(view, spot.up);
      const moving = Math.abs(view.box.x - spot.x) > 0.5 || Math.abs(view.box.y - spot.y) > 0.5;
      if (moving && animate) slideTo(this, view, spot.x, spot.y, spot.depth, { duration: MOVE_MS });
      else placeAt(view, spot.x, spot.y, spot.depth);
      view.box.setVisible(true);
    }
    for (const [card, view] of this.views) if (!this.spots.has(card)) view.box.setVisible(false);

    this.session.seats.forEach((seat, i) => {
      const you = i === this.privacy.shown && this.privacy.open;
      const call = state.calls[i]!;
      const said = call < 0 ? '…' : String(call);
      const who = you ? 'You' : seat.label;
      this.seatText[this.place(i)]?.setText(`${who} · called ${said} · won ${state.won[i]}`);
    });
    this.scoreText?.setText(
      `Round ${state.round + 1} of ${state.rounds}   ·   ` +
        this.session.seats.map((seat, i) => `${seat.label} ${showScore(state.scores[i]!)}`).join('   ·   '),
    );
    this.privacy.draw();
    this.drawCalls();
    if (this.ring?.visible) this.showKeyFocus();
  }

  /** The row of numbers to call with, one to thirteen. */
  private drawCalls(): void {
    this.callRow?.destroy();
    this.callRow = undefined;
    const state = this.state;
    if (state.phase !== 'call' || !this.privacy.open || state.currentSeat !== this.privacy.shown) return;
    const parts: GameObjects.GameObject[] = [];
    const panel = this.add.graphics();
    panel.fillStyle(tone(0xffffff, ROOM_TONES.panel), 1);
    panel.fillRoundedRect(-W / 2 + 30, -74, W - 60, 148, 28);
    parts.push(panel, sharpText(this, 0, -46, 'How many tricks will you take?', 24, COLORS.soft));
    for (let call = 1; call <= 13; call++) {
      const x = -W / 2 + CALL_FROM + (call - 1) * CALL_STEP;
      const chip = this.add.graphics();
      chip.fillStyle(call === this.keyCall ? 0x16c47f : 0xe2f0e8, 1);
      chip.fillRoundedRect(x - CALL_STEP / 2 + 4, -6, CALL_STEP - 8, 58, 16);
      parts.push(chip, sharpText(this, x, 23, String(call), 24, call === this.keyCall ? '#ffffff' : COLORS.ink));
    }
    this.callRow = this.add.container(W / 2, HAND_Y - CH / 2 - 90, parts).setDepth(4500);
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
    if (state.phase === 'call') {
      if (state.currentSeat !== this.privacy.shown || !this.privacy.open) return;
      const row = HAND_Y - CH / 2 - 90;
      if (Math.abs(y - (row + 23)) > 40) return;
      const call = Math.round((x - CALL_FROM) / CALL_STEP) + 1;
      if (call >= 1 && call <= 13) this.play(callbreakCall(call));
      return;
    }
    const found = this.hit(x, y);
    if (!found) return;
    if (!found.spot.mine) {
      if (state.currentSeat === this.privacy.shown) this.say(this.why(found.card));
      return;
    }
    this.play(callbreakPlay(found.card));
  }

  /** Why a card is refused. Here that is usually "beat the ten", which nobody guesses on their own. */
  private why(card: number): string {
    const state = this.state;
    const seat = this.privacy.shown;
    const trick = state.trick;
    if (!trick.length) return 'Not that one';
    const led = suitOf(trick[0]!.card);
    const hand = state.hands[seat] ?? [];
    const holds = hand.some((held) => suitOf(held) === led);
    if (holds && suitOf(card) !== led) return `Follow ${SUIT_SYMBOLS[led]}`;
    const highest = (plays: readonly Played[]): number =>
      plays.reduce((best, play) => (trickRank(play.card) > trickRank(best.card) ? play : best)).card;
    if (holds) return `Beat the ${cardLabel(highest(trick.filter((play) => suitOf(play.card) === led)))}`;
    const spades = trick.filter((play) => suitOf(play.card) === CALLBREAK_TRUMP);
    if (!spades.length) return 'Play a spade';
    return `Beat the ${cardLabel(highest(spades))}`;
  }

  private play(move: CallbreakMove): void {
    if (this.state.legalMoves(this.state.currentSeat).includes(move)) this.session.play(move);
    else this.sync(true);
  }

  private hit(x: number, y: number): { card: number; spot: Spot } | null {
    let best: { card: number; spot: Spot } | null = null;
    for (const [card, spot] of this.spots) {
      if (spot.depth < 300 || spot.depth >= 400) continue;
      if (Math.abs(x - spot.x) > CW * 0.34 || Math.abs(y - spot.y) > CH / 2) continue;
      if (!best || spot.depth > best.spot.depth) best = { card, spot };
    }
    return best;
  }

  private mineNow(): number[] {
    const state = this.state;
    if (state.result || !this.privacy.open || state.currentSeat !== this.privacy.shown || state.phase !== 'play') return [];
    return state.playable(this.privacy.shown);
  }

  private key(key: string): boolean {
    if (this.privacy.lift()) {
      this.sync(true);
      return true;
    }
    const state = this.state;
    if (state.phase === 'call') {
      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        this.keyCall = Math.max(1, Math.min(13, this.keyCall + (key === 'ArrowLeft' ? -1 : 1)));
        this.sync(true);
        return true;
      }
      if (isPress(key)) {
        this.play(callbreakCall(this.keyCall));
        return true;
      }
      return false;
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
      this.play(callbreakPlay(open.includes(this.keyCard) ? this.keyCard : open[0]!));
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

export const callbreakStatus = (state: CallbreakState): string | undefined => {
  if (state.result) return undefined;
  const round = `Round ${state.round + 1} of ${state.rounds}`;
  if (state.phase === 'call') return 'Say how many tricks you will take';
  const best = Math.max(...state.scores);
  // Everybody on nothing means nobody is ahead, so say something that is true instead.
  if (state.scores.every((score) => score === best)) return `${round} · spades are trump`;
  return `${round} · best score ${showScore(best)}`;
};
