import {
  EIGHTS_DRAW,
  EIGHTS_PASS,
  playMove,
  rankOf,
  suitOf,
  SUIT_SYMBOLS,
  WILD_RANK,
  type EightsMove,
  type EightsState,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { drawSlot, makeCard, placeAt, setFace, slideTo, type CardView } from '../cards/view';
import { focusRing, isPress, moveRing, onKeys } from '../keys';

const W = 760;
const H = 780;
export const EIGHTS_SIZE = { width: W, height: H };

const CW = 84;
const CH = 118;
const TABLE = 0xd6ecff;
const SLOT = 0x8fc4ee;
const MOVE_MS = 220;
const HAND_Y = H - CH / 2 - 34;
const PILE_Y = 360;
const DECK_X = W / 2 - CW * 0.85;
const PILE_X = W / 2 + CW * 0.85;
const LIFT = 14;

/** Seat colours and names, the way the other 2 to 4 player games do it. */
export const EIGHTS_COLORS = [COLORS.tomato, COLORS.mint, COLORS.sunny, COLORS.sky];
export const EIGHTS_NAMES = ['Red', 'Green', 'Yellow', 'Blue'];

interface Spot {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  readonly up: boolean;
  /** The move this card makes when tapped, or null when it is not yours to play. */
  readonly move: EightsMove | null;
  readonly lift: number;
}

export class EightsScene extends Scene {
  private views = new Map<number, CardView>();
  private spots = new Map<number, Spot>();
  /** The seat whose hand is on screen: the person playing, or the last one who did. */
  private shown = 0;
  /** A hand stays covered until its owner says they are ready. */
  private covered = false;
  private cover?: GameObjects.Container;
  /** The eight waiting for a suit, and the four buttons asking. */
  private asking: number | null = null;
  private suitButtons?: GameObjects.Container;
  private banner?: GameObjects.Text;
  private seatText: GameObjects.Text[] = [];
  private suitPip?: GameObjects.Text;
  private deckText?: GameObjects.Text;
  private keyCard = 0;
  private ring?: GameObjects.Graphics;

  constructor(private readonly session: Session<EightsMove>) {
    super('crazy-eights');
  }

  private get state(): EightsState {
    return this.session.state as EightsState;
  }

  private get people(): number {
    return this.session.seats.filter((seat) => seat.kind === 'human').length;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.drawTable();
    for (let card = 0; card < 52; card++) {
      const view = makeCard(this, card, CW, CH);
      view.box.setPosition(DECK_X, PILE_Y);
      this.views.set(card, view);
    }
    this.shown = this.firstPerson();
    this.sync(true);

    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.press(p.worldX, p.worldY));
    this.ring = focusRing(this, CW + 12, CH + 12, 16);
    onKeys(this, (key) => this.key(key));

    const off = this.session.subscribe(() => this.onMove());
    this.events.once('shutdown', off);
  }

  private firstPerson(): number {
    const seat = this.session.seats.findIndex((s) => s.kind === 'human');
    return seat === -1 ? 0 : seat;
  }

  private drawTable(): void {
    const g = this.add.graphics();
    g.fillStyle(TABLE, 1);
    g.fillRoundedRect(0, 0, W, H, 28);
    drawSlot(g, DECK_X, PILE_Y, CW, CH, SLOT);
    drawSlot(g, PILE_X, PILE_Y, CW, CH, SLOT);
    this.deckText = sharpText(this, DECK_X, PILE_Y + CH / 2 + 18, '', 22, '#2f76b0').setDepth(4000);
    this.suitPip = sharpText(this, PILE_X, PILE_Y - CH / 2 - 22, '', 40, '#2f76b0').setDepth(4000);
    this.banner = sharpText(this, W / 2, PILE_Y + CH + 40, '', 24, '#2f76b0').setVisible(false).setDepth(4000);
    // Everybody else, along the top, with how many cards they are holding.
    const seats = this.session.seats.length;
    for (let seat = 0; seat < seats; seat++) {
      const x = (W / (seats + 1)) * (seat + 1);
      this.seatText.push(sharpText(this, x, 46, '', 22, '#2f76b0').setDepth(4000));
    }
  }

  /** Where every card sits: your hand fanned at the bottom, the pile in the middle, the rest away. */
  private layout(): Map<number, Spot> {
    const state = this.state;
    const spots = new Map<number, Spot>();
    state.stock.forEach((card, i) => spots.set(card, { x: DECK_X, y: PILE_Y, depth: i, up: false, move: null, lift: 0 }));
    state.discard.forEach((card, i) => {
      const deep = state.discard.length - 1 - i;
      spots.set(card, { x: PILE_X + Math.min(3, deep) * -4, y: PILE_Y, depth: 200 + i, up: true, move: null, lift: 0 });
    });
    state.hands.forEach((hand, seat) => {
      if (seat === this.shown) return;
      // Other people's cards stay face down, stacked behind their name.
      const x = (W / (state.hands.length + 1)) * (seat + 1);
      hand.forEach((card, i) => spots.set(card, { x: x + i * 6 - hand.length * 3, y: 108, depth: 100 + i, up: false, move: null, lift: 0 }));
    });
    const mine = state.hands[this.shown] ?? [];
    const yours = this.session.seats[this.shown]?.kind === 'human';
    const step = Math.min(CW * 0.78, (W - CW - 40) / Math.max(1, mine.length - 1));
    const left = W / 2 - (step * (mine.length - 1)) / 2;
    mine.forEach((card, i) => {
      const move = this.moveFor(card);
      spots.set(card, {
        x: left + i * step,
        y: HAND_Y,
        depth: 300 + i,
        up: yours && !this.covered,
        move,
        // What you can play stands proud; what you cannot sits back.
        lift: move ? LIFT : 0,
      });
    });
    return spots;
  }

  /** The move this card of yours makes, if it is your turn and the card can go. */
  private moveFor(card: number): EightsMove | null {
    const state = this.state;
    if (state.result || state.currentSeat !== this.shown) return null;
    if (this.session.seats[this.shown]?.kind !== 'human') return null;
    if (!state.hands[this.shown]!.includes(card) || !state.playable(card)) return null;
    return rankOf(card) === WILD_RANK ? playMove(card, 0) : playMove(card);
  }

  private onMove(): void {
    const state = this.state;
    const seat = state.currentSeat;
    // The phone has come round to somebody else: cover the hand until they say they are ready.
    if (!state.result && this.session.seats[seat]?.kind === 'human' && seat !== this.shown) {
      this.shown = seat;
      if (this.people > 1) this.covered = true;
    }
    this.asking = null;
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

    this.deckText?.setText(state.stock.length ? `${state.stock.length} left` : 'Deck is out');
    this.suitPip?.setText(SUIT_SYMBOLS[state.suit]!).setColor(state.suit === 1 || state.suit === 2 ? COLORS.tomato : COLORS.ink);
    this.session.seats.forEach((seat, i) => {
      const you = i === this.shown && seat.kind === 'human';
      this.seatText[i]?.setText(you ? '' : `${seat.label}: ${state.counts[i]}`);
    });
    this.banner?.setVisible(false);
    this.drawCover();
    this.drawSuitButtons();
    if (this.ring?.visible) this.showKeyFocus();
  }

  /** The cover that keeps one person's hand from the next person's eyes. */
  private drawCover(): void {
    this.cover?.destroy();
    this.cover = undefined;
    if (!this.covered) return;
    const label = this.session.seats[this.shown]?.label ?? 'You';
    const panel = this.add.graphics();
    panel.fillStyle(toHex(DARK.sky), 1);
    panel.fillRoundedRect(-W / 2 + 24, -150, W - 48, 300, 28);
    this.cover = this.add
      .container(W / 2, HAND_Y - 60, [
        panel,
        sharpText(this, 0, -40, `Pass to ${label}`, 40, '#ffffff'),
        sharpText(this, 0, 20, 'Tap when nobody else is looking', 24, '#e8f2ff'),
      ])
      .setDepth(5000);
  }

  /** Four big buttons asking which suit an eight meant. */
  private drawSuitButtons(): void {
    this.suitButtons?.destroy();
    this.suitButtons = undefined;
    if (this.asking === null) return;
    const parts: GameObjects.GameObject[] = [];
    const panel = this.add.graphics();
    panel.fillStyle(0xffffff, 1);
    panel.fillRoundedRect(-230, -70, 460, 140, 28);
    parts.push(panel, sharpText(this, 0, -44, 'Which suit?', 24, COLORS.soft));
    for (let suit = 0; suit < 4; suit++) {
      const x = -165 + suit * 110;
      const bubble = this.add.graphics();
      bubble.fillStyle(suit === 1 || suit === 2 ? toHex(COLORS.tomato) : toHex(COLORS.ink), 0.1);
      bubble.fillCircle(x, 18, 44);
      parts.push(bubble, sharpText(this, x, 18, SUIT_SYMBOLS[suit]!, 52, suit === 1 || suit === 2 ? COLORS.tomato : COLORS.ink));
    }
    this.suitButtons = this.add.container(W / 2, PILE_Y, parts).setDepth(5000);
  }

  private say(text: string): void {
    if (!this.banner) return;
    this.banner.setText(text).setVisible(true).setAlpha(1);
    this.tweens.add({ targets: this.banner, alpha: 0.3, duration: 220, yoyo: true, repeat: 2 });
  }

  private press(x: number, y: number): void {
    if (this.covered) {
      this.covered = false;
      this.sync(true);
      return;
    }
    const state = this.state;
    if (state.result) return;
    if (this.asking !== null) {
      // Four suits across 440 of the middle: whichever one the finger is nearest.
      if (Math.abs(y - PILE_Y - 18) > 60) return;
      const suit = Math.round((x - (W / 2 - 165)) / 110);
      if (suit < 0 || suit > 3) return;
      const eight = this.asking;
      this.asking = null;
      this.play(playMove(eight, suit));
      return;
    }
    if (Math.abs(x - DECK_X) <= CW / 2 && Math.abs(y - PILE_Y) <= CH / 2) {
      const moves = state.legalMoves(state.currentSeat);
      if (moves.includes(EIGHTS_DRAW)) this.play(EIGHTS_DRAW);
      else if (moves.includes(EIGHTS_PASS)) this.play(EIGHTS_PASS);
      else this.say('You have a card to play');
      return;
    }
    const found = this.hit(x, y);
    if (!found) return;
    if (!found.spot.move) {
      if (state.hands[this.shown]!.includes(found.card) && state.currentSeat === this.shown) {
        this.say(`That one does not match ${SUIT_SYMBOLS[state.suit]} or a ${rankOf(state.top)}`);
      }
      return;
    }
    if (rankOf(found.card) === WILD_RANK) {
      this.asking = found.card;
      this.drawSuitButtons();
      return;
    }
    this.play(found.spot.move);
  }

  private play(move: EightsMove): void {
    if (this.state.legalMoves(this.state.currentSeat).includes(move)) this.session.play(move);
    else this.sync(true);
  }

  private hit(x: number, y: number): { card: number; spot: Spot } | null {
    let best: { card: number; spot: Spot } | null = null;
    for (const [card, spot] of this.spots) {
      if (spot.depth < 300) continue; // Only your own hand answers a tap.
      if (Math.abs(x - spot.x) > CW * 0.42 || Math.abs(y - (spot.y - spot.lift)) > CH / 2) continue;
      if (!best || spot.depth > best.spot.depth) best = { card, spot };
    }
    return best;
  }

  private playableCards(): number[] {
    return (this.state.hands[this.shown] ?? []).filter((card) => this.moveFor(card) !== null);
  }

  private key(key: string): boolean {
    if (this.covered) {
      this.covered = false;
      this.sync(true);
      return true;
    }
    const open = this.playableCards();
    if (key === 'd' || key === 'D') {
      const moves = this.state.legalMoves(this.state.currentSeat);
      if (moves.includes(EIGHTS_DRAW)) this.play(EIGHTS_DRAW);
      else if (moves.includes(EIGHTS_PASS)) this.play(EIGHTS_PASS);
      return true;
    }
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      if (!open.length) return true;
      const now = open.indexOf(this.keyCard);
      const step = key === 'ArrowLeft' ? open.length - 1 : 1;
      this.keyCard = open[(Math.max(0, now) + step) % open.length]!;
      this.showKeyFocus();
      return true;
    }
    if (isPress(key) && this.ring?.visible) {
      if (this.asking !== null) {
        const eight = this.asking;
        this.asking = null;
        this.play(playMove(eight, suitOf(eight)));
        return true;
      }
      if (!open.length) return true;
      const card = open.includes(this.keyCard) ? this.keyCard : open[0]!;
      if (rankOf(card) === WILD_RANK) {
        this.asking = card;
        this.drawSuitButtons();
      } else this.play(playMove(card));
      return true;
    }
    return false;
  }

  /**
   * Test mode only: whose hand is on screen, whether it is covered, and how many of that hand's
   * cards are face up. The promise is that nobody sees a hand that is not theirs, and a canvas
   * cannot be asked that from the outside.
   */
  handCheck(): { shown: number; covered: boolean; faceUp: number } {
    const mine = this.state.hands[this.shown] ?? [];
    return {
      shown: this.shown,
      covered: this.covered,
      faceUp: mine.filter((card) => this.views.get(card)?.up).length,
    };
  }

  private showKeyFocus(): void {
    if (!this.ring) return;
    const open = this.playableCards();
    if (open.length && !open.includes(this.keyCard)) this.keyCard = open[0]!;
    const spot = this.spots.get(this.keyCard);
    moveRing(this, this.ring, spot?.x ?? W / 2, (spot?.y ?? HAND_Y) - (spot?.lift ?? 0));
  }
}

export const eightsStatus = (state: EightsState): string | undefined => {
  if (state.result) return undefined;
  const out = state.counts.filter((count) => count === 1).length;
  return out ? `Suit is ${SUIT_SYMBOLS[state.suit]} · somebody is on their last card` : `Suit is ${SUIT_SYMBOLS[state.suit]}`;
};
