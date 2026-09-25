import { inPond, POND, POND_PAD_R, type PondMove, type PondState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera } from '../crisp';
import { onKeys } from '../keys';

const W = 600;
const H = 700;
export const POND_SIZE = { width: W, height: H };
export const POND_TINTS = [COLORS.sky];

const AT = { x: (W - POND.w) / 2, y: 40 };
const HOLD_MS = 320;
const RIPPLE_MS = 1600;
const KOI = [COLORS.peach, '#FFFFFF', COLORS.tomato, COLORS.sunny, '#FFFFFF'];
const SPOTS = [COLORS.tomato, COLORS.tomato, COLORS.ink, COLORS.peach, COLORS.ink];

interface Fish {
  view: GameObjects.Container;
  tail: GameObjects.Graphics;
  x: number;
  y: number;
  heading: number;
  speed: number;
  phase: number;
  scared: number;
}

interface Pellet {
  x: number;
  y: number;
  born: number;
}

/**
 * Pond. The rules keep the pads and which lotus has opened; the scene is the water: rings where you
 * tap, food where you hold, koi that wander, flinch from a splash and crowd to food, pads that bob
 * as a ring passes, and petals that spring open one by one.
 */
export class PondScene extends Scene {
  private fish: Fish[] = [];
  private pellets: Pellet[] = [];
  private ripples: { x: number; y: number; t: number }[] = [];
  private water!: GameObjects.Graphics;
  private food!: GameObjects.Graphics;
  private pads: GameObjects.Container[] = [];
  private flowers: GameObjects.Container[] = [];
  private buds: GameObjects.Graphics[] = [];
  private press: { x: number; y: number; at: number; feeding: boolean; lastFood: number; lastSent: number } | null = null;
  private blooming = 0;
  /** Set while a finger or a key sends food it has already put in the water (the play is synchronous). */
  private fedHere = false;

  constructor(private readonly session: Session<PondMove>) {
    super('pond');
  }

  private get state(): PondState {
    return this.session.state as PondState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    const g = this.add.graphics();
    g.fillStyle(toHex('#C8F2DC'), 1);
    g.fillRoundedRect(AT.x - 10, AT.y - 20, POND.w + 20, POND.h + 40, 40);
    g.fillStyle(toHex(DARK.sky), 1);
    g.fillEllipse(AT.x + POND.w / 2, AT.y + POND.h / 2 + 8, POND.w, POND.h, 128);
    g.fillStyle(toHex('#7CC4FF'), 1);
    g.fillEllipse(AT.x + POND.w / 2, AT.y + POND.h / 2, POND.w, POND.h, 128);
    this.food = this.add.graphics().setDepth(2);
    this.fish = KOI.map((color, i) => this.makeFish(color, SPOTS[i]!, i));
    this.water = this.add.graphics().setDepth(4);
    this.state.pads.forEach((p, i) => this.makePad(p.x, p.y, i));
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.down(p.worldX, p.worldY));
    this.input.on('pointermove', (p: { worldX: number; worldY: number }) => {
      if (this.press) (this.press.x = p.worldX), (this.press.y = p.worldY);
    });
    this.input.on('pointerup', () => this.up());
    onKeys(this, (key) => {
      const n = Number(key);
      if (n >= 1 && n <= this.state.pads.length) return this.bloom(n - 1), true;
      if (key === 'f' || key === 'F') {
        this.scatter(AT.x + POND.w / 2, AT.y + POND.h / 2, 6);
        this.fedHere = true;
        this.send('f');
        this.fedHere = false;
        return true;
      }
      if (key === ' ' || key === 'Enter') {
        const t = this.time.now;
        this.ripple(AT.x + POND.w / 2 + Math.sin(t) * 150, AT.y + POND.h / 2 + Math.cos(t * 1.3) * 180);
        return true;
      }
      return false;
    });
    const off = this.session.subscribe(() => this.changed());
    this.session.holdBots = () => this.busy();
    this.events.once('shutdown', () => {
      off();
      this.session.holdBots = null;
    });
  }

  busy(): boolean {
    return this.blooming > 0;
  }

  private send(move: PondMove): void {
    if (!this.session.isHumanTurn() || this.state.result) return;
    if (this.state.legalMoves(0).includes(move)) this.session.play(move);
  }

  private makeFish(color: string, spot: string, i: number): Fish {
    const body = this.add.graphics();
    body.fillStyle(0x000000, 0.12);
    body.fillEllipse(2, 6, 46, 20);
    body.fillStyle(toHex(color), 1);
    body.fillEllipse(0, 0, 46, 20);
    body.fillStyle(toHex(spot), 1);
    body.fillCircle(-4 + (i % 3) * 3, -3, 5);
    body.fillCircle(8, 3, 3.5);
    body.fillStyle(toHex(COLORS.ink), 1);
    body.fillCircle(17, -4, 1.8);
    body.fillCircle(17, 4, 1.8);
    const tail = this.add.graphics();
    tail.fillStyle(toHex(color), 1);
    tail.fillTriangle(0, 0, -16, -10, -16, 10);
    tail.setPosition(-20, 0);
    const x = AT.x + POND.w / 2 + Math.cos(i * 1.3) * 140;
    const y = AT.y + POND.h / 2 + Math.sin(i * 1.3) * 170;
    const view = this.add.container(x, y, [tail, body]).setDepth(3);
    return { view, tail, x, y, heading: i * 1.9, speed: 38 + i * 6, phase: i, scared: 0 };
  }

  /** A lily pad with its notch, a closed bud on it, and the flower waiting inside. */
  private makePad(px: number, py: number, i: number): void {
    const g = this.add.graphics();
    g.fillStyle(toHex(DARK.mint), 1);
    g.fillCircle(0, 4, POND_PAD_R);
    g.fillStyle(toHex(COLORS.mint), 1);
    g.fillCircle(0, 0, POND_PAD_R);
    g.fillStyle(toHex('#7CC4FF'), 1);
    g.fillTriangle(0, 0, POND_PAD_R + 4, -12, POND_PAD_R + 4, 12);
    const bud = this.add.graphics();
    bud.fillStyle(toHex(DARK.bubblegum), 1);
    bud.fillEllipse(0, 2, 22, 30);
    bud.fillStyle(toHex(COLORS.bubblegum), 1);
    bud.fillEllipse(0, 0, 20, 28);
    const flower = this.add.container(0, 0);
    for (let k = 0; k < 8; k++) {
      const petal = this.add.graphics();
      petal.fillStyle(toHex(k % 2 ? '#FFC2E0' : COLORS.bubblegum), 1);
      petal.fillEllipse(0, -18, 16, 30);
      petal.setAngle(k * 45);
      flower.add(petal);
    }
    const middle = this.add.graphics();
    middle.fillStyle(toHex(COLORS.sunny), 1);
    middle.fillCircle(0, 0, 9);
    flower.add(middle);
    const open = this.state.open[i];
    flower.setVisible(!!open);
    bud.setVisible(!open);
    const pad = this.add.container(AT.x + px, AT.y + py, [g, bud, flower]).setDepth(5).setAngle(i * 67);
    this.pads[i] = pad;
    this.buds[i] = bud;
    this.flowers[i] = flower;
  }

  private padAt(x: number, y: number): number {
    return this.state.pads.findIndex((p) => Math.hypot(AT.x + p.x - x, AT.y + p.y - y) < POND_PAD_R);
  }

  private down(x: number, y: number): void {
    if (!inPond(x - AT.x, y - AT.y)) return;
    this.press = { x, y, at: this.time.now, feeding: false, lastFood: 0, lastSent: 0 };
  }

  private up(): void {
    const p = this.press;
    this.press = null;
    if (!p || p.feeding) return;
    const pad = this.padAt(p.x, p.y);
    if (pad >= 0 && !this.state.open[pad]) this.bloom(pad);
    else this.ripple(p.x, p.y);
  }

  private bloom(i: number): void {
    if (this.state.open[i]) return;
    this.send(`b${i}`);
  }

  private ripple(x: number, y: number): void {
    this.ripples.push({ x, y, t: this.time.now });
    cue('tap');
    for (const f of this.fish) if (Math.hypot(f.x - x, f.y - y) < 150) f.scared = this.time.now + 700;
    this.pads.forEach((pad) => {
      const d = Math.hypot(pad.x - x, pad.y - y);
      if (d < 220) this.tweens.add({ targets: pad, scale: 1.06, duration: 160, yoyo: true, delay: d * 4, ease: 'Sine.easeInOut' });
    });
  }

  private scatter(x: number, y: number, count: number): void {
    for (let k = 0; k < count; k++) {
      const a = (this.time.now * 0.01 + k * 2.4) % (Math.PI * 2);
      const r = 10 + ((k * 17) % 30);
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (inPond(px - AT.x, py - AT.y, 12)) this.pellets.push({ x: px, y: py, born: this.time.now });
    }
    this.pellets = this.pellets.slice(-40);
  }

  private changed(): void {
    const s = this.state;
    const last = s.last;
    if (!last) return;
    if (last === 'f') {
      // Food from a keyboard or a finger is already in the water; a bot's lands somewhere of its own.
      if (!this.fedHere) {
        const k = s.feeds;
        this.scatter(AT.x + POND.w / 2 + Math.cos(k * 2.1) * 120, AT.y + POND.h / 2 + Math.sin(k * 2.1) * 150, 6);
      }
      return;
    }
    const i = Number(last.slice(1));
    const flower = this.flowers[i]!;
    this.buds[i]!.setVisible(false);
    flower.setVisible(true);
    this.blooming++;
    cue(s.result ? 'win' : 'place');
    flower.list.forEach((child, k) => {
      const petal = child as GameObjects.Graphics;
      petal.setScale(0);
      this.tweens.add({ targets: petal, scale: 1, duration: 260, delay: k * 55, ease: 'Back.easeOut' });
    });
    this.time.delayedCall(flower.list.length * 55 + 300, () => this.blooming--);
  }

  update(time: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    const p = this.press;
    if (p && !p.feeding && time - p.at > HOLD_MS && this.padAt(p.x, p.y) < 0) p.feeding = true;
    if (p?.feeding && time - p.lastFood > 140) {
      p.lastFood = time;
      this.scatter(p.x, p.y, 2);
      // The rules hear about feeding now and then, not every pellet.
      if (time - p.lastSent > 900) {
        p.lastSent = time;
        this.fedHere = true;
        this.send('f');
        this.fedHere = false;
      }
    }
    this.pellets = this.pellets.filter((pl) => time - pl.born < 9000);
    for (const f of this.fish) this.swim(f, time, dt);
    this.drawWater(time);
  }

  private swim(f: Fish, time: number, dt: number): void {
    let want = f.heading + Math.sin(time / 1300 + f.phase * 2) * 0.6;
    let speed = f.speed;
    // Food nearby pulls a fish over; it eats what it reaches.
    let near: Pellet | null = null;
    let nearD = 260;
    for (const pl of this.pellets) {
      const d = Math.hypot(pl.x - f.x, pl.y - f.y);
      if (d < nearD) (near = pl), (nearD = d);
    }
    if (near) {
      want = Math.atan2(near.y - f.y, near.x - f.x);
      speed *= 1.8;
      if (nearD < 14) {
        this.pellets = this.pellets.filter((pl) => pl !== near);
        this.tweens.add({ targets: f.view, scaleX: 1.12, duration: 80, yoyo: true });
      }
    }
    if (time < f.scared) speed *= 3;
    for (const r of this.ripples)
      if (time - r.t < 500 && Math.hypot(r.x - f.x, r.y - f.y) < 160) want = Math.atan2(f.y - r.y, f.x - r.x);
    // The edge turns a fish back towards the middle.
    const ax = f.x - AT.x + Math.cos(f.heading) * 40;
    const ay = f.y - AT.y + Math.sin(f.heading) * 40;
    if (!inPond(ax, ay, 26)) want = Math.atan2(AT.y + POND.h / 2 - f.y, AT.x + POND.w / 2 - f.x);
    let turn = Math.atan2(Math.sin(want - f.heading), Math.cos(want - f.heading));
    turn = Math.max(-2.6 * dt, Math.min(2.6 * dt, turn));
    f.heading += turn;
    f.x += Math.cos(f.heading) * speed * dt;
    f.y += Math.sin(f.heading) * speed * dt;
    if (!inPond(f.x - AT.x, f.y - AT.y, 10)) {
      f.x -= Math.cos(f.heading) * speed * dt;
      f.y -= Math.sin(f.heading) * speed * dt;
    }
    f.view.setPosition(f.x, f.y).setRotation(f.heading);
    f.tail.setAngle(Math.sin(time / (time < f.scared ? 60 : 160) + f.phase) * 25);
  }

  private drawWater(time: number): void {
    const food = this.food.clear();
    food.fillStyle(toHex(COLORS.peach), 1);
    for (const pl of this.pellets) food.fillCircle(pl.x, pl.y, 3.5);
    const g = this.water.clear();
    this.ripples = this.ripples.filter((r) => time - r.t < RIPPLE_MS);
    for (const r of this.ripples) {
      const age = time - r.t;
      for (let k = 0; k < 3; k++) {
        const radius = age * 0.12 - k * 18;
        if (radius <= 0) continue;
        g.lineStyle(3, 0xffffff, Math.max(0, 0.8 * (1 - age / RIPPLE_MS)));
        g.strokeCircle(r.x, r.y, radius);
      }
    }
  }

  layoutCheck(): { name: string; top: number; bottom: number }[] {
    return [{ name: 'the pond', top: AT.y - 20, bottom: AT.y + POND.h + 20 }];
  }
}

export function pondStatus(state: PondState): string | undefined {
  if (state.result) return undefined;
  const left = state.open.filter((o) => !o).length;
  return `${left} ${left === 1 ? 'bud' : 'buds'} still closed`;
}

export function pondResult(state: PondState): string | undefined {
  return state.result ? 'The pond is in bloom.' : undefined;
}
