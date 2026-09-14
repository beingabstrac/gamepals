import {
  botReactionMs,
  createRng,
  newReflexGame,
  REFLEX_TIERS,
  reflexTap,
  stepReflex,
  type ReflexState,
  type Rng,
  type Seat,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { COLORS, toHex } from '../../theme';
import type { RealtimeSceneOptions } from '../air-hockey/AirHockeyScene';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed, SPEED } from '../../autoplay';
import { DUEL_COLORS, drawHalves, facing, isPerson, onHalfTap } from '../duel';

const W = 600;
const H = 900;
export const REFLEX_RACE_SIZE = { width: W, height: H };

const TINTS: readonly [number, number] = [0xcfe4ff, 0xffd6d6];
const WAIT_COLOR = toHex(COLORS.grape);
const GO_COLOR = toHex(COLORS.mint);
const SEAT_HEX = DUEL_COLORS.map(toHex);

export class ReflexRaceScene extends Scene {
  private state: ReflexState;
  private readonly rng: Rng;
  private botReaction: [number, number] = [Infinity, Infinity];
  private ended = false;

  private light!: GameObjects.Arc;
  private label!: GameObjects.Text;
  private sub!: GameObjects.Text;
  private scoreTexts: GameObjects.Text[] = [];

  constructor(private readonly options: RealtimeSceneOptions) {
    super('reflex-race');
    this.rng = createRng(options.seed);
    this.state = newReflexGame(options.seed);
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    drawHalves(this, W, H, TINTS);

    const seats = this.options.seats;
    this.scoreTexts = [0, 1].map((seat) =>
      sharpText(this, W / 2, seat === 0 ? H * 0.82 : H * 0.18, '0', 110, DUEL_COLORS[seat]!).setAngle(facing(seats, seat as Seat)),
    );
    [0, 1].forEach((seat) =>
      sharpText(this, W / 2, seat === 0 ? H - 40 : 40, 'Tap your side', 26, COLORS.soft)
        .setAngle(facing(seats, seat as Seat))
        .setVisible(isPerson(seats, seat as Seat)),
    );

    this.add.circle(W / 2, H / 2 + 10, 150, 0x2b2a3a, 0.1);
    this.light = this.add.circle(W / 2, H / 2, 150, WAIT_COLOR).setStrokeStyle(10, 0xffffff);
    this.label = sharpText(this, W / 2, H / 2 - 14, '', 64, '#ffffff');
    this.sub = sharpText(this, W / 2, H / 2 + 46, '', 28, '#ffffff');

    onHalfTap(this, H, (seat) => {
      if (this.options.seats[seat]?.kind === 'human') this.tap(seat);
    });
    this.show();
    this.options.onScore([0, 0]);
  }

  private tap(seat: Seat): void {
    const before = this.state;
    this.state = reflexTap(this.state, seat);
    if (this.state !== before) this.onPhaseChange(before);
  }

  update(_time: number, delta: number): void {
    if (this.ended) return;
    const before = this.state;
    this.state = stepReflex(this.state, Math.min(delta, 50) * SPEED);
    if (this.state.phase !== before.phase) this.onPhaseChange(before);

    if (this.state.phase === 'go') {
      for (const seat of [0, 1] as const) {
        if (this.state.phase === 'go' && this.state.phaseMs >= this.botReaction[seat]) this.tap(seat);
      }
    }
  }

  private onPhaseChange(before: ReflexState): void {
    const { phase } = this.state;
    if (phase === 'go') {
      // Decide now how quickly each bot will react this round.
      this.botReaction = [0, 1].map((seat) => {
        const controller = this.options.seats[seat];
        return controller?.kind === 'bot' ? botReactionMs(REFLEX_TIERS[controller.tier], this.rng) : Infinity;
      }) as [number, number];
      this.options.onCue('go');
    }
    if (phase === 'point' && before.phase !== 'point') {
      const point = this.state.lastPoint;
      if (point?.reason === 'falseStart') {
        this.options.onCue('buzz');
        this.cameras.main.shake(220, 0.01);
      } else {
        this.options.onCue('hit');
      }
      if (point) {
        const text = this.scoreTexts[point.seat];
        text?.setText(String(this.state.scores[point.seat]));
        if (text) this.tweens.add({ targets: text, scale: 1.4, duration: 180, yoyo: true, ease: 'Back.easeOut' });
      }
      this.options.onScore(this.state.scores);
    }
    this.show();
    if (this.state.result) {
      this.ended = true;
      this.options.onEnd(this.state.result);
    }
  }

  /** The big light tells everyone what's happening. */
  private show(): void {
    const { phase, round, lastPoint } = this.state;
    let color = WAIT_COLOR;
    let label = '';
    let sub = '';
    let angle = 0;
    if (phase === 'ready') {
      label = `Round ${round + 1}`;
      sub = 'get ready';
    } else if (phase === 'wait') {
      label = 'Wait…';
      sub = "don't tap yet";
    } else if (phase === 'go') {
      color = GO_COLOR;
      label = 'TAP!';
    } else if (lastPoint) {
      color = SEAT_HEX[lastPoint.seat] ?? WAIT_COLOR;
      label = lastPoint.reason === 'falseStart' ? 'Too soon!' : '+1';
      sub = lastPoint.reactionMs !== null ? `${lastPoint.reactionMs} ms` : 'false start';
      angle = facing(this.options.seats, lastPoint.seat);
    }
    this.light.setFillStyle(color);
    this.label.setText(label).setAngle(angle);
    this.sub.setText(sub).setAngle(angle);
    this.sub.setPosition(W / 2, H / 2 + (angle === 180 ? -46 : 46));
    this.label.setPosition(W / 2, H / 2 + (angle === 180 ? 14 : -14));

    this.tweens.killTweensOf(this.light);
    this.light.setScale(phase === 'go' ? 0.8 : 0.92);
    this.tweens.add({ targets: this.light, scale: 1, duration: 320, ease: 'Back.easeOut' });
  }
}
