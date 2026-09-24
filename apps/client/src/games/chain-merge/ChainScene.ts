import { chainFits, chainMove, chainResult, CM_CHAINS, CM_COLS, CM_GOAL, CM_ROWS, touching, type ChainMove, type ChainState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { focusRing, moveRing, onKeys } from '../keys';

const W = 600;
const H = 880;
export const CHAIN_CANVAS = { width: W, height: H };
export const CHAIN_COLORS = [COLORS.grape];

const CELL = 110;
const GRID = { x: (W - CM_COLS * CELL) / 2, y: 100 };
const TILE_COLORS = [COLORS.tomato, COLORS.peach, COLORS.sunny, COLORS.mint, COLORS.sky, COLORS.grape, COLORS.bubblegum];
const TILE_DARK = [DARK.tomato, DARK.peach, DARK.sunny, DARK.mint, DARK.sky, DARK.grape, DARK.bubblegum];

/** A power of two as a player reads it: 2 to 512 in full, then 1K, 2K, 4K. */
export const chainLabel = (p: number) => (p >= 10 ? `${2 ** (p - 10)}K` : `${2 ** p}`);

/**
 * 2248. The rules hold the grid; the scene draws each number as a candy tile, a thick line through
 * the chain as your finger drags it, a bubble showing what the chain will make, and the tiles
 * dropping into the gaps once it goes.
 */
export class ChainScene extends Scene {
  private tiles: GameObjects.Container[] = [];
  private line!: GameObjects.Graphics;
  private bubble!: GameObjects.Container;
  private bubbleText!: GameObjects.Text;
  private ring!: GameObjects.Graphics;
  private chain: number[] = [];
  private dragging = false;
  private focus = 30;
  private moving = 0;

  constructor(private readonly session: Session<ChainMove>) {
    super('chain-merge');
  }

  private get state(): ChainState {
    return this.session.state as ChainState;
  }

  private cellXY(i: number): { x: number; y: number } {
    return { x: GRID.x + (i % CM_COLS) * CELL + CELL / 2, y: GRID.y + Math.floor(i / CM_COLS) * CELL + CELL / 2 };
  }

  private cellAt(x: number, y: number): number | null {
    const col = Math.floor((x - GRID.x) / CELL);
    const row = Math.floor((y - GRID.y) / CELL);
    if (col < 0 || row < 0 || col >= CM_COLS || row >= CM_ROWS) return null;
    // Only the middle of a cell counts while dragging, so a diagonal does not catch its neighbours.
    const c = this.cellXY(row * CM_COLS + col);
    return Math.hypot(x - c.x, y - c.y) < CELL * 0.42 ? row * CM_COLS + col : null;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.line = this.add.graphics().setDepth(4);
    this.bubbleText = sharpText(this, 0, 0, '', 30, '#FFFFFF').setFontStyle('bold');
    const bg = this.add.graphics();
    bg.fillStyle(toHex(COLORS.ink), 1);
    bg.fillRoundedRect(-46, -26, 92, 52, 26);
    bg.fillTriangle(-10, 24, 10, 24, 0, 36);
    this.bubble = this.add.container(0, 0, [bg, this.bubbleText]).setDepth(6).setVisible(false);
    this.ring = focusRing(this, CELL - 6, CELL - 6, 22);
    this.build();
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      this.ring.setVisible(false);
      if (!this.session.isHumanTurn() || this.busy() || this.state.result) return;
      const i = this.cellAt(p.worldX, p.worldY);
      if (i === null) return;
      this.dragging = true;
      this.chain = [i];
      cue('tap');
      this.drawChain();
    });
    this.input.on('pointermove', (p: { worldX: number; worldY: number }) => {
      if (!this.dragging) return;
      const i = this.cellAt(p.worldX, p.worldY);
      if (i !== null) this.reach(i);
    });
    const release = () => {
      if (!this.dragging) return;
      this.dragging = false;
      this.commit();
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
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

  /** The finger (or the keys) reached cell `i`: add it to the chain, or step back off the last one. */
  private reach(i: number): void {
    const last = this.chain[this.chain.length - 1];
    if (last === undefined || i === last) return;
    if (i === this.chain[this.chain.length - 2]) {
      this.chain.pop();
      cue('tap');
      return this.drawChain();
    }
    if (this.chain.includes(i) || !touching(last, i)) return;
    const next = [...this.chain, i];
    // Two different numbers can never start a chain; after that, only the same or double joins.
    if (!chainFits(next.map((c) => this.state.grid[c]!))) return;
    this.chain = next;
    cue('place');
    this.drawChain();
  }

  private commit(): void {
    const chain = this.chain;
    this.chain = [];
    this.drawChain();
    if (chain.length < 2) return;
    const move = chainMove(chain);
    if (!this.state.allows(move)) return cue('buzz');
    this.session.play(move);
  }

  private key(key: string): boolean {
    const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -CM_COLS, ArrowDown: CM_COLS } as Record<string, number>)[key];
    if (step !== undefined) {
      const col = this.focus % CM_COLS;
      if (!((step === -1 && col === 0) || (step === 1 && col === CM_COLS - 1))) {
        const next = this.focus + step;
        if (next >= 0 && next < CM_COLS * CM_ROWS) this.focus = next;
      }
      const { x, y } = this.cellXY(this.focus);
      moveRing(this, this.ring, x, y);
      return true;
    }
    if (key === 'Enter' || key === ' ') {
      if (!this.session.isHumanTurn() || this.busy() || this.state.result) return true;
      const last = this.chain[this.chain.length - 1];
      if (last === undefined) {
        this.chain = [this.focus];
        cue('tap');
        this.drawChain();
      } else if (last === this.focus) this.commit();
      else this.reach(this.focus);
      return true;
    }
    if (key === 'Backspace') {
      this.chain.pop();
      this.drawChain();
      return true;
    }
    if (key === 'Escape') {
      this.chain = [];
      this.drawChain();
      return true;
    }
    return false;
  }

  private tile(p: number, i: number): GameObjects.Container {
    const g = this.add.graphics();
    const s = CELL - 12;
    const k = (p - 1) % TILE_COLORS.length;
    g.fillStyle(toHex(TILE_DARK[k]!), 1);
    g.fillRoundedRect(-s / 2, -s / 2 + 6, s, s, 24);
    g.fillStyle(toHex(TILE_COLORS[k]!), 1);
    g.fillRoundedRect(-s / 2, -s / 2, s, s, 24);
    g.fillStyle(0xffffff, 0.28);
    g.fillRoundedRect(-s / 2 + 12, -s / 2 + 8, s - 24, 10, 5);
    const label = chainLabel(p);
    const text = sharpText(this, 0, 2, label, label.length > 3 ? 30 : 38, '#FFFFFF').setFontStyle('bold');
    const { x, y } = this.cellXY(i);
    return this.add.container(x, y, [g, text]).setDepth(2);
  }

  /** Lays the whole grid out afresh, each tile where it stands. */
  private build(): void {
    for (const t of this.tiles) t.destroy();
    this.tiles = this.state.grid.map((p, i) => this.tile(p, i));
  }

  private changed(): void {
    const last = this.state.last;
    if (!last) return this.build();
    const end = last.cells[last.cells.length - 1]!;
    const to = this.cellXY(end);
    this.moving++;
    cue(last.made >= CM_GOAL ? 'win' : 'capture');
    // The chain's tiles slide into its end, then the grid settles with its new numbers.
    const going = last.cells.slice(0, -1).map((c) => this.tiles[c]!);
    for (const t of going) t.setDepth(3);
    this.tweens.add({
      targets: going,
      x: to.x,
      y: to.y,
      scale: 0.5,
      alpha: 0.4,
      duration: 180,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.build();
        // Each tile falls from where it was (or from above the grid if it is new) with a little bounce.
        this.state.grid.forEach((_, i) => {
          const t = this.tiles[i]!;
          const from = last.fell[i]!;
          const fromY = from >= 0 ? this.cellXY(from).y : GRID.y - CELL * (1 + (CM_ROWS - Math.floor(i / CM_COLS)) * 0.15);
          const toY = t.y;
          if (fromY === toY && i !== end) return;
          t.y = fromY;
          if (i === end) t.setScale(1.3);
          this.moving++;
          this.tweens.add({ targets: t, y: toY, scale: 1, duration: 260, ease: 'Bounce.easeOut', onComplete: () => this.moving-- });
        });
        this.moving--;
      },
    });
  }

  private drawChain(): void {
    const g = this.line.clear();
    const chain = this.chain;
    if (chain.length === 0) {
      this.bubble.setVisible(false);
      return;
    }
    g.lineStyle(16, toHex(COLORS.ink), 0.85);
    for (let k = 1; k < chain.length; k++) {
      const a = this.cellXY(chain[k - 1]!);
      const b = this.cellXY(chain[k]!);
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
    for (const c of chain) {
      const p = this.cellXY(c);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(p.x, p.y, 12);
      g.lineStyle(5, toHex(COLORS.ink), 1);
      g.strokeCircle(p.x, p.y, 12);
    }
    // What letting go now would make.
    const fits = chain.length >= 2 && chainFits(chain.map((c) => this.state.grid[c]!));
    const end = this.cellXY(chain[chain.length - 1]!);
    this.bubble.setVisible(fits).setPosition(end.x, end.y - CELL * 0.72);
    if (fits) this.bubbleText.setText(chainLabel(chainResult(chain.map((c) => this.state.grid[c]!))));
  }

  /** The bands the page keeps to, for the layout check. */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    return [{ name: 'grid', top: GRID.y, bottom: GRID.y + CM_ROWS * CELL }];
  }
}

export function chainStatus(state: ChainState): string | undefined {
  if (state.result) return undefined;
  return `${state.left} ${state.left === 1 ? 'chain' : 'chains'} left · make ${chainLabel(CM_GOAL)}`;
}

export function chainResultText(state: ChainState): string | undefined {
  if (!state.result) return undefined;
  const best = chainLabel(state.best);
  if (state.result.winners.length) return `${chainLabel(CM_GOAL)} in ${state.used} chains! 🎉`;
  return state.used >= CM_CHAINS ? `Out of chains. Best tile ${best}.` : `No chains left. Best tile ${best}.`;
}
