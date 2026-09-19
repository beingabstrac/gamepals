import {
  bestArrangement,
  deadwoodOf,
  ginDiscard,
  ginDrawDiscard,
  ginDrawStock,
  ginKnock,
  ginPass,
  ginTake,
  KNOCK_AT,
  type GinMove,
  type GinState,
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

const W = 760;
const H = 820;
export const GIN_SIZE = { width: W, height: H };

const CW = 84;
const CH = 118;
const TABLE = tableFill(0xe8e2f6);
const SLOT = slotFill(0xb3a5e0);
const MOVE_MS = 220;
const HAND_Y = H - CH / 2 - 76;
const PILE_Y = 340;
const DECK_X = W / 2 - CW * 0.85;
const PILE_X = W / 2 + CW * 0.85;
const LIFT = 14;
/** The gap that separates one meld from the next in your hand. */
const MELD_GAP = 22;
const BUTTON_Y = PILE_Y + CH / 2 + 62;
export const GIN_COLORS = [COLORS.grape, COLORS.sunny];
export const GIN_NAMES = ['Purple', 'Yellow'];

interface Spot {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  readonly up: boolean;
  /** Your own card, tappable on your turn to throw. */
  readonly mine: boolean;
}

interface Button {
  readonly label: string;
  readonly move: GinMove;
  readonly x: number;
  readonly color: string;
}

export class GinScene extends Scene {
  private privacy!: HandPrivacy;
  private views = new Map<number, CardView>();
  private spots = new Map<number, Spot>();
  private seatText: GameObjects.Text[] = [];
  private countText?: GameObjects.Text;
  private deckText?: GameObjects.Text;
  private banner?: GameObjects.Text;
  private buttonRow?: GameObjects.Container;
  private buttons: Button[] = [];
  private keyCard = 0;
  private ring?: GameObjects.Graphics;

  constructor(private readonly session: Session<GinMove>) {
    super('gin-rummy');
  }

  private get state(): GinState {
    return this.session.state as GinState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    const g = this.add.graphics();
    g.fillStyle(TABLE, 1);
    g.fillRoundedRect(0, 0, W, H, 28);
    drawSlot(g, DECK_X, PILE_Y, CW, CH, SLOT);
    drawSlot(g, PILE_X, PILE_Y, CW, CH, SLOT);
    this.deckText = sharpText(this, DECK_X, PILE_Y + CH / 2 + 20, '', 20, tableInk('#5b4d9e')).setDepth(4000);
    this.banner = sharpText(this, W / 2, 212, '', 24, tableInk('#5b4d9e')).setDepth(4000);
    this.countText = sharpText(this, W / 2, H - 28, '', 22, tableInk('#5b4d9e')).setDepth(4000);
    for (let seat = 0; seat < 2; seat++) {
      this.seatText.push(sharpText(this, W / 2, seat === 0 ? H - 56 : 28, '', 21, tableInk('#5b4d9e')).setDepth(4000));
    }
    for (let card = 0; card < 52; card++) {
      const view = makeCard(this, card, CW, CH);
      view.box.setPosition(DECK_X, PILE_Y);
      this.views.set(card, view);
    }
    this.privacy = new HandPrivacy(this, this.session.seats, { x: W / 2, y: HAND_Y - 62, width: W - 48 });
    this.sync(false);

    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.press(p.worldX, p.worldY));
    this.ring = focusRing(this, CW + 12, CH + 12, 16);
    onKeys(this, (key) => this.key(key));
    const off = this.session.subscribe(() => this.onMove());
    this.events.once('shutdown', off);
  }

  private other(): number {
    return (this.privacy.shown + 1) % 2;
  }

  /** Your hand in its best arrangement: melds first with a gap between them, then the loose cards. */
  private ordered(hand: readonly number[]): { card: number; group: number }[] {
    const best = bestArrangement(hand);
    const out: { card: number; group: number }[] = [];
    best.melds.forEach((meld, group) => meld.forEach((card) => out.push({ card, group })));
    best.deadwood.forEach((card) => out.push({ card, group: best.melds.length }));
    return out;
  }

  private layout(): Map<number, Spot> {
    const state = this.state;
    const spots = new Map<number, Spot>();
    const mine = this.privacy.shown;
    const yours = this.privacy.open;

    state.stock.forEach((card, i) => spots.set(card, { x: DECK_X, y: PILE_Y, depth: i, up: false, mine: false }));
    state.discard.forEach((card, i) => {
      const deep = state.discard.length - 1 - i;
      spots.set(card, { x: PILE_X + Math.min(3, deep) * -4, y: PILE_Y, depth: 200 + i, up: true, mine: false });
    });
    const theirs = state.hands[this.other()] ?? [];
    theirs.forEach((card, i) =>
      spots.set(card, { x: W / 2 + i * 8 - theirs.length * 4, y: 104, depth: 100 + i, up: false, mine: false }),
    );

    const hand = state.hands[mine] ?? [];
    const groups = this.ordered(hand);
    const gaps = groups.length ? groups[groups.length - 1]!.group : 0;
    const step = Math.min(CW * 0.7, (W - CW - 40 - gaps * MELD_GAP) / Math.max(1, groups.length - 1));
    const width = step * (groups.length - 1) + gaps * MELD_GAP;
    const canThrow = yours && state.phase === 'throw' && state.currentSeat === mine;
    groups.forEach(({ card, group }, i) => {
      const x = W / 2 - width / 2 + i * step + group * MELD_GAP;
      spots.set(card, { x, y: HAND_Y - (canThrow ? LIFT * 0.4 : 0), depth: 300 + i, up: yours, mine: canThrow });
    });
    return spots;
  }

  private onMove(): void {
    const state = this.state;
    this.privacy.turnChanged(state.currentSeat, state.result !== null);
    const event = state.last;
    const who = (seat?: number) => this.session.seats[seat ?? 0]?.label ?? 'They';
    if (event?.kind === 'hand' && state.showdown) {
      const show = state.showdown;
      if (show.dead) this.say('The stock ran out, so nobody scores');
      else if (show.gin) this.say(`Gin! ${who(show.knocker ?? 0)} takes ${Math.max(...show.scored)}`);
      else if (show.undercut) this.say(`Undercut! ${who(show.scored[0]! > 0 ? 0 : 1)} takes ${Math.max(...show.scored)}`);
      else this.say(`${who(show.knocker ?? 0)} knocks and takes ${Math.max(...show.scored)}`);
    } else if (event?.kind === 'take') {
      this.say(`${who(event.seat)} takes the upcard`);
    } else if (event?.kind === 'pass') {
      this.say(`${who(event.seat)} says no to it`);
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

    this.deckText?.setText(`${state.stock.length} left`);
    const mine = this.privacy.shown;
    const you = this.session.seats[mine];
    const them = this.session.seats[this.other()];
    this.seatText[0]?.setText(`${this.privacy.open ? 'You' : you?.label ?? 'You'} ${state.scores[mine]}`);
    this.seatText[1]?.setText(`${them?.label ?? 'They'} ${state.scores[this.other()]} · holding ${state.counts[this.other()]}`);
    const count = this.privacy.open ? deadwoodOf(state.hands[mine] ?? []) : 0;
    this.countText?.setText(this.privacy.open ? `Left over: ${count}${count <= KNOCK_AT ? ' · you can knock' : ''}` : '');
    this.privacy.draw();
    this.drawButtons();
    if (this.ring?.visible) this.showKeyFocus();
  }

  /** The buttons this turn needs: take or pass on the first turn, knock or gin when it is allowed. */
  private choices(): Button[] {
    const state = this.state;
    const mine = this.privacy.shown;
    if (state.result || !this.privacy.open || state.currentSeat !== mine) return [];
    if (state.phase === 'offer') {
      return [
        { label: 'Take it', move: ginTake, x: -110, color: COLORS.mint },
        { label: 'No thanks', move: ginPass, x: 110, color: COLORS.grape },
      ];
    }
    if (state.phase !== 'throw') return [];
    const knocks = state.legalMoves(mine).filter((move) => move[0] === 'k').map((move) => Number(move.slice(1)));
    if (!knocks.length) return [];
    // Knocking throws the card that leaves you holding the least, which is the knock you want.
    const best = knocks.reduce((low, card) =>
      deadwoodOf((state.hands[mine] ?? []).filter((held) => held !== card)) <
      deadwoodOf((state.hands[mine] ?? []).filter((held) => held !== low))
        ? card
        : low,
    );
    const left = deadwoodOf((state.hands[mine] ?? []).filter((held) => held !== best));
    return [{ label: left === 0 ? 'Gin!' : `Knock with ${left}`, move: ginKnock(best), x: 0, color: COLORS.mint }];
  }

  private drawButtons(): void {
    this.buttonRow?.destroy();
    this.buttonRow = undefined;
    this.buttons = this.choices();
    if (!this.buttons.length) return;
    const parts: GameObjects.GameObject[] = [];
    for (const button of this.buttons) {
      const chip = this.add.graphics();
      chip.fillStyle(toHex(button.color), 1);
      chip.fillRoundedRect(button.x - 100, -26, 200, 52, 26);
      parts.push(chip, sharpText(this, button.x, 0, button.label, 22, '#ffffff'));
    }
    this.buttonRow = this.add.container(W / 2, BUTTON_Y, parts).setDepth(4500);
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
      if (Math.abs(x - (W / 2 + button.x)) <= 100 && Math.abs(y - BUTTON_Y) <= 26) {
        this.play(button.move);
        return;
      }
    }
    if (state.currentSeat !== this.privacy.shown || !this.privacy.open) return;
    if (state.phase === 'draw') {
      if (Math.abs(y - PILE_Y) > CH / 2) return;
      if (Math.abs(x - DECK_X) <= CW / 2) this.play(ginDrawStock);
      else if (Math.abs(x - PILE_X) <= CW / 2) this.play(ginDrawDiscard);
      return;
    }
    if (state.phase !== 'throw') return;
    const found = this.hit(x, y);
    if (!found) return;
    if (!found.spot.mine) return;
    if (!state.legalMoves(this.privacy.shown).includes(ginDiscard(found.card))) {
      this.say('That is the card you just took');
      return;
    }
    this.play(ginDiscard(found.card));
  }

  private play(move: GinMove): void {
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
    if (state.result || !this.privacy.open || state.currentSeat !== this.privacy.shown || state.phase !== 'throw') return [];
    return state.legalMoves(this.privacy.shown).filter((move) => move[0] === 'x').map((move) => Number(move.slice(1)));
  }

  private key(key: string): boolean {
    if (this.privacy.lift()) {
      this.sync(true);
      return true;
    }
    const state = this.state;
    if (state.result) return false;
    // The two buttons answer to 1 and 2, and knocking answers to k.
    if (this.buttons.length && (key === '1' || key === '2')) {
      const button = this.buttons[key === '1' ? 0 : 1] ?? this.buttons[0]!;
      this.play(button.move);
      return true;
    }
    if (this.buttons.length && (isPress(key) || key === 'k')) {
      this.play(this.buttons[0]!.move);
      return true;
    }
    if (key === 'k' && this.buttons.length === 1) {
      this.play(this.buttons[0]!.move);
      return true;
    }
    if (state.phase === 'draw' && this.privacy.open && state.currentSeat === this.privacy.shown) {
      if (key === 'ArrowLeft' || key === '1') {
        this.play(ginDrawStock);
        return true;
      }
      if (key === 'ArrowRight' || key === '2' || isPress(key)) {
        this.play(state.legalMoves(this.privacy.shown).includes(ginDrawDiscard) ? ginDrawDiscard : ginDrawStock);
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
      this.play(ginDiscard(open.includes(this.keyCard) ? this.keyCard : open[0]!));
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
    const cards = [...this.spots.values()].map((spot) => ({ x: spot.x, y: spot.y, w: CW, h: CH }));
    const extra = [this.countText, this.banner, this.deckText].filter((text): text is GameObjects.Text => !!text);
    return labelReport([...this.seatText, ...extra], cards, W, H);
  }

  /** Test mode only: whose hand is on screen, whether it is covered, and how much of it shows. */
  handCheck(): { shown: number; covered: boolean; faceUp: number } {
    const mine = this.state.hands[this.privacy.shown] ?? [];
    return { shown: this.privacy.shown, covered: this.privacy.covered, faceUp: mine.filter((card) => this.views.get(card)?.up).length };
  }
}

export const ginStatus = (state: GinState): string | undefined => {
  if (state.result) return undefined;
  if (state.phase === 'offer') return 'Take the upcard, or say no to it';
  if (state.phase === 'draw') return 'Draw from the deck or the pile';
  return 'Throw one away, or knock';
};

export const ginResult = (state: GinState): string | undefined => {
  if (!state.result) return undefined;
  if (state.result.draw) return 'The stock ran out. Nobody scores.';
  return undefined;
};
