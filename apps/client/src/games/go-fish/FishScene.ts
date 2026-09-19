import { askMove, FISH_DRAW, FISH_PASS, rankOf, type FishMove, type FishState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { tableFill, tableInk } from '../../look';
import { applySpeed } from '../../autoplay';
import type { Session } from '../../session';
import { COLORS } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { makeCard, placeAt, RANKS, setFace, slideTo, type CardView } from '../cards/view';
import { HandPrivacy } from '../cards/privacy';
import { focusRing, isPress, moveRing, onKeys } from '../keys';

const W = 760;
const H = 820;
export const FISH_SIZE = { width: W, height: H };

const CW = 80;
const CH = 113;
const TABLE = tableFill(0xd8f3ff);
const MOVE_MS = 220;
const HAND_Y = H - CH / 2 - 34;
const POOL_Y = 330;
const LIFT = 14;
export const FISH_COLORS = [COLORS.tomato, COLORS.mint, COLORS.sunny, COLORS.grape];
export const FISH_NAMES = ['Red', 'Green', 'Yellow', 'Purple'];

interface Spot {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  readonly up: boolean;
  /** The rank this card offers to ask for, when it is yours and it is your turn. */
  readonly rank: number | null;
  readonly lift: number;
}

export class FishScene extends Scene {
  private privacy!: HandPrivacy;
  private views = new Map<number, CardView>();
  private spots = new Map<number, Spot>();
  /** The rank picked, waiting for a player to ask. */
  private asking: number | null = null;
  private seatText: GameObjects.Text[] = [];
  private askButtons?: GameObjects.Container;
  private banner?: GameObjects.Text;
  private poolText?: GameObjects.Text;
  private keyRank = 0;
  private ring?: GameObjects.Graphics;

  constructor(private readonly session: Session<FishMove>) {
    super('go-fish');
  }

  private get state(): FishState {
    return this.session.state as FishState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.drawTable();
    for (let card = 0; card < 52; card++) {
      const view = makeCard(this, card, CW, CH);
      view.box.setPosition(W / 2, POOL_Y);
      this.views.set(card, view);
    }
    this.privacy = new HandPrivacy(this, this.session.seats, { x: W / 2, y: HAND_Y - 60, width: W - 48 });
    this.sync(true);

    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.press(p.worldX, p.worldY));
    this.ring = focusRing(this, CW + 12, CH + 12, 16);
    onKeys(this, (key) => this.key(key));
    const off = this.session.subscribe(() => this.onMove());
    this.events.once('shutdown', off);
  }

  private drawTable(): void {
    const g = this.add.graphics();
    g.fillStyle(TABLE, 1);
    g.fillRoundedRect(0, 0, W, H, 28);
    this.poolText = sharpText(this, W / 2, POOL_Y + CH / 2 + 20, '', 22, tableInk('#2f76b0')).setDepth(4000);
    this.banner = sharpText(this, W / 2, POOL_Y - CH / 2 - 26, '', 26, tableInk('#2f76b0')).setDepth(4000);
    const seats = this.session.seats.length;
    for (let seat = 0; seat < seats; seat++) {
      const x = (W / (seats + 1)) * (seat + 1);
      this.seatText.push(sharpText(this, x, 44, '', 21, tableInk('#2f76b0')).setDepth(4000));
    }
  }

  /** Where every card sits: your hand at the bottom, books beside their owner, the pool in the middle. */
  private layout(): Map<number, Spot> {
    const state = this.state;
    const spots = new Map<number, Spot>();
    state.pool.forEach((card, i) => spots.set(card, { x: W / 2 - i * 0.6, y: POOL_Y, depth: i, up: false, rank: null, lift: 0 }));
    const seats = state.hands.length;
    state.hands.forEach((hand, seat) => {
      if (seat === this.privacy.shown) return;
      const x = (W / (seats + 1)) * (seat + 1);
      hand.forEach((card, i) => spots.set(card, { x: x + i * 5 - hand.length * 2.5, y: 112, depth: 100 + i, up: false, rank: null, lift: 0 }));
    });
    // Books lie face up in a row under their owner's name.
    state.books.forEach((ranks, seat) => {
      const x = (W / (seats + 1)) * (seat + 1);
      ranks.forEach((rank, i) => {
        for (let suit = 0; suit < 4; suit++) {
          spots.set(suit * 13 + rank - 1, { x: x + i * 14 - ranks.length * 7 + suit, y: 206, depth: 50 + i * 4 + suit, up: true, rank: null, lift: 0 });
        }
      });
    });
    const mine = state.hands[this.privacy.shown] ?? [];
    const yours = this.privacy.open;
    const step = Math.min(CW * 0.72, (W - CW - 40) / Math.max(1, mine.length - 1));
    const left = W / 2 - (step * (mine.length - 1)) / 2;
    const canAsk = yours && state.currentSeat === this.privacy.shown && !state.result;
    mine.forEach((card, i) => {
      const rank = canAsk ? rankOf(card) : null;
      spots.set(card, {
        x: left + i * step,
        y: HAND_Y,
        depth: 300 + i,
        up: yours,
        rank,
        lift: rank !== null && rank === this.asking ? LIFT : 0,
      });
    });
    return spots;
  }

  private onMove(): void {
    this.privacy.turnChanged(this.state.currentSeat, this.state.result !== null);
    this.asking = null;
    const event = this.state.last;
    if (event?.ask) {
      const who = this.session.seats[event.ask.to]?.label ?? 'they';
      const rank = RANKS[event.ask.rank - 1];
      this.say(event.ask.got ? `${who} had ${event.ask.got} ${rank}s` : `Go fish, no ${rank}s`);
    }
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
    this.poolText?.setText(state.pool.length ? `${state.pool.length} in the pool` : 'Pool is empty');
    this.session.seats.forEach((seat, i) => {
      const books = state.books[i]!.length;
      const you = i === this.privacy.shown && this.privacy.open;
      this.seatText[i]?.setText(`${you ? 'You' : seat.label}: ${state.counts[i]} · ${books} book${books === 1 ? '' : 's'}`);
    });
    this.privacy.draw();
    this.drawAskButtons();
    if (this.ring?.visible) this.showKeyFocus();
  }

  /** Once a rank is picked, one button per player to ask. */
  private drawAskButtons(): void {
    this.askButtons?.destroy();
    this.askButtons = undefined;
    if (this.asking === null) return;
    const others = this.askTargets();
    if (!others.length) return;
    const parts: GameObjects.GameObject[] = [];
    const width = Math.min(W - 60, others.length * 200 + 40);
    const panel = this.add.graphics();
    panel.fillStyle(0xffffff, 1);
    panel.fillRoundedRect(-width / 2, -78, width, 156, 28);
    parts.push(panel, sharpText(this, 0, -48, `Ask who for a ${RANKS[this.asking - 1]}?`, 24, COLORS.soft));
    others.forEach((seat, n) => {
      const x = -((others.length - 1) * 190) / 2 + n * 190;
      const bubble = this.add.graphics();
      bubble.fillStyle(0xe8f2ff, 1);
      bubble.fillRoundedRect(x - 88, -8, 176, 62, 22);
      parts.push(bubble, sharpText(this, x, 23, this.session.seats[seat]?.label ?? `Player ${seat + 1}`, 26, COLORS.ink));
    });
    this.askButtons = this.add.container(W / 2, POOL_Y, parts).setDepth(5000);
  }

  private askTargets(): number[] {
    return this.session.seats.map((_, i) => i).filter((i) => i !== this.privacy.shown && this.state.counts[i]);
  }

  private say(text: string): void {
    if (!this.banner) return;
    this.banner.setText(text).setAlpha(1);
    this.tweens.add({ targets: this.banner, alpha: 0.35, duration: 260, yoyo: true, repeat: 1 });
  }

  private press(x: number, y: number): void {
    if (this.privacy.lift()) {
      this.sync(true);
      return;
    }
    const state = this.state;
    if (state.result) return;
    if (this.asking !== null) {
      const others = this.askTargets();
      if (Math.abs(y - POOL_Y - 23) > 50) return;
      const n = Math.round((x - (W / 2 - ((others.length - 1) * 190) / 2)) / 190);
      const seat = others[n];
      if (seat === undefined) return;
      const rank = this.asking;
      this.asking = null;
      this.play(askMove(seat, rank));
      return;
    }
    const found = this.hit(x, y);
    if (!found?.spot.rank) {
      // The pool: draw or let the turn go by when there is nothing else to do.
      const moves = state.legalMoves(state.currentSeat);
      if (Math.abs(x - W / 2) <= CW && Math.abs(y - POOL_Y) <= CH / 2) {
        if (moves.includes(FISH_DRAW)) this.play(FISH_DRAW);
        else if (moves.includes(FISH_PASS)) this.play(FISH_PASS);
      }
      return;
    }
    this.asking = found.spot.rank;
    this.sync(true);
  }

  private play(move: FishMove): void {
    if (this.state.legalMoves(this.state.currentSeat).includes(move)) this.session.play(move);
    else this.sync(true);
  }

  private hit(x: number, y: number): { card: number; spot: Spot } | null {
    let best: { card: number; spot: Spot } | null = null;
    for (const [card, spot] of this.spots) {
      if (spot.depth < 300) continue;
      if (Math.abs(x - spot.x) > CW * 0.4 || Math.abs(y - (spot.y - spot.lift)) > CH / 2) continue;
      if (!best || spot.depth > best.spot.depth) best = { card, spot };
    }
    return best;
  }

  private myRanks(): number[] {
    const state = this.state;
    if (state.result || state.currentSeat !== this.privacy.shown || !this.privacy.open) return [];
    return state.ranksIn(this.privacy.shown);
  }

  private key(key: string): boolean {
    if (this.privacy.lift()) {
      this.sync(true);
      return true;
    }
    const ranks = this.myRanks();
    if (key === 'd' || key === 'D') {
      const moves = this.state.legalMoves(this.state.currentSeat);
      if (moves.includes(FISH_DRAW)) this.play(FISH_DRAW);
      else if (moves.includes(FISH_PASS)) this.play(FISH_PASS);
      return true;
    }
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      if (!ranks.length) return true;
      const now = ranks.indexOf(this.keyRank);
      const step = key === 'ArrowLeft' ? ranks.length - 1 : 1;
      this.keyRank = ranks[(Math.max(0, now) + step) % ranks.length]!;
      this.showKeyFocus();
      return true;
    }
    if (isPress(key) && this.ring?.visible) {
      if (this.asking !== null) {
        const seat = this.askTargets()[0];
        const rank = this.asking;
        this.asking = null;
        if (seat !== undefined) this.play(askMove(seat, rank));
        return true;
      }
      if (!ranks.length) return true;
      this.asking = ranks.includes(this.keyRank) ? this.keyRank : ranks[0]!;
      this.sync(true);
      return true;
    }
    return false;
  }

  private showKeyFocus(): void {
    if (!this.ring) return;
    const ranks = this.myRanks();
    if (ranks.length && !ranks.includes(this.keyRank)) this.keyRank = ranks[0]!;
    const card = (this.state.hands[this.privacy.shown] ?? []).find((c) => rankOf(c) === this.keyRank);
    const spot = card === undefined ? undefined : this.spots.get(card);
    moveRing(this, this.ring, spot?.x ?? W / 2, (spot?.y ?? HAND_Y) - (spot?.lift ?? 0));
  }

  /** Test mode only: whose hand is on screen, whether it is covered, and how much of it shows. */
  handCheck(): { shown: number; covered: boolean; faceUp: number } {
    const mine = this.state.hands[this.privacy.shown] ?? [];
    return { shown: this.privacy.shown, covered: this.privacy.covered, faceUp: mine.filter((card) => this.views.get(card)?.up).length };
  }
}

export const fishStatus = (state: FishState): string | undefined => {
  if (state.result) return undefined;
  const down = state.books.reduce((sum, list) => sum + list.length, 0);
  return `${down} of 13 books down`;
};
