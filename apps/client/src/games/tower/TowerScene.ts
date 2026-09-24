import { towerMove, type TowerMove, type TowerState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { focusRing, moveRing, onKeys } from '../keys';

const W = 600;
const H = 900;
export const TOWER_CANVAS = { width: W, height: H };
export const TOWER_COLORS = [COLORS.peach, COLORS.sky, COLORS.mint, COLORS.grape];

const BLOCK_W = 120;
const BASE_Y = 860;
/** How far a block must be drawn out to count as pulled. */
const PULL = 90;
/** Drawing a block out over this long counts as fully careful. */
const STEADY = 0.7;
const WOOD = ['#F2C58C', '#EDB877', '#F5CF9E'];
const WOOD_DARK = '#C98F5A';

/**
 * Tower. The rules keep the rows and judge each pull; the scene draws the tower side on in warm
 * wood, lets you draw a block out with your finger (slower and steadier is more careful), asks
 * which free place on top it goes in, sways after every pull, and topples block by block when it
 * falls.
 */
export class TowerScene extends Scene {
  private box!: GameObjects.Container;
  private blocks = new Map<string, GameObjects.Container>();
  private ghost: GameObjects.Graphics | null = null;
  private drag: { row: number; slot: number; x0: number; t0: number } | null = null;
  /** A block drawn out and waiting for its place on top. */
  private pulled: { row: number; slot: number; care: number } | null = null;
  private hint!: GameObjects.Text;
  private ring!: GameObjects.Graphics;
  private focus = { row: 4, slot: 0 };
  private moving = 0;

  constructor(private readonly session: Session<TowerMove>) {
    super('tower');
  }

  private get state(): TowerState {
    return this.session.state as TowerState;
  }

  private get rowH(): number {
    return Math.min(40, 740 / Math.max(this.state.rows.length + 1, 18));
  }

  private blockXY(row: number, slot: number): { x: number; y: number } {
    return { x: W / 2 + (slot - 1) * BLOCK_W, y: BASE_Y - row * this.rowH - this.rowH / 2 };
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    const g = this.add.graphics();
    g.fillStyle(toHex('#E9E3F5'), 1);
    g.fillRoundedRect(W / 2 - 230, BASE_Y, 460, 22, 11);
    this.box = this.add.container(W / 2, BASE_Y);
    this.hint = sharpText(this, W / 2, 34, '', 24, COLORS.ink).setFontStyle('bold').setDepth(10);
    this.ring = focusRing(this, BLOCK_W - 6, 34, 10);
    this.build();
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.down(p.worldX, p.worldY));
    this.input.on('pointermove', (p: { worldX: number; isDown: boolean }) => {
      if (!this.drag || !p.isDown) return;
      const out = p.worldX - this.drag.x0;
      const b = this.blocks.get(`${this.drag.row}.${this.drag.slot}`);
      if (b) b.x = this.blockXY(this.drag.row, this.drag.slot).x - W / 2 + Math.max(-PULL * 1.4, Math.min(PULL * 1.4, out));
    });
    this.input.on('pointerup', (p: { worldX: number }) => this.up(p.worldX));
    onKeys(this, (key) => this.key(key));
    const off = this.session.subscribe(() => this.changed());
    this.session.holdBots = () => this.busy();
    this.events.once('shutdown', () => {
      off();
      this.session.holdBots = null;
    });
  }

  busy(): boolean {
    return this.moving > 0;
  }

  /** Whose turn it is and what to do, one plain line. */
  private say(): void {
    const s = this.state;
    if (s.result) return void this.hint.setText('');
    if (!this.session.isHumanTurn()) return void this.hint.setText('');
    this.hint.setText(this.pulled ? 'Tap a place on top for it' : 'Draw a block out, slowly');
  }

  private down(x: number, y: number): void {
    this.ring.setVisible(false);
    if (!this.session.isHumanTurn() || this.busy() || this.state.result) return;
    if (this.pulled) return this.place(x, y);
    const s = this.state;
    const row = Math.floor((BASE_Y - y) / this.rowH);
    const slot = Math.floor((x - (W / 2 - 1.5 * BLOCK_W)) / BLOCK_W);
    if (row < 0 || row >= s.pullBelow || slot < 0 || slot > 2 || !s.rows[row]![slot]) return;
    this.drag = { row, slot, x0: x, t0: this.time.now };
    cue('tap');
  }

  private up(x: number): void {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    const home = this.blockXY(d.row, d.slot).x - W / 2;
    const b = this.blocks.get(`${d.row}.${d.slot}`);
    if (Math.abs(x - d.x0) < PULL) {
      // Not far enough: it slides back in.
      if (b) this.tweens.add({ targets: b, x: home, duration: 120 });
      return;
    }
    // Care: a slow, steady draw is careful; a yank is not.
    const secs = (this.time.now - d.t0) / 1000;
    const care = Math.round(Math.max(0.15, Math.min(1, secs / STEADY)) * 100);
    this.pulled = { row: d.row, slot: d.slot, care };
    if (b) b.setAlpha(0.35);
    cue('pull');
    if (this.state.free.length === 1) this.send(this.state.free[0]!);
    else this.showFree();
    this.say();
  }

  private showFree(): void {
    this.ghost?.destroy();
    const g = this.add.graphics().setDepth(6);
    const top = this.state.topRow;
    for (const slot of this.state.free) {
      const { x, y } = this.blockXY(top, slot);
      g.lineStyle(4, toHex(COLORS.grape), 1);
      g.strokeRoundedRect(x - BLOCK_W / 2 + 3, y - this.rowH / 2 + 2, BLOCK_W - 6, this.rowH - 4, 8);
    }
    this.ghost = g;
  }

  private place(x: number, y: number): void {
    const top = this.state.topRow;
    const slot = this.state.free.find((s) => {
      const c = this.blockXY(top, s);
      return Math.abs(x - c.x) < BLOCK_W / 2 && Math.abs(y - c.y) < this.rowH;
    });
    if (slot === undefined) return;
    this.send(slot);
  }

  private send(to: number): void {
    const p = this.pulled;
    if (!p) return;
    this.pulled = null;
    this.ghost?.destroy();
    this.ghost = null;
    const move = towerMove(p.row, p.slot, to, p.care);
    if (!this.state.allows(move)) {
      cue('buzz');
      this.build();
      return;
    }
    this.session.play(move);
  }

  private key(key: string): boolean {
    const s = this.state;
    if (this.pulled) {
      const free = s.free;
      if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'Enter' || key === ' ') {
        const i = Math.max(0, free.indexOf(this.focus.slot));
        const next = key === 'ArrowLeft' ? free[Math.max(0, i - 1)]! : key === 'ArrowRight' ? free[Math.min(free.length - 1, i + 1)]! : free[i]!;
        this.focus = { row: s.topRow, slot: next };
        const c = this.blockXY(s.topRow, next);
        moveRing(this, this.ring, c.x, c.y);
        if (key === 'Enter' || key === ' ') this.send(next);
        return true;
      }
      return false;
    }
    const step = ({ ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [1, 0], ArrowDown: [-1, 0] } as Record<string, [number, number]>)[key];
    if (step) {
      this.focus = { row: Math.max(0, Math.min(s.pullBelow - 1, this.focus.row + step[0])), slot: Math.max(0, Math.min(2, this.focus.slot + step[1])) };
      const c = this.blockXY(this.focus.row, this.focus.slot);
      moveRing(this, this.ring, c.x, c.y);
      return true;
    }
    if ((key === 'Enter' || key === ' ') && this.session.isHumanTurn() && !this.busy() && s.rows[this.focus.row]?.[this.focus.slot] && this.focus.row < s.pullBelow) {
      this.pulled = { ...this.focus, care: 60 };
      this.blocks.get(`${this.focus.row}.${this.focus.slot}`)?.setAlpha(0.35);
      cue('pull');
      if (s.free.length === 1) this.send(s.free[0]!);
      else {
        this.showFree();
        this.say();
      }
      return true;
    }
    return false;
  }

  private block(row: number, slot: number): GameObjects.Container {
    const g = this.add.graphics();
    const h = this.rowH - 3;
    const shade = WOOD[(row * 3 + slot) % WOOD.length]!;
    g.fillStyle(toHex(WOOD_DARK), 1);
    g.fillRoundedRect(-BLOCK_W / 2 + 2, -h / 2 + 3, BLOCK_W - 4, h, 7);
    g.fillStyle(toHex(shade), 1);
    g.fillRoundedRect(-BLOCK_W / 2 + 2, -h / 2, BLOCK_W - 4, h - 2, 7);
    // Grain: two soft lines, the other way round on alternate rows as a real stack is laid.
    g.lineStyle(2, toHex(WOOD_DARK), 0.35);
    if (row % 2 === 0) {
      g.lineBetween(-BLOCK_W / 2 + 12, -h * 0.15, BLOCK_W / 2 - 12, -h * 0.15);
      g.lineBetween(-BLOCK_W / 2 + 18, h * 0.2, BLOCK_W / 2 - 22, h * 0.2);
    } else {
      g.strokeCircle(0, 0, h * 0.25);
    }
    const { x, y } = this.blockXY(row, slot);
    return this.add.container(x - W / 2, y - BASE_Y, [g]);
  }

  private build(): void {
    for (const b of this.blocks.values()) b.destroy();
    this.blocks.clear();
    this.state.rows.forEach((row, r) =>
      row.forEach((on, s) => {
        if (!on) return;
        const b = this.block(r, s);
        this.box.add(b);
        this.blocks.set(`${r}.${s}`, b);
      }),
    );
    this.say();
  }

  private changed(): void {
    const last = this.state.last;
    if (!last) return this.build();
    this.moving++;
    const moved = this.blocks.get(`${last.from.row}.${last.from.slot}`);
    const to = this.blockXY(last.to.row, last.to.slot);
    cue('place');
    const done = () => {
      this.build();
      if (last.fell) return this.topple();
      // Every pull sets the tower swaying a little.
      this.tweens.add({ targets: this.box, angle: { from: -1.2, to: 1.2 }, duration: 140, yoyo: true, repeat: 1, onComplete: () => (this.box.setAngle(0), this.moving--) });
    };
    if (!moved) return done();
    moved.setAlpha(1);
    // Out to the side, up over the top, and down into its place.
    const side = (last.from.slot === 0 ? -1 : 1) * 220;
    this.tweens.chain({
      targets: moved,
      tweens: [
        { x: side, duration: 160, ease: 'Quad.easeOut' },
        { y: to.y - BASE_Y - 60, duration: 220, ease: 'Quad.easeInOut' },
        { x: to.x - W / 2, y: to.y - BASE_Y, duration: 180, ease: 'Back.easeOut' },
      ],
      onComplete: done,
    });
  }

  /** Down it comes: every block tumbles off, the higher ones further. */
  private topple(): void {
    cue('lose');
    this.cameras.main.shake(300, 0.012);
    const way = (this.state.last?.from.slot ?? 1) === 0 ? -1 : 1;
    let k = 0;
    for (const [key, b] of this.blocks) {
      const row = Number(key.split('.')[0]);
      this.tweens.add({ targets: b, x: b.x + way * (60 + row * 14), y: -10 - (k % 3) * 12, angle: way * (40 + row * 6), duration: 520 + row * 12, delay: row * 18, ease: 'Quad.easeIn' });
      k++;
    }
    this.time.delayedCall(900, () => this.moving--);
  }

  /** The bands the page keeps to, for the layout check. */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    return [
      { name: 'hint', top: 20, bottom: 48 },
      { name: 'tower', top: BASE_Y - this.state.rows.length * this.rowH - this.rowH, bottom: BASE_Y + 22 },
    ];
  }
}

export function towerStatus(state: TowerState, names: readonly string[]): string | undefined {
  if (state.result) return undefined;
  const name = names[state.currentSeat] ?? `Player ${state.currentSeat + 1}`;
  return `${name} to pull · ${state.rows.length} rows`;
}

export function towerResult(state: TowerState, names: readonly string[]): string | undefined {
  if (!state.result) return undefined;
  const who = names[state.last?.seat ?? 0] ?? 'Someone';
  return state.last?.wobbled ? `It wobbled over on ${who}!` : `${who} brought it down!`;
}

