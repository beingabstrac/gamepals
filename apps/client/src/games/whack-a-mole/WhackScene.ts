import {
  createRng,
  WHACK_HOLES,
  newWhack,
  ROUND_SECONDS,
  showing,
  stepWhack,
  WHACK_CANVAS,
  WHACK_STEP,
  WHACK_TIERS,
  whackBotInput,
  type Popper,
  type Rng,
  type Seat,
  type WhackEvents,
  type WhackInput,
  type WhackState,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { COLORS, DARK, toHex } from '../../theme';
import type { RealtimeSceneOptions } from '../air-hockey/AirHockeyScene';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed, SPEED } from '../../autoplay';
import { facing, isPerson, seatForY } from '../duel';
import { onKeys } from '../keys';

export const WHACK_SIZE = { width: WHACK_CANVAS.width, height: WHACK_CANVAS.height };
export const WHACK_COLORS = [COLORS.sky, COLORS.tomato];

const W = WHACK_CANVAS.width;
const H = WHACK_CANVAS.height;
const SEAT_HEX = WHACK_COLORS.map(toHex);
/** Hole spacing on a board, and each board's middle. */
const DX = 160;
const DY = 118;
const BOARD_Y = [H - 230, 230];
const HOLE_R = 52;
/** The keys for each board, laid out as the player sees it, top row first. */
const KEYS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
  ['q', 'w', 'e', 'a', 's', 'd', 'z', 'x', 'c'],
];

interface HoleView {
  readonly critter: GameObjects.Container;
  shown: number | null;
}

/**
 * Whack-a-Mole. The rules deal the moles and keep the score; the scene draws two boards of nine
 * holes, pops each mole up with a squash when the rules say it is up, and turns taps and keys into
 * whacks. The top board is turned round only when a second person sits there.
 */
export class WhackScene extends Scene {
  private state: WhackState;
  private readonly rng: Rng;
  private readonly rolls = new Map<string, number>();
  private accumulator = 0;
  private queued: [number | null, number | null] = [null, null];
  private ended = false;
  private holes: HoleView[][] = [];
  private clockBar!: GameObjects.Graphics;
  private banner!: GameObjects.Text;
  private shownPhase = '';

  constructor(private readonly options: RealtimeSceneOptions) {
    super('whack-a-mole');
    this.rng = createRng(options.seed);
    this.state = newWhack(options.seed);
  }

  /** Where hole `i` of `seat`'s board is drawn, as that player sees it: top row first. */
  private spot(seat: Seat, i: number): { x: number; y: number } {
    const col = (i % 3) - 1;
    const row = Math.floor(i / 3) - 1;
    const turned = this.turned(seat);
    return { x: W / 2 + (turned ? -col : col) * DX, y: BOARD_Y[seat]! + (turned ? -row : row) * DY };
  }

  /** The top board is turned round only for a second person sitting there. */
  private turned(seat: Seat): boolean {
    return seat === 1 && facing(this.options.seats, seat) === 180;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.input.addPointer(3);
    const g = this.add.graphics();
    // Two lawns, one each, split by the clock.
    g.fillStyle(toHex(COLORS.mint), 1);
    g.fillRoundedRect(20, H / 2 + 24, W - 40, H / 2 - 44, 30);
    g.fillRoundedRect(20, 20, W - 40, H / 2 - 44, 30);
    this.clockBar = this.add.graphics();
    this.holes = [0, 1].map((seat) =>
      Array.from({ length: WHACK_HOLES }, (_, i) => {
        const { x, y } = this.spot(seat as Seat, i);
        // A turned board is drawn upside down: the hole's front lip is on the far side from us.
        const f = this.turned(seat as Seat) ? -1 : 1;
        const back = this.add.graphics();
        back.fillStyle(toHex(DARK.mint), 1);
        back.fillEllipse(x, y + 18 * f, HOLE_R * 2.2, HOLE_R * 1.1);
        back.fillStyle(0x3b2a1a, 1);
        back.fillEllipse(x, y + 16 * f, HOLE_R * 1.8, HOLE_R * 0.8);
        const critter = this.add.container(x, y + 30 * f, []).setVisible(false).setDepth(2);
        // The front lip of the hole, drawn over the critter so it rises out of the ground.
        const lip = this.add.graphics().setDepth(3);
        const lipTop = f === 1 ? y + 18 : y - 18 - HOLE_R * 0.9;
        lip.fillStyle(toHex(DARK.mint), 1);
        lip.fillRect(x - HOLE_R * 1.1, lipTop, HOLE_R * 2.2, HOLE_R * 0.9);
        lip.fillStyle(toHex(COLORS.mint), 1);
        lip.fillRect(x - HOLE_R * 1.1, f === 1 ? lipTop + HOLE_R * 0.55 : lipTop, HOLE_R * 2.2, HOLE_R * 0.4);
        return { critter, shown: null };
      }),
    );
    for (const seat of [0, 1] as const) {
      const hint = sharpText(this, W / 2, seat === 0 ? H - 44 : 44, 'Whack the moles. Not the bombs!', 22, COLORS.ink).setDepth(6);
      hint.setAngle(facing(this.options.seats, seat)).setVisible(isPerson(this.options.seats, seat));
      this.tweens.add({ targets: hint, alpha: 0, delay: 4000, duration: 600 });
    }
    this.banner = sharpText(this, W / 2, H / 2, '', 60, COLORS.ink).setDepth(10).setFontStyle('bold');

    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      const seat = seatForY(p.worldY, H);
      if (this.options.seats[seat]?.kind !== 'human') return;
      let best = -1;
      let near = HOLE_R * 1.6;
      for (let i = 0; i < WHACK_HOLES; i++) {
        const s = this.spot(seat, i);
        const d = Math.hypot(p.worldX - s.x, p.worldY - s.y);
        if (d < near) {
          near = d;
          best = i;
        }
      }
      if (best >= 0) this.queued[seat] = best;
    });
    onKeys(this, (key) => {
      const k = key.toLowerCase();
      for (const board of [0, 1] as const) {
        const i = KEYS[board]!.indexOf(k);
        if (i < 0) continue;
        // The number keys belong to whoever is at the bottom; the letters to the top.
        const seat: Seat = isPerson(this.options.seats, board) ? board : isPerson(this.options.seats, 1 - board) ? ((1 - board) as Seat) : board;
        if (this.options.seats[seat]?.kind !== 'human') return false;
        this.queued[seat] = i;
        return true;
      }
      return false;
    });
    this.draw();
    this.options.onScore([0, 0]);
  }

  private makeCritter(kind: Popper): GameObjects.GameObject[] {
    const g = this.add.graphics();
    if (kind === 'bomb') {
      g.fillStyle(toHex(COLORS.ink), 1);
      g.fillCircle(0, -26, 34);
      g.fillStyle(0xffffff, 0.3);
      g.fillCircle(-11, -38, 8);
      g.lineStyle(5, toHex(COLORS.peach), 1);
      g.lineBetween(12, -56, 22, -70);
      g.fillStyle(toHex(COLORS.sunny), 1);
      g.fillCircle(23, -73, 6);
      return [g];
    }
    const fur = kind === 'gold' ? toHex(COLORS.sunny) : 0xa8744a;
    g.fillStyle(fur, 1);
    g.fillRoundedRect(-34, -64, 68, 90, 32);
    g.fillStyle(0xffe0c2, 1);
    g.fillEllipse(0, -18, 40, 30);
    g.fillStyle(toHex(COLORS.ink), 1);
    g.fillCircle(-13, -38, 5);
    g.fillCircle(13, -38, 5);
    g.fillStyle(toHex(COLORS.bubblegum), 1);
    g.fillEllipse(0, -24, 14, 10);
    g.fillStyle(0xffffff, 1);
    g.fillRect(-5, -16, 4, 7);
    g.fillRect(1, -16, 4, 7);
    const parts: GameObjects.GameObject[] = [g];
    if (kind === 'gold') {
      const shine = this.add.graphics();
      shine.fillStyle(0xffffff, 0.8);
      shine.fillCircle(-20, -52, 5);
      shine.fillCircle(24, -46, 3);
      parts.push(shine);
    }
    return parts;
  }

  private rollFor(seat: Seat) {
    return (pop: number) => {
      const key = `${seat}:${pop}`;
      if (!this.rolls.has(key)) this.rolls.set(key, this.rng.next());
      return this.rolls.get(key)!;
    };
  }

  private inputFor(seat: Seat): WhackInput {
    const controller = this.options.seats[seat];
    if (controller?.kind === 'bot') return whackBotInput(this.state, seat, WHACK_TIERS[controller.tier], this.rollFor(seat));
    const hole = this.queued[seat];
    this.queued[seat] = null;
    return { hole };
  }

  update(_time: number, delta: number): void {
    if (!this.ended) {
      this.accumulator += (Math.min(delta, 100) * SPEED) / 1000;
      while (this.accumulator >= WHACK_STEP) {
        this.accumulator -= WHACK_STEP;
        const { state, events } = stepWhack(this.state, [this.inputFor(0), this.inputFor(1)]);
        this.state = state;
        this.handle(events);
        if (state.result) {
          this.ended = true;
          this.shout('Time!');
          this.time.delayedCall(900, () => this.options.onEnd(state.result!));
          break;
        }
      }
    }
    if (this.state.phase !== this.shownPhase) {
      if (this.state.phase === 'round') this.shout('Go!');
      if (this.state.phase === 'countdown') this.shout('Ready…');
      this.shownPhase = this.state.phase;
    }
    this.draw();
  }

  private handle(events: WhackEvents): void {
    for (const hit of events.hits) {
      const view = this.holes[hit.seat]![hit.hole]!;
      const { x, y } = this.spot(hit.seat, hit.hole);
      this.burst(x, y - 30, hit.kind);
      if (hit.kind === 'bomb') {
        this.options.onCue('thud');
        this.cameras.main.shake(200, 0.012);
      } else this.options.onCue(hit.kind === 'gold' ? 'win' : 'hit');
      // Bonked: it squashes flat and drops back in.
      this.tweens.killTweensOf(view.critter);
      this.tweens.add({ targets: view.critter, scaleY: 0.4, scaleX: 1.3, y: y + (this.turned(hit.seat) ? -30 : 30), duration: 140, ease: 'Quad.easeIn', onComplete: () => view.critter.setVisible(false).setScale(1) });
      view.shown = null;
    }
    if (events.hits.length > 0) this.options.onScore(this.state.scores);
    for (const miss of events.misses) {
      const { x, y } = this.spot(miss.seat, miss.hole);
      const puff = this.add.circle(x, y + 10, 16, 0xffffff, 0.6).setDepth(4);
      this.tweens.add({ targets: puff, scale: 2, alpha: 0, duration: 260, onComplete: () => puff.destroy() });
    }
  }

  private burst(x: number, y: number, kind: Popper): void {
    const color = kind === 'bomb' ? toHex(COLORS.tomato) : kind === 'gold' ? toHex(COLORS.sunny) : 0xffffff;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const bit = this.add.circle(x, y, kind === 'bomb' ? 12 : 7, color).setDepth(5);
      this.tweens.add({ targets: bit, x: x + Math.cos(a) * 60, y: y + Math.sin(a) * 60, alpha: 0, scale: 0.4, duration: 300, ease: 'Cubic.easeOut', onComplete: () => bit.destroy() });
    }
    const label = kind === 'bomb' ? '-2' : kind === 'gold' ? '+3' : '+1';
    const pop = sharpText(this, x, y - 20, label, 34, kind === 'bomb' ? COLORS.tomato : COLORS.ink).setFontStyle('bold').setStroke('#FFFFFF', 6).setDepth(7);
    this.tweens.add({ targets: pop, y: y - 70, alpha: 0, duration: 650, onComplete: () => pop.destroy() });
  }

  private shout(text: string): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 600, duration: 300 });
  }

  /** Every hole as the rules have it now: whatever is up pops out, whatever has gone ducks back. */
  private draw(): void {
    for (const seat of [0, 1] as const) {
      const turned = this.turned(seat);
      for (let i = 0; i < WHACK_HOLES; i++) {
        const view = this.holes[seat]![i]!;
        const index = showing(this.state, seat, i);
        if (index === view.shown) continue;
        const { x, y } = this.spot(seat, i);
        if (index !== null) {
          const pop = this.state.pops[index]!;
          view.critter.removeAll(true);
          view.critter.add(this.makeCritter(pop.kind));
          view.critter.setAngle(turned ? 180 : 0).setVisible(true).setScale(1).setPosition(x, y + (turned ? -30 : 30));
          this.tweens.killTweensOf(view.critter);
          // Up it pops, stretching as it comes and settling with a squash.
          this.tweens.add({ targets: view.critter, y: y + (turned ? 6 : -6), scaleY: { from: 0.6, to: 1 }, duration: 160, ease: 'Back.easeOut' });
        } else if (view.shown !== null) {
          this.tweens.killTweensOf(view.critter);
          this.tweens.add({ targets: view.critter, y: y + (turned ? -30 : 30), duration: 120, ease: 'Quad.easeIn', onComplete: () => view.critter.setVisible(false) });
        }
        view.shown = index;
      }
    }
    // The clock between the lawns runs down from both ends toward the middle.
    const left = this.state.phase === 'round' ? 1 - this.state.clock / ROUND_SECONDS : this.state.phase === 'over' ? 0 : 1;
    const g = this.clockBar.clear();
    g.fillStyle(0xe6e0f4, 1);
    g.fillRoundedRect(40, H / 2 - 8, W - 80, 16, 8);
    g.fillStyle(left < 0.2 ? toHex(COLORS.tomato) : SEAT_HEX[0]!, 1);
    g.fillRoundedRect(W / 2 - ((W - 80) / 2) * left, H / 2 - 8, (W - 80) * left, 16, 8);
  }
}
