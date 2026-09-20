import { GROUP_SIZE, type GroupMove, type GroupsState, guess, LIVES, SHUFFLE } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { onKeys } from '../keys';

const W = 640;
const H = 620;
export const GROUPS_SIZE = { width: W, height: H };

const TOP = 26;
const ROW_H = 84;
const GAP = 8;
const COLS = 4;
const TILE_W = (W - 16 - GAP * (COLS - 1)) / COLS;
const TILE_H = ROW_H - GAP;
const CONTROLS_Y = TOP + 4 * ROW_H + 44;
/** Plainest group first, so the colour says how hard it was rather than when you found it. */
const RANK = [COLORS.sunny, COLORS.mint, COLORS.sky, COLORS.grape];

export const GROUPS_COLORS = [COLORS.sky];
export const GROUPS_NAMES = ['You'];

export class GroupsScene extends Scene {
  private board!: GameObjects.Graphics;
  private tiles: GameObjects.Text[] = [];
  private bars: GameObjects.Text[] = [];
  private banner!: GameObjects.Text;
  private livesText!: GameObjects.Text;
  private buttons: { label: string; x: number; text?: GameObjects.Text }[] = [
    { label: 'Shuffle', x: 128 },
    { label: 'Clear', x: 320 },
    { label: 'Guess', x: 512 },
  ];
  private picked: string[] = [];

  constructor(private readonly session: Session<GroupMove>) {
    super('word-groups');
  }

  private get state(): GroupsState {
    return this.session.state as GroupsState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.board = this.add.graphics();
    this.banner = sharpText(this, W / 2, CONTROLS_Y - 44, '', 26, COLORS.soft).setDepth(3);
    this.livesText = sharpText(this, W / 2, CONTROLS_Y + 58, '', 24, COLORS.soft).setDepth(3);
    for (const button of this.buttons) {
      button.text = sharpText(this, button.x, CONTROLS_Y, button.label, 24, COLORS.ink).setDepth(3);
    }
    this.draw();

    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.press(p.worldX, p.worldY));
    onKeys(this, (key) => this.key(key));
    const off = this.session.subscribe(() => {
      this.picked = [];
      this.draw();
    });
    this.events.once('shutdown', off);
  }

  private key(key: string): boolean {
    if (key === 'Enter') return this.submit();
    if (key === ' ') {
      this.play(SHUFFLE);
      return true;
    }
    if (key === 'Escape') {
      this.picked = [];
      this.draw();
      return true;
    }
    // Number keys pick the word in that place, reading left to right.
    const index = Number(key) - 1;
    const left = this.state.left;
    if (Number.isInteger(index) && index >= 0 && index < left.length) {
      this.tap(left[index]!);
      return true;
    }
    return false;
  }

  private press(x: number, y: number): void {
    for (const button of this.buttons) {
      if (Math.abs(y - CONTROLS_Y) < 26 && Math.abs(x - button.x) < 84) {
        if (button.label === 'Shuffle') this.play(SHUFFLE);
        else if (button.label === 'Clear') {
          this.picked = [];
          this.draw();
        } else this.submit();
        return;
      }
    }
    const state = this.state;
    const skip = state.found.length;
    const row = Math.floor((y - TOP) / ROW_H);
    const col = Math.floor((x - 8) / (TILE_W + GAP));
    if (row < skip || row > 3 || col < 0 || col >= COLS) return;
    const index = (row - skip) * COLS + col;
    const word = state.left[index];
    if (word) this.tap(word);
  }

  private tap(word: string): void {
    const at = this.picked.indexOf(word);
    if (at >= 0) this.picked.splice(at, 1);
    else if (this.picked.length < GROUP_SIZE) this.picked.push(word);
    this.draw();
  }

  private submit(): boolean {
    if (this.picked.length !== GROUP_SIZE) {
      this.banner.setText(`Pick ${GROUP_SIZE}`);
      return true;
    }
    this.play(guess(this.picked));
    return true;
  }

  private play(move: GroupMove): void {
    if (this.state.result || !this.session.isHumanTurn()) return;
    this.session.play(move);
  }

  private draw(): void {
    const state = this.state;
    const g = this.board.clear();
    let slot = 0;
    let bar = 0;

    // The groups found, in the order they were ranked rather than the order they were found.
    state.found.forEach((index, row) => {
      const group = state.groups[index]!;
      const y = TOP + row * ROW_H;
      g.fillStyle(toHex(RANK[index] ?? COLORS.sky), 1);
      g.fillRoundedRect(8, y, W - 16, TILE_H, 16);
      const name = (this.bars[bar] ??= sharpText(this, 0, 0, '', 24, '#ffffff').setDepth(2));
      name.setPosition(W / 2, y + TILE_H / 2 - 13).setText(group.name).setVisible(true);
      bar++;
      const words = (this.bars[bar] ??= sharpText(this, 0, 0, '', 20, '#ffffff').setDepth(2));
      words.setPosition(W / 2, y + TILE_H / 2 + 14).setText(group.words.join('  ')).setVisible(true);
      bar++;
    });
    for (let i = bar; i < this.bars.length; i++) this.bars[i]!.setVisible(false);

    // The words still in play.
    const left = state.left;
    left.forEach((word, index) => {
      const row = state.found.length + Math.floor(index / COLS);
      const col = index % COLS;
      const x = 8 + col * (TILE_W + GAP);
      const y = TOP + row * ROW_H;
      const on = this.picked.includes(word);
      g.fillStyle(0xe3def0, 1);
      g.fillRoundedRect(x, y + 4, TILE_W, TILE_H, 14);
      g.fillStyle(on ? toHex(DARK.sky) : 0xffffff, 1);
      g.fillRoundedRect(x, y, TILE_W, TILE_H, 14);
      if (!on) {
        g.lineStyle(2, 0xdcd6ee, 1);
        g.strokeRoundedRect(x, y, TILE_W, TILE_H, 14);
      }
      const text = (this.tiles[slot] ??= sharpText(this, 0, 0, '', 22, COLORS.ink).setDepth(2));
      text.setPosition(x + TILE_W / 2, y + TILE_H / 2).setColor(on ? '#ffffff' : COLORS.ink).setVisible(true);
      // Long words are shrunk to fit their own tile: PROTRACTOR and RINGMASTER both live here.
      text.setFontSize(22).setText(word);
      let size = 22;
      while (text.width > TILE_W - 12 && size > 12) {
        size -= 1;
        text.setFontSize(size);
      }
      slot++;
    });
    for (let i = slot; i < this.tiles.length; i++) this.tiles[i]!.setVisible(false);

    this.drawButtons(g);
    this.livesText.setText(state.result ? '' : `${'●'.repeat(state.lives)}${'○'.repeat(LIVES - state.lives)}`);
    this.banner.setText(this.say());
  }

  private say(): string {
    const state = this.state;
    if (state.result) return state.won ? 'All four.' : 'Out of guesses.';
    if (state.lastWrong && state.away === GROUP_SIZE - 1) return 'One away';
    if (state.lastWrong) return 'Not a group';
    return `${this.picked.length} of ${GROUP_SIZE} picked`;
  }

  private drawButtons(g: GameObjects.Graphics): void {
    for (const button of this.buttons) {
      const ready = button.label !== 'Guess' || this.picked.length === GROUP_SIZE;
      g.fillStyle(ready ? toHex(COLORS.sky) : 0xece8f5, 1);
      g.fillRoundedRect(button.x - 84, CONTROLS_Y - 26, 168, 52, 26);
      button.text?.setColor(ready ? '#ffffff' : COLORS.soft);
    }
  }
}

export const groupsStatus = (state: GroupsState): string | undefined =>
  state.result ? undefined : `${state.found.length} of 4 groups, ${state.lives} ${state.lives === 1 ? 'guess' : 'guesses'} left`;

export const groupsResult = (state: GroupsState): string | undefined => {
  if (!state.result) return undefined;
  return state.won ? `All four groups. 🎉` : `Out of guesses. ${4 - state.found.length} left unfound.`;
};
