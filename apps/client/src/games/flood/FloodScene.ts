import { FLOOD_COLOURS, type FloodMove, type FloodState, type Seat } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { isPerson } from '../duel';
import { arrow, focusRing, isPress, moveRing, onKeys } from '../keys';

const W = 720;
const H = 1040;
export const FLOOD_SIZE = { width: W, height: H };

const PAD = 14;
const GAP = 3;
/** Height of a row of colours, and the space between it and the board. */
const BAND = 120;
const BAND_GAP = 18;
/** How long a square that has just joined takes to drop into place. */
const LAND_MS = 260;
/** The flood's wave: how much later each step away from the corner changes, and the most it waits. */
const WAVE_STEP = 16;
const WAVE_MAX = 440;

/** The six colours, in move order. Bright and far apart, so none is mistaken for another. */
export const FLOOD_PALETTE = [COLORS.tomato, COLORS.sunny, COLORS.mint, COLORS.sky, COLORS.grape, COLORS.bubblegum];
const FILL = FLOOD_PALETTE.map(toHex);
const LIP = [DARK.tomato, DARK.sunny, DARK.mint, DARK.sky, DARK.grape, DARK.bubblegum].map(toHex);
const INK = toHex(COLORS.ink);

interface Band {
  readonly seat: Seat;
  readonly y: number;
  /** Turned to face a person sitting on the far side. */
  readonly turned: boolean;
  /** Whether a person plays this seat, so its colours are there to tap. */
  readonly controls: boolean;
  readonly swatches: GameObjects.Container[];
  readonly stars: GameObjects.Graphics[];
  readonly crosses: GameObjects.Graphics[];
  readonly count: GameObjects.Container;
  readonly countText: GameObjects.Text;
}

/**
 * Flood. The board is drawn fresh each frame from what each square is showing, and what it is
 * showing walks toward the rules one square at a time as the wave passes: a scene with no pieces of
 * its own to lose track of. A patch you own is drawn flat and joined up, and a free square is a
 * raised tile, so you can see what is yours without reading colours.
 */
export class FloodScene extends Scene {
  private cell = 0;
  private pitch = 0;
  private x0 = 0;
  private y0 = 0;
  private side = 0;
  /** Two people can sit either side; one person against a bot always gets the bottom. */
  private flip = false;
  private shownColour: number[] = [];
  private shownOwner: number[] = [];
  /** When each square takes on what the rules say, as the wave reaches it. */
  private dueAt: number[] = [];
  /** When each square joined, for the drop. */
  private landAt: number[] = [];
  private board!: GameObjects.Graphics;
  private readonly bands: Band[] = [];
  private cursor = 0;
  private ring?: GameObjects.Graphics;
  private busyUntil = 0;
  private dirty = true;

  constructor(private readonly session: Session<FloodMove>) {
    super('flood');
  }

  private get state(): FloodState {
    return this.session.state as FloodState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    const state = this.state;
    const n = state.size;
    const seats = this.session.seats;
    const people = seats.flatMap((s, i) => (s.kind === 'human' ? [i] : []));
    this.flip = state.players === 2 && people.length === 1 && people[0] === 1;

    this.side = W - PAD * 2;
    this.cell = (this.side - GAP * (n - 1)) / n;
    this.pitch = this.cell + GAP;
    this.x0 = PAD;
    const bands = state.players === 2 ? 2 : 1;
    const block = this.side + bands * (BAND + BAND_GAP);
    const top = (H - block) / 2;
    this.y0 = state.players === 2 ? top + BAND + BAND_GAP : top;

    const bed = this.add.graphics();
    bed.fillStyle(0xe6e0f4, 1);
    bed.fillRoundedRect(this.x0 - 8, this.y0 - 8 + 6, this.side + 16, this.side + 16, 26);
    bed.fillStyle(0xffffff, 1);
    bed.fillRoundedRect(this.x0 - 8, this.y0 - 8, this.side + 16, this.side + 16, 26);
    this.board = this.add.graphics().setPosition(this.x0 + this.side / 2, this.y0 + this.side / 2);

    this.shownColour = [...state.colours];
    this.shownOwner = [...state.owner];
    this.dueAt = state.colours.map(() => 0);
    this.landAt = state.colours.map(() => -LAND_MS);

    for (let seat = 0; seat < state.players; seat++) this.drawHome(seat);

    const bottomSeat = this.flip ? 1 : 0;
    const bottomY = this.y0 + this.side + BAND_GAP + BAND / 2;
    this.bands.push(this.makeBand(bottomSeat, bottomY, false, people.length === 0 || isPerson(seats, bottomSeat)));
    if (state.players === 2) {
      const topSeat = 1 - bottomSeat;
      // Only a second person sitting opposite needs their row turned round.
      this.bands.push(this.makeBand(topSeat, this.y0 - BAND_GAP - BAND / 2, people.length === 2, people.length === 0 || isPerson(seats, topSeat)));
    }

    this.ring = focusRing(this, 104, 104, 52);
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.tap(p.worldX, p.worldY));
    onKeys(this, (key) => this.key(key));

    this.refreshBands(false);
    const unsubscribe = this.session.subscribe(() => this.sync());
    this.events.once('shutdown', unsubscribe);
  }

  /** Still showing the last move. See `apps/client/src/games/busy.ts`. */
  busy(): boolean {
    return this.time.now < this.busyUntil;
  }

  /** Where a square of the rules is drawn: the board turns round for a person in the second seat. */
  private shown(cell: number): number {
    return this.flip ? this.state.cells - 1 - cell : cell;
  }

  private topLeft(display: number): { x: number; y: number } {
    const n = this.state.size;
    return { x: this.x0 + (display % n) * this.pitch, y: this.y0 + Math.floor(display / n) * this.pitch };
  }

  private sync(): void {
    const state = this.state;
    const now = this.time.now;
    const n = state.size;
    const home = this.shown(state.home(state.players === 2 ? 1 - state.currentSeat : 0));
    let longest = 0;
    for (let cell = 0; cell < state.cells; cell++) {
      if (state.colours[cell] === this.shownColour[cell] && state.owner[cell] === this.shownOwner[cell]) continue;
      const d = this.shown(cell);
      // The wave runs out from the corner of whoever just moved.
      const steps = Math.abs((d % n) - (home % n)) + Math.abs(Math.floor(d / n) - Math.floor(home / n));
      const delay = Math.min(steps * WAVE_STEP, WAVE_MAX);
      this.dueAt[cell] = now + delay;
      longest = Math.max(longest, delay);
    }
    this.busyUntil = now + longest + LAND_MS + 60;
    this.dirty = true;
    this.refreshBands(true);
    if (state.result) this.time.delayedCall(longest + LAND_MS, () => this.finish());
  }

  update(): void {
    const state = this.state;
    const now = this.time.now;
    for (let cell = 0; cell < state.cells; cell++) {
      if (now < this.dueAt[cell]!) continue;
      if (this.shownColour[cell] === state.colours[cell] && this.shownOwner[cell] === state.owner[cell]) continue;
      if (this.shownOwner[cell] !== state.owner[cell]) this.landAt[cell] = now;
      this.shownColour[cell] = state.colours[cell]!;
      this.shownOwner[cell] = state.owner[cell]!;
      this.dirty = true;
    }
    if (this.dirty || now < this.busyUntil) this.draw(now);
    this.dirty = false;
  }

  private draw(now: number): void {
    const g = this.board.clear();
    const state = this.state;
    const n = state.size;
    const colour: number[] = [];
    const owner: number[] = [];
    const since: number[] = [];
    for (let cell = 0; cell < state.cells; cell++) {
      const d = this.shown(cell);
      colour[d] = this.shownColour[cell]!;
      owner[d] = this.shownOwner[cell]!;
      since[d] = now - this.landAt[cell]!;
    }
    const landed = since.map((t) => t >= LAND_MS);
    const ox = -this.side / 2;
    const oy = -this.side / 2;
    const c = this.cell;
    const r = c * 0.24;
    const joined = (a: number, b: number) => owner[a]! >= 0 && owner[a] === owner[b] && landed[a] && landed[b];
    for (let d = 0; d < state.cells; d++) {
      const col = d % n;
      const row = Math.floor(d / n);
      const x = ox + col * this.pitch;
      const y = oy + row * this.pitch;
      const fill = FILL[colour[d]!]!;
      if (owner[d]! < 0) {
        // A free square is a raised tile with a lip.
        g.fillStyle(LIP[colour[d]!]!, 1);
        g.fillRoundedRect(x, y + 3, c, c - 1, r);
        g.fillStyle(fill, 1);
        g.fillRoundedRect(x, y, c, c - 3, r);
        continue;
      }
      if (!landed[d]) {
        // Just joined: it drops in, overshoots and settles, then fuses with the patch.
        const t = Math.min(1, Math.max(0, since[d]! / LAND_MS));
        const s = 0.55 + 0.45 * backOut(t);
        g.fillStyle(fill, 1);
        g.fillRoundedRect(x + (c * (1 - s)) / 2, y + (c * (1 - s)) / 2 - (1 - t) * c * 0.2, c * s, c * s, r * s);
        continue;
      }
      g.fillStyle(fill, 1);
      g.fillRoundedRect(x, y, c, c, r);
      // An owned patch is one shape: each square reaches halfway across the gap to its own neighbours.
      if (col < n - 1 && joined(d, d + 1)) g.fillRect(x + c / 2, y, c / 2 + GAP / 2, c);
      if (col > 0 && joined(d, d - 1)) g.fillRect(x - GAP / 2, y, c / 2 + GAP / 2, c);
      if (row < n - 1 && joined(d, d + n)) g.fillRect(x, y + c / 2, c, c / 2 + GAP / 2);
      if (row > 0 && joined(d, d - n)) g.fillRect(x, y - GAP / 2, c, c / 2 + GAP / 2);
      if (col < n - 1 && row < n - 1 && joined(d, d + 1) && joined(d, d + n) && joined(d, d + n + 1)) g.fillRect(x + c, y + c, GAP, GAP);
    }
  }

  /** The star (or moon) that marks where a seat started. */
  private drawHome(seat: Seat): void {
    const { x, y } = this.topLeft(this.shown(this.state.home(seat)));
    const cx = x + this.cell / 2;
    const cy = y + this.cell / 2;
    const g = this.add.graphics().setDepth(5).setPosition(cx, cy);
    const s = Math.min(this.cell * 0.34, 20);
    g.fillStyle(0xffffff, 1);
    if (seat === 0) g.fillPoints(starPoints(s), true);
    else {
      g.fillCircle(0, 0, s * 0.95);
      g.fillStyle(INK, 1);
      g.fillCircle(s * 0.42, -s * 0.28, s * 0.72);
    }
    this.tweens.add({ targets: g, scale: { from: 0.4, to: 1 }, duration: 420, ease: 'Back.easeOut' });
  }

  private makeBand(seat: Seat, y: number, turned: boolean, controls: boolean): Band {
    const slots = this.state.players === 2 ? FLOOD_COLOURS + 1 : FLOOD_COLOURS;
    const pitch = this.side / slots;
    // Turned round, the row reads right to left for us and left to right for the person opposite.
    const slotX = (i: number) => this.x0 + pitch * ((turned ? slots - 1 - i : i) + 0.5);
    const radius = Math.min(pitch * 0.42, 46);
    const swatches: GameObjects.Container[] = [];
    const stars: GameObjects.Graphics[] = [];
    const crosses: GameObjects.Graphics[] = [];
    for (let colour = 0; colour < FLOOD_COLOURS; colour++) {
      const g = this.add.graphics();
      g.fillStyle(LIP[colour]!, 1);
      g.fillCircle(0, 5, radius);
      g.fillStyle(FILL[colour]!, 1);
      g.fillCircle(0, 0, radius);
      g.fillStyle(0xffffff, 0.35);
      g.fillCircle(-radius * 0.36, -radius * 0.36, radius * 0.2);
      const star = this.add.graphics();
      star.fillStyle(0xffffff, 1);
      star.fillPoints(starPoints(radius * 0.46), true);
      const cross = this.add.graphics();
      cross.lineStyle(radius * 0.16, INK, 1);
      const k = radius * 0.4;
      cross.lineBetween(-k, -k, k, k);
      cross.lineBetween(-k, k, k, -k);
      const swatch = this.add.container(slotX(colour), y, [g, star, cross]).setSize(radius * 2, radius * 2).setAngle(turned ? 180 : 0);
      swatch.setVisible(controls);
      swatches.push(swatch);
      stars.push(star);
      crosses.push(cross);
    }
    const countX = this.state.players === 2 ? slotX(FLOOD_COLOURS) : 0;
    const pill = this.add.graphics();
    pill.fillStyle(INK, 1);
    pill.fillRoundedRect(-radius, -radius * 0.72, radius * 2, radius * 1.44, radius * 0.5);
    const countText = sharpText(this, 0, 0, '', radius * 0.8, '#FFFFFF').setFontStyle('bold');
    const count = this.add.container(controls ? countX : this.x0 + this.side / 2, y, [pill, countText]).setAngle(turned ? 180 : 0);
    count.setVisible(this.state.players === 2);
    return { seat, y, turned, controls, swatches, stars, crosses, count, countText };
  }

  /** Which colours each row may pick, whose turn it is, and the counts. */
  private refreshBands(animate: boolean): void {
    const state = this.state;
    for (const band of this.bands) {
      const own = state.colourOf(band.seat);
      const other = state.players === 2 ? state.colourOf(1 - band.seat) : -1;
      const theirTurn = !state.result && state.currentSeat === band.seat;
      band.swatches.forEach((swatch, colour) => {
        band.stars[colour]!.setVisible(colour === own);
        band.crosses[colour]!.setVisible(colour === other);
        const alpha = colour === other ? 0.3 : theirTurn || state.players === 1 ? 1 : 0.45;
        const scale = colour === own ? 0.8 : theirTurn ? 1 : 0.86;
        if (animate) this.tweens.add({ targets: swatch, alpha, scale, duration: 200, ease: 'Back.easeOut' });
        else swatch.setAlpha(alpha).setScale(scale);
      });
      const held = String(state.held(band.seat));
      if (band.countText.text !== held) {
        band.countText.setText(held);
        if (animate) this.tweens.add({ targets: band.count, scale: { from: 1.25, to: 1 }, duration: 260, delay: 200, ease: 'Back.easeOut' });
      }
    }
  }

  private finish(): void {
    const result = this.state.result;
    if (!result) return;
    if (this.state.players === 1 && result.winners.length === 0) {
      this.cameras.main.shake(240, 0.006);
      return;
    }
    // A squash and a spring back: the board takes a bow.
    this.tweens.add({ targets: this.board, scaleX: 1.04, scaleY: 0.96, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
    for (const band of this.bands) {
      if (result.winners.includes(band.seat)) this.tweens.add({ targets: band.count, y: band.y - 16, duration: 180, yoyo: true, repeat: 1, ease: 'Quad.easeOut' });
    }
  }

  /** The row a person is playing whose turn it is, or null. */
  private activeBand(): Band | null {
    const state = this.state;
    if (state.result || !this.session.isHumanTurn()) return null;
    return this.bands.find((band) => band.seat === state.currentSeat && band.controls) ?? null;
  }

  private pick(colour: number, swatch?: GameObjects.Container): void {
    const state = this.state;
    if (state.result || !this.session.isHumanTurn()) return;
    const move = String(colour);
    if (!state.legalMoves(state.currentSeat).includes(move)) {
      if (swatch) this.tweens.add({ targets: swatch, x: swatch.x + 7, duration: 50, yoyo: true, repeat: 2 });
      return;
    }
    if (swatch) this.tweens.add({ targets: swatch, scaleX: 1.18, scaleY: 0.82, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
    this.session.play(move);
  }

  private tap(x: number, y: number): void {
    const state = this.state;
    for (const band of this.bands) {
      if (!band.controls || Math.abs(y - band.y) > BAND / 2) continue;
      if (band.seat !== state.currentSeat) return;
      band.swatches.forEach((swatch, colour) => {
        if (Math.abs(x - swatch.x) <= swatch.width / 2 + 6) this.pick(colour, swatch);
      });
      return;
    }
    // A square on the board picks its own colour, as in every good version.
    const col = Math.floor((x - this.x0) / this.pitch);
    const row = Math.floor((y - this.y0) / this.pitch);
    const n = state.size;
    if (col < 0 || row < 0 || col >= n || row >= n) return;
    const display = row * n + col;
    const cell = this.flip ? state.cells - 1 - display : display;
    const colour = state.colours[cell]!;
    const band = this.activeBand();
    this.pick(colour, band?.swatches[colour]);
  }

  private key(key: string): boolean {
    const band = this.activeBand();
    if (!band) return false;
    const number = Number(key);
    if (Number.isInteger(number) && number >= 1 && number <= FLOOD_COLOURS) {
      this.pick(number - 1, band.swatches[number - 1]);
      return true;
    }
    const step = arrow(key);
    if (step && step[0] !== 0) {
      // A turned row runs the other way for the person reading it.
      const dir = band.turned ? -step[0] : step[0];
      this.cursor = (this.cursor + dir + FLOOD_COLOURS) % FLOOD_COLOURS;
      const swatch = band.swatches[this.cursor]!;
      if (this.ring) moveRing(this, this.ring, swatch.x, swatch.y);
      return true;
    }
    if (isPress(key)) {
      this.pick(this.cursor, band.swatches[this.cursor]);
      return true;
    }
    return false;
  }

  /** The rows of colours and the board, top to bottom, for `e2e/wordlayout.spec.ts`. */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    const out = [{ name: 'the board', top: this.y0 - 8, bottom: this.y0 + this.side + 14 }];
    for (const band of this.bands) {
      const reach = Math.max(...band.swatches.map((s) => s.height / 2 + 5), 0);
      out.push({ name: `seat ${band.seat + 1}'s colours`, top: band.y - reach, bottom: band.y + reach });
    }
    return out;
  }

  /** Whether what is drawn is what the rules say, for the Q1 check in `e2e/wordlayout.spec.ts`. */
  boardCheck(): { settled: number; wrong: number; note: string } {
    const state = this.state;
    let wrong = 0;
    let note = '';
    for (let cell = 0; cell < state.cells; cell++) {
      if (this.shownColour[cell] === state.colours[cell] && this.shownOwner[cell] === state.owner[cell]) continue;
      wrong++;
      note = `square ${cell} shows colour ${this.shownColour[cell]} held by ${this.shownOwner[cell]}, the rules say ${state.colours[cell]} held by ${state.owner[cell]}`;
    }
    return { settled: state.cells, wrong, note };
  }
}

const backOut = (t: number): number => {
  const k = 1.7;
  return 1 + (k + 1) * (t - 1) ** 3 + k * (t - 1) ** 2;
};

function starPoints(radius: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? radius : radius * 0.45;
    points.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  return points;
}
