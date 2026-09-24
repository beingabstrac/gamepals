import { dropRange, FRUIT_BOX, FRUIT_R, fruitMove, settle, type Fruit, type FruitMove, type FruitState, type World } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed, SPEED } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { onKeys } from '../keys';

const W = 600;
const H = 900;
export const FRUIT_CANVAS = { width: W, height: H };
export const FRUIT_COLORS = [COLORS.tomato];

/** Each size its own candy color, smallest first. */
const FRUIT_COLOR = [COLORS.tomato, COLORS.bubblegum, COLORS.grape, COLORS.sunny, COLORS.peach, COLORS.mint, COLORS.sky, COLORS.tomato, COLORS.bubblegum, COLORS.sunny, COLORS.mint];
const FRUIT_DARK = [DARK.tomato, DARK.bubblegum, DARK.grape, DARK.sunny, DARK.peach, DARK.mint, DARK.sky, DARK.tomato, DARK.bubblegum, DARK.sunny, DARK.mint];

/**
 * Fruit Merge. The rules run the box; the scene plays the same steps back so the fruit falls,
 * rolls and settles on screen exactly as the rules say, pops where two become one, and hangs the
 * next fruit over the box for you to aim.
 */
export class FruitScene extends Scene {
  private g!: GameObjects.Graphics;
  private aimX = W / 2;
  private frames: World[] = [];
  private frame = 0;
  private shownMade = 0;
  private dropping = false;
  /** The box as it stood before the last drop, to replay that drop from. */
  private before: FruitState | null = null;

  constructor(private readonly session: Session<FruitMove>) {
    super('fruit-merge');
  }

  private get state(): FruitState {
    return this.session.state as FruitState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.drawBox();
    this.before = this.state;
    this.g = this.add.graphics().setDepth(2);
    sharpText(this, W - 104, 34, 'Next', 22, COLORS.soft).setDepth(3);
    const aim = (p: { worldX: number }) => {
      const [lo, hi] = dropRange(this.state.kind);
      this.aimX = Math.min(hi, Math.max(lo, p.worldX));
    };
    this.input.on('pointerdown', aim);
    this.input.on('pointermove', (p: { worldX: number; isDown: boolean }) => p.isDown && aim(p));
    this.input.on('pointerup', (p: { worldX: number }) => {
      aim(p);
      this.drop();
    });
    onKeys(this, (key) => {
      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        const [lo, hi] = dropRange(this.state.kind);
        this.aimX = Math.min(hi, Math.max(lo, this.aimX + (key === 'ArrowLeft' ? -24 : 24)));
        return true;
      }
      if (key === 'Enter' || key === ' ' || key === 'ArrowDown') {
        this.drop();
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
    return this.dropping;
  }

  private drop(): void {
    if (!this.session.isHumanTurn() || this.busy() || this.state.result) return;
    const move = fruitMove(this.aimX);
    if (!this.state.allows(move)) return cue('buzz');
    this.session.play(move);
  }

  /** A drop was made: replay the box from the moment it was let go, step by step. */
  private changed(): void {
    const log = this.session.moves;
    const move = log[log.length - 1];
    const before = this.before;
    this.before = this.state;
    if (!move || !before) return;
    this.frames = [];
    settle(before.dropWorld(move), (w) => this.frames.push(w));
    this.frame = 0;
    this.shownMade = 0;
    this.dropping = true;
    cue('tap');
  }

  update(_time: number, delta: number): void {
    if (this.dropping) {
      // The rules step at 120 a second; play them back at that pace, sped up in test mode.
      this.frame += (Math.min(delta, 100) / 1000) * 120 * SPEED;
      const w = this.frames[Math.min(Math.floor(this.frame), this.frames.length - 1)];
      if (w) {
        for (; this.shownMade < w.made.length; this.shownMade++) this.pop(w, w.made[this.shownMade]!);
        this.draw(w.fruit);
      }
      if (this.frame >= this.frames.length - 1) {
        this.dropping = false;
        this.frames = [];
        if (this.state.result) cue('lose');
      }
    }
    if (!this.dropping) this.draw(this.state.fruit);
  }

  /** A merge: a burst of the new fruit's color where it appeared. */
  private pop(w: World, kind: number): void {
    const born = w.fruit.filter((f) => f.kind === kind).sort((a, b) => b.id - a.id)[0];
    cue(kind >= 7 ? 'win' : 'capture');
    if (!born) return;
    const color = toHex(FRUIT_COLOR[kind % FRUIT_COLOR.length]!);
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      const bit = this.add.circle(born.x, born.y, 7, color).setDepth(5);
      const reach = FRUIT_R[kind]! + 30;
      this.tweens.add({ targets: bit, x: born.x + Math.cos(a) * reach, y: born.y + Math.sin(a) * reach, alpha: 0, scale: 0.4, duration: 320, onComplete: () => bit.destroy() });
    }
  }

  private fruit(g: GameObjects.Graphics, kind: number, x: number, y: number, alpha = 1, radius = FRUIT_R[kind]!): void {
    const r = radius;
    g.fillStyle(toHex(FRUIT_DARK[kind % FRUIT_DARK.length]!), alpha);
    g.fillCircle(x, y + r * 0.06, r);
    g.fillStyle(toHex(FRUIT_COLOR[kind % FRUIT_COLOR.length]!), alpha);
    g.fillCircle(x, y, r * 0.97);
    g.fillStyle(0xffffff, 0.3 * alpha);
    g.fillEllipse(x - r * 0.35, y - r * 0.42, r * 0.5, r * 0.3);
    // A leaf on top and a little face.
    g.fillStyle(toHex(DARK.mint), alpha);
    g.fillEllipse(x + r * 0.2, y - r * 0.95, r * 0.42, r * 0.2);
    g.fillStyle(toHex(COLORS.ink), alpha);
    g.fillCircle(x - r * 0.25, y + r * 0.02, Math.max(2, r * 0.08));
    g.fillCircle(x + r * 0.25, y + r * 0.02, Math.max(2, r * 0.08));
    g.fillEllipse(x, y + r * 0.24, r * 0.22, r * 0.1);
  }

  private draw(fruit: readonly Fruit[]): void {
    const g = this.g.clear();
    const s = this.state;
    // The fruit in hand, hanging over the box on a dotted drop line (not while one is falling).
    if (!this.dropping && !s.result) {
      g.lineStyle(3, toHex(COLORS.line), 1);
      for (let y = FRUIT_BOX.top + FRUIT_R[s.kind]!; y < FRUIT_BOX.bottom; y += 22) g.lineBetween(this.aimX, y, this.aimX, y + 10);
      this.fruit(g, s.kind, this.aimX, FRUIT_BOX.top);
    }
    for (const f of fruit) this.fruit(g, f.kind, f.x, f.y);
    // The next one, small, in the corner above the reach of the fruit in hand.
    this.fruit(g, s.next, W - 44, 34, 1, 22);
  }

  private drawBox(): void {
    const g = this.add.graphics();
    const { left, right, bottom, line } = FRUIT_BOX;
    g.fillStyle(toHex('#FFF4E6'), 1);
    g.fillRoundedRect(left - 6, line - 60, right - left + 12, bottom - line + 66, 22);
    g.fillStyle(toHex(DARK.peach), 1);
    g.fillRoundedRect(left - 18, line - 60, 14, bottom - line + 78, 7);
    g.fillRoundedRect(right + 4, line - 60, 14, bottom - line + 78, 7);
    g.fillRoundedRect(left - 18, bottom + 4, right - left + 36, 16, 8);
    // The line not to cross, dashed.
    g.fillStyle(toHex(COLORS.tomato), 0.6);
    for (let x = left; x < right; x += 30) g.fillRoundedRect(x, line - 2, 16, 4, 2);
  }

  /** The bands the page keeps to, for the layout check. */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    return [{ name: 'box', top: FRUIT_BOX.top - FRUIT_R[4]!, bottom: FRUIT_BOX.bottom + 20 }];
  }
}

export function fruitStatus(state: FruitState): string | undefined {
  if (state.result) return undefined;
  return `Score ${state.score}`;
}

export function fruitResult(state: FruitState): string | undefined {
  if (!state.result) return undefined;
  return `The box is full. Score ${state.score}.`;
}
