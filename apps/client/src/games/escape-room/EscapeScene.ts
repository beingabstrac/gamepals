import { ESCAPE_WALLS, type EscapeMove, type EscapeState, type EscapeThing, type Hideout } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { onKeys } from '../keys';

const W = 600;
const H = 780;
export const ESCAPE_SIZE = { width: W, height: H };
export const ESCAPE_TINTS = [COLORS.peach];

const ROOM = { x: 20, y: 30, w: 560, h: 560 };
const DOTS_Y = ROOM.y + ROOM.h + 34;
const WALL_COLORS = ['#FFE3C7', '#D7F5E6', '#DCEBFF', '#EDE3FF'];
/** Each thing's own color and its look-alike's. */
const PAINT: Record<EscapeThing, [string, string]> = {
  apple: [COLORS.tomato, COLORS.mint],
  fish: [COLORS.sky, COLORS.peach],
  star: [COLORS.sunny, COLORS.grape],
  cat: [COLORS.grape, COLORS.peach],
  flower: [COLORS.bubblegum, COLORS.sky],
  book: [COLORS.sky, COLORS.tomato],
  cup: [COLORS.mint, COLORS.sunny],
  sock: [COLORS.peach, COLORS.mint],
};
const DOOR = { x: ROOM.x + ROOM.w / 2, y: ROOM.y + 90, w: 230, h: 440 };

/**
 * Escape Room. The rules keep the rooms and check the code; the scene is the room: four walls to
 * turn between, things drawn where the rules put them, drawers and boxes and curtains that open to
 * show what they hide, and the lock on the door with a wheel for each digit.
 */
export class EscapeScene extends Scene {
  private wall = 0;
  private walls: GameObjects.Container[] = [];
  private opened = new Set<number>();
  private wheels: number[] = [];
  private wheel = 0;
  private hideFocus = 0;
  private wheelTexts: GameObjects.Text[] = [];
  private lock!: GameObjects.Container;
  private dots!: GameObjects.Graphics;
  private moving = false;
  private shownRoom = -1;

  constructor(private readonly session: Session<EscapeMove>) {
    super('escape-room');
  }

  private get state(): EscapeState {
    return this.session.state as EscapeState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.walls = [];
    this.dots = this.add.graphics();
    this.buildRoom();
    // Turn arrows.
    for (const dir of [-1, 1]) {
      const x = dir < 0 ? ROOM.x + 34 : ROOM.x + ROOM.w - 34;
      const g = this.add.graphics().setDepth(20);
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(x, ROOM.y + ROOM.h / 2, 26);
      g.fillStyle(toHex(COLORS.ink), 1);
      g.fillTriangle(x + dir * 10, ROOM.y + ROOM.h / 2, x - dir * 7, ROOM.y + ROOM.h / 2 - 12, x - dir * 7, ROOM.y + ROOM.h / 2 + 12);
    }
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.down(p.worldX, p.worldY));
    onKeys(this, (key) => this.key(key));
    const off = this.session.subscribe(() => this.changed());
    this.session.holdBots = () => this.busy();
    this.events.once('shutdown', () => {
      off();
      this.session.holdBots = null;
    });
  }

  busy(): boolean {
    return this.moving;
  }

  /** Every wall of the current room, each in its own container, the one you face in view. */
  private buildRoom(): void {
    for (const w of this.walls) w.destroy();
    const s = this.state;
    const room = s.current;
    this.shownRoom = s.room;
    this.opened.clear();
    this.wheels = room.lock.map(() => 0);
    this.wheel = 0;
    this.hideFocus = 0;
    this.walls = Array.from({ length: ESCAPE_WALLS }, (_, wall) => {
      const c = this.add.container(0, 0);
      const g = this.add.graphics();
      g.fillStyle(toHex(WALL_COLORS[wall]!), 1);
      g.fillRect(ROOM.x, ROOM.y, ROOM.w, ROOM.h);
      g.fillStyle(toHex('#E9D8C4'), 1);
      g.fillRect(ROOM.x, ROOM.y + ROOM.h - 70, ROOM.w, 70);
      c.add(g);
      for (const p of room.things) if (p.wall === wall && p.inside < 0) c.add(this.thing(p.thing, p.odd, ROOM.x + p.x * ROOM.w, ROOM.y + p.y * ROOM.h, 1));
      room.hideouts.forEach((h, i) => h.wall === wall && c.add(this.hideout(h, i)));
      if (wall === 0) c.add(this.doorView());
      c.setVisible(wall === this.wall);
      return c;
    });
    this.drawDots();
  }

  private doorView(): GameObjects.Container {
    const room = this.state.current;
    const g = this.add.graphics();
    g.fillStyle(toHex(DARK.peach), 1);
    g.fillRoundedRect(DOOR.x - DOOR.w / 2 - 10, DOOR.y - 10, DOOR.w + 20, DOOR.h + 10, { tl: 26, tr: 26, bl: 0, br: 0 });
    g.fillStyle(toHex(COLORS.peach), 1);
    g.fillRoundedRect(DOOR.x - DOOR.w / 2, DOOR.y, DOOR.w, DOOR.h, { tl: 20, tr: 20, bl: 0, br: 0 });
    g.fillStyle(toHex(COLORS.sunny), 1);
    g.fillCircle(DOOR.x + DOOR.w / 2 - 26, DOOR.y + DOOR.h / 2 + 40, 9);
    // The lock panel: a picture over each wheel, and Try.
    const n = room.lock.length;
    const cell = 50;
    const left = DOOR.x - (n * cell) / 2;
    const panel = this.add.graphics();
    panel.fillStyle(0xffffff, 1);
    panel.fillRoundedRect(left - 12, DOOR.y + 70, n * cell + 24, 220, 18);
    const parts: GameObjects.GameObject[] = [g, panel];
    this.wheelTexts = [];
    room.lock.forEach((t, i) => {
      const x = left + cell * i + cell / 2;
      parts.push(this.thing(t, false, x, DOOR.y + 108, 0.8));
      const wheel = this.add.graphics();
      wheel.fillStyle(toHex('#F1ECFA'), 1);
      wheel.fillRoundedRect(x - 20, DOOR.y + 140, 40, 70, 12);
      wheel.fillStyle(toHex(COLORS.soft), 1);
      wheel.fillTriangle(x, DOOR.y + 144, x - 7, DOOR.y + 154, x + 7, DOOR.y + 154);
      wheel.fillTriangle(x, DOOR.y + 206, x - 7, DOOR.y + 196, x + 7, DOOR.y + 196);
      parts.push(wheel);
      const text = sharpText(this, x, DOOR.y + 175, '0', 28, COLORS.ink).setFontStyle('bold');
      this.wheelTexts.push(text);
      parts.push(text);
    });
    const tryButton = this.add.graphics();
    tryButton.fillStyle(toHex(DARK.mint), 1);
    tryButton.fillRoundedRect(DOOR.x - 60, DOOR.y + 232 + 5, 120, 44, 22);
    tryButton.fillStyle(toHex(COLORS.mint), 1);
    tryButton.fillRoundedRect(DOOR.x - 60, DOOR.y + 232, 120, 44, 22);
    parts.push(tryButton, sharpText(this, DOOR.x, DOOR.y + 254, 'Try', 22, '#FFFFFF').setFontStyle('bold'));
    this.lock = this.add.container(0, 0, parts);
    return this.lock;
  }

  /** A drawer, a box or a curtained window, closed, with what it hides inside ready to show. */
  private hideout(h: Hideout, i: number): GameObjects.Container {
    const x = ROOM.x + h.x * ROOM.w;
    const y = ROOM.y + h.y * ROOM.h;
    const inside = this.state.current.things.filter((p) => p.inside === i);
    const back = this.add.graphics();
    back.fillStyle(toHex('#FFFFFF'), 1);
    back.fillRoundedRect(x - 80, y - 46, 160, 92, 14);
    const items = inside.map((p, k) => this.thing(p.thing, p.odd, x - 58 + (k % 5) * 29, y - 20 + Math.floor(k / 5) * 38, 0.6));
    const cover = this.add.graphics();
    const color = h.kind === 'drawer' ? COLORS.peach : h.kind === 'box' ? COLORS.bubblegum : COLORS.sky;
    const dark = h.kind === 'drawer' ? DARK.peach : h.kind === 'box' ? DARK.bubblegum : DARK.sky;
    cover.fillStyle(toHex(dark), 1);
    cover.fillRoundedRect(x - 84, y - 50 + 6, 168, 100, 16);
    cover.fillStyle(toHex(color), 1);
    cover.fillRoundedRect(x - 84, y - 50, 168, 100, 16);
    cover.fillStyle(0xffffff, 0.8);
    if (h.kind === 'drawer') cover.fillRoundedRect(x - 20, y - 6, 40, 12, 6);
    else if (h.kind === 'box') {
      cover.fillRect(x - 6, y - 50, 12, 100);
      cover.fillRect(x - 84, y - 6, 168, 12);
    } else for (let k = -3; k <= 3; k++) cover.fillRect(x + k * 22 - 2, y - 50, 4, 100);
    const c = this.add.container(0, 0, [back, ...items, cover]).setName(`hide${i}`);
    return c;
  }

  /** Opens a hiding place: the cover slides away (a drawer out, a lid up, a curtain aside). */
  private open(i: number): void {
    if (this.opened.has(i)) return;
    const h = this.state.current.hideouts[i]!;
    const c = this.walls[h.wall]!.getByName(`hide${i}`) as GameObjects.Container;
    const cover = c.list[c.list.length - 1] as GameObjects.Graphics;
    this.opened.add(i);
    cue('pull');
    if (h.kind === 'drawer') this.tweens.add({ targets: cover, y: 70, alpha: 0.2, duration: 260, ease: 'Quad.easeOut' });
    else if (h.kind === 'box') this.tweens.add({ targets: cover, y: -90, alpha: 0, duration: 300, ease: 'Back.easeIn' });
    else this.tweens.add({ targets: cover, x: 70, alpha: 0, duration: 320, ease: 'Quad.easeOut' });
  }

  private drawDots(): void {
    const g = this.dots.clear();
    for (let k = 0; k < ESCAPE_WALLS; k++) {
      g.fillStyle(toHex(k === this.wall ? COLORS.ink : '#D9D3EC'), 1);
      g.fillCircle(W / 2 + (k - 1.5) * 26, DOTS_Y, k === this.wall ? 7 : 5);
    }
  }

  private turn(dir: number): void {
    if (this.moving) return;
    const from = this.walls[this.wall]!;
    this.wall = (this.wall + dir + ESCAPE_WALLS) % ESCAPE_WALLS;
    const to = this.walls[this.wall]!;
    // A short cross-fade with a nudge the way you turned: a slide all the way across would show the
    // next wall outside the room.
    to.setVisible(true).setAlpha(0).setX(dir * 24).setDepth(1);
    from.setDepth(0);
    cue('tap');
    this.tweens.add({ targets: from, alpha: 0, x: -dir * 24, duration: 200, onComplete: () => from.setVisible(false).setX(0).setAlpha(1) });
    this.tweens.add({ targets: to, alpha: 1, x: 0, duration: 200, ease: 'Quad.easeOut' });
    this.hideFocus = 0;
    this.drawDots();
  }

  private down(x: number, y: number): void {
    if (this.state.result) return;
    if (Math.abs(y - (ROOM.y + ROOM.h / 2)) < 40) {
      if (x < ROOM.x + 70) return this.turn(-1);
      if (x > ROOM.x + ROOM.w - 70) return this.turn(1);
    }
    const room = this.state.current;
    if (this.wall === 0) {
      const n = room.lock.length;
      const left = DOOR.x - (n * 50) / 2;
      if (y > DOOR.y + 140 && y < DOOR.y + 210 && x > left && x < left + n * 50) {
        const i = Math.floor((x - left) / 50);
        this.spin(i, y < DOOR.y + 175 ? 1 : -1);
        return;
      }
      if (Math.abs(y - (DOOR.y + 254)) < 24 && Math.abs(x - DOOR.x) < 60) return this.tryCode();
    }
    room.hideouts.forEach((h, i) => {
      if (h.wall !== this.wall) return;
      if (Math.abs(x - (ROOM.x + h.x * ROOM.w)) < 84 && Math.abs(y - (ROOM.y + h.y * ROOM.h)) < 50) this.open(i);
    });
  }

  private spin(i: number, by: number): void {
    this.wheel = i;
    this.wheels[i] = (this.wheels[i]! + by + 10) % 10;
    this.wheelTexts[i]!.setText(String(this.wheels[i]));
    cue('tap');
  }

  private tryCode(): void {
    if (!this.session.isHumanTurn() || this.state.result || this.moving) return;
    this.session.play(`c${this.wheels.join('')}`);
  }

  private key(key: string): boolean {
    if (key === 'ArrowLeft') return this.turn(-1), true;
    if (key === 'ArrowRight') return this.turn(1), true;
    if (this.wall === 0) {
      const n = this.wheels.length;
      if (key === 'ArrowUp') return this.spin(this.wheel, 1), true;
      if (key === 'ArrowDown') return this.spin(this.wheel, -1), true;
      if (key === 'Tab') return (this.wheel = (this.wheel + 1) % n), true;
      if (/^[0-9]$/.test(key)) {
        this.wheels[this.wheel] = Number(key);
        this.wheelTexts[this.wheel]!.setText(key);
        this.wheel = (this.wheel + 1) % n;
        return true;
      }
      if (key === 'Enter' || key === ' ') return this.tryCode(), true;
      return false;
    }
    const here = this.state.current.hideouts.map((h, i) => ({ h, i })).filter((e) => e.h.wall === this.wall);
    if (!here.length) return false;
    if (key === 'Tab') return (this.hideFocus = (this.hideFocus + 1) % here.length), true;
    if (key === 'Enter' || key === ' ') return this.open(here[this.hideFocus % here.length]!.i), true;
    return false;
  }

  private changed(): void {
    const s = this.state;
    const last = s.last;
    if (!last) return;
    // A bot's try shows on the wheels too.
    [...last.code].forEach((d, i) => {
      this.wheels[i] = Number(d);
      this.wheelTexts[i]?.setText(d);
    });
    if (!last.right) {
      cue('buzz');
      this.tweens.add({ targets: this.lock, x: { from: -12, to: 0 }, duration: 320, ease: 'Elastic.easeOut' });
      return;
    }
    cue(s.result ? 'win' : 'go');
    this.moving = true;
    if (this.wall !== 0) {
      this.walls[this.wall]!.setVisible(false);
      this.walls[0]!.setVisible(true).setX(0).setAlpha(1);
      this.wall = 0;
      this.drawDots();
    }
    this.tweens.add({ targets: this.lock, alpha: 0, duration: 300 });
    this.time.delayedCall(700, () => {
      if (!this.state.result && this.state.room !== this.shownRoom) {
        this.wall = 0;
        this.buildRoom();
      }
      this.moving = false;
    });
  }

  /** A little drawing of a thing; its look-alike is the same shape in another color. */
  private thing(t: EscapeThing, odd: boolean, x: number, y: number, scale: number): GameObjects.Graphics {
    const g = this.add.graphics().setPosition(x, y).setScale(scale);
    const c = toHex(PAINT[t][odd ? 1 : 0]);
    const ink = toHex(COLORS.ink);
    g.fillStyle(c, 1);
    switch (t) {
      case 'apple':
        g.fillCircle(0, 2, 16);
        g.fillStyle(toHex(DARK.mint), 1);
        g.fillEllipse(6, -15, 12, 6);
        break;
      case 'fish':
        g.fillEllipse(-2, 0, 32, 18);
        g.fillTriangle(12, 0, 22, -10, 22, 10);
        g.fillStyle(ink, 1);
        g.fillCircle(-10, -2, 2);
        break;
      case 'star':
        g.fillTriangle(0, -18, 16, 10, -16, 10);
        g.fillTriangle(0, 18, 16, -10, -16, -10);
        break;
      case 'cat':
        g.fillCircle(0, 2, 15);
        g.fillTriangle(-14, -4, -12, -20, -2, -12);
        g.fillTriangle(14, -4, 12, -20, 2, -12);
        g.fillStyle(ink, 1);
        g.fillCircle(-5, 0, 2);
        g.fillCircle(5, 0, 2);
        break;
      case 'flower':
        for (let k = 0; k < 5; k++) g.fillCircle(Math.cos((k * 2 * Math.PI) / 5) * 10, Math.sin((k * 2 * Math.PI) / 5) * 10, 8);
        g.fillStyle(toHex(COLORS.sunny), 1);
        g.fillCircle(0, 0, 6);
        break;
      case 'book':
        g.fillRoundedRect(-14, -17, 28, 34, 4);
        g.fillStyle(0xffffff, 0.8);
        g.fillRect(-9, -17, 3, 34);
        break;
      case 'cup':
        g.fillRoundedRect(-13, -12, 22, 26, { tl: 2, tr: 2, bl: 8, br: 8 });
        g.lineStyle(5, c, 1);
        g.strokeCircle(12, 0, 6);
        break;
      default:
        g.fillRoundedRect(-8, -18, 14, 26, 5);
        g.fillRoundedRect(-8, 2, 24, 14, 7);
    }
    return g;
  }

  layoutCheck(): { name: string; top: number; bottom: number }[] {
    return [
      { name: 'the room', top: ROOM.y, bottom: ROOM.y + ROOM.h },
      { name: 'the walls', top: DOTS_Y - 8, bottom: DOTS_Y + 8 },
    ];
  }
}

export function escapeStatus(state: EscapeState): string | undefined {
  if (state.result) return undefined;
  const tries = state.tries ? ` · ${state.tries} ${state.tries === 1 ? 'try' : 'tries'}` : '';
  return `Room ${state.room + 1} of ${state.rooms.length}${tries} · count the things on the lock`;
}

export function escapeResult(state: EscapeState): string | undefined {
  if (!state.result) return undefined;
  return `Out of all ${state.rooms.length} rooms in ${state.tries} ${state.tries === 1 ? 'try' : 'tries'}! 🗝️`;
}
