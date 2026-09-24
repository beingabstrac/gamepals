import { sixMove, sixTurnOf, type SixState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera } from '../crisp';
import { focusRing, moveRing, onKeys } from '../keys';

const W = 600;
const H = 640;
export const SIX_CANVAS = { width: W, height: H };
export const SIX_COLORS = [COLORS.ink, '#C9C2E0'];
/** The width the lines of the board take, whatever its size. */
const SPAN = 530;
const TOP = 50;

/**
 * Connect Six. The rules keep the stones and whose turn it is; the scene draws a mint board, drops
 * each stone in with a squash, marks the pair the last turn put down (and the first stone of a turn
 * still going), and draws a line through the six that won.
 */
export class SixScene extends Scene {
  private stones!: GameObjects.Graphics;
  private ring!: GameObjects.Graphics;
  private focus = 0;
  private dropping = 0;

  constructor(private readonly session: Session<string>) {
    super('connect-six');
  }

  private get state(): SixState {
    return this.session.state as SixState;
  }

  private get n(): number {
    return this.state.n;
  }

  private get gap(): number {
    return SPAN / (this.n - 1);
  }

  private xy(cell: number): { x: number; y: number } {
    const left = (W - SPAN) / 2;
    return { x: left + (cell % this.n) * this.gap, y: TOP + Math.floor(cell / this.n) * this.gap };
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.focus = Math.floor((this.n * this.n) / 2);
    this.drawBoard();
    this.stones = this.add.graphics().setDepth(2);
    this.ring = focusRing(this, this.gap, this.gap, this.gap / 2);
    this.drawStones();
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      this.ring.setVisible(false);
      const col = Math.round((p.worldX - (W - SPAN) / 2) / this.gap);
      const row = Math.round((p.worldY - TOP) / this.gap);
      if (col < 0 || row < 0 || col >= this.n || row >= this.n) return;
      this.place(row * this.n + col);
    });
    onKeys(this, (key) => {
      const n = this.n;
      const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -n, ArrowDown: n } as Record<string, number>)[key];
      if (step !== undefined) {
        const col = this.focus % n;
        if (!((step === -1 && col === 0) || (step === 1 && col === n - 1))) this.focus = Math.max(0, Math.min(n * n - 1, this.focus + step));
        const c = this.xy(this.focus);
        moveRing(this, this.ring, c.x, c.y);
        return true;
      }
      if (key === 'Enter' || key === ' ') {
        this.place(this.focus);
        return true;
      }
      return false;
    });
    const off = this.session.subscribe(() => this.changed());
    this.session.holdBots = () => this.dropping > 0;
    this.events.once('shutdown', () => {
      off();
      this.session.holdBots = null;
    });
  }

  private place(cell: number): void {
    if (!this.session.isHumanTurn() || this.state.result || this.dropping) return;
    if (this.state.board[cell] !== 0) return cue('buzz');
    this.session.play(sixMove(cell));
  }

  private changed(): void {
    const s = this.state;
    const last = s.last;
    this.drawStones();
    if (last === null) return;
    cue(s.result ? (s.result.draw ? 'draw' : 'win') : 'place');
    const at = this.xy(last);
    const g = this.add.graphics().setDepth(3).setPosition(at.x, at.y - 18).setScale(1.2, 0.8);
    this.stone(g, 0, 0, s.board[last]!);
    this.dropping++;
    this.tweens.add({
      targets: g,
      y: at.y,
      scaleX: 1,
      scaleY: 1,
      duration: 140,
      ease: 'Back.easeOut',
      onComplete: () => {
        g.destroy();
        this.dropping--;
        this.drawStones();
      },
    });
  }

  private stone(g: GameObjects.Graphics, x: number, y: number, who: number): void {
    const r = this.gap * 0.44;
    if (who === 1) {
      g.fillStyle(0x000000, 0.18);
      g.fillCircle(x + 2, y + 3, r);
      g.fillStyle(toHex(COLORS.ink), 1);
      g.fillCircle(x, y, r);
      g.fillStyle(0xffffff, 0.22);
      g.fillCircle(x - r * 0.35, y - r * 0.35, r * 0.3);
    } else {
      g.fillStyle(toHex('#C9C2E0'), 1);
      g.fillCircle(x, y + 3, r);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(x, y, r);
    }
  }

  /** The stones of the last whole turn, and the first stone of a turn still going. */
  private marked(): Set<number> {
    const s = this.state;
    const k = s.placed.length - 1;
    if (k < 0) return new Set();
    // Mid-turn (one stone of two down) the last turn's pair stays marked alongside it.
    const midTurn = !s.result && k > 0 && sixTurnOf(k) === sixTurnOf(s.stones);
    const from = sixTurnOf(k) - (midTurn ? 1 : 0);
    return new Set(s.placed.filter((_, i) => sixTurnOf(i) >= from));
  }

  private drawStones(): void {
    const g = this.stones.clear();
    const s = this.state;
    s.board.forEach((v, i) => {
      if (!v || (this.dropping && i === s.last)) return;
      const { x, y } = this.xy(i);
      this.stone(g, x, y, v);
    });
    if (!this.dropping)
      for (const cell of this.marked()) {
        const { x, y } = this.xy(cell);
        g.fillStyle(toHex(COLORS.tomato), 1);
        g.fillCircle(x, y, Math.max(3.5, this.gap * 0.13));
      }
    if (s.line.length) {
      const a = this.xy(s.line[0]!);
      const b = this.xy(s.line[s.line.length - 1]!);
      g.lineStyle(8, toHex(COLORS.tomato), 0.85);
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
  }

  private drawBoard(): void {
    const g = this.add.graphics();
    const left = (W - SPAN) / 2;
    g.fillStyle(toHex(DARK.mint), 1);
    g.fillRoundedRect(left - 28, TOP - 28 + 8, SPAN + 56, SPAN + 56, 26);
    g.fillStyle(toHex('#8FE3C0'), 1);
    g.fillRoundedRect(left - 28, TOP - 28, SPAN + 56, SPAN + 56, 26);
    g.lineStyle(2, toHex('#3E9C76'), 1);
    for (let k = 0; k < this.n; k++) {
      g.lineBetween(left, TOP + k * this.gap, left + SPAN, TOP + k * this.gap);
      g.lineBetween(left + k * this.gap, TOP, left + k * this.gap, TOP + SPAN);
    }
    // Star points: the middle and four around it, a quarter in from each side.
    const q = Math.round((this.n - 1) / 4);
    const mid = (this.n - 1) / 2;
    g.fillStyle(toHex('#3E9C76'), 1);
    for (const [x, y] of [
      [q, q],
      [this.n - 1 - q, q],
      [mid, mid],
      [q, this.n - 1 - q],
      [this.n - 1 - q, this.n - 1 - q],
    ])
      g.fillCircle(left + x! * this.gap, TOP + y! * this.gap, 5);
  }

  /** The bands the board keeps to, for the layout check. */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    return [{ name: 'board', top: TOP - 28, bottom: TOP + SPAN + 36 }];
  }
}

export function sixStatus(state: SixState, names: readonly string[]): string | undefined {
  if (state.result) return undefined;
  const name = names[state.currentSeat] ?? `Player ${state.currentSeat + 1}`;
  if (state.stones === 0) return `${name} starts with one stone`;
  return `${name}: ${state.left === 2 ? 'first' : 'second'} stone of two`;
}

export function sixResult(state: SixState, names: readonly string[]): string | undefined {
  if (!state.result) return undefined;
  if (state.result.draw) return 'The board is full: a draw';
  return `${names[state.result.winners[0]!] ?? 'Someone'} made six in a row!`;
}
