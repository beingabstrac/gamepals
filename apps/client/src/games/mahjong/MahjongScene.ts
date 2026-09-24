import { type MahjongMove, type MahjongState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { focusRing, moveRing, onKeys } from '../keys';

const W = 680;
const H = 620;
export const MAHJONG_CANVAS = { width: W, height: H };
export const MAHJONG_COLORS = [COLORS.sunny];

const BUTTONS_Y = 570;
/** How far each layer is lifted, up and to the left, so the stack reads as a stack. */
const LIFT = 5;
const PIPS: readonly (readonly number[])[] = [[4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8], [0, 2, 3, 4, 5, 6, 8], [0, 1, 2, 3, 5, 6, 7, 8], [0, 1, 2, 3, 4, 5, 6, 7, 8]];

/** Draws a tile face centered at (0, 0) in a box `w` by `h`: our own pictures, no borrowed art. */
function drawFace(scene: Scene, face: number, look: number, w: number, h: number): GameObjects.GameObject[] {
  const g = scene.add.graphics();
  const out: GameObjects.GameObject[] = [g];
  const u = Math.min(w, h * 0.75);
  if (face < 18) {
    // Dots (sky, tomato and mint pips) and sticks (green bars), one to nine on a three by three grid.
    const n = (face % 9) + 1;
    const dots = face < 9;
    PIPS[n - 1]!.forEach((cell, k) => {
      const x = ((cell % 3) - 1) * u * 0.28;
      const y = (Math.floor(cell / 3) - 1) * h * 0.26;
      if (dots) {
        const color = [COLORS.sky, COLORS.tomato, COLORS.mint][k % 3]!;
        g.fillStyle(toHex(color), 1);
        g.fillCircle(x, y, u * 0.11);
        g.fillStyle(0xffffff, 0.8);
        g.fillCircle(x, y, u * 0.04);
      } else {
        g.fillStyle(toHex(DARK.mint), 1);
        g.fillRoundedRect(x - u * 0.05, y - h * 0.1, u * 0.1, h * 0.2, u * 0.04);
        g.fillStyle(toHex(COLORS.mint), 1);
        g.fillRoundedRect(x - u * 0.035, y - h * 0.09, u * 0.07, h * 0.18, u * 0.03);
      }
    });
  } else if (face < 27) {
    // Numbers: a big numeral with a small flower under it.
    out.push(sharpText(scene, 0, -h * 0.08, String(face - 17), Math.round(h * 0.42), COLORS.tomato).setFontStyle('bold'));
    g.fillStyle(toHex(COLORS.bubblegum), 1);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      g.fillCircle(Math.cos(a) * u * 0.07, h * 0.27 + Math.sin(a) * u * 0.07, u * 0.05);
    }
  } else if (face < 31) {
    // Winds: a fat arrow pointing up, right, down or left.
    const turn = (face - 27) * (Math.PI / 2);
    const pts = [
      [0, -0.3],
      [0.22, -0.02],
      [0.08, -0.02],
      [0.08, 0.28],
      [-0.08, 0.28],
      [-0.08, -0.02],
      [-0.22, -0.02],
    ].map(([px, py]) => {
      const x = px! * u;
      const y = py! * u;
      return { x: x * Math.cos(turn) - y * Math.sin(turn), y: x * Math.sin(turn) + y * Math.cos(turn) };
    });
    g.fillStyle(toHex(COLORS.grape), 1);
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.closePath();
    g.fillPath();
  } else if (face === 31) {
    g.fillStyle(toHex(COLORS.tomato), 1);
    g.fillCircle(-u * 0.12, -u * 0.06, u * 0.15);
    g.fillCircle(u * 0.12, -u * 0.06, u * 0.15);
    g.fillTriangle(-u * 0.26, 0, u * 0.26, 0, 0, u * 0.3);
  } else if (face === 32) {
    g.fillStyle(toHex(COLORS.mint), 1);
    for (let k = 0; k < 3; k++) {
      const a = -Math.PI / 2 + (k * 2 * Math.PI) / 3;
      g.fillCircle(Math.cos(a) * u * 0.14, Math.sin(a) * u * 0.14, u * 0.14);
    }
    g.fillRect(-u * 0.025, u * 0.1, u * 0.05, u * 0.22);
  } else if (face === 33) {
    g.lineStyle(u * 0.08, toHex(COLORS.sky), 1);
    g.strokeRoundedRect(-u * 0.26, -u * 0.3, u * 0.52, u * 0.6, u * 0.08);
  } else if (face === 34) {
    // Flowers: four pictures, any matching any.
    const petal = [COLORS.bubblegum, COLORS.sunny, COLORS.peach, COLORS.grape][look % 4]!;
    g.fillStyle(toHex(petal), 1);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      g.fillCircle(Math.cos(a) * u * 0.16, Math.sin(a) * u * 0.16, u * 0.12);
    }
    g.fillStyle(toHex(COLORS.sunny), 1);
    g.fillCircle(0, 0, u * 0.1);
  } else {
    // Seasons: sun, rain, a falling leaf and snow, any matching any.
    if (look % 4 === 0) {
      g.fillStyle(toHex(COLORS.sunny), 1);
      g.fillCircle(0, 0, u * 0.16);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        g.fillCircle(Math.cos(a) * u * 0.28, Math.sin(a) * u * 0.28, u * 0.05);
      }
    } else if (look % 4 === 1) {
      g.fillStyle(toHex(COLORS.sky), 1);
      g.fillCircle(0, u * 0.08, u * 0.17);
      g.fillTriangle(-u * 0.15, 0, u * 0.15, 0, 0, -u * 0.3);
    } else if (look % 4 === 2) {
      g.fillStyle(toHex(COLORS.peach), 1);
      g.fillEllipse(0, 0, u * 0.3, u * 0.5);
      g.lineStyle(u * 0.03, toHex(DARK.peach), 1);
      g.lineBetween(0, -u * 0.22, 0, u * 0.3);
    } else {
      g.lineStyle(u * 0.05, toHex(COLORS.sky), 1);
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI;
        g.lineBetween(Math.cos(a) * u * 0.28, Math.sin(a) * u * 0.28, -Math.cos(a) * u * 0.28, -Math.sin(a) * u * 0.28);
      }
    }
  }
  return out;
}

/**
 * Mahjong Solitaire. The rules know which tiles are free and which pairs match; the scene stacks
 * the tiles with each layer lifted, lets you pick two, and flies a matched pair up and away. A
 * tile that is not free wobbles when tapped. Hint shows a pair; Shuffle deals the rest again.
 */
export class MahjongScene extends Scene {
  private tiles = new Map<number, GameObjects.Container>();
  private picked: number | null = null;
  private hint: [number, number] | null = null;
  private buttons!: GameObjects.Graphics;
  private buttonTexts: GameObjects.Text[] = [];
  private ring!: GameObjects.Graphics;
  private focus = 0;
  private moving = 0;
  private tileW = 40;
  private tileH = 52;
  private ox = 0;
  private oy = 0;

  constructor(private readonly session: Session<MahjongMove>) {
    super('mahjong');
  }

  private get state(): MahjongState {
    return this.session.state as MahjongState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.fit();
    this.buttons = this.add.graphics().setDepth(200);
    this.buttonTexts = [
      sharpText(this, W / 2 - 120, BUTTONS_Y, 'Hint', 24, '#FFFFFF').setFontStyle('bold').setDepth(201),
      sharpText(this, W / 2 + 120, BUTTONS_Y, '', 24, '#FFFFFF').setFontStyle('bold').setDepth(201),
    ];
    this.ring = focusRing(this, this.tileW + 8, this.tileH + 8, 10);
    this.build();
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      this.ring.setVisible(false);
      if (Math.abs(p.worldY - BUTTONS_Y) < 28) {
        if (Math.abs(p.worldX - (W / 2 - 120)) < 100) return this.showHint();
        if (Math.abs(p.worldX - (W / 2 + 120)) < 100) return this.play('shuffle');
      }
      const i = this.tileAt(p.worldX, p.worldY);
      if (i !== null) this.tap(i);
    });
    onKeys(this, (key) => this.key(key));
    const off = this.session.subscribe(() => this.changed());
    this.session.holdBots = () => this.busy();
    this.events.once('shutdown', () => {
      off();
      this.session.holdBots = null;
    });
    this.refresh();
  }

  /** A pair still flying off. See `apps/client/src/games/busy.ts`. */
  busy(): boolean {
    return this.moving > 0;
  }

  /** Tile size and origin that fit this layout in the space above the buttons. */
  private fit(): void {
    const slots = this.state.slots;
    const minX = Math.min(...slots.map((s) => s.x));
    const maxX = Math.max(...slots.map((s) => s.x)) + 2;
    const minY = Math.min(...slots.map((s) => s.y));
    const maxY = Math.max(...slots.map((s) => s.y)) + 2;
    const maxZ = Math.max(...slots.map((s) => s.z));
    const half = Math.min((W - 40) / (maxX - minX), (BUTTONS_Y - 70 - maxZ * LIFT) / ((maxY - minY) * 1.3));
    this.tileW = half * 2;
    this.tileH = half * 2 * 1.3;
    this.ox = (W - (maxX - minX) * half) / 2 - minX * half + (maxZ * LIFT) / 2;
    this.oy = 30 + maxZ * LIFT - minY * half * 1.3;
  }

  private tileXY(i: number): { x: number; y: number } {
    const s = this.state.slots[i]!;
    const half = this.tileW / 2;
    return { x: this.ox + s.x * half + half - s.z * LIFT, y: this.oy + s.y * half * 1.3 + this.tileH / 2 - s.z * LIFT };
  }

  private build(): void {
    const state = this.state;
    const order = state.slots.map((_, i) => i).sort((a, b) => {
      const s = state.slots[a]!;
      const t = state.slots[b]!;
      return s.z - t.z || s.y - t.y || s.x - t.x;
    });
    order.forEach((i, rank) => {
      const face = state.faces[i]!;
      if (face < 0) return;
      const { x, y } = this.tileXY(i);
      const g = this.add.graphics();
      const w = this.tileW - 3;
      const h = this.tileH - 3;
      g.fillStyle(toHex(DARK.sunny), 1);
      g.fillRoundedRect(-w / 2 + 3, -h / 2 + 4, w, h, 8);
      g.fillStyle(0xfff6dd, 1);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
      const container = this.add.container(x, y, [g, ...drawFace(this, face, state.looks[i]!, w, h)]).setDepth(10 + rank);
      this.tiles.set(i, container);
    });
  }

  private tileAt(x: number, y: number): number | null {
    // The topmost tile under the finger wins.
    let best: number | null = null;
    let bestDepth = -1;
    for (const [i, c] of this.tiles) {
      if (Math.abs(x - c.x) <= this.tileW / 2 && Math.abs(y - c.y) <= this.tileH / 2 && c.depth > bestDepth) {
        bestDepth = c.depth;
        best = i;
      }
    }
    return best;
  }

  private tap(i: number): void {
    const state = this.state;
    if (!this.session.isHumanTurn() || this.busy() || state.result) return;
    if (!state.isFree(i)) {
      const c = this.tiles.get(i)!;
      cue('buzz');
      this.tweens.add({ targets: c, angle: { from: -6, to: 0 }, duration: 260, ease: 'Elastic.easeOut' });
      return;
    }
    if (this.picked === null || this.picked === i) {
      this.picked = this.picked === i ? null : i;
      cue('tap');
      return this.refresh();
    }
    const move = `m${Math.min(this.picked, i)}-${Math.max(this.picked, i)}`;
    if (state.legalMoves(0).includes(move)) this.play(move);
    else {
      this.picked = i;
      cue('tap');
      this.refresh();
    }
  }

  private play(move: MahjongMove): void {
    if (!this.session.isHumanTurn() || this.busy()) return;
    if (!this.state.legalMoves(0).includes(move)) return cue('buzz');
    this.session.play(move);
  }

  private showHint(): void {
    const pair = this.state.pairs()[0];
    if (!pair) return cue('buzz');
    this.hint = pair;
    cue('tap');
    this.refresh();
    this.time.delayedCall(1400, () => {
      this.hint = null;
      this.refresh();
    });
  }

  private changed(): void {
    const state = this.state;
    this.picked = null;
    this.hint = null;
    const last = state.last;
    if (last) {
      cue('capture');
      for (const i of last) {
        const c = this.tiles.get(i);
        if (!c) continue;
        this.tiles.delete(i);
        this.moving++;
        c.setDepth(300);
        this.tweens.add({ targets: c, y: c.y - 80, scale: 1.2, alpha: 0, duration: 380, ease: 'Cubic.easeIn', onComplete: () => (c.destroy(), this.moving--, this.refresh()) });
      }
    } else {
      // A shuffle: every tile turns over and comes back with its new face.
      for (const c of this.tiles.values()) c.destroy();
      this.tiles.clear();
      this.build();
      cue('roll');
      for (const c of this.tiles.values()) {
        c.setScale(0.6, 1);
        this.tweens.add({ targets: c, scaleX: 1, duration: 260, ease: 'Back.easeOut' });
      }
    }
    if (state.result?.winners.length) cue('win');
    this.refresh();
  }

  private key(key: string): boolean {
    if (!this.session.isHumanTurn() || this.busy()) return false;
    const free = [...this.tiles.keys()].filter((i) => this.state.isFree(i)).sort((a, b) => this.tileXY(a).y - this.tileXY(b).y || this.tileXY(a).x - this.tileXY(b).x);
    if (key.startsWith('Arrow') && free.length) {
      const at = Math.max(0, free.indexOf(this.focus));
      this.focus = free[(at + (key === 'ArrowRight' || key === 'ArrowDown' ? 1 : free.length - 1)) % free.length]!;
      const { x, y } = this.tileXY(this.focus);
      moveRing(this, this.ring, x, y);
      return true;
    }
    if ((key === 'Enter' || key === ' ') && free.includes(this.focus)) {
      this.tap(this.focus);
      return true;
    }
    if (key === 'h' || key === 'H') {
      this.showHint();
      return true;
    }
    if (key === 's' || key === 'S') {
      this.play('shuffle');
      return true;
    }
    return false;
  }

  private refresh(): void {
    const state = this.state;
    for (const [i, c] of this.tiles) {
      const lit = i === this.picked || (this.hint !== null && this.hint.includes(i));
      c.setY(this.tileXY(i).y - (lit ? 6 : 0));
      const g = c.list[0] as GameObjects.Graphics;
      g.setAlpha(1);
      c.setAlpha(state.isFree(i) || state.result ? 1 : 0.92);
      if (lit) {
        // A picked or hinted tile lifts and goes pink round the edge.
        const w = this.tileW - 3;
        const h = this.tileH - 3;
        g.lineStyle(4, toHex(i === this.picked ? COLORS.grape : COLORS.bubblegum), 1);
        g.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
      } else {
        this.redrawTile(g);
      }
    }
    const b = this.buttons.clear();
    const live = !state.result && this.session.isHumanTurn();
    const buttons: [number, string, boolean][] = [
      [W / 2 - 120, 'Hint', live],
      [W / 2 + 120, `Shuffle (${state.shuffles})`, live && state.shuffles > 0],
    ];
    buttons.forEach(([x, label, on], k) => {
      b.fillStyle(toHex(on ? DARK.grape : '#D8D3E6'), 1);
      b.fillRoundedRect(x - 100, BUTTONS_Y - 26 + 5, 200, 52, 26);
      b.fillStyle(toHex(on ? COLORS.grape : COLORS.line), 1);
      b.fillRoundedRect(x - 100, BUTTONS_Y - 26, 200, 52, 26);
      this.buttonTexts[k]!.setText(label).setColor(on ? '#FFFFFF' : COLORS.soft).setVisible(!state.result);
    });
    if (state.result) b.clear();
  }

  private redrawTile(g: GameObjects.Graphics): void {
    const w = this.tileW - 3;
    const h = this.tileH - 3;
    g.clear();
    g.fillStyle(toHex(DARK.sunny), 1);
    g.fillRoundedRect(-w / 2 + 3, -h / 2 + 4, w, h, 8);
    g.fillStyle(0xfff6dd, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
  }
}

export function mahjongStatus(state: MahjongState): string | undefined {
  if (state.result) return undefined;
  const pairs = state.pairs().length;
  return `${state.left} tiles left · ${pairs} ${pairs === 1 ? 'pair' : 'pairs'} to take`;
}

export function mahjongResult(state: MahjongState): string | undefined {
  if (!state.result) return undefined;
  return state.result.winners.length ? 'Cleared! 🎉' : `No pairs left and no shuffles. ${state.left} tiles to go.`;
}
