import { combine, type Op, OPS, STEP_BACK, type TargetMove, type TargetState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { onKeys } from '../keys';

const W = 640;
const H = 800;
export const TARGET_SIZE = { width: W, height: H };

const TARGET_Y = 62;
const POOL_TOP = 150;
const TILE = 96;
const TILE_GAP = 12;
const OPS_Y = 392;
const OP_SIZE = 72;
const STEPS_TOP = 520;
const BACK_Y = H - 52;
/** What the operations look like where a person reads them. */
const OP_LABEL: Record<Op, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };

export const TARGET_COLORS = [COLORS.sky];
export const TARGET_NAMES = ['You'];

export class TargetScene extends Scene {
  private board!: GameObjects.Graphics;
  private targetText!: GameObjects.Text;
  private poolText: GameObjects.Text[] = [];
  private opText = new Map<Op, GameObjects.Text>();
  private stepText: GameObjects.Text[] = [];
  private banner!: GameObjects.Text;
  private backText!: GameObjects.Text;
  /** Where the working stands: first number, operation, then the second finishes the step. */
  private first?: number;
  private op?: Op;

  constructor(private readonly session: Session<TargetMove>) {
    super('target-number');
  }

  private get state(): TargetState {
    return this.session.state as TargetState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.board = this.add.graphics();
    this.targetText = sharpText(this, W / 2, TARGET_Y, '', 56, COLORS.ink).setDepth(2);
    this.banner = sharpText(this, W / 2, STEPS_TOP - 36, '', 24, COLORS.soft).setDepth(2);
    this.backText = sharpText(this, W / 2, BACK_Y, 'Take a step back', 24, COLORS.sky).setDepth(2);
    for (const op of OPS) this.opText.set(op, sharpText(this, 0, 0, OP_LABEL[op], 40, COLORS.ink).setDepth(2));
    this.draw();

    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.press(p.worldX, p.worldY));
    onKeys(this, (key) => this.key(key));
    const off = this.session.subscribe(() => {
      this.first = undefined;
      this.op = undefined;
      this.draw();
    });
    this.events.once('shutdown', off);
  }

  private key(key: string): boolean {
    if (key === 'Backspace' || key === 'Escape') {
      if (this.op !== undefined) this.op = undefined;
      else if (this.first !== undefined) this.first = undefined;
      else this.back();
      this.draw();
      return true;
    }
    const op = OPS.find((one) => one === key || OP_LABEL[one] === key);
    if (op) {
      if (this.first !== undefined) this.op = op;
      this.draw();
      return true;
    }
    const index = Number(key) - 1;
    if (Number.isInteger(index) && index >= 0 && index < this.state.pool.length) {
      this.pick(index);
      return true;
    }
    return false;
  }

  private press(x: number, y: number): void {
    if (Math.abs(y - BACK_Y) < 28) {
      this.back();
      return;
    }
    const opAt = this.opIndexAt(x, y);
    if (opAt !== undefined) {
      if (this.first !== undefined) this.op = OPS[opAt];
      this.draw();
      return;
    }
    const index = this.tileAt(x, y);
    if (index !== undefined) this.pick(index);
  }

  private pick(index: number): void {
    if (this.state.result || !this.session.isHumanTurn()) return;
    if (this.first === undefined) {
      this.first = index;
    } else if (this.op === undefined || index === this.first) {
      // Tapping the same tile again lets it go; a second tile with no operation replaces the first.
      this.first = index === this.first ? undefined : index;
    } else {
      const move = combine(this.first, this.op, index);
      this.first = undefined;
      this.op = undefined;
      if (this.state.legalMoves(0).includes(move)) this.session.play(move);
      else this.say('That one does not come out whole');
      return;
    }
    this.draw();
  }

  private back(): void {
    if (this.state.result || !this.session.isHumanTurn()) return;
    if (!this.state.steps.length) {
      this.say('Nothing to take back');
      return;
    }
    this.session.play(STEP_BACK);
  }

  private say(why: string): void {
    this.banner.setText(why);
  }

  private tilesPerRow(): number {
    return Math.min(3, Math.max(1, this.state.pool.length));
  }

  private tileBox(index: number): { x: number; y: number } {
    const per = this.tilesPerRow();
    const row = Math.floor(index / per);
    const col = index % per;
    const width = per * (TILE + TILE_GAP) - TILE_GAP;
    return { x: (W - width) / 2 + col * (TILE + TILE_GAP), y: POOL_TOP + row * (TILE + TILE_GAP) };
  }

  private tileAt(x: number, y: number): number | undefined {
    for (let i = 0; i < this.state.pool.length; i++) {
      const box = this.tileBox(i);
      if (x >= box.x && x <= box.x + TILE && y >= box.y && y <= box.y + TILE) return i;
    }
    return undefined;
  }

  private opBox(index: number): { x: number; y: number } {
    const width = OPS.length * (OP_SIZE + 16) - 16;
    return { x: (W - width) / 2 + index * (OP_SIZE + 16), y: OPS_Y };
  }

  private opIndexAt(x: number, y: number): number | undefined {
    for (let i = 0; i < OPS.length; i++) {
      const box = this.opBox(i);
      if (x >= box.x && x <= box.x + OP_SIZE && y >= box.y && y <= box.y + OP_SIZE) return i;
    }
    return undefined;
  }

  private draw(): void {
    const state = this.state;
    const g = this.board.clear();
    this.targetText.setText(String(state.target));

    state.pool.forEach((value, index) => {
      const box = this.tileBox(index);
      const on = index === this.first;
      g.fillStyle(toHex(DARK.sky), 1);
      g.fillRoundedRect(box.x, box.y + 5, TILE, TILE, 18);
      g.fillStyle(on ? toHex(DARK.sky) : toHex(COLORS.sky), 1);
      g.fillRoundedRect(box.x, box.y, TILE, TILE, 18);
      const text = (this.poolText[index] ??= sharpText(this, 0, 0, '', 40, '#ffffff').setDepth(2));
      text.setPosition(box.x + TILE / 2, box.y + TILE / 2).setText(String(value)).setVisible(true);
    });
    for (let i = state.pool.length; i < this.poolText.length; i++) this.poolText[i]!.setVisible(false);

    OPS.forEach((op, index) => {
      const box = this.opBox(index);
      const on = this.op === op;
      const ready = this.first !== undefined;
      g.fillStyle(on ? toHex(COLORS.sunny) : ready ? 0xffffff : 0xf2eff8, 1);
      g.fillRoundedRect(box.x, box.y, OP_SIZE, OP_SIZE, 18);
      g.lineStyle(2, on ? toHex(COLORS.sunny) : 0xdcd6ee, 1);
      g.strokeRoundedRect(box.x, box.y, OP_SIZE, OP_SIZE, 18);
      this.opText
        .get(op)!
        .setPosition(box.x + OP_SIZE / 2, box.y + OP_SIZE / 2)
        .setColor(on ? '#ffffff' : ready ? COLORS.ink : COLORS.soft);
    });

    state.steps.forEach((step, index) => {
      const text = (this.stepText[index] ??= sharpText(this, W / 2, 0, '', 26, COLORS.soft).setDepth(2));
      text
        .setPosition(W / 2, STEPS_TOP + index * 34)
        .setText(`${step.a} ${OP_LABEL[step.op]} ${step.b} = ${step.out}`)
        .setVisible(true);
    });
    for (let i = state.steps.length; i < this.stepText.length; i++) this.stepText[i]!.setVisible(false);

    if (state.result) this.banner.setText(state.away === 0 ? 'Exactly.' : `${state.away} away.`);
    else if (!this.banner.text || this.first === undefined) this.banner.setText(`Nearest so far: ${state.closest}`);
    this.backText.setAlpha(state.steps.length && !state.result ? 1 : 0.3);
  }

  /** The bands that must not sit on top of each other, for the layout check. */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    const rows = Math.ceil(Math.max(1, this.state.pool.length) / this.tilesPerRow());
    const steps = Math.max(1, this.state.steps.length);
    return [
      { name: 'target', top: TARGET_Y - 30, bottom: TARGET_Y + 30 },
      { name: 'pool', top: POOL_TOP, bottom: POOL_TOP + (rows - 1) * (TILE + TILE_GAP) + TILE },
      { name: 'operations', top: OPS_Y, bottom: OPS_Y + OP_SIZE },
      { name: 'banner', top: STEPS_TOP - 36 - 14, bottom: STEPS_TOP - 36 + 14 },
      { name: 'working', top: STEPS_TOP - 17, bottom: STEPS_TOP + (steps - 1) * 34 + 17 },
      { name: 'take back', top: BACK_Y - 16, bottom: BACK_Y + 16 },
    ];
  }
}

export const targetStatus = (state: TargetState): string | undefined =>
  state.result ? undefined : `Make ${state.target}, nearest so far ${state.closest}`;

export const targetResult = (state: TargetState): string | undefined => {
  if (!state.result) return undefined;
  return state.away === 0 ? `Made ${state.target} exactly. 🎉` : `${state.away} away from ${state.target}.`;
};
