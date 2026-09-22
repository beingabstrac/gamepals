import { YATZY_FIRST_ROLL, yatzyRoll, type YatzyEvent, type YatzyMove, type YatzyState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed } from '../../autoplay';
import { onKeys } from '../keys';
import { setKeep, tableFor, YATZY_LABELS, type YatzyTable } from './table';

const W = 640;
const H = 250;
export const YATZY_SIZE = { width: W, height: H };

const DIE = 92;
const GAP = 118;
const REST_Y = 126;
const KEPT_Y = 100;
/** Under the dice, clear of their lowest reach and inside the tray. */
const SHOUT_Y = 197;
const INK = toHex(COLORS.ink);
const LIP = 0xdcd6ee;
const SUNNY = toHex(COLORS.sunny);
const CONFETTI = [COLORS.tomato, COLORS.sunny, COLORS.mint, COLORS.sky, COLORS.grape, COLORS.bubblegum].map(toHex);

/** Pip spots on a -1..1 grid for each face. */
const PIPS: Record<number, readonly (readonly [number, number])[]> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

const dieX = (i: number) => W / 2 + (i - 2) * GAP;

function drawFace(g: GameObjects.Graphics, value: number, kept: boolean): void {
  g.clear();
  g.fillStyle(LIP, 1);
  g.fillRoundedRect(-DIE / 2, -DIE / 2 + 7, DIE, DIE, 22);
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(-DIE / 2, -DIE / 2, DIE, DIE, 22);
  if (kept) {
    g.lineStyle(6, SUNNY, 1);
    g.strokeRoundedRect(-DIE / 2, -DIE / 2, DIE, DIE, 22);
  }
  // Before the first roll there is no value yet: show a faint five so the tray reads as dice.
  g.fillStyle(INK, value === 0 ? 0.12 : 1);
  for (const [x, y] of PIPS[value === 0 ? 5 : value] ?? []) g.fillCircle(x * 24, y * 24, 9);
}

export class YatzyScene extends Scene {
  private dice: GameObjects.Graphics[] = [];
  private table!: YatzyTable;
  private seen: YatzyEvent | null = null;
  private hint!: GameObjects.Text;
  private banner!: GameObjects.Text;
  /** How many times the scene has shouted, and the worst place it ever did it. */
  private shouts = 0;
  private clash = '';

  constructor(private readonly session: Session<YatzyMove>) {
    super('yatzy');
  }

  private get state(): YatzyState {
    return this.session.state as YatzyState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.table = tableFor(this.session);
    this.seen = this.state.last;

    const tray = this.add.graphics();
    tray.fillStyle(toHex(DARK.mint), 1);
    tray.fillRoundedRect(8, 16, W - 16, H - 40, 36);
    tray.fillStyle(toHex(COLORS.mint), 1);
    tray.fillRoundedRect(8, 8, W - 16, H - 40, 36);

    this.dice = [0, 1, 2, 3, 4].map((i) => this.add.graphics().setPosition(dieX(i), REST_Y));
    for (let i = 0; i < 5; i++) {
      this.add
        .zone(dieX(i), REST_Y - 12, DIE + 20, DIE + 48)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.toggle(i));
    }
    this.hint = sharpText(this, W / 2, H - 14, 'Tap dice to keep them', 17, COLORS.ink).setAlpha(0);
    // Below the dice, not across them. The dice reach 172 at their lowest (REST_Y plus half of
    // DIE) and the tray ends at 218, so there are 46 units to work with, which a 40pt line and its
    // stroke do not fit into: the check measured that one at 56 tall. This one is small enough to
    // sit in the gap and still be twice the hint.
    this.banner = sharpText(this, W / 2, SHOUT_Y, '', 28, COLORS.ink).setDepth(10).setAlpha(0).setStroke('#ffffff', 6);

    // Keyboard: 1 to 5 keep dice, Space or R rolls (a focused button handles its own Space).
    onKeys(this, (key) => {
      const digit = Number(key);
      if (Number.isInteger(digit) && digit >= 1 && digit <= 5) {
        this.toggle(digit - 1);
        return true;
      }
      const onButton = document.activeElement instanceof HTMLButtonElement;
      if (key === 'r' || key === 'R' || (key === ' ' && !onButton)) {
        this.roll();
        return true;
      }
      return false;
    });

    const onKeep = () => this.placeDice();
    this.table.listeners.add(onKeep);
    const unsubscribe = this.session.subscribe(() => this.onChange());
    this.events.once('shutdown', () => {
      unsubscribe();
      this.table.listeners.delete(onKeep);
    });
    this.placeDice();
  }

  private canKeep(): boolean {
    const state = this.state;
    return !state.result && this.session.isHumanTurn() && state.rollsUsed > 0 && state.rollsUsed < 3;
  }

  private toggle(i: number): void {
    if (!this.canKeep()) return;
    const keep = this.table.keep.slice();
    keep[i] = !keep[i];
    setKeep(this.table, keep);
  }

  private roll(): void {
    const state = this.state;
    if (state.result || !this.session.isHumanTurn() || state.rollsUsed === 3) return;
    this.session.play(state.rollsUsed === 0 ? YATZY_FIRST_ROLL : yatzyRoll(this.table.keep));
  }

  /**
   * The bands this scene draws in. The shout goes at `REST_Y` and so do the dice, and scoring
   * clears every keep first, so all five are sitting exactly where the message lands: "+24 Fours"
   * is read through the dice it is about, every single time a box is taken. Only a gallery shot
   * that happened to catch a roll mid-air made it look innocent.
   *
   * The dice band is measured off where they actually are rather than off `REST_Y`, because a
   * kept die sits higher and a rolling one is above the tray altogether.
   */
  /**
   * Whether the shout has ever landed on the dice, recorded at the instant it is said rather than
   * sampled afterwards. The first version of this asked from the outside every 250ms and came back
   * green, because the window is narrow: the shout lingers for over a second while the next
   * player's roll lifts the dice above the tray within a few hundred milliseconds, so a poll sees
   * plenty of shouts and almost never sees one with the dice still at rest. The moment that
   * matters is the moment it is said, so that is where it is measured.
   */
  private recordShout(): void {
    this.shouts++;
    const top = Math.min(...this.dice.map((die) => die.y - DIE / 2));
    const bottom = Math.max(...this.dice.map((die) => die.y + DIE / 2));
    const shoutTop = this.banner.y - this.banner.height / 2;
    const shoutBottom = this.banner.y + this.banner.height / 2;
    const say = (name: string, a: number, b: number) =>
      `shout (${Math.round(shoutTop)}-${Math.round(shoutBottom)}) on ${name} (${Math.round(a)}-${Math.round(b)})`;
    if (shoutTop < bottom && top < shoutBottom) this.clash = say('dice', top, bottom);
    // Moving it down puts it near the hint, so that is worth asking about too.
    const hintTop = this.hint.y - this.hint.height / 2;
    const hintBottom = this.hint.y + this.hint.height / 2;
    if (this.hint.alpha > 0.05 && shoutTop < hintBottom && hintTop < shoutBottom) this.clash = say('hint', hintTop, hintBottom);
  }

  layoutCheck(): { shouts: number; clash: string } {
    return { shouts: this.shouts, clash: this.clash };
  }

  /** Kept dice sit lifted with a sunny outline; the rest rest on the tray. */
  private placeDice(): void {
    const state = this.state;
    this.dice.forEach((die, i) => {
      const kept = state.rollsUsed > 0 && this.table.keep[i]!;
      drawFace(die, state.dice[i]!, kept);
      if (die.y < 0) return; // Still falling in.
      this.tweens.killTweensOf(die);
      this.tweens.add({ targets: die, y: kept ? KEPT_Y : REST_Y, angle: 0, duration: 180, ease: 'Back.easeOut' });
    });
    this.hint.setAlpha(this.canKeep() ? 0.55 : 0);
  }

  private shout(text: string, delay = 0): void {
    this.time.delayedCall(delay, () => {
      this.tweens.killTweensOf(this.banner);
      this.banner.setText(text).setAlpha(1).setScale(0.6);
      this.recordShout();
      this.tweens.add({ targets: this.banner, scale: 1, duration: 240, ease: 'Back.easeOut' });
      this.tweens.add({ targets: this.banner, alpha: 0, delay: 800, duration: 280 });
    });
  }

  private onChange(): void {
    const event = this.state.last;
    if (!event || event === this.seen) {
      this.placeDice();
      return;
    }
    this.seen = event;
    if (event.kind === 'roll') {
      setKeep(this.table, event.kept);
      // Rolled dice fall in one after another with a spin and a bounce.
      let n = 0;
      this.dice.forEach((die, i) => {
        if (event.kept[i]) return;
        const order = n++;
        this.tweens.killTweensOf(die);
        die.setPosition(dieX(i), -DIE).setAngle(160 + i * 45);
        drawFace(die, this.state.dice[i]!, false);
        this.tweens.add({ targets: die, y: REST_Y, duration: 460, delay: order * 60, ease: 'Bounce.easeOut' });
        this.tweens.add({
          targets: die,
          angle: 0,
          duration: 420,
          delay: order * 60,
          ease: 'Cubic.easeOut',
          onComplete: () => this.tweens.add({ targets: die, scaleX: 1.08, scaleY: 0.92, duration: 70, yoyo: true }),
        });
      });
      return;
    }
    setKeep(this.table, [false, false, false, false, false]);
    this.shout(event.points > 0 ? `+${event.points} ${YATZY_LABELS[event.box]}` : `0 in ${YATZY_LABELS[event.box]}`);
    if (event.bonus) this.shout('Bonus! +50', 1100);
    if (event.box === 'yatzy' && event.points > 0) this.burst();
  }

  /** A pop of candy confetti for a Yatzy. */
  private burst(): void {
    for (let i = 0; i < 28; i++) {
      const angle = (i / 28) * Math.PI * 2;
      const bit = this.add.circle(W / 2, REST_Y, 7, CONFETTI[i % CONFETTI.length]).setDepth(9);
      this.tweens.add({
        targets: bit,
        x: W / 2 + Math.cos(angle) * (160 + (i % 4) * 30),
        y: REST_Y + Math.sin(angle) * (90 + (i % 3) * 20) + 40,
        alpha: 0,
        duration: 900,
        ease: 'Cubic.easeOut',
        onComplete: () => bit.destroy(),
      });
    }
    this.cameras.main.shake(160, 0.005);
  }
}
