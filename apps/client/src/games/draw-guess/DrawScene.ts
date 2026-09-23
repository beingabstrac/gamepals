import { DRAW_SECONDS, type DrawMove, type DrawState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { onKeys } from '../keys';
import { PARTY_COLORS, PARTY_DARK } from '../party';

const W = 600;
const H = 880;
export const DRAW_SIZE = { width: W, height: H };
export const DRAW_COLORS = PARTY_COLORS;

const TOP_Y = 56;
const PAD = { x: 20, y: 110, w: W - 40, h: 540 };
const TOOLS_Y = 700;
const ACTION_Y = 800;
const ACTION_H = 80;
const INKS = [COLORS.ink, COLORS.tomato, COLORS.sky, COLORS.mint, COLORS.sunny];
const LINE = 9;
const PEN_STEP = 14;

/**
 * Draw & Guess. The rules deal the words and keep the score; the drawing belongs to the scene. A
 * cover passes the phone to whoever draws next and shows them the word; then a card to draw on, five
 * inks and Clear, a clock, and a Peek button they hold to see the word again. When somebody calls it,
 * Got it! asks who, and both of them score.
 */
export class DrawScene extends Scene {
  private view!: GameObjects.Container;
  private ink!: GameObjects.Graphics;
  private pen!: GameObjects.Graphics;
  private hits: { x: number; y: number; w: number; h: number; act: () => void }[] = [];
  private looking = false;
  private peeking = false;
  private asking = false;
  private color = 0;
  private last: { x: number; y: number } | null = null;
  /** The keyboard pen: where it is and whether it is down. */
  private cursor = { x: W / 2, y: PAD.y + PAD.h / 2, down: false };
  private endsAt: number | null = null;
  private clockText: GameObjects.Text | null = null;
  private lastSecond = -1;
  private shown = '';

  constructor(private readonly session: Session<DrawMove>) {
    super('draw-guess');
  }

  private get state(): DrawState {
    return this.session.state as DrawState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.view = this.add.container(0, 0).setDepth(1);
    this.ink = this.add.graphics().setDepth(2);
    this.pen = this.add.graphics().setDepth(3);
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.down(p.worldX, p.worldY));
    this.input.on('pointermove', (p: { worldX: number; worldY: number; isDown: boolean }) => {
      if (p.isDown && this.last) this.stroke(p.worldX, p.worldY);
    });
    const up = () => {
      this.last = null;
      if (this.peeking) {
        this.peeking = false;
        this.draw();
      }
    };
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
    onKeys(this, (key) => this.key(key));
    const off = this.session.subscribe(() => this.changed());
    this.events.once('shutdown', off);
    this.changed();
  }

  private changed(): void {
    const state = this.state;
    const key = `${state.phase}.${state.turn}`;
    if (key !== this.shown) {
      this.looking = false;
      this.asking = false;
      this.peeking = false;
      this.ink.clear();
      this.pen.clear();
      this.cursor.down = false;
      this.endsAt = state.phase === 'drawing' ? this.time.now + DRAW_SECONDS * 1000 : null;
      this.lastSecond = -1;
    }
    this.shown = key;
    this.draw();
  }

  update(time: number): void {
    if (this.endsAt === null) return;
    const left = Math.max(0, Math.ceil((this.endsAt - time) / 1000));
    if (left !== this.lastSecond) {
      this.lastSecond = left;
      this.clockText?.setText(`${left}`).setColor(left <= 10 ? COLORS.tomato : COLORS.ink);
      if (left <= 10 && left > 0) cue('tap');
    }
    if (time >= this.endsAt) {
      this.endsAt = null;
      cue('buzz');
      this.play('end');
    }
  }

  private play(move: DrawMove): void {
    if (this.state.result || !this.session.isHumanTurn()) return;
    this.session.play(move);
  }

  private name(seat: number): string {
    return this.session.seats[seat]?.label ?? `Player ${seat + 1}`;
  }

  private inPad(x: number, y: number): boolean {
    return x >= PAD.x && x <= PAD.x + PAD.w && y >= PAD.y && y <= PAD.y + PAD.h;
  }

  private down(x: number, y: number): void {
    this.pen.clear();
    const hit = this.hits.find((h) => Math.abs(x - h.x) <= h.w / 2 && Math.abs(y - h.y) <= h.h / 2);
    if (hit) {
      hit.act();
      return;
    }
    if (this.state.phase === 'drawing' && !this.asking && this.session.isHumanTurn() && this.inPad(x, y)) {
      this.last = { x, y };
      this.dot(x, y);
    }
  }

  private dot(x: number, y: number): void {
    this.ink.fillStyle(toHex(INKS[this.color]!), 1);
    this.ink.fillCircle(x, y, LINE / 2);
  }

  private stroke(x: number, y: number): void {
    const cx = Math.max(PAD.x + LINE, Math.min(PAD.x + PAD.w - LINE, x));
    const cy = Math.max(PAD.y + LINE, Math.min(PAD.y + PAD.h - LINE, y));
    const from = this.last!;
    this.ink.lineStyle(LINE, toHex(INKS[this.color]!), 1);
    this.ink.lineBetween(from.x, from.y, cx, cy);
    this.dot(cx, cy);
    this.last = { x: cx, y: cy };
  }

  private key(key: string): boolean {
    const state = this.state;
    if (state.phase === 'ready') {
      if (key !== 'Enter' && key !== ' ') return false;
      this.flip();
      return true;
    }
    if (state.phase !== 'drawing') return false;
    const n = Number(key);
    if (this.asking) {
      const guessers = this.guessers();
      if (Number.isInteger(n) && n >= 1 && n <= guessers.length) this.guessed(guessers[n - 1]!);
      else if (key === 'Escape') this.ask(false);
      else return false;
      return true;
    }
    if (Number.isInteger(n) && n >= 1 && n <= INKS.length) {
      this.pick(n - 1);
      return true;
    }
    if (key === 'Enter') {
      this.ask(true);
      return true;
    }
    if (key === 'c' || key === 'C') {
      this.clear();
      return true;
    }
    if (key === 'w' || key === 'W') {
      this.peeking = !this.peeking;
      this.draw();
      return true;
    }
    if (key === ' ') {
      this.cursor.down = !this.cursor.down;
      if (this.cursor.down) this.dot(this.cursor.x, this.cursor.y);
      this.showCursor();
      return true;
    }
    const step = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, [number, number]>)[key];
    if (!step) return false;
    // The keyboard pen: arrows move it, Space puts it down or lifts it.
    const from = { x: this.cursor.x, y: this.cursor.y };
    this.cursor.x = Math.max(PAD.x + LINE, Math.min(PAD.x + PAD.w - LINE, this.cursor.x + step[0] * PEN_STEP));
    this.cursor.y = Math.max(PAD.y + LINE, Math.min(PAD.y + PAD.h - LINE, this.cursor.y + step[1] * PEN_STEP));
    if (this.cursor.down) {
      this.last = from;
      this.stroke(this.cursor.x, this.cursor.y);
      this.last = null;
    }
    this.showCursor();
    return true;
  }

  private showCursor(): void {
    this.pen.clear();
    this.pen.lineStyle(4, toHex(COLORS.grape), 1);
    this.pen.strokeCircle(this.cursor.x, this.cursor.y, this.cursor.down ? 8 : 14);
  }

  private flip(): void {
    if (!this.session.isHumanTurn()) return;
    if (!this.looking) {
      this.looking = true;
      cue('tap');
      this.draw();
      return;
    }
    cue('go');
    this.play('seen');
  }

  private pick(color: number): void {
    this.color = color;
    cue('tap');
    this.draw();
  }

  private clear(): void {
    this.ink.clear();
    cue('wall');
  }

  private ask(on: boolean): void {
    if (!this.session.isHumanTurn()) return;
    this.asking = on;
    cue('tap');
    this.draw();
  }

  private guessers(): number[] {
    const state = this.state;
    return Array.from({ length: state.players }, (_, s) => s).filter((s) => s !== state.currentSeat);
  }

  private guessed(seat: number): void {
    cue('win');
    this.burst();
    this.play(`g${seat}`);
  }

  private burst(): void {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const bit = this.add.circle(W / 2, PAD.y + PAD.h / 2, 10, toHex(PARTY_COLORS[i % PARTY_COLORS.length]!)).setDepth(6);
      this.tweens.add({ targets: bit, x: W / 2 + Math.cos(a) * 240, y: PAD.y + PAD.h / 2 + Math.sin(a) * 240, alpha: 0, duration: 520, ease: 'Cubic.easeOut', onComplete: () => bit.destroy() });
    }
  }

  private text(x: number, y: number, value: string, size: number, color: string, room = W - 60, bold = true): GameObjects.Text {
    const t = sharpText(this, x, y, value, size, color);
    if (bold) t.setFontStyle('bold');
    while (t.width > room && size > 14) {
      size -= 1;
      t.setFontSize(size);
    }
    this.view.add(t);
    return t;
  }

  private button(x: number, y: number, w: number, h: number, label: string, color: string, lip: string, act: () => void, size = 30): void {
    const g = this.add.graphics();
    g.fillStyle(toHex(lip), 1);
    g.fillRoundedRect(x - w / 2, y - h / 2 + 6, w, h, Math.min(34, h / 2.2));
    g.fillStyle(toHex(color), 1);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, Math.min(34, h / 2.2));
    this.view.add(g);
    this.text(x, y, label, size, '#FFFFFF', w - 20);
    this.hits.push({ x, y, w, h: h + 6, act });
  }

  private draw(): void {
    const state = this.state;
    this.view.removeAll(true);
    this.hits = [];
    this.clockText = null;
    this.ink.setVisible(state.phase === 'drawing');
    if (state.phase === 'ready') this.drawCover(state);
    else if (state.phase === 'drawing') this.drawPad(state);
    else this.drawOver(state);
  }

  private drawCover(state: DrawState): void {
    const seat = state.currentSeat;
    const color = PARTY_COLORS[seat % PARTY_COLORS.length]!;
    const mid = PAD.y + PAD.h / 2;
    const g = this.add.graphics();
    if (!this.looking) {
      this.text(W / 2, TOP_Y, `Pass the phone to ${this.name(seat)}`, 34, COLORS.ink);
      g.fillStyle(toHex(DARK.grape), 0.25);
      g.fillRoundedRect(PAD.x + 30, PAD.y + 10, PAD.w - 60, PAD.h, 40);
      g.fillStyle(toHex(color), 1);
      g.fillRoundedRect(PAD.x + 30, PAD.y, PAD.w - 60, PAD.h, 40);
      this.view.add(g);
      this.text(W / 2, mid - 60, `${this.name(seat)} draws`, 44, '#FFFFFF');
      this.text(W / 2, mid + 10, 'Only you look at the word!', 26, '#FFFFFF', W - 120, false);
      const last = state.lastWord;
      if (last) {
        const who = state.lastGuesser === null ? `Nobody got ${last}` : `${this.name(state.lastGuesser)} got ${last}`;
        this.text(W / 2, mid + 120, who, 26, '#FFFFFF', W - 120, false);
      }
      this.hits.push({ x: W / 2, y: mid, w: PAD.w - 60, h: PAD.h, act: () => this.flip() });
      this.button(W / 2, ACTION_Y, 360, ACTION_H, 'Tap to see the word', COLORS.grape, DARK.grape, () => this.flip());
      return;
    }
    this.text(W / 2, TOP_Y, `${this.name(seat)}, draw this`, 34, COLORS.ink);
    g.fillStyle(toHex(COLORS.line), 1);
    g.fillRoundedRect(PAD.x + 30, PAD.y + 10, PAD.w - 60, PAD.h, 40);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(PAD.x + 30, PAD.y, PAD.w - 60, PAD.h, 40);
    this.view.add(g);
    const word = this.text(W / 2, mid - 20, state.word.toUpperCase(), 72, COLORS.grape, PAD.w - 100);
    word.setScale(0.7);
    this.tweens.add({ targets: word, scale: 1, duration: 240, ease: 'Back.easeOut' });
    this.text(W / 2, mid + 80, 'No letters or numbers!', 24, COLORS.soft, W - 120, false);
    this.button(W / 2, ACTION_Y, 360, ACTION_H, 'Hide and draw', COLORS.mint, DARK.mint, () => this.flip());
  }

  private drawPad(state: DrawState): void {
    const seat = state.currentSeat;
    this.clockText = this.text(64, TOP_Y, `${this.lastSecond < 0 ? DRAW_SECONDS : this.lastSecond}`, 40, COLORS.ink, 110);
    this.text(W / 2 - 10, TOP_Y, this.peeking ? state.word : `${this.name(seat)} draws`, 28, this.peeking ? COLORS.grape : COLORS.ink, 280);
    // Hold to see the word again: it goes when you let go.
    const peek = this.add.graphics();
    peek.fillStyle(toHex(COLORS.line), 1);
    peek.fillRoundedRect(W - 140, TOP_Y - 26, 120, 52, 26);
    this.view.add(peek);
    this.text(W - 80, TOP_Y, 'Peek', 24, COLORS.soft, 100);
    this.hits.push({
      x: W - 80,
      y: TOP_Y,
      w: 120,
      h: 52,
      act: () => {
        this.peeking = true;
        this.draw();
      },
    });

    const g = this.add.graphics();
    g.fillStyle(toHex(COLORS.line), 1);
    g.fillRoundedRect(PAD.x, PAD.y + 8, PAD.w, PAD.h, 30);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(PAD.x, PAD.y, PAD.w, PAD.h, 30);
    g.lineStyle(4, toHex(PARTY_COLORS[seat % PARTY_COLORS.length]!), 1);
    g.strokeRoundedRect(PAD.x, PAD.y, PAD.w, PAD.h, 30);
    this.view.add(g);

    if (this.asking) {
      this.drawWho();
      return;
    }
    INKS.forEach((ink, i) => {
      const x = 70 + i * 82;
      const on = i === this.color;
      const dot = this.add.graphics();
      dot.fillStyle(toHex(ink), 1);
      dot.fillCircle(x, TOOLS_Y, on ? 28 : 22);
      if (on) {
        dot.lineStyle(5, 0xffffff, 1);
        dot.strokeCircle(x, TOOLS_Y, 20);
      }
      this.view.add(dot);
      this.hits.push({ x, y: TOOLS_Y, w: 64, h: 64, act: () => this.pick(i) });
    });
    this.button(W - 78, TOOLS_Y, 120, 56, 'Clear', COLORS.soft, COLORS.ink, () => this.clear(), 24);
    this.button(W / 2, ACTION_Y, 400, ACTION_H, 'Got it! Who called it?', COLORS.tomato, DARK.tomato, () => this.ask(true), 28);
  }

  /** Who called it: every face but the drawer's, in one or two rows under the card. */
  private drawWho(): void {
    const guessers = this.guessers();
    const cols = Math.min(guessers.length, 4);
    const cellW = (W - 40) / cols;
    const rows = Math.ceil(guessers.length / cols);
    const cellH = rows > 1 ? 66 : 90;
    const first = rows > 1 ? 705 : 715;
    guessers.forEach((seat, i) => {
      const x = 20 + (i % cols) * cellW + cellW / 2;
      const y = first + Math.floor(i / cols) * cellH;
      this.button(x, y, cellW - 12, cellH - 14, this.name(seat), PARTY_COLORS[seat % PARTY_COLORS.length]!, PARTY_DARK[seat % PARTY_DARK.length]!, () => this.guessed(seat), 22);
    });
    this.button(W / 2, rows > 1 ? 840 : 815, 240, rows > 1 ? 48 : 52, 'Not yet', COLORS.soft, COLORS.ink, () => this.ask(false), 24);
  }

  private drawOver(state: DrawState): void {
    this.text(W / 2, TOP_Y, 'Pens down!', 38, COLORS.ink);
    const order = state.scores.map((score, seat) => ({ score, seat })).sort((a, b) => b.score - a.score || a.seat - b.seat);
    const rowH = Math.min(64, PAD.h / order.length);
    order.forEach(({ score, seat }, i) => {
      const y = PAD.y + i * rowH + rowH / 2;
      const g = this.add.graphics();
      g.fillStyle(toHex(PARTY_COLORS[seat % PARTY_COLORS.length]!), 1);
      g.fillCircle(110, y, rowH / 2.6);
      this.view.add(g);
      this.text(150, y, this.name(seat), 28, COLORS.ink, 260).setOrigin(0, 0.5);
      this.text(W - 100, y, `${score}`, 32, COLORS.grape, 100);
    });
  }

  /** The bands every step keeps to, for the layout check. */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    const drawing = this.state.phase === 'drawing';
    const top = [
      { name: 'top', top: TOP_Y - 26, bottom: TOP_Y + 26 },
      { name: 'pad', top: PAD.y, bottom: PAD.y + PAD.h + 10 },
    ];
    if (drawing && this.asking) return [...top, { name: 'who', top: 672, bottom: 870 }];
    return [
      ...top,
      ...(drawing ? [{ name: 'tools', top: TOOLS_Y - 32, bottom: TOOLS_Y + 34 }] : []),
      { name: 'action', top: ACTION_Y - ACTION_H / 2, bottom: ACTION_Y + ACTION_H / 2 + 6 },
    ];
  }
}

export function drawStatus(state: DrawState, names: readonly string[]): string | undefined {
  const name = names[state.currentSeat] ?? `Player ${state.currentSeat + 1}`;
  if (state.phase === 'ready') return `${name} draws next`;
  if (state.phase === 'drawing') return `${name} is drawing. Shout your guesses!`;
  return undefined;
}

export function drawResult(state: DrawState, names: readonly string[]): string | undefined {
  if (!state.result) return undefined;
  if (state.result.draw) return `All level on ${state.scores[0]}`;
  const best = state.scores[state.result.winners[0]!]!;
  const who = state.result.winners.map((seat) => names[seat] ?? `Player ${seat + 1}`).join(' and ');
  return `${who} ${state.result.winners.length > 1 ? 'share it' : 'wins'} with ${best} ${best === 1 ? 'point' : 'points'}`;
}
