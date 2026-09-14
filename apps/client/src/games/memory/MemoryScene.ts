import { flipMove, MEMORY_SIZES, type MemoryEvent, type MemoryMove, type MemoryState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';

const W = 600;
const H = 800;
export const MEMORY_SIZE = { width: W, height: H };
export const MEMORY_COLORS = [COLORS.sky, COLORS.tomato, COLORS.mint, COLORS.sunny];
export const MEMORY_NAMES = ['Blue', 'Red', 'Green', 'Yellow'];

const TOP = 96;
const PAD = 14;
const GAP = 12;
/** How long a missed pair stays face up so everyone can see it. */
const SHOW_MS = 950;
const PALETTE = [COLORS.tomato, COLORS.sky, COLORS.mint, COLORS.grape, COLORS.sunny, COLORS.peach, COLORS.bubblegum];

/** Each picture is a unique shape and color pair (pictures s and s + 8 share a shape but never a color). */
const styleOf = (symbol: number) => ({ shape: symbol % 8, color: toHex(PALETTE[(symbol + Math.floor(symbol / 8) * 3) % 7]!) });

function drawShape(g: GameObjects.Graphics, shape: number, color: number, r: number): void {
  g.fillStyle(color, 1);
  const poly = (points: [number, number][]) => {
    g.beginPath();
    g.moveTo(points[0]![0], points[0]![1]);
    for (const [x, y] of points.slice(1)) g.lineTo(x, y);
    g.closePath();
    g.fillPath();
  };
  switch (shape) {
    case 0:
      g.fillCircle(0, 0, r);
      break;
    case 1:
      g.fillRoundedRect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7, r * 0.35);
      break;
    case 2:
      poly([[0, -r], [r * 0.98, r * 0.78], [-r * 0.98, r * 0.78]]);
      break;
    case 3:
      poly([[0, -r * 1.1], [r * 0.8, 0], [0, r * 1.1], [-r * 0.8, 0]]);
      break;
    case 4:
      poly(
        Array.from({ length: 10 }, (_, i) => {
          const angle = -Math.PI / 2 + (i * Math.PI) / 5;
          const radius = i % 2 ? r * 0.45 : r * 1.05;
          return [Math.cos(angle) * radius, Math.sin(angle) * radius] as [number, number];
        }),
      );
      break;
    case 5:
      g.fillCircle(-r * 0.46, -r * 0.22, r * 0.52);
      g.fillCircle(r * 0.46, -r * 0.22, r * 0.52);
      poly([[-r * 0.95, -r * 0.02], [r * 0.95, -r * 0.02], [0, r * 0.92]]);
      break;
    case 6:
      g.lineStyle(r * 0.36, color, 1);
      g.strokeCircle(0, 0, r * 0.74);
      break;
    default:
      g.fillRoundedRect(-r * 0.3, -r, r * 0.6, r * 2, r * 0.2);
      g.fillRoundedRect(-r, -r * 0.3, r * 2, r * 0.6, r * 0.2);
  }
}

type Face = 'down' | 'up' | 'gone';

interface CardView {
  readonly box: GameObjects.Container;
  readonly front: GameObjects.Container;
  readonly back: GameObjects.Graphics;
  face: Face;
}

interface Chip {
  readonly box: GameObjects.Container;
  readonly score: GameObjects.Text;
}

export class MemoryScene extends Scene {
  private cards: CardView[] = [];
  private chips: Chip[] = [];
  private soloText: GameObjects.Text | null = null;
  private lastEvent: MemoryEvent | null = null;
  private blockedUntil = 0;
  private cardW = 0;
  private cardH = 0;
  private spots: { x: number; y: number }[] = [];

  constructor(private readonly session: Session<MemoryMove>) {
    super('memory');
  }

  private get state(): MemoryState {
    return this.session.state as MemoryState;
  }

  create(): void {
    fitCamera(this, W, H);
    this.layout();
    this.makeScoreboard();
    this.state.symbols.forEach((symbol, i) => {
      const view = this.makeCard(symbol, i);
      this.cards.push(view);
      // Deal: cards drop into place one after another.
      view.box.setScale(0);
      this.tweens.add({ targets: view.box, scale: 1, duration: 320, delay: 60 + i * 28, ease: 'Back.easeOut' });
    });
    this.refreshScores();

    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.tap(p.worldX, p.worldY));
    const unsubscribe = this.session.subscribe(() => this.sync());
    this.events.once('shutdown', unsubscribe);
  }

  private layout(): void {
    const { cols, rows } = MEMORY_SIZES[this.state.size];
    const areaW = W - PAD * 2;
    const areaH = H - TOP - PAD;
    let cw = (areaW - GAP * (cols - 1)) / cols;
    let ch = cw / 0.78;
    if (ch * rows + GAP * (rows - 1) > areaH) {
      ch = (areaH - GAP * (rows - 1)) / rows;
      cw = ch * 0.78;
    }
    this.cardW = cw;
    this.cardH = ch;
    const gridW = cols * cw + GAP * (cols - 1);
    const gridH = rows * ch + GAP * (rows - 1);
    const x0 = (W - gridW) / 2 + cw / 2;
    const y0 = TOP + (areaH - gridH) / 2 + ch / 2;
    this.spots = Array.from({ length: cols * rows }, (_, i) => ({ x: x0 + (i % cols) * (cw + GAP), y: y0 + Math.floor(i / cols) * (ch + GAP) }));
  }

  private makeCard(symbol: number, index: number): CardView {
    const { x, y } = this.spots[index]!;
    const w = this.cardW;
    const h = this.cardH;
    const shadow = this.add.graphics();
    shadow.fillStyle(0x2b2a3a, 0.12);
    shadow.fillRoundedRect(-w / 2, -h / 2 + 5, w, h, 16);

    const back = this.add.graphics();
    back.fillStyle(toHex(DARK.bubblegum), 1);
    back.fillRoundedRect(-w / 2, -h / 2, w, h, 16);
    back.lineStyle(4, 0xffffff, 0.85);
    back.strokeRoundedRect(-w / 2 + 8, -h / 2 + 8, w - 16, h - 16, 10);
    back.fillStyle(0xffffff, 0.3);
    for (let row = -1; row <= 1; row++) for (let col = -1; col <= 1; col++) back.fillCircle(col * w * 0.2, row * h * 0.2, Math.max(3, w * 0.035));

    const face = this.add.graphics();
    face.fillStyle(0xffffff, 1);
    face.fillRoundedRect(-w / 2, -h / 2, w, h, 16);
    face.lineStyle(3, 0xe6e0f4, 1);
    face.strokeRoundedRect(-w / 2, -h / 2, w, h, 16);
    const picture = this.add.graphics();
    const style = styleOf(symbol);
    drawShape(picture, style.shape, style.color, Math.min(w, h) * 0.3);
    const front = this.add.container(0, 0, [face, picture]).setVisible(false);

    const box = this.add.container(x, y, [shadow, back, front]);
    return { box, front, back, face: 'down' };
  }

  private makeScoreboard(): void {
    const { players } = this.state;
    if (players === 1) {
      this.soloText = sharpText(this, W / 2, TOP / 2, '', 30, COLORS.ink);
      return;
    }
    for (let seat = 0; seat < players; seat++) {
      const x = (W * (seat + 0.5)) / players;
      const width = Math.min(136, W / players - 12);
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 1);
      g.fillRoundedRect(-width / 2, -28, width, 56, 28);
      g.lineStyle(4, toHex(MEMORY_COLORS[seat]!), 1);
      g.strokeRoundedRect(-width / 2, -28, width, 56, 28);
      const label = this.session.seats[seat]?.label ?? MEMORY_NAMES[seat]!;
      const name = sharpText(this, -width / 2 + 14, 0, label.slice(0, 8), 20, COLORS.ink).setOrigin(0, 0.5);
      const score = sharpText(this, width / 2 - 22, 0, '0', 28, MEMORY_COLORS[seat]!).setFontStyle('bold');
      this.chips.push({ box: this.add.container(x, TOP / 2, [g, name, score]), score });
    }
  }

  private refreshScores(): void {
    const state = this.state;
    if (this.soloText) {
      const found = state.symbols.length / 2 - state.pairsLeft;
      this.soloText.setText(`Turns ${state.turns}    Pairs ${found} of ${state.symbols.length / 2}`);
      return;
    }
    this.chips.forEach((chip, seat) => {
      chip.score.setText(String(state.scores[seat] ?? 0));
      const active = !state.result && seat === state.currentSeat;
      this.tweens.add({ targets: chip.box, scale: active ? 1.08 : 0.94, alpha: active ? 1 : 0.6, duration: 220, ease: 'Back.easeOut' });
    });
  }

  private tap(x: number, y: number): void {
    if (this.time.now < this.blockedUntil || !this.session.isHumanTurn()) return;
    const index = this.spots.findIndex((spot) => Math.abs(spot.x - x) <= this.cardW / 2 && Math.abs(spot.y - y) <= this.cardH / 2);
    if (index < 0) return;
    const move = flipMove(index);
    if (this.state.legalMoves(this.state.currentSeat).includes(move)) this.session.play(move);
    else this.tweens.add({ targets: this.cards[index]!.box, angle: { from: -4, to: 4 }, duration: 50, yoyo: true, repeat: 1, onComplete: () => this.cards[index]!.box.setAngle(0) });
  }

  private flip(index: number, face: 'up' | 'down', delay = 0): void {
    const view = this.cards[index]!;
    if (view.face === face) return;
    view.face = face;
    this.tweens.add({
      targets: view.box,
      scaleX: 0,
      duration: 90,
      delay,
      onComplete: () => {
        view.front.setVisible(face === 'up');
        view.back.setVisible(face === 'down');
        this.tweens.add({ targets: view.box, scaleX: 1, duration: 120, ease: 'Back.easeOut' });
      },
    });
  }

  private sync(): void {
    const state = this.state;
    const event = state.last;
    if (event && event !== this.lastEvent) {
      this.lastEvent = event;
      const [a, b] = event.cards;
      this.flip(b, 'up');
      if (event.match) this.collect([a, b], event.seat);
      else {
        // Miss: a little shake, a moment to remember, then both turn back over.
        this.blockedUntil = this.time.now + SHOW_MS + 250;
        for (const card of [a, b]) {
          const box = this.cards[card]!.box;
          this.tweens.add({ targets: box, angle: { from: -3, to: 3 }, duration: 60, delay: 260, yoyo: true, repeat: 1, onComplete: () => box.setAngle(0) });
        }
        this.time.delayedCall(SHOW_MS, () => {
          if (this.state.owner[a]! < 0) this.flip(a, 'down');
          if (this.state.owner[b]! < 0) this.flip(b, 'down');
        });
      }
    }
    for (const card of state.open) this.flip(card, 'up');
    this.refreshScores();
  }

  /** A found pair pops, then flies to the scorer's chip and shrinks away. */
  private collect(cards: readonly number[], seat: number): void {
    this.blockedUntil = this.time.now + 700;
    const target = this.chips[seat]?.box ?? { x: W / 2, y: TOP / 2 };
    cards.forEach((card, i) => {
      const view = this.cards[card]!;
      view.face = 'gone';
      view.box.setDepth(10 + i);
      this.tweens.chain({
        targets: view.box,
        tweens: [
          { scale: 1.14, duration: 160, delay: 300, ease: 'Back.easeOut' },
          { x: target.x, y: target.y, scale: 0.2, alpha: 0, angle: i ? 20 : -20, duration: 420, ease: 'Cubic.easeIn' },
        ],
        onComplete: () => view.box.setVisible(false),
      });
    });
  }
}
