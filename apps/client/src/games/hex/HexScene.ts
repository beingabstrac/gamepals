import { HEX_CELLS, HEX_SIZE, type HexMove, type HexState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { focusRing, moveRing, onKeys } from '../keys';

const W = 700;
const H = 600;
export const HEX_CANVAS = { width: W, height: H };
export const HEX_COLORS = [COLORS.tomato, COLORS.sky];
export const HEX_NAMES = ['Red', 'Blue'];

const CW = 38;
const R = CW / Math.sqrt(3);
const X0 = (W - 15 * CW) / 2;
const Y0 = 110;
const TOP_Y = 40;
const SWAP_Y = 545;

const cellXY = (p: number) => {
  const x = p % HEX_SIZE;
  const y = Math.floor(p / HEX_SIZE);
  return { x: X0 + (x + y * 0.5) * CW, y: Y0 + y * 1.5 * R };
};

/** A pointy-topped hexagon, filled. A path rather than fillPoints, whose types have tripped CI before. */
function fillHex(g: GameObjects.Graphics, cx: number, cy: number, r: number): void {
  g.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 180) * (60 * k - 90);
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (k === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.fillPath();
}

/**
 * Hex. The rules keep the board and find the winning chain; the scene draws the rhombus with Red's
 * edges along the top and bottom and Blue's down the sides, drops each stone with a squash, offers
 * the swap when it can be taken, and lights the chain that won.
 */
export class HexScene extends Scene {
  private stones!: GameObjects.Graphics;
  private marks!: GameObjects.Graphics;
  private ring!: GameObjects.Graphics;
  private topText!: GameObjects.Text;
  private swapButton!: GameObjects.Graphics;
  private swapText!: GameObjects.Text;
  private focus = 60;
  private dropping: { p: number; t: number } | null = null;

  constructor(private readonly session: Session<HexMove>) {
    super('hex');
  }

  private get state(): HexState {
    return this.session.state as HexState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.drawBoard();
    this.stones = this.add.graphics().setDepth(3);
    this.marks = this.add.graphics().setDepth(4);
    this.ring = focusRing(this, CW + 6, CW + 6, CW / 2 + 3);
    this.topText = sharpText(this, W / 2, TOP_Y, '', 22, COLORS.ink).setFontStyle('bold');
    this.swapButton = this.add.graphics().setDepth(5);
    this.swapText = sharpText(this, W / 2, SWAP_Y, 'Swap: take that stone', 22, '#FFFFFF').setFontStyle('bold').setDepth(6);
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      this.ring.setVisible(false);
      if (this.swapText.visible && Math.abs(p.worldY - SWAP_Y) < 26 && Math.abs(p.worldX - W / 2) < 150) return this.play('swap');
      let best = -1;
      let near = CW * 0.55;
      for (let c = 0; c < HEX_CELLS; c++) {
        const q = cellXY(c);
        const d = Math.hypot(p.worldX - q.x, p.worldY - q.y);
        if (d < near) {
          near = d;
          best = c;
        }
      }
      if (best >= 0) this.play(`p${best}`);
    });
    onKeys(this, (key) => this.key(key));
    const off = this.session.subscribe(() => {
      const last = this.state.last;
      if (last !== null) {
        this.dropping = { p: last, t: this.time.now };
        cue(this.state.result ? 'win' : 'place');
      }
      this.draw();
    });
    this.events.once('shutdown', off);
    this.draw();
  }

  /** A stone still dropping. See `apps/client/src/games/busy.ts`. */
  busy(): boolean {
    return this.dropping !== null;
  }

  update(time: number): void {
    if (this.dropping && time - this.dropping.t > 220) this.dropping = null;
    if (this.dropping) this.draw();
  }

  private drawBoard(): void {
    const g = this.add.graphics().setDepth(0);
    // The edges each player joins, as thick bands: Red along the top and bottom, Blue down the sides.
    const edge = (cells: number[], color: number, dx: number, dy: number) => {
      g.lineStyle(10, color, 1);
      g.beginPath();
      cells.forEach((c, i) => {
        const p = cellXY(c);
        if (i === 0) g.moveTo(p.x + dx, p.y + dy);
        else g.lineTo(p.x + dx, p.y + dy);
      });
      g.strokePath();
    };
    const row = (y: number) => Array.from({ length: HEX_SIZE }, (_, x) => y * HEX_SIZE + x);
    const col = (x: number) => Array.from({ length: HEX_SIZE }, (_, y) => y * HEX_SIZE + x);
    edge(row(0), toHex(COLORS.tomato), 0, -R - 6);
    edge(row(HEX_SIZE - 1), toHex(COLORS.tomato), 0, R + 6);
    edge(col(0), toHex(COLORS.sky), -CW / 2 - 6, 0);
    edge(col(HEX_SIZE - 1), toHex(COLORS.sky), CW / 2 + 6, 0);
    for (let c = 0; c < HEX_CELLS; c++) {
      const { x, y } = cellXY(c);
      g.fillStyle(0xd8d0ee, 1);
      fillHex(g, x, y + 2, R - 1);
      g.fillStyle(0xffffff, 1);
      fillHex(g, x, y, R - 1.5);
    }
  }

  private draw(): void {
    const state = this.state;
    const g = this.stones.clear();
    for (let c = 0; c < HEX_CELLS; c++) {
      const color = state.board[c];
      if (!color) continue;
      const { x, y } = cellXY(c);
      let s = 1;
      if (this.dropping?.p === c) {
        const t = Math.min(1, (this.time.now - this.dropping.t) / 220);
        s = 1.35 - 0.35 * t;
      }
      g.fillStyle(toHex(color === 1 ? DARK.tomato : DARK.sky), 1);
      g.fillCircle(x, y + 2.5, (R - 5) * s);
      g.fillStyle(toHex(color === 1 ? COLORS.tomato : COLORS.sky), 1);
      g.fillCircle(x, y, (R - 5) * s);
    }
    const m = this.marks.clear();
    if (state.path) {
      for (const c of state.path) {
        const { x, y } = cellXY(c);
        m.fillStyle(0xffffff, 0.9);
        m.fillCircle(x, y, 5);
      }
    } else if (state.last !== null) {
      const { x, y } = cellXY(state.last);
      m.fillStyle(0xffffff, 0.9);
      m.fillCircle(x, y, 4);
    }
    this.topText.setText(state.result ? `${HEX_NAMES[state.result.winners[0]!]} got through!` : 'Red joins top and bottom · Blue joins left and right');
    const canSwap = !state.result && this.session.isHumanTurn() && state.legalMoves(state.currentSeat).includes('swap');
    this.swapButton.clear();
    this.swapText.setVisible(canSwap);
    if (canSwap) {
      this.swapButton.fillStyle(toHex(DARK.sky), 1);
      this.swapButton.fillRoundedRect(W / 2 - 150, SWAP_Y - 24 + 5, 300, 48, 24);
      this.swapButton.fillStyle(toHex(COLORS.sky), 1);
      this.swapButton.fillRoundedRect(W / 2 - 150, SWAP_Y - 24, 300, 48, 24);
    }
  }

  private play(move: HexMove): void {
    if (!this.session.isHumanTurn() || this.busy()) return;
    if (!this.state.legalMoves(this.state.currentSeat).includes(move)) {
      cue('buzz');
      return;
    }
    this.session.play(move);
  }

  private key(key: string): boolean {
    const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -HEX_SIZE, ArrowDown: HEX_SIZE } as Record<string, number>)[key];
    if (step !== undefined) {
      const x = this.focus % HEX_SIZE;
      if ((step === -1 && x === 0) || (step === 1 && x === HEX_SIZE - 1)) return true;
      const next = this.focus + step;
      if (next >= 0 && next < HEX_CELLS) this.focus = next;
      const { x: px, y: py } = cellXY(this.focus);
      moveRing(this, this.ring, px, py);
      return true;
    }
    if (key === 'Enter' || key === ' ') {
      this.play(`p${this.focus}`);
      return true;
    }
    if (key === 's' || key === 'S') {
      this.play('swap');
      return true;
    }
    return false;
  }

  /** The bands the board keeps to, for the layout check. */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    return [
      { name: 'line', top: TOP_Y - 14, bottom: TOP_Y + 14 },
      { name: 'board', top: Y0 - R - 12, bottom: Y0 + 10 * 1.5 * R + R + 12 },
      { name: 'swap', top: SWAP_Y - 24, bottom: SWAP_Y + 29 },
    ];
  }
}

export function hexStatus(state: HexState, names: readonly string[]): string | undefined {
  if (state.result) return undefined;
  const name = names[state.currentSeat] ?? HEX_NAMES[state.currentSeat];
  if (state.moves === 1 && state.currentSeat === 1) return `${name} to play, or swap and take Red's stone`;
  return `${name} to play`;
}
