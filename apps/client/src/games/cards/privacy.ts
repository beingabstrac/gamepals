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
  private raisedAt = 0;
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

  /**
   * Is this hand its owner's to look at right now?
   *
   * With nobody at the table the answer is yes. A build with bots in every seat has no person to
   * keep a hand from, and hiding it there only means the gallery, which is the one thing that can
   * see a game the tests cannot, photographs a row of face-down cards. Real play always has at
   * least one person, so this never loosens anything a player would notice.
   */
  get open(): boolean {
    if (this.people === 0) return true;
    return !this.hidden && this.seats[this.shown]?.kind === 'human';
  }

  /** Call when the turn changes: the phone may have to pass to somebody else. */
  turnChanged(seat: number, over: boolean): void {
    if (over || this.seats[seat]?.kind !== 'human' || seat === this.shown) return;
    this.shown = seat;
    if (this.people > 1) {
      this.hidden = true;
      this.raisedAt = Date.now();
    }
  }

  /**
   * A tap or a key anywhere lifts the cover. True when the input went no further, which is
   * always the case while a hand is covered: a covered hand never acts on a press.
   *
   * A press already on its way when the cover went up must not lift it. Phaser reads input on
   * its own frame, so the key somebody was still pressing as their turn ended arrives just
   * after the cover does, and without this it would open the next person's hand at once.
   */
  lift(): boolean {
    if (!this.hidden) return false;
    if (Date.now() - this.raisedAt > 300) this.hidden = false;
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
