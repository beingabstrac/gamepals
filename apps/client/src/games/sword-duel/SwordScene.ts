import {
  createRng,
  DUEL_CANVAS,
  DUEL_STEP,
  DUEL_TIERS,
  duelBotInput,
  FENCER_RADIUS,
  LUNGE_REACH,
  newDuel,
  REACH,
  stepDuel,
  STRIP,
  TOUCHES_TO_WIN,
  type DuelEvents,
  type DuelInput,
  type DuelState,
  type Fencer,
  type Rng,
  type Seat,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { COLORS, DARK, toHex } from '../../theme';
import type { RealtimeSceneOptions } from '../air-hockey/AirHockeyScene';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed, SPEED } from '../../autoplay';
import { facing, heldDuelKeys, isPerson, onDuelKeys, seatForY } from '../duel';

export const SWORD_SIZE = { width: DUEL_CANVAS.width, height: DUEL_CANVAS.height };
export const SWORD_COLORS = [COLORS.sky, COLORS.tomato];

const W = DUEL_CANVAS.width;
const H = DUEL_CANVAS.height;
const SEAT_HEX = SWORD_COLORS.map(toHex);
const SEAT_DARK = [toHex(DARK.sky), toHex(DARK.tomato)];
const TAP_MS = 220;
const SWIPE = 40;
const HISTORY_SECONDS = 0.4;

interface Touch {
  readonly seat: Seat;
  readonly x: number;
  readonly y: number;
  readonly t: number;
  moved: boolean;
  parried: boolean;
}

/**
 * Sword Duel. The rules step the bout; the scene reads each half of the screen as a fencer's hand
 * (drag to step, tap to lunge, swipe across to parry) and draws the two fencers from the state every
 * frame: a lunge throws the body and blade forward, a parry sweeps the blade across, a stunned
 * fencer's blade is knocked wide.
 */
export class SwordScene extends Scene {
  private state: DuelState = newDuel();
  private readonly rng: Rng;
  private accumulator = 0;
  private clock = 0;
  private history: { t: number; state: DuelState }[] = [];
  private rolls: [number, number] = [0.5, 0.5];
  private rollTimer = 0;
  private touches = new Map<number, Touch>();
  private steps: [number, number] = [0, 0];
  private queued: [{ lunge: boolean; parry: boolean }, { lunge: boolean; parry: boolean }] = [
    { lunge: false, parry: false },
    { lunge: false, parry: false },
  ];
  private held: (seat: Seat) => { x: number; y: number } = () => ({ x: 0, y: 0 });
  private ended = false;

  private fencers!: GameObjects.Graphics;
  private lamps!: GameObjects.Graphics;
  private dots: GameObjects.Graphics[] = [];
  private banner!: GameObjects.Text;

  constructor(private readonly options: RealtimeSceneOptions) {
    super('sword-duel');
    this.rng = createRng(options.seed);
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.input.addPointer(3);
    this.drawStrip();
    this.lamps = this.add.graphics().setDepth(1);
    this.fencers = this.add.graphics().setDepth(5);
    this.dots = [0, 1].map(() => this.add.graphics().setDepth(6));
    for (const seat of [0, 1] as const) {
      const hint = sharpText(this, W / 2, seat === 0 ? H - 14 : 14, 'Drag to step. Tap to lunge. Swipe across to parry.', 20, COLORS.soft);
      hint.setAngle(facing(this.options.seats, seat)).setVisible(isPerson(this.options.seats, seat));
      this.tweens.add({ targets: hint, alpha: 0, delay: 6000, duration: 600 });
    }
    this.banner = sharpText(this, W / 2, H / 2, '', 64, COLORS.ink).setDepth(10);
    this.shout('En garde!');

    this.input.on('pointerdown', (p: { id: number; worldX: number; worldY: number }) => {
      const seat = seatForY(p.worldY, H);
      if (this.options.seats[seat]?.kind !== 'human') return;
      this.touches.set(p.id, { seat, x: p.worldX, y: p.worldY, t: this.clock, moved: false, parried: false });
    });
    this.input.on('pointermove', (p: { id: number; worldX: number; worldY: number; isDown: boolean }) => {
      const touch = this.touches.get(p.id);
      if (!touch || !p.isDown) return;
      const dx = p.worldX - touch.x;
      const dy = p.worldY - touch.y;
      if (Math.hypot(dx, dy) > 12) touch.moved = true;
      // A quick sweep across is a parry; up or down the strip is a step.
      if (!touch.parried && Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy) * 1.5 && this.clock - touch.t < 0.3) {
        touch.parried = true;
        this.queued[touch.seat].parry = true;
        return;
      }
      if (Math.abs(dy) > 12) {
        const toward = touch.seat === 0 ? -1 : 1;
        this.steps[touch.seat] = Math.sign(dy) === toward ? 1 : -1;
      }
    });
    const release = (p: { id: number }) => {
      const touch = this.touches.get(p.id);
      if (!touch) return;
      this.touches.delete(p.id);
      this.steps[touch.seat] = 0;
      if (!touch.moved && this.clock - touch.t < TAP_MS / 1000) this.queued[touch.seat].lunge = true;
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
    this.held = heldDuelKeys(this, this.options.seats);
    onDuelKeys(this, this.options.seats, (seat, action) => {
      if (action === 'tap') this.queued[seat].lunge = true;
      if (action === 'left' || action === 'right') this.queued[seat].parry = true;
    });

    this.draw();
    this.options.onScore([0, 0]);
  }

  update(_time: number, delta: number): void {
    const dt = (Math.min(delta, 100) * SPEED) / 1000;
    if (!this.ended) {
      this.accumulator += dt;
      this.rollTimer -= dt;
      if (this.rollTimer <= 0) {
        this.rolls = [this.rng.next(), this.rng.next()];
        this.rollTimer = 0.4;
      }
      while (this.accumulator >= DUEL_STEP) {
        this.accumulator -= DUEL_STEP;
        this.clock += DUEL_STEP;
        const before = this.state.phase;
        const { state, events } = stepDuel(this.state, [this.inputFor(0), this.inputFor(1)]);
        this.state = state;
        this.history.push({ t: this.clock, state });
        while (this.history.length > 0 && this.history[0]!.t < this.clock - HISTORY_SECONDS) this.history.shift();
        this.handle(events);
        if (before === 'touch' && state.phase === 'countdown') this.shout('En garde!');
        if (before === 'countdown' && state.phase === 'bout') this.shout('Allez!');
        if (state.result) {
          this.ended = true;
          this.time.delayedCall(900, () => this.options.onEnd(state.result!));
          break;
        }
      }
    }
    this.draw();
  }

  private inputFor(seat: Seat): DuelInput {
    const controller = this.options.seats[seat];
    const other = seat === 0 ? 1 : 0;
    if (controller?.kind === 'bot') {
      const tier = DUEL_TIERS[controller.tier];
      // It sees the other fencer a moment late, the way a person does.
      const cutoff = this.clock - tier.reactionMs / 1000;
      let seen = this.history[0]?.state ?? this.state;
      for (const entry of this.history) {
        if (entry.t > cutoff) break;
        seen = entry.state;
      }
      return duelBotInput(this.state, seat, tier, seen.fencers[other], this.rolls[seat]);
    }
    const queued = this.queued[seat];
    this.queued[seat] = { lunge: false, parry: false };
    // Keyboard: Up and Down (W and S for the top player) step, toward the other fencer being forward.
    const key = this.held(seat).y;
    const keyStep = key === 0 ? 0 : (seat === 0 ? key < 0 : key > 0) ? 1 : -1;
    return { step: this.steps[seat] || keyStep, lunge: queued.lunge, parry: queued.parry };
  }

  private handle(events: DuelEvents): void {
    events.lunge.forEach((lunged) => {
      if (lunged) this.options.onCue('tap');
    });
    if (events.parried !== null) {
      this.options.onCue('clang');
      this.sparks(W / 2, (this.state.fencers[0].y + this.state.fencers[1].y) / 2);
    }
    if (events.touch !== null) {
      this.options.onScore(this.state.touches);
      if (events.touch === 'double') {
        this.options.onCue('draw');
        this.shout('Double!');
        return;
      }
      this.options.onCue('hit');
      this.cameras.main.shake(160, 0.008);
      this.flashLamp(events.touch);
      this.shout(this.state.result ? 'Winner!' : 'Touch!');
    }
  }

  private flashLamp(seat: Seat): void {
    const g = this.lamps.clear();
    g.fillStyle(SEAT_HEX[seat]!, 0.35);
    g.fillRect(0, seat === 0 ? H / 2 : 0, W, H / 2);
    g.setAlpha(1);
    this.tweens.add({ targets: g, alpha: 0, duration: 900, ease: 'Quad.easeIn' });
  }

  private sparks(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      const angle = this.rng.next() * Math.PI * 2;
      const spark = this.add.rectangle(x, y, 9, 3, toHex(COLORS.sunny)).setRotation(angle).setDepth(8);
      this.tweens.add({ targets: spark, x: x + Math.cos(angle) * 60, y: y + Math.sin(angle) * 60, alpha: 0, duration: 240, onComplete: () => spark.destroy() });
    }
  }

  private shout(text: string): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: this.banner, scale: 1.05, duration: 240, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 600, duration: 300 });
  }

  /** Both fencers from the state: body, mask, and blade, each stance its own shape. */
  private draw(): void {
    const g = this.fencers.clear();
    this.state.fencers.forEach((f, seat) => this.drawFencer(g, f, seat as Seat));
    this.dots.forEach((dots, seat) => {
      dots.clear();
      const y = seat === 0 ? STRIP.bottom + 40 : STRIP.top - 40;
      for (let i = 0; i < TOUCHES_TO_WIN; i++) {
        const x = W / 2 + (i - (TOUCHES_TO_WIN - 1) / 2) * 30;
        dots.fillStyle(i < this.state.touches[seat]! ? SEAT_HEX[seat]! : 0xe6e0f4, 1);
        dots.fillCircle(x, y, 10);
      }
    });
  }

  private drawFencer(g: GameObjects.Graphics, f: Fencer, seat: Seat): void {
    const forward = seat === 0 ? -1 : 1;
    // A lunge carries the body forward too, and a stunned fencer rocks back.
    const lean = f.stance === 'lunge' ? 26 : f.stance === 'recover' ? 18 : f.stance === 'stunned' ? -10 : 0;
    const x = STRIP.x + (seat === 0 ? 14 : -14);
    const y = f.y + forward * lean;
    const r = FENCER_RADIUS;
    g.fillStyle(0x2b2a3a, 0.14);
    g.fillEllipse(x + 4, y + 8, r * 2.3, r * 1.8);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(x, y, r);
    g.lineStyle(6, SEAT_HEX[seat]!, 1);
    g.strokeCircle(x, y, r - 5);
    // The mask, facing the other fencer.
    g.fillStyle(toHex(COLORS.ink), 1);
    g.fillEllipse(x, y + forward * 8, r * 0.95, r * 0.8);
    g.fillStyle(SEAT_DARK[seat]!, 1);
    g.fillCircle(x, y + forward * 10, 4);
    // The blade: from the hand at the front of the body, along the strip, sideways in a parry.
    const hand = { x: x + (seat === 0 ? -r * 0.6 : r * 0.6), y: y + forward * r * 0.7 };
    const reach = REACH + (f.stance === 'lunge' ? LUNGE_REACH - lean : 0);
    let tip = { x: hand.x, y: hand.y + forward * reach };
    if (f.stance === 'parry') tip = { x: hand.x + (seat === 0 ? 1 : -1) * reach * 0.8, y: hand.y + forward * reach * 0.55 };
    if (f.stance === 'stunned') tip = { x: hand.x + (seat === 0 ? -1 : 1) * reach * 0.85, y: hand.y + forward * reach * 0.3 };
    // Grey steel with a bright edge: a pale blade vanished against the strip.
    g.lineStyle(6, toHex(COLORS.soft), 1);
    g.lineBetween(hand.x, hand.y, tip.x, tip.y);
    g.lineStyle(2, 0xffffff, 1);
    g.lineBetween(hand.x, hand.y, tip.x, tip.y);
    g.fillStyle(toHex(COLORS.sunny), 1);
    g.fillCircle(hand.x, hand.y, 7);
  }

  /** The piste: a long strip with its centre and en-garde lines. */
  private drawStrip(): void {
    const g = this.add.graphics();
    const w = 220;
    g.fillStyle(toHex(DARK.peach), 1);
    g.fillRoundedRect(STRIP.x - w / 2, STRIP.top - 20 + 8, w, STRIP.bottom - STRIP.top + 40, 26);
    g.fillStyle(toHex(COLORS.peach), 1);
    g.fillRoundedRect(STRIP.x - w / 2, STRIP.top - 20, w, STRIP.bottom - STRIP.top + 40, 26);
    g.fillStyle(0xf4f1fb, 1);
    g.fillRoundedRect(STRIP.x - w / 2 + 14, STRIP.top - 6, w - 28, STRIP.bottom - STRIP.top + 12, 16);
    g.lineStyle(4, 0xffffff, 1);
    g.lineBetween(STRIP.x - w / 2 + 14, (STRIP.top + STRIP.bottom) / 2, STRIP.x + w / 2 - 14, (STRIP.top + STRIP.bottom) / 2);
    g.lineStyle(3, toHex(COLORS.soft), 0.5);
    // The en-garde lines, at the front of each fencer's starting place.
    for (const y of [STRIP.bottom - 220 - FENCER_RADIUS, STRIP.top + 220 + FENCER_RADIUS]) g.lineBetween(STRIP.x - 60, y, STRIP.x + 60, y);
  }
}
