import {
  layMove,
  TOPPLE_GOAL,
  TOPPLE_REACH,
  TOPPLE_SPACING,
  TOPPLE_TABLE,
  TOPPLE_THICK,
  TOPPLE_WIDE,
  type ToppleMove,
  type ToppleState,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { onKeys } from '../keys';

const W = 600;
const H = 860;
export const TOPPLE_CANVAS = { width: W, height: H };
export const TOPPLE_TINTS = [COLORS.tomato];

const TABLE = { x: (W - TOPPLE_TABLE.w) / 2, y: 30 };
const BUTTON_Y = TABLE.y + TOPPLE_TABLE.h + 64;
const CANDY = [COLORS.tomato, COLORS.peach, COLORS.sunny, COLORS.mint, COLORS.sky, COLORS.grape, COLORS.bubblegum] as const;
const CANDY_DARK = [DARK.tomato, DARK.peach, DARK.sunny, DARK.mint, DARK.sky, DARK.grape, DARK.bubblegum] as const;

interface Piece {
  box: GameObjects.Container;
  body: GameObjects.Graphics;
  pips: GameObjects.Graphics;
}

/**
 * Dominoes Topple. The rules keep where every domino stands and work out the chain when one is
 * pushed; this scene draws them from above, thin while standing, laid flat with their pips once
 * down, lays a domino every step of a finger drawn across the table, and plays the chain out.
 */
export class ToppleScene extends Scene {
  private pieces: Piece[] = [];
  private stroke: { x: number; y: number; laid: boolean; moved: boolean } | null = null;
  private falling = 0;

  constructor(private readonly session: Session<ToppleMove>) {
    super('dominoes-topple');
  }

  private get state(): ToppleState {
    return this.session.state as ToppleState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    const g = this.add.graphics();
    g.fillStyle(toHex('#D9CDB8'), 1);
    g.fillRoundedRect(TABLE.x, TABLE.y + 8, TOPPLE_TABLE.w, TOPPLE_TABLE.h, 30);
    g.fillStyle(toHex('#F3E9D8'), 1);
    g.fillRoundedRect(TABLE.x, TABLE.y, TOPPLE_TABLE.w, TOPPLE_TABLE.h, 30);
    for (const [x, label, color, dark] of [
      [W / 2 - 130, 'Stand up', COLORS.sky, DARK.sky],
      [W / 2 + 130, 'Clear', COLORS.bubblegum, DARK.bubblegum],
    ] as const) {
      g.fillStyle(toHex(dark), 1);
      g.fillRoundedRect(x - 110, BUTTON_Y - 28 + 6, 220, 56, 28);
      g.fillStyle(toHex(color), 1);
      g.fillRoundedRect(x - 110, BUTTON_Y - 28, 220, 56, 28);
      sharpText(this, x, BUTTON_Y, label, 24, '#FFFFFF').setFontStyle('bold');
    }
    this.state.dominoes.forEach((_, i) => this.addPiece(i));
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.down(p.worldX, p.worldY));
    this.input.on('pointermove', (p: { worldX: number; worldY: number; isDown: boolean }) => {
      if (p.isDown) this.drag(p.worldX, p.worldY);
    });
    this.input.on('pointerup', (p: { worldX: number; worldY: number }) => this.up(p.worldX, p.worldY));
    onKeys(this, (key) => {
      const turn = ({ ArrowUp: 0, ArrowLeft: -30, ArrowRight: 30 } as Record<string, number>)[key];
      if (turn !== undefined) {
        this.layNext(turn);
        return true;
      }
      if (key === 'Enter' || key === ' ') {
        const first = this.state.down.findIndex((d) => !d);
        if (first >= 0) this.send(`t${first}`);
        return true;
      }
      if (key === 'u' || key === 'U') return this.send('up'), true;
      if (key === 'c' || key === 'C') return this.send('clear'), true;
      return false;
    });
    const off = this.session.subscribe(() => this.changed());
    this.session.holdBots = () => this.falling > 0;
    this.events.once('shutdown', () => {
      off();
      this.session.holdBots = null;
    });
  }

  private send(move: ToppleMove): boolean {
    if (!this.session.isHumanTurn() || this.state.result || this.falling) return false;
    if (!this.state.allows(move)) return false;
    this.session.play(move);
    return true;
  }

  /** The keyboard's line: the next domino a step on from the last, turned a little or not. */
  private layNext(turn: number): void {
    const tail = this.state.dominoes[this.state.dominoes.length - 1];
    if (!tail) {
      this.send(layMove(80, 140, 0));
      return;
    }
    const a = tail.a + turn;
    const r = (a * Math.PI) / 180;
    if (!this.send(layMove(tail.x + TOPPLE_SPACING * Math.cos(r), tail.y + TOPPLE_SPACING * Math.sin(r), a))) cue('buzz');
  }

  private toTable(x: number, y: number): { x: number; y: number } {
    return { x: x - TABLE.x, y: y - TABLE.y };
  }

  private down(x: number, y: number): void {
    if (Math.abs(y - BUTTON_Y) < 30) {
      if (Math.abs(x - (W / 2 - 130)) < 110) this.send('up');
      else if (Math.abs(x - (W / 2 + 130)) < 110) this.send('clear');
      return;
    }
    const t = this.toTable(x, y);
    if (t.x < 0 || t.y < 0 || t.x > TOPPLE_TABLE.w || t.y > TOPPLE_TABLE.h) return;
    this.stroke = { x: t.x, y: t.y, laid: false, moved: false };
  }

  /** A finger drawn across the table lays a domino every step, facing the way it goes. */
  private drag(x: number, y: number): void {
    const s = this.stroke;
    if (!s) return;
    const t = this.toTable(x, y);
    const d = Math.hypot(t.x - s.x, t.y - s.y);
    if (d > 10) s.moved = true;
    if (d < TOPPLE_SPACING) return;
    const a = (Math.atan2(t.y - s.y, t.x - s.x) * 180) / Math.PI;
    // The first domino of a line waits for the finger to move, so it knows which way to face.
    if (!s.laid) this.send(layMove(s.x, s.y, a));
    // A quick finger covers more than a step between two moves: lay every step along the way.
    const steps = Math.floor(d / TOPPLE_SPACING);
    const ux = (t.x - s.x) / d;
    const uy = (t.y - s.y) / d;
    for (let k = 1; k <= steps; k++) this.send(layMove(s.x + ux * TOPPLE_SPACING * k, s.y + uy * TOPPLE_SPACING * k, a));
    this.stroke = { x: s.x + ux * TOPPLE_SPACING * steps, y: s.y + uy * TOPPLE_SPACING * steps, laid: true, moved: true };
  }

  /** A tap that did not draw pushes over the standing domino under it. */
  private up(x: number, y: number): void {
    const s = this.stroke;
    this.stroke = null;
    if (!s || s.moved) return;
    const t = this.toTable(x, y);
    let best = -1;
    let bestD = 22;
    this.state.dominoes.forEach((d, i) => {
      const dist = Math.hypot(d.x - t.x, d.y - t.y);
      if (!this.state.down[i] && dist < bestD) {
        best = i;
        bestD = dist;
      }
    });
    if (best >= 0) this.send(`t${best}`);
  }

  /** A domino seen from above, drawn laid flat along its length; standing, it is squashed to its thickness. */
  private addPiece(i: number): void {
    const d = this.state.dominoes[i]!;
    const k = i % CANDY.length;
    const body = this.add.graphics();
    body.fillStyle(toHex(CANDY_DARK[k]!), 1);
    body.fillRoundedRect(0, -TOPPLE_WIDE / 2 + 3, TOPPLE_REACH, TOPPLE_WIDE, 5);
    body.fillStyle(toHex(CANDY[k]!), 1);
    body.fillRoundedRect(0, -TOPPLE_WIDE / 2, TOPPLE_REACH, TOPPLE_WIDE, 5);
    const pips = this.add.graphics();
    pips.fillStyle(0xffffff, 0.9);
    pips.fillRect(TOPPLE_REACH / 2 - 1, -TOPPLE_WIDE / 2 + 4, 2, TOPPLE_WIDE - 8);
    const n1 = 1 + ((i * 3) % 6);
    const n2 = 1 + ((i * 5 + 2) % 6);
    for (const [cx, n] of [
      [TOPPLE_REACH * 0.25, n1],
      [TOPPLE_REACH * 0.75, n2],
    ] as const)
      for (let p = 0; p < n; p++) pips.fillCircle(cx + ((p % 2) - 0.5) * 8, (Math.floor(p / 2) - (Math.ceil(n / 2) - 1) / 2) * 7, 2.2);
    const box = this.add.container(TABLE.x + d.x, TABLE.y + d.y, [body, pips]).setAngle(d.a).setDepth(2);
    body.setScale(TOPPLE_THICK / TOPPLE_REACH, 1);
    pips.setAlpha(0);
    this.pieces[i] = { box, body, pips };
    if (this.state.down[i]) this.lay(i, d.a, 0);
  }

  /** Falls flat, pivoting on its front edge. */
  private lay(i: number, dir: number, duration: number): void {
    const p = this.pieces[i]!;
    p.box.setAngle(dir);
    if (!duration) {
      p.body.setScale(1, 1);
      p.pips.setAlpha(1);
      return;
    }
    this.tweens.add({ targets: p.body, scaleX: 1, duration, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: p.pips, alpha: 1, duration, delay: duration * 0.6 });
  }

  private standAll(): void {
    this.pieces.forEach((p, i) => {
      p.box.setAngle(this.state.dominoes[i]!.a);
      this.tweens.add({ targets: p.body, scaleX: TOPPLE_THICK / TOPPLE_REACH, duration: 180, delay: i * 8, ease: 'Back.easeOut' });
      this.tweens.add({ targets: p.pips, alpha: 0, duration: 100, delay: i * 8 });
    });
  }

  private changed(): void {
    const s = this.state;
    const last = s.last;
    if (!last) return;
    if (last.kind === 'lay') {
      const i = s.dominoes.length - 1;
      this.addPiece(i);
      const box = this.pieces[i]!.box;
      box.setScale(0.4);
      this.tweens.add({ targets: box, scale: 1, duration: 160, ease: 'Back.easeOut' });
      cue('place');
    } else if (last.kind === 'clear') {
      for (const p of this.pieces) this.tweens.add({ targets: p.box, scale: 0, duration: 160, onComplete: () => p.box.destroy() });
      this.pieces = [];
      cue('pull');
    } else if (last.kind === 'up') {
      this.standAll();
      cue('roll');
    } else {
      this.falling++;
      let clicks = 0;
      last.falls.forEach((f, k) => {
        this.time.delayedCall(f.at, () => {
          this.lay(f.i, f.dir, 110);
          // A click for most of them, not all: a long run would be a buzz otherwise.
          if (k % 2 === 0 && clicks++ < 40) cue('tap');
        });
      });
      const end = (last.falls[last.falls.length - 1]?.at ?? 0) + 260;
      this.time.delayedCall(end, () => {
        this.falling--;
        if (s.result) {
          this.cameras.main.shake(200, 0.006);
          cue('win');
        } else if (s.standing > 0) cue('thud');
      });
    }
  }

  /** Still falling: the result sheet waits for the last domino to land. */
  busy(): boolean {
    return this.falling > 0;
  }

  /** The bands it draws in, for the layout check. */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    return [
      { name: 'table', top: TABLE.y, bottom: TABLE.y + TOPPLE_TABLE.h + 8 },
      { name: 'buttons', top: BUTTON_Y - 28, bottom: BUTTON_Y + 34 },
    ];
  }
}

export function toppleStatus(state: ToppleState): string | undefined {
  if (state.result) return undefined;
  const n = state.dominoes.length;
  if (!n) return 'Draw a line to lay dominoes';
  if (state.standing < n) return `${n - state.standing} of ${n} fell · Stand up and fix the gap`;
  return n < TOPPLE_GOAL ? `${n} dominoes · lay ${TOPPLE_GOAL - n} more, then tap the first` : `${n} dominoes · tap the first to push`;
}

export function toppleResult(state: ToppleState): string | undefined {
  if (!state.result) return undefined;
  return `All ${state.dominoes.length} fell with one push! 🎉`;
}
