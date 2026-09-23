import {
  countOf,
  createRng,
  newPaint,
  PAINT_CANVAS,
  PAINT_COLS,
  PAINT_ROWS,
  PAINT_SECONDS,
  PAINT_STEP,
  PAINT_TIERS,
  PAINT_TILE,
  paintBotInput,
  ROLLER_R,
  stepPaint,
  type PaintEvents,
  type PaintInput,
  type PaintState,
  type Rng,
  type Seat,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { COLORS, DARK, toHex } from '../../theme';
import type { RealtimeSceneOptions } from '../air-hockey/AirHockeyScene';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed, SPEED } from '../../autoplay';
import { facing, heldDuelKeys, isPerson, seatForY } from '../duel';

export const PAINT_SIZE = { width: PAINT_CANVAS.width, height: PAINT_CANVAS.height };
export const PAINT_COLORS = [COLORS.sky, COLORS.tomato];

const W = PAINT_CANVAS.width;
const H = PAINT_CANVAS.height;
const SEAT_HEX = PAINT_COLORS.map(toHex);
const SEAT_DARK = [toHex(DARK.sky), toHex(DARK.tomato)];
const BARE = 0xf4f1fb;
const STICK_RANGE = 70;

/**
 * Paint Fight. The rules step the round and own the floor; the scene recolours each tile as the
 * rules change it, with a little pop, draws the rollers turning the way they go, and keeps the split
 * across the middle so both players always know who is ahead.
 */
export class PaintScene extends Scene {
  private state: PaintState;
  private readonly rng: Rng;
  private accumulator = 0;
  private noise: [number, number] = [0, 0];
  private noiseTimer = 0;
  private touches = new Map<number, { seat: Seat; x: number; y: number }>();
  private steer: [{ x: number; y: number } | null, { x: number; y: number } | null] = [null, null];
  private held: (seat: Seat) => { x: number; y: number } = () => ({ x: 0, y: 0 });
  private ended = false;
  private shownFloor: number[] = [];
  private tiles: GameObjects.Rectangle[] = [];
  private rollers: GameObjects.Container[] = [];
  private pots: GameObjects.Container[] = [];
  private bar!: GameObjects.Graphics;
  private clockText!: GameObjects.Text;
  private banner!: GameObjects.Text;
  private shownPhase = '';

  constructor(private readonly options: RealtimeSceneOptions) {
    super('paint-fight');
    this.rng = createRng(options.seed);
    this.state = newPaint(options.seed);
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.input.addPointer(3);
    for (let i = 0; i < PAINT_COLS * PAINT_ROWS; i++) {
      const x = (i % PAINT_COLS) * PAINT_TILE + PAINT_TILE / 2;
      const y = Math.floor(i / PAINT_COLS) * PAINT_TILE + PAINT_TILE / 2;
      this.tiles.push(this.add.rectangle(x, y, PAINT_TILE - 3, PAINT_TILE - 3, BARE).setDepth(1));
    }
    this.shownFloor = this.state.floor.slice();
    this.pots = this.state.pots.map((pot) => this.makePot(pot.col * PAINT_TILE + PAINT_TILE / 2, pot.row * PAINT_TILE + PAINT_TILE / 2));
    this.rollers = [0, 1].map((seat) => this.makeRoller(seat as Seat));
    this.bar = this.add.graphics().setDepth(8);
    this.clockText = sharpText(this, W / 2, H / 2 - 30, '', 26, COLORS.ink).setDepth(9).setStroke('#FFFFFF', 6);
    for (const seat of [0, 1] as const) {
      const hint = sharpText(this, W / 2, seat === 0 ? H - 30 : 30, 'Drag to steer. Paint the floor!', 22, COLORS.ink).setDepth(9).setStroke('#FFFFFF', 6);
      hint.setAngle(facing(this.options.seats, seat)).setVisible(isPerson(this.options.seats, seat));
      this.tweens.add({ targets: hint, alpha: 0, delay: 4000, duration: 600 });
    }
    this.banner = sharpText(this, W / 2, H / 2 + 60, '', 64, COLORS.ink).setDepth(10).setFontStyle('bold').setStroke('#FFFFFF', 8);

    this.input.on('pointerdown', (p: { id: number; worldX: number; worldY: number }) => {
      const seat = seatForY(p.worldY, H);
      if (this.options.seats[seat]?.kind !== 'human') return;
      this.touches.set(p.id, { seat, x: p.worldX, y: p.worldY });
    });
    this.input.on('pointermove', (p: { id: number; worldX: number; worldY: number; isDown: boolean }) => {
      const touch = this.touches.get(p.id);
      if (!touch || !p.isDown) return;
      const dx = p.worldX - touch.x;
      const dy = p.worldY - touch.y;
      if (Math.hypot(dx, dy) > 10) this.steer[touch.seat] = { x: dx / STICK_RANGE, y: dy / STICK_RANGE };
    });
    const release = (p: { id: number }) => {
      const touch = this.touches.get(p.id);
      if (!touch) return;
      this.touches.delete(p.id);
      this.steer[touch.seat] = null;
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
    this.held = heldDuelKeys(this, this.options.seats);
    this.draw();
    this.options.onScore([0, 0]);
  }

  private makeRoller(seat: Seat): GameObjects.Container {
    const g = this.add.graphics();
    g.fillStyle(0x2b2a3a, 0.16);
    g.fillRoundedRect(-ROLLER_R + 4, -ROLLER_R + 6, ROLLER_R * 2, ROLLER_R * 2, 10);
    // The handle behind, the roller in front, the way it is going.
    g.fillStyle(toHex(COLORS.ink), 1);
    g.fillRect(-ROLLER_R - 14, -3, 16, 6);
    g.fillStyle(SEAT_DARK[seat]!, 1);
    g.fillRoundedRect(-ROLLER_R * 0.5, -ROLLER_R, ROLLER_R * 1.1, ROLLER_R * 2, 8);
    g.fillStyle(SEAT_HEX[seat]!, 1);
    g.fillRoundedRect(-ROLLER_R * 0.4, -ROLLER_R + 3, ROLLER_R * 0.9, ROLLER_R * 2 - 6, 6);
    g.fillStyle(0xffffff, 0.45);
    g.fillRect(-ROLLER_R * 0.3, -ROLLER_R + 6, 4, ROLLER_R * 2 - 12);
    return this.add.container(0, 0, [g]).setDepth(6);
  }

  private makePot(x: number, y: number): GameObjects.Container {
    const g = this.add.graphics();
    g.fillStyle(toHex(COLORS.soft), 1);
    g.fillRoundedRect(-15, -12, 30, 28, 6);
    g.fillStyle(toHex(COLORS.sunny), 1);
    g.fillEllipse(0, -12, 30, 10);
    g.lineStyle(3, toHex(COLORS.ink), 1);
    g.beginPath();
    g.arc(0, -12, 16, Math.PI, 0);
    g.strokePath();
    return this.add.container(x, y, [g]).setDepth(5).setVisible(false);
  }

  update(_time: number, delta: number): void {
    const dt = (Math.min(delta, 100) * SPEED) / 1000;
    if (!this.ended) {
      this.accumulator += dt;
      this.noiseTimer -= dt;
      if (this.noiseTimer <= 0) {
        this.noise = [this.rng.next() * 2 - 1, this.rng.next() * 2 - 1];
        this.noiseTimer = 0.3;
      }
      while (this.accumulator >= PAINT_STEP) {
        this.accumulator -= PAINT_STEP;
        const { state, events } = stepPaint(this.state, [this.inputFor(0), this.inputFor(1)]);
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

  private inputFor(seat: Seat): PaintInput {
    const controller = this.options.seats[seat];
    if (controller?.kind === 'bot') return paintBotInput(this.state, seat, PAINT_TIERS[controller.tier], this.noise[seat]);
    const key = this.held(seat);
    return { steer: this.steer[seat] ?? (key.x || key.y ? key : null) };
  }

  private handle(events: PaintEvents): void {
    if (events.bump) this.options.onCue('thud');
    if (events.splat) {
      this.options.onCue('win');
      const x = events.splat.col * PAINT_TILE + PAINT_TILE / 2;
      const y = events.splat.row * PAINT_TILE + PAINT_TILE / 2;
      const splash = this.add.circle(x, y, PAINT_TILE, SEAT_HEX[events.splat.seat]!, 0.6).setDepth(7);
      this.tweens.add({ targets: splash, scale: 3, alpha: 0, duration: 380, ease: 'Cubic.easeOut', onComplete: () => splash.destroy() });
      this.cameras.main.shake(140, 0.006);
    }
  }

  private shout(text: string): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 600, duration: 300 });
  }

  /** The floor and the rollers as the rules have them: each newly painted tile pops as it turns. */
  private draw(): void {
    const floor = this.state.floor;
    let changed = false;
    for (let i = 0; i < floor.length; i++) {
      if (floor[i] === this.shownFloor[i]) continue;
      this.shownFloor[i] = floor[i]!;
      changed = true;
      const tile = this.tiles[i]!;
      tile.setFillStyle(floor[i] === -1 ? BARE : SEAT_HEX[floor[i]!]!);
      this.tweens.add({ targets: tile, scale: { from: 1.25, to: 1 }, duration: 160, ease: 'Back.easeOut' });
    }
    this.state.rollers.forEach((r, seat) => this.rollers[seat]?.setPosition(r.x, r.y).setRotation(Math.atan2(r.dy, r.dx)));
    this.state.pots.forEach((pot, i) => {
      const view = this.pots[i]!;
      const up = !this.state.taken[i] && pot.at <= this.state.clock && this.state.phase === 'round';
      if (up && !view.visible) {
        view.setVisible(true).setScale(0.2);
        this.tweens.add({ targets: view, scale: 1, duration: 260, ease: 'Back.easeOut' });
      } else if (!up && view.visible) view.setVisible(false);
    });
    const a = countOf(this.state, 0);
    const b = countOf(this.state, 1);
    if (changed) this.options.onScore([a, b]);
    // The split across the middle: blue from the left, red from the right, bare in between.
    const total = floor.length;
    const g = this.bar.clear();
    const x0 = 40;
    const w = W - 80;
    g.fillStyle(0xffffff, 0.9);
    g.fillRoundedRect(x0 - 6, H / 2 - 13, w + 12, 26, 13);
    g.fillStyle(0xe6e0f4, 1);
    g.fillRoundedRect(x0, H / 2 - 8, w, 16, 8);
    if (a > 0) {
      g.fillStyle(SEAT_HEX[0]!, 1);
      g.fillRoundedRect(x0, H / 2 - 8, Math.max(8, (w * a) / total), 16, 8);
    }
    if (b > 0) {
      g.fillStyle(SEAT_HEX[1]!, 1);
      g.fillRoundedRect(x0 + w - Math.max(8, (w * b) / total), H / 2 - 8, Math.max(8, (w * b) / total), 16, 8);
    }
    const left = this.state.phase === 'round' ? Math.ceil(PAINT_SECONDS - this.state.clock) : this.state.phase === 'over' ? 0 : PAINT_SECONDS;
    this.clockText.setText(String(left));
  }
}
