import type { GameObjects, Scene } from 'phaser';
import type { SeatController } from '../../session';
import { DARK, toHex } from '../../theme';
import { sharpText } from '../crisp';

/**
 * Hands that only their owner may see, shared by the card games that deal them
 * (docs/games/crazy-eights.md). With more than one person at one phone, the hand is covered
 * when the turn passes and stays covered until its owner says they are ready.
 */
export class HandPrivacy {
  /** The seat whose hand is on screen: the person playing, or the last one who did. */
  shown = 0;
  private hidden = false;
  private panel?: GameObjects.Container;

  constructor(
    private readonly scene: Scene,
    private readonly seats: readonly SeatController[],
    private readonly where: { x: number; y: number; width: number },
  ) {
    this.shown = Math.max(0, seats.findIndex((seat) => seat.kind === 'human'));
  }

  get covered(): boolean {
    return this.hidden;
  }

  private get people(): number {
    return this.seats.filter((seat) => seat.kind === 'human').length;
  }

  /** Is this hand its owner's to look at right now? */
  get open(): boolean {
    return !this.hidden && this.seats[this.shown]?.kind === 'human';
  }

  /** Call when the turn changes: the phone may have to pass to somebody else. */
  turnChanged(seat: number, over: boolean): void {
    if (over || this.seats[seat]?.kind !== 'human' || seat === this.shown) return;
    this.shown = seat;
    if (this.people > 1) this.hidden = true;
  }

  /** A tap or a key anywhere lifts the cover. True when that is all it did. */
  lift(): boolean {
    if (!this.hidden) return false;
    this.hidden = false;
    return true;
  }

  /** Redraws the cover for the current state; call from the scene's sync. */
  draw(): void {
    this.panel?.destroy();
    this.panel = undefined;
    if (!this.hidden) return;
    const label = this.seats[this.shown]?.label ?? 'You';
    const back = this.scene.add.graphics();
    back.fillStyle(toHex(DARK.sky), 1);
    back.fillRoundedRect(-this.where.width / 2, -150, this.where.width, 300, 28);
    this.panel = this.scene.add
      .container(this.where.x, this.where.y, [
        back,
        sharpText(this.scene, 0, -40, `Pass to ${label}`, 40, '#ffffff'),
        sharpText(this.scene, 0, 20, 'Tap when nobody else is looking', 24, '#e8f2ff'),
      ])
      .setDepth(5000);
  }
}
