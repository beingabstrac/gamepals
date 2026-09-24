import { STAR_HOLES, STAR_POINTS, targetOf, type StarMove, type StarState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { focusRing, moveRing, onKeys } from '../keys';

const W = 600;
const H = 700;
export const STAR_SIZE = { width: W, height: H };
export const STAR_COLORS = [COLORS.sky, COLORS.tomato, COLORS.mint, COLORS.sunny];
const STAR_DARK = [DARK.sky, DARK.tomato, DARK.mint, DARK.sunny];
export const STAR_NAMES = ['Blue', 'Red', 'Green', 'Yellow'];

const D = 43;
const CX = W / 2;
const CY = 372;
const MARBLE_R = 17;

const holeXY = (p: number) => {
  const h = STAR_HOLES[p]!;
  return { x: CX + (h.q + h.r / 2) * D, y: CY + h.r * D * 0.866 };
};

/**
 * Chinese Checkers. The rules find every hole a marble can reach and the hops that get it there;
 * the scene draws the star with each player's point tinted, lights the reachable holes when you pick
 * a marble, and hops the marble along its path in little arcs.
 */
export class StarScene extends Scene {
  private marbles = new Map<number, GameObjects.Container>();
  private hints!: GameObjects.Graphics;
  private ring!: GameObjects.Graphics;
  private topText!: GameObjects.Text;
  private selected: number | null = null;
  /** The keyboard's place: a marble of yours, or a hole it can reach once one is picked. */
  private focus = 0;
  private moving = 0;

  constructor(private readonly session: Session<StarMove>) {
    super('chinese-checkers');
  }

  private get state(): StarState {
    return this.session.state as StarState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.drawBoard();
    this.hints = this.add.graphics().setDepth(2);
    this.ring = focusRing(this, MARBLE_R * 2 + 12, MARBLE_R * 2 + 12, MARBLE_R + 6);
    this.topText = sharpText(this, W / 2, 30, '', 22, COLORS.ink).setFontStyle('bold');
    this.state.board.forEach((who, p) => who !== -1 && this.marbles.set(p, this.makeMarble(who, p)));
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      this.ring.setVisible(false);
      let best = -1;
      let near = D * 0.5;
      for (let h = 0; h < STAR_HOLES.length; h++) {
        const q = holeXY(h);
        const d = Math.hypot(p.worldX - q.x, p.worldY - q.y);
        if (d < near) {
          near = d;
          best = h;
        }
      }
      if (best >= 0) this.tap(best);
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

  /** A marble still hopping. See `apps/client/src/games/busy.ts`. */
  busy(): boolean {
    return this.moving > 0;
  }

  private drawBoard(): void {
    const g = this.add.graphics().setDepth(0);
    const state = this.state;
    // Each point is washed in the color of whoever starts there, and faintly in the color of
    // whoever is heading for it, so you can see where you are going.
    const tint = new Map<number, [string, number]>();
    for (let seat = 0; seat < state.players; seat++) {
      const start = state.start(seat);
      for (const p of STAR_POINTS[start]!) tint.set(p, [STAR_COLORS[seat]!, 0.3]);
      for (const p of STAR_POINTS[targetOf(start)]!) if (!tint.has(p)) tint.set(p, [STAR_COLORS[seat]!, 0.14]);
    }
    for (let p = 0; p < STAR_HOLES.length; p++) {
      const { x, y } = holeXY(p);
      const wash = tint.get(p);
      if (wash) {
        g.fillStyle(toHex(wash[0]), wash[1]);
        g.fillCircle(x, y, D * 0.52);
      }
      g.fillStyle(0xd8d0ee, 1);
      g.fillCircle(x, y + 2, 12);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(x, y, 11);
    }
  }

  private makeMarble(seat: number, p: number): GameObjects.Container {
    const g = this.add.graphics();
    g.fillStyle(toHex(STAR_DARK[seat]!), 1);
    g.fillCircle(0, 3, MARBLE_R);
    g.fillStyle(toHex(STAR_COLORS[seat]!), 1);
    g.fillCircle(0, 0, MARBLE_R);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(-5, -6, 4.5);
    const { x, y } = holeXY(p);
    return this.add.container(x, y, [g]).setDepth(5);
  }

  private changed(): void {
    const state = this.state;
    const last = state.last;
    this.selected = null;
    if (!last) return this.refresh();
    const from = last.path[0]!;
    const to = last.path[last.path.length - 1]!;
    const marble = this.marbles.get(from);
    if (!marble) return this.refresh();
    this.marbles.delete(from);
    this.marbles.set(to, marble);
    this.moving++;
    marble.setDepth(7);
    const hops = last.path.slice(1);
    const next = (i: number): void => {
      if (i >= hops.length) {
        marble.setDepth(5);
        this.tweens.add({ targets: marble, scaleX: { from: 1.2, to: 1 }, scaleY: { from: 0.82, to: 1 }, duration: 160, ease: 'Back.easeOut' });
        this.moving--;
        if (state.result) cue('win');
        this.refresh();
        return;
      }
      const a = { x: marble.x, y: marble.y };
      const b = holeXY(hops[i]!);
      const jump = Math.hypot(b.x - a.x, b.y - a.y) > D * 1.3;
      cue(jump ? 'tap' : 'place');
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: jump ? 190 : 140,
        ease: 'Sine.easeInOut',
        onUpdate: (tween) => {
          const t = tween.getValue() ?? 0;
          marble.setPosition(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - (jump ? Math.sin(t * Math.PI) * 28 : 0));
        },
        onComplete: () => next(i + 1),
      });
    };
    next(0);
    this.refresh();
  }

  private tap(p: number): void {
    const state = this.state;
    if (!this.session.isHumanTurn() || this.busy()) return;
    const seat = state.currentSeat;
    if (state.board[p] === seat) {
      this.selected = this.selected === p ? null : p;
      cue('tap');
      return this.refresh();
    }
    if (this.selected === null) return;
    const move = `m${this.selected}-${p}`;
    if (state.legalMoves(seat).includes(move)) this.session.play(move);
    else {
      this.selected = null;
      this.refresh();
    }
  }

  /** What the keyboard ring walks: your marbles that can move, or where the picked one can go. */
  private stops(): number[] {
    const state = this.state;
    if (this.selected !== null) return [...state.reach(this.selected).keys()];
    const seat = state.currentSeat;
    return state.board.flatMap((who, p) => (who === seat && state.reach(p).size ? [p] : []));
  }

  private key(key: string): boolean {
    if (!this.session.isHumanTurn() || this.busy()) return false;
    const stops = this.stops();
    if (!stops.length) return false;
    if (key.startsWith('Arrow')) {
      // Walk them in order across and down the board, the way the eye reads it.
      const sorted = stops.slice().sort((a, b) => holeXY(a).y - holeXY(b).y || holeXY(a).x - holeXY(b).x);
      const at = Math.max(0, sorted.indexOf(this.focus));
      const step = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : sorted.length - 1;
      this.focus = sorted[(at + step) % sorted.length]!;
      const { x, y } = holeXY(this.focus);
      moveRing(this, this.ring, x, y);
      return true;
    }
    if (key === 'Enter' || key === ' ') {
      if (stops.includes(this.focus)) this.tap(this.focus);
      return true;
    }
    if (key === 'Escape') {
      this.selected = null;
      this.refresh();
      return true;
    }
    return false;
  }

  private refresh(): void {
    const state = this.state;
    const g = this.hints.clear();
    const seat = state.currentSeat;
    this.topText.setText(state.result ? '' : `${STAR_NAMES[seat]}: race every marble to the far point`);
    if (state.last) {
      const path = state.last.path;
      g.lineStyle(3, toHex(STAR_COLORS[state.last.seat]!), 0.35);
      for (let i = 1; i < path.length; i++) {
        const a = holeXY(path[i - 1]!);
        const b = holeXY(path[i]!);
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
    }
    if (!this.session.isHumanTurn() || this.busy() || state.result) return;
    if (this.selected !== null) {
      const s = holeXY(this.selected);
      g.lineStyle(5, toHex(COLORS.grape), 1);
      g.strokeCircle(s.x, s.y, MARBLE_R + 5);
      for (const to of state.reach(this.selected).keys()) {
        const { x, y } = holeXY(to);
        g.fillStyle(toHex(COLORS.grape), 0.45);
        g.fillCircle(x, y, 8);
      }
    }
  }
}

export function starStatus(state: StarState, names: readonly string[]): string | undefined {
  if (state.result) return undefined;
  const name = names[state.currentSeat] ?? STAR_NAMES[state.currentSeat];
  return `${name} to move`;
}

export const starSeatColors = (players: number): string[] => STAR_COLORS.slice(0, players);
export const starSeatNames = (players: number): string[] => STAR_NAMES.slice(0, players);
