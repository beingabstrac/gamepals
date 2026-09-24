import { TOD_GOES, type TodMove, type TodState } from '@gamepals/rules';
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
export const TOD_CANVAS = { width: W, height: H };
export const TOD_COLORS = PARTY_COLORS;

const TITLE_Y = 60;
const MID = 380;
const BUTTON_Y = 720;

/**
 * Truth or Dare. The rules deal the cards and count what gets done; the scene hands the phone to
 * whoever is up, offers Truth or Dare as two big buttons, flips the card over, and asks Done or
 * Pass. Every card is our own and family-safe.
 */
export class TodScene extends Scene {
  private view!: GameObjects.Container;
  private hits: { x: number; y: number; w: number; h: number; act: () => void }[] = [];
  private shown = '';

  constructor(private readonly session: Session<TodMove>) {
    super('truth-or-dare');
  }

  private get state(): TodState {
    return this.session.state as TodState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.view = this.add.container(0, 0);
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      this.hits.find((h) => Math.abs(p.worldX - h.x) <= h.w / 2 && Math.abs(p.worldY - h.y) <= h.h / 2)?.act();
    });
    onKeys(this, (key) => this.key(key));
    const off = this.session.subscribe(() => this.draw());
    this.events.once('shutdown', off);
    this.draw();
  }

  private name(seat: number): string {
    return this.session.seats[seat]?.label ?? `Player ${seat + 1}`;
  }

  private play(move: TodMove): void {
    if (!this.session.isHumanTurn() || this.state.result) return;
    cue(move === 'done' ? 'win' : move === 'pass' ? 'wall' : 'roll');
    this.session.play(move);
  }

  private key(key: string): boolean {
    const phase = this.state.phase;
    const move: TodMove | null =
      phase === 'choose' && (key === 't' || key === 'T' || key === '1')
        ? 'truth'
        : phase === 'choose' && (key === 'd' || key === 'D' || key === '2')
          ? 'dare'
          : phase === 'card' && (key === 'Enter' || key === ' ')
            ? 'done'
            : phase === 'card' && (key === 'p' || key === 'P' || key === 'Escape')
              ? 'pass'
              : null;
    if (!move) return false;
    this.play(move);
    return true;
  }

  private text(x: number, y: number, value: string, size: number, color: string, room = W - 60, bold = true): GameObjects.Text {
    const t = sharpText(this, x, y, value, size, color).setAlign('center');
    if (bold) t.setFontStyle('bold');
    t.setWordWrapWidth(room, true);
    this.view.add(t);
    return t;
  }

  private button(x: number, y: number, w: number, h: number, label: string, color: string, lip: string, act: () => void, size = 32): void {
    const g = this.add.graphics();
    g.fillStyle(toHex(lip), 1);
    g.fillRoundedRect(x - w / 2, y - h / 2 + 7, w, h, 34);
    g.fillStyle(toHex(color), 1);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 34);
    this.view.add(g);
    this.text(x, y, label, size, inkOn(color), w - 30);
    this.hits.push({ x, y, w, h, act });
  }

  private draw(): void {
    const state = this.state;
    const key = `${state.phase}.${state.go}`;
    const fresh = key !== this.shown;
    this.shown = key;
    this.view.removeAll(true);
    this.hits = [];
    const seat = state.currentSeat;
    const round = Math.floor(state.go / state.players) + 1;
    if (state.phase === 'choose') {
      this.text(W / 2, TITLE_Y, `${this.name(seat)}, your go`, 34, COLORS.ink);
      this.text(W / 2, TITLE_Y + 44, `Round ${round} of ${TOD_GOES}`, 22, COLORS.soft, W - 60, false);
      this.button(W / 2, 290, W - 120, 200, 'Truth', COLORS.sky, DARK.sky, () => this.play('truth'), 54);
      this.text(W / 2, 430, 'or', 30, COLORS.soft);
      this.button(W / 2, 570, W - 120, 200, 'Dare', COLORS.tomato, DARK.tomato, () => this.play('dare'), 54);
    } else if (state.phase === 'card') {
      const truth = state.card?.[0] === 'truth';
      const color = truth ? COLORS.sky : COLORS.tomato;
      this.text(W / 2, TITLE_Y, `${this.name(seat)}: ${truth ? 'Truth' : 'Dare'}`, 34, COLORS.ink);
      const g = this.add.graphics();
      g.fillStyle(toHex(truth ? DARK.sky : DARK.tomato), 1);
      g.fillRoundedRect(50, 150 + 10, W - 100, 460, 40);
      g.fillStyle(toHex(color), 1);
      g.fillRoundedRect(50, 150, W - 100, 460, 40);
      this.view.add(g);
      this.text(W / 2, MID, state.text ?? '', 34, '#FFFFFF', W - 160);
      this.button(W / 2 - 130, BUTTON_Y, 230, 84, 'Done!', COLORS.mint, DARK.mint, () => this.play('done'));
      this.button(W / 2 + 130, BUTTON_Y, 230, 84, 'Pass', COLORS.soft, COLORS.ink, () => this.play('pass'));
    } else {
      this.text(W / 2, TITLE_Y, 'Who was bravest?', 34, COLORS.ink);
      const order = state.scores.map((score, s) => ({ score, s })).sort((a, b) => b.score - a.score || a.s - b.s);
      const rowH = Math.min(70, 560 / order.length);
      order.forEach(({ score, s }, i) => {
        const y = 160 + i * rowH;
        const dot = this.add.graphics();
        dot.fillStyle(toHex(PARTY_DARK[s % 8]!), 1);
        dot.fillCircle(120, y + 3, rowH / 3);
        dot.fillStyle(toHex(PARTY_COLORS[s % 8]!), 1);
        dot.fillCircle(120, y, rowH / 3);
        this.view.add(dot);
        this.text(W / 2, y, this.name(s), 28, COLORS.ink);
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
      { name: 'title', top: TITLE_Y - 24, bottom: TITLE_Y + 60 },
      { name: 'card', top: 150, bottom: 670 },
      { name: 'buttons', top: BUTTON_Y - 42, bottom: BUTTON_Y + 49 },
    ];
  }
}

export function todStatus(state: TodState, names: readonly string[]): string | undefined {
  if (state.result) return undefined;
  const name = names[state.currentSeat] ?? `Player ${state.currentSeat + 1}`;
  return state.phase === 'choose' ? `${name}: truth or dare?` : `${name} answers`;
}

export function todResult(state: TodState, names: readonly string[]): string | undefined {
  if (!state.result) return undefined;
  if (state.result.draw) return 'All just as brave!';
  const who = state.result.winners.map((s) => names[s] ?? `Player ${s + 1}`).join(' and ');
  return `${who} did the most`;
}
