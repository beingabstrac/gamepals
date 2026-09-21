import { spadesBid, spadesPlay, SPADES_SUIT, SUIT_SYMBOLS, suitOf, teamOf, type SpadesMove, type SpadesState } from '@gamepals/rules';
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
export const SPADES_SIZE = { width: W, height: H };

const CW = 82;
const CH = 116;
const TABLE = 0xe4e0f7;
const MOVE_MS = 240;
const HAND_Y = H - CH / 2 - 40;
const MIDDLE = { x: W / 2, y: 400 };
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
const SIDE_LABEL = { x: 115, y: 288 };

/** The bid row is laid out from the left edge of the table: nil first, then one to thirteen. */
const NIL_TO = 142;
const BID_FROM = 170;
const BID_STEP = 45;
/** Partners share a colour, because that is the thing to see at a glance. */
export const SPADES_COLORS = [COLORS.sky, COLORS.tomato, COLORS.sky, COLORS.tomato];
export const SPADES_NAMES = ['Blue', 'Red', 'Blue', 'Red'];
export const SPADES_TEAMS = ['Blue', 'Red'];

interface Spot {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  readonly up: boolean;
  readonly mine: boolean;
}

export class SpadesScene extends Scene {
  private privacy!: HandPrivacy;
  private views = new Map<number, CardView>();
  private spots = new Map<number, Spot>();
  private seatText: GameObjects.Text[] = [];
  private scoreText?: GameObjects.Text;
  private banner?: GameObjects.Text;
  private bidRow?: GameObjects.Container;
  private keyCard = 0;
  private keyBid = 1;
  private ring?: GameObjects.Graphics;

  constructor(private readonly session: Session<SpadesMove>) {
    super('spades');
  }

  private get state(): SpadesState {
    return this.session.state as SpadesState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    const g = this.add.graphics();
    g.fillStyle(TABLE, 1);
    g.fillRoundedRect(0, 0, W, H, 28);
    this.scoreText = sharpText(this, W / 2, 40, '', 22, '#5b4d9e').setDepth(4000);
    this.banner = sharpText(this, W / 2, BANNER_Y, '', 26, '#5b4d9e').setDepth(4000);
    const spots = [
      { x: W / 2, y: H - 20 },
      { x: SIDE_LABEL.x, y: SIDE_LABEL.y },
      { x: W / 2, y: 78 },
      { x: W - SIDE_LABEL.x, y: SIDE_LABEL.y },
    ];
    for (let seat = 0; seat < 4; seat++) {
      const side = seat === 1 || seat === 3;
      this.seatText.push(sharpText(this, spots[seat]!.x, spots[seat]!.y, '', side ? 17 : 20, '#5b4d9e').setDepth(4000));
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
    if (event?.kind === 'bid') {
      const who = this.session.seats[event.seat!]?.label ?? 'They';
      this.say(event.bid === 0 ? `${who} goes nil` : `${who} bids ${event.bid}`);
    } else if (event?.kind === 'hand' && event.scored) {
      this.say(`${SPADES_TEAMS[0]} ${event.scored[0]! >= 0 ? '+' : ''}${event.scored[0]}, ${SPADES_TEAMS[1]} ${event.scored[1]! >= 0 ? '+' : ''}${event.scored[1]}`);
    } else if (event?.kind === 'trick') {
      this.say(`${this.session.seats[event.took!]?.label ?? 'They'} takes it`);
    } else if (event?.broke) this.say('Spades are broken');
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
      const bid = state.bids[i]!;
      const said = bid < 0 ? '…' : bid === 0 ? 'nil' : String(bid);
      /**
       * Every seat says its side, and is coloured by it. A partnership game that never says who
       * is partnered with whom is asking a lot: the scoreboard read "Blue 71 · Red -60" over four
       * seats named Nova, Pip, Zed and Bo, and nothing on screen tied a name to a side. Said in
       * the label rather than in a row of its own, because the top seat's label sits at y=78 and
       * a new line under the scoreboard lands on top of it.
       */
      const side = SPADES_TEAMS[teamOf(i)]!;
      this.seatText[this.place(i)]
        ?.setText(`${you ? 'You' : seat.label} (${side}) · bid ${said} · won ${state.won[i]}`)
        .setColor(SPADES_COLORS[i]!);
    });
    const contracts = state.contracts;
    const teamWon = state.teamWon;
    this.scoreText?.setText(
      `${SPADES_TEAMS[0]} ${state.scores[0]} (${teamWon[0]}/${contracts[0]}, ${state.bags[0]} bags)   ·   ` +
        `${SPADES_TEAMS[1]} ${state.scores[1]} (${teamWon[1]}/${contracts[1]}, ${state.bags[1]} bags)`,
    );

    this.privacy.draw();
    this.drawBids();
    if (this.ring?.visible) this.showKeyFocus();
  }

  /** The row of numbers to bid with, nil set apart so it is never a slip of the thumb. */
  private drawBids(): void {
    this.bidRow?.destroy();
    this.bidRow = undefined;
    const state = this.state;
    if (state.phase !== 'bid' || !this.privacy.open || state.currentSeat !== this.privacy.shown) return;
    const parts: GameObjects.GameObject[] = [];
    const panel = this.add.graphics();
    panel.fillStyle(0xffffff, 1);
    panel.fillRoundedRect(-W / 2 + 30, -74, W - 60, 148, 28);
    parts.push(panel, sharpText(this, 0, -46, 'How many tricks will you take?', 24, COLORS.soft));
    // Nil on its own at the left, then one to thirteen.
    const nil = this.add.graphics();
    nil.fillStyle(toHex(DARK.grape), 1);
    nil.fillRoundedRect(-W / 2 + 46, -6, 96, 58, 20);
    parts.push(nil, sharpText(this, -W / 2 + 94, 23, 'Nil', 26, '#ffffff'));
    for (let bid = 1; bid <= 13; bid++) {
      const x = -W / 2 + BID_FROM + (bid - 1) * BID_STEP;
      const chip = this.add.graphics();
      chip.fillStyle(bid === this.keyBid ? toHex(COLORS.sky) : 0xe9e5f8, 1);
      chip.fillRoundedRect(x - BID_STEP / 2 + 3, -6, BID_STEP - 7, 58, 16);
      parts.push(chip, sharpText(this, x, 23, String(bid), 24, bid === this.keyBid ? '#ffffff' : COLORS.ink));
    }
    this.bidRow = this.add.container(W / 2, HAND_Y - CH / 2 - 90, parts).setDepth(4500);
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
    if (state.phase === 'bid') {
      if (state.currentSeat !== this.privacy.shown || !this.privacy.open) return;
      const row = HAND_Y - CH / 2 - 90;
      if (Math.abs(y - (row + 23)) > 40) return;
      if (x < NIL_TO) {
        this.play(spadesBid(0));
        return;
      }
      const bid = Math.round((x - BID_FROM) / BID_STEP) + 1;
      if (bid >= 1 && bid <= 13) this.play(spadesBid(bid));
      return;
    }
    const found = this.hit(x, y);
    if (!found) return;
    if (!found.spot.mine) {
      if (state.currentSeat === this.privacy.shown) this.say(this.why(found.card));
      return;
    }
    this.play(spadesPlay(found.card));
  }

  private why(card: number): string {
    const state = this.state;
    const led = state.trick.length ? suitOf(state.trick[0]!.card) : null;
    if (led !== null && suitOf(card) !== led) return `Follow ${SUIT_SYMBOLS[led]}`;
    if (led === null && suitOf(card) === SPADES_SUIT && !state.broken) return 'Spades are not broken yet';
    return 'Not that one';
  }

  private play(move: SpadesMove): void {
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
    if (state.phase === 'bid') {
      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        this.keyBid = Math.max(0, Math.min(13, this.keyBid + (key === 'ArrowLeft' ? -1 : 1)));
        this.sync(true);
        return true;
      }
      if (isPress(key)) {
        this.play(spadesBid(this.keyBid));
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
      this.play(spadesPlay(open.includes(this.keyCard) ? this.keyCard : open[0]!));
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

export const spadesStatus = (state: SpadesState): string | undefined => {
  if (state.result) return undefined;
  if (state.phase === 'bid') return 'Say how many tricks you will take';
  const contracts = state.contracts;
  const won = state.teamWon;
  return `${SPADES_TEAMS[0]} ${won[0]}/${contracts[0]} · ${SPADES_TEAMS[1]} ${won[1]}/${contracts[1]}`;
};

export const spadesResult = (state: SpadesState): string | undefined => {
  if (!state.result) return undefined;
  if (state.result.draw) return `Level, ${state.scores[0]} each.`;
  const team = teamOf(state.result.winners[0]!);
  return `${SPADES_TEAMS[team]} wins, ${state.scores[team]} to ${state.scores[1 - team]}.`;
};
