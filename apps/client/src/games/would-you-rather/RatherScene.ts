import { RATHER_ROUNDS, type RatherMove, type RatherState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { onKeys } from '../keys';
import { inkOn, PARTY_COLORS, PARTY_DARK } from '../party';

const W = 600;
const H = 820;
export const RATHER_CANVAS = { width: W, height: H };
export const RATHER_COLORS = PARTY_COLORS;

const TITLE_Y = 60;
const CARD_A = { y: 250, h: 190 };
const CARD_B = { y: 520, h: 190 };
const BUTTON_Y = 730;

/**
 * Would You Rather. The rules deal the questions and keep the score; the scene passes the phone:
 * a cover says whose turn it is, a tap shows the two choices as big cards, and a tap on one hides
 * it for the next person. Once everyone has picked, the split: who went which way, and a point
 * each for the side most of the table took.
 */
export class RatherScene extends Scene {
  private view!: GameObjects.Container;
  private hits: { x: number; y: number; w: number; h: number; act: () => void }[] = [];
  private looking = false;
  private shown = '';

  constructor(private readonly session: Session<RatherMove>) {
    super('would-you-rather');
  }

  private get state(): RatherState {
    return this.session.state as RatherState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.view = this.add.container(0, 0);
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      this.hits.find((h) => Math.abs(p.worldX - h.x) <= h.w / 2 && Math.abs(p.worldY - h.y) <= h.h / 2)?.act();
    });
    onKeys(this, (key) => this.key(key));
    const off = this.session.subscribe(() => {
      this.looking = false;
      this.draw();
    });
    this.events.once('shutdown', off);
    this.draw();
  }

  private name(seat: number): string {
    return this.session.seats[seat]?.label ?? `Player ${seat + 1}`;
  }

  private play(move: RatherMove): void {
    if (!this.session.isHumanTurn() || this.state.result) return;
    cue(move === 'seen' ? 'tap' : 'place');
    this.session.play(move);
  }

  private key(key: string): boolean {
    const state = this.state;
    if (state.phase === 'pick' && !this.looking && (key === 'Enter' || key === ' ')) {
      this.look();
      return true;
    }
    if (state.phase === 'pick' && this.looking && (key === '1' || key === 'a' || key === 'ArrowUp')) {
      this.play('a');
      return true;
    }
    if (state.phase === 'pick' && this.looking && (key === '2' || key === 'b' || key === 'ArrowDown')) {
      this.play('b');
      return true;
    }
    if (state.phase === 'reveal' && (key === 'Enter' || key === ' ')) {
      this.play('seen');
      return true;
    }
    return false;
  }

  private look(): void {
    if (!this.session.isHumanTurn()) return;
    this.looking = true;
    cue('tap');
    this.draw();
  }

  private text(x: number, y: number, value: string, size: number, color: string, room = W - 60, bold = true): GameObjects.Text {
    const t = sharpText(this, x, y, value, size, color).setAlign('center');
    if (bold) t.setFontStyle('bold');
    t.setWordWrapWidth(room, true);
    this.view.add(t);
    return t;
  }

  private card(y: number, h: number, color: string, lip: string, label: string, act: (() => void) | null): void {
    const g = this.add.graphics();
    g.fillStyle(toHex(lip), 1);
    g.fillRoundedRect(40, y - h / 2 + 8, W - 80, h, 34);
    g.fillStyle(toHex(color), 1);
    g.fillRoundedRect(40, y - h / 2, W - 80, h, 34);
    this.view.add(g);
    this.text(W / 2, y, label, 34, inkOn(color), W - 140);
    if (act) this.hits.push({ x: W / 2, y, w: W - 80, h, act });
  }

  private button(label: string, color: string, lip: string, act: () => void): void {
    const g = this.add.graphics();
    g.fillStyle(toHex(lip), 1);
    g.fillRoundedRect(W / 2 - 170, BUTTON_Y - 38 + 6, 340, 76, 34);
    g.fillStyle(toHex(color), 1);
    g.fillRoundedRect(W / 2 - 170, BUTTON_Y - 38, 340, 76, 34);
    this.view.add(g);
    this.text(W / 2, BUTTON_Y, label, 30, '#FFFFFF', 300);
    this.hits.push({ x: W / 2, y: BUTTON_Y, w: 340, h: 76, act });
  }

  private face(x: number, y: number, r: number, seat: number): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(x, y, r + 4);
    g.fillStyle(toHex(PARTY_DARK[seat % 8]!), 1);
    g.fillCircle(x, y + r * 0.1, r);
    g.fillStyle(toHex(PARTY_COLORS[seat % 8]!), 1);
    g.fillCircle(x, y, r);
    g.fillStyle(toHex(COLORS.ink), 1);
    g.fillCircle(x - r * 0.3, y - r * 0.08, r * 0.1);
    g.fillCircle(x + r * 0.3, y - r * 0.08, r * 0.1);
    g.fillEllipse(x, y + r * 0.28, r * 0.42, r * 0.2);
    this.view.add(g);
  }

  private draw(): void {
    const state = this.state;
    const key = `${state.phase}.${state.round}.${state.turn}.${this.looking}`;
    const fresh = key !== this.shown;
    this.shown = key;
    this.view.removeAll(true);
    this.hits = [];
    const [a, b] = state.question;
    if (state.phase === 'pick' && !this.looking) {
      const seat = state.turn;
      this.text(W / 2, TITLE_Y, `Pass the phone to ${this.name(seat)}`, 34, COLORS.ink);
      const color = PARTY_COLORS[seat % 8]!;
      const g = this.add.graphics();
      g.fillStyle(toHex(PARTY_DARK[seat % 8]!), 1);
      g.fillRoundedRect(60, 160 + 8, W - 120, 440, 40);
      g.fillStyle(toHex(color), 1);
      g.fillRoundedRect(60, 160, W - 120, 440, 40);
      this.view.add(g);
      this.face(W / 2, 320, 64, seat);
      this.text(W / 2, 440, this.name(seat), 40, inkOn(color));
      this.text(W / 2, 500, `Question ${state.round + 1} of ${RATHER_ROUNDS}. Pick in secret!`, 22, inkOn(color), W - 160, false);
      this.hits.push({ x: W / 2, y: 380, w: W - 120, h: 440, act: () => this.look() });
      this.button('Tap to see it', COLORS.grape, DARK.grape, () => this.look());
    } else if (state.phase === 'pick') {
      this.text(W / 2, TITLE_Y, `${this.name(state.turn)}, would you rather...`, 30, COLORS.ink);
      this.card(CARD_A.y, CARD_A.h, COLORS.sky, DARK.sky, a, () => this.play('a'));
      this.text(W / 2, (CARD_A.y + CARD_B.y) / 2, 'or', 30, COLORS.soft);
      this.card(CARD_B.y, CARD_B.h, COLORS.tomato, DARK.tomato, b, () => this.play('b'));
    } else if (state.phase === 'reveal') {
      this.text(W / 2, TITLE_Y, 'Would you rather...', 30, COLORS.ink);
      const sides = [0, 1].map((side) => state.picks.flatMap((p, seat) => (p === side ? [seat] : [])));
      const more = sides[0]!.length === sides[1]!.length ? -1 : sides[0]!.length > sides[1]!.length ? 0 : 1;
      [CARD_A, CARD_B].forEach((c, side) => {
        const color = side === 0 ? COLORS.sky : COLORS.tomato;
        this.card(c.y - 20, c.h - 40, color, side === 0 ? DARK.sky : DARK.tomato, side === 0 ? a : b, null);
        const who = sides[side]!;
        const r = 20;
        who.forEach((seat, k) => this.face(W / 2 + (k - (who.length - 1) / 2) * (r * 2 + 10), c.y + c.h / 2 - 22, r, seat));
        if (side === more) this.text(W - 80, c.y - c.h / 2 + 6, '+1', 28, COLORS.mint);
      });
      this.text(W / 2, (CARD_A.y + CARD_B.y) / 2, more === -1 ? 'A dead heat!' : 'or', 26, COLORS.soft);
      this.button(state.round + 1 >= RATHER_ROUNDS ? 'See who won' : 'Next question', COLORS.mint, DARK.mint, () => this.play('seen'));
    } else {
      this.text(W / 2, TITLE_Y, 'Most in tune with the table', 30, COLORS.ink);
      const order = state.scores.map((score, seat) => ({ score, seat })).sort((x, y) => y.score - x.score || x.seat - y.seat);
      const rowH = Math.min(70, 560 / order.length);
      order.forEach(({ score, seat }, i) => {
        const y = 150 + i * rowH;
        this.face(120, y, rowH / 2.8, seat);
        this.text(W / 2, y, this.name(seat), 28, COLORS.ink).setOrigin(0.5, 0.5);
        this.text(W - 100, y, `${score}`, 32, COLORS.grape);
      });
    }
    if (fresh) {
      this.view.setScale(0.95).setAlpha(0.6).setPosition(W * 0.025, H * 0.025);
      this.tweens.killTweensOf(this.view);
      this.tweens.add({ targets: this.view, scale: 1, x: 0, y: 0, alpha: 1, duration: 240, ease: 'Back.easeOut' });
    }
  }

  /** The bands every step keeps to, for the layout check. */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    return [
      { name: 'title', top: TITLE_Y - 24, bottom: TITLE_Y + 24 },
      { name: 'cards', top: CARD_A.y - CARD_A.h / 2, bottom: CARD_B.y + CARD_B.h / 2 + 8 },
      { name: 'button', top: BUTTON_Y - 38, bottom: BUTTON_Y + 44 },
    ];
  }
}

export function ratherStatus(state: RatherState, names: readonly string[]): string | undefined {
  if (state.result) return undefined;
  const name = names[state.turn] ?? `Player ${state.turn + 1}`;
  if (state.phase === 'pick') return `Question ${state.round + 1} of ${RATHER_ROUNDS}: ${name} picks`;
  return `Question ${state.round + 1} of ${RATHER_ROUNDS}: the split`;
}

export function ratherResult(state: RatherState, names: readonly string[]): string | undefined {
  if (!state.result) return undefined;
  if (state.result.draw) return 'All level: you think alike!';
  const who = state.result.winners.map((s) => names[s] ?? `Player ${s + 1}`).join(' and ');
  return `${who} ${state.result.winners.length > 1 ? 'were' : 'was'} most in tune with the table`;
}
