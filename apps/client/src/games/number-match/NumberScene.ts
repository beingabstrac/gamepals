import { NM_WIDTH, type NumberMove, type NumberState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { focusRing, moveRing, onKeys } from '../keys';

const W = 600;
const H = 900;
export const NUMBER_CANVAS = { width: W, height: H };
export const NUMBER_COLORS = [COLORS.sky];

const TOP = 70;
const BOTTOM = 790;
const BUTTONS_Y = 845;
const DIGIT_COLORS = [COLORS.sky, COLORS.tomato, COLORS.mint, COLORS.grape, COLORS.peach, COLORS.bubblegum, COLORS.sky, COLORS.mint, COLORS.tomato];

/**
 * Number Match. The rules say which two can go; the scene is the page of digits: tap one, tap its
 * partner, and a line strikes through both. Rows that empty close up. Hint shows a pair, Add copies
 * what is left onto the end. The grid shrinks to fit as it grows.
 */
export class NumberScene extends Scene {
  private g!: GameObjects.Graphics;
  private digits: GameObjects.Text[] = [];
  private buttonTexts: GameObjects.Text[] = [];
  private scoreText!: GameObjects.Text;
  private ring!: GameObjects.Graphics;
  private picked: number | null = null;
  private hint: [number, number] | null = null;
  private strike: { a: number; b: number; t: number } | null = null;
  private focus = 0;

  constructor(private readonly session: Session<NumberMove>) {
    super('number-match');
  }

  private get state(): NumberState {
    return this.session.state as NumberState;
  }

  private get cell(): number {
    const rows = Math.ceil(this.state.values.length / NM_WIDTH);
    return Math.min(62, (W - 40) / NM_WIDTH, (BOTTOM - TOP) / rows);
  }

  private cellXY(i: number): { x: number; y: number } {
    const c = this.cell;
    const x0 = (W - NM_WIDTH * c) / 2;
    return { x: x0 + (i % NM_WIDTH) * c + c / 2, y: TOP + Math.floor(i / NM_WIDTH) * c + c / 2 };
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.g = this.add.graphics();
    this.scoreText = sharpText(this, W / 2, 34, '', 24, COLORS.ink).setFontStyle('bold');
    this.buttonTexts = [
      sharpText(this, W / 2 - 130, BUTTONS_Y, 'Hint', 24, '#FFFFFF').setFontStyle('bold').setDepth(3),
      sharpText(this, W / 2 + 130, BUTTONS_Y, '', 24, '#FFFFFF').setFontStyle('bold').setDepth(3),
    ];
    this.ring = focusRing(this, 60, 60, 14);
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      this.ring.setVisible(false);
      if (Math.abs(p.worldY - BUTTONS_Y) < 30) {
        if (Math.abs(p.worldX - (W / 2 - 130)) < 110) return this.showHint();
        if (Math.abs(p.worldX - (W / 2 + 130)) < 110) return this.play('add');
      }
      const c = this.cell;
      const x0 = (W - NM_WIDTH * c) / 2;
      const col = Math.floor((p.worldX - x0) / c);
      const row = Math.floor((p.worldY - TOP) / c);
      const i = row * NM_WIDTH + col;
      if (col >= 0 && col < NM_WIDTH && row >= 0 && i < this.state.values.length) this.tap(i);
    });
    onKeys(this, (key) => this.key(key));
    const off = this.session.subscribe(() => this.changed());
    this.session.holdBots = () => this.busy();
    this.events.once('shutdown', () => {
      off();
      this.session.holdBots = null;
    });
    this.draw();
  }

  busy(): boolean {
    return this.strike !== null;
  }

  update(time: number): void {
    if (this.strike && time - this.strike.t > 260) {
      this.strike = null;
      this.draw();
    } else if (this.strike) this.draw();
  }

  private play(move: NumberMove): void {
    if (!this.session.isHumanTurn() || this.busy()) return;
    if (!this.state.legalMoves(0).includes(move)) return cue('buzz');
    this.session.play(move);
  }

  private tap(i: number): void {
    const state = this.state;
    if (!this.session.isHumanTurn() || this.busy() || state.gone[i]) return;
    if (this.picked === null || this.picked === i) {
      this.picked = this.picked === i ? null : i;
      cue('tap');
      return this.draw();
    }
    const [a, b] = this.picked < i ? [this.picked, i] : [i, this.picked];
    if (state.canPair(a, b)) {
      this.picked = null;
      this.play(`p${a}-${b}`);
    } else {
      cue('buzz');
      this.picked = i;
      this.draw();
    }
  }

  private showHint(): void {
    const pair = this.state.pairs()[0];
    if (!pair) return cue(this.state.adds ? 'tap' : 'buzz');
    this.hint = pair;
    cue('tap');
    this.draw();
    this.time.delayedCall(1300, () => {
      this.hint = null;
      this.draw();
    });
  }

  private changed(): void {
    const state = this.state;
    this.picked = null;
    this.hint = null;
    const last = state.last;
    if (last?.pair) {
      cue('place');
      this.strike = { a: last.pair[0], b: last.pair[1], t: this.time.now };
    } else if (last?.rows) {
      cue('capture');
      this.cameras.main.shake(100, 0.003);
    } else if (last) cue('roll');
    if (state.result) cue(state.result.winners.length ? 'win' : 'lose');
    this.draw();
  }

  private key(key: string): boolean {
    const n = this.state.values.length;
    const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -NM_WIDTH, ArrowDown: NM_WIDTH } as Record<string, number>)[key];
    if (step !== undefined) {
      const next = this.focus + step;
      if (next >= 0 && next < n) this.focus = next;
      const { x, y } = this.cellXY(this.focus);
      moveRing(this, this.ring, x, y);
      return true;
    }
    if (key === 'Enter' || key === ' ') {
      this.tap(this.focus);
      return true;
    }
    if (key === 'h' || key === 'H') {
      this.showHint();
      return true;
    }
    if (key === 'a' || key === 'A') {
      this.play('add');
      return true;
    }
    return false;
  }

  private draw(): void {
    const state = this.state;
    const g = this.g.clear();
    const c = this.cell;
    const size = Math.round(c * 0.55);
    this.scoreText.setText(`${state.score} points · ${state.gone.filter((x) => !x).length} numbers left`);
    state.values.forEach((v, i) => {
      const { x, y } = this.cellXY(i);
      const gone = state.gone[i];
      const lit = i === this.picked || (this.hint?.includes(i) ?? false);
      g.fillStyle(lit ? toHex(i === this.picked ? COLORS.grape : COLORS.bubblegum) : gone ? 0xf7f5fc : 0xffffff, 1);
      g.fillRoundedRect(x - c / 2 + 2, y - c / 2 + 2, c - 4, c - 4, c * 0.22);
      const t = (this.digits[i] ??= sharpText(this, 0, 0, '', size, COLORS.ink).setFontStyle('bold').setDepth(2));
      t.setPosition(x, y).setText(String(v)).setFontSize(size).setVisible(true);
      t.setColor(lit ? '#FFFFFF' : gone ? '#D8D3E6' : DIGIT_COLORS[v - 1]!);
    });
    for (let i = state.values.length; i < this.digits.length; i++) this.digits[i]!.setVisible(false);
    // The strike through the pair just taken, drawn across as it goes.
    if (this.strike) {
      const t = Math.min(1, (this.time.now - this.strike.t) / 260);
      const a = this.cellXY(this.strike.a);
      const b = this.cellXY(this.strike.b);
      g.lineStyle(6, toHex(COLORS.tomato), 1 - t * 0.4);
      g.lineBetween(a.x, a.y, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
    }
    const live = !state.result && this.session.isHumanTurn();
    const buttons: [number, string, boolean][] = [
      [W / 2 - 130, 'Hint', live],
      [W / 2 + 130, `Add (${state.adds})`, live && state.adds > 0],
    ];
    buttons.forEach(([x, label, on], k) => {
      g.fillStyle(toHex(on ? DARK.sky : '#D8D3E6'), 1);
      g.fillRoundedRect(x - 110, BUTTONS_Y - 27 + 5, 220, 54, 27);
      g.fillStyle(toHex(on ? COLORS.sky : COLORS.line), 1);
      g.fillRoundedRect(x - 110, BUTTONS_Y - 27, 220, 54, 27);
      this.buttonTexts[k]!.setText(label).setColor(on ? '#FFFFFF' : COLORS.soft).setVisible(!state.result);
    });
  }

  /** The bands the page keeps to, for the layout check. */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    const rows = Math.ceil(this.state.values.length / NM_WIDTH);
    return [
      { name: 'score', top: 20, bottom: 48 },
      { name: 'grid', top: TOP, bottom: TOP + rows * this.cell },
      { name: 'buttons', top: BUTTONS_Y - 27, bottom: BUTTONS_Y + 32 },
    ];
  }
}

export function numberStatus(state: NumberState): string | undefined {
  if (state.result) return undefined;
  const pairs = state.pairs().length;
  return pairs ? `${pairs} ${pairs === 1 ? 'pair' : 'pairs'} to find` : state.adds ? 'No pairs: tap Add' : undefined;
}

export function numberResult(state: NumberState): string | undefined {
  if (!state.result) return undefined;
  return state.result.winners.length ? `Cleared! ${state.score} points 🎉` : `No pairs and no adds left. ${state.score} points.`;
}
