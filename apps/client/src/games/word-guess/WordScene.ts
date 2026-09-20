import { isWord, TRIES, WORD_LENGTH, wordGuess, type Mark, type WordMove, type WordState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import type { Session } from '../../session';
import { COLORS, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { onKeys } from '../keys';

const W = 640;
const H = 880;
export const WORD_SIZE = { width: W, height: H };

const CELL = 78;
const GAP = 9;
const GRID_TOP = 30;
/** The line that says "Not a word we know" gets a band of its own between grid and keyboard. */
const SAY_Y = 575;
const KEYS_TOP = 610;
const KEY_H = 74;
const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
/** Right where it should be, in the word somewhere else, not in the word at all. */
const MARK_FILL: Record<Mark, number> = {
  right: toHex(COLORS.mint),
  near: toHex(COLORS.sunny),
  gone: 0xb9b5c9,
};
export const WORD_COLORS = [COLORS.mint];
export const WORD_NAMES = ['You'];

export class WordScene extends Scene {
  private board!: GameObjects.Graphics;
  private keysG!: GameObjects.Graphics;
  private cellText: GameObjects.Text[] = [];
  private keyText = new Map<string, GameObjects.Text>();
  private banner!: GameObjects.Text;
  /** What is typed but not yet guessed. */
  private typed = '';
  private shaking = false;

  constructor(private readonly session: Session<WordMove>) {
    super('word-guess');
  }

  private get state(): WordState {
    return this.session.state as WordState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.board = this.add.graphics();
    this.keysG = this.add.graphics();
    for (let row = 0; row < TRIES; row++) {
      for (let col = 0; col < WORD_LENGTH; col++) {
        const { x, y } = cellAt(row, col);
        this.cellText.push(sharpText(this, x, y, '', 46, COLORS.ink).setDepth(2));
      }
    }
    this.banner = sharpText(this, W / 2, SAY_Y, '', 26, COLORS.soft).setDepth(4);
    this.drawKeys();
    this.draw();

    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.press(p.worldX, p.worldY));
    onKeys(this, (key) => this.key(key));
    const off = this.session.subscribe(() => this.onMove());
    this.events.once('shutdown', off);
  }

  private onMove(): void {
    this.typed = '';
    this.draw();
    // Nothing said at the end: the result sheet already says it, and saying it twice put the
    // words on the board.
  }

  /**
   * Where the grid ends and where the line under it sits, for the layout check. They shipped
   * 8px apart once, so "Got it!" was printed inside an empty square of the grid.
   */
  bannerCheck(): { gridBottom: number; sayTop: number; keysTop: number } {
    return { gridBottom: cellAt(TRIES - 1, 0).y + CELL / 2, sayTop: SAY_Y - 16, keysTop: KEYS_TOP };
  }

  private draw(): void {
    const state = this.state;
    const g = this.board.clear();
    const typedRow = state.guesses.length;
    for (let row = 0; row < TRIES; row++) {
      for (let col = 0; col < WORD_LENGTH; col++) {
        const { x, y } = cellAt(row, col);
        const guess = state.guesses[row];
        const mark = guess?.marks[col];
        const letter = guess ? guess.word[col]! : row === typedRow ? (this.typed[col] ?? '') : '';
        if (mark) {
          g.fillStyle(MARK_FILL[mark], 1);
          g.fillRoundedRect(x - CELL / 2, y - CELL / 2 + 4, CELL, CELL, 14);
        } else {
          // Empty, or waiting: a box with a lip, darker once a letter is in it.
          g.fillStyle(letter ? 0xdcd6ee : 0xece8f5, 1);
          g.fillRoundedRect(x - CELL / 2, y - CELL / 2 + 4, CELL, CELL, 14);
          g.fillStyle(0xffffff, 1);
          g.fillRoundedRect(x - CELL / 2, y - CELL / 2, CELL, CELL, 14);
          g.lineStyle(3, letter ? toHex(COLORS.grape) : 0xdcd6ee, 1);
          g.strokeRoundedRect(x - CELL / 2, y - CELL / 2, CELL, CELL, 14);
        }
        const text = this.cellText[row * WORD_LENGTH + col]!;
        text.setText(letter.toUpperCase()).setColor(mark ? '#ffffff' : COLORS.ink);
      }
    }
    this.drawKeys();
  }

  /** The keyboard, with every letter coloured by what it has turned out to be. */
  private drawKeys(): void {
    const g = this.keysG.clear();
    const known = this.state.letters;
    ROWS.forEach((row, r) => {
      const width = (W - 40) / 10 - 6;
      const rowWidth = row.length * (width + 6) - 6 + (r === 2 ? 2 * (width * 1.5 + 6) : 0);
      let x = (W - rowWidth) / 2;
      const y = KEYS_TOP + r * (KEY_H + 8);
      if (r === 2) {
        this.drawKey(g, x, y, width * 1.5, 'ENTER');
        x += width * 1.5 + 6;
      }
      for (const letter of row) {
        this.drawKey(g, x, y, width, letter, known.get(letter));
        x += width + 6;
      }
      if (r === 2) this.drawKey(g, x, y, width * 1.5, 'DEL');
    });
  }

  private drawKey(g: GameObjects.Graphics, x: number, y: number, width: number, label: string, mark?: Mark): void {
    g.fillStyle(mark ? MARK_FILL[mark] : 0xffffff, 1);
    g.fillRoundedRect(x, y, width, KEY_H, 12);
    g.lineStyle(2, mark ? MARK_FILL[mark] : 0xdcd6ee, 1);
    g.strokeRoundedRect(x, y, width, KEY_H, 12);
    const key = this.keyText.get(label) ?? sharpText(this, 0, 0, label, label.length > 1 ? 20 : 30, COLORS.ink).setDepth(3);
    this.keyText.set(label, key);
    key.setPosition(x + width / 2, y + KEY_H / 2).setColor(mark && mark !== 'gone' ? '#ffffff' : mark ? '#ffffff' : COLORS.ink);
    // Where a tap on this key lands.
    key.setData('box', { x, y, width });
  }

  private press(x: number, y: number): void {
    for (const [label, text] of this.keyText) {
      const box = text.getData('box') as { x: number; y: number; width: number } | undefined;
      if (!box) continue;
      if (x < box.x || x > box.x + box.width || y < box.y || y > box.y + KEY_H) continue;
      this.type(label);
      return;
    }
  }

  private key(key: string): boolean {
    if (key === 'Enter' || key === ' ') return this.type('ENTER');
    if (key === 'Backspace') return this.type('DEL');
    if (/^[a-zA-Z]$/.test(key)) return this.type(key.toLowerCase());
    return false;
  }

  private type(label: string): boolean {
    const state = this.state;
    if (state.result || !this.session.isHumanTurn()) return false;
    if (label === 'DEL') {
      this.typed = this.typed.slice(0, -1);
      this.draw();
      return true;
    }
    if (label === 'ENTER') {
      if (this.typed.length < WORD_LENGTH) return this.reject('Five letters');
      if (!isWord(this.typed)) return this.reject('Not a word we know');
      this.session.play(wordGuess(this.typed));
      return true;
    }
    if (this.typed.length >= WORD_LENGTH) return true;
    this.typed += label;
    this.draw();
    return true;
  }

  /** A refused guess shakes the row rather than doing nothing. */
  private reject(why: string): boolean {
    this.say(why);
    if (this.shaking) return true;
    this.shaking = true;
    const row = this.state.guesses.length;
    const texts = this.cellText.slice(row * WORD_LENGTH, row * WORD_LENGTH + WORD_LENGTH);
    const start = texts.map((text) => text.x);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 260,
      onUpdate: (tween) => {
        const shift = Math.sin(tween.getValue()! * Math.PI * 6) * 8;
        texts.forEach((text, i) => text.setX(start[i]! + shift));
      },
      onComplete: () => {
        texts.forEach((text, i) => text.setX(start[i]!));
        this.shaking = false;
      },
    });
    return true;
  }

  private say(text: string): void {
    this.banner.setText(text).setAlpha(1);
    this.tweens.add({ targets: this.banner, alpha: 0.35, duration: 400, yoyo: true, repeat: 1 });
  }
}

function cellAt(row: number, col: number): { x: number; y: number } {
  const width = WORD_LENGTH * CELL + (WORD_LENGTH - 1) * GAP;
  return {
    x: (W - width) / 2 + col * (CELL + GAP) + CELL / 2,
    y: GRID_TOP + row * (CELL + GAP) + CELL / 2,
  };
}

export const wordStatus = (state: WordState): string | undefined => {
  if (state.result) return undefined;
  const left = state.left;
  return left === TRIES ? 'Guess the five-letter word' : `${left} ${left === 1 ? 'go' : 'goes'} left`;
};

export const wordResult = (state: WordState): string | undefined => {
  if (!state.result) return undefined;
  if (state.won) return `Got it in ${state.guesses.length}. 🎉`;
  return `It was ${state.secret.toUpperCase()}.`;
};
