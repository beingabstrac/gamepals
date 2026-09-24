import { housesOf, sowMove, storeOf, type MancalaEvent, type MancalaMove, type MancalaState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed } from '../../autoplay';
import { focusRing, isPress, moveRing, onKeys } from '../keys';

const W = 720;
const H = 420;
export const MANCALA_SIZE = { width: W, height: H };

const MARGIN = 24;
const STORE_W = 78;
const PIT = 76;
const GAP = (W - MARGIN * 2 - STORE_W * 2 - PIT * 6) / 7;
const ROW_Y = [H / 2 + 72, H / 2 - 72];
const HOP_MS = 150;
const SEED_COLORS = [COLORS.tomato, COLORS.sky, COLORS.mint, COLORS.sunny, COLORS.grape, COLORS.bubblegum, COLORS.peach].map(toHex);
/** Blue sits on the bottom row, red on the top row, like our other two-player games. */
const SIDE = [toHex(COLORS.sky), toHex(COLORS.tomato)];

/** Screen position of a pit (0–5 bottom row left to right, 7–12 top row right to left, stores at the ends). */
function spot(pit: number): { x: number; y: number } {
  if (pit === 6) return { x: W - MARGIN - STORE_W / 2, y: H / 2 };
  if (pit === 13) return { x: MARGIN + STORE_W / 2, y: H / 2 };
  const col = pit < 6 ? pit : 12 - pit;
  return { x: MARGIN + STORE_W + GAP + col * (PIT + GAP) + PIT / 2, y: pit < 6 ? ROW_Y[0]! : ROW_Y[1]! };
}

export class MancalaScene extends Scene {
  private shown: number[] = [];
  /** Bumped by every sowing, so an older one still in the air stops writing to the board. */
  private generation = 0;
  private seedLayer!: GameObjects.Graphics;
  private glow!: GameObjects.Graphics;
  private counts: GameObjects.Text[] = [];
  private banner!: GameObjects.Text;
  private sowing = false;
  private overlaps = 0;
  private cursor = 0;
  private ring!: GameObjects.Graphics;

  constructor(private readonly session: Session<MancalaMove>) {
    super('mancala');
  }

  private get state(): MancalaState {
    return this.session.state as MancalaState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.shown = this.state.pits.slice();
    this.drawBoard();
    this.glow = this.add.graphics().setDepth(1);
    this.seedLayer = this.add.graphics().setDepth(2);
    for (let pit = 0; pit < 14; pit++) {
      const { x, y } = spot(pit);
      const isStore = pit === 6 || pit === 13;
      const dy = isStore ? 0 : pit < 6 ? PIT / 2 + 18 : -PIT / 2 - 18;
      this.counts[pit] = sharpText(this, x, isStore ? y + 110 : y + dy, '0', isStore ? 30 : 22, COLORS.ink).setDepth(3).setFontStyle('bold');
    }
    this.banner = sharpText(this, W / 2, H / 2, '', 34, COLORS.ink).setDepth(10).setAlpha(0);
    this.redraw();

    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      for (const pit of housesOf(this.state.currentSeat)) {
        const { x, y } = spot(pit);
        if (Math.hypot(p.worldX - x, p.worldY - y) <= PIT / 2 + 10) {
          this.play(pit);
          return;
        }
      }
    });

    // Keyboard: 1–6 pick the current player's houses from left to right on screen, or arrows and Enter.
    this.ring = focusRing(this, PIT + 14, PIT + 14, (PIT + 14) / 2);
    onKeys(this, (key) => {
      const row = this.rowLeftToRight();
      if (/^[1-6]$/.test(key)) {
        this.play(row[Number(key) - 1]!);
        return true;
      }
      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        this.cursor = Math.min(5, Math.max(0, this.cursor + (key === 'ArrowLeft' ? -1 : 1)));
        const { x, y } = spot(row[this.cursor]!);
        moveRing(this, this.ring, x, y);
        return true;
      }
      if (isPress(key) && this.ring.visible) {
        this.play(row[this.cursor]!);
        return true;
      }
      return false;
    });

    const unsubscribe = this.session.subscribe(() => this.onChange());
    // A bot waits for the last sowing to land, so two never run over each other.
    this.session.holdBots = () => this.sowing;
    this.events.once('shutdown', () => {
      unsubscribe();
      this.session.holdBots = null;
    });
  }

  /** Still sowing: the result sheet and the gallery wait for the seeds to land. */
  busy(): boolean {
    return this.sowing;
  }

  /** The current player's houses in screen order, left to right. */
  private rowLeftToRight(): number[] {
    return this.state.currentSeat === 0 ? housesOf(0) : [...housesOf(1)].reverse();
  }

  private play(pit: number): void {
    if (this.sowing || !this.session.isHumanTurn()) return;
    const move = sowMove(pit);
    if (this.state.legalMoves(this.state.currentSeat).includes(move)) this.session.play(move);
  }

  private drawBoard(): void {
    const g = this.add.graphics();
    g.fillStyle(toHex(DARK.peach), 1);
    g.fillRoundedRect(8, 16, W - 16, H - 24, 48);
    g.fillStyle(toHex(COLORS.peach), 1);
    g.fillRoundedRect(8, 8, W - 16, H - 24, 48);
    for (let pit = 0; pit < 14; pit++) {
      const { x, y } = spot(pit);
      const owner = pit <= 6 ? 0 : 1;
      g.fillStyle(0xffffff, 0.9);
      if (pit === 6 || pit === 13) {
        g.fillRoundedRect(x - STORE_W / 2 + 6, y - 150, STORE_W - 12, 300, 34);
        g.lineStyle(5, SIDE[owner]!, 1);
        g.strokeRoundedRect(x - STORE_W / 2 + 6, y - 150, STORE_W - 12, 300, 34);
      } else {
        g.fillCircle(x, y, PIT / 2);
        g.lineStyle(4, SIDE[owner]!, 0.8);
        g.strokeCircle(x, y, PIT / 2);
      }
    }
  }

  /** Seeds as candy pebbles, laid out in rings; counts under each pit. */
  private redraw(): void {
    const g = this.seedLayer.clear();
    this.shown.forEach((count, pit) => {
      const { x, y } = spot(pit);
      const isStore = pit === 6 || pit === 13;
      const shownSeeds = Math.min(count, isStore ? 36 : 16);
      for (let i = 0; i < shownSeeds; i++) {
        const ring = i < 1 ? 0 : i < 7 ? 1 : i < 16 ? 2 : 3;
        const inRing = ring === 0 ? 1 : ring === 1 ? 6 : ring === 2 ? 9 : 20;
        const index = ring === 0 ? 0 : ring === 1 ? i - 1 : ring === 2 ? i - 7 : i - 16;
        const angle = (index / inRing) * Math.PI * 2 + ring;
        const radius = ring * 11;
        const sx = x + Math.cos(angle) * radius * (isStore ? 0.9 : 1);
        const sy = y + Math.sin(angle) * radius * (isStore ? 2.6 : 1);
        g.fillStyle(0x2b2a3a, 0.15);
        g.fillCircle(sx, sy + 2, 6.5);
        g.fillStyle(SEED_COLORS[(pit * 3 + i) % SEED_COLORS.length]!, 1);
        g.fillCircle(sx, sy, 6.5);
      }
      this.counts[pit]!.setText(String(count));
    });
    this.drawGlow();
  }

  /** The houses a person can play glow softly. */
  private drawGlow(): void {
    const g = this.glow.clear();
    const state = this.state;
    if (this.sowing || state.result || !this.session.isHumanTurn()) return;
    for (const move of state.legalMoves(state.currentSeat)) {
      const { x, y } = spot(Number(move.slice(1)));
      g.fillStyle(toHex(COLORS.sunny), 0.35);
      g.fillCircle(x, y, PIT / 2 + 8);
    }
  }

  private shout(text: string): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setAlpha(1).setScale(0.7);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 240, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 900, duration: 300 });
  }

  /**
   * The seeds the board is showing against the seeds the state holds, for the board check.
   * Mancala keeps a copy of the pits and walks it as the hopper lands, which is the shape that
   * broke Snakes & Ladders and Shut the Box. It is safe here because every animation ends by
   * snapping back to the state rather than trusting its own arithmetic, and this is what says so.
   */
  boardCheck(): { behind: number; walking: boolean; sowings: number; moves: number; overlaps: number } {
    const truth = this.state.pits;
    const behind = this.shown.reduce((worst, seeds, pit) => Math.max(worst, Math.abs(seeds - (truth[pit] ?? 0))), 0);
    return { behind, walking: this.sowing, sowings: this.generation, moves: this.session.moves.length, overlaps: this.overlaps };
  }

  private onChange(): void {
    const event = this.state.last;
    if (!event) {
      this.shown = this.state.pits.slice();
      this.redraw();
      return;
    }
    this.animate(event);
  }

  /**
   * One pebble hops along the path, the counts rising as it lands; then any capture or end sweep.
   *
   * Every callback below checks its era first. Nothing stopped two sowings overlapping, and the
   * first one to finish would snap the board to the state and clear `sowing` while the second was
   * still in the air, so its remaining hops then counted seeds onto an already-correct board. The
   * check measured it settling three seeds out.
   */
  private animate(event: MancalaEvent): void {
    const era = ++this.generation;
    // A sowing started while the last is still in the air: the board check counts these.
    if (this.sowing) this.overlaps++;
    this.sowing = true;
    this.glow.clear();
    this.shown[event.pit] = 0;
    this.redraw();
    const hopper = this.add.circle(spot(event.pit).x, spot(event.pit).y, 9, toHex(COLORS.sunny)).setStrokeStyle(3, 0xffffff).setDepth(5);
    event.path.forEach((pit, i) => {
      this.time.delayedCall(i * HOP_MS, () => {
        if (era !== this.generation) return;
        const from = i === 0 ? spot(event.pit) : spot(event.path[i - 1]!);
        const to = spot(pit);
        this.tweens.addCounter({
          from: 0,
          to: 1,
          duration: HOP_MS - 10,
          ease: 'Sine.easeInOut',
          onUpdate: (tween) => {
            const t = tween.getValue() ?? 1;
            hopper.setPosition(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t - Math.sin(Math.PI * t) * 24);
          },
          onComplete: () => {
            if (era !== this.generation) return;
            this.shown[pit]!++;
            this.redraw();
            if (pit === 6 || pit === 13) this.tweens.add({ targets: this.counts[pit], scale: 1.3, duration: 90, yoyo: true });
          },
        });
      });
    });
    const sown = event.path.length * HOP_MS + 60;
    this.time.delayedCall(sown, () => {
      hopper.destroy();
      // A newer sowing is under way, so this one does not get to say where the board stands.
      if (era !== this.generation) return;
      if (event.capture) {
        // Both piles slide into the store with a little burst.
        const landing = event.path[event.path.length - 1]!;
        this.shown[event.capture.from] = 0;
        this.shown[landing] = 0;
        this.shown[storeOf(event.seat)]! += event.capture.seeds;
        this.cameras.main.shake(120, 0.004);
        this.shout(`Capture! ${event.capture.seeds} seeds`);
      } else if (event.extraTurn) {
        this.shout('Last seed in your store, go again!');
      }
      if (event.swept) {
        this.shown = this.state.pits.slice();
        this.shout('One side is empty. Game over!');
      }
      this.shown = this.state.pits.slice();
      this.sowing = false;
      this.redraw();
    });
  }
}
