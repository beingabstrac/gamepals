import { GOMOKU_N, gomokuMove, type GomokuState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera } from '../crisp';
import { focusRing, moveRing, onKeys } from '../keys';

const W = 600;
const H = 640;
export const GOMOKU_CANVAS = { width: W, height: H };
export const GOMOKU_COLORS = [COLORS.ink, '#C9C2E0'];

const N = GOMOKU_N;
const GAP = 38;
const GRID = { x: (W - GAP * (N - 1)) / 2, y: 50 };
const STARS = [
  [3, 3],
  [11, 3],
  [7, 7],
  [3, 11],
  [11, 11],
];

/**
 * Gomoku. The rules keep the stones; the scene draws a sunny board with its lines and star
 * points, drops each stone in with a little squash, marks the last one, and draws a line through
 * the five that won.
 */
export class GomokuScene extends Scene {
  private stones!: GameObjects.Graphics;
  private ring!: GameObjects.Graphics;
  private focus = Math.floor((N * N) / 2);
  private dropping = 0;

  constructor(private readonly session: Session<string>) {
    super('gomoku');
  }

  private get state(): GomokuState {
    return this.session.state as GomokuState;
  }

  private xy(cell: number): { x: number; y: number } {
    return { x: GRID.x + (cell % N) * GAP, y: GRID.y + Math.floor(cell / N) * GAP };
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.drawBoard();
    this.stones = this.add.graphics().setDepth(2);
    this.ring = focusRing(this, GAP, GAP, GAP / 2);
    this.drawStones();
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      this.ring.setVisible(false);
      const col = Math.round((p.worldX - GRID.x) / GAP);
      const row = Math.round((p.worldY - GRID.y) / GAP);
      if (col < 0 || row < 0 || col >= N || row >= N) return;
      this.place(row * N + col);
    });
    onKeys(this, (key) => {
      const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -N, ArrowDown: N } as Record<string, number>)[key];
      if (step !== undefined) {
        const col = this.focus % N;
        if (!((step === -1 && col === 0) || (step === 1 && col === N - 1))) this.focus = Math.max(0, Math.min(N * N - 1, this.focus + step));
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
    this.session.play(gomokuMove(cell));
  }

  private changed(): void {
    const s = this.state;
    const last = s.last;
    this.drawStones();
    if (last === null) return;
    cue(s.result ? (s.result.draw ? 'draw' : 'win') : 'place');
    // The new stone drops in: a quick squash as it lands.
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
    const r = GAP * 0.44;
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

  private drawStones(): void {
    const g = this.stones.clear();
    const s = this.state;
    s.board.forEach((v, i) => {
      if (!v || (this.dropping && i === s.last)) return;
      const { x, y } = this.xy(i);
      this.stone(g, x, y, v);
    });
    if (s.last !== null && !this.dropping) {
      const { x, y } = this.xy(s.last);
      g.fillStyle(toHex(COLORS.tomato), 1);
      g.fillCircle(x, y, 5);
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
    const size = GAP * (N - 1);
    g.fillStyle(toHex(DARK.sunny), 1);
    g.fillRoundedRect(GRID.x - 30, GRID.y - 30 + 8, size + 60, size + 60, 26);
    g.fillStyle(toHex('#FFD66B'), 1);
    g.fillRoundedRect(GRID.x - 30, GRID.y - 30, size + 60, size + 60, 26);
    g.lineStyle(2, toHex('#C9912A'), 1);
    for (let k = 0; k < N; k++) {
      g.lineBetween(GRID.x, GRID.y + k * GAP, GRID.x + size, GRID.y + k * GAP);
      g.lineBetween(GRID.x + k * GAP, GRID.y, GRID.x + k * GAP, GRID.y + size);
    }
    g.fillStyle(toHex('#C9912A'), 1);
    for (const [x, y] of STARS) g.fillCircle(GRID.x + x! * GAP, GRID.y + y! * GAP, 5);
  }

  /** The bands the board keeps to, for the layout check. */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    return [{ name: 'board', top: GRID.y - 30, bottom: GRID.y + GAP * (N - 1) + 38 }];
  }
}

export function gomokuStatus(state: GomokuState, names: readonly string[]): string | undefined {
  if (state.result) return undefined;
  const name = names[state.currentSeat] ?? `Player ${state.currentSeat + 1}`;
  return `${name} to play`;
}

export function gomokuResult(state: GomokuState, names: readonly string[]): string | undefined {
  if (!state.result) return undefined;
  if (state.result.draw) return 'The board is full: a draw';
  return `${names[state.result.winners[0]!] ?? 'Someone'} made five in a row!`;
}
