import { NO_TOPPING, PIZZA_ORDERS, PIZZA_SLICES, PIZZA_TOPPINGS, type PizzaMove, type PizzaState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { onKeys } from '../keys';

const W = 600;
const H = 860;
export const PIZZA_SIZE = { width: W, height: H };
export const PIZZA_TINTS = [COLORS.tomato];

const CX = W / 2;
const CY = 290;
const R = 220;
const BAR_Y = 545;
const TRAY_Y = 630;
const SERVE_Y = 740;
const REVEAL_MS = 1800;

/**
 * Pizza Memory. The rules keep the orders, the plate and the scores; the scene shows the order for
 * a few seconds, hides it, lets you pick toppings from a tray and tap slices, and after you serve
 * shows the order again with a tick on every slice you got right.
 */
export class PizzaScene extends Scene {
  private pizza!: GameObjects.Graphics;
  private ui!: GameObjects.Graphics;
  private label!: GameObjects.Text;
  private hand = 0;
  private focus = 0;
  private lookUntil = 0;
  private lookFor = 1;
  private revealUntil = 0;
  private served: { order: readonly number[]; plate: readonly number[] } | null = null;

  constructor(private readonly session: Session<PizzaMove>) {
    super('pizza-memory');
  }

  private get state(): PizzaState {
    return this.session.state as PizzaState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.pizza = this.add.graphics();
    this.ui = this.add.graphics();
    this.label = sharpText(this, CX, SERVE_Y, '', 26, '#FFFFFF').setFontStyle('bold').setDepth(2);
    this.startLook();
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
    return this.time.now < this.revealUntil;
  }

  private send(move: PizzaMove): void {
    if (!this.session.isHumanTurn() || this.state.result || this.busy()) return;
    if (this.state.legalMoves(0).includes(move)) this.session.play(move);
  }

  private startLook(): void {
    const toppings = this.state.order.filter((t) => t !== NO_TOPPING).length;
    this.lookFor = 2600 + toppings * 650;
    this.lookUntil = this.time.now + this.lookFor;
  }

  private trayX(k: number): number {
    // Five toppings and the empty hand at the end.
    return CX + (k - 2.5) * 88;
  }

  private sliceAt(x: number, y: number): number {
    const d = Math.hypot(x - CX, y - CY);
    if (d > R) return -1;
    const a = (Math.atan2(y - CY, x - CX) * 180) / Math.PI + 90;
    return Math.floor((((a % 360) + 360) % 360) / (360 / PIZZA_SLICES));
  }

  private down(x: number, y: number): void {
    const s = this.state;
    if (s.phase === 'look') {
      if (Math.abs(y - SERVE_Y) < 30 && Math.abs(x - CX) < 110) this.send('go');
      return;
    }
    if (Math.abs(y - TRAY_Y) < 38) {
      const k = [0, 1, 2, 3, 4, 5].find((i) => Math.abs(x - this.trayX(i)) < 40);
      if (k !== undefined) {
        this.hand = k === 5 ? NO_TOPPING : k;
        cue('tap');
        this.draw();
      }
      return;
    }
    if (Math.abs(y - SERVE_Y) < 30 && Math.abs(x - CX) < 110) return this.send('serve');
    const slice = this.sliceAt(x, y);
    if (slice >= 0) this.place(slice);
  }

  /** Puts what is in hand on a slice; the same topping again, or the empty hand, takes it off. */
  private place(slice: number): void {
    const now = this.state.plate[slice]!;
    if (this.hand === NO_TOPPING || now === this.hand) {
      if (now !== NO_TOPPING) this.send(`p${slice}x`);
    } else this.send(`p${slice}t${this.hand}`);
  }

  private key(key: string): boolean {
    const s = this.state;
    if (s.phase === 'look') {
      if (key === 'r' || key === 'R' || key === 'Enter' || key === ' ') return this.send('go'), true;
      return false;
    }
    const n = Number(key);
    if (key === '0') return (this.hand = NO_TOPPING), this.draw(), true;
    if (n >= 1 && n <= PIZZA_TOPPINGS) return (this.hand = n - 1), this.draw(), true;
    if (key === 'ArrowRight' || key === 'ArrowDown') return (this.focus = (this.focus + 1) % PIZZA_SLICES), this.draw(), true;
    if (key === 'ArrowLeft' || key === 'ArrowUp') return (this.focus = (this.focus + PIZZA_SLICES - 1) % PIZZA_SLICES), this.draw(), true;
    if (key === 'Enter' || key === ' ') return this.place(this.focus), true;
    if (key === 's' || key === 'S') return this.send('serve'), true;
    return false;
  }

  private changed(): void {
    const s = this.state;
    const last = s.last;
    if (!last) return;
    if (last === 'go') cue('go');
    else if (last === 'serve') {
      // The order and the plate just served, shown together for a moment.
      const prev = s.orders[s.scores.length - 1]!;
      this.served = { order: prev, plate: s.plate };
      const right = s.scores[s.scores.length - 1]!;
      cue(right === PIZZA_SLICES ? 'win' : right >= PIZZA_SLICES - 2 ? 'place' : 'buzz');
      this.revealUntil = this.time.now + REVEAL_MS;
      this.time.delayedCall(REVEAL_MS, () => {
        this.served = null;
        if (!this.state.result) this.startLook();
      });
    } else cue('place');
  }

  update(time: number): void {
    const s = this.state;
    // The look ends on its own when the time is up.
    if (s.phase === 'look' && !this.served && !s.result && time > this.lookUntil && this.session.isHumanTurn()) this.send('go');
    this.draw();
  }

  private draw(): void {
    const s = this.state;
    const g = this.pizza.clear();
    const showing = this.served ? this.served.order : s.phase === 'look' ? s.order : s.plate;
    // Crust, sauce and cheese.
    g.fillStyle(toHex(DARK.peach), 1);
    g.fillCircle(CX, CY + 8, R);
    g.fillStyle(toHex(COLORS.peach), 1);
    g.fillCircle(CX, CY, R);
    g.fillStyle(toHex(COLORS.tomato), 1);
    g.fillCircle(CX, CY, R - 18);
    g.fillStyle(toHex('#FFD66B'), 1);
    g.fillCircle(CX, CY, R - 30);
    g.lineStyle(3, toHex(DARK.peach), 0.6);
    for (let k = 0; k < PIZZA_SLICES; k++) {
      const a = ((k * 360) / PIZZA_SLICES - 90) * (Math.PI / 180);
      g.lineBetween(CX, CY, CX + Math.cos(a) * (R - 18), CY + Math.sin(a) * (R - 18));
    }
    showing.forEach((t, k) => t !== NO_TOPPING && this.topping(g, k, t));
    if (this.served) {
      this.served.order.forEach((t, k) => {
        const [x, y] = this.at(k, 0.88);
        const right = this.served!.plate[k] === t;
        g.fillStyle(toHex(right ? COLORS.mint : COLORS.tomato), 1);
        g.fillCircle(x, y, 13);
        g.lineStyle(4, 0xffffff, 1);
        if (right) {
          g.lineBetween(x - 6, y, x - 1, y + 5);
          g.lineBetween(x - 1, y + 5, x + 7, y - 5);
        } else {
          g.lineBetween(x - 5, y - 5, x + 5, y + 5);
          g.lineBetween(x - 5, y + 5, x + 5, y - 5);
        }
      });
    } else if (s.phase === 'make' && !s.result) {
      // The slice the keys are on.
      const a0 = ((this.focus * 360) / PIZZA_SLICES - 90) * (Math.PI / 180);
      const a1 = a0 + (Math.PI * 2) / PIZZA_SLICES;
      g.lineStyle(4, toHex(COLORS.grape), 0.9);
      g.beginPath();
      g.arc(CX, CY, R + 6, a0, a1);
      g.strokePath();
    }
    this.drawUi();
  }

  private at(slice: number, out: number): [number, number] {
    const a = (((slice + 0.5) * 360) / PIZZA_SLICES - 90) * (Math.PI / 180);
    return [CX + Math.cos(a) * R * out, CY + Math.sin(a) * R * out];
  }

  /** Two of a topping on a slice, one further out than the other. */
  private topping(g: GameObjects.Graphics, slice: number, t: number): void {
    for (const out of [0.42, 0.68]) {
      const [x, y] = this.at(slice, out);
      this.icon(g, x, y, t, 1);
    }
  }

  private icon(g: GameObjects.Graphics, x: number, y: number, t: number, scale: number): void {
    const u = 16 * scale;
    if (t === 0) {
      g.fillStyle(toHex(DARK.tomato), 1);
      g.fillCircle(x, y, u);
      g.fillStyle(toHex('#A82323'), 1);
      g.fillCircle(x - u * 0.35, y - u * 0.2, u * 0.2);
      g.fillCircle(x + u * 0.3, y + u * 0.3, u * 0.18);
    } else if (t === 1) {
      g.fillStyle(toHex('#F4E7D3'), 1);
      g.fillRect(x - u * 0.3, y, u * 0.6, u * 0.8);
      g.fillStyle(toHex('#C9A27A'), 1);
      g.slice(x, y + u * 0.1, u, Math.PI, 0, false);
      g.fillPath();
    } else if (t === 2) {
      g.fillStyle(toHex(COLORS.ink), 1);
      g.fillCircle(x, y, u * 0.8);
      g.fillStyle(toHex('#FFD66B'), 1);
      g.fillCircle(x, y, u * 0.35);
    } else if (t === 3) {
      g.fillStyle(toHex(COLORS.mint), 1);
      g.fillRoundedRect(x - u, y - u * 0.3, u * 2, u * 0.6, u * 0.3);
    } else {
      g.fillStyle(toHex(COLORS.sunny), 1);
      g.fillTriangle(x - u, y + u * 0.7, x + u, y + u * 0.7, x, y - u * 0.8);
      g.fillStyle(toHex(DARK.sunny), 1);
      g.fillCircle(x, y + u * 0.2, u * 0.15);
    }
  }

  private drawUi(): void {
    const g = this.ui.clear();
    const s = this.state;
    if (s.result) return void this.label.setText('');
    if (s.phase === 'look' && !this.served) {
      // How long the order stays up.
      const left = Math.max(0, (this.lookUntil - this.time.now) / this.lookFor);
      g.fillStyle(toHex('#E6E0F4'), 1);
      g.fillRoundedRect(CX - 200, BAR_Y - 8, 400, 16, 8);
      g.fillStyle(toHex(COLORS.tomato), 1);
      g.fillRoundedRect(CX - 200, BAR_Y - 8, Math.max(16, 400 * left), 16, 8);
    }
    if (s.phase === 'make' && !this.served) {
      for (let k = 0; k <= PIZZA_TOPPINGS; k++) {
        const x = this.trayX(k);
        const held = (k === PIZZA_TOPPINGS ? NO_TOPPING : k) === this.hand;
        g.fillStyle(toHex(held ? COLORS.grape : '#D9D3EC'), 1);
        g.fillCircle(x, TRAY_Y + 4, 36);
        g.fillStyle(0xffffff, 1);
        g.fillCircle(x, TRAY_Y, 36);
        if (k < PIZZA_TOPPINGS) this.icon(g, x, TRAY_Y, k, 1.2);
        else {
          g.lineStyle(4, toHex(COLORS.soft), 1);
          g.strokeCircle(x, TRAY_Y, 14);
        }
      }
    }
    const look = s.phase === 'look' && !this.served;
    const [color, dark] = look ? [COLORS.sky, DARK.sky] : [COLORS.tomato, DARK.tomato];
    if (!this.served) {
      g.fillStyle(toHex(dark), 1);
      g.fillRoundedRect(CX - 110, SERVE_Y - 28 + 6, 220, 56, 28);
      g.fillStyle(toHex(color), 1);
      g.fillRoundedRect(CX - 110, SERVE_Y - 28, 220, 56, 28);
    }
    this.label.setText(this.served ? '' : look ? 'Ready' : 'Serve');
  }

  layoutCheck(): { name: string; top: number; bottom: number }[] {
    return [
      { name: 'the pizza', top: CY - R, bottom: CY + R + 12 },
      { name: 'the timer', top: BAR_Y - 8, bottom: BAR_Y + 8 },
      { name: 'the tray', top: TRAY_Y - 36, bottom: TRAY_Y + 40 },
      { name: 'the button', top: SERVE_Y - 28, bottom: SERVE_Y + 34 },
    ];
  }
}

export function pizzaStatus(state: PizzaState): string | undefined {
  if (state.result) return undefined;
  const n = `Order ${state.round + 1} of ${PIZZA_ORDERS}`;
  return state.phase === 'look' ? `${n} · remember this pizza` : `${n} · make it from memory`;
}

export function pizzaResult(state: PizzaState): string | undefined {
  if (!state.result) return undefined;
  return `${state.total} of ${PIZZA_ORDERS * PIZZA_SLICES} slices right, ${state.perfect} perfect ${state.perfect === 1 ? 'pizza' : 'pizzas'}.`;
}
