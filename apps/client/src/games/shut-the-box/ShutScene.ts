import { shutMove, type ShutEvent, type ShutMove, type ShutState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { ROOM_TONES, tone } from '../../look';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed } from '../../autoplay';
import { onKeys } from '../keys';
import { yatzyNames } from '../yatzy/table';

const W = 680;
const H = 380;
export const SHUT_SIZE = { width: W, height: H };

const RAIL_X = 40;
const RAIL_W = W - 80;
const TILE_TOP = 58;
const TILE_H = 112;
const GAP = 6;
const DIE = 76;
const DICE_Y = 292;
const INK = toHex(COLORS.ink);
const SUNNY = toHex(COLORS.sunny);
const WOOD = toHex(COLORS.peach);
const WOOD_DARK = toHex(DARK.peach);
const CONFETTI = [COLORS.tomato, COLORS.sunny, COLORS.mint, COLORS.sky, COLORS.grape, COLORS.bubblegum].map(toHex);
const PIPS: Record<number, readonly (readonly [number, number])[]> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

function drawDie(g: GameObjects.Graphics, value: number): void {
  g.clear();
  g.fillStyle(tone(0xdcd6ee, ROOM_TONES.line), 1);
  g.fillRoundedRect(-DIE / 2, -DIE / 2 + 6, DIE, DIE, 18);
  g.fillStyle(tone(0xffffff, ROOM_TONES.panel), 1);
  g.fillRoundedRect(-DIE / 2, -DIE / 2, DIE, DIE, 18);
  g.fillStyle(INK, 1);
  for (const [x, y] of PIPS[value] ?? []) g.fillCircle(x * 20, y * 20, 7.5);
}

/** Number keys pick tiles: 1–9, then 0, - and = for 10, 11 and 12. */
const KEY_TILE: Record<string, number> = { '0': 10, '-': 11, '=': 12 };

export class ShutScene extends Scene {
  private tiles: GameObjects.Graphics[] = [];
  private labels: GameObjects.Text[] = [];
  private dice: GameObjects.Graphics[] = [];
  private pickText!: GameObjects.Text;
  private banner!: GameObjects.Text;
  private shownOpen = 0;
  private picked = new Set<number>();
  private queue: ShutEvent[] = [];
  private running = false;
  private seen: ShutEvent | null = null;

  constructor(private readonly session: Session<ShutMove>) {
    super('shut-the-box');
  }

  private get state(): ShutState {
    return this.session.state as ShutState;
  }

  private get count(): number {
    return this.state.tiles;
  }

  private tileWidth(): number {
    return (RAIL_W - GAP * (this.count - 1)) / this.count;
  }

  private tileX(tile: number): number {
    return RAIL_X + (tile - 1) * (this.tileWidth() + GAP) + this.tileWidth() / 2;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    const state = this.state;
    this.shownOpen = state.open;
    this.seen = state.last;

    const box = this.add.graphics();
    box.fillStyle(WOOD_DARK, 1);
    box.fillRoundedRect(8, 16, W - 16, H - 24, 40);
    box.fillStyle(WOOD, 1);
    box.fillRoundedRect(8, 8, W - 16, H - 24, 40);
    box.fillStyle(0xffe9cf, 1);
    box.fillRoundedRect(RAIL_X - 14, TILE_TOP - 18, RAIL_W + 28, TILE_H + 36, 24);
    box.fillStyle(0xfff6ea, 1);
    box.fillRoundedRect(W / 2 - 150, DICE_Y - 62, 300, 124, 30);

    for (let tile = 1; tile <= this.count; tile++) {
      const x = this.tileX(tile);
      this.tiles[tile] = this.add.graphics().setPosition(x, TILE_TOP + TILE_H / 2);
      this.labels[tile] = sharpText(this, x, TILE_TOP + TILE_H / 2, String(tile), this.count > 9 ? 30 : 38, COLORS.ink).setFontStyle('bold');
      this.add
        .zone(x, TILE_TOP + TILE_H / 2, this.tileWidth() + GAP, TILE_H + 30)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.pick(tile));
    }
    this.dice = [0, 1].map((i) => this.add.graphics().setPosition(W / 2 + (i === 0 ? -52 : 52), DICE_Y).setVisible(false));
    this.pickText = sharpText(this, W / 2, TILE_TOP + TILE_H + 34, '', 20, COLORS.ink).setAlpha(0.75);
    this.banner = sharpText(this, W / 2, H / 2 + 10, '', 36, COLORS.ink).setDepth(10).setAlpha(0).setStroke('#ffffff', 10);
    if (state.dice.length) this.showDice(state.dice);
    this.drawTiles();

    // Keyboard: before a roll, Space, R or 2 rolls two dice and 1 rolls one (when allowed).
    // After a roll, number keys pick tiles (0, - and = for 10 to 12) and Backspace clears the pick.
    onKeys(this, (key) => {
      if (!this.session.isHumanTurn() || this.busy()) return false;
      const now = this.state;
      const onButton = document.activeElement instanceof HTMLButtonElement;
      if (now.phase === 'roll') {
        const moves = now.legalMoves(now.currentSeat);
        if (key === '1' && moves.includes('r1')) this.session.play('r1');
        else if (key === '2' || key === 'r' || key === 'R' || (key === ' ' && !onButton)) this.session.play('r2');
        else return false;
        return true;
      }
      if (key === 'Backspace') {
        this.picked.clear();
        this.drawTiles();
        return true;
      }
      const tile = KEY_TILE[key] ?? Number(key);
      if (Number.isInteger(tile) && tile >= 1 && tile <= this.count) {
        this.pick(tile);
        return true;
      }
      return false;
    });

    const unsubscribe = this.session.subscribe(() => this.onChange());
    this.events.once('shutdown', unsubscribe);
  }

  private busy(): boolean {
    return this.running || this.queue.length > 0;
  }

  /** Tap tiles to pick them; when the pick adds up to the roll, they shut. */
  private pick(tile: number): void {
    const state = this.state;
    if (state.result || state.phase !== 'shut' || this.busy() || !this.session.isHumanTurn() || !state.isOpen(tile)) return;
    if (this.picked.has(tile)) this.picked.delete(tile);
    else this.picked.add(tile);
    const sum = [...this.picked].reduce((a, b) => a + b, 0);
    if (sum > state.roll) {
      // Too much: shake the pick off.
      this.cameras.main.shake(90, 0.003);
      this.picked.clear();
    } else if (sum === state.roll) {
      const move = shutMove([...this.picked]);
      this.picked.clear();
      if (state.legalMoves(state.currentSeat).includes(move)) {
        this.session.play(move);
        return;
      }
    }
    this.drawTiles();
  }

  private drawTiles(): void {
    const w = this.tileWidth();
    for (let tile = 1; tile <= this.count; tile++) {
      const g = this.tiles[tile]!.clear();
      const open = ((this.shownOpen >> (tile - 1)) & 1) === 1;
      const picked = open && this.picked.has(tile);
      if (open) {
        g.fillStyle(0xe8dccb, 1);
        g.fillRoundedRect(-w / 2, -TILE_H / 2 + 7, w, TILE_H, 14);
        g.fillStyle(tone(0xffffff, ROOM_TONES.panel), 1);
        g.fillRoundedRect(-w / 2, -TILE_H / 2, w, TILE_H, 14);
        if (picked) {
          g.lineStyle(5, SUNNY, 1);
          g.strokeRoundedRect(-w / 2, -TILE_H / 2, w, TILE_H, 14);
        }
      } else {
        // A shut tile lies flat: a short dark block at the bottom of the rail.
        g.fillStyle(WOOD_DARK, 1);
        g.fillRoundedRect(-w / 2, TILE_H / 2 - 26, w, 26, 10);
      }
      const lift = picked ? -14 : 0;
      g.y = TILE_TOP + TILE_H / 2 + lift;
      this.labels[tile]!.setVisible(open).setY(TILE_TOP + TILE_H / 2 + lift);
    }
    const state = this.state;
    const sum = [...this.picked].reduce((a, b) => a + b, 0);
    const mine = state.phase === 'shut' && !state.result && this.session.isHumanTurn() && !this.busy();
    this.pickText.setText(mine ? (this.picked.size ? `${[...this.picked].sort((a, b) => a - b).join(' + ')} = ${sum} of ${state.roll}` : `Pick tiles that add up to ${state.roll}`) : '');
  }

  private showDice(dice: readonly number[]): void {
    this.dice.forEach((die, i) => {
      const value = dice[i];
      die.setVisible(value !== undefined);
      if (value !== undefined) drawDie(die, value);
      die.x = dice.length === 1 ? W / 2 : W / 2 + (i === 0 ? -52 : 52);
    });
  }

  private shout(text: string): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 240, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 1000, duration: 280 });
  }

  private onChange(): void {
    const event = this.state.last;
    if (event && event !== this.seen) {
      this.seen = event;
      this.queue.push(event);
    }
    this.next();
  }

  private next(): void {
    if (this.running) return;
    const event = this.queue.shift();
    if (!event) {
      this.shownOpen = this.state.open;
      this.drawTiles();
      return;
    }
    this.running = true;
    this.drawTiles();
    const done = () => {
      this.running = false;
      this.next();
    };
    if (event.kind === 'roll') this.animateRoll(event, done);
    else this.animateShut(event, done);
  }

  private animateRoll(event: Extract<ShutEvent, { kind: 'roll' }>, done: () => void): void {
    this.showDice(event.dice);
    this.dice.forEach((die, i) => {
      if (i >= event.dice.length) return;
      this.tweens.killTweensOf(die);
      die.setY(DICE_Y - 150).setAngle(150 + i * 70);
      this.tweens.add({ targets: die, y: DICE_Y, duration: 440, delay: i * 70, ease: 'Bounce.easeOut' });
      this.tweens.add({ targets: die, angle: 0, duration: 400, delay: i * 70, ease: 'Cubic.easeOut' });
    });
    const landed = 440 + 70 * event.dice.length;
    if (!event.stuck) {
      this.time.delayedCall(landed, done);
      return;
    }
    this.time.delayedCall(landed, () => {
      const total = event.dice.reduce((a, b) => a + b, 0);
      const players = this.state.scores.length;
      const who = players === 1 ? '' : `${yatzyNames(players)[event.seat]}: `;
      this.shout(`${who}no way to make ${total}. ${event.score} points`);
      this.cameras.main.shake(160, 0.005);
      // The next player gets a fresh box: every tile flips back up.
      this.time.delayedCall(1300, () => {
        if (!this.state.result || this.state.last !== event) {
          this.shownOpen = (1 << this.count) - 1;
          for (let tile = 1; tile <= this.count; tile++) {
            this.tiles[tile]!.setScale(1, 0.2);
            this.tweens.add({ targets: this.tiles[tile], scaleY: 1, duration: 220, delay: tile * 25, ease: 'Back.easeOut' });
          }
        }
        this.drawTiles();
        done();
      });
    });
  }

  private animateShut(event: Extract<ShutEvent, { kind: 'shut' }>, done: () => void): void {
    // Lift the chosen tiles, then flip them down one by one with a clack.
    for (const tile of event.tiles) this.picked.add(tile);
    this.drawTiles();
    event.tiles.forEach((tile, i) => {
      this.time.delayedCall(160 + i * 110, () => {
        this.picked.delete(tile);
        this.shownOpen &= ~(1 << (tile - 1));
        this.drawTiles();
        const g = this.tiles[tile]!;
        g.setScale(1.1, 1.6);
        this.tweens.add({ targets: g, scaleX: 1, scaleY: 1, duration: 200, ease: 'Back.easeOut' });
      });
    });
    const flipped = 160 + event.tiles.length * 110 + 120;
    this.time.delayedCall(flipped, () => {
      if (event.shutBox) {
        const players = this.state.scores.length;
        this.shout(players === 1 ? 'You shut the box!' : `${yatzyNames(players)[event.seat]} shut the box!`);
        this.burst();
      }
      done();
    });
  }

  private burst(): void {
    for (let i = 0; i < 30; i++) {
      const angle = (i / 30) * Math.PI * 2;
      const bit = this.add.circle(W / 2, H / 2, 7, CONFETTI[i % CONFETTI.length]).setDepth(9);
      this.tweens.add({
        targets: bit,
        x: W / 2 + Math.cos(angle) * (180 + (i % 4) * 30),
        y: H / 2 + Math.sin(angle) * (110 + (i % 3) * 20),
        alpha: 0,
        duration: 900,
        ease: 'Cubic.easeOut',
        onComplete: () => bit.destroy(),
      });
    }
  }
}
