import { findWord, type HuntMove, type HuntState, spellable } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { onKeys } from '../keys';

const W = 640;
const H = 760;
export const HUNT_SIZE = { width: W, height: H };

const TILE = 74;
const TILE_GAP = 8;
const TILES_Y = 132;
const TYPED_Y = 54;
const LIST_TOP = 250;
const LIST_COLS = 3;

export const HUNT_COLORS = [COLORS.peach];
export const HUNT_NAMES = ['You'];

export class HuntScene extends Scene {
  private board!: GameObjects.Graphics;
  private tiles: GameObjects.Text[] = [];
  private list: GameObjects.Text[] = [];
  private typedText!: GameObjects.Text;
  private banner!: GameObjects.Text;
  private typed = '';
  /** The letters as shown, reordered by a shuffle without touching the rules. */
  private shown = '';
  private shaking = false;

  constructor(private readonly session: Session<HuntMove>) {
    super('anagram-hunt');
  }

  private get state(): HuntState {
    return this.session.state as HuntState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.shown = this.state.letters;
    this.board = this.add.graphics();
    this.typedText = sharpText(this, W / 2, TYPED_Y, '', 44, COLORS.ink).setDepth(2);
    this.banner = sharpText(this, W / 2, TILES_Y + TILE + 28, '', 24, COLORS.soft).setDepth(2);
    for (let i = 0; i < this.shown.length; i++) {
      this.tiles.push(sharpText(this, 0, 0, '', 40, COLORS.ink).setDepth(2));
    }
    this.draw();

    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.press(p.worldX, p.worldY));
    onKeys(this, (key) => this.key(key));
    const off = this.session.subscribe(() => {
      this.typed = '';
      this.draw();
    });
    this.events.once('shutdown', off);
  }

  private press(x: number, y: number): void {
    if (Math.abs(y - (TILES_Y + TILE / 2)) > TILE / 2) return;
    const width = this.shown.length * (TILE + TILE_GAP) - TILE_GAP;
    const index = Math.floor((x - (W - width) / 2) / (TILE + TILE_GAP));
    const letter = this.shown[index];
    if (letter && this.canAdd(letter)) {
      this.typed += letter;
      this.draw();
    }
  }

  /** Only as many of a letter as the seven hold, which is the one rule people forget. */
  private canAdd(letter: string): boolean {
    return spellable(this.typed + letter, this.shown);
  }

  private key(key: string): boolean {
    if (key === 'Backspace') {
      this.typed = this.typed.slice(0, -1);
      this.draw();
      return true;
    }
    if (key === 'Enter') return this.submit();
    if (key === ' ') {
      // Shuffling is a look, not a move: the rules never hear about it.
      const letters = [...this.shown];
      for (let i = letters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [letters[i], letters[j]] = [letters[j]!, letters[i]!];
      }
      this.shown = letters.join('');
      this.draw();
      return true;
    }
    if (/^[a-zA-Z]$/.test(key)) {
      const letter = key.toLowerCase();
      if (this.canAdd(letter)) {
        this.typed += letter;
        this.draw();
      } else this.reject('Not in these letters');
      return true;
    }
    return false;
  }

  private submit(): boolean {
    const state = this.state;
    if (state.result || !this.session.isHumanTurn()) return false;
    if (this.typed.length < 3) return this.reject('Three letters or more');
    if (state.found.includes(this.typed)) return this.reject('Already found');
    if (!state.words.includes(this.typed)) return this.reject('Not a word we know');
    this.session.play(findWord(this.typed));
    return true;
  }

  private draw(): void {
    const state = this.state;
    const g = this.board.clear();
    const width = this.shown.length * (TILE + TILE_GAP) - TILE_GAP;
    for (let i = 0; i < this.shown.length; i++) {
      const x = (W - width) / 2 + i * (TILE + TILE_GAP);
      const used = !this.canAdd(this.shown[i]!) && this.typed.length > 0;
      g.fillStyle(toHex(DARK.peach), 1);
      g.fillRoundedRect(x, TILES_Y + 5, TILE, TILE, 16);
      g.fillStyle(used ? 0xf0ece1 : toHex(COLORS.peach), 1);
      g.fillRoundedRect(x, TILES_Y, TILE, TILE, 16);
      this.tiles[i]!
        .setPosition(x + TILE / 2, TILES_Y + TILE / 2)
        .setText(this.shown[i]!.toUpperCase())
        .setColor(used ? COLORS.soft : '#ffffff');
    }

    this.typedText.setText(this.typed.toUpperCase() || '·');
    this.banner.setText(
      state.result
        ? `${state.found.length} found${state.gotLong ? ', including the long one' : ''}`
        : `${state.left} more to go${state.gotLong ? '' : ', one uses all seven'}`,
    );
    this.drawFound(state);
  }

  private drawFound(state: HuntState): void {
    state.found.forEach((word, i) => {
      const text = (this.list[i] ??= sharpText(this, 0, 0, '', 26, COLORS.ink).setDepth(2));
      const col = i % LIST_COLS;
      const row = Math.floor(i / LIST_COLS);
      text
        .setPosition((W / LIST_COLS) * (col + 0.5), LIST_TOP + row * 40)
        .setText(word.toUpperCase())
        .setColor(word === state.base ? COLORS.peach : COLORS.ink)
        .setVisible(true);
    });
    for (let i = state.found.length; i < this.list.length; i++) this.list[i]!.setVisible(false);
  }

  private reject(why: string): boolean {
    this.banner.setText(why);
    if (this.shaking) return true;
    this.shaking = true;
    const start = this.typedText.x;
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 240,
      onUpdate: (tween) => this.typedText.setX(start + Math.sin(tween.getValue()! * Math.PI * 6) * 9),
      onComplete: () => {
        this.typedText.setX(start);
        this.shaking = false;
      },
    });
    return true;
  }
}

export const huntStatus = (state: HuntState): string | undefined =>
  state.result ? undefined : `${state.found.length} of ${state.target} found`;

export const huntResult = (state: HuntState): string | undefined => {
  if (!state.result) return undefined;
  return state.gotLong ? `${state.found.length} found, the long one too. 🎉` : `${state.found.length} found. 🎉`;
};
