import { SB_BUTTONS, SB_DIAL_MAX, SB_DIALS, SB_SLIDER_MAX, SB_SLIDERS, SB_TOGGLES, type SwitchMove, type SwitchState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { onKeys } from '../keys';

const W = 600;
const H = 920;
export const SWITCH_CANVAS = { width: W, height: H };
export const SWITCH_COLORS = [COLORS.sunny];

const LAMP_Y = 64;
const TOGGLE_Y = 180;
const SLIDER_Y = [300, 370, 440];
const SLIDER_X = [110, 490];
const DIAL_Y = 560;
const DIAL_X = [170, 430];
const DIAL_R = 66;
const BUTTON_Y = 752;
const BUTTON_X = [80, 190, 300, 410];
const LEVER = { x: 525, y: 752 };
const DONE_Y = 880;
const CANDY = [COLORS.tomato, COLORS.peach, COLORS.sunny, COLORS.mint, COLORS.sky, COLORS.grape, COLORS.bubblegum];
const CANDY_DARK = [DARK.tomato, DARK.peach, DARK.sunny, DARK.mint, DARK.sky, DARK.grape, DARK.bubblegum];
const toggleX = (i: number) => 120 + i * 120;
/** A dial's pointer angle for a setting: from straight down-left round to down-right. */
const dialAngle = (v: number) => Math.PI * 0.75 + (v / SB_DIAL_MAX) * Math.PI * 1.5;

/**
 * Switch Board. The rules keep every control's setting; the scene draws them as chunky candy
 * hardware (toggles that flip, sliders that notch, dials that click round, buttons that sink,
 * a lever that clunks) with a lamp for each along the top, and turns the lamps rainbow when
 * everything is on.
 */
export class SwitchScene extends Scene {
  private g!: GameObjects.Graphics;
  private doneText!: GameObjects.Text;
  /** What a finger is holding: a slider or dial being turned. */
  private holding: { kind: 's' | 'd'; i: number } | null = null;
  private sunk: number | null = null;
  private time0 = 0;

  constructor(private readonly session: Session<SwitchMove>) {
    super('switch-board');
  }

  private get state(): SwitchState {
    return this.session.state as SwitchState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.g = this.add.graphics();
    this.doneText = sharpText(this, W / 2, DONE_Y, 'Done', 26, '#FFFFFF').setFontStyle('bold').setDepth(2);
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.down(p.worldX, p.worldY));
    this.input.on('pointermove', (p: { worldX: number; worldY: number; isDown: boolean }) => p.isDown && this.turn(p.worldX, p.worldY));
    this.input.on('pointerup', () => {
      this.holding = null;
      this.sunk = null;
    });
    onKeys(this, (key) => this.key(key));
    const off = this.session.subscribe(() => this.changed());
    this.events.once('shutdown', off);
  }

  update(time: number): void {
    this.time0 = time;
    this.draw();
  }

  private play(move: SwitchMove): void {
    if (!this.session.isHumanTurn() || this.state.result) return;
    if (!this.state.legalMoves(0).includes(move)) return;
    this.session.play(move);
  }

  private down(x: number, y: number): void {
    if (Math.abs(y - DONE_Y) < 30 && Math.abs(x - W / 2) < 110) return this.play('done');
    for (let i = 0; i < SB_TOGGLES; i++) if (Math.abs(x - toggleX(i)) < 45 && Math.abs(y - TOGGLE_Y) < 60) return this.play(`t${i}`);
    for (let i = 0; i < SB_SLIDERS; i++)
      if (Math.abs(y - SLIDER_Y[i]!) < 30 && x > SLIDER_X[0]! - 30 && x < SLIDER_X[1]! + 30) {
        this.holding = { kind: 's', i };
        return this.turn(x, y);
      }
    for (let i = 0; i < SB_DIALS; i++)
      if (Math.hypot(x - DIAL_X[i]!, y - DIAL_Y) < DIAL_R + 20) {
        this.holding = { kind: 'd', i };
        return this.turn(x, y);
      }
    for (let i = 0; i < SB_BUTTONS; i++)
      if (Math.hypot(x - BUTTON_X[i]!, y - BUTTON_Y) < 46) {
        this.sunk = i;
        return this.play(`b${i}`);
      }
    if (Math.abs(x - LEVER.x) < 50 && Math.abs(y - LEVER.y) < 90) this.play('lever');
  }

  /** A held slider or dial follows the finger, notch by notch. */
  private turn(x: number, y: number): void {
    const h = this.holding;
    if (!h) return;
    if (h.kind === 's') {
      const v = Math.round(((x - SLIDER_X[0]!) / (SLIDER_X[1]! - SLIDER_X[0]!)) * SB_SLIDER_MAX);
      const value = Math.max(0, Math.min(SB_SLIDER_MAX, v));
      if (value !== this.state.board.sliders[h.i]) this.play(`s${h.i}.${value}`);
    } else {
      let a = Math.atan2(y - DIAL_Y, x - DIAL_X[h.i]!);
      if (a < Math.PI * 0.5) a += Math.PI * 2;
      const v = Math.round(((a - Math.PI * 0.75) / (Math.PI * 1.5)) * SB_DIAL_MAX);
      const value = Math.max(0, Math.min(SB_DIAL_MAX, v));
      if (value !== this.state.board.dials[h.i]) this.play(`d${h.i}.${value}`);
    }
  }

  private key(key: string): boolean {
    const b = this.state.board;
    const n = Number(key);
    if (n >= 1 && n <= 4) return this.play(`t${n - 1}`), true;
    if (n >= 5 && n <= 8) return this.play(`b${n - 5}`), true;
    const slider = 'zxc'.indexOf(key.toLowerCase());
    if (slider >= 0) return this.play(`s${slider}.${(b.sliders[slider]! + 1) % (SB_SLIDER_MAX + 1)}`), true;
    const dial = 'vb'.indexOf(key.toLowerCase());
    if (dial >= 0) return this.play(`d${dial}.${(b.dials[dial]! + 1) % (SB_DIAL_MAX + 1)}`), true;
    if (key === 'l' || key === 'L') return this.play('lever'), true;
    if (key === 'Enter' || key === 'd' || key === 'D') return this.play('done'), true;
    return false;
  }

  private changed(): void {
    const last = this.state.last;
    if (!last) return;
    const k = last[0];
    cue(last === 'done' ? 'win' : last === 'lever' ? 'clang' : k === 'b' ? 'hit' : k === 's' ? 'place' : 'tap');
    if (this.state.rainbow && !this.state.result) cue('win');
  }

  private lip(x: number, y: number, w: number, h: number, r: number, top: string, dark: string): void {
    const g = this.g;
    g.fillStyle(toHex(dark), 1);
    g.fillRoundedRect(x - w / 2, y - h / 2 + 6, w, h, r);
    g.fillStyle(toHex(top), 1);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, r);
  }

  private draw(): void {
    const s = this.state;
    const b = s.board;
    const g = this.g.clear();
    // The lamp strip: one lamp per control, in order along the board.
    const on = [...b.toggles, ...b.sliders.map((v) => v > 0), ...b.dials.map((v) => v > 0), ...b.presses.map((c) => c % 2 === 1), b.lever];
    this.lip(W / 2, LAMP_Y, W - 40, 64, 32, '#F4F1FB', '#E0DAF0');
    on.forEach((lit, i) => {
      const x = 46 + i * ((W - 92) / (on.length - 1));
      const color = s.rainbow ? CANDY[(i + Math.floor(this.time0 / 120)) % CANDY.length]! : CANDY[i % CANDY.length]!;
      g.fillStyle(lit ? toHex(color) : 0xd8d3e6, 1);
      g.fillCircle(x, LAMP_Y, 12);
      if (lit) {
        g.fillStyle(0xffffff, 0.5);
        g.fillCircle(x - 4, LAMP_Y - 4, 4);
      }
    });
    // Toggles: a plate and a knob that sits up (on) or down (off).
    b.toggles.forEach((t, i) => {
      const x = toggleX(i);
      this.lip(x, TOGGLE_Y, 70, 110, 22, '#FFFFFF', '#D8D3E6');
      g.fillStyle(toHex(COLORS.line), 1);
      g.fillRoundedRect(x - 8, TOGGLE_Y - 36, 16, 72, 8);
      const ky = TOGGLE_Y + (t ? -26 : 26);
      g.fillStyle(toHex(CANDY_DARK[i]!), 1);
      g.fillCircle(x, ky + 4, 22);
      g.fillStyle(toHex(t ? CANDY[i]! : '#B8B2CC'), 1);
      g.fillCircle(x, ky, 22);
    });
    // Sliders: a track with notches and a chunky knob.
    b.sliders.forEach((v, i) => {
      const y = SLIDER_Y[i]!;
      g.fillStyle(toHex('#E0DAF0'), 1);
      g.fillRoundedRect(SLIDER_X[0]! - 20, y - 10, SLIDER_X[1]! - SLIDER_X[0]! + 40, 20, 10);
      const x = SLIDER_X[0]! + (v / SB_SLIDER_MAX) * (SLIDER_X[1]! - SLIDER_X[0]!);
      g.fillStyle(toHex(CANDY[(i + 4) % CANDY.length]!), 1);
      g.fillRoundedRect(SLIDER_X[0]! - 20, y - 10, x - SLIDER_X[0]! + 20, 20, 10);
      for (let k = 0; k <= SB_SLIDER_MAX; k++) {
        g.fillStyle(0xffffff, 0.8);
        g.fillCircle(SLIDER_X[0]! + (k / SB_SLIDER_MAX) * (SLIDER_X[1]! - SLIDER_X[0]!), y, 2.5);
      }
      this.lip(x, y, 44, 44, 14, '#FFFFFF', '#C9C2E0');
    });
    // Dials: a round knob with a pointer and twelve notches around it.
    b.dials.forEach((v, i) => {
      const cx = DIAL_X[i]!;
      for (let k = 0; k <= SB_DIAL_MAX; k++) {
        const a = dialAngle(k);
        g.fillStyle(k <= v && v > 0 ? toHex(CANDY[(i * 3 + 2) % CANDY.length]!) : 0xd8d3e6, 1);
        g.fillCircle(cx + Math.cos(a) * (DIAL_R + 18), DIAL_Y + Math.sin(a) * (DIAL_R + 18), 6);
      }
      g.fillStyle(toHex('#C9C2E0'), 1);
      g.fillCircle(cx, DIAL_Y + 6, DIAL_R);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(cx, DIAL_Y, DIAL_R);
      const a = dialAngle(v);
      g.lineStyle(10, toHex(COLORS.ink), 1);
      g.lineBetween(cx + Math.cos(a) * 18, DIAL_Y + Math.sin(a) * 18, cx + Math.cos(a) * (DIAL_R - 14), DIAL_Y + Math.sin(a) * (DIAL_R - 14));
      g.fillStyle(toHex(COLORS.ink), 1);
      g.fillCircle(cx, DIAL_Y, 14);
    });
    // Push buttons: round, sinking while held, lit while their lamp is.
    b.presses.forEach((c, i) => {
      const x = BUTTON_X[i]!;
      const down = this.sunk === i ? 5 : 0;
      g.fillStyle(toHex(CANDY_DARK[(i + 1) % CANDY.length]!), 1);
      g.fillCircle(x, BUTTON_Y + 6, 40);
      g.fillStyle(toHex(c % 2 === 1 ? CANDY[(i + 1) % CANDY.length]! : '#E6E0F4'), 1);
      g.fillCircle(x, BUTTON_Y + down, 40);
      g.fillStyle(0xffffff, 0.4);
      g.fillCircle(x - 12, BUTTON_Y - 12 + down, 9);
    });
    // The lever: a slot with a big ball on a stick, up or down.
    g.fillStyle(toHex('#E0DAF0'), 1);
    g.fillRoundedRect(LEVER.x - 14, LEVER.y - 80, 28, 160, 14);
    const ly = LEVER.y + (b.lever ? -58 : 58);
    g.lineStyle(10, toHex(COLORS.soft), 1);
    g.lineBetween(LEVER.x, LEVER.y, LEVER.x, ly);
    g.fillStyle(toHex(DARK.tomato), 1);
    g.fillCircle(LEVER.x, ly + 4, 26);
    g.fillStyle(toHex(COLORS.tomato), 1);
    g.fillCircle(LEVER.x, ly, 26);
    // Done.
    const live = !s.result;
    this.doneText.setVisible(live);
    if (live) this.lip(W / 2, DONE_Y, 220, 56, 28, COLORS.mint, DARK.mint);
  }

  /** The bands the board keeps to, for the layout check. */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    return [
      { name: 'lamps', top: LAMP_Y - 32, bottom: LAMP_Y + 38 },
      { name: 'toggles', top: TOGGLE_Y - 55, bottom: TOGGLE_Y + 61 },
      { name: 'sliders', top: SLIDER_Y[0]! - 22, bottom: SLIDER_Y[2]! + 28 },
      { name: 'dials', top: DIAL_Y - DIAL_R - 24, bottom: DIAL_Y + DIAL_R + 24 },
      { name: 'buttons', top: LEVER.y - 90, bottom: LEVER.y + 90 },
      { name: 'done', top: DONE_Y - 28, bottom: DONE_Y + 34 },
    ];
  }
}

export function switchStatus(state: SwitchState): string | undefined {
  if (state.result) return undefined;
  return state.rainbow ? 'Everything on: rainbow!' : `${state.lit} of 14 lamps lit`;
}

export function switchResult(state: SwitchState): string | undefined {
  if (!state.result) return undefined;
  return `${state.clicks} clicks. Very satisfying.`;
}
