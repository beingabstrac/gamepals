import { SLIME_MIXINS, type SlimeMove, type SlimeState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { onKeys } from '../keys';

const W = 600;
const H = 880;
export const SLIME_SIZE = { width: W, height: H };
export const SLIME_TINTS = [COLORS.mint];

const COLORS_OF = [COLORS.tomato, COLORS.peach, COLORS.sunny, COLORS.mint, COLORS.sky, COLORS.grape, COLORS.bubblegum] as const;
const DARKS_OF = [DARK.tomato, DARK.peach, DARK.sunny, DARK.mint, DARK.sky, DARK.grape, DARK.bubblegum] as const;
const MIX_NAMES = ['Glitter', 'Beads', 'Foam', 'Stars'];

/** The soft body: a ring of points round a middle, each pulled back to where it rests. */
const N = 28;
const R = 140;
const FLOOR = 560;
const REST = { x: W / 2, y: FLOOR - R * 0.78 };
const PALETTE_Y = 650;
const MIX_Y = 730;
const DONE_Y = 820;

interface Bit {
  /** Which ring point it follows, and how far out from the middle (0 to 1). */
  at: number;
  out: number;
  kind: number;
  color: number;
}

/**
 * Slime. The rules keep the color, the mix-ins and the pokes; the scene is the slime: a ring of
 * points on springs round a middle that sags onto the table, dents where you poke it, stretches
 * where you pull it and wobbles back, with whatever you mixed in riding along inside.
 */
export class SlimeScene extends Scene {
  private px: number[] = [];
  private py: number[] = [];
  private vx: number[] = [];
  private vy: number[] = [];
  private body!: GameObjects.Graphics;
  private ui!: GameObjects.Graphics;
  private bits: Bit[] = [];
  private grab: { i: number; x: number; y: number; moved: boolean } | null = null;
  private squishedAt = 0;
  /** Set while a finger or a key sends a poke it has already made (the play is synchronous). */
  private pokedHere = false;

  constructor(private readonly session: Session<SlimeMove>) {
    super('slime');
  }

  private get state(): SlimeState {
    return this.session.state as SlimeState;
  }

  private rest(i: number): { x: number; y: number } {
    const a = (i / N) * Math.PI * 2;
    // Squashed a little flat, the way slime settles on a table.
    return { x: REST.x + Math.cos(a) * R * 1.12, y: REST.y + Math.sin(a) * R * 0.78 };
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    const g = this.add.graphics();
    g.fillStyle(toHex('#F1E6FF'), 1);
    g.fillRoundedRect(30, FLOOR - 10, W - 60, 40, 20);
    for (let i = 0; i < N; i++) {
      const r = this.rest(i);
      this.px.push(r.x);
      this.py.push(r.y);
      this.vx.push(0);
      this.vy.push(0);
    }
    this.body = this.add.graphics().setDepth(2);
    this.ui = this.add.graphics();
    MIX_NAMES.forEach((name, k) => sharpText(this, this.mixX(k), MIX_Y, name, 20, COLORS.ink).setFontStyle('bold').setDepth(1));
    sharpText(this, W / 2, DONE_Y, 'Done', 24, '#FFFFFF').setFontStyle('bold').setDepth(1);
    this.state.mixins.forEach((m, k) => m && this.addBits(k));
    this.drawUi();
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.down(p.worldX, p.worldY));
    this.input.on('pointermove', (p: { worldX: number; worldY: number; isDown: boolean }) => {
      if (p.isDown && this.grab) {
        if (Math.hypot(p.worldX - this.grab.x, p.worldY - this.grab.y) > 8) this.grab.moved = true;
        this.grab.x = p.worldX;
        this.grab.y = p.worldY;
      }
    });
    this.input.on('pointerup', () => this.up());
    onKeys(this, (key) => {
      const n = Number(key);
      if (n >= 1 && n <= 7) return this.send(`c${n - 1}`), true;
      if (key === 'g' || key === 'G') return this.send('m0'), true;
      if (key === 'b' || key === 'B') return this.send('m1'), true;
      if (key === 'f' || key === 'F') return this.send('m2'), true;
      if (key === 's' || key === 'S') return this.send('m3'), true;
      if (key === ' ') return this.poke(REST.x, REST.y - 40), this.pokeSent(), true;
      if (key === 'd' || key === 'D' || key === 'Enter') return this.send('done'), true;
      return false;
    });
    const off = this.session.subscribe(() => this.changed());
    this.events.once('shutdown', off);
  }

  private paletteX(k: number): number {
    return W / 2 + (k - 3) * 70;
  }

  private mixX(k: number): number {
    return W / 2 + (k - (SLIME_MIXINS - 1) / 2) * 136;
  }

  private send(move: SlimeMove): void {
    if (!this.session.isHumanTurn() || this.state.result) return;
    if (this.state.legalMoves(0).includes(move)) this.session.play(move);
  }

  private down(x: number, y: number): void {
    if (Math.abs(y - PALETTE_Y) < 30) {
      const k = COLORS_OF.findIndex((_, i) => Math.abs(x - this.paletteX(i)) < 30);
      if (k >= 0) this.send(`c${k}`);
      return;
    }
    if (Math.abs(y - MIX_Y) < 28) {
      const k = MIX_NAMES.findIndex((_, i) => Math.abs(x - this.mixX(i)) < 62);
      if (k >= 0) this.send(`m${k}`);
      return;
    }
    if (Math.abs(y - DONE_Y) < 30 && Math.abs(x - W / 2) < 100) return this.send('done');
    // Nearest point of the slime, if the finger is on or near it.
    let best = -1;
    let bestD = 70;
    for (let i = 0; i < N; i++) {
      const d = Math.hypot(this.px[i]! - x, this.py[i]! - y);
      if (d < bestD) (best = i), (bestD = d);
    }
    const inside = Math.hypot((x - REST.x) / (R * 1.2), (y - REST.y) / R) < 1;
    if (best >= 0 || inside) this.grab = { i: best >= 0 ? best : this.nearest(x, y), x, y, moved: false };
  }

  private nearest(x: number, y: number): number {
    let best = 0;
    for (let i = 1; i < N; i++) if (Math.hypot(this.px[i]! - x, this.py[i]! - y) < Math.hypot(this.px[best]! - x, this.py[best]! - y)) best = i;
    return best;
  }

  private up(): void {
    const g = this.grab;
    this.grab = null;
    if (!g) return;
    if (!g.moved) this.poke(g.x, g.y);
    else cue('pull');
    this.pokeSent();
  }

  private pokeSent(): void {
    this.pokedHere = true;
    this.send('p');
    this.pokedHere = false;
  }

  /** A poke dents the slime where it lands: the nearby edge is pushed in and springs back. */
  private poke(x: number, y: number): void {
    for (let i = 0; i < N; i++) {
      const d = Math.hypot(this.px[i]! - x, this.py[i]! - y);
      if (d > 120) continue;
      const k = (1 - d / 120) * 520;
      this.vx[i]! += ((REST.x - this.px[i]!) / R) * k;
      this.vy[i]! += ((REST.y - this.py[i]!) / R) * k;
    }
    if (this.time.now - this.squishedAt > 80) {
      this.squishedAt = this.time.now;
      cue('thud');
    }
  }

  /** Bits of a mix-in, scattered through the slime and carried along with it. */
  private addBits(kind: number): void {
    const count = [40, 14, 26, 10][kind]!;
    for (let k = 0; k < count; k++)
      this.bits.push({ at: (k * 7 + kind * 3) % N, out: 0.15 + ((k * 37 + kind * 11) % 70) / 100, kind, color: (k + kind) % COLORS_OF.length });
  }

  private changed(): void {
    const last = this.state.last;
    if (!last) return;
    if (last === 'done') return void cue('win');
    if (last === 'p') {
      // Pokes from a finger are already played; a bot's pokes the top of the slime.
      if (!this.pokedHere) this.poke(REST.x + Math.sin(this.state.pokes) * 60, REST.y - R * 0.6);
      return;
    }
    if (last[0] === 'm') this.addBits(Number(last.slice(1)));
    // A new color or mix-in: a happy wobble.
    for (let i = 0; i < N; i++) this.vy[i]! += Math.sin((i / N) * Math.PI * 4) * 160;
    cue('place');
    this.drawUi();
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 33) / 1000;
    for (let step = 0; step < 2; step++) this.stepBody(dt / 2);
    this.drawBody();
  }

  private stepBody(dt: number): void {
    const cx = this.px.reduce((a, b) => a + b, 0) / N;
    const cy = this.py.reduce((a, b) => a + b, 0) / N;
    for (let i = 0; i < N; i++) {
      const r = this.rest(i);
      // Home is the rest shape, moved with the middle, so the whole slime can be tugged a little.
      const hx = r.x + (cx - REST.x) * 0.6;
      const hy = r.y + (cy - REST.y) * 0.6;
      let ax = (hx - this.px[i]!) * 60;
      let ay = (hy - this.py[i]!) * 60;
      for (const j of [(i + 1) % N, (i + N - 1) % N]) {
        ax += (this.px[j]! - this.px[i]!) * 40;
        ay += (this.py[j]! - this.py[i]!) * 40;
      }
      ax -= this.vx[i]! * 5;
      ay -= this.vy[i]! * 5;
      this.vx[i]! += ax * dt;
      this.vy[i]! += ay * dt;
    }
    const g = this.grab;
    if (g && g.moved) {
      // The held point follows the finger (only so far), its neighbours come along on their springs.
      const dx = g.x - this.px[g.i]!;
      const dy = g.y - this.py[g.i]!;
      this.vx[g.i]! += dx * 30 * dt * 10;
      this.vy[g.i]! += dy * 30 * dt * 10;
    }
    for (let i = 0; i < N; i++) {
      this.px[i]! += this.vx[i]! * dt;
      this.py[i]! += this.vy[i]! * dt;
      // It sits on the table.
      if (this.py[i]! > FLOOR) {
        this.py[i] = FLOOR;
        this.vy[i]! *= -0.2;
      }
      const s = Math.hypot(this.px[i]! - REST.x, this.py[i]! - REST.y);
      if (s > R * 2.6) {
        this.px[i] = REST.x + ((this.px[i]! - REST.x) / s) * R * 2.6;
        this.py[i] = REST.y + ((this.py[i]! - REST.y) / s) * R * 2.6;
      }
    }
  }

  private drawBody(): void {
    const g = this.body.clear();
    const color = this.state.color;
    const cx = this.px.reduce((a, b) => a + b, 0) / N;
    const cy = this.py.reduce((a, b) => a + b, 0) / N;
    const shape = (scale: number, dy: number) => {
      g.beginPath();
      for (let i = 0; i <= N; i++) {
        // Midpoints between ring points, for a softer outline than the ring itself.
        const a = i % N;
        const b = (i + 1) % N;
        const x = cx + ((this.px[a]! + this.px[b]!) / 2 - cx) * scale;
        const y = cy + ((this.py[a]! + this.py[b]!) / 2 - cy) * scale + dy;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
      g.fillPath();
    };
    g.fillStyle(toHex(DARKS_OF[color]!), 1);
    shape(1, 6);
    g.fillStyle(toHex(COLORS_OF[color]!), 1);
    shape(1, 0);
    for (const b of this.bits) {
      const x = cx + (this.px[b.at]! - cx) * b.out;
      const y = cy + (this.py[b.at]! - cy) * b.out;
      if (b.kind === 0) {
        g.fillStyle(b.color % 2 ? 0xffffff : toHex(COLORS.sunny), 0.9);
        g.fillRect(x - 1.5, y - 1.5, 3, 3);
      } else if (b.kind === 1) {
        g.fillStyle(toHex(COLORS_OF[b.color]!), 1);
        g.fillCircle(x, y, 6);
        g.fillStyle(0xffffff, 0.5);
        g.fillCircle(x - 2, y - 2, 2);
      } else if (b.kind === 2) {
        g.fillStyle(0xffffff, 0.85);
        g.fillCircle(x, y, 4);
      } else {
        g.fillStyle(toHex(COLORS.sunny), 1);
        g.fillTriangle(x, y - 7, x - 6, y + 4, x + 6, y + 4);
        g.fillTriangle(x, y + 7, x - 6, y - 4, x + 6, y - 4);
      }
    }
    g.fillStyle(0xffffff, 0.45);
    g.fillEllipse(cx - R * 0.45, cy - R * 0.4, 60, 26);
  }

  private drawUi(): void {
    const g = this.ui.clear();
    const s = this.state;
    COLORS_OF.forEach((c, k) => {
      if (k === s.color) {
        g.fillStyle(toHex(COLORS.ink), 1);
        g.fillCircle(this.paletteX(k), PALETTE_Y, 30);
      }
      g.fillStyle(toHex(c), 1);
      g.fillCircle(this.paletteX(k), PALETTE_Y, 24);
    });
    MIX_NAMES.forEach((_, k) => {
      const x = this.mixX(k);
      g.fillStyle(toHex(s.mixins[k] ? DARK.mint : '#D9D3EC'), 1);
      g.fillRoundedRect(x - 62, MIX_Y - 24 + 5, 124, 48, 24);
      g.fillStyle(toHex(s.mixins[k] ? COLORS.mint : '#FFFFFF'), 1);
      g.fillRoundedRect(x - 62, MIX_Y - 24, 124, 48, 24);
    });
    g.fillStyle(toHex(DARK.grape), 1);
    g.fillRoundedRect(W / 2 - 100, DONE_Y - 28 + 6, 200, 56, 28);
    g.fillStyle(toHex(COLORS.grape), 1);
    g.fillRoundedRect(W / 2 - 100, DONE_Y - 28, 200, 56, 28);
  }

  layoutCheck(): { name: string; top: number; bottom: number }[] {
    return [
      { name: 'the slime', top: 60, bottom: FLOOR + 30 },
      { name: 'the colors', top: PALETTE_Y - 30, bottom: PALETTE_Y + 30 },
      { name: 'the mix-ins', top: MIX_Y - 24, bottom: MIX_Y + 29 },
      { name: 'done', top: DONE_Y - 28, bottom: DONE_Y + 34 },
    ];
  }
}

export function slimeStatus(state: SlimeState): string | undefined {
  if (state.result) return undefined;
  if (!state.mixins.some(Boolean)) return 'Pick a color, mix something in, then squish it';
  return state.pokes ? `Squished ${state.pokes} ${state.pokes === 1 ? 'time' : 'times'}` : 'Poke it, or pull it and let go';
}

export function slimeResult(state: SlimeState): string | undefined {
  if (!state.result) return undefined;
  const n = state.mixins.filter(Boolean).length;
  return n ? `A squishy slime with ${n} ${n === 1 ? 'thing' : 'things'} mixed in.` : 'A plain, perfect slime.';
}
