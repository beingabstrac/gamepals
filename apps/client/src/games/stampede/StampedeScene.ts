import {
  ANIMAL_H,
  ANIMAL_W,
  createRng,
  FIELD,
  laneX,
  LANE_W,
  LANES,
  newStampede,
  RUNNER_Y,
  STAMPEDE_CANVAS,
  STAMPEDE_SECONDS,
  STAMPEDE_STEP,
  STAMPEDE_TIERS,
  stampedeBotInput,
  stepStampede,
  type Rng,
  type Seat,
  type StampedeEvents,
  type StampedeInput,
  type StampedeState,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { COLORS, DARK, toHex } from '../../theme';
import type { RealtimeSceneOptions } from '../air-hockey/AirHockeyScene';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed, SPEED } from '../../autoplay';

export const STAMPEDE_SIZE = { width: STAMPEDE_CANVAS.width, height: STAMPEDE_CANVAS.height };

const W = STAMPEDE_CANVAS.width;
const H = STAMPEDE_CANVAS.height;
const SEAT_HEX = [toHex(COLORS.sky), toHex(COLORS.tomato)];
const HISTORY_SECONDS = 0.4;

/**
 * Stampede. The rules run the field at a fixed step; the scene draws the lanes, the herd and the
 * runner. The bottom half of the screen always runs and the top half always herds, whoever that is
 * this round: two people on one phone turn it round when the roles swap.
 */
export class StampedeScene extends Scene {
  private state: StampedeState = newStampede();
  private readonly rng: Rng;
  private accumulator = 0;
  private clock = 0;
  private history: { t: number; state: StampedeState }[] = [];
  private noise: [number, number] = [0, 0];
  private noiseTimer = 0;
  /** A finger running (its x), and a lane tapped to send down. */
  private runFinger: { id: number; x: number } | null = null;
  private sendQueued: number | null = null;
  private keysDown = new Set<string>();
  private ended = false;
  private runner!: GameObjects.Container;
  private herd!: GameObjects.Graphics;
  private gates!: GameObjects.Graphics;
  private banner!: GameObjects.Text;
  private clockText!: GameObjects.Text;

  constructor(private readonly options: RealtimeSceneOptions) {
    super('stampede');
    this.rng = createRng(options.seed);
  }

  /** What the table calls each seat (a person's name, or the bot's). */
  private nameOf(seat: Seat): string {
    return this.options.seats[seat]?.label ?? (seat === 0 ? 'Blue' : 'Red');
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.input.addPointer(3);
    const g = this.add.graphics();
    g.fillStyle(toHex(DARK.mint), 1);
    g.fillRoundedRect(FIELD.left - 10, FIELD.top - 10 + 6, FIELD.right - FIELD.left + 20, FIELD.bottom - FIELD.top + 20, 22);
    g.fillStyle(toHex(COLORS.mint), 1);
    g.fillRoundedRect(FIELD.left - 10, FIELD.top - 10, FIELD.right - FIELD.left + 20, FIELD.bottom - FIELD.top + 20, 22);
    g.fillStyle(0xffffff, 0.12);
    for (let l = 0; l < LANES; l += 2) g.fillRect(FIELD.left + l * LANE_W, FIELD.top, LANE_W, FIELD.bottom - FIELD.top);
    this.gates = this.add.graphics();
    this.herd = this.add.graphics().setDepth(3);
    this.runner = this.makeRunner();
    this.clockText = sharpText(this, W / 2, FIELD.bottom + 36, '', 26, COLORS.ink).setFontStyle('bold');
    this.banner = sharpText(this, W / 2, H / 2, '', 58, COLORS.ink).setDepth(10).setStroke('#FFFFFF', 10);
    this.shout(`${this.nameOf(this.state.runner)} runs first`, false);

    this.input.on('pointerdown', (p: { id: number; worldX: number; worldY: number }) => {
      const s = this.state;
      if (p.worldY > H / 2) {
        if (this.options.seats[s.runner]?.kind === 'human') this.runFinger = { id: p.id, x: p.worldX };
      } else if (this.options.seats[s.runner === 0 ? 1 : 0]?.kind === 'human') {
        const lane = Math.floor((p.worldX - FIELD.left) / LANE_W);
        if (lane >= 0 && lane < LANES) this.sendQueued = lane;
      }
    });
    this.input.on('pointermove', (p: { id: number; worldX: number; isDown: boolean }) => {
      if (this.runFinger?.id === p.id && p.isDown) this.runFinger.x = p.worldX;
    });
    const release = (p: { id: number }) => {
      if (this.runFinger?.id === p.id) this.runFinger = null;
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
    // Keys: arrows run, 1 to 5 send, whoever has which role.
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      this.keysDown.add(e.key);
      const n = Number(e.key);
      if (n >= 1 && n <= LANES) this.sendQueued = n - 1;
    });
    this.input.keyboard?.on('keyup', (e: KeyboardEvent) => this.keysDown.delete(e.key));
    this.game.events.on('blur', () => this.keysDown.clear());
    this.options.onScore([0, 0]);
    this.draw();
  }

  /** A little runner seen from above: a round body in the runner's color with a face. */
  private makeRunner(): GameObjects.Container {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.16);
    g.fillEllipse(0, 14, 50, 18);
    g.fillStyle(0xffe0c2, 1);
    g.fillCircle(0, -4, 17);
    g.fillStyle(toHex(COLORS.ink), 1);
    g.fillCircle(-6, -8, 2.4);
    g.fillCircle(6, -8, 2.4);
    const shirt = this.add.graphics().setName('shirt');
    return this.add.container(laneX(2), RUNNER_Y, [shirt, g]).setDepth(4);
  }

  update(_time: number, delta: number): void {
    if (this.ended) return;
    const step = (Math.min(delta, 100) * SPEED) / 1000;
    this.accumulator += step;
    this.noiseTimer -= step;
    if (this.noiseTimer <= 0) {
      this.noise = [this.rng.next() * 2 - 1, this.rng.next() * 2 - 1];
      this.noiseTimer = 0.17;
    }
    while (this.accumulator >= STAMPEDE_STEP) {
      this.accumulator -= STAMPEDE_STEP;
      this.clock += STAMPEDE_STEP;
      const before = this.state;
      const { state, events } = stepStampede(this.state, [this.inputFor(0), this.inputFor(1)]);
      this.state = state;
      this.history.push({ t: this.clock, state });
      while (this.history.length > 0 && this.history[0]!.t < this.clock - HISTORY_SECONDS) this.history.shift();
      this.handle(events, before);
      if (state.result) {
        this.ended = true;
        this.time.delayedCall(900, () => this.options.onEnd(state.result!));
        break;
      }
    }
    this.draw();
  }

  private inputFor(seat: Seat): StampedeInput {
    const s = this.state;
    const controller = this.options.seats[seat];
    if (controller?.kind === 'bot') {
      const tier = STAMPEDE_TIERS[controller.tier];
      const cutoff = this.clock - tier.reactionMs / 1000;
      let seen = this.history[0]?.state ?? s;
      for (const entry of this.history) {
        if (entry.t > cutoff) break;
        seen = entry.state;
      }
      // A running bot knows where it is and sees the herd late; a herding bot sees the runner late.
      const view = seat === s.runner ? { ...seen, x: s.x, vx: s.vx, phase: s.phase, cooldown: s.cooldown, runner: s.runner } : { ...s, x: seen.x, vx: seen.vx };
      return stampedeBotInput(view, seat, tier, this.noise[seat]);
    }
    if (seat === s.runner) {
      const left = this.keysDown.has('ArrowLeft');
      const right = this.keysDown.has('ArrowRight');
      if (this.runFinger) return { run: Math.max(-1, Math.min(1, (this.runFinger.x - s.x) / 50)), send: null };
      return { run: left === right ? null : left ? -1 : 1, send: null };
    }
    const send = this.sendQueued;
    this.sendQueued = null;
    return { run: null, send };
  }

  private handle(events: StampedeEvents, before: StampedeState): void {
    const s = this.state;
    if (events.sent !== null) this.options.onCue('thud');
    if (events.roundOver !== null) {
      this.options.onScore(s.points);
      if (events.roundOver) {
        this.options.onCue('win');
        this.shout(`${this.nameOf(before.runner)} made it!`);
      } else {
        this.options.onCue('capture');
        this.cameras.main.shake(260, 0.012);
        this.tweens.add({ targets: this.runner, angle: 360, scale: 0.6, duration: 500, yoyo: true });
        this.shout('Caught!');
      }
    }
    if (before.phase === 'over' && s.phase === 'countdown') {
      const twoPeople = this.options.seats.every((c) => c?.kind === 'human');
      this.shout(twoPeople ? `Turn the phone round: ${this.nameOf(s.runner)} runs` : `${this.nameOf(s.runner)} runs now`, false);
    }
    if (before.phase === 'countdown' && s.phase === 'run') this.shout('Go!');
  }

  private shout(text: string, fade = true): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 260, ease: 'Back.easeOut' });
    if (fade) this.tweens.add({ targets: this.banner, alpha: 0, delay: 700, duration: 300 });
  }

  private draw(): void {
    const s = this.state;
    const herder: Seat = s.runner === 0 ? 1 : 0;
    // The herder's gates along the top, lit when ready to send.
    const g = this.gates.clear();
    for (let l = 0; l < LANES; l++) {
      const x = laneX(l);
      g.fillStyle(SEAT_HEX[herder]!, s.cooldown === 0 && s.phase === 'run' ? 1 : 0.45);
      g.fillRoundedRect(x - LANE_W / 2 + 8, 20, LANE_W - 16, 50, 14);
      g.fillStyle(0xffffff, 0.9);
      g.fillTriangle(x - 12, 36, x + 12, 36, x, 56);
    }
    const shirt = this.runner.getByName('shirt') as GameObjects.Graphics;
    shirt.clear().fillStyle(SEAT_HEX[s.runner]!, 1).fillEllipse(0, 8, 40, 26);
    this.runner.setX(s.x);
    // The herd: cows seen from above, running down their lanes.
    const h = this.herd.clear();
    for (const a of s.animals) {
      const x = laneX(a.lane);
      h.fillStyle(0x000000, 0.14);
      h.fillEllipse(x + 3, a.y + 6, ANIMAL_W, ANIMAL_H);
      h.fillStyle(0xffffff, 1);
      h.fillEllipse(x, a.y, ANIMAL_W - 12, ANIMAL_H);
      h.fillStyle(toHex(COLORS.ink), 1);
      h.fillCircle(x - 12, a.y - 8, 7);
      h.fillCircle(x + 10, a.y + 12, 6);
      h.fillStyle(toHex('#FFC2D6'), 1);
      h.fillEllipse(x, a.y + ANIMAL_H / 2 - 4, 30, 18);
      h.fillStyle(toHex(COLORS.ink), 1);
      h.fillCircle(x - 7, a.y + ANIMAL_H / 2 - 4, 2.2);
      h.fillCircle(x + 7, a.y + ANIMAL_H / 2 - 4, 2.2);
    }
    const left = s.phase === 'run' ? Math.max(0, Math.ceil(STAMPEDE_SECONDS - s.timer)) : STAMPEDE_SECONDS;
    this.clockText.setText(`${left}s`);
  }
}
