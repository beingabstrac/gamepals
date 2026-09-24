import {
  cardsLeft,
  newSpeed,
  speedNext,
  SPEED_HAND,
  SPEED_STEP,
  SPEED_TIERS,
  speedBotInput,
  speedView,
  stepSpeed,
  type Seat,
  type SpeedEvents,
  type SpeedInput,
  type SpeedPlay,
  type SpeedState,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { COLORS, toHex } from '../../theme';
import type { RealtimeSceneOptions } from '../air-hockey/AirHockeyScene';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed, SPEED } from '../../autoplay';
import { facing, isPerson, onDuelKeys } from '../duel';
import { drawSlot, flipTo, makeCard, placeAt, setFace, slideTo, type CardView } from '../cards/view';

export const SPEED_SIZE = { width: 600, height: 900 };
export const SPEED_COLORS = [COLORS.sky, COLORS.tomato];

const W = 600;
const H = 900;
const CW = 92;
const CH = 128;
const PILE_X = [215, 385] as const;
const SIDE_X = [70, 530] as const;
const MID_Y = H / 2;
const HAND_Y = [770, 130] as const;
const DRAW_XY = [
  { x: 530, y: 610 },
  { x: 70, y: 290 },
] as const;
const slotX = (seat: Seat, slot: number) => (seat === 0 ? W / 2 + (slot - 2) * 108 : W / 2 - (slot - 2) * 108);

/**
 * Speed. The rules run the race; the scene lays every card where it belongs each step (hands in
 * each player's half, the two piles and side stacks across the middle) and slides the ones that
 * moved. Drag a card onto a pile, or just tap it to put it on a pile it fits.
 */
export class SpeedScene extends Scene {
  private state: SpeedState;
  private accumulator = 0;
  private ended = false;
  private views = new Map<number, CardView>();
  private queued: [SpeedPlay | null, SpeedPlay | null] = [null, null];
  private waited: [number, number] = [0, 0];
  private seen: [string, string] = ['', ''];
  private roll: [number, number] = [0.5, 0.5];
  private picked: [number, number] = [2, 2];
  private held: { seat: Seat; slot: number; id: number } | null = null;
  private counts: GameObjects.Text[] = [];
  private banner!: GameObjects.Text;
  private ring!: GameObjects.Graphics;
  private steps = 0;
  /** The ring only shows once someone plays with keys; a finger never needs it. */
  private keyed = false;

  constructor(private readonly options: RealtimeSceneOptions) {
    super('speed');
    this.state = newSpeed(options.seed);
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.input.addPointer(3);
    const g = this.add.graphics();
    g.fillStyle(toHex(COLORS.sky), 0.06);
    g.fillRect(0, MID_Y, W, H / 2);
    g.fillStyle(toHex(COLORS.tomato), 0.06);
    g.fillRect(0, 0, W, H / 2);
    for (const x of PILE_X) drawSlot(g, x, MID_Y, CW, CH, toHex(COLORS.line));
    this.ring = this.add.graphics().setDepth(900);
    this.counts = [0, 1].map((seat) =>
      sharpText(this, seat === 0 ? DRAW_XY[0].x : DRAW_XY[1].x, seat === 0 ? DRAW_XY[0].y + 88 : DRAW_XY[1].y - 88, '', 22, COLORS.soft)
        .setFontStyle('bold')
        .setAngle(facing(this.options.seats, seat as Seat)),
    );
    this.banner = sharpText(this, W / 2, MID_Y - 110, '', 44, COLORS.ink).setDepth(2000).setFontStyle('bold').setStroke('#FFFFFF', 8);
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      this.keyed = false;
      this.grab(p.worldX, p.worldY);
    });
    this.input.on('pointermove', (p: { worldX: number; worldY: number; isDown: boolean }) => {
      if (!this.held || !p.isDown) return;
      const view = this.views.get(this.held.id);
      view?.box.setPosition(p.worldX, p.worldY);
    });
    this.input.on('pointerup', (p: { worldX: number; worldY: number }) => this.letGo(p.worldX, p.worldY));
    onDuelKeys(this, this.options.seats, (seat, action) => {
      this.keyed = true;
      if (action === 'left' || action === 'right') this.picked[seat] = (this.picked[seat] + (action === 'left' ? SPEED_HAND - 1 : 1)) % SPEED_HAND;
      if (action === 'tap') this.queued[seat] = this.autoPlay(seat, this.picked[seat]);
      if (action === 'up' || action === 'down') this.queued[seat] = { slot: this.picked[seat], pile: action === 'up' ? 0 : 1 };
    });
    this.layout(true);
    this.shout('Ready…');
    this.options.onScore([cardsLeft(this.state, 0), cardsLeft(this.state, 1)]);
  }

  /** The pile a tapped card goes on: the first it fits, or none. */
  private autoPlay(seat: Seat, slot: number): SpeedPlay | null {
    const card = this.state.hands[seat][slot];
    if (card === null || card === undefined) return null;
    for (const pile of [0, 1] as const) if (speedNext(card, this.state.piles[pile].at(-1)!)) return { slot, pile };
    return { slot, pile: 0 };
  }

  private grab(x: number, y: number): void {
    const seat: Seat = y > MID_Y ? 0 : 1;
    if (!isPerson(this.options.seats, seat) || this.state.phase !== 'play') return;
    const slot = [...Array(SPEED_HAND).keys()].find((s) => Math.abs(x - slotX(seat, s)) < CW / 2 + 6 && Math.abs(y - HAND_Y[seat]) < CH / 2 + 10);
    const card = slot === undefined ? null : this.state.hands[seat][slot];
    if (slot === undefined || card === null || card === undefined) return;
    this.held = { seat, slot, id: card };
    this.picked[seat] = slot;
    this.views.get(card)?.box.setDepth(1500);
  }

  private letGo(x: number, y: number): void {
    const held = this.held;
    this.held = null;
    if (!held) return;
    // Let go over a pile: that pile. Let go where it started (a tap): the pile it fits.
    const pile = ([0, 1] as const).find((p) => Math.abs(x - PILE_X[p]) < CW * 0.75 && Math.abs(y - MID_Y) < CH * 0.75);
    this.queued[held.seat] = pile !== undefined ? { slot: held.slot, pile } : this.autoPlay(held.seat, held.slot);
    this.layout(false);
  }

  update(_time: number, delta: number): void {
    if (!this.ended) {
      this.accumulator += (Math.min(delta, 100) * SPEED) / 1000;
      let changed = false;
      while (this.accumulator >= SPEED_STEP) {
        this.accumulator -= SPEED_STEP;
        this.steps++;
        for (const seat of [0, 1] as const) {
          const view = speedView(this.state, seat);
          if (view !== this.seen[seat]) {
            this.seen[seat] = view;
            this.waited[seat] = 0;
            this.roll[seat] = ((Math.imul(this.steps + seat * 7919 + this.options.seed, 0x9e3779b1) >>> 0) % 1000) / 1000;
          } else this.waited[seat] += SPEED_STEP;
        }
        const was = this.state.phase;
        const { state, events } = stepSpeed(this.state, [this.inputFor(0), this.inputFor(1)]);
        this.state = state;
        if (was === 'countdown' && state.phase === 'play') this.shout('Go!');
        if (this.handle(events)) changed = true;
        if (state.result) {
          this.ended = true;
          const [winner] = state.result.winners;
          this.shout(winner === undefined ? 'Dead heat!' : `${winner === 0 ? 'Blue' : 'Red'} wins!`);
          this.time.delayedCall(1200, () => this.options.onEnd(state.result!));
          break;
        }
      }
      if (changed) this.layout(false);
    }
    this.drawRing();
  }

  private inputFor(seat: Seat): SpeedInput {
    const controller = this.options.seats[seat];
    if (controller?.kind === 'bot') return speedBotInput(this.state, seat, SPEED_TIERS[controller.tier], this.waited[seat], this.roll[seat]);
    const play = this.queued[seat];
    this.queued[seat] = null;
    return { play };
  }

  private handle(events: SpeedEvents): boolean {
    for (const p of events.played) {
      this.options.onCue('place');
      if (this.held?.seat === p.seat && this.held.slot === p.slot) this.held = null;
    }
    if (events.missed.some((s) => isPerson(this.options.seats, s))) this.options.onCue('buzz');
    if (events.flipped) {
      this.options.onCue('roll');
      this.shout(events.reshuffled ? 'Shuffle!' : 'Flip!');
    }
    if (events.played.length) this.options.onScore([cardsLeft(this.state, 0), cardsLeft(this.state, 1)]);
    return events.played.length > 0 || events.flipped || events.missed.length > 0;
  }

  private shout(text: string): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setAlpha(1).setScale(0.6).setAngle(facing(this.options.seats, 0));
    this.tweens.add({ targets: this.banner, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 600, duration: 250 });
  }

  private view(card: number, fromX: number, fromY: number): CardView {
    let v = this.views.get(card);
    if (!v) {
      v = makeCard(this, card, CW, CH);
      placeAt(v, fromX, fromY, 10);
      this.views.set(card, v);
    }
    return v;
  }

  /** Puts every card that can be seen where it belongs, sliding the ones that moved. */
  private layout(instant: boolean): void {
    const s = this.state;
    const want = new Set<number>();
    const put = (card: number, x: number, y: number, depth: number, up: boolean, angle: number, from: { x: number; y: number }) => {
      want.add(card);
      const v = this.view(card, from.x, from.y);
      if (this.held?.id === card) return;
      v.box.setAngle(angle);
      if (instant) {
        placeAt(v, x, y, depth);
        setFace(v, up);
      } else {
        slideTo(this, v, x, y, depth, { duration: 160 });
        if (v.up !== up) flipTo(this, v, up);
      }
    };
    for (const seat of [0, 1] as const) {
      // A bot's hand stays face down: nobody needs to read it, and it never cheats by it either.
      const up = isPerson(this.options.seats, seat) || !this.options.seats.some((c) => c.kind === 'human');
      const angle = seat === 1 && this.options.seats.filter((c) => c.kind === 'human').length === 2 ? 180 : 0;
      s.hands[seat].forEach((card, slot) => card !== null && put(card, slotX(seat, slot), HAND_Y[seat], 100 + slot, up, angle, DRAW_XY[seat]));
      const draw = s.draws[seat];
      if (draw.length) put(draw[0]!, DRAW_XY[seat].x, DRAW_XY[seat].y, 50, false, 0, DRAW_XY[seat]);
      this.counts[seat]!.setText(`${cardsLeft(s, seat)} to go`);
    }
    for (const p of [0, 1] as const) {
      const pile = s.piles[p];
      pile.slice(-3).forEach((card, k, list) => put(card, PILE_X[p] + (k - list.length + 1) * 3, MID_Y + (k - list.length + 1) * 3, 300 + pile.length - list.length + k, true, 0, { x: SIDE_X[p], y: MID_Y }));
      const side = s.sides[p];
      if (side.length) put(side[side.length - 1]!, SIDE_X[p], MID_Y, 60, false, 0, { x: SIDE_X[p], y: MID_Y });
    }
    for (const [card, v] of this.views) {
      if (want.has(card)) continue;
      v.box.destroy();
      this.views.delete(card);
    }
  }

  /** A grape ring round the card the keys have picked, for a person on a keyboard. */
  private drawRing(): void {
    const g = this.ring.clear();
    if (!this.keyed) return;
    for (const seat of [0, 1] as const) {
      if (!isPerson(this.options.seats, seat) || (this.state.hands[seat][this.picked[seat]] ?? null) === null) continue;
      g.lineStyle(5, toHex(COLORS.grape), 0.9);
      g.strokeRoundedRect(slotX(seat, this.picked[seat]) - CW / 2 - 6, HAND_Y[seat] - CH / 2 - 6, CW + 12, CH + 12, 16);
    }
  }
}
