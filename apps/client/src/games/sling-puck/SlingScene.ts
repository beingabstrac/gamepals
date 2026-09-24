import {
  aimAt,
  BAND_Y,
  canGrab,
  countOn,
  MAX_PULL,
  newSlingPuck,
  slingSide,
  SLING_CANVAS,
  SLING_R,
  SLING_STEP,
  SLING_TIERS,
  SLING_TIME,
  SLING_WALL,
  slingBotInput,
  stepSling,
  type Seat,
  type SlingEvents,
  type SlingInput,
  type SlingShot,
  type SlingState,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { COLORS, DARK, toHex } from '../../theme';
import type { RealtimeSceneOptions } from '../air-hockey/AirHockeyScene';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed, SPEED } from '../../autoplay';
import { facing, isPerson, onDuelKeys } from '../duel';

export const SLING_SIZE = { width: SLING_CANVAS.width, height: SLING_CANVAS.height };
export const SLING_COLORS = [COLORS.sky, COLORS.tomato];

const W = SLING_CANVAS.width;
const H = SLING_CANVAS.height;
const SEAT_HEX = SLING_COLORS.map(toHex);
const BOARD = toHex('#F7E3C4');
const BOARD_DARK = toHex('#E8C99C');
const WOOD = toHex('#C98F5A');
const WOOD_DARK = toHex('#A8703F');
const PUCK = toHex(COLORS.ink);
/** Where each band is tied, a little in from the sides. */
const BAND_X = [44, W - 44];

interface Aim {
  readonly seat: Seat;
  readonly puck: number;
  pull: { x: number; y: number };
}

/**
 * Sling Puck. The rules slide and bounce the pucks; the scene draws the wooden board, the wall
 * and its slot, each player's band, and the band stretching back to a finger while a puck is
 * pulled. Every puck is the same dark wood: it is only yours while it is on your side.
 */
export class SlingScene extends Scene {
  private state: SlingState;
  private accumulator = 0;
  private ended = false;
  private aims = new Map<number, Aim>();
  private queued: [SlingShot | null, SlingShot | null] = [null, null];
  private since: [number, number] = [0, 0];
  private shots: [number, number] = [0, 0];
  /** The puck the keyboard has picked, per seat. */
  private picked: [number | null, number | null] = [null, null];
  private g!: GameObjects.Graphics;
  private counts: GameObjects.Text[] = [];
  private banner!: GameObjects.Text;
  private snap: [number, number] = [0, 0];

  constructor(private readonly options: RealtimeSceneOptions) {
    super('sling-puck');
    this.state = newSlingPuck(options.seed);
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.input.addPointer(3);
    this.drawBoard();
    this.g = this.add.graphics().setDepth(2);
    this.counts = [0, 1].map((seat) =>
      sharpText(this, W - 60, seat === 0 ? H - 34 : 34, '', 30, SLING_COLORS[seat]!)
        .setFontStyle('bold')
        .setDepth(3)
        .setAngle(facing(this.options.seats, seat as Seat)),
    );
    this.banner = sharpText(this, W / 2, H / 2 - 70, '', 50, COLORS.ink).setDepth(10).setFontStyle('bold').setStroke('#FFFFFF', 8);
    this.input.on('pointerdown', (p: { id: number; worldX: number; worldY: number }) => this.grab(p));
    this.input.on('pointermove', (p: { id: number; worldX: number; worldY: number }) => {
      const aim = this.aims.get(p.id);
      const puck = aim && this.state.pucks[aim.puck];
      if (aim && puck) aim.pull = { x: p.worldX - puck.x, y: p.worldY - puck.y };
    });
    const release = (p: { id: number }) => {
      const aim = this.aims.get(p.id);
      this.aims.delete(p.id);
      if (aim) this.queued[aim.seat] = { puck: aim.puck, pull: aim.pull };
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
    // Keyboard: Left/Right pick a puck on your side, Space (bottom) or Shift (top) fires it at the slot.
    onDuelKeys(this, this.options.seats, (seat, action) => {
      if (action === 'left' || action === 'right') this.pick(seat, action === 'left' ? -1 : 1);
      if (action === 'tap') {
        const i = this.picked[seat] ?? this.mine(seat)[0];
        if (i !== undefined && i !== null && canGrab(this.state, seat, i)) this.queued[seat] = aimAt(this.state, i);
      }
    });
    this.shout('Ready…');
    this.options.onScore([countOn(this.state, 1), countOn(this.state, 0)]);
  }

  /** Pucks `seat` could shoot, left to right. */
  private mine(seat: Seat): number[] {
    return this.state.pucks.flatMap((_, i) => (canGrab(this.state, seat, i) ? [i] : [])).sort((a, b) => this.state.pucks[a]!.x - this.state.pucks[b]!.x);
  }

  private pick(seat: Seat, step: number): void {
    const mine = this.mine(seat);
    if (!mine.length) return;
    const at = mine.indexOf(this.picked[seat] ?? -1);
    this.picked[seat] = mine[(at + step + mine.length) % mine.length]!;
    this.options.onCue('tap');
  }

  private grab(p: { id: number; worldX: number; worldY: number }): void {
    const seat = slingSide({ y: p.worldY });
    if (this.options.seats[seat]?.kind !== 'human' || this.state.phase !== 'play') return;
    // The nearest still puck of yours under the finger, with a little room to spare.
    let best = -1;
    let bestD = SLING_R + 22;
    this.state.pucks.forEach((q, i) => {
      const d = Math.hypot(q.x - p.worldX, q.y - p.worldY);
      if (d < bestD && canGrab(this.state, seat, i) && ![...this.aims.values()].some((a) => a.puck === i)) {
        best = i;
        bestD = d;
      }
    });
    if (best < 0) return;
    this.aims.set(p.id, { seat, puck: best, pull: { x: 0, y: 0 } });
    this.options.onCue('tap');
  }

  update(_time: number, delta: number): void {
    if (!this.ended) {
      this.accumulator += (Math.min(delta, 100) * SPEED) / 1000;
      while (this.accumulator >= SLING_STEP) {
        this.accumulator -= SLING_STEP;
        const was = this.state.phase;
        const inputs: [SlingInput, SlingInput] = [this.inputFor(0), this.inputFor(1)];
        const { state, events } = stepSling(this.state, inputs);
        this.state = state;
        this.since = [this.since[0] + SLING_STEP, this.since[1] + SLING_STEP];
        if (was === 'countdown' && state.phase === 'play') this.shout('Go!');
        this.handle(events);
        if (state.result) {
          this.ended = true;
          this.aims.clear();
          this.time.delayedCall(900, () => this.options.onEnd(state.result!));
          break;
        }
      }
    }
    // A grabbed puck knocked away (or over the wall) slips out of the band.
    for (const [id, aim] of this.aims) if (!canGrab(this.state, aim.seat, aim.puck)) this.aims.delete(id);
    this.snap = [this.snap[0] * 0.88, this.snap[1] * 0.88];
    this.draw();
  }

  private inputFor(seat: Seat): SlingInput {
    const controller = this.options.seats[seat];
    if (controller?.kind === 'bot') return slingBotInput(this.state, seat, SLING_TIERS[controller.tier], this.since[seat], this.shots[seat]);
    const shot = this.queued[seat];
    this.queued[seat] = null;
    return { shot };
  }

  // The score each side shows is how many pucks sit on the other side: higher is better, all ten wins.
  private handle(events: SlingEvents): void {
    for (const seat of events.shots) {
      this.since[seat] = 0;
      this.shots[seat]++;
      this.snap[seat] = 1;
      this.options.onCue('pull');
    }
    if (events.clack) this.options.onCue('clang');
    else if (events.thud) this.options.onCue('thud');
    if (events.crossed.length) {
      this.options.onCue('place');
      this.options.onScore([countOn(this.state, 1), countOn(this.state, 0)]);
    }
    if (this.state.result) {
      this.options.onCue('goal');
      const [winner] = this.state.result.winners;
      this.shout(winner === undefined ? 'Time! All square' : `${winner === 0 ? 'Blue' : 'Red'} clears it!`);
    }
  }

  private shout(text: string): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 700, duration: 250 });
  }

  private drawBoard(): void {
    const g = this.add.graphics();
    g.fillStyle(WOOD_DARK, 1);
    g.fillRoundedRect(0, 6, W, H - 6, 30);
    g.fillStyle(WOOD, 1);
    g.fillRoundedRect(0, 0, W, H - 6, 30);
    g.fillStyle(BOARD_DARK, 1);
    g.fillRoundedRect(12, 12, W - 24, H - 30, 22);
    g.fillStyle(BOARD, 1);
    g.fillRoundedRect(14, 14, W - 28, H - 34, 20);
    // Each half tinted a touch for its player.
    g.fillStyle(SEAT_HEX[1]!, 0.08);
    g.fillRect(14, 14, W - 28, SLING_WALL.y - 14);
    g.fillStyle(SEAT_HEX[0]!, 0.08);
    g.fillRect(14, SLING_WALL.y, W - 28, H - 20 - SLING_WALL.y);
    // The wall, in two pieces with the slot between.
    const top = SLING_WALL.y - SLING_WALL.half;
    const h = SLING_WALL.half * 2;
    g.fillStyle(WOOD_DARK, 1);
    g.fillRoundedRect(0, top + 4, SLING_WALL.slot0, h, 6);
    g.fillRoundedRect(SLING_WALL.slot1, top + 4, W - SLING_WALL.slot1, h, 6);
    g.fillStyle(WOOD, 1);
    g.fillRoundedRect(0, top, SLING_WALL.slot0, h, 6);
    g.fillRoundedRect(SLING_WALL.slot1, top, W - SLING_WALL.slot1, h, 6);
    // The pegs each band is tied to.
    for (const y of BAND_Y) for (const x of BAND_X) {
      g.fillStyle(WOOD_DARK, 1);
      g.fillCircle(x, y + 3, 11);
      g.fillStyle(WOOD, 1);
      g.fillCircle(x, y, 11);
    }
  }

  private draw(): void {
    const s = this.state;
    const g = this.g.clear();
    const aimed = new Map([...this.aims.values()].map((a) => [a.puck, a] as const));
    // Bands: straight across, or stretched back to the puck being pulled.
    for (const seat of [0, 1] as const) {
      const y = BAND_Y[seat];
      const aim = [...this.aims.values()].find((a) => a.seat === seat);
      const puck = aim && s.pucks[aim.puck];
      g.lineStyle(6, SEAT_HEX[seat]!, 1);
      if (aim && puck) {
        const len = Math.hypot(aim.pull.x, aim.pull.y);
        const k = len > MAX_PULL ? MAX_PULL / len : 1;
        const back = seat === 0 ? 1 : -1;
        const bx = puck.x + aim.pull.x * k;
        const by = puck.y + aim.pull.y * k + back * SLING_R;
        g.lineBetween(BAND_X[0]!, y, bx, by);
        g.lineBetween(bx, by, BAND_X[1]!, y);
      } else {
        // A twang after a shot: the band wobbles back to straight.
        const sag = Math.sin(this.snap[seat] * 20) * this.snap[seat] * 16;
        g.beginPath();
        g.moveTo(BAND_X[0]!, y);
        g.lineTo(W / 2, y + sag);
        g.lineTo(BAND_X[1]!, y);
        g.strokePath();
      }
    }
    // The clock: a bar across the slot that runs down, under the pucks.
    const left = s.clock / SLING_TIME;
    g.fillStyle(toHex(COLORS.line), 1);
    g.fillRoundedRect(SLING_WALL.slot0 + 6, SLING_WALL.y - 3, SLING_WALL.slot1 - SLING_WALL.slot0 - 12, 6, 3);
    g.fillStyle(toHex(left < 0.2 ? COLORS.tomato : COLORS.mint), 1);
    g.fillRoundedRect(SLING_WALL.slot0 + 6, SLING_WALL.y - 3, (SLING_WALL.slot1 - SLING_WALL.slot0 - 12) * left, 6, 3);
    // Pucks: wooden discs, drawn where they are being pulled back to.
    s.pucks.forEach((p, i) => {
      const aim = aimed.get(i);
      let x = p.x;
      let y = p.y;
      if (aim) {
        const len = Math.hypot(aim.pull.x, aim.pull.y);
        const k = len > MAX_PULL ? MAX_PULL / len : 1;
        x += aim.pull.x * k;
        y += aim.pull.y * k;
      }
      g.fillStyle(0x000000, 0.14);
      g.fillCircle(x + 3, y + 6, SLING_R);
      g.fillStyle(PUCK, 1);
      g.fillCircle(x, y, SLING_R);
      g.fillStyle(toHex(DARK.grape), 1);
      g.fillCircle(x, y, SLING_R - 7);
      g.fillStyle(0xffffff, 0.25);
      g.fillCircle(x - 8, y - 8, 6);
      const seat = slingSide(p);
      if (this.picked[seat] === i && isPerson(this.options.seats, seat) && canGrab(s, seat, i)) {
        g.lineStyle(5, toHex(COLORS.grape), 1);
        g.strokeCircle(x, y, SLING_R + 7);
      }
    });
    for (const seat of [0, 1] as const) this.counts[seat]!.setText(`${countOn(s, seat)} left`);
  }
}
