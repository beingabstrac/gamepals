import { BLOCK_CELLS, BLOCK_GOAL, BLOCK_SHAPES, BLOCK_SIZE, type BlockMove, type BlockState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { onKeys } from '../keys';

const W = 600;
const H = 880;
export const BLOCK_CANVAS = { width: W, height: H };
export const BLOCK_COLORS = [COLORS.peach];

const CELL = 64;
const GX = (W - BLOCK_SIZE * CELL) / 2;
const GY = 80;
const HAND_Y = 720;
const HAND_X = [110, 300, 490];
const MINI = 26;
/** How far above the finger a dragged piece rides, so the finger never hides where it will land. */
const LIFT = 120;
const PALETTE = [COLORS.sky, COLORS.tomato, COLORS.mint, COLORS.sunny, COLORS.grape, COLORS.peach, COLORS.bubblegum];
const LIPS = [DARK.sky, DARK.tomato, DARK.mint, DARK.sunny, DARK.grape, DARK.peach, DARK.bubblegum];

const colorOf = (shape: number) => shape % PALETTE.length;

/**
 * Block Puzzle. The rules keep the grid, the hand and the score; the scene draws them, lets you
 * drag a piece up from the hand (it snaps to the grid, green where it fits and red where it does
 * not), and flashes and pops the lines it clears.
 */
export class BlockScene extends Scene {
  private g!: GameObjects.Graphics;
  private scoreText!: GameObjects.Text;
  private shout!: GameObjects.Text;
  /** The piece picked up, by hand slot, and where the finger is. */
  private held: { k: number; x: number; y: number; dragging: boolean } | null = null;
  /** The keyboard's anchor cell for the picked piece. */
  private anchor = 27;
  private clearing: { cells: readonly number[]; t: number } | null = null;

  constructor(private readonly session: Session<BlockMove>) {
    super('block-puzzle');
  }

  private get state(): BlockState {
    return this.session.state as BlockState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.g = this.add.graphics();
    this.scoreText = sharpText(this, W / 2, 38, '', 28, COLORS.ink).setFontStyle('bold');
    this.shout = sharpText(this, W / 2, GY + (BLOCK_SIZE * CELL) / 2, '', 46, COLORS.bubblegum).setFontStyle('bold').setStroke('#FFFFFF', 8).setDepth(10).setAlpha(0);
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.down(p.worldX, p.worldY));
    this.input.on('pointermove', (p: { worldX: number; worldY: number; isDown: boolean }) => {
      if (!this.held || !p.isDown) return;
      this.held = { ...this.held, x: p.worldX, y: p.worldY, dragging: true };
      this.draw();
    });
    this.input.on('pointerup', (p: { worldX: number; worldY: number }) => this.up(p.worldX, p.worldY));
    onKeys(this, (key) => this.key(key));
    const off = this.session.subscribe(() => this.changed());
    this.session.holdBots = () => this.busy();
    this.events.once('shutdown', () => {
      off();
      this.session.holdBots = null;
    });
    this.draw();
  }

  /** Lines still popping. See `apps/client/src/games/busy.ts`. */
  busy(): boolean {
    return this.clearing !== null;
  }

  update(time: number): void {
    if (this.clearing && time - this.clearing.t > 360) this.clearing = null;
    if (this.clearing) this.draw();
  }

  /** The cell the held piece's top-left corner would land on, from where the finger is. */
  private dropCell(x: number, y: number, shape: number): number | null {
    const cells = BLOCK_SHAPES[shape]!;
    const w = Math.max(...cells.map(([dx]) => dx)) + 1;
    const h = Math.max(...cells.map(([, dy]) => dy)) + 1;
    const col = Math.round((x - GX - (w * CELL) / 2) / CELL);
    const row = Math.round((y - LIFT - GY - (h * CELL) / 2) / CELL);
    if (col < 0 || row < 0 || col + w > BLOCK_SIZE || row + h > BLOCK_SIZE) return null;
    return row * BLOCK_SIZE + col;
  }

  private down(x: number, y: number): void {
    const state = this.state;
    if (!this.session.isHumanTurn() || state.result || this.busy()) return;
    const k = HAND_X.findIndex((hx) => Math.abs(x - hx) < 90 && Math.abs(y - HAND_Y) < 100);
    if (k >= 0 && state.hand[k] !== null) {
      this.held = { k, x, y, dragging: false };
      cue('tap');
      return this.draw();
    }
    // With a piece picked by tapping, a tap on the grid puts its corner there.
    if (this.held && !this.held.dragging && y < GY + BLOCK_SIZE * CELL) {
      const col = Math.floor((x - GX) / CELL);
      const row = Math.floor((y - GY) / CELL);
      if (col >= 0 && row >= 0 && col < BLOCK_SIZE && row < BLOCK_SIZE) this.place(this.held.k, row * BLOCK_SIZE + col);
    }
  }

  private up(x: number, y: number): void {
    if (!this.held || !this.held.dragging) return;
    const shape = this.state.hand[this.held.k];
    const at = shape === null || shape === undefined ? null : this.dropCell(x, y, shape);
    const k = this.held.k;
    this.held = null;
    if (at !== null && this.state.fits(shape!, at)) this.place(k, at);
    else {
      cue('wall');
      this.draw();
    }
  }

  private place(k: number, at: number): void {
    const move = `m${k}-${at}`;
    if (!this.state.legalMoves(0).includes(move)) {
      cue('buzz');
      return;
    }
    this.held = null;
    this.session.play(move);
  }

  private changed(): void {
    const state = this.state;
    const last = state.last;
    if (last?.cleared.length) {
      cue('capture');
      this.cameras.main.shake(120, 0.004);
      this.clearing = { cells: last.cleared, t: this.time.now };
      if (last.lines >= 2 || state.streak >= 2) {
        const word = last.lines >= 3 ? 'Amazing!' : last.lines === 2 ? 'Double!' : `Streak ${state.streak}!`;
        this.shout.setText(word).setAlpha(1).setScale(0.6);
        this.tweens.killTweensOf(this.shout);
        this.tweens.add({ targets: this.shout, scale: 1, duration: 220, ease: 'Back.easeOut' });
        this.tweens.add({ targets: this.shout, alpha: 0, delay: 650, duration: 300 });
      }
    } else if (last) cue('place');
    if (state.result) cue(state.result.winners.length ? 'win' : 'lose');
    this.draw();
  }

  private key(key: string): boolean {
    const state = this.state;
    if (!this.session.isHumanTurn() || state.result) return false;
    const n = Number(key);
    if (Number.isInteger(n) && n >= 1 && n <= 3 && state.hand[n - 1] !== null) {
      this.held = { k: n - 1, x: 0, y: 0, dragging: false };
      this.draw();
      return true;
    }
    if (!this.held) return false;
    const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -BLOCK_SIZE, ArrowDown: BLOCK_SIZE } as Record<string, number>)[key];
    if (step !== undefined) {
      const col = this.anchor % BLOCK_SIZE;
      if (!((step === -1 && col === 0) || (step === 1 && col === BLOCK_SIZE - 1))) {
        const next = this.anchor + step;
        if (next >= 0 && next < BLOCK_CELLS) this.anchor = next;
      }
      this.draw();
      return true;
    }
    if (key === 'Enter' || key === ' ') {
      this.place(this.held.k, this.anchor);
      return true;
    }
    if (key === 'Escape') {
      this.held = null;
      this.draw();
      return true;
    }
    return false;
  }

  private block(x: number, y: number, size: number, color: number, alpha = 1): void {
    const pad = size * 0.06;
    this.g.fillStyle(toHex(LIPS[color]!), alpha);
    this.g.fillRoundedRect(x + pad, y + pad + size * 0.07, size - pad * 2, size - pad * 2, size * 0.2);
    this.g.fillStyle(toHex(PALETTE[color]!), alpha);
    this.g.fillRoundedRect(x + pad, y + pad, size - pad * 2, size - pad * 2 - size * 0.04, size * 0.2);
    this.g.fillStyle(0xffffff, 0.35 * alpha);
    this.g.fillRoundedRect(x + size * 0.2, y + size * 0.16, size * 0.3, size * 0.1, size * 0.05);
  }

  private draw(): void {
    const state = this.state;
    const g = this.g.clear();
    this.scoreText.setText(`${state.score} points${state.score < BLOCK_GOAL ? ` · goal ${BLOCK_GOAL}` : ' · goal reached!'}`);
    g.fillStyle(0xe6e0f4, 1);
    g.fillRoundedRect(GX - 10, GY - 10 + 6, BLOCK_SIZE * CELL + 20, BLOCK_SIZE * CELL + 20, 22);
    g.fillStyle(0xf4f1fb, 1);
    g.fillRoundedRect(GX - 10, GY - 10, BLOCK_SIZE * CELL + 20, BLOCK_SIZE * CELL + 20, 22);
    for (let c = 0; c < BLOCK_CELLS; c++) {
      const x = GX + (c % BLOCK_SIZE) * CELL;
      const y = GY + Math.floor(c / BLOCK_SIZE) * CELL;
      const v = state.board[c]!;
      if (v) this.block(x, y, CELL, colorOf(v - 1));
      else {
        g.fillStyle(0xffffff, 1);
        g.fillRoundedRect(x + 3, y + 3, CELL - 6, CELL - 6, 10);
      }
    }
    // Cleared lines flash white and shrink away.
    if (this.clearing) {
      const t = Math.min(1, (this.time.now - this.clearing.t) / 360);
      for (const c of this.clearing.cells) {
        const x = GX + (c % BLOCK_SIZE) * CELL + CELL / 2;
        const y = GY + Math.floor(c / BLOCK_SIZE) * CELL + CELL / 2;
        const s = (1 - t) * CELL * 0.45;
        g.fillStyle(0xffffff, 1 - t * 0.5);
        g.fillRoundedRect(x - s, y - s, s * 2, s * 2, 10);
      }
    }
    // Where the held piece would land: green where it fits, red where it does not.
    const held = this.held;
    const shape = held ? state.hand[held.k] : null;
    if (held && shape !== null && shape !== undefined) {
      const at = held.dragging ? this.dropCell(held.x, held.y, shape) : this.anchor;
      if (at !== null) {
        const ok = state.fits(shape, at);
        for (const [dx, dy] of BLOCK_SHAPES[shape]!) {
          const col = (at % BLOCK_SIZE) + dx;
          const row = Math.floor(at / BLOCK_SIZE) + dy;
          if (col >= BLOCK_SIZE || row >= BLOCK_SIZE) continue;
          g.fillStyle(toHex(ok ? COLORS.mint : COLORS.tomato), 0.35);
          g.fillRoundedRect(GX + col * CELL + 3, GY + row * CELL + 3, CELL - 6, CELL - 6, 10);
        }
      }
    }
    // The hand, and the dragged piece riding above the finger.
    state.hand.forEach((piece, k) => {
      if (piece === null) return;
      const cells = BLOCK_SHAPES[piece]!;
      const dragging = held?.k === k && held.dragging;
      const size = dragging ? CELL : MINI;
      const w = (Math.max(...cells.map(([dx]) => dx)) + 1) * size;
      const h = (Math.max(...cells.map(([, dy]) => dy)) + 1) * size;
      const cx = dragging ? held!.x : HAND_X[k]!;
      const cy = dragging ? held!.y - LIFT : HAND_Y;
      const fits = state.legalMoves(0).some((m) => m.startsWith(`m${k}-`));
      if (held?.k === k && !dragging) {
        g.lineStyle(5, toHex(COLORS.grape), 1);
        g.strokeRoundedRect(HAND_X[k]! - 86, HAND_Y - 86, 172, 172, 24);
      }
      for (const [dx, dy] of cells) this.block(cx - w / 2 + dx * size, cy - h / 2 + dy * size, size, colorOf(piece), fits || dragging ? 1 : 0.35);
    });
  }

  /** The bands the board keeps to, for the layout check. */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    return [
      { name: 'score', top: 22, bottom: 54 },
      { name: 'grid', top: GY - 10, bottom: GY + BLOCK_SIZE * CELL + 16 },
      { name: 'hand', top: HAND_Y - 86, bottom: HAND_Y + 86 },
    ];
  }
}

export function blockStatus(state: BlockState): string | undefined {
  if (state.result) return undefined;
  const left = state.hand.filter((p) => p !== null).length;
  return `${left} ${left === 1 ? 'piece' : 'pieces'} to place`;
}

export function blockResult(state: BlockState): string | undefined {
  if (!state.result) return undefined;
  return state.result.winners.length ? `No room left. ${state.score} points, past the goal! 🎉` : `No room left. ${state.score} points.`;
}
