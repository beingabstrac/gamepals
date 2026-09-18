import { BOARD_SIZE, type Slide, type Tile, type Twenty48State } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed } from '../../autoplay';
const SIZE = 600;
export const TWENTY48_SIZE = { width: SIZE, height: SIZE };

const GAP = 16;
const CELL = (SIZE - GAP * (BOARD_SIZE + 1)) / BOARD_SIZE;
const SLIDE_MS = 120;
const SWIPE_MIN = 30;

/** Tile colors climb the candy palette as numbers grow. */
const STYLE: Record<number, { fill: string; text: string }> = {
  2: { fill: '#FFF4E0', text: COLORS.ink },
  4: { fill: '#FFE3C4', text: COLORS.ink },
  8: { fill: COLORS.peach, text: '#ffffff' },
  16: { fill: COLORS.tomato, text: '#ffffff' },
  32: { fill: COLORS.bubblegum, text: '#ffffff' },
  64: { fill: COLORS.grape, text: '#ffffff' },
  128: { fill: COLORS.sky, text: '#ffffff' },
  256: { fill: COLORS.mint, text: '#ffffff' },
  512: { fill: COLORS.sunny, text: COLORS.ink },
  1024: { fill: DARK.grape, text: '#ffffff' },
  2048: { fill: COLORS.ink, text: COLORS.sunny },
};
const styleFor = (value: number) => STYLE[value] ?? { fill: COLORS.ink, text: COLORS.sunny };

const cellPos = (index: number) => ({
  x: GAP + (index % BOARD_SIZE) * (CELL + GAP) + CELL / 2,
  y: GAP + Math.floor(index / BOARD_SIZE) * (CELL + GAP) + CELL / 2,
});

export class Twenty48Scene extends Scene {
  private views = new Map<number, GameObjects.Container>();
  private start: { x: number; y: number } | null = null;
  /** The half of a move that waits for the glide: merged tiles and the new one. */
  private landing?: { timer: ReturnType<Scene['time']['delayedCall']>; run: () => void };

  constructor(private readonly session: Session<Slide>) {
    super('2048');
  }

  private get state(): Twenty48State {
    return this.session.state as Twenty48State;
  }

  create(): void {
    fitCamera(this, SIZE, SIZE);
    applySpeed(this);
    this.drawBoard();
    for (const tile of this.state.tiles) this.addTile(tile, true);

    // Swipe anywhere; arrow keys on desktop.
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      this.start = { x: p.worldX, y: p.worldY };
    });
    this.input.on('pointerup', (p: { worldX: number; worldY: number }) => {
      if (!this.start) return;
      const dx = p.worldX - this.start.x;
      const dy = p.worldY - this.start.y;
      this.start = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
      this.move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
    });
    const keys: Record<string, Slide> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      const slide = keys[event.key];
      if (slide) this.move(slide);
    });

    const unsubscribe = this.session.subscribe(() => this.animate());
    this.events.once('shutdown', unsubscribe);
  }

  private move(slide: Slide): void {
    if (!this.state.legalMoves(0).includes(slide)) {
      // A blocked swipe gets a tiny nudge so it doesn't feel ignored.
      const nudge = { up: [0, -6], down: [0, 6], left: [-6, 0], right: [6, 0] }[slide];
      this.tweens.add({ targets: this.cameras.main, scrollX: this.cameras.main.scrollX - nudge[0]! * 0.5, scrollY: this.cameras.main.scrollY - nudge[1]! * 0.5, duration: 60, yoyo: true });
      return;
    }
    this.session.play(slide);
  }

  private animate(): void {
    // A second move before the last one has landed: land it now. The tiles a merge makes only
    // exist once it lands, and the next move looks them up by name, so a move that overtakes
    // one leaves tiles that never arrive and tiles that never move again.
    this.land();
    const change = this.state.lastChange;
    if (!change) return;
    // 1. Every tile glides to its new cell.
    for (const move of change.moved) {
      const view = this.views.get(move.id);
      if (!view) continue;
      const to = cellPos(move.to);
      this.tweens.add({ targets: view, x: to.x, y: to.y, duration: SLIDE_MS, ease: 'Quad.easeOut' });
    }
    const run = () => {
      // 2. Merged pairs become one bigger tile that pops.
      for (const merge of change.merged) {
        for (const id of merge.from) {
          const old = this.views.get(id);
          if (old) {
            this.tweens.killTweensOf(old);
            old.destroy();
          }
          this.views.delete(id);
        }
        const view = this.addTile({ id: merge.id, value: merge.value, index: merge.at }, false);
        view.setScale(1.22);
        this.tweens.add({ targets: view, scale: 1, duration: 220, ease: 'Back.easeOut' });
      }
      // 3. The new tile springs in.
      if (change.spawned) {
        const view = this.addTile(change.spawned, false);
        view.setScale(0);
        this.tweens.add({ targets: view, scale: 1, duration: 260, ease: 'Back.easeOut' });
      }
      if (change.merged.length > 0 && change.merged.some((m) => m.value >= 128)) this.cameras.main.shake(90, 0.003);
    };
    this.landing = { timer: this.time.delayedCall(SLIDE_MS, () => this.land()), run };
  }

  /** Finishes the move that is still gliding, whether its time is up or a new move is here. */
  private land(): void {
    const landing = this.landing;
    if (!landing) return;
    this.landing = undefined;
    landing.timer.remove();
    landing.run();
  }

  /**
   * Test mode only: what is on the screen against what the rules say is on the board.
   * A screen that has drifted from the state is the bug this game had, and a picture alone
   * cannot tell you it is back.
   */
  tileCheck(): { drawn: number; real: number } {
    this.land();
    return { drawn: this.views.size, real: this.state.tiles.length };
  }

  private addTile(tile: Tile, instant: boolean): GameObjects.Container {
    const { x, y } = cellPos(tile.index);
    const style = styleFor(tile.value);
    const g = this.add.graphics();
    g.fillStyle(0x2b2a3a, 0.08);
    g.fillRoundedRect(-CELL / 2, -CELL / 2 + 5, CELL, CELL, 22);
    g.fillStyle(toHex(style.fill), 1);
    g.fillRoundedRect(-CELL / 2, -CELL / 2, CELL, CELL, 22);
    const size = tile.value < 100 ? 60 : tile.value < 1000 ? 50 : 40;
    const label = sharpText(this, 0, 2, String(tile.value), size, style.text);
    const view = this.add.container(x, y, [g, label]);
    if (instant) {
      view.setScale(0);
      this.tweens.add({ targets: view, scale: 1, duration: 300, ease: 'Back.easeOut' });
    }
    this.views.set(tile.id, view);
    return view;
  }

  private drawBoard(): void {
    const g = this.add.graphics();
    g.fillStyle(0xe7e1f5, 1);
    g.fillRoundedRect(0, 8, SIZE, SIZE - 8, 32);
    g.fillStyle(0xf3effb, 1);
    g.fillRoundedRect(0, 0, SIZE, SIZE - 8, 32);
    for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
      const { x, y } = cellPos(i);
      g.fillStyle(0xe7e1f5, 1);
      g.fillRoundedRect(x - CELL / 2, y - CELL / 2, CELL, CELL, 22);
    }
  }
}
