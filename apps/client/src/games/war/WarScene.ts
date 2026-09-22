import { WAR_BATTLES, WAR_FLIP, type WarMove, type WarState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import type { Session } from '../../session';
import { COLORS } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { drawSlot, makeCard, placeAt, setFace, slideTo, stopSlide, type CardView } from '../cards/view';
import { focusRing, isPress, moveRing, onKeys } from '../keys';

const W = 720;
const H = 860;
export const WAR_SIZE = { width: W, height: H };

const CW = 96;
const CH = 135;
const TABLE = 0xffe0e0;
const SLOT = 0xf0a0a0;
const MOVE_MS = 240;
/** The two stacks, and the row where the battle happens. */
const STACK_Y = [H - CH / 2 - 40, CH / 2 + 40];
const BATTLE_Y = [H / 2 + 60, H / 2 - 60];
const STACK_X = 110;
const BATTLE_X = W / 2;
export const WAR_COLORS = [COLORS.sky, COLORS.tomato];
export const WAR_NAMES = ['Blue', 'Red'];

export class WarScene extends Scene {
  private views = new Map<number, CardView>();
  private countText: GameObjects.Text[] = [];
  private banner?: GameObjects.Text;
  private ring?: GameObjects.Graphics;

  constructor(private readonly session: Session<WarMove>) {
    super('war');
  }

  private get state(): WarState {
    return this.session.state as WarState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    const g = this.add.graphics();
    g.fillStyle(TABLE, 1);
    g.fillRoundedRect(0, 0, W, H, 28);
    for (const seat of [0, 1]) {
      drawSlot(g, STACK_X, STACK_Y[seat]!, CW, CH, SLOT);
      this.countText.push(sharpText(this, STACK_X, STACK_Y[seat]! + (seat === 0 ? CH / 2 + 22 : -CH / 2 - 22), '', 24, '#b3474a').setDepth(4000));
    }
    this.banner = sharpText(this, W / 2, H / 2, '', 52, '#b3474a').setVisible(false).setDepth(4000);

    for (let card = 0; card < 52; card++) {
      const view = makeCard(this, card, CW, CH);
      view.box.setPosition(STACK_X, STACK_Y[0]!);
      this.views.set(card, view);
    }
    this.sync(false);

    this.input.on('pointerdown', () => this.flip());
    this.ring = focusRing(this, CW + 12, CH + 12, 16);
    onKeys(this, (key) => (isPress(key) ? (this.flip(), true) : false));
    const off = this.session.subscribe(() => this.sync(true));
    this.events.once('shutdown', off);
  }

  private flip(): void {
    const state = this.state;
    if (state.result) return;
    if (state.legalMoves(state.currentSeat).includes(WAR_FLIP)) this.session.play(WAR_FLIP);
  }

  /**
   * Whether every card is drawn where the rules keep it: down on its owner's stack, or out in the
   * middle if it has been turned over this round. The question is which pile a card is on, not
   * which pixel: a stack is a fan and the middle is a row, so exact positions are the layout's
   * business and only the side it landed on says whether the board agrees with the rules.
   */
  boardCheck(): { settled: number; wrong: number; note: string } {
    const state = this.state;
    const shown = state.last?.shown ?? [[], []];
    let settled = 0;
    let wrong = 0;
    let note = '';
    const look = (card: number, where: string, ok: (x: number, y: number) => boolean) => {
      const view = this.views.get(card);
      if (!view) {
        wrong++;
        note = `card ${card} belongs ${where} and is not drawn`;
        return;
      }
      if (view.sliding || this.tweens.getTweensOf(view.box).length > 0) return;
      settled++;
      if (!ok(view.box.x, view.box.y)) {
        wrong++;
        note = `card ${card} belongs ${where} and rests at ${Math.round(view.box.x)},${Math.round(view.box.y)}`;
      }
    };
    for (const seat of [0, 1]) {
      const stackY = STACK_Y[seat]!;
      const battleY = BATTLE_Y[seat]!;
      state.stacks[seat]!.forEach((card) =>
        look(card, `on seat ${seat}'s stack`, (x, y) => Math.abs(x - STACK_X) < 4 && Math.abs(y - stackY) < 60),
      );
      shown[seat]!.forEach((card) =>
        look(card, `in the middle for seat ${seat}`, (x, y) => Math.abs(y - battleY) < 4 && Math.abs(x - BATTLE_X) < 220),
      );
    }
    return { settled, wrong, note };
  }

  private sync(animate: boolean): void {
    const state = this.state;
    const shown = state.last?.shown ?? [[], []];
    for (const seat of [0, 1]) {
      // The stack: face down, the next card on top.
      state.stacks[seat]!.forEach((card, i) => {
        const view = this.views.get(card)!;
        setFace(view, false);
        placeAt(view, STACK_X, STACK_Y[seat]! - i * 0.35, i);
        view.box.setVisible(true);
      });
      // What was turned over this round, in a row towards the middle.
      shown[seat]!.forEach((card, i) => {
        const view = this.views.get(card)!;
        const last = i === shown[seat]!.length - 1;
        // In a war the cards that decide it are the ones you can see.
        setFace(view, last || i === 0);
        const x = BATTLE_X + i * 52 - (shown[seat]!.length - 1) * 26;
        if (animate) slideTo(this, view, x, BATTLE_Y[seat]!, 500 + i, { duration: MOVE_MS });
        else placeAt(view, x, BATTLE_Y[seat]!, 500 + i);
        view.box.setVisible(true);
      });
    }
    this.countText.forEach((text, seat) => text.setText(`${this.session.seats[seat]?.label ?? seat + 1}: ${state.counts[seat]}`));

    const wars = state.last?.wars ?? 0;
    if (wars && animate) {
      this.banner?.setText('WAR!').setVisible(true).setAlpha(1).setScale(0.6);
      this.tweens.add({ targets: this.banner, scale: 1, duration: 320, ease: 'Back.easeOut' });
      this.tweens.add({ targets: this.banner, alpha: 0, delay: 700, duration: 400 });
      this.cameras.main.shake(180, 0.006);
    } else this.banner?.setVisible(false);
    if (state.result && animate) this.celebrate();
    else if (this.ring?.visible) moveRing(this, this.ring, STACK_X, STACK_Y[state.currentSeat] ?? STACK_Y[0]!);
  }

  /** Winning: the whole deck gathers to the winner's end of the table. */
  private celebrate(): void {
    const winner = this.state.result?.winners[0] ?? 0;
    let i = 0;
    for (const [card, view] of this.views) {
      stopSlide(this, view);
      const delay = i * 14;
      this.tweens.add({ targets: view.box, x: STACK_X, y: STACK_Y[winner] ?? STACK_Y[0]!, duration: 600, delay, ease: 'Cubic.easeInOut' });
      this.tweens.add({ targets: view.box, angle: (card % 7) - 3, duration: 600, delay });
      i++;
    }
  }
}

export const warStatus = (state: WarState): string | undefined => {
  if (state.result) return undefined;
  const left = WAR_BATTLES - state.battles;
  const tight = state.counts[0] === state.counts[1];
  if (left <= 40) return `${left} battles left · ${state.counts[0]} to ${state.counts[1]}`;
  return tight ? `Level, ${state.counts[0]} each` : `${state.counts[0]} to ${state.counts[1]}`;
};

/** A game that ran out of battles says so; anything else takes the usual headline. */
export const warResult = (state: WarState): string | undefined =>
  state.result?.draw && state.battles >= WAR_BATTLES ? `Time! ${state.counts[0]} cards each.` : undefined;
