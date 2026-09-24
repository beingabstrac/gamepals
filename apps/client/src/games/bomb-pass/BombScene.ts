import {
  BOMB_CANVAS,
  BOMB_FLIGHT,
  BOMB_LIVES,
  BOMB_STEP,
  BOMB_TIERS,
  bombBotInput,
  BUTTON_R,
  createRng,
  newBombPass,
  stepBomb,
  type BombEvents,
  type BombInput,
  type BombState,
  type Rng,
  type Seat,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { COLORS, DARK, toHex } from '../../theme';
import type { RealtimeSceneOptions } from '../air-hockey/AirHockeyScene';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed, SPEED } from '../../autoplay';
import { facing, isPerson, onDuelKeys, seatForY } from '../duel';

export const BOMB_SIZE = { width: BOMB_CANVAS.width, height: BOMB_CANVAS.height };
export const BOMB_COLORS = [COLORS.sky, COLORS.tomato];

const W = BOMB_CANVAS.width;
const H = BOMB_CANVAS.height;
const SEAT_HEX = BOMB_COLORS.map(toHex);
/** Where the bomb sits on each side while it is held. */
const REST_Y = [H * 0.72, H * 0.28];

/**
 * Bomb Pass. The rules burn the fuse and move the bomb; the scene draws the halves, the bomb with
 * its sparking fuse, the button glowing wherever the holder has to hit it, and the throw as an arc
 * over the middle. A bang shakes the phone and takes a heart.
 */
export class BombScene extends Scene {
  private state: BombState;
  private readonly rng: Rng;
  private accumulator = 0;
  private queued: [{ x: number; y: number } | null, { x: number; y: number } | null] = [null, null];
  private heldFor = 0;
  private roll = 0.5;
  private lastKey = '';
  private ended = false;
  private g!: GameObjects.Graphics;
  private banner!: GameObjects.Text;
  private sparks = 0;

  constructor(private readonly options: RealtimeSceneOptions) {
    super('bomb-pass');
    this.rng = createRng(options.seed);
    this.state = newBombPass(options.seed);
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.input.addPointer(3);
    this.g = this.add.graphics();
    this.banner = sharpText(this, W / 2, H / 2, '', 50, COLORS.ink).setDepth(10).setFontStyle('bold').setStroke('#FFFFFF', 8);
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      const seat = seatForY(p.worldY, H);
      if (this.options.seats[seat]?.kind === 'human') this.queued[seat] = { x: p.worldX, y: p.worldY };
    });
    // A key throws straight at the button: the keyboard has no aim to miss with.
    onDuelKeys(this, this.options.seats, (seat, action) => {
      if (action === 'tap') this.queued[seat] = { ...this.state.button };
    });
    this.shout('Ready…');
    this.options.onScore([BOMB_LIVES, BOMB_LIVES]);
  }

  update(_time: number, delta: number): void {
    if (!this.ended) {
      this.accumulator += (Math.min(delta, 100) * SPEED) / 1000;
      while (this.accumulator >= BOMB_STEP) {
        this.accumulator -= BOMB_STEP;
        const key = `${this.state.phase}.${this.state.holder}.${this.state.throws}.${this.state.bomb}`;
        if (key !== this.lastKey) {
          this.lastKey = key;
          this.heldFor = 0;
          this.roll = this.rng.next();
        } else this.heldFor += BOMB_STEP;
        const { state, events } = stepBomb(this.state, [this.inputFor(0), this.inputFor(1)]);
        this.state = state;
        this.handle(events);
        if (state.result) {
          this.ended = true;
          this.time.delayedCall(1100, () => this.options.onEnd(state.result!));
          break;
        }
      }
    }
    this.sparks += delta;
    this.draw();
  }

  private inputFor(seat: Seat): BombInput {
    const controller = this.options.seats[seat];
    if (controller?.kind === 'bot') return bombBotInput(this.state, seat, BOMB_TIERS[controller.tier], this.heldFor, this.roll);
    const tap = this.queued[seat];
    this.queued[seat] = null;
    return { tap };
  }

  private handle(events: BombEvents): void {
    if (events.thrown) this.options.onCue('pull');
    if (events.landed) this.options.onCue('thud');
    if (events.miss) this.options.onCue('wall');
    if (events.boom !== null) {
      this.options.onCue('goal');
      this.options.onScore(this.state.lives);
      this.cameras.main.shake(260, 0.02);
      this.burst(W / 2, REST_Y[events.boom]!);
      this.shout(this.state.result ? 'Boom! Game over' : 'Boom!');
    }
    if (this.state.phase === 'held' && this.lastKey.startsWith('countdown')) this.shout('Go!');
  }

  private burst(x: number, y: number): void {
    const colors = [COLORS.sunny, COLORS.peach, COLORS.tomato];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const bit = this.add.circle(x, y, 10, toHex(colors[i % 3]!)).setDepth(8);
      this.tweens.add({ targets: bit, x: x + Math.cos(a) * 200, y: y + Math.sin(a) * 200, alpha: 0, scale: 0.4, duration: 480, ease: 'Cubic.easeOut', onComplete: () => bit.destroy() });
    }
  }

  private shout(text: string): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 600, duration: 250 });
  }

  /** Where the bomb is right now: at rest on a side, or on its arc over the middle. */
  private bombXY(): { x: number; y: number; s: number } {
    const s = this.state;
    if (s.phase === 'flying') {
      const t = 1 - s.timer / BOMB_FLIGHT;
      const from = REST_Y[s.holder === 0 ? 1 : 0]!;
      const to = REST_Y[s.holder]!;
      return { x: W / 2 + Math.sin(t * Math.PI) * 90, y: from + (to - from) * t, s: 1 + Math.sin(t * Math.PI) * 0.35 };
    }
    return { x: W / 2, y: REST_Y[s.holder]!, s: 1 };
  }

  private draw(): void {
    const s = this.state;
    const g = this.g.clear();
    // The two halves, the holder's glowing a little.
    for (const seat of [0, 1] as const) {
      const top = seat === 0 ? H / 2 : 0;
      g.fillStyle(SEAT_HEX[seat]!, s.phase === 'held' && s.holder === seat ? 0.14 : 0.06);
      g.fillRect(0, top, W, H / 2);
      // Hearts at each player's end, facing them.
      for (let i = 0; i < BOMB_LIVES; i++) {
        const x = W / 2 + (i - (BOMB_LIVES - 1) / 2) * 44;
        const y = seat === 0 ? H - 34 : 34;
        const on = i < s.lives[seat];
        const flip = facing(this.options.seats, seat) === 180 ? -1 : 1;
        g.fillStyle(on ? toHex(COLORS.tomato) : 0xe6e0f4, 1);
        g.fillCircle(x - 7, y - 4 * flip, 10);
        g.fillCircle(x + 7, y - 4 * flip, 10);
        g.fillTriangle(x - 16, y, x + 16, y, x, y + 18 * flip);
      }
    }
    g.lineStyle(4, toHex(COLORS.line), 1);
    g.lineBetween(20, H / 2, W - 20, H / 2);
    // The button to hit, pulsing, in the holder's half.
    if (s.phase === 'held') {
      const pulse = 1 + Math.sin(this.sparks / 120) * 0.08;
      const b = s.button;
      const show = isPerson(this.options.seats, s.holder) || !this.options.seats.some((c) => c.kind === 'human');
      if (show) {
        g.fillStyle(toHex(DARK.mint), 1);
        g.fillCircle(b.x, b.y + 6, BUTTON_R * pulse);
        g.fillStyle(toHex(COLORS.mint), 1);
        g.fillCircle(b.x, b.y, BUTTON_R * pulse);
        g.fillStyle(0xffffff, 0.9);
        g.fillTriangle(b.x - 16, b.y + 12 * (s.holder === 0 ? 1 : -1), b.x + 16, b.y + 12 * (s.holder === 0 ? 1 : -1), b.x, b.y - 16 * (s.holder === 0 ? 1 : -1));
      }
    }
    if (s.phase === 'boom' || s.phase === 'over') return;
    // The bomb: round, dark, a shine, and the fuse sparking.
    const { x, y, s: scale } = this.bombXY();
    const r = 46 * scale;
    g.fillStyle(0x000000, 0.12);
    g.fillEllipse(x, y + r * 0.9, r * 1.6, r * 0.4);
    g.fillStyle(toHex(COLORS.ink), 1);
    g.fillCircle(x, y, r);
    g.fillStyle(0xffffff, 0.25);
    g.fillCircle(x - r * 0.35, y - r * 0.35, r * 0.25);
    g.fillStyle(toHex(COLORS.soft), 1);
    g.fillRoundedRect(x + r * 0.2, y - r * 1.15, r * 0.35, r * 0.35, 4);
    const flick = (Math.sin(this.sparks / 40) + 1) / 2;
    g.fillStyle(toHex(COLORS.sunny), 1);
    g.fillCircle(x + r * 0.5, y - r * 1.3, 8 + flick * 6);
    g.fillStyle(toHex(COLORS.peach), 1);
    g.fillCircle(x + r * 0.5, y - r * 1.3, 4 + flick * 3);
  }
}
