import { areaOwners, GO_KOMI, GO_POINTS, GO_SIZE, type GoMove, type GoState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { focusRing, moveRing, onKeys } from '../keys';

const W = 600;
const H = 780;
export const GO_CANVAS = { width: W, height: H };
/** White's dot has to show on a white status pill, so it is a pale grey. */
export const GO_COLORS = [COLORS.ink, '#C9C2E0'];
export const GO_NAMES = ['Black', 'White'];

const STEP = 60;
const BX = (W - (GO_SIZE - 1) * STEP) / 2;
const BY = 110;
const STONE_R = 27;
const TOP_Y = 40;
const PASS_Y = 700;
const STARS = [20, 24, 40, 56, 60];

const pointXY = (p: number) => ({ x: BX + (p % GO_SIZE) * STEP, y: BY + Math.floor(p / GO_SIZE) * STEP });

/**
 * Go on 9 by 9. The rules keep the board and the score; the scene drops each stone with a squash,
 * pops the stones it takes, marks the last move, and at the end shades each empty point by who owns
 * it, so the count is something you can see.
 */
export class GoScene extends Scene {
  private stones = new Map<number, GameObjects.Container>();
  private marks!: GameObjects.Graphics;
  private ring!: GameObjects.Graphics;
  private topText!: GameObjects.Text;
  private passText!: GameObjects.Text;
  private passButton!: GameObjects.Graphics;
  private focus = 40;
  private popping = 0;

  constructor(private readonly session: Session<GoMove>) {
    super('go');
  }

  private get state(): GoState {
    return this.session.state as GoState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.drawBoard();
    this.marks = this.add.graphics().setDepth(6);
    this.ring = focusRing(this, STONE_R * 2 + 10, STONE_R * 2 + 10, STONE_R + 5);
    this.topText = sharpText(this, W / 2, TOP_Y, '', 24, COLORS.ink).setFontStyle('bold');
    this.passButton = this.add.graphics();
    this.passText = sharpText(this, W / 2, PASS_Y, 'Pass', 28, '#FFFFFF').setFontStyle('bold').setDepth(2);
    this.sync(false);
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      this.ring.setVisible(false);
      if (Math.abs(p.worldY - PASS_Y) < 34 && Math.abs(p.worldX - W / 2) < 110) return this.play('pass');
      const col = Math.round((p.worldX - BX) / STEP);
      const row = Math.round((p.worldY - BY) / STEP);
      if (col < 0 || col >= GO_SIZE || row < 0 || row >= GO_SIZE) return;
      const at = pointXY(row * GO_SIZE + col);
      if (Math.hypot(p.worldX - at.x, p.worldY - at.y) < STEP * 0.5) this.play(`p${row * GO_SIZE + col}`);
    });
    onKeys(this, (key) => this.key(key));
    const off = this.session.subscribe(() => this.sync(true));
    this.session.holdBots = () => this.busy();
    this.events.once('shutdown', () => {
      off();
      this.session.holdBots = null;
    });
  }

  /** Stones still dropping or popping. See `apps/client/src/games/busy.ts`. */
  busy(): boolean {
    return this.popping > 0;
  }

  private drawBoard(): void {
    const g = this.add.graphics().setDepth(0);
    const pad = 36;
    const size = (GO_SIZE - 1) * STEP;
    g.fillStyle(toHex(DARK.sunny), 1);
    g.fillRoundedRect(BX - pad, BY - pad + 8, size + pad * 2, size + pad * 2, 26);
    g.fillStyle(toHex(COLORS.sunny), 1);
    g.fillRoundedRect(BX - pad, BY - pad, size + pad * 2, size + pad * 2, 26);
    g.lineStyle(3, toHex(DARK.sunny), 1);
    for (let i = 0; i < GO_SIZE; i++) {
      g.lineBetween(BX, BY + i * STEP, BX + size, BY + i * STEP);
      g.lineBetween(BX + i * STEP, BY, BX + i * STEP, BY + size);
    }
    g.fillStyle(toHex(DARK.sunny), 1);
    for (const p of STARS) {
      const { x, y } = pointXY(p);
      g.fillCircle(x, y, 6);
    }
  }

  private makeStone(color: number): GameObjects.Container {
    const g = this.add.graphics();
    const black = color === 1;
    g.fillStyle(black ? 0x151422 : 0xd8d3e6, 1);
    g.fillCircle(0, 4, STONE_R);
    g.fillStyle(black ? toHex(COLORS.ink) : 0xffffff, 1);
    g.fillCircle(0, 0, STONE_R);
    g.fillStyle(0xffffff, black ? 0.22 : 0.9);
    g.fillCircle(-9, -9, 7);
    return this.add.container(0, 0, [g]).setDepth(3);
  }

  /** Brings the stones on screen into line with the board: new ones drop in, taken ones pop. */
  private sync(animate: boolean): void {
    const state = this.state;
    for (let p = 0; p < GO_POINTS; p++) {
      const color = state.board[p]!;
      const shown = this.stones.get(p);
      if (color && !shown) {
        const stone = this.makeStone(color);
        const { x, y } = pointXY(p);
        stone.setPosition(x, y);
        this.stones.set(p, stone);
        if (animate) {
          stone.setScale(1.35).setAlpha(0.7);
          this.tweens.add({ targets: stone, scaleX: { from: 1.35, to: 1 }, scaleY: { from: 1.35, to: 1 }, alpha: 1, duration: 200, ease: 'Back.easeOut' });
        }
      } else if (!color && shown) {
        this.stones.delete(p);
        this.popping++;
        this.tweens.add({ targets: shown, scale: 1.4, alpha: 0, duration: 260, ease: 'Cubic.easeOut', onComplete: () => (shown.destroy(), this.popping--) });
      }
    }
    if (animate) {
      const last = state.last;
      if (last?.captured.length) {
        cue('capture');
        this.cameras.main.shake(90, 0.003);
      } else if (last?.point !== null && last) cue('place');
      else if (last) cue('tap');
      if (last && last.point === null) this.shoutPass(last.seat);
    }
    this.drawMarks();
  }

  private shoutPass(seat: number): void {
    const t = sharpText(this, W / 2, BY + 4 * STEP, `${GO_NAMES[seat]} passes`, 34, COLORS.ink).setFontStyle('bold').setStroke('#FFFFFF', 8).setDepth(20).setScale(0.6);
    this.tweens.add({ targets: t, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: 900, duration: 350, onComplete: () => t.destroy() });
  }

  /** The last move's ring, the pass button, the line along the top, and at the end who owns what. */
  private drawMarks(): void {
    const state = this.state;
    const g = this.marks.clear();
    const last = state.last;
    if (last?.point !== null && last && !state.result) {
      const { x, y } = pointXY(last.point);
      g.lineStyle(4, toHex(COLORS.tomato), 1);
      g.strokeCircle(x, y, 10);
    }
    const [b, w] = state.score;
    this.topText.setText(state.result ? `Black ${b}, White ${w} with ${GO_KOMI} for going second` : `Stones taken: Black ${state.captures[0]}, White ${state.captures[1]}`);
    if (state.result) this.drawOwners(g);
    const live = !state.result && this.session.isHumanTurn();
    this.passButton.clear();
    if (!state.result) {
      this.passButton.fillStyle(toHex(live ? DARK.grape : COLORS.line), 1);
      this.passButton.fillRoundedRect(W / 2 - 110, PASS_Y - 30 + 6, 220, 60, 30);
      this.passButton.fillStyle(toHex(live ? COLORS.grape : COLORS.line), 1);
      this.passButton.fillRoundedRect(W / 2 - 110, PASS_Y - 30, 220, 60, 30);
    }
    this.passText.setVisible(!state.result).setColor(live ? '#FFFFFF' : COLORS.soft);
  }

  /** Every empty point that only one color reaches, marked in that color. */
  private drawOwners(g: GameObjects.Graphics): void {
    const board = this.state.board;
    areaOwners(board).forEach((who, p) => {
      if (board[p] || !who) return;
      const { x, y } = pointXY(p);
      g.fillStyle(who === 1 ? toHex(COLORS.ink) : 0xffffff, 0.9);
      g.fillRoundedRect(x - 8, y - 8, 16, 16, 4);
    });
  }

  private play(move: GoMove): void {
    if (!this.session.isHumanTurn() || this.busy()) return;
    if (!this.state.legalMoves(this.state.currentSeat).includes(move)) {
      cue('buzz');
      return;
    }
    this.session.play(move);
  }

  private key(key: string): boolean {
    const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -GO_SIZE, ArrowDown: GO_SIZE } as Record<string, number>)[key];
    if (step !== undefined) {
      const col = this.focus % GO_SIZE;
      if ((step === -1 && col === 0) || (step === 1 && col === GO_SIZE - 1)) return true;
      const next = this.focus + step;
      if (next >= 0 && next < GO_POINTS) this.focus = next;
      const { x, y } = pointXY(this.focus);
      moveRing(this, this.ring, x, y);
      return true;
    }
    if (key === 'Enter' || key === ' ') {
      this.play(`p${this.focus}`);
      return true;
    }
    if (key === 'p' || key === 'P') {
      this.play('pass');
      return true;
    }
    return false;
  }

  /** The bands the board keeps to, for the layout check. */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    const size = (GO_SIZE - 1) * STEP;
    return [
      { name: 'score', top: TOP_Y - 16, bottom: TOP_Y + 16 },
      { name: 'board', top: BY - 36, bottom: BY + size + 36 + 8 },
      { name: 'pass', top: PASS_Y - 30, bottom: PASS_Y + 36 },
    ];
  }
}

export function goStatus(state: GoState, names: readonly string[]): string | undefined {
  if (state.result) return undefined;
  const name = names[state.currentSeat] ?? GO_NAMES[state.currentSeat];
  // No running count: until the end, area says nothing useful (one stone "owns" an empty board).
  return state.passes ? `${name} to play. The last move was a pass` : `${name} to play`;
}
