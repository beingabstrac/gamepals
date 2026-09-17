import { cellsOf, seaCol, FLEET, fireMove, HIT, MISS, placeShip, seaRow, SEA_SIZE, type Placement, type SeaEvent, type SeaMove, type SeaBattleState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed } from '../../autoplay';
import { arrow, isPress, onKeys } from '../keys';
import { tableFor, turnShip, type SeaTable } from './table';

const CELL = 30;
const GRID = CELL * SEA_SIZE;
const W = 380;
const H = 760;
export const SEA_BATTLE_SIZE = { width: W, height: H };
export const SEA_NAMES = ['Blue', 'Red'];
export const SEA_COLORS = [COLORS.sky, COLORS.tomato];

const LEFT = (W - GRID) / 2;
const THEIRS_Y = 56;
const MINE_Y = 430;
const WATER = 0xdff1ff;
const WATER_LINE = 0xb9d9f2;
const SHIP = 0x8d93a8;
const SHIP_DOWN = 0x4b4a5c;
const SUNNY = toHex(COLORS.sunny);
const TOMATO = toHex(COLORS.tomato);

type Grid = 'theirs' | 'mine';

export class SeaScene extends Scene {
  private boardG!: GameObjects.Graphics;
  private markG!: GameObjects.Graphics;
  private coverG!: GameObjects.Graphics;
  private coverText!: GameObjects.Text;
  private banner!: GameObjects.Text;
  private titles: GameObjects.Text[] = [];
  private cursor = 0;
  private ringVisible = false;
  private table!: SeaTable;
  private revealed: number | null = null;
  private seen: SeaEvent | null = null;

  constructor(private readonly session: Session<SeaMove>) {
    super('sea-battle');
  }

  private get state(): SeaBattleState {
    return this.session.state as SeaBattleState;
  }

  private people(): number[] {
    return this.session.seats.flatMap((seat, i) => (seat.kind === 'human' ? [i] : []));
  }

  /** Whose grids are on show. With one person it is always theirs; with two, only after they tap. */
  private viewer(): number | null {
    const people = this.people();
    if (people.length === 1) return people[0]!;
    const seat = this.state.currentSeat;
    return people.length > 1 && this.revealed === seat ? seat : null;
  }

  private covered(): boolean {
    const people = this.people();
    return people.length > 1 && people.includes(this.state.currentSeat) && this.revealed !== this.state.currentSeat && !this.state.result;
  }

  private myTurn(): boolean {
    return !this.state.result && this.session.isHumanTurn() && this.viewer() === this.state.currentSeat;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.seen = this.state.last;
    this.table = tableFor(this.session);
    const onTurn = () => this.draw();
    this.table.listeners.add(onTurn);
    this.events.once('shutdown', () => this.table.listeners.delete(onTurn));
    this.boardG = this.add.graphics();
    this.markG = this.add.graphics().setDepth(2);
    this.coverG = this.add.graphics().setDepth(20);
    this.titles = [
      sharpText(this, W / 2, THEIRS_Y - 22, '', 20, COLORS.ink),
      sharpText(this, W / 2, MINE_Y - 22, '', 20, COLORS.ink),
    ];
    this.coverText = sharpText(this, W / 2, H / 2, '', 22, COLORS.ink).setDepth(21);
    this.banner = sharpText(this, W / 2, H / 2, '', 30, COLORS.ink).setDepth(10).setAlpha(0).setStroke('#ffffff', 10);

    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.tap(p.worldX, p.worldY));
    onKeys(this, (key) => this.key(key));

    const unsubscribe = this.session.subscribe(() => this.onChange());
    this.events.once('shutdown', unsubscribe);
    this.draw();
  }

  private gridTop = (grid: Grid) => (grid === 'theirs' ? THEIRS_Y : MINE_Y);
  private cellCenter = (grid: Grid, cell: number) => ({
    x: LEFT + (seaCol(cell) + 0.5) * CELL,
    y: this.gridTop(grid) + (seaRow(cell) + 0.5) * CELL,
  });

  private cellAt(x: number, y: number): { grid: Grid; cell: number } | null {
    for (const grid of ['theirs', 'mine'] as const) {
      const top = this.gridTop(grid);
      if (x < LEFT || x > LEFT + GRID || y < top || y > top + GRID) continue;
      const col = Math.floor((x - LEFT) / CELL);
      const row = Math.floor((y - top) / CELL);
      return { grid, cell: row * SEA_SIZE + col };
    }
    return null;
  }

  /** The ship this player still has to put down. */
  private pending(): number | null {
    const state = this.state;
    if (state.phase !== 'place') return null;
    const placed = state.fleets[state.currentSeat]!.length;
    return placed < FLEET.length ? placed : null;
  }

  private tap(x: number, y: number): void {
    if (this.covered()) {
      this.revealed = this.state.currentSeat;
      this.draw();
      return;
    }
    if (!this.myTurn()) return;
    const found = this.cellAt(x, y);
    if (!found) return;
    const state = this.state;
    if (state.phase === 'place') {
      if (found.grid !== 'mine') return;
      this.place(found.cell);
      return;
    }
    if (found.grid !== 'theirs') return;
    const move = fireMove(seaRow(found.cell), seaCol(found.cell));
    if (state.legalMoves(state.currentSeat).includes(move)) this.session.play(move);
  }

  private place(cell: number): void {
    const move = placeShip(seaRow(cell), seaCol(cell), this.table.horizontal);
    if (this.state.legalMoves(this.state.currentSeat).includes(move)) {
      this.session.play(move);
      return;
    }
    this.shout('It does not fit there');
  }

  private key(key: string): boolean {
    if (this.covered() && isPress(key)) {
      this.revealed = this.state.currentSeat;
      this.draw();
      return true;
    }
    if (!this.myTurn()) return false;
    if (key === 'r' || key === 'R') {
      turnShip(this.table);
      return true;
    }
    const step = arrow(key);
    if (step) {
      const col = Math.min(SEA_SIZE - 1, Math.max(0, seaCol(this.cursor) + step[0]));
      const row = Math.min(SEA_SIZE - 1, Math.max(0, seaRow(this.cursor) + step[1]));
      this.cursor = row * SEA_SIZE + col;
      this.ringVisible = true;
      this.draw();
      return true;
    }
    if (isPress(key)) {
      this.ringVisible = true;
      if (this.state.phase === 'place') this.place(this.cursor);
      else {
        const move = fireMove(seaRow(this.cursor), seaCol(this.cursor));
        if (this.state.legalMoves(this.state.currentSeat).includes(move)) this.session.play(move);
      }
      return true;
    }
    return false;
  }

  private drawGrid(g: GameObjects.Graphics, grid: Grid): void {
    const top = this.gridTop(grid);
    g.fillStyle(WATER_LINE, 1);
    g.fillRoundedRect(LEFT - 6, top - 2, GRID + 12, GRID + 12, 12);
    g.fillStyle(WATER, 1);
    g.fillRoundedRect(LEFT - 6, top - 6, GRID + 12, GRID + 12, 12);
    g.lineStyle(1.5, WATER_LINE, 1);
    for (let i = 0; i <= SEA_SIZE; i++) {
      g.lineBetween(LEFT + i * CELL, top, LEFT + i * CELL, top + GRID);
      g.lineBetween(LEFT, top + i * CELL, LEFT + GRID, top + i * CELL);
    }
  }

  /** A ship as one rounded block across its squares. */
  private drawShip(g: GameObjects.Graphics, grid: Grid, placement: Placement, down: boolean): void {
    const top = this.gridTop(grid);
    const size = FLEET[placement.ship]!.size;
    const x = LEFT + placement.col * CELL + 4;
    const y = top + placement.row * CELL + 4;
    const w = (placement.horizontal ? size * CELL : CELL) - 8;
    const h = (placement.horizontal ? CELL : size * CELL) - 8;
    g.fillStyle(down ? SHIP_DOWN : SHIP, 1);
    g.fillRoundedRect(x, y, w, h, 9);
  }

  private draw(): void {
    const state = this.state;
    const viewer = this.viewer();
    const seat = viewer ?? state.currentSeat;
    const other = seat === 0 ? 1 : 0;
    const g = this.boardG.clear();
    const marks = this.markG.clear();
    this.drawGrid(g, 'theirs');
    this.drawGrid(g, 'mine');
    const placing = state.phase === 'place';
    this.titles[0]!.setText(placing ? 'Their waters' : `${SEA_NAMES[other]}'s fleet`);
    this.titles[1]!.setText(placing ? `Place your fleet: the ${FLEET[this.pending() ?? 0]!.name}` : 'Your fleet');

    if (viewer !== null) {
      // Their grid: only what our shots have found, plus any ship that has gone down.
      const shots = state.shots[seat]!;
      for (const placement of state.fleets[other]!) {
        if (state.sunkShips(other).includes(placement.ship)) this.drawShip(g, 'theirs', placement, true);
      }
      shots.forEach((value, cell) => {
        if (value === MISS) {
          const { x, y } = this.cellCenter('theirs', cell);
          marks.fillStyle(0xffffff, 0.9);
          marks.fillCircle(x, y, 5);
        } else if (value === HIT) {
          const { x, y } = this.cellCenter('theirs', cell);
          marks.fillStyle(TOMATO, 1);
          for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI;
            marks.lineStyle(4, TOMATO, 1);
            marks.lineBetween(x - Math.cos(angle) * 9, y - Math.sin(angle) * 9, x + Math.cos(angle) * 9, y + Math.sin(angle) * 9);
          }
        }
      });

      // Our grid: our ships, and what they have fired at us.
      for (const placement of state.fleets[seat]!) {
        this.drawShip(g, 'mine', placement, state.sunkShips(seat).includes(placement.ship));
      }
      state.shots[other]!.forEach((value, cell) => {
        const { x, y } = this.cellCenter('mine', cell);
        if (value === MISS) {
          marks.fillStyle(0xffffff, 0.9);
          marks.fillCircle(x, y, 5);
        } else if (value === HIT) {
          marks.fillStyle(TOMATO, 1);
          marks.fillCircle(x, y, 7);
          marks.lineStyle(3, 0xffffff, 0.9);
          marks.strokeCircle(x, y, 7);
        }
      });

      // The ship waiting to go down, shown where it would land.
      const pending = this.pending();
      if (pending !== null && this.myTurn()) {
        const preview: Placement = { ship: pending, row: seaRow(this.cursor), col: seaCol(this.cursor), horizontal: this.table.horizontal };
        const fits = state.legalMoves(seat).includes(placeShip(preview.row, preview.col, this.table.horizontal));
        marks.fillStyle(fits ? SUNNY : TOMATO, 0.45);
        for (const cell of cellsOf(preview)) {
          if (cell < 0 || cell >= SEA_SIZE * SEA_SIZE) continue;
          if (preview.horizontal && seaRow(cell) !== preview.row) continue;
          const { x, y } = this.cellCenter('mine', cell);
          marks.fillRect(x - CELL / 2 + 2, y - CELL / 2 + 2, CELL - 4, CELL - 4);
        }
      }
    }

    if (this.ringVisible && viewer !== null) {
      const grid: Grid = state.phase === 'place' ? 'mine' : 'theirs';
      const { x, y } = this.cellCenter(grid, this.cursor);
      marks.lineStyle(3, toHex(COLORS.grape), 1);
      marks.strokeRoundedRect(x - CELL / 2 + 1, y - CELL / 2 + 1, CELL - 2, CELL - 2, 5);
    }

    const covered = this.covered();
    const cover = this.coverG.clear();
    if (covered) {
      cover.fillStyle(toHex(DARK.grape), 1);
      cover.fillRoundedRect(8, 8, W - 16, H - 16, 24);
    }
    this.coverText
      .setText(covered ? `${SEA_NAMES[state.currentSeat]}, tap when the others are not looking` : '')
      .setColor('#ffffff');
  }

  private shout(text: string): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setAlpha(1).setScale(0.7);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 800, duration: 260 });
  }

  private onChange(): void {
    const event = this.state.last;
    if (event && event !== this.seen) {
      this.seen = event;
      if (this.people().length > 1) this.revealed = null;
      if (event.kind === 'fire') {
        if (event.sunk !== undefined) {
          const sinker = event.seat === this.viewer() ? 'You sank their' : 'Down:';
          this.shout(`${sinker} ${FLEET[event.sunk]!.name}`);
          this.cameras.main.shake(200, 0.006);
        } else if (event.hit) {
          this.shout('Hit!');
          this.cameras.main.shake(110, 0.003);
        }
      }
    }
    this.draw();
  }
}
