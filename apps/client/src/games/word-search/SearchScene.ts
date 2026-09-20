import { type Found, type SearchMove, type SearchState, searchLine } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import type { Session } from '../../session';
import { COLORS, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { onKeys } from '../keys';

const W = 640;
const H = 940;
export const SEARCH_SIZE = { width: W, height: H };

const GRID_TOP = 96;
const GRID_SIZE = 540;
const LIST_TOP = 680;
/** One colour per found word, taken in turn, so two crossing words stay apart. */
const BANDS = [COLORS.mint, COLORS.sky, COLORS.sunny, COLORS.bubblegum, COLORS.grape, COLORS.peach];

export const SEARCH_COLORS = [COLORS.mint];
export const SEARCH_NAMES = ['You'];

export class SearchScene extends Scene {
  private bands!: GameObjects.Graphics;
  private board!: GameObjects.Graphics;
  private letters: GameObjects.Text[] = [];
  private listText: GameObjects.Text[] = [];
  private theme!: GameObjects.Text;
  /** Where the finger went down, in grid squares, while a drag is going on. */
  private from?: Square;
  private to?: Square;

  constructor(private readonly session: Session<SearchMove>) {
    super('word-search');
  }

  private get state(): SearchState {
    return this.session.state as SearchState;
  }

  private get step(): number {
    return GRID_SIZE / this.state.side;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.theme = sharpText(this, W / 2, 52, '', 34, COLORS.ink).setDepth(2);
    this.board = this.add.graphics();
    this.bands = this.add.graphics().setDepth(1);
    const side = this.state.side;
    for (let r = 0; r < side; r++) {
      for (let c = 0; c < side; c++) {
        const { x, y } = this.squareAt(r, c);
        this.letters.push(sharpText(this, x, y, '', Math.round(this.step * 0.52), COLORS.ink).setDepth(2));
      }
    }
    this.draw();

    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      this.from = this.squareUnder(p.worldX, p.worldY);
      this.to = this.from;
      this.draw();
    });
    this.input.on('pointermove', (p: { worldX: number; worldY: number; isDown: boolean }) => {
      if (!p.isDown || !this.from) return;
      this.to = this.squareUnder(p.worldX, p.worldY) ?? this.to;
      this.draw();
    });
    this.input.on('pointerup', () => this.release());
    // Keyboard play: arrows move the end of the line, Enter takes it, Space starts one.
    onKeys(this, (key) => this.key(key));

    const off = this.session.subscribe(() => this.draw());
    this.events.once('shutdown', off);
  }

  private key(key: string): boolean {
    const side = this.state.side;
    if (!this.from) {
      if (key !== ' ' && key !== 'Enter') return false;
      this.from = { r: 0, c: 0 };
      this.to = { r: 0, c: 0 };
      this.draw();
      return true;
    }
    const end = this.to ?? this.from;
    const shift: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const way = shift[key];
    if (way) {
      // With nothing selected yet the arrows walk the start square around instead.
      const same = end.r === this.from.r && end.c === this.from.c;
      const next = { r: clamp(end.r + way[0], side), c: clamp(end.c + way[1], side) };
      if (same) this.from = next;
      this.to = next;
      this.draw();
      return true;
    }
    if (key === 'Enter' || key === ' ') {
      this.release();
      return true;
    }
    if (key === 'Escape') {
      this.from = undefined;
      this.to = undefined;
      this.draw();
      return true;
    }
    return false;
  }

  private release(): void {
    const from = this.from;
    const to = this.to;
    this.from = undefined;
    this.to = undefined;
    if (!from || !to || !this.session.isHumanTurn() || this.state.result) {
      this.draw();
      return;
    }
    const end = snap(from, to, this.state.side);
    // A line that spells nothing is simply let go of, the way a finger lifts off the page.
    if (this.spells(from, end)) this.session.play(searchLine(from.r, from.c, end.r, end.c));
    else this.draw();
  }

  /** Does this line spell a word still on the list, either way round? */
  private spells(from: Square, to: Square): boolean {
    const along = this.state.read(from.r, from.c, to.r, to.c);
    const back = along.split('').reverse().join('');
    return this.state.left.some((word) => word === along || word === back);
  }

  private squareAt(r: number, c: number): { x: number; y: number } {
    const step = this.step;
    return { x: (W - GRID_SIZE) / 2 + c * step + step / 2, y: GRID_TOP + r * step + step / 2 };
  }

  private squareUnder(x: number, y: number): Square | undefined {
    const step = this.step;
    const c = Math.floor((x - (W - GRID_SIZE) / 2) / step);
    const r = Math.floor((y - GRID_TOP) / step);
    const side = this.state.side;
    if (r < 0 || c < 0 || r >= side || c >= side) return undefined;
    return { r, c };
  }

  private draw(): void {
    const state = this.state;
    const step = this.step;
    this.theme.setText(state.theme);
    const g = this.board.clear();
    // The paper the puzzle is printed on, with a lip under it.
    g.fillStyle(0xe3def0, 1);
    g.fillRoundedRect((W - GRID_SIZE) / 2 - 14, GRID_TOP - 14 + 6, GRID_SIZE + 28, GRID_SIZE + 28, 26);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect((W - GRID_SIZE) / 2 - 14, GRID_TOP - 14, GRID_SIZE + 28, GRID_SIZE + 28, 26);

    const bands = this.bands.clear();
    state.found.forEach((one, i) => this.band(bands, one, BANDS[i % BANDS.length]!, 0.42));
    if (this.from && this.to) {
      // The band shows the line the finger will actually leave behind, not where the finger is.
      const end = snap(this.from, this.to, this.state.side);
      const live: Found = {
        word: '',
        r: this.from.r,
        c: this.from.c,
        dr: Math.sign(end.r - this.from.r),
        dc: Math.sign(end.c - this.from.c),
      };
      const steps = Math.max(Math.abs(end.r - this.from.r), Math.abs(end.c - this.from.c));
      this.band(bands, live, COLORS.grape, 0.3, steps + 1);
    }

    for (let r = 0; r < state.side; r++) {
      for (let c = 0; c < state.side; c++) {
        const text = this.letters[r * state.side + c]!;
        text.setText(state.letterAt(r, c).toUpperCase()).setFontSize(Math.round(step * 0.52));
        const at = this.squareAt(r, c);
        text.setPosition(at.x, at.y);
      }
    }
    this.drawList();
  }

  /** A rounded band along a line, the way a highlighter pen would leave one. */
  private band(g: GameObjects.Graphics, one: Found, color: string, alpha: number, length?: number): void {
    const step = this.step;
    const count = length ?? one.word.length;
    const start = this.squareAt(one.r, one.c);
    const end = this.squareAt(one.r + one.dr * (count - 1), one.c + one.dc * (count - 1));
    const thick = step * 0.78;
    g.fillStyle(toHex(color), alpha);
    g.lineStyle(thick, toHex(color), alpha);
    g.beginPath();
    g.moveTo(start.x, start.y);
    g.lineTo(end.x, end.y);
    g.strokePath();
    g.fillCircle(start.x, start.y, thick / 2);
    g.fillCircle(end.x, end.y, thick / 2);
  }

  private drawList(): void {
    const state = this.state;
    const done = new Set(state.found.map((one) => one.word));
    const perRow = state.words.length > 8 ? 3 : 2;
    state.words.forEach((word, i) => {
      const text = this.listText[i] ?? sharpText(this, 0, 0, '', 28, COLORS.ink).setDepth(2);
      this.listText[i] = text;
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      text
        .setPosition((W / perRow) * (col + 0.5), LIST_TOP + row * 46)
        .setText(word.toUpperCase())
        .setColor(done.has(word) ? COLORS.soft : COLORS.ink)
        .setAlpha(done.has(word) ? 0.45 : 1);
    });
  }
}

interface Square {
  readonly r: number;
  readonly c: number;
}

/**
 * A word runs along one of eight lines, so the end of a drag is pulled onto the nearest of them:
 * straight across, straight down, or at forty-five degrees. Without this the band wobbles with
 * the finger and a word two squares long is hard to take.
 */
function snap(from: Square, to: Square, side: number): Square {
  const rows = to.r - from.r;
  const cols = to.c - from.c;
  const up = Math.abs(rows);
  const along = Math.abs(cols);
  if (up === 0 || along === 0 || up === along) return to;
  // Near enough to the diagonal takes the diagonal; otherwise the longer axis wins.
  if (Math.min(up, along) * 2 > Math.max(up, along)) {
    // As long as the longer side, but never off the paper.
    const room = Math.min(
      Math.max(up, along),
      Math.sign(rows) > 0 ? side - 1 - from.r : from.r,
      Math.sign(cols) > 0 ? side - 1 - from.c : from.c,
    );
    return { r: from.r + Math.sign(rows) * room, c: from.c + Math.sign(cols) * room };
  }
  return up > along ? { r: to.r, c: from.c } : { r: from.r, c: to.c };
}

const clamp = (value: number, side: number): number => Math.max(0, Math.min(side - 1, value));

export const searchStatus = (state: SearchState): string | undefined => {
  if (state.result) return undefined;
  const left = state.left.length;
  return `${left} ${left === 1 ? 'word' : 'words'} left`;
};

export const searchResult = (state: SearchState): string | undefined =>
  state.result ? `Every word found. 🎉` : undefined;
