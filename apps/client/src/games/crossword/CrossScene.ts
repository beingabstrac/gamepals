import {
  CHECK,
  type CrossMove,
  type CrossState,
  rubOut,
  SIDE,
  type Slot,
  writeIn,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { onKeys } from '../keys';

const W = 640;
const H = 940;
export const CROSS_SIZE = { width: W, height: H };

const CELL = 108;
/** As wide as a clue may be before it is shrunk to fit. */
const CLUE_WIDTH = 580;
const GRID = CELL * SIDE;
const GRID_TOP = 150;
const GRID_LEFT = (W - GRID) / 2;

export const CROSS_COLORS = [COLORS.sky];
export const CROSS_NAMES = ['You'];

export class CrossScene extends Scene {
  private board!: GameObjects.Graphics;
  private letters: GameObjects.Text[] = [];
  private numbers: GameObjects.Text[] = [];
  private clueLine!: GameObjects.Text;
  private where!: GameObjects.Text;
  private askText!: GameObjects.Text;
  private askBox!: GameObjects.Graphics;
  private row = 0;
  private col = 0;
  private down = false;

  constructor(private readonly session: Session<CrossMove>) {
    super('mini-crossword');
  }

  private get state(): CrossState {
    return this.session.state as CrossState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.board = this.add.graphics();
    this.askBox = this.add.graphics();
    for (let r = 0; r < SIDE; r++) {
      for (let c = 0; c < SIDE; c++) {
        const { x, y } = at(r, c);
        this.letters.push(sharpText(this, x, y, '', 56, COLORS.ink).setDepth(2));
        this.numbers.push(sharpText(this, x - CELL / 2 + 16, y - CELL / 2 + 15, '', 20, COLORS.soft).setDepth(2));
      }
    }
    this.where = sharpText(this, W / 2, 52, '', 26, COLORS.soft).setDepth(2);
    this.clueLine = sharpText(this, W / 2, 92, '', 32, COLORS.ink).setDepth(2);
    this.askText = sharpText(this, W / 2, GRID_TOP + GRID + 66, 'Check my letters', 26, COLORS.sky).setDepth(2);
    this.start();
    this.draw();

    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.press(p.worldX, p.worldY));
    onKeys(this, (key) => this.key(key));
    const off = this.session.subscribe(() => this.draw());
    this.events.once('shutdown', off);
  }

  /** Open on the first across clue, the way a crossword is handed to you. */
  private start(): void {
    const first = this.state.slots.find((slot) => !slot.down) ?? this.state.slots[0];
    if (!first) return;
    this.row = first.row;
    this.col = first.col;
    this.down = first.down;
  }

  private get slot(): Slot | undefined {
    return this.state.slots.find((slot) => slot.down === this.down && this.covers(slot, this.row, this.col));
  }

  private covers(slot: Slot, row: number, col: number): boolean {
    if (slot.down) return slot.col === col && row >= slot.row && row < slot.row + slot.length;
    return slot.row === row && col >= slot.col && col < slot.col + slot.length;
  }

  private press(x: number, y: number): void {
    if (Math.abs(y - this.askText.y) < 36 && Math.abs(x - W / 2) < 180) {
      if (!this.state.checked && this.session.isHumanTurn() && !this.state.result) this.session.play(CHECK);
      return;
    }
    const col = Math.floor((x - GRID_LEFT) / CELL);
    const row = Math.floor((y - GRID_TOP) / CELL);
    if (row < 0 || col < 0 || row >= SIDE || col >= SIDE || this.state.blockAt(row, col)) return;
    // Tapping the square you are already in turns the corner, which is how a crossword works.
    if (row === this.row && col === this.col) this.down = !this.down;
    this.row = row;
    this.col = col;
    if (!this.slot) this.down = !this.down;
    this.draw();
  }

  private key(key: string): boolean {
    const shift: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const way = shift[key];
    if (way) {
      // An arrow across the word you are in walks it; an arrow the other way turns the corner.
      const wants = way[0] !== 0;
      if (wants !== this.down) this.down = wants;
      else this.step(way[0], way[1]);
      this.draw();
      return true;
    }
    if (key === 'Backspace') {
      // Backspace rubs out where you are, or steps back a square and rubs that out if it is empty.
      if (!this.state.letterAt(this.row, this.col)) this.step(this.down ? -1 : 0, this.down ? 0 : -1);
      this.play(rubOut(this.row, this.col));
      this.draw();
      return true;
    }
    if (key === ' ' || key === 'Enter') {
      this.down = !this.down;
      if (!this.slot) this.down = !this.down;
      this.draw();
      return true;
    }
    if (/^[a-zA-Z]$/.test(key)) {
      this.play(writeIn(this.row, this.col, key.toLowerCase()));
      this.step(this.down ? 1 : 0, this.down ? 0 : 1);
      this.draw();
      return true;
    }
    return false;
  }

  private play(move: CrossMove): void {
    if (!this.session.isHumanTurn() || this.state.result) return;
    this.session.play(move);
  }

  /** Move along the word, skipping black squares and stopping at the end of the grid. */
  private step(dr: number, dc: number): void {
    let row = this.row + dr;
    let col = this.col + dc;
    while (row >= 0 && col >= 0 && row < SIDE && col < SIDE && this.state.blockAt(row, col)) {
      row += dr;
      col += dc;
    }
    if (row < 0 || col < 0 || row >= SIDE || col >= SIDE) return;
    this.row = row;
    this.col = col;
  }

  private draw(): void {
    const state = this.state;
    const slot = this.slot;
    const g = this.board.clear();
    g.fillStyle(0xe3def0, 1);
    g.fillRoundedRect(GRID_LEFT - 10, GRID_TOP - 4, GRID + 20, GRID + 20, 20);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(GRID_LEFT - 10, GRID_TOP - 10, GRID + 20, GRID + 20, 20);

    const numberAt = new Map<string, number>();
    for (const one of state.slots) numberAt.set(`${one.row},${one.col}`, one.number);

    for (let r = 0; r < SIDE; r++) {
      for (let c = 0; c < SIDE; c++) {
        const { x, y } = at(r, c);
        const text = this.letters[r * SIDE + c]!;
        const number = this.numbers[r * SIDE + c]!;
        if (state.blockAt(r, c)) {
          g.fillStyle(toHex(COLORS.ink), 1);
          g.fillRoundedRect(x - CELL / 2 + 3, y - CELL / 2 + 3, CELL - 6, CELL - 6, 8);
          text.setText('');
          number.setText('');
          continue;
        }
        const here = r === this.row && c === this.col;
        const inWord = slot ? this.covers(slot, r, c) : false;
        g.fillStyle(here ? toHex(COLORS.sunny) : inWord ? 0xdfeaff : 0xffffff, 1);
        g.fillRoundedRect(x - CELL / 2 + 3, y - CELL / 2 + 3, CELL - 6, CELL - 6, 8);
        g.lineStyle(2, 0xd7d2e6, 1);
        g.strokeRoundedRect(x - CELL / 2 + 3, y - CELL / 2 + 3, CELL - 6, CELL - 6, 8);
        const letter = state.letterAt(r, c);
        // Wrong letters are only called out once you ask to be told.
        const wrong = state.checked && letter && !state.rightAt(r, c);
        text.setText(letter.toUpperCase()).setColor(wrong ? COLORS.tomato : COLORS.ink);
        number.setText(String(numberAt.get(`${r},${c}`) ?? ''));
      }
    }

    if (slot) {
      this.where.setText(`${slot.number} ${slot.down ? 'Down' : 'Across'}`);
      this.setClue(state.clueFor(slot));
    }
    const asked = state.checked;
    this.askText.setText(asked ? 'Wrong letters are in red' : 'Check my letters').setColor(asked ? COLORS.soft : COLORS.sky);
    const box = this.askBox.clear();
    if (!asked && !state.result) {
      box.lineStyle(2, toHex(DARK.sky), 1);
      box.strokeRoundedRect(W / 2 - 150, this.askText.y - 26, 300, 52, 26);
    }
  }

  /**
   * A clue is one line, shrunk until it fits. "It shoots arrows, or you take one on stage" is
   * forty-two characters and runs off both sides of the grid at the size the short ones use.
   */
  private setClue(clue: string): void {
    this.clueLine.setFontSize(32).setText(clue);
    let size = 32;
    while (this.clueLine.width > CLUE_WIDTH && size > 18) {
      size -= 2;
      this.clueLine.setFontSize(size);
    }
  }

  /** The bands that must not sit on top of each other, for the layout check. */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    return [
      { name: 'where', top: 52 - 16, bottom: 52 + 16 },
      { name: 'clue', top: 92 - 22, bottom: 92 + 22 },
      { name: 'grid', top: GRID_TOP - 10, bottom: GRID_TOP + GRID + 10 },
      { name: 'check', top: this.askText.y - 26, bottom: this.askText.y + 26 },
    ];
  }

  /** The widest the clue line ever gets, against the room it has, for the layout check. */
  clueCheck(): { widest: number; room: number } {
    return { widest: Math.round(this.clueLine.width), room: CLUE_WIDTH };
  }
}

function at(row: number, col: number): { x: number; y: number } {
  return { x: GRID_LEFT + col * CELL + CELL / 2, y: GRID_TOP + row * CELL + CELL / 2 };
}

export const crossStatus = (state: CrossState): string | undefined => {
  if (state.result) return undefined;
  const left = state.left;
  return left === 1 ? '1 square left' : `${left} squares left`;
};

export const crossResult = (state: CrossState): string | undefined =>
  state.result ? 'Grid finished. 🎉' : undefined;
