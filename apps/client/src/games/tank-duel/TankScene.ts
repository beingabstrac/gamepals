import {
  newTankDuel,
  SHELL_R,
  stepTank,
  TANK_CANVAS,
  TANK_R,
  TANK_STEP,
  TANK_TIERS,
  TANK_WALLS,
  tankBotInput,
  type Seat,
  type TankEvents,
  type TankInput,
  type TankState,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { COLORS, DARK, toHex } from '../../theme';
import type { RealtimeSceneOptions } from '../air-hockey/AirHockeyScene';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed, SPEED } from '../../autoplay';
import { facing, heldTaps, isPerson } from '../duel';

export const TANK_SIZE = { width: TANK_CANVAS.width, height: TANK_CANVAS.height };
export const TANK_COLORS = [COLORS.sky, COLORS.tomato];

const W = TANK_CANVAS.width;
const H = TANK_CANVAS.height;
const SEAT_HEX = TANK_COLORS.map(toHex);
const SEAT_DARK = [DARK.sky, DARK.tomato].map(toHex);
const FLOOR = toHex('#EEF6E4');
const BLOCK = toHex(COLORS.mint);
const BLOCK_DARK = toHex(DARK.mint);

/**
 * Tank Duel. The rules drive, turn and fire; the scene draws two chunky toy tanks, their shells,
 * the blocks, a puff of smoke at every shot and a burst when a tank is hit. Each player's whole
 * half of the phone is their one button.
 */
export class TankScene extends Scene {
  private state: TankState;
  private accumulator = 0;
  private ended = false;
  private fingers = new Map<number, Seat>();
  private keys: (seat: Seat) => boolean = () => false;
  private g!: GameObjects.Graphics;
  private scoreTexts: GameObjects.Text[] = [];
  private hints: GameObjects.Text[] = [];
  private banner!: GameObjects.Text;
  private kick: [number, number] = [0, 0];

  constructor(private readonly options: RealtimeSceneOptions) {
    super('tank-duel');
    this.state = newTankDuel(options.seed);
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.input.addPointer(3);
    this.drawArena();
    this.g = this.add.graphics().setDepth(2);
    this.scoreTexts = [0, 1].map((seat) =>
      sharpText(this, 44, seat === 0 ? H - 40 : 40, '0', 40, TANK_COLORS[seat]!)
        .setFontStyle('bold')
        .setDepth(4)
        .setAngle(facing(this.options.seats, seat as Seat)),
    );
    this.hints = [0, 1].map((seat) =>
      sharpText(this, W / 2, seat === 0 ? H - 22 : 22, 'Hold to drive, tap to fire', 20, COLORS.soft)
        .setDepth(4)
        .setAngle(facing(this.options.seats, seat as Seat))
        .setVisible(isPerson(this.options.seats, seat as Seat)),
    );
    this.banner = sharpText(this, W / 2, H / 2 - 90, '', 50, COLORS.ink).setDepth(10).setFontStyle('bold').setStroke('#FFFFFF', 8);
    // Each finger holds down the button of the half it came down in, until it lifts.
    this.input.on('pointerdown', (p: { id: number; worldY: number }) => {
      const seat: Seat = p.worldY > H / 2 ? 0 : 1;
      if (this.options.seats[seat]?.kind === 'human') this.fingers.set(p.id, seat);
    });
    const lift = (p: { id: number }) => this.fingers.delete(p.id);
    this.input.on('pointerup', lift);
    this.input.on('pointerupoutside', lift);
    this.keys = heldTaps(this, this.options.seats);
    this.shout('Ready…');
    this.options.onScore([0, 0]);
  }

  update(_time: number, delta: number): void {
    if (!this.ended) {
      this.accumulator += (Math.min(delta, 100) * SPEED) / 1000;
      while (this.accumulator >= TANK_STEP) {
        this.accumulator -= TANK_STEP;
        const was = this.state.phase;
        const { state, events } = stepTank(this.state, [this.inputFor(0), this.inputFor(1)]);
        this.state = state;
        if (was === 'countdown' && state.phase === 'play') this.shout('Go!');
        this.handle(events);
        if (state.result) {
          this.ended = true;
          this.time.delayedCall(1100, () => this.options.onEnd(state.result!));
          break;
        }
      }
    }
    this.kick = [this.kick[0] * 0.85, this.kick[1] * 0.85];
    this.draw();
  }

  private inputFor(seat: Seat): TankInput {
    const controller = this.options.seats[seat];
    if (controller?.kind === 'bot') return tankBotInput(this.state, seat, TANK_TIERS[controller.tier]);
    return { held: this.keys(seat) || [...this.fingers.values()].includes(seat) };
  }

  private handle(events: TankEvents): void {
    for (const seat of events.fired) {
      this.options.onCue('pull');
      this.kick[seat] = 1;
      const t = this.state.tanks[seat];
      this.puff(t.x + Math.cos(t.angle) * (TANK_R + 14), t.y + Math.sin(t.angle) * (TANK_R + 14), 0xffffff, 5, 22);
      this.hints[seat]!.setVisible(false);
    }
    if (events.bounced) this.options.onCue('wall');
    for (const seat of events.hit) {
      const t = this.state.tanks[seat];
      this.options.onCue('goal');
      this.cameras.main.shake(240, 0.014);
      this.puff(t.x, t.y, toHex(COLORS.sunny), 10, 70);
      this.puff(t.x, t.y, toHex(COLORS.tomato), 8, 50);
    }
    if (events.hit.length) {
      this.options.onScore(this.state.scores);
      [0, 1].forEach((seat) => this.scoreTexts[seat]!.setText(String(this.state.scores[seat])));
      const [hit] = events.hit;
      const text = events.hit.length > 1 ? 'Both hit!' : this.state.result ? `${hit === 0 ? 'Red' : 'Blue'} wins!` : `Point to ${hit === 0 ? 'Red' : 'Blue'}`;
      this.shout(text);
    }
    if (events.timeout) this.shout('Draw! Again');
  }

  /** Bits flying out from a point and fading: smoke from a barrel, or a tank going pop. */
  private puff(x: number, y: number, color: number, count: number, reach: number): void {
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2 + (k % 3) * 0.2;
      const bit = this.add.circle(x, y, 7, color).setDepth(6).setStrokeStyle(2, toHex(COLORS.line));
      this.tweens.add({ targets: bit, x: x + Math.cos(a) * reach, y: y + Math.sin(a) * reach, scale: 0.3, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => bit.destroy() });
    }
  }

  private shout(text: string): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setAlpha(1).setScale(0.6).setAngle(facing(this.options.seats, 0));
    this.tweens.add({ targets: this.banner, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 800, duration: 250 });
  }

  private drawArena(): void {
    const g = this.add.graphics();
    g.fillStyle(FLOOR, 1);
    g.fillRect(0, 0, W, H);
    g.fillStyle(SEAT_HEX[1]!, 0.06);
    g.fillRect(0, 0, W, H / 2);
    g.fillStyle(SEAT_HEX[0]!, 0.06);
    g.fillRect(0, H / 2, W, H / 2);
    g.lineStyle(2, toHex(COLORS.line), 1);
    g.lineBetween(0, H / 2, W, H / 2);
    for (const w of TANK_WALLS) {
      g.fillStyle(BLOCK_DARK, 1);
      g.fillRoundedRect(w.x, w.y + 6, w.w, w.h, 10);
      g.fillStyle(BLOCK, 1);
      g.fillRoundedRect(w.x, w.y, w.w, w.h, 10);
      g.fillStyle(0xffffff, 0.3);
      g.fillRoundedRect(w.x + 6, w.y + 5, Math.max(w.w - 12, 6), 6, 3);
    }
  }

  private draw(): void {
    const s = this.state;
    const g = this.g.clear();
    for (const sh of s.shells) {
      g.fillStyle(SEAT_DARK[sh.owner]!, 1);
      g.fillCircle(sh.x, sh.y, SHELL_R + 2);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(sh.x, sh.y, SHELL_R - 1);
    }
    for (const seat of [0, 1] as const) {
      // A hit tank is gone until the next round.
      if (s.hit.includes(seat) && (s.phase === 'hit' || s.phase === 'over')) continue;
      const t = s.tanks[seat];
      const cos = Math.cos(t.angle);
      const sin = Math.sin(t.angle);
      const at = (fx: number, sy: number) => ({ x: t.x + cos * fx - sin * sy, y: t.y + sin * fx + cos * sy });
      const box = (f0: number, f1: number, s0: number, s1: number, color: number) => {
        const p = [at(f0, s0), at(f1, s0), at(f1, s1), at(f0, s1)];
        g.fillStyle(color, 1);
        g.fillPoints(p, true);
      };
      g.fillStyle(0x000000, 0.12);
      g.fillCircle(t.x + 3, t.y + 6, TANK_R);
      // Treads, body, turret and barrel, kicking back a little when it fires.
      box(-22, 22, -24, -14, toHex(COLORS.ink));
      box(-22, 22, 14, 24, toHex(COLORS.ink));
      box(-18, 18, -16, 16, SEAT_DARK[seat]!);
      box(-18, 16, -14, 14, SEAT_HEX[seat]!);
      const back = this.kick[seat] * 6;
      box(6 - back, 34 - back, -5, 5, SEAT_DARK[seat]!);
      g.fillStyle(SEAT_DARK[seat]!, 1);
      g.fillCircle(t.x - cos * back * 0.5, t.y - sin * back * 0.5, 12);
      g.fillStyle(0xffffff, 0.35);
      g.fillCircle(t.x - cos * 3 - sin * 3, t.y - sin * 3 + cos * 3, 4);
    }
  }
}
