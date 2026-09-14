import { pressMove, TIMEOUT_MOVE, type EchoMove, type EchoState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import type { SoundName } from '../../sfx';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed } from '../../autoplay';
import { onKeys } from '../keys';

const SIZE = 600;
export const ECHO_SIZE = { width: SIZE, height: SIZE };
export const ECHO_SIDE_COLORS = [COLORS.sky, COLORS.tomato, COLORS.mint, COLORS.sunny];
export const ECHO_SIDE_NAMES = ['Blue', 'Red', 'Green', 'Yellow'];

const C = SIZE / 2;
const PAD_R = 104;
const REACH = 158;
/** Pads sit in a diamond so the arrow keys match: top, right, bottom, left. */
const PADS = [
  { x: C, y: C - REACH, color: COLORS.tomato, dark: DARK.tomato },
  { x: C + REACH, y: C, color: COLORS.sky, dark: DARK.sky },
  { x: C, y: C + REACH, color: COLORS.sunny, dark: DARK.sunny },
  { x: C - REACH, y: C, color: COLORS.mint, dark: DARK.mint },
];
/** Time allowed for each press, as in the classic toy. */
const PRESS_MS = 5000;

/** A white shape on each pad, so color is never the only cue: circle, triangle, square, star. */
function drawShape(g: GameObjects.Graphics, pad: number): void {
  g.fillStyle(0xffffff, 0.92);
  const r = 26;
  const poly = (points: [number, number][]) => {
    g.beginPath();
    g.moveTo(points[0]![0], points[0]![1]);
    for (const [x, y] of points.slice(1)) g.lineTo(x, y);
    g.closePath();
    g.fillPath();
  };
  if (pad === 0) g.fillCircle(0, 0, r);
  else if (pad === 1) poly([[0, -r], [r * 0.95, r * 0.75], [-r * 0.95, r * 0.75]]);
  else if (pad === 2) g.fillRoundedRect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7, 6);
  else
    poly(
      Array.from({ length: 10 }, (_, i) => {
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        const radius = i % 2 ? r * 0.45 : r * 1.05;
        return [Math.cos(angle) * radius, Math.sin(angle) * radius] as [number, number];
      }),
    );
}

export class EchoScene extends Scene {
  private pads: GameObjects.Container[] = [];
  private glows: GameObjects.Arc[] = [];
  private center!: GameObjects.Text;
  private timerRing!: GameObjects.Graphics;
  private showing = false;
  private deadline: number | null = null;

  constructor(private readonly session: Session<EchoMove>) {
    super('echo');
  }

  private get state(): EchoState {
    return this.session.state as EchoState;
  }

  create(): void {
    fitCamera(this, SIZE, SIZE);
    applySpeed(this);

    const base = this.add.graphics();
    base.fillStyle(0xf1edfa, 1);
    base.fillCircle(C, C, REACH + PAD_R + 14);
    this.timerRing = this.add.graphics();

    PADS.forEach((pad, i) => {
      const lip = this.add.circle(0, 8, PAD_R, toHex(pad.dark));
      const face = this.add.circle(0, 0, PAD_R, toHex(pad.color));
      const glow = this.add.circle(0, 0, PAD_R, 0xffffff, 0);
      const shape = this.add.graphics();
      drawShape(shape, i);
      const container = this.add.container(pad.x, pad.y, [lip, face, glow, shape]);
      container.setScale(0);
      this.tweens.add({ targets: container, scale: 1, duration: 320, delay: 60 + i * 70, ease: 'Back.easeOut' });
      this.pads.push(container);
      this.glows.push(glow);
    });

    const hub = this.add.circle(C, C, 62, 0xffffff);
    hub.setStrokeStyle(6, 0xe6e0f4);
    this.center = sharpText(this, C, C, '', 30, COLORS.ink).setFontStyle('bold');

    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      const pad = PADS.findIndex((spot) => Math.hypot(p.worldX - spot.x, p.worldY - spot.y) <= PAD_R);
      if (pad >= 0) this.press(pad);
    });
    // Keyboard: 1–4, or the arrow keys (up, right, down, left match the pads).
    const arrows: Record<string, number> = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };
    onKeys(this, (key) => {
      const pad = /^[1-4]$/.test(key) ? Number(key) - 1 : arrows[key];
      if (pad === undefined) return false;
      this.press(pad);
      return true;
    });

    const unsubscribe = this.session.subscribe(() => this.onChange());
    this.events.once('shutdown', unsubscribe);
    this.time.delayedCall(700, () => this.startTurn());
  }

  update(time: number): void {
    const g = this.timerRing.clear();
    if (this.deadline === null) return;
    const left = Math.max(0, this.deadline - time) / PRESS_MS;
    if (left <= 0) {
      this.deadline = null;
      this.session.play(TIMEOUT_MOVE);
      return;
    }
    // Time left for this press, as a ring that shrinks around the pads.
    g.lineStyle(10, toHex(left < 0.3 ? COLORS.tomato : COLORS.grape), 0.85);
    g.beginPath();
    g.arc(C, C, REACH + PAD_R + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left, false);
    g.strokePath();
  }

  private isMyTurn(): boolean {
    return this.session.isHumanTurn() && !this.showing;
  }

  private press(pad: number): void {
    if (!this.isMyTurn()) return;
    this.session.play(pressMove(pad));
  }

  /** Lights a pad: it glows and grows a little; `sound` plays its tone (presses sound through the game's cue). */
  private light(pad: number, ms: number, sound: boolean): void {
    const container = this.pads[pad]!;
    const glow = this.glows[pad]!;
    this.tweens.killTweensOf([container, glow]);
    container.setScale(1);
    this.tweens.add({ targets: container, scale: 1.08, duration: ms * 0.35, yoyo: true, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: glow, fillAlpha: { from: 0.55, to: 0 }, duration: ms, ease: 'Quad.easeIn' });
    if (sound) cue(`echo${pad}` as SoundName);
  }

  private say(text: string): void {
    this.center.setText(text).setScale(0.7);
    this.tweens.add({ targets: this.center, scale: 1, duration: 220, ease: 'Back.easeOut' });
  }

  /** A person's turn starts by playing the sequence to them; a bot just goes. */
  private startTurn(): void {
    const state = this.state;
    if (state.result) return;
    this.deadline = null;
    if (!this.session.isHumanTurn()) {
      this.say(state.party ? `${this.session.seats[state.currentSeat]?.label ?? ''}` : '');
      return;
    }
    this.showing = true;
    this.say('Watch');
    const tempo = Math.max(300, 640 - state.sequence.length * 14);
    state.sequence.forEach((pad, i) => this.time.delayedCall(450 + i * tempo, () => this.light(pad, tempo * 0.8, true)));
    this.time.delayedCall(450 + state.sequence.length * tempo, () => {
      this.showing = false;
      this.say(state.party && state.phase === 'add' ? 'Add one!' : 'Your turn');
      this.deadline = this.time.now + PRESS_MS;
    });
  }

  private onChange(): void {
    const state = this.state;
    const press = state.last;
    if (!press) return;
    if (press.pad !== null) this.light(press.pad, 360, false);
    if (!press.correct) {
      this.cameras.main.shake(260, 0.01);
      this.say(state.party ? `${this.session.seats[press.seat]?.label ?? ''} is out` : 'Oops!');
    }
    if (state.result) {
      this.deadline = null;
      if (state.result.winners.length) this.celebrate();
      return;
    }
    if (press.roundDone) {
      this.deadline = null;
      if (!state.party && press.correct) this.say(String(state.sequence.length));
      this.time.delayedCall(press.correct ? 650 : 1100, () => this.startTurn());
    } else if (this.session.isHumanTurn()) {
      if (state.phase === 'add') this.say('Add one!');
      this.deadline = this.time.now + PRESS_MS;
    }
  }

  private celebrate(): void {
    this.say('🎉');
    for (let round = 0; round < 2; round++) {
      PADS.forEach((_, pad) => this.time.delayedCall(200 + (round * 4 + pad) * 140, () => this.light(pad, 260, false)));
    }
  }
}
