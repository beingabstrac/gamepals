import { isDouble, MT_HIGH, MT_TILES, trainMove, type TrainMove, type TrainState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { HandPrivacy } from '../cards/privacy';
import { fitCamera, sharpText } from '../crisp';
import { onKeys } from '../keys';

const W = 720;
const H = 720;
export const TRAIN_CANVAS = { width: W, height: H };
export const TRAIN_COLORS = [COLORS.tomato, COLORS.sky, COLORS.mint, COLORS.sunny];
export const TRAIN_NAMES = ['Red', 'Blue', 'Green', 'Yellow'];
const TRAIN_DARK = [DARK.tomato, DARK.sky, DARK.mint, DARK.sunny];

const TOP = 70;
const AREA_H = 420;
const HUB_X = 64;
const ROW_X = 150;
const TW = 60;
const TH = 30;
const HAND_Y = 590;
const HW = 64;
const HH = 32;
const BUTTON = { x: 640, y: 672, w: 120, h: 50 };
const PIP_COLORS = [COLORS.ink, COLORS.tomato, COLORS.peach, COLORS.sunny, COLORS.mint, COLORS.sky, COLORS.grape, COLORS.bubblegum, DARK.mint, DARK.sky];
/** Pips on a 3 by 3 grid, 0 to 9. */
const PIPS: readonly (readonly number[])[] = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8], [0, 2, 3, 4, 5, 6, 8], [0, 1, 2, 3, 5, 6, 7, 8], [0, 1, 2, 3, 4, 5, 6, 7, 8]];

/**
 * Mexican Train. The rules hold the trains and hands; the scene draws the hub, one row per train
 * (each player's, then the Mexican train) with its end showing and a marker flag when it is open,
 * the hand along the bottom (covered between people passing the phone), and Draw or Pass.
 */
export class TrainScene extends Scene {
  private g!: GameObjects.Graphics;
  private labels: GameObjects.Text[] = [];
  private buttonText!: GameObjects.Text;
  private banner!: GameObjects.Text;
  private privacy!: HandPrivacy;
  private picked: number | null = null;
  private cursor = 0;

  constructor(private readonly session: Session<TrainMove>) {
    super('mexican-train');
  }

  private get state(): TrainState {
    return this.session.state as TrainState;
  }

  private rowY(train: number): number {
    const rows = this.state.players + 1;
    return TOP + (AREA_H / rows) * (train + 0.5);
  }

  /** Hand tiles in rows of seven (more a row past twenty-one), left of the Draw button. */
  private handXY(i: number, n: number): { x: number; y: number } {
    const each = Math.max(7, Math.ceil(n / 3));
    const perRow = Math.min(n, each);
    const step = Math.min(HW + 10, 540 / perRow);
    const row = Math.floor(i / each);
    const col = i % each;
    const width = perRow * step - 10;
    return { x: 295 - width / 2 + col * step + HW / 2, y: HAND_Y - 26 + row * (HH + 22) };
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.g = this.add.graphics();
    const s = this.state;
    this.labels = Array.from({ length: s.players + 1 }, (_, t) => sharpText(this, ROW_X - 30, this.rowY(t), '', 16, COLORS.ink).setFontStyle('bold').setDepth(2));
    this.buttonText = sharpText(this, BUTTON.x, BUTTON.y, '', 22, '#FFFFFF').setFontStyle('bold').setDepth(3);
    this.banner = sharpText(this, W / 2, 30, '', 22, COLORS.ink).setFontStyle('bold').setDepth(3);
    this.privacy = new HandPrivacy(this, this.session.seats, { x: W / 2, y: HAND_Y, width: W - 40 });
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.tap(p.worldX, p.worldY));
    onKeys(this, (key) => this.key(key));
    const off = this.session.subscribe(() => this.changed());
    this.events.once('shutdown', off);
    this.draw();
  }

  private myHand(): readonly number[] {
    return this.state.hands[this.privacy.shown] ?? [];
  }

  private canAct(): boolean {
    return this.session.isHumanTurn() && !this.state.result && this.privacy.open && this.privacy.shown === this.state.currentSeat;
  }

  /** Trains the picked tile can go on right now. */
  private targets(tile: number): number[] {
    return this.state
      .legalMoves(this.state.currentSeat)
      .filter((m) => m.startsWith(`t${tile}>`))
      .map((m) => Number(m.split('>')[1]));
  }

  private tap(x: number, y: number): void {
    if (this.privacy.lift()) return this.draw();
    if (!this.canAct()) return;
    // Draw or Pass.
    if (Math.abs(x - BUTTON.x) < BUTTON.w / 2 && Math.abs(y - BUTTON.y) < BUTTON.h / 2) {
      const only = this.state.legalMoves(this.state.currentSeat);
      if (only.length === 1 && (only[0] === 'draw' || only[0] === 'pass')) this.session.play(only[0]!);
      else cue('buzz');
      return;
    }
    // A train row: play the picked tile there.
    if (this.picked !== null && y > TOP && y < TOP + AREA_H) {
      const train = Math.floor(((y - TOP) / AREA_H) * (this.state.players + 1));
      if (this.targets(this.picked).includes(train)) return this.play(this.picked, train);
    }
    // A tile in the hand: pick it (and play it if it fits one train only).
    const hand = this.myHand();
    const i = hand.findIndex((_, k) => {
      const p = this.handXY(k, hand.length);
      return Math.abs(x - p.x) < HW / 2 + 4 && Math.abs(y - p.y) < HH / 2 + 8;
    });
    if (i < 0) return;
    this.cursor = i;
    this.pick(hand[i]!);
  }

  private pick(tile: number): void {
    const to = this.targets(tile);
    if (!to.length) {
      this.picked = null;
      cue('buzz');
    } else if (to.length === 1) return this.play(tile, to[0]!);
    else {
      this.picked = tile;
      cue('tap');
    }
    this.draw();
  }

  private play(tile: number, train: number): void {
    this.picked = null;
    this.session.play(trainMove(tile, train));
  }

  private key(key: string): boolean {
    if (this.privacy.lift()) return this.draw(), true;
    if (!this.canAct()) return false;
    const hand = this.myHand();
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      this.cursor = Math.max(0, Math.min(hand.length - 1, this.cursor + (key === 'ArrowLeft' ? -1 : 1)));
      this.draw();
      return true;
    }
    if (key === 'Enter' || key === ' ') {
      const tile = hand[this.cursor];
      if (tile !== undefined) this.pick(tile);
      return true;
    }
    const n = Number(key);
    if (this.picked !== null && n >= 1 && n <= this.state.players + 1 && this.targets(this.picked).includes(n - 1)) return this.play(this.picked, n - 1), true;
    if (key === 'd' || key === 'D' || key === 'p' || key === 'P') {
      const only = this.state.legalMoves(this.state.currentSeat);
      if (only.length === 1 && (only[0] === 'draw' || only[0] === 'pass')) this.session.play(only[0]!);
      return true;
    }
    return false;
  }

  private changed(): void {
    const s = this.state;
    const e = s.last;
    if (e?.kind === 'play') cue(isDouble(e.tile) ? 'go' : 'place');
    else if (e?.kind === 'draw') cue('tap');
    else if (e?.kind === 'pass') cue('wall');
    if (s.result) cue(s.result.draw ? 'draw' : 'win');
    this.privacy.turnChanged(s.currentSeat, !!s.result);
    if (this.cursor >= this.myHand().length) this.cursor = 0;
    this.draw();
  }

  private tile(x: number, y: number, w: number, h: number, t: number, flipped = false, glow = false): void {
    const g = this.g;
    let [a, b] = MT_TILES[t] ?? [MT_HIGH, MT_HIGH];
    if (flipped) [a, b] = [b, a];
    if (glow) {
      g.fillStyle(toHex(COLORS.sunny), 0.6);
      g.fillRoundedRect(x - w / 2 - 6, y - h / 2 - 6, w + 12, h + 12, 10);
    }
    g.fillStyle(0xe3dccd, 1);
    g.fillRoundedRect(x - w / 2, y - h / 2 + 3, w, h, 7);
    g.fillStyle(0xfffaf0, 1);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 7);
    g.lineStyle(2, toHex(COLORS.line), 1);
    g.lineBetween(x, y - h / 2 + 4, x, y + h / 2 - 4);
    const half = (cx: number, n: number) => {
      const step = h * 0.26;
      for (const k of PIPS[n]!) {
        g.fillStyle(toHex(PIP_COLORS[n]!), 1);
        g.fillCircle(cx + ((k % 3) - 1) * step, y + (Math.floor(k / 3) - 1) * step, h * 0.08);
      }
    };
    half(x - w / 4, a);
    half(x + w / 4, b);
  }

  /** A face-down tile, for other people's hands. */
  private back(x: number, y: number, w: number, h: number): void {
    const g = this.g;
    g.fillStyle(toHex(DARK.grape), 1);
    g.fillRoundedRect(x - w / 2, y - h / 2 + 3, w, h, 7);
    g.fillStyle(toHex(COLORS.grape), 1);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 7);
  }

  private draw(): void {
    const s = this.state;
    const g = this.g.clear();
    g.fillStyle(0xdff5ea, 1);
    g.fillRoundedRect(10, TOP - 16, W - 20, AREA_H + 32, 30);
    // The hub: the double nine, standing up at the left.
    g.fillStyle(0xe3dccd, 1);
    g.fillRoundedRect(HUB_X - 22, TOP + AREA_H / 2 - 60 + 4, 44, 120, 10);
    g.fillStyle(0xfffaf0, 1);
    g.fillRoundedRect(HUB_X - 22, TOP + AREA_H / 2 - 60, 44, 120, 10);
    for (const cy of [TOP + AREA_H / 2 - 30, TOP + AREA_H / 2 + 30])
      for (const k of PIPS[9]!) {
        g.fillStyle(toHex(PIP_COLORS[9]!), 1);
        g.fillCircle(HUB_X + ((k % 3) - 1) * 11, cy + (Math.floor(k / 3) - 1) * 11, 3.5);
      }
    const targets = this.picked !== null ? this.targets(this.picked) : [];
    for (let t = 0; t <= s.players; t++) {
      const y = this.rowY(t);
      const color = t === s.players ? COLORS.bubblegum : TRAIN_COLORS[t]!;
      // The rail from the hub, the train's colour.
      g.lineStyle(6, toHex(color), 0.5);
      g.lineBetween(HUB_X + 22, TOP + AREA_H / 2, ROW_X - 6, y);
      if (targets.includes(t) || s.openDouble === t) {
        g.fillStyle(toHex(s.openDouble === t ? COLORS.tomato : COLORS.sunny), 0.25);
        g.fillRoundedRect(ROW_X - 8, y - TH, W - ROW_X - 14, TH * 2, 14);
      }
      const tiles = s.trains[t]!.tiles;
      const room = Math.floor((W - ROW_X - 60) / (TW + 4));
      const shown = tiles.slice(-room);
      // Work out which way round each shown tile sits, from the hub out.
      let end = MT_HIGH;
      const ways = tiles.map((tile) => {
        const [a, b] = MT_TILES[tile]!;
        const flipped = a !== end;
        end = flipped ? a : b;
        return flipped;
      });
      shown.forEach((tile, k) => this.tile(ROW_X + k * (TW + 4) + TW / 2, y, TW, TH, tile, ways[tiles.length - shown.length + k]));
      const label = t === s.players ? 'Mex' : TRAIN_NAMES[t]!;
      this.labels[t]!.setText(tiles.length > shown.length ? `${label} +${tiles.length - shown.length}` : label).setColor(t === s.players ? DARK.bubblegum : TRAIN_DARK[t]!);
      // A marker flag on an open train.
      if (t < s.players && s.markers[t]) {
        const fx = ROW_X + shown.length * (TW + 4) + 16;
        g.lineStyle(3, toHex(COLORS.ink), 1);
        g.lineBetween(fx, y + 16, fx, y - 18);
        g.fillStyle(toHex(color), 1);
        g.fillTriangle(fx, y - 18, fx + 22, y - 11, fx, y - 4);
      }
    }
    // The hand: the viewer's own face up, others' as backs; covered while the phone is passed.
    const hand = this.myHand();
    const open = this.privacy.open;
    hand.forEach((t, i) => {
      const p = this.handXY(i, hand.length);
      if (open) this.tile(p.x, p.y, HW, HH, t, false, this.picked === t);
      else this.back(p.x, p.y, HW, HH);
    });
    if (open && this.canAct() && hand[this.cursor] !== undefined) {
      const p = this.handXY(this.cursor, hand.length);
      g.lineStyle(4, toHex(COLORS.grape), 1);
      g.strokeRoundedRect(p.x - HW / 2 - 5, p.y - HH / 2 - 5, HW + 10, HH + 10, 10);
    }
    // Draw or Pass, when that is all there is to do.
    const only = s.result ? [] : s.legalMoves(s.currentSeat);
    const button = only.length === 1 && (only[0] === 'draw' || only[0] === 'pass') && this.canAct() ? only[0] : null;
    this.buttonText.setText(button === 'draw' ? `Draw (${s.boneyard.length})` : button === 'pass' ? 'Pass' : '');
    if (button) {
      g.fillStyle(toHex(DARK.grape), 1);
      g.fillRoundedRect(BUTTON.x - BUTTON.w / 2, BUTTON.y - BUTTON.h / 2 + 5, BUTTON.w, BUTTON.h, 25);
      g.fillStyle(toHex(COLORS.grape), 1);
      g.fillRoundedRect(BUTTON.x - BUTTON.w / 2, BUTTON.y - BUTTON.h / 2, BUTTON.w, BUTTON.h, 25);
    }
    // Everyone's tile count along the top.
    this.banner.setText(s.hands.map((h, i) => `${TRAIN_NAMES[i]} ${h.length}`).join('  ·  '));
    this.privacy.draw();
  }

  /** The bands the table keeps to, for the layout check. */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    return [
      { name: 'counts', top: 18, bottom: 42 },
      { name: 'trains', top: TOP - 16, bottom: TOP + AREA_H + 16 },
      { name: 'hand', top: HAND_Y - 26 - HH / 2 - 6, bottom: BUTTON.y + BUTTON.h / 2 + 5 },
    ];
  }
}

export function trainStatus(state: TrainState, names: readonly string[]): string | undefined {
  if (state.result) return undefined;
  const name = names[state.currentSeat] ?? TRAIN_NAMES[state.currentSeat];
  if (state.openDouble !== null) return `${name}: cover the double`;
  return `${name} to play`;
}

export function trainResult(state: TrainState, names: readonly string[]): string | undefined {
  if (!state.result) return undefined;
  if (state.result.draw) return 'Blocked, and level on pips: a draw';
  const who = state.result.winners.map((s) => names[s] ?? TRAIN_NAMES[s]).join(' and ');
  return state.hands.some((h) => h.length === 0) ? `${who} played out!` : `Blocked: ${who} had the fewest pips`;
}
