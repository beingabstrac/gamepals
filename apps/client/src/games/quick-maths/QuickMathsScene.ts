import {
  ANSWER_COUNT,
  botAnswerMs,
  botChoice,
  createRng,
  newQuickMaths,
  QUICK_TIERS,
  quickAnswer,
  type QuickState,
  type Rng,
  type Seat,
  stepQuick,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed, SPEED } from '../../autoplay';
import { COLORS, toHex } from '../../theme';
import type { RealtimeSceneOptions } from '../air-hockey/AirHockeyScene';
import { fitCamera, sharpText } from '../crisp';
import { DUEL_COLORS, drawHalves, facing, isPerson, onDuelKeys } from '../duel';

const W = 640;
const H = 940;
export const QUICK_MATHS_SIZE = { width: W, height: H };

const TINTS: readonly [number, number] = [0xcfe4ff, 0xffd6d6];
const BUTTON_W = 270;
const BUTTON_H = 84;
const BUTTON_GAP = 14;
/** Each player's four answers sit in their own half, the right way up for them. */
const PAD_CENTRE: readonly [number, number] = [H - 190, 190];
/** The score and the note sit outside the pads, at the very edge of each player's half. */
const SIDE_Y = 32;

export class QuickMathsScene extends Scene {
  private state: QuickState;
  private readonly rng: Rng;
  /** When each bot will answer this question, and what it will tap. */
  private botAt: [number, number] = [Infinity, Infinity];
  private botTap: [number, number] = [0, 0];
  private ended = false;

  private sums: GameObjects.Text[] = [];
  private buttons: GameObjects.Text[][] = [[], []];
  private pads!: GameObjects.Graphics;
  private scoreTexts: GameObjects.Text[] = [];
  private notes: GameObjects.Text[] = [];

  constructor(private readonly options: RealtimeSceneOptions) {
    super('quick-maths');
    this.rng = createRng(options.seed);
    this.state = newQuickMaths(options.seed);
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    drawHalves(this, W, H, TINTS);
    this.pads = this.add.graphics();
    const seats = this.options.seats;

    // The sum twice, once the right way up for each player, so nobody reads it upside down. Only
    // for seats a person is in: against a bot there is nobody on the other side of the phone, so
    // a second copy is not a courtesy, it is the same words printed twice in the middle.
    const people = seats.filter((seat) => seat.kind === 'human').length;
    this.sums = [0, 1].map((seat) =>
      sharpText(this, W / 2, seat === 0 ? H / 2 + 42 : H / 2 - 42, '', 56, COLORS.ink)
        .setAngle(facing(seats, seat as Seat))
        .setVisible(people === 0 ? seat === 0 : isPerson(seats, seat as Seat)),
    );
    // Outside the answer pads, not on them: at y = H - 56 the score sat on the bottom-left button.
    this.scoreTexts = [0, 1].map((seat) =>
      sharpText(this, 56, seat === 0 ? H - SIDE_Y : SIDE_Y, '0', 40, DUEL_COLORS[seat]!).setAngle(
        facing(seats, seat as Seat),
      ),
    );
    this.notes = [0, 1].map((seat) =>
      sharpText(this, W - 90, seat === 0 ? H - SIDE_Y : SIDE_Y, '', 22, COLORS.soft)
        .setAngle(facing(seats, seat as Seat))
        .setVisible(isPerson(seats, seat as Seat)),
    );

    for (const seat of [0, 1] as const) {
      for (let i = 0; i < ANSWER_COUNT; i++) {
        this.buttons[seat]![i] = sharpText(this, 0, 0, '', 34, COLORS.ink)
          .setAngle(facing(seats, seat))
          .setDepth(2);
      }
    }

    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.press(p.worldX, p.worldY));
    onDuelKeys(this, seats, (seat, action) => {
      // Four answers on the arrows and WASD: left, up, right, down is the order they are drawn.
      const at = action === 'left' ? 0 : action === 'up' ? 1 : action === 'right' ? 2 : action === 'down' ? 3 : -1;
      if (at >= 0) this.answer(seat, at);
    });
    this.show();
    this.options.onScore([0, 0]);
  }

  private buttonBox(seat: Seat, index: number): { x: number; y: number } {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = W / 2 + (col === 0 ? -BUTTON_W - BUTTON_GAP / 2 : BUTTON_GAP / 2);
    // Seat 1 sits at the top, so its rows run the other way to stay nearest its own edge.
    const centre = PAD_CENTRE[seat]!;
    const y = centre + (seat === 0 ? row : 1 - row) * (BUTTON_H + BUTTON_GAP) - (BUTTON_H + BUTTON_GAP) / 2;
    return { x, y };
  }

  private press(x: number, y: number): void {
    for (const seat of [0, 1] as const) {
      if (!isPerson(this.options.seats, seat)) continue;
      for (let i = 0; i < ANSWER_COUNT; i++) {
        const box = this.buttonBox(seat, i);
        if (x >= box.x && x <= box.x + BUTTON_W && y >= box.y && y <= box.y + BUTTON_H) {
          this.answer(seat, i);
          return;
        }
      }
    }
  }

  private answer(seat: Seat, index: number): void {
    const choice = this.state.question.choices[index];
    if (choice === undefined) return;
    const before = this.state;
    this.state = quickAnswer(this.state, seat, choice);
    if (this.state !== before) this.onChange(before);
  }

  update(_time: number, delta: number): void {
    if (this.ended) return;
    const before = this.state;
    this.state = stepQuick(this.state, Math.min(delta, 50) * SPEED);
    if (this.state.phase !== before.phase) this.onChange(before);

    if (this.state.phase === 'ask') {
      for (const seat of [0, 1] as const) {
        if (this.state.phaseMs >= this.botAt[seat] && !this.state.locked[seat]) this.answer(seat, this.botTap[seat]);
      }
    }
  }

  private onChange(before: QuickState): void {
    const { phase } = this.state;
    if (phase === 'ask' && before.phase !== 'ask') {
      // Decide now how long each bot takes and what it will tap this question.
      this.botAt = [0, 1].map((seat) => {
        const controller = this.options.seats[seat];
        return controller?.kind === 'bot' ? botAnswerMs(QUICK_TIERS[controller.tier], this.rng) : Infinity;
      }) as [number, number];
      this.botTap = [0, 1].map((seat) => {
        const controller = this.options.seats[seat];
        if (controller?.kind !== 'bot') return 0;
        const pick = botChoice(this.state.question, QUICK_TIERS[controller.tier], this.rng);
        return Math.max(0, this.state.question.choices.indexOf(pick));
      }) as [number, number];
      this.options.onCue('go');
    }
    if (phase === 'point' && before.phase !== 'point') {
      const point = this.state.lastPoint;
      this.options.onCue(point?.seat === null ? 'buzz' : 'hit');
      if (point?.seat !== null && point) {
        const text = this.scoreTexts[point.seat];
        text?.setText(String(this.state.scores[point.seat]));
        if (text) this.tweens.add({ targets: text, scale: 1.4, duration: 180, yoyo: true, ease: 'Back.easeOut' });
      }
      this.options.onScore(this.state.scores);
    }
    this.show();
    if (this.state.result && !this.ended) {
      this.ended = true;
      this.options.onEnd(this.state.result);
    }
  }

  /** The bands that must not sit on top of each other, for the layout check. */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    const top = this.buttonBox(1, 2);
    const bottom = this.buttonBox(0, 2);
    return [
      { name: 'top score', top: SIDE_Y - 22, bottom: SIDE_Y + 22 },
      { name: 'top pad', top: top.y, bottom: this.buttonBox(1, 0).y + BUTTON_H },
      { name: 'sums', top: H / 2 - 42 - 30, bottom: H / 2 + 42 + 30 },
      { name: 'bottom pad', top: this.buttonBox(0, 0).y, bottom: bottom.y + BUTTON_H },
      { name: 'bottom score', top: H - SIDE_Y - 22, bottom: H - SIDE_Y + 22 },
    ];
  }

  private show(): void {
    const state = this.state;
    const question = state.question;
    const asking = state.phase === 'ask';
    const sign = question.op === '*' ? '×' : question.op === '-' ? '−' : '+';
    const line =
      state.phase === 'ready'
        ? `Round ${state.round + 1}`
        : state.phase === 'point'
          ? state.lastPoint?.seat === null
            ? `It was ${question.answer}`
            : 'Point!'
          : `${question.a} ${sign} ${question.b}`;
    for (const text of this.sums) text.setText(line);

    const g = this.pads.clear();
    for (const seat of [0, 1] as const) {
      const locked = state.locked[seat];
      this.notes[seat]!.setText(locked ? 'Out this round' : '');
      for (let i = 0; i < ANSWER_COUNT; i++) {
        const box = this.buttonBox(seat, i);
        const live = asking && !locked;
        // Nothing to answer yet means no pads at all. Four empty outlined boxes between questions
        // read as something that failed to draw rather than as a game waiting for the next sum.
        this.buttons[seat]![i]!.setVisible(asking);
        if (!asking) continue;
        g.fillStyle(0xd9d4e8, 1);
        g.fillRoundedRect(box.x, box.y + 5, BUTTON_W, BUTTON_H, 20);
        g.fillStyle(live ? 0xffffff : 0xefecf6, 1);
        g.fillRoundedRect(box.x, box.y, BUTTON_W, BUTTON_H, 20);
        g.lineStyle(3, live ? toHex(DUEL_COLORS[seat]!) : 0xdcd6ee, 1);
        g.strokeRoundedRect(box.x, box.y, BUTTON_W, BUTTON_H, 20);
        this.buttons[seat]![i]!
          .setPosition(box.x + BUTTON_W / 2, box.y + BUTTON_H / 2)
          .setText(String(question.choices[i] ?? ''))
          .setColor(live ? COLORS.ink : COLORS.soft);
      }
    }
  }
}
