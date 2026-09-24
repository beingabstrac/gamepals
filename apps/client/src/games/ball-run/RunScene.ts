import { DOWN, LEFT, RIGHT, UP, pieceSides, type RunMove, type RunState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera } from '../crisp';
import { focusRing, moveRing, onKeys } from '../keys';

const W = 600;
const H = 700;
export const RUN_CANVAS = { width: W, height: H };
export const RUN_COLORS = [COLORS.sky];

const BOARD = { x: 70, y: 90, w: 460 };

/**
 * Ball Run. The rules hold each piece's turn and follow the track; the scene draws the pieces as
 * candy tiles with a thick groove, spins a piece a quarter turn when tapped, lights the track that
 * already runs on from the start, and rolls the ball home along it when it is joined.
 */
export class RunScene extends Scene {
  private tiles: GameObjects.Container[] = [];
  private lit!: GameObjects.Graphics;
  private ends!: GameObjects.Graphics;
  private ball!: GameObjects.Container;
  private ring!: GameObjects.Graphics;
  private focus = 0;
  private spinning = 0;

  constructor(private readonly session: Session<RunMove>) {
    super('ball-run');
  }

  private get state(): RunState {
    return this.session.state as RunState;
  }

  private get cell(): number {
    return BOARD.w / this.state.size;
  }

  private cellXY(i: number): { x: number; y: number } {
    const n = this.state.size;
    return { x: BOARD.x + (i % n) * this.cell + this.cell / 2, y: BOARD.y + Math.floor(i / n) * this.cell + this.cell / 2 };
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    const bg = this.add.graphics();
    bg.fillStyle(toHex('#D8D3E6'), 1);
    bg.fillRoundedRect(BOARD.x - 14, BOARD.y - 14 + 6, BOARD.w + 28, BOARD.w + 28, 26);
    bg.fillStyle(toHex('#ECE8F6'), 1);
    bg.fillRoundedRect(BOARD.x - 14, BOARD.y - 14, BOARD.w + 28, BOARD.w + 28, 26);
    this.lit = this.add.graphics().setDepth(3);
    this.ends = this.add.graphics().setDepth(4);
    this.tiles = this.state.pieces.map((p, i) => this.makeTile(i, p.kind));
    this.syncTurns();
    const g = this.add.graphics();
    const r = this.cell * 0.2;
    g.fillStyle(toHex(DARK.grape), 1);
    g.fillCircle(0, 3, r);
    g.fillStyle(toHex(COLORS.grape), 1);
    g.fillCircle(0, 0, r);
    g.fillStyle(0xffffff, 0.45);
    g.fillCircle(-r * 0.35, -r * 0.35, r * 0.3);
    const s = this.cellXY(this.state.start.cell);
    this.ball = this.add.container(s.x - this.cell * 0.72, s.y, [g]).setDepth(6);
    this.ring = focusRing(this, this.cell - 4, this.cell - 4, 14);
    this.drawEnds();
    this.drawLit();
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      this.ring.setVisible(false);
      const n = this.state.size;
      const col = Math.floor((p.worldX - BOARD.x) / this.cell);
      const row = Math.floor((p.worldY - BOARD.y) / this.cell);
      if (col >= 0 && row >= 0 && col < n && row < n) this.turn(row * n + col);
    });
    onKeys(this, (key) => {
      const n = this.state.size;
      const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -n, ArrowDown: n } as Record<string, number>)[key];
      if (step !== undefined) {
        const col = this.focus % n;
        if (!((step === -1 && col === 0) || (step === 1 && col === n - 1))) this.focus = Math.max(0, Math.min(n * n - 1, this.focus + step));
        const c = this.cellXY(this.focus);
        moveRing(this, this.ring, c.x, c.y);
        return true;
      }
      if (key === 'Enter' || key === ' ') {
        this.turn(this.focus);
        return true;
      }
      return false;
    });
    const off = this.session.subscribe(() => this.changed());
    this.session.holdBots = () => this.spinning > 0;
    this.events.once('shutdown', () => {
      off();
      this.session.holdBots = null;
    });
  }

  private turn(i: number): void {
    if (!this.session.isHumanTurn() || this.state.result || this.spinning) return;
    if (!this.state.legalMoves(0).includes(`r${i}`)) return cue('buzz');
    this.session.play(`r${i}`);
  }

  /** A tile drawn at its first turn: a candy square with the groove running to the sides it joins. */
  private makeTile(i: number, kind: string): GameObjects.Container {
    const c = this.cell;
    const g = this.add.graphics();
    const s = c - 8;
    g.fillStyle(toHex('#C9C2E0'), 1);
    g.fillRoundedRect(-s / 2, -s / 2 + 4, s, s, s * 0.2);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(-s / 2, -s / 2, s, s, s * 0.2);
    const sides = pieceSides({ kind: kind as 'bend', turn: 0 });
    g.lineStyle(c * 0.22, toHex(COLORS.sky), 1);
    for (const [bit, dx, dy] of [
      [UP, 0, -1],
      [RIGHT, 1, 0],
      [DOWN, 0, 1],
      [LEFT, -1, 0],
    ] as const)
      if (sides & bit) g.lineBetween(0, 0, (dx * c) / 2, (dy * c) / 2);
    g.fillStyle(toHex(COLORS.sky), 1);
    g.fillCircle(0, 0, c * 0.11);
    const { x, y } = this.cellXY(i);
    return this.add.container(x, y, [g]).setDepth(2);
  }

  private syncTurns(): void {
    this.state.pieces.forEach((p, i) => this.tiles[i]!.setAngle(p.turn * 90));
  }

  private changed(): void {
    const s = this.state;
    const i = s.last;
    if (i === null) return;
    const tile = this.tiles[i]!;
    const to = s.pieces[i]!.turn * 90;
    this.spinning++;
    cue('tap');
    this.lit.clear();
    // Phaser keeps angles between -180 and 180, so turn by a quarter rather than to a number.
    this.tweens.add({
      targets: tile,
      angle: '+=90',
      duration: 160,
      ease: 'Back.easeOut',
      onComplete: () => {
        tile.setAngle(to);
        this.drawLit();
        if (s.result) this.rollHome();
        else this.spinning--;
      },
    });
  }

  /** The track that already runs on from the start, lit mint over the grooves. */
  private drawLit(): void {
    const g = this.lit.clear();
    const { cells } = this.state.trace();
    const c = this.cell;
    g.lineStyle(c * 0.12, toHex(COLORS.mint), 1);
    for (const cell of cells) {
      const { x, y } = this.cellXY(cell);
      const sides = pieceSides(this.state.pieces[cell]!);
      for (const [bit, dx, dy] of [
        [UP, 0, -1],
        [RIGHT, 1, 0],
        [DOWN, 0, 1],
        [LEFT, -1, 0],
      ] as const)
        if (sides & bit) g.lineBetween(x, y, x + (dx * c) / 2, y + (dy * c) / 2);
    }
  }

  /** The ball's ramp in on the left and the goal flag on the right. */
  private drawEnds(): void {
    const g = this.ends.clear();
    const s = this.cellXY(this.state.start.cell);
    const e = this.cellXY(this.state.goal.cell);
    const c = this.cell;
    g.fillStyle(toHex(COLORS.sky), 1);
    g.fillRoundedRect(s.x - c * 0.95, s.y - c * 0.11, c * 0.5, c * 0.22, c * 0.11);
    g.fillRoundedRect(e.x + c * 0.45, e.y - c * 0.11, c * 0.5, c * 0.22, c * 0.11);
    g.lineStyle(4, toHex(COLORS.ink), 1);
    g.lineBetween(e.x + c * 0.8, e.y, e.x + c * 0.8, e.y - c * 0.7);
    g.fillStyle(toHex(COLORS.tomato), 1);
    g.fillTriangle(e.x + c * 0.8, e.y - c * 0.7, e.x + c * 1.15, e.y - c * 0.58, e.x + c * 0.8, e.y - c * 0.46);
  }

  /** Joined: the ball rolls through every cell of the run to the flag. */
  private rollHome(): void {
    const { cells } = this.state.trace();
    const points = cells.map((cell) => this.cellXY(cell));
    const end = this.cellXY(this.state.goal.cell);
    points.push({ x: end.x + this.cell * 0.75, y: end.y });
    cue('roll');
    this.tweens.chain({
      targets: this.ball,
      tweens: points.map((p) => ({ x: p.x, y: p.y, duration: 90, ease: 'Linear' })),
      onComplete: () => {
        cue('win');
        this.spinning--;
      },
    });
  }

  /** The bands the board keeps to, for the layout check. */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    return [{ name: 'board', top: BOARD.y - 14, bottom: BOARD.y + BOARD.w + 20 }];
  }
}

export function runStatus(state: RunState): string | undefined {
  if (state.result) return undefined;
  return `${state.moves} ${state.moves === 1 ? 'turn' : 'turns'} · par ${state.par}`;
}

export function runResult(state: RunState): string | undefined {
  if (!state.result) return undefined;
  return state.moves <= state.par ? `Home in ${state.moves} turns: par! 🎉` : `Home in ${state.moves} turns (par ${state.par}).`;
}
