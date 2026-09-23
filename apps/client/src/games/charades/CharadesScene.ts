import { CHARADE_SECONDS, type CharadesMove, type CharadesState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { onKeys } from '../keys';
import { PARTY_COLORS } from '../party';

/** Wide, because the phone goes on a forehead sideways. */
const W = 900;
const H = 620;
export const CHARADES_SIZE = { width: W, height: H };
export const CHARADES_COLORS = PARTY_COLORS;

const TOP_Y = 56;
const WORD_Y = 250;
const PADS_TOP = 410;
const PADS_BOTTOM = 600;
const COUNT_IN = 3;

/**
 * Charades. The rules deal the words and keep the score; the scene keeps the minute. A cover says
 * whose go it is, a tap counts three while they lift the phone, then one huge word and two big halves
 * for the table to tap: Pass on the left, Got it on the right. When the minute is up it plays `end`.
 */
export class CharadesScene extends Scene {
  private view!: GameObjects.Container;
  private flash!: GameObjects.Rectangle;
  private clockText: GameObjects.Text | null = null;
  private countText: GameObjects.Text | null = null;
  /** Scene time when the words start showing, and when the minute ends; null outside a go. */
  private wordsAt: number | null = null;
  private endsAt: number | null = null;
  private lastSecond = -1;
  private shown = '';

  constructor(private readonly session: Session<CharadesMove>) {
    super('charades');
  }

  private get state(): CharadesState {
    return this.session.state as CharadesState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0).setDepth(0);
    this.view = this.add.container(0, 0).setDepth(1);
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.press(p.worldX, p.worldY));
    onKeys(this, (key) => this.key(key));
    const off = this.session.subscribe(() => this.changed());
    this.events.once('shutdown', off);
    this.changed();
  }

  private changed(): void {
    const state = this.state;
    const key = `${state.phase}.${state.go}`;
    if (key !== this.shown && state.phase === 'playing') {
      this.wordsAt = this.time.now + COUNT_IN * 1000;
      this.endsAt = this.wordsAt + CHARADE_SECONDS * 1000;
      this.lastSecond = -1;
    }
    if (state.phase !== 'playing') {
      this.wordsAt = null;
      this.endsAt = null;
    }
    this.shown = key;
    this.draw();
  }

  update(time: number): void {
    if (this.wordsAt === null || this.endsAt === null) return;
    if (time < this.wordsAt) {
      const n = Math.ceil((this.wordsAt - time) / 1000);
      if (this.countText && this.countText.text !== String(n)) {
        this.countText.setText(String(n)).setScale(1.3);
        this.tweens.add({ targets: this.countText, scale: 1, duration: 220, ease: 'Back.easeOut' });
        cue('tap');
      }
      return;
    }
    if (this.countText) this.draw();
    const left = Math.max(0, Math.ceil((this.endsAt - time) / 1000));
    if (left !== this.lastSecond) {
      this.lastSecond = left;
      this.clockText?.setText(String(left)).setColor(left <= 10 ? COLORS.tomato : COLORS.ink);
      if (left <= 10 && left > 0) {
        cue('tap');
        if (this.clockText) this.tweens.add({ targets: this.clockText, scale: { from: 1.25, to: 1 }, duration: 200, ease: 'Back.easeOut' });
      }
    }
    if (time >= this.endsAt) {
      this.endsAt = null;
      cue('buzz');
      this.play('end');
    }
  }

  private get counting(): boolean {
    return this.wordsAt !== null && this.time.now < this.wordsAt;
  }

  private key(key: string): boolean {
    const state = this.state;
    if (state.phase === 'ready' && (key === ' ' || key === 'Enter')) {
      this.play('start');
      return true;
    }
    if (state.phase !== 'playing' || this.counting) return false;
    if (key === 'ArrowRight' || key === 'Enter') {
      this.answer('got');
      return true;
    }
    if (key === 'ArrowLeft' || key === 'Backspace') {
      this.answer('pass');
      return true;
    }
    return false;
  }

  private press(x: number, y: number): void {
    const state = this.state;
    if (state.phase === 'ready') {
      if (y > H * 0.2) this.play('start');
      return;
    }
    if (state.phase !== 'playing' || this.counting || y < TOP_Y + 40) return;
    this.answer(x < W / 2 ? 'pass' : 'got');
  }

  private answer(move: 'got' | 'pass'): void {
    if (!this.session.isHumanTurn()) return;
    const color = move === 'got' ? COLORS.mint : COLORS.peach;
    this.flash.setFillStyle(toHex(color), 0.35);
    this.tweens.killTweensOf(this.flash);
    this.tweens.add({ targets: this.flash, fillAlpha: 0, duration: 380 });
    cue(move === 'got' ? 'win' : 'wall');
    this.play(move);
  }

  private play(move: CharadesMove): void {
    if (this.state.result || !this.session.isHumanTurn()) return;
    if (move === 'start') cue('go');
    this.session.play(move);
  }

  private name(seat: number): string {
    return this.session.seats[seat]?.label ?? `Player ${seat + 1}`;
  }

  private draw(): void {
    const state = this.state;
    this.view.removeAll(true);
    this.clockText = null;
    this.countText = null;
    if (state.phase === 'ready') this.drawReady(state);
    else if (state.phase === 'playing' && this.counting) this.drawCount(state);
    else if (state.phase === 'playing') this.drawWord(state);
    else this.drawOver(state);
  }

  private text(x: number, y: number, value: string, size: number, color: string, room = W - 80, bold = false): GameObjects.Text {
    const t = sharpText(this, x, y, value, size, color);
    if (bold) t.setFontStyle('bold');
    while (t.width > room && size > 14) {
      size -= 2;
      t.setFontSize(size);
    }
    this.view.add(t);
    return t;
  }

  private drawReady(state: CharadesState): void {
    const seat = state.currentSeat;
    const color = PARTY_COLORS[seat % PARTY_COLORS.length]!;
    this.text(W / 2, TOP_Y, `Pass the phone to ${this.name(seat)}`, 36, COLORS.ink, W - 80, true);
    const g = this.add.graphics();
    g.fillStyle(toHex(DARK.grape), 0.25);
    g.fillRoundedRect(60, 118, W - 120, 300, 44);
    g.fillStyle(toHex(color), 1);
    g.fillRoundedRect(60, 110, W - 120, 300, 44);
    this.view.add(g);
    this.text(W / 2, 190, 'Hold the phone on your forehead,', 32, '#FFFFFF', W - 180, true);
    this.text(W / 2, 236, 'screen out. Everyone else gives clues.', 32, '#FFFFFF', W - 180, true);
    this.text(W / 2, 320, "Don't say the word!", 26, '#FFFFFF');
    const last = this.lastGo(state);
    if (last) this.text(W / 2, 460, last, 26, COLORS.soft);
    const b = this.add.graphics();
    b.fillStyle(toHex(DARK.mint), 1);
    b.fillRoundedRect(W / 2 - 170, 520 + 6, 340, 76, 34);
    b.fillStyle(toHex(COLORS.mint), 1);
    b.fillRoundedRect(W / 2 - 170, 520, 340, 76, 34);
    this.view.add(b);
    this.text(W / 2, 558, 'Tap to start', 32, '#FFFFFF', 300, true);
  }

  /** How the go before went, said on the next cover so the table hears it. */
  private lastGo(state: CharadesState): string | null {
    if (state.go === 0) return null;
    const seat = (state.go - 1) % state.players;
    const got = state.thisGo.filter(Boolean).length;
    const passed = state.thisGo.length - got;
    return `${this.name(seat)} got ${got} and passed ${passed}`;
  }

  private drawCount(state: CharadesState): void {
    this.text(W / 2, TOP_Y, `${this.name(state.currentSeat)}, phone up!`, 34, COLORS.ink, W - 80, true);
    this.countText = this.text(W / 2, WORD_Y + 60, String(COUNT_IN), 160, COLORS.grape, W, true);
  }

  private drawWord(state: CharadesState): void {
    this.clockText = this.text(120, TOP_Y, String(this.lastSecond < 0 ? CHARADE_SECONDS : this.lastSecond), 44, COLORS.ink, 200, true);
    this.text(W - 120, TOP_Y, `Got ${state.scores[state.currentSeat]}`, 34, COLORS.mint, 200, true);
    const word = this.text(W / 2, WORD_Y, state.word.toUpperCase(), 110, COLORS.ink, W - 60, true);
    word.setScale(0.8);
    this.tweens.add({ targets: word, scale: 1, duration: 200, ease: 'Back.easeOut' });
    const g = this.add.graphics();
    const h = PADS_BOTTOM - PADS_TOP;
    g.fillStyle(toHex(DARK.peach), 1);
    g.fillRoundedRect(20, PADS_TOP + 8, W / 2 - 30, h - 8, 36);
    g.fillStyle(toHex(COLORS.peach), 1);
    g.fillRoundedRect(20, PADS_TOP, W / 2 - 30, h - 8, 36);
    g.fillStyle(toHex(DARK.mint), 1);
    g.fillRoundedRect(W / 2 + 10, PADS_TOP + 8, W / 2 - 30, h - 8, 36);
    g.fillStyle(toHex(COLORS.mint), 1);
    g.fillRoundedRect(W / 2 + 10, PADS_TOP, W / 2 - 30, h - 8, 36);
    this.view.add(g);
    this.text(W / 4 + 5, PADS_TOP + h / 2 - 4, 'PASS', 52, '#FFFFFF', W / 2 - 60, true);
    this.text((W * 3) / 4 - 5, PADS_TOP + h / 2 - 4, 'GOT IT', 52, '#FFFFFF', W / 2 - 60, true);
  }

  private drawOver(state: CharadesState): void {
    this.text(W / 2, TOP_Y, 'Time! Here is how it went', 36, COLORS.ink, W - 80, true);
    const order = state.scores.map((score, seat) => ({ score, seat })).sort((a, b) => b.score - a.score || a.seat - b.seat);
    const rowH = Math.min(58, (H - 140) / order.length);
    order.forEach(({ score, seat }, i) => {
      const y = 140 + i * rowH + rowH / 2;
      const g = this.add.graphics();
      g.fillStyle(toHex(PARTY_COLORS[seat % PARTY_COLORS.length]!), 1);
      g.fillCircle(W / 2 - 200, y, rowH / 2.6);
      this.view.add(g);
      this.text(W / 2 - 160, y, this.name(seat), Math.min(30, rowH / 1.8), COLORS.ink, 260, true).setOrigin(0, 0.5);
      this.text(W / 2 + 200, y, `${score}`, Math.min(34, rowH / 1.6), COLORS.grape, 120, true);
    });
  }

  /** The three bands a go keeps to, for the layout check. */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    if (this.state.phase !== 'playing' || this.counting) {
      return [
        { name: 'title', top: TOP_Y - 22, bottom: TOP_Y + 22 },
        { name: 'middle', top: 110, bottom: 418 },
        { name: 'bottom', top: 440, bottom: 602 },
      ];
    }
    return [
      { name: 'clock', top: TOP_Y - 24, bottom: TOP_Y + 24 },
      { name: 'word', top: WORD_Y - 60, bottom: WORD_Y + 60 },
      { name: 'pads', top: PADS_TOP, bottom: PADS_BOTTOM },
    ];
  }
}

export function charadesStatus(state: CharadesState, names: readonly string[]): string | undefined {
  const name = names[state.currentSeat] ?? `Player ${state.currentSeat + 1}`;
  if (state.phase === 'ready') return `${name} is up next`;
  if (state.phase === 'playing') return `${name} is guessing`;
  return undefined;
}

export function charadesResult(state: CharadesState, names: readonly string[]): string | undefined {
  if (!state.result) return undefined;
  if (state.result.draw) return `All level on ${state.scores[0]} words`;
  const best = state.scores[state.result.winners[0]!]!;
  const who = state.result.winners.map((seat) => names[seat] ?? `Player ${seat + 1}`).join(' and ');
  return `${who} ${state.result.winners.length > 1 ? 'share it' : 'wins'} with ${best} ${best === 1 ? 'word' : 'words'}`;
}
