import { AIM_LIMIT, aimMove, ARROWS_PER_END, FACE_R, RANGE_METRES, RING_W, type ArcheryMove, type ArcheryState, type Hit } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { arrow, onKeys } from '../keys';

const W = 720;
const H = 1040;
export const ARCHERY_SIZE = { width: W, height: H };

/** The bands top to bottom: scores, the wind, then the face. */
const STRIP_Y = 52;
const WIND_Y = 140;
const CX = W / 2;
const CY = 548;
/** Pixels per millimetre on the face. */
const S = 290 / FACE_R;
/** How long a sight takes to steady, and when the arm starts to tire. */
const STEADY_MS = 1200;
const TIRE_MS = 4000;
const FLIGHT_MS = 380;
const SETTLE_MS = 500;

/** Each player's fletching, so whose arrow is whose reads at a glance. */
export const ARCHERY_COLORS = [COLORS.tomato, COLORS.sky, COLORS.mint, COLORS.grape];
/** Ring colours from the outside in, two rings each: white, black, blue, red, gold. */
const RING_COLORS = [0xffffff, 0xffffff, toHex(COLORS.ink), toHex(COLORS.ink), toHex(COLORS.sky), toHex(COLORS.sky), toHex(COLORS.tomato), toHex(COLORS.tomato), toHex(COLORS.sunny), toHex(COLORS.sunny)];

/**
 * Archery. The sway is the scene's and the wind is the rules': while it is your arrow the sight
 * drifts in a slow loop, steadying for a moment and then tiring, and what you shoot is wherever it
 * was when you let go. The rules then add the wind and score the hit, so the move is just a point.
 */
export class ArcheryScene extends Scene {
  private face!: GameObjects.Container;
  private sight!: GameObjects.Graphics;
  private windArrow!: GameObjects.Graphics;
  private windText!: GameObjects.Text;
  private strip: GameObjects.Text[] = [];
  private stuck: GameObjects.Container[] = [];
  private shownEnd = 0;
  /** Where the sight is pointed, before the sway, in millimetres on the face. */
  private aim = { x: 0, y: 0 };
  private turnStart = 0;
  private drag: { x: number; y: number } | null = null;
  private busyUntil = 0;
  private flying = false;
  private shift = false;

  constructor(private readonly session: Session<ArcheryMove>) {
    super('archery');
  }

  private get state(): ArcheryState {
    return this.session.state as ArcheryState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.drawFace();
    this.windArrow = this.add.graphics();
    this.windText = sharpText(this, CX + 60, WIND_Y, '', 26, COLORS.ink).setOrigin(0, 0.5);
    this.sight = this.add.graphics().setDepth(20);

    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.down(p.worldX, p.worldY));
    this.input.on('pointermove', (p: { worldX: number; worldY: number; isDown: boolean }) => p.isDown && this.move(p.worldX, p.worldY));
    this.input.on('pointerup', () => this.up());
    onKeys(this, (key) => this.key(key));
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => (this.shift = event.shiftKey));
    this.input.keyboard?.on('keyup', (event: KeyboardEvent) => (this.shift = event.shiftKey));

    this.settle();
    const unsubscribe = this.session.subscribe(() => this.shot());
    // A bot waits for the last arrow to land before it draws.
    this.session.holdBots = () => this.busy();
    this.events.once('shutdown', () => {
      unsubscribe();
      this.session.holdBots = null;
    });
  }

  /** Still flying an arrow or showing where it went. See `apps/client/src/games/busy.ts`. */
  busy(): boolean {
    return this.flying || this.time.now < this.busyUntil;
  }

  private drawFace(): void {
    const g = this.add.graphics();
    // The stand: a straw boss behind the face.
    g.fillStyle(toHex(DARK.peach), 1);
    g.fillRoundedRect(CX - FACE_R * S - 24, CY - FACE_R * S - 24 + 8, (FACE_R * S + 24) * 2, (FACE_R * S + 24) * 2, 36);
    g.fillStyle(toHex(COLORS.peach), 1);
    g.fillRoundedRect(CX - FACE_R * S - 24, CY - FACE_R * S - 24, (FACE_R * S + 24) * 2, (FACE_R * S + 24) * 2, 36);
    for (let ring = 0; ring < 10; ring++) {
      const r = (FACE_R - ring * RING_W) * S;
      g.fillStyle(RING_COLORS[ring]!, 1);
      g.fillCircle(CX, CY, r);
      g.lineStyle(1.5, ring === 2 || ring === 3 ? 0xffffff : toHex(COLORS.ink), 0.35);
      g.strokeCircle(CX, CY, r);
    }
    g.lineStyle(1.5, toHex(COLORS.ink), 0.35);
    g.strokeCircle(CX, CY, (RING_W / 2) * S);
    g.lineBetween(CX - 5, CY, CX + 5, CY);
    g.lineBetween(CX, CY - 5, CX, CY + 5);
    this.face = this.add.container(0, 0, [g]);
  }

  private drawStrip(): void {
    for (const text of this.strip) text.destroy();
    this.strip = [];
    const state = this.state;
    const names = this.session.seats.map((s) => s.label);
    const width = (W - 40) / state.players;
    for (let p = 0; p < state.players; p++) {
      const up = p === state.currentSeat && !state.result;
      const text = sharpText(this, 20 + width * p + width / 2, STRIP_Y, `${names[p] ?? `Player ${p + 1}`}  ${state.total(p)}`, 26, up ? ARCHERY_COLORS[p]! : COLORS.soft);
      text.setFontStyle(up ? 'bold' : '600');
      this.strip.push(text);
    }
  }

  private drawWind(): void {
    const state = this.state;
    const wind = state.wind;
    const g = this.windArrow.clear();
    const speed = Math.sqrt(wind.x * wind.x + wind.y * wind.y);
    this.windText.setText(speed === 0 ? `${RANGE_METRES[state.range]} m · no wind` : `${RANGE_METRES[state.range]} m · wind ${Math.round(speed)} m/s`);
    // A flag on a pole, blowing the way the wind does and further the harder it blows.
    const px = CX - 150;
    g.lineStyle(5, toHex(COLORS.ink), 1);
    g.lineBetween(px, WIND_Y + 34, px, WIND_Y - 34);
    const len = 18 + speed * 9;
    const ux = speed === 0 ? 0 : wind.x / speed;
    const uy = speed === 0 ? 1 : wind.y / speed;
    g.fillStyle(toHex(COLORS.tomato), 1);
    g.fillTriangle(px, WIND_Y - 34, px, WIND_Y - 10, px + ux * len + (speed === 0 ? 6 : 0), WIND_Y - 22 + uy * len * 0.4 + (speed === 0 ? 14 : 0));
  }

  /** The face as the rules have it now: the arrows of this end, the scores, the wind, the sight. */
  private settle(): void {
    const state = this.state;
    if (state.end !== this.shownEnd && !state.result) {
      // A new end: this end's arrows are pulled and the face is clear again.
      this.shownEnd = state.end;
      for (const arrowView of this.stuck) this.tweens.add({ targets: arrowView, alpha: 0, y: arrowView.y - 30, duration: 240, onComplete: () => arrowView.destroy() });
      this.stuck = [];
    }
    this.drawStrip();
    this.drawWind();
    this.aim = { x: 0, y: 0 };
    this.turnStart = this.time.now;
  }

  private shot(): void {
    const state = this.state;
    const hit = state.hits[state.hits.length - 1];
    if (!hit) return;
    this.sight.clear();
    this.fly(hit);
  }

  /** An arrow from the bow up the range to the face, bent by the wind on the way, then stuck. */
  private fly(hit: Hit): void {
    this.flying = true;
    const to = { x: CX + hit.at.x * S, y: CY + hit.at.y * S };
    const from = { x: CX + hit.aim.x * S * 0.3, y: H + 60 };
    const view = this.makeArrow(hit.player);
    view.setPosition(from.x, from.y).setScale(2.4);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: FLIGHT_MS,
      ease: 'Quad.easeIn',
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;
        // The wind pushes more and more of the way across as the arrow flies.
        const bend = t * t;
        const ax = from.x + (CX + hit.aim.x * S - from.x) * t + (to.x - CX - hit.aim.x * S) * bend;
        const ay = from.y + (CY + hit.aim.y * S - from.y) * t + (to.y - CY - hit.aim.y * S) * bend;
        view.setPosition(ax, ay).setScale(2.4 - 1.4 * t);
      },
      onComplete: () => {
        view.setPosition(to.x, to.y).setScale(1);
        this.stuck.push(view);
        cue(hit.score >= 9 ? 'place' : hit.score > 0 ? 'tap' : 'wall');
        this.tweens.add({ targets: this.face, x: { from: 3, to: 0 }, duration: 120, ease: 'Quad.easeOut' });
        const label = hit.score === 0 ? 'Miss' : hit.x10 ? 'X!' : String(hit.score);
        // Ink with a white edge, so it reads on every ring: dark gold on the gold was all but invisible.
        const pop = sharpText(this, to.x, to.y - 30, label, 40, COLORS.ink).setFontStyle('bold').setStroke('#FFFFFF', 8).setDepth(30);
        this.tweens.add({ targets: pop, y: to.y - 90, alpha: 0, duration: 700, delay: 150, onComplete: () => pop.destroy() });
        this.flying = false;
        this.busyUntil = this.time.now + SETTLE_MS;
        this.time.delayedCall(SETTLE_MS, () => this.settle());
      },
    });
  }

  private makeArrow(player: number): GameObjects.Container {
    const g = this.add.graphics();
    g.fillStyle(toHex(COLORS.ink), 1);
    g.fillCircle(0, 0, 4);
    g.fillStyle(toHex(ARCHERY_COLORS[player] ?? COLORS.ink), 1);
    g.fillCircle(0, 0, 9);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(0, 0, 3.5);
    return this.add.container(0, 0, [g]).setDepth(10);
  }

  /** The sway, in millimetres: a slow loop that steadies for a moment and then grows as the arm tires. */
  private sway(): { x: number; y: number } {
    const state = this.state;
    const held = this.time.now - this.turnStart;
    const base = { near: 16, mid: 26, far: 38 }[state.range] + Math.abs(state.wind.x) * 3;
    const steady = held < STEADY_MS ? 1.5 - (0.8 * held) / STEADY_MS : 0.7 + Math.max(0, (held - TIRE_MS) / 3000);
    const t = held / 1000;
    const a = base * Math.min(steady, 2.4);
    return { x: a * (Math.sin(t * 1.3) + 0.5 * Math.sin(t * 2.9 + 0.7)), y: a * 0.8 * Math.sin(t * 1.7 + 1.1) };
  }

  private mine(): boolean {
    return !this.flying && !this.state.result && this.session.isHumanTurn() && this.time.now >= this.busyUntil;
  }

  update(): void {
    const g = this.sight.clear();
    if (!this.mine()) return;
    const sway = this.sway();
    const x = CX + (this.aim.x + sway.x) * S;
    const y = CY + (this.aim.y + sway.y) * S;
    g.lineStyle(4, toHex(COLORS.ink), 0.9);
    g.strokeCircle(x, y, 22);
    g.lineBetween(x - 34, y, x - 12, y);
    g.lineBetween(x + 12, y, x + 34, y);
    g.lineBetween(x, y - 34, x, y - 12);
    g.lineBetween(x, y + 12, x, y + 34);
    g.fillStyle(toHex(COLORS.tomato), 1);
    g.fillCircle(x, y, 3.5);
  }

  private down(x: number, y: number): void {
    if (!this.mine()) return;
    this.drag = { x, y };
  }

  /** Dragging moves the sight by as much as the finger moves, wherever the finger started. */
  private move(x: number, y: number): void {
    if (!this.drag || !this.mine()) return;
    this.nudge((x - this.drag.x) / S, (y - this.drag.y) / S);
    this.drag = { x, y };
  }

  private up(): void {
    if (!this.drag) return;
    this.drag = null;
    this.loose();
  }

  private nudge(dx: number, dy: number): void {
    const limit = AIM_LIMIT - 60;
    this.aim = { x: Math.max(-limit, Math.min(limit, this.aim.x + dx)), y: Math.max(-limit, Math.min(limit, this.aim.y + dy)) };
  }

  /** Lets go: the arrow goes wherever the sight is at this moment, sway and all. */
  private loose(): void {
    if (!this.mine()) return;
    const sway = this.sway();
    const clamp = (v: number) => Math.max(-AIM_LIMIT, Math.min(AIM_LIMIT, Math.round(v)));
    const move = aimMove(clamp(this.aim.x + sway.x), clamp(this.aim.y + sway.y));
    if (this.state.allows(move)) this.session.play(move);
  }

  private key(key: string): boolean {
    if (!this.mine()) return false;
    const step = arrow(key);
    if (step) {
      const by = this.shift ? 4 : 20;
      this.nudge(step[0] * by, step[1] * by);
      return true;
    }
    if (key === ' ' || key === 'Enter') {
      this.loose();
      return true;
    }
    return false;
  }

  /** The score strip, the wind and the face, top to bottom, for `e2e/wordlayout.spec.ts`. */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    return [
      { name: 'the scores', top: STRIP_Y - 18, bottom: STRIP_Y + 18 },
      { name: 'the wind', top: WIND_Y - 36, bottom: WIND_Y + 36 },
      { name: 'the face', top: CY - FACE_R * S - 24, bottom: CY + FACE_R * S + 32 },
    ];
  }
}

/** Arrows each player has left in the end being shot, for the status line. */
export function arrowOfEnd(state: ArcheryState): number {
  const shotThisEnd = state.hits.filter((hit, i) => hit.player === state.currentSeat && Math.floor(i / (ARROWS_PER_END * state.players)) === state.end).length;
  return Math.min(ARROWS_PER_END, shotThisEnd + 1);
}

