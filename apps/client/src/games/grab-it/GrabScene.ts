import {
  createRng,
  GRAB_CANVAS,
  GRAB_STEP,
  GRAB_TIERS,
  grabBotInput,
  newGrab,
  POINTS_TO_WIN_GRAB,
  showingPicture,
  stepGrab,
  type GrabEvents,
  type GrabInput,
  type GrabState,
  type Rng,
  type Seat,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { COLORS, DARK, toHex } from '../../theme';
import type { RealtimeSceneOptions } from '../air-hockey/AirHockeyScene';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed, SPEED } from '../../autoplay';
import { facing, isPerson, onDuelKeys, seatForY } from '../duel';
import { drawPicture } from '../tile-match/pictures';

export const GRAB_SIZE = { width: GRAB_CANVAS.width, height: GRAB_CANVAS.height };
export const GRAB_COLORS = [COLORS.sky, COLORS.tomato];

const W = GRAB_CANVAS.width;
const H = GRAB_CANVAS.height;
const SEAT_HEX = GRAB_COLORS.map(toHex);
const SEAT_DARK = [toHex(DARK.sky), toHex(DARK.tomato)];
/** Each player's grab pad, and the card showing the call beside it. */
const PAD_Y = [H - 150, 150];

/**
 * Grab It. The rules deal the calls and the flashes; the scene shows the call on a card at each end,
 * flashes the pictures on a stage in the middle with a pop each, and turns a tap in your half into a
 * grab. A right grab bursts; a wrong one shakes your pad and greys it for a moment.
 */
export class GrabScene extends Scene {
  private state: GrabState;
  private readonly rng: Rng;
  private accumulator = 0;
  private queued: [boolean, boolean] = [false, false];
  private rolls: [number, number] = [0.5, 0.5];
  private rolledFor = -1;
  private ended = false;
  private stage!: GameObjects.Container;
  private shown: number | null = null;
  private cards: GameObjects.Container[] = [];
  private shownCall = -1;
  private pads: GameObjects.Container[] = [];
  private dots: GameObjects.Graphics[] = [];
  private banner!: GameObjects.Text;

  constructor(private readonly options: RealtimeSceneOptions) {
    super('grab-it');
    this.rng = createRng(options.seed);
    this.state = newGrab(options.seed);
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.input.addPointer(3);
    const board = this.add.graphics();
    board.fillStyle(0xe6e0f4, 1);
    board.fillCircle(W / 2, H / 2 + 8, 120);
    board.fillStyle(0xffffff, 1);
    board.fillCircle(W / 2, H / 2, 120);
    this.stage = this.add.container(W / 2, H / 2).setDepth(4);
    this.pads = [0, 1].map((seat) => this.makePad(seat as Seat));
    this.cards = [0, 1].map((seat) => this.add.container(seat === 0 ? W - 90 : 90, PAD_Y[seat]!).setDepth(5).setAngle(facing(this.options.seats, seat as Seat)));
    this.dots = [0, 1].map(() => this.add.graphics().setDepth(5));
    this.banner = sharpText(this, W / 2, H / 2 + 175, '', 44, COLORS.ink).setDepth(10).setFontStyle('bold').setStroke('#FFFFFF', 8);

    this.input.on('pointerdown', (p: { worldY: number }) => {
      const seat = seatForY(p.worldY, H);
      if (this.options.seats[seat]?.kind === 'human') this.queued[seat] = true;
    });
    onDuelKeys(this, this.options.seats, (seat, action) => {
      if (action === 'tap') this.queued[seat] = true;
    });
    this.shout('Ready…');
    this.draw();
    this.options.onScore([0, 0]);
  }

  private makePad(seat: Seat): GameObjects.Container {
    const g = this.add.graphics();
    g.fillStyle(SEAT_DARK[seat]!, 1);
    g.fillRoundedRect(-150, -60 + 8, 300, 120, 40);
    g.fillStyle(SEAT_HEX[seat]!, 1);
    g.fillRoundedRect(-150, -60, 300, 120, 40);
    const label = sharpText(this, 0, -2, 'GRAB!', 44, '#FFFFFF').setFontStyle('bold');
    const pad = this.add.container(seat === 0 ? W / 2 - 60 : W / 2 + 60, PAD_Y[seat]!, [g, label]).setDepth(3);
    pad.setAngle(facing(this.options.seats, seat)).setVisible(isPerson(this.options.seats, seat) || !this.options.seats.some((s) => s.kind === 'human'));
    return pad;
  }

  private drawCall(): void {
    const target = this.state.call.target;
    this.cards.forEach((card) => {
      card.removeAll(true);
      const g = this.add.graphics();
      g.fillStyle(0xe6e0f4, 1);
      g.fillRoundedRect(-56, -64 + 6, 112, 128, 22);
      g.fillStyle(0xffffff, 1);
      g.fillRoundedRect(-56, -64, 112, 128, 22);
      const picture = this.add.graphics().setPosition(0, 6);
      drawPicture(picture, target, 38);
      const find = sharpText(this, 0, -46, 'Find', 18, COLORS.soft);
      card.add([g, picture, find]);
      card.setScale(0.6);
      this.tweens.add({ targets: card, scale: 1, duration: 240, ease: 'Back.easeOut' });
    });
  }

  update(_time: number, delta: number): void {
    if (!this.ended) {
      this.accumulator += (Math.min(delta, 100) * SPEED) / 1000;
      while (this.accumulator >= GRAB_STEP) {
        this.accumulator -= GRAB_STEP;
        if (this.state.flash !== this.rolledFor) {
          this.rolledFor = this.state.flash;
          this.rolls = [this.rng.next(), this.rng.next()];
        }
        const { state, events } = stepGrab(this.state, [this.inputFor(0), this.inputFor(1)]);
        this.state = state;
        this.handle(events);
        if (state.result) {
          this.ended = true;
          this.time.delayedCall(900, () => this.options.onEnd(state.result!));
          break;
        }
      }
    }
    this.draw();
  }

  private inputFor(seat: Seat): GrabInput {
    const controller = this.options.seats[seat];
    if (controller?.kind === 'bot') return grabBotInput(this.state, seat, GRAB_TIERS[controller.tier], this.rolls[seat]);
    const grab = this.queued[seat];
    this.queued[seat] = false;
    return { grab };
  }

  private handle(events: GrabEvents): void {
    if (events.point !== null) {
      this.options.onCue('win');
      this.options.onScore(this.state.scores);
      const pad = this.pads[events.point]!;
      this.tweens.add({ targets: pad, scale: 1.12, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
      this.burst(W / 2, H / 2, SEAT_HEX[events.point]!);
      this.shout(this.state.result ? 'Winner!' : 'Got it!');
    }
    for (const seat of events.wrong) {
      this.options.onCue('lose');
      this.options.onScore(this.state.scores);
      const pad = this.pads[seat]!;
      this.tweens.add({ targets: pad, x: pad.x + 10, duration: 50, yoyo: true, repeat: 3 });
    }
    if (events.missed) this.options.onCue('wall');
    if (events.newFlash) this.options.onCue('tap');
  }

  private burst(x: number, y: number, color: number): void {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const bit = this.add.circle(x, y, 9, color).setDepth(6);
      this.tweens.add({ targets: bit, x: x + Math.cos(a) * 150, y: y + Math.sin(a) * 150, alpha: 0, duration: 380, ease: 'Cubic.easeOut', onComplete: () => bit.destroy() });
    }
  }

  private shout(text: string): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 550, duration: 250 });
  }

  /** The stage, the call cards, the pads and the points, from the state. */
  private draw(): void {
    if (this.state.calls !== this.shownCall && this.state.phase !== 'countdown') {
      this.shownCall = this.state.calls;
      this.drawCall();
    }
    const picture = showingPicture(this.state);
    const key = picture === null ? null : this.state.calls * 100 + this.state.flash;
    if (key !== this.shown) {
      this.shown = key;
      this.stage.removeAll(true);
      if (picture !== null) {
        const g = this.add.graphics();
        drawPicture(g, picture, 80);
        this.stage.add(g);
        this.stage.setScale(0.4).setAngle(0);
        this.tweens.killTweensOf(this.stage);
        // Each picture pops onto the stage.
        this.tweens.add({ targets: this.stage, scale: 1, duration: 150, ease: 'Back.easeOut' });
      }
    }
    this.pads.forEach((pad, seat) => pad.setAlpha(this.state.frozen[seat]! > 0 ? 0.35 : 1));
    this.dots.forEach((dots, seat) => {
      dots.clear();
      const y = seat === 0 ? PAD_Y[0]! + 90 : PAD_Y[1]! - 90;
      for (let i = 0; i < POINTS_TO_WIN_GRAB; i++) {
        dots.fillStyle(i < this.state.scores[seat]! ? SEAT_HEX[seat]! : 0xe6e0f4, 1);
        dots.fillCircle(W / 2 + (i - (POINTS_TO_WIN_GRAB - 1) / 2) * 30, y, 10);
      }
    });
  }
}
