import { bedLabel, dartAim, DART_LIMIT, DART_RINGS, DART_SECTORS, dartCheckout, dartMove, DARTS_PER_TURN, type DartsMove, type DartsState, type DartThrow } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { arrow, onKeys } from '../keys';

const W = 720;
const H = 1000;
export const DARTS_SIZE = { width: W, height: H };

/** The bands top to bottom: scores, this turn's darts, then the board. */
const STRIP_Y = 52;
const TURN_Y = 128;
const CX = W / 2;
const CY = 540;
/** Pixels per millimetre on the board. */
const S = 290 / DART_LIMIT;
const STEADY_MS = 1000;
const TIRE_MS = 3500;
const FLIGHT_MS = 300;
const SETTLE_MS = 450;
const PULL_MS = 700;

/** Each player's flights. */
export const DART_COLORS = [COLORS.tomato, COLORS.sky, COLORS.mint, COLORS.grape];

/**
 * Darts. The rules score where a dart lands; the scene is the hand: while it is your dart the sight
 * sways in a slow loop, steadies for a moment and then tires, and the dart goes wherever it is when
 * you let go. Dragging moves the sight by as much as the finger moves, so the finger never covers
 * the bed you are aiming at.
 */
export class DartsScene extends Scene {
  private board!: GameObjects.Container;
  private sight!: GameObjects.Graphics;
  private strip: GameObjects.Text[] = [];
  private turnText!: GameObjects.Text;
  private stuck: GameObjects.Container[] = [];
  private aim = { x: 0, y: -103 };
  private turnStart = 0;
  private drag: { x: number; y: number } | null = null;
  private busyUntil = 0;
  private flying = false;
  private shift = false;

  constructor(private readonly session: Session<DartsMove>) {
    super('darts');
  }

  private get state(): DartsState {
    return this.session.state as DartsState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.drawBoard();
    this.turnText = sharpText(this, CX, TURN_Y, '', 30, COLORS.ink).setFontStyle('bold');
    this.sight = this.add.graphics().setDepth(20);
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.down(p.worldX, p.worldY));
    this.input.on('pointermove', (p: { worldX: number; worldY: number; isDown: boolean }) => p.isDown && this.move(p.worldX, p.worldY));
    this.input.on('pointerup', () => this.up());
    onKeys(this, (key) => this.key(key));
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => (this.shift = event.shiftKey));
    this.input.keyboard?.on('keyup', (event: KeyboardEvent) => (this.shift = event.shiftKey));
    // A scene built mid-turn (a rematch, or the table rebuilt) puts this turn's darts back in the board.
    const state = this.state;
    for (const t of state.throws.slice(state.throws.length - state.thrown)) {
      this.stuck.push(this.makeDart(t.seat).setPosition(CX + t.at.x * S, CY + t.at.y * S));
    }
    this.settle();
    const unsubscribe = this.session.subscribe(() => this.thrown());
    // A bot waits for the last dart to land before it throws.
    this.session.holdBots = () => this.busy();
    this.events.once('shutdown', () => {
      unsubscribe();
      this.session.holdBots = null;
    });
  }

  /** Still flying a dart, or showing where it went. */
  busy(): boolean {
    return this.flying || this.time.now < this.busyUntil;
  }

  /** A candy board: ink and cream singles, tomato and mint doubles and trebles, the numbers round the edge. */
  private drawBoard(): void {
    const g = this.add.graphics();
    g.fillStyle(toHex(DARK.grape), 1);
    g.fillCircle(CX, CY + 8, DART_LIMIT * S);
    g.fillStyle(toHex(COLORS.grape), 1);
    g.fillCircle(CX, CY, DART_LIMIT * S);
    const rings: [number, (i: number) => number][] = [
      [DART_RINGS.doubleOut, (i) => toHex(i % 2 ? COLORS.mint : COLORS.tomato)],
      [DART_RINGS.doubleIn, (i) => toHex(i % 2 ? '#FFF3DC' : COLORS.ink)],
      [DART_RINGS.trebleOut, (i) => toHex(i % 2 ? COLORS.mint : COLORS.tomato)],
      [DART_RINGS.trebleIn, (i) => toHex(i % 2 ? '#FFF3DC' : COLORS.ink)],
    ];
    for (const [r, color] of rings)
      DART_SECTORS.forEach((_, i) => {
        const mid = -90 + i * 18;
        g.fillStyle(color(i), 1);
        g.slice(CX, CY, r * S, ((mid - 9) * Math.PI) / 180, ((mid + 9) * Math.PI) / 180, false);
        g.fillPath();
      });
    g.fillStyle(toHex(COLORS.mint), 1);
    g.fillCircle(CX, CY, DART_RINGS.outerBull * S);
    g.fillStyle(toHex(COLORS.tomato), 1);
    g.fillCircle(CX, CY, DART_RINGS.bull * S);
    const numbers = DART_SECTORS.map((n, i) => {
      const a = (i * 18 * Math.PI) / 180;
      const r = 197 * S;
      return sharpText(this, CX + r * Math.sin(a), CY - r * Math.cos(a), String(n), 26, '#FFFFFF').setFontStyle('bold');
    });
    this.board = this.add.container(0, 0, [g, ...numbers]);
  }

  private drawStrip(): void {
    for (const text of this.strip) text.destroy();
    this.strip = [];
    const state = this.state;
    const names = this.session.seats.map((s) => s.label);
    const width = (W - 40) / state.players;
    for (let p = 0; p < state.players; p++) {
      const up = p === state.currentSeat && !state.result;
      const text = sharpText(this, 20 + width * p + width / 2, STRIP_Y, `${names[p] ?? `Player ${p + 1}`}  ${state.scores[p]}`, 26, up ? DART_COLORS[p]! : COLORS.soft);
      text.setFontStyle(up ? 'bold' : '600');
      this.strip.push(text);
    }
  }

  /** This turn's darts so far and a dot for each still to come; just after a turn ends, that turn's. */
  private drawTurn(ended = false): void {
    const state = this.state;
    let from = state.throws.length - state.thrown;
    if (ended) {
      // Back to the start of the turn that just ended: its thrower's darts since their last turn.
      const seat = state.last!.seat;
      from = state.throws.length - 1;
      while (from > 0 && state.throws[from - 1]!.seat === seat && !state.throws[from - 1]!.turnEnd) from--;
    }
    const mine = state.throws.slice(from);
    const shown = [...mine.map((t) => bedLabel(t.bed)), ...Array.from({ length: DARTS_PER_TURN - mine.length }, () => '·')];
    this.turnText.setText(state.result ? '' : shown.join('   '));
  }

  /** The board as the rules have it now. At the start of a turn the last turn's darts come out. */
  private settle(): void {
    const state = this.state;
    if (state.thrown === 0 && !state.result && this.stuck.length) {
      for (const view of this.stuck) this.tweens.add({ targets: view, alpha: 0, y: view.y - 30, duration: 220, onComplete: () => view.destroy() });
      this.stuck = [];
    }
    this.drawStrip();
    this.drawTurn();
    if (state.thrown === 0) this.aim = { ...dartAim({ base: 20, mult: 3 }) };
    this.turnStart = this.time.now;
  }

  private thrown(): void {
    const t = this.state.last;
    if (!t) return;
    this.sight.clear();
    this.fly(t);
  }

  /** A dart from the oche to the board in a small arc, then stuck at a slant. */
  private fly(t: DartThrow): void {
    this.flying = true;
    const to = { x: CX + t.at.x * S, y: CY + t.at.y * S };
    const from = { x: CX + t.at.x * S * 0.4, y: H + 80 };
    const view = this.makeDart(t.seat);
    view.setPosition(from.x, from.y).setScale(2.2);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: FLIGHT_MS,
      ease: 'Quad.easeIn',
      onUpdate: (tween) => {
        const k = tween.getValue() ?? 0;
        view.setPosition(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k - Math.sin(Math.PI * k) * 90).setScale(2.2 - 1.2 * k);
      },
      onComplete: () => {
        view.setPosition(to.x, to.y).setScale(1);
        this.stuck.push(view);
        this.tweens.add({ targets: this.board, x: { from: 3, to: 0 }, duration: 110, ease: 'Quad.easeOut' });
        const label = t.bust ? 'Bust!' : t.bed.mult === 0 ? 'Miss' : bedLabel(t.bed);
        cue(t.bust ? 'buzz' : t.bed.mult === 0 ? 'wall' : t.bed.mult >= 2 ? 'place' : 'tap');
        const pop = sharpText(this, to.x, to.y - 34, label, 40, t.bust ? COLORS.tomato : COLORS.ink).setFontStyle('bold').setStroke('#FFFFFF', 8).setDepth(30);
        this.tweens.add({ targets: pop, y: to.y - 96, alpha: 0, duration: 700, delay: 150, onComplete: () => pop.destroy() });
        this.flying = false;
        const wait = t.turnEnd ? PULL_MS : SETTLE_MS;
        this.busyUntil = this.time.now + wait;
        this.drawTurn(t.turnEnd);
        this.drawStrip();
        this.time.delayedCall(wait, () => this.settle());
      },
    });
  }

  /** Seen from the thrower: a tip in the board and the flights sticking out at a slant. */
  private makeDart(seat: number): GameObjects.Container {
    const g = this.add.graphics();
    g.lineStyle(4, toHex(COLORS.ink), 1);
    g.lineBetween(0, 0, 16, 22);
    g.fillStyle(toHex(DART_COLORS[seat] ?? COLORS.ink), 1);
    g.fillTriangle(14, 18, 30, 26, 22, 38);
    g.fillTriangle(14, 18, 6, 34, 22, 38);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(0, 0, 3);
    return this.add.container(0, 0, [g]).setDepth(10);
  }

  /** The sway, in millimetres: steady for a moment, then growing as the arm tires. */
  private sway(): { x: number; y: number } {
    const held = this.time.now - this.turnStart;
    const steady = held < STEADY_MS ? 1.4 - (0.8 * held) / STEADY_MS : 0.6 + Math.max(0, (held - TIRE_MS) / 2500);
    const t = held / 1000;
    const a = 11 * Math.min(steady, 2.6);
    return { x: a * (Math.sin(t * 1.4) + 0.5 * Math.sin(t * 3.1 + 0.7)), y: a * 0.8 * Math.sin(t * 1.9 + 1.1) };
  }

  private mine(): boolean {
    return !this.flying && !this.state.result && this.session.isHumanTurn() && this.time.now >= this.busyUntil;
  }

  update(): void {
    const g = this.sight.clear();
    if (!this.mine()) return;
    const sway = this.sway();
    const x = CX + (this.aim.x + sway.x) * S;
    const y = CY + (this.aim.y + sway.y) * S;
    g.lineStyle(4, 0xffffff, 1);
    g.strokeCircle(x, y, 20);
    g.lineStyle(2, toHex(COLORS.ink), 1);
    g.strokeCircle(x, y, 23);
    g.lineBetween(x - 32, y, x - 12, y);
    g.lineBetween(x + 12, y, x + 32, y);
    g.lineBetween(x, y - 32, x, y - 12);
    g.lineBetween(x, y + 12, x, y + 32);
    g.fillStyle(toHex(COLORS.sunny), 1);
    g.fillCircle(x, y, 3.5);
  }

  private down(x: number, y: number): void {
    if (!this.mine()) return;
    this.drag = { x, y };
  }

  private move(x: number, y: number): void {
    if (!this.drag || !this.mine()) return;
    this.nudge((x - this.drag.x) / S, (y - this.drag.y) / S);
    this.drag = { x, y };
  }

  private up(): void {
    if (!this.drag) return;
    this.drag = null;
    this.release();
  }

  private nudge(dx: number, dy: number): void {
    const limit = DART_LIMIT - 20;
    this.aim = { x: Math.max(-limit, Math.min(limit, this.aim.x + dx)), y: Math.max(-limit, Math.min(limit, this.aim.y + dy)) };
  }

  /** Lets go: the dart goes wherever the sight is at this moment, sway and all. */
  private release(): void {
    if (!this.mine()) return;
    const sway = this.sway();
    const clamp = (v: number) => Math.max(-DART_LIMIT, Math.min(DART_LIMIT, Math.round(v)));
    const move = dartMove(clamp(this.aim.x + sway.x), clamp(this.aim.y + sway.y));
    if (this.state.allows(move)) this.session.play(move);
  }

  private key(key: string): boolean {
    if (!this.mine()) return false;
    const step = arrow(key);
    if (step) {
      const by = this.shift ? 2 : 10;
      this.nudge(step[0] * by, step[1] * by);
      return true;
    }
    if (key === ' ' || key === 'Enter') {
      this.release();
      return true;
    }
    return false;
  }

  /** The score strip, this turn's darts and the board, top to bottom, for `e2e/wordlayout.spec.ts`. */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    return [
      { name: 'the scores', top: STRIP_Y - 18, bottom: STRIP_Y + 18 },
      { name: 'this turn', top: TURN_Y - 20, bottom: TURN_Y + 20 },
      { name: 'the board', top: CY - DART_LIMIT * S, bottom: CY + DART_LIMIT * S + 8 },
    ];
  }
}

/** The line under the board: who throws, what they need, and a way to finish it. */
export function dartsStatus(state: DartsState, names: readonly string[]): string | undefined {
  if (state.result) return undefined;
  const score = state.scores[state.currentSeat]!;
  const name = names[state.currentSeat] ?? `Player ${state.currentSeat + 1}`;
  const route = dartCheckout(score, DARTS_PER_TURN - state.thrown);
  const finish = route ? ` · ${route.map((t) => bedLabel({ base: t.base, mult: t.mult, points: t.base * t.mult })).join(' ')}` : '';
  return `${name} needs ${score}${finish}`;
}

export function dartsResult(state: DartsState, names: readonly string[]): string | undefined {
  if (!state.result) return undefined;
  const w = state.result.winners[0]!;
  if (state.players === 1) return `${state.start} checked out in ${state.darts[0]} darts! 🎯`;
  return `${names[w] ?? `Player ${w + 1}`} checks out! 🎯`;
}
