import { HANG_LETTERS, type HangMove, type HangState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { onKeys } from '../keys';

const W = 600;
const H = 880;
export const HANG_CANVAS = { width: W, height: H };
export const HANG_COLORS = [COLORS.sky];

const BASKET = { x: W / 2, y: 300 };
const CLUE_Y = 360;
const WORD_Y = 440;
const KEYS_TOP = 540;
const KEY_ROWS = ['abcdefghi', 'jklmnopqr', 'stuvwxyz'];
const BALLOON_COLORS = [COLORS.tomato, COLORS.sunny, COLORS.mint, COLORS.sky, COLORS.grape, COLORS.bubblegum, COLORS.peach, COLORS.tomato];

/**
 * Hangman, drawn kindly. The rules hold the word; the scene is a little basket held up by
 * balloons, one popping for each wrong letter, the word's slots under it, and an alphabet to tap.
 * Right letters drop into every slot they fill. The last balloon gone, the basket settles on the
 * ground and the word is shown.
 */
export class HangScene extends Scene {
  private g!: GameObjects.Graphics;
  private slots: GameObjects.Text[] = [];
  private keys: GameObjects.Text[] = [];
  private clue!: GameObjects.Text;
  private popped = 0;

  constructor(private readonly session: Session<HangMove>) {
    super('hangman');
  }

  private get state(): HangState {
    return this.session.state as HangState;
  }

  private slotX(i: number): number {
    const n = this.state.word.length;
    const gap = Math.min(60, (W - 60) / n);
    return W / 2 + (i - (n - 1) / 2) * gap;
  }

  private keyXY(letter: string): { x: number; y: number } {
    const row = KEY_ROWS.findIndex((r) => r.includes(letter));
    const col = KEY_ROWS[row]!.indexOf(letter);
    const count = KEY_ROWS[row]!.length;
    return { x: W / 2 + (col - (count - 1) / 2) * 62, y: KEYS_TOP + row * 76 + 32 };
  }

  private balloonXY(i: number): { x: number; y: number } {
    const n = this.state.level.balloons;
    const t = n === 1 ? 0.5 : i / (n - 1);
    const a = Math.PI * (1.15 - 1.3 * t);
    return { x: BASKET.x + Math.cos(a) * 170, y: 200 - Math.sin(a) * 110 };
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.g = this.add.graphics();
    this.clue = sharpText(this, W / 2, CLUE_Y, `Clue: ${this.state.theme}`, 24, COLORS.soft).setFontStyle('bold');
    this.slots = [...this.state.word].map((_, i) => sharpText(this, this.slotX(i), WORD_Y - 6, '', 40, COLORS.ink).setFontStyle('bold').setDepth(2));
    this.keys = [...HANG_LETTERS].map((l) => {
      const { x, y } = this.keyXY(l);
      return sharpText(this, x, y, l.toUpperCase(), 26, COLORS.ink).setFontStyle('bold').setDepth(2);
    });
    this.popped = this.state.wrong;
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      const letter = [...HANG_LETTERS].find((l) => {
        const k = this.keyXY(l);
        return Math.abs(p.worldX - k.x) < 29 && Math.abs(p.worldY - k.y) < 34;
      });
      if (letter) this.guess(letter);
    });
    onKeys(this, (key) => {
      const l = key.toLowerCase();
      if (l.length === 1 && HANG_LETTERS.includes(l)) {
        this.guess(l);
        return true;
      }
      return false;
    });
    const off = this.session.subscribe(() => this.changed());
    this.events.once('shutdown', off);
    this.draw();
  }

  private guess(letter: string): void {
    if (!this.session.isHumanTurn() || this.state.result) return;
    const move = `g${letter}`;
    if (!this.state.legalMoves(0).includes(move)) return cue('buzz');
    this.session.play(move);
  }

  private changed(): void {
    const state = this.state;
    const last = state.guessed[state.guessed.length - 1];
    if (last && state.word.includes(last)) {
      cue('place');
      // The letter drops into each slot it fills.
      [...state.word].forEach((l, i) => {
        if (l !== last) return;
        const t = this.slots[i]!;
        t.setText(l.toUpperCase()).setY(WORD_Y - 60).setAlpha(0.4);
        this.tweens.add({ targets: t, y: WORD_Y - 6, alpha: 1, duration: 260, delay: i * 40, ease: 'Bounce.easeOut' });
      });
    } else if (last) {
      // A balloon pops.
      const b = this.balloonXY(state.level.balloons - state.wrong);
      cue('capture');
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const bit = this.add.circle(b.x, b.y, 6, toHex(BALLOON_COLORS[(state.level.balloons - state.wrong) % BALLOON_COLORS.length]!)).setDepth(5);
        this.tweens.add({ targets: bit, x: b.x + Math.cos(a) * 60, y: b.y + Math.sin(a) * 60, alpha: 0, duration: 320, onComplete: () => bit.destroy() });
      }
    }
    this.popped = state.wrong;
    if (state.result) {
      cue(state.result.winners.length ? 'win' : 'lose');
      // Lost: the word is shown, the missing letters in red.
      [...state.word].forEach((l, i) => {
        const t = this.slots[i]!;
        if (!state.guessed.includes(l)) t.setText(l.toUpperCase()).setColor(COLORS.tomato);
      });
    }
    this.draw();
  }

  private draw(): void {
    const state = this.state;
    const g = this.g.clear();
    const left = state.level.balloons - this.popped;
    const lifted = left > 0 && !(state.result && !state.result.winners.length);
    const basketY = lifted ? BASKET.y : 330;
    // Balloons still up, each on its string to the basket.
    for (let i = 0; i < left; i++) {
      const b = this.balloonXY(i);
      g.lineStyle(2, toHex(COLORS.soft), 0.8);
      g.lineBetween(b.x, b.y + 30, BASKET.x + (b.x - BASKET.x) * 0.15, basketY - 30);
      const color = BALLOON_COLORS[i % BALLOON_COLORS.length]!;
      g.fillStyle(toHex(color), 1);
      g.fillEllipse(b.x, b.y, 50, 60);
      g.fillStyle(0xffffff, 0.45);
      g.fillEllipse(b.x - 10, b.y - 12, 12, 18);
      g.fillStyle(toHex(color), 1);
      g.fillTriangle(b.x - 5, b.y + 32, b.x + 5, b.y + 32, b.x, b.y + 26);
    }
    // The basket, with a little face peeping over the edge.
    g.fillStyle(toHex(COLORS.sunny), 1);
    g.fillCircle(BASKET.x, basketY - 34, 22);
    g.fillStyle(toHex(COLORS.ink), 1);
    g.fillCircle(BASKET.x - 7, basketY - 37, 3);
    g.fillCircle(BASKET.x + 7, basketY - 37, 3);
    if (lifted) g.fillEllipse(BASKET.x, basketY - 27, 10, 5);
    else g.fillRect(BASKET.x - 5, basketY - 27, 10, 2);
    g.fillStyle(toHex(DARK.peach), 1);
    g.fillRoundedRect(BASKET.x - 40, basketY - 20 + 5, 80, 40, 10);
    g.fillStyle(toHex(COLORS.peach), 1);
    g.fillRoundedRect(BASKET.x - 40, basketY - 20, 80, 40, 10);
    // The word's slots.
    [...state.word].forEach((_, i) => {
      const x = this.slotX(i);
      g.fillStyle(toHex(COLORS.ink), 1);
      g.fillRoundedRect(x - 22, WORD_Y + 22, 44, 6, 3);
    });
    // The alphabet: right letters green, wrong ones faded.
    for (const [k, l] of [...HANG_LETTERS].entries()) {
      const { x, y } = this.keyXY(l);
      const used = state.guessed.includes(l);
      const right = used && state.word.includes(l);
      g.fillStyle(toHex(right ? DARK.mint : used ? '#E6E0F4' : '#D8D3E6'), 1);
      g.fillRoundedRect(x - 27, y - 30 + 4, 54, 60, 14);
      g.fillStyle(toHex(right ? COLORS.mint : used ? '#F4F1FB' : '#FFFFFF'), 1);
      g.fillRoundedRect(x - 27, y - 30, 54, 60, 14);
      this.keys[k]!.setColor(right ? '#FFFFFF' : used ? '#C9C2E0' : COLORS.ink);
    }
    this.clue.setText(`Clue: ${state.theme}`);
  }

  /** The bands the page keeps to, for the layout check. */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    return [
      { name: 'balloons', top: 60, bottom: 345 },
      { name: 'clue', top: CLUE_Y - 14, bottom: CLUE_Y + 14 },
      { name: 'word', top: WORD_Y - 30, bottom: WORD_Y + 30 },
      { name: 'keys', top: KEYS_TOP + 2, bottom: KEYS_TOP + 2 * 76 + 66 },
    ];
  }
}

export function hangStatus(state: HangState): string | undefined {
  if (state.result) return undefined;
  return `${state.left} ${state.left === 1 ? 'balloon' : 'balloons'} left`;
}

export function hangResult(state: HangState): string | undefined {
  if (!state.result) return undefined;
  const word = state.word.toUpperCase();
  return state.result.winners.length ? `${word}! Saved with ${state.left} ${state.left === 1 ? 'balloon' : 'balloons'} to spare 🎉` : `The balloons are gone. It was ${word}.`;
}
