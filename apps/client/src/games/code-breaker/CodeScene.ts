import { type CodeMove, type CodeState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { onKeys } from '../keys';
import { PARTY_COLORS, PARTY_DARK } from '../party';

const W = 600;
const H = 920;
export const CODE_SIZE = { width: W, height: H };
export const CODE_COLORS = [COLORS.grape];

const SECRET_Y = 50;
const ROWS_TOP = 110;
const ROWS_BOTTOM = 730;
const PALETTE_Y = 790;
const BUTTONS_Y = 870;
/** Pegs in the palette's order: the eight party colors. */
const PEG = PARTY_COLORS;
const PEG_DARK = PARTY_DARK;

/**
 * Code Breaker. The rules hold the code and mark each guess; the scene is the board: rows of holes,
 * the palette to fill them from, full and open dots for the marks, and the hidden code revealed at
 * the end with a pop. Every peg carries its number, so colors never have to be told apart by hue.
 */
export class CodeScene extends Scene {
  private view!: GameObjects.Container;
  private draft: number[] = [];
  private hits: { x: number; y: number; r: number; act: () => void }[] = [];
  private shownRows = 0;

  constructor(private readonly session: Session<CodeMove>) {
    super('code-breaker');
  }

  private get state(): CodeState {
    return this.session.state as CodeState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.view = this.add.container(0, 0);
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      const hit = this.hits.find((h) => Math.hypot(p.worldX - h.x, p.worldY - h.y) <= h.r);
      hit?.act();
    });
    onKeys(this, (key) => this.key(key));
    const off = this.session.subscribe(() => {
      this.draft = [];
      this.draw();
    });
    this.events.once('shutdown', off);
    this.draw();
  }

  private get rowH(): number {
    return (ROWS_BOTTOM - ROWS_TOP) / this.state.level.rows;
  }

  private pegX(i: number): number {
    const pegs = this.state.level.pegs;
    const gap = pegs === 5 ? 70 : 80;
    return 60 + i * gap;
  }

  private key(key: string): boolean {
    if (this.state.result || !this.session.isHumanTurn()) return false;
    const n = Number(key);
    if (Number.isInteger(n) && n >= 1 && n <= this.state.level.colors) {
      this.add1(n - 1);
      return true;
    }
    if (key === 'Backspace') {
      this.draft.pop();
      this.draw();
      return true;
    }
    if (key === 'Enter') {
      this.check();
      return true;
    }
    return false;
  }

  private add1(color: number): void {
    if (this.draft.length >= this.state.level.pegs) return;
    // Easy has no repeats in the code, so a repeat in a guess only wastes a row: say so gently.
    if (!this.state.level.repeats && this.draft.includes(color)) {
      cue('buzz');
      return;
    }
    this.draft.push(color);
    cue('tap');
    this.draw();
  }

  private check(): void {
    if (this.draft.length !== this.state.level.pegs) {
      cue('buzz');
      return;
    }
    cue('place');
    this.session.play(`g${this.draft.join('')}`);
  }

  private peg(g: GameObjects.Graphics, x: number, y: number, r: number, color: number, pop: boolean): void {
    g.fillStyle(toHex(PEG_DARK[color]!), 1);
    g.fillCircle(x, y + 3, r);
    g.fillStyle(toHex(PEG[color]!), 1);
    g.fillCircle(x, y, r);
    const t = sharpText(this, x, y, String(color + 1), Math.round(r * 0.95), color === 3 ? COLORS.ink : '#FFFFFF').setFontStyle('bold');
    this.view.add(t);
    if (pop) {
      t.setScale(0.5);
      this.tweens.add({ targets: t, scale: 1, duration: 200, ease: 'Back.easeOut' });
    }
  }

  private draw(): void {
    const state = this.state;
    const level = state.level;
    this.view.removeAll(true);
    this.hits = [];
    const g = this.add.graphics();
    this.view.add(g);
    const fresh = state.rows.length !== this.shownRows;
    this.shownRows = state.rows.length;

    // The hidden code: covered until the end, then shown.
    g.fillStyle(toHex(DARK.grape), 1);
    g.fillRoundedRect(30, SECRET_Y - 32 + 6, W - 60, 64, 26);
    g.fillStyle(toHex(COLORS.grape), 1);
    g.fillRoundedRect(30, SECRET_Y - 32, W - 60, 64, 26);
    for (let i = 0; i < level.pegs; i++) {
      if (state.result) this.peg(g, this.pegX(i), SECRET_Y, 22, state.code[i]!, fresh);
      else {
        g.fillStyle(0xffffff, 0.3);
        g.fillCircle(this.pegX(i), SECRET_Y, 22);
        this.view.add(sharpText(this, this.pegX(i), SECRET_Y, '?', 24, '#FFFFFF').setFontStyle('bold'));
      }
    }

    const rowH = this.rowH;
    const r = Math.min(22, rowH * 0.38);
    for (let row = 0; row < level.rows; row++) {
      const y = ROWS_TOP + row * rowH + rowH / 2;
      const done = state.rows[row];
      const current = !state.result && row === state.rows.length;
      g.fillStyle(current ? 0xefe9ff : row % 2 ? 0xfaf8ff : 0xffffff, 1);
      g.fillRoundedRect(30, y - rowH / 2 + 2, W - 60, rowH - 4, 14);
      for (let i = 0; i < level.pegs; i++) {
        const x = this.pegX(i);
        const color = done ? done.guess[i] : current ? this.draft[i] : undefined;
        if (color !== undefined) {
          this.peg(g, x, y, r, color, (current && i === this.draft.length - 1) || (fresh && row === state.rows.length - 1));
          if (current) this.hits.push({ x, y, r: r + 6, act: () => this.clear(i) });
        } else {
          g.fillStyle(0xe6e0f4, 1);
          g.fillCircle(x, y, r * 0.55);
        }
      }
      // The marks: full dots for right place, open dots for right color only.
      if (done) {
        const marks = [...Array(done.exact).fill('exact'), ...Array(done.near).fill('near')];
        for (let k = 0; k < level.pegs; k++) {
          const mx = W - 130 + (k % 3) * 26;
          const my = y + (k < 3 ? -9 : 9);
          const kind = marks[k];
          if (kind === 'exact') {
            g.fillStyle(toHex(COLORS.ink), 1);
            g.fillCircle(mx, my, 8);
          } else if (kind === 'near') {
            g.lineStyle(3, toHex(COLORS.ink), 1);
            g.strokeCircle(mx, my, 7);
          } else {
            g.fillStyle(0xe6e0f4, 1);
            g.fillCircle(mx, my, 4);
          }
        }
      }
    }

    if (state.result) return;
    // The palette, and Undo and Check under it.
    const gap = (W - 60) / level.colors;
    for (let c = 0; c < level.colors; c++) {
      const x = 30 + gap * c + gap / 2;
      this.peg(g, x, PALETTE_Y, 26, c, false);
      this.hits.push({ x, y: PALETTE_Y, r: 32, act: () => this.add1(c) });
    }
    const full = this.draft.length === level.pegs;
    this.button(g, W / 2 - 140, 'Undo', this.draft.length > 0, () => {
      this.draft.pop();
      this.draw();
    });
    this.button(g, W / 2 + 140, 'Check', full, () => this.check());
  }

  private clear(i: number): void {
    this.draft.splice(i, 1);
    cue('tap');
    this.draw();
  }

  private button(g: GameObjects.Graphics, x: number, label: string, live: boolean, act: () => void): void {
    g.fillStyle(toHex(live ? DARK.grape : COLORS.line), 1);
    g.fillRoundedRect(x - 110, BUTTONS_Y - 28 + 6, 220, 56, 28);
    g.fillStyle(toHex(live ? COLORS.grape : COLORS.line), 1);
    g.fillRoundedRect(x - 110, BUTTONS_Y - 28, 220, 56, 28);
    this.view.add(sharpText(this, x, BUTTONS_Y, label, 26, live ? '#FFFFFF' : COLORS.soft).setFontStyle('bold'));
    this.hits.push({ x, y: BUTTONS_Y, r: 40, act });
  }

  /** The bands the board keeps to, for the layout check. */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    return [
      { name: 'code', top: SECRET_Y - 32, bottom: SECRET_Y + 38 },
      { name: 'rows', top: ROWS_TOP, bottom: ROWS_BOTTOM },
      { name: 'palette', top: PALETTE_Y - 30, bottom: PALETTE_Y + 30 },
      { name: 'buttons', top: BUTTONS_Y - 28, bottom: BUTTONS_Y + 34 },
    ];
  }
}

export function codeStatus(state: CodeState): string | undefined {
  if (state.result) return undefined;
  return `Guess ${state.rows.length + 1} of ${state.level.rows}`;
}

export function codeResult(state: CodeState): string | undefined {
  if (!state.result) return undefined;
  return state.result.winners.length ? `Cracked in ${state.rows.length} ${state.rows.length === 1 ? 'guess' : 'guesses'}! 🎉` : 'Out of rows. The code is on top.';
}
