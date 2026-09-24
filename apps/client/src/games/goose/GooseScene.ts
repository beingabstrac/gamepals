import {
  GEESE,
  GOOSE_BRIDGE,
  GOOSE_DEATH,
  GOOSE_HOME,
  GOOSE_INN,
  GOOSE_MAZE,
  GOOSE_PRISON,
  GOOSE_WELL,
  type GooseEvent,
  type GooseMove,
  type GooseState,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { onKeys } from '../keys';

const W = 600;
const H = 760;
export const GOOSE_SIZE = { width: W, height: H };
export const GOOSE_COLORS = [COLORS.tomato, COLORS.sky, COLORS.mint, COLORS.grape];

const SIDE = 8;
const CELL = 66;
const BOARD = { x: (W - SIDE * CELL) / 2, y: 30 };
const DICE_Y = BOARD.y + SIDE * CELL + 90;
const STEP_MS = 120;
const JUMP_MS = 380;

/** Square number to grid cell: a spiral from the bottom-left corner, clockwise, in to the middle. */
const SPIRAL: readonly { col: number; row: number }[] = (() => {
  const out: { col: number; row: number }[] = [];
  let [top, bottom, left, right] = [0, SIDE - 1, 0, SIDE - 1];
  while (top <= bottom && left <= right) {
    for (let c = left; c <= right; c++) out.push({ col: c, row: bottom });
    for (let r = bottom - 1; r >= top; r--) out.push({ col: right, row: r });
    if (top < bottom) for (let c = right - 1; c >= left; c--) out.push({ col: c, row: top });
    if (left < right) for (let r = top + 1; r <= bottom - 1; r++) out.push({ col: left, row: r });
    top++;
    bottom--;
    left++;
    right--;
  }
  return out;
})();

const SPECIAL: Record<number, { label: string; color: string }> = {
  [GOOSE_BRIDGE.from]: { label: 'Bridge', color: COLORS.peach },
  [GOOSE_INN]: { label: 'Inn', color: COLORS.grape },
  [GOOSE_WELL]: { label: 'Well', color: COLORS.sky },
  [GOOSE_MAZE.from]: { label: 'Maze', color: COLORS.mint },
  [GOOSE_PRISON]: { label: 'Jail', color: COLORS.ink },
  [GOOSE_DEATH]: { label: 'To start', color: COLORS.tomato },
  [GOOSE_HOME]: { label: 'Home', color: COLORS.bubblegum },
};

/**
 * Game of the Goose. The rules throw the dice and work out every hop; the scene walks the token
 * square by square, flies it goose to goose, jumps it over the Bridge or back from the Maze, and
 * knocks the other token back to where the move started.
 */
export class GooseScene extends Scene {
  private tokens: GameObjects.Container[] = [];
  private dice: GameObjects.Graphics[] = [];
  private shown: number[] = [];
  private moving = 0;

  constructor(private readonly session: Session<GooseMove>) {
    super('goose');
  }

  private get state(): GooseState {
    return this.session.state as GooseState;
  }

  /** Where seat `seat`'s token sits on square `square`: a corner of the tile each, so they never cover. */
  private spot(square: number, seat: number): { x: number; y: number } {
    const { col, row } = SPIRAL[square]!;
    const dx = seat % 2 === 0 ? -1 : 1;
    const dy = seat < 2 ? -1 : 1;
    return { x: BOARD.x + col * CELL + CELL / 2 + dx * CELL * 0.2, y: BOARD.y + row * CELL + CELL / 2 + dy * CELL * 0.18 };
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.drawBoard();
    const s = this.state;
    this.shown = [...s.positions];
    this.tokens = s.positions.map((p, seat) => this.makeToken(seat).setPosition(this.spot(p, seat).x, this.spot(p, seat).y));
    this.dice = [0, 1].map((k) => this.add.graphics().setPosition(W / 2 - 60 + k * 120, DICE_Y));
    this.drawDice(s.last?.dice ?? [1, 1]);
    const roll = this.add.graphics();
    roll.fillStyle(toHex(DARK.sunny), 1);
    roll.fillRoundedRect(W / 2 - 90, DICE_Y + 56 + 6, 180, 52, 26);
    roll.fillStyle(toHex(COLORS.sunny), 1);
    roll.fillRoundedRect(W / 2 - 90, DICE_Y + 56, 180, 52, 26);
    sharpText(this, W / 2, DICE_Y + 82, 'Roll', 26, COLORS.ink).setFontStyle('bold');
    this.input.on('pointerdown', (p: { worldY: number }) => {
      if (p.worldY > DICE_Y - 50) this.roll();
    });
    onKeys(this, (key) => {
      if (key === ' ' || key === 'Enter') return this.roll(), true;
      return false;
    });
    const off = this.session.subscribe(() => this.changed());
    this.session.holdBots = () => this.busy();
    this.events.once('shutdown', () => {
      off();
      this.session.holdBots = null;
    });
  }

  busy(): boolean {
    return this.moving > 0;
  }

  private roll(): void {
    if (!this.session.isHumanTurn() || this.state.result || this.busy()) return;
    this.session.play('roll');
  }

  private drawBoard(): void {
    const g = this.add.graphics();
    g.fillStyle(toHex(DARK.sunny), 1);
    g.fillRoundedRect(BOARD.x - 12, BOARD.y - 12 + 8, SIDE * CELL + 24, SIDE * CELL + 24, 28);
    g.fillStyle(toHex('#FFE9A8'), 1);
    g.fillRoundedRect(BOARD.x - 12, BOARD.y - 12, SIDE * CELL + 24, SIDE * CELL + 24, 28);
    SPIRAL.forEach(({ col, row }, square) => {
      const x = BOARD.x + col * CELL + 3;
      const y = BOARD.y + row * CELL + 3;
      const special = SPECIAL[square];
      const goose = GEESE.includes(square);
      const fill = special ? special.color : goose ? COLORS.sunny : square === 0 ? '#E6E0F4' : '#FFFFFF';
      g.fillStyle(toHex(fill), 1);
      g.fillRoundedRect(x, y, CELL - 6, CELL - 6, 12);
      const ink = special && special.color !== COLORS.sunny ? '#FFFFFF' : COLORS.ink;
      sharpText(this, x + 13, y + 12, String(square), 15, ink).setFontStyle('bold');
      if (special) sharpText(this, x + (CELL - 6) / 2, y + CELL - 20, special.label, 14, ink).setFontStyle('bold');
      if (goose) this.drawGoose(g, x + (CELL - 6) / 2 + 4, y + (CELL - 6) / 2 + 6);
    });
  }

  /** A little white goose: a round body, a neck, a head and an orange beak. */
  private drawGoose(g: GameObjects.Graphics, x: number, y: number): void {
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(x, y + 6, 26, 16);
    g.fillRoundedRect(x + 4, y - 12, 6, 16, 3);
    g.fillCircle(x + 8, y - 12, 6);
    g.fillStyle(toHex(COLORS.peach), 1);
    g.fillTriangle(x + 13, y - 14, x + 20, y - 11, x + 13, y - 9);
    g.fillStyle(toHex(COLORS.ink), 1);
    g.fillCircle(x + 9, y - 13, 1.6);
  }

  private makeToken(seat: number): GameObjects.Container {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(0, 12, 26, 9);
    g.fillStyle(toHex(DARK[(['tomato', 'sky', 'mint', 'grape'] as const)[seat]!]), 1);
    g.fillCircle(0, 3, 13);
    g.fillStyle(toHex(GOOSE_COLORS[seat]!), 1);
    g.fillCircle(0, 0, 13);
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(-4, -4, 4);
    return this.add.container(0, 0, [g]).setDepth(5 + seat);
  }

  private drawDice(values: readonly number[]): void {
    const pips: Record<number, [number, number][]> = {
      1: [[0, 0]],
      2: [[-1, -1], [1, 1]],
      3: [[-1, -1], [0, 0], [1, 1]],
      4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
      5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
      6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
    };
    this.dice.forEach((g, k) => {
      g.clear();
      g.fillStyle(toHex('#D9D3EC'), 1);
      g.fillRoundedRect(-30, -30 + 5, 60, 60, 14);
      g.fillStyle(0xffffff, 1);
      g.fillRoundedRect(-30, -30, 60, 60, 14);
      g.fillStyle(toHex(COLORS.ink), 1);
      for (const [px, py] of pips[values[k] ?? 1]!) g.fillCircle(px * 15, py * 15, 5.5);
    });
  }

  private changed(): void {
    const event = this.state.last;
    if (!event) return;
    this.moving++;
    // The dice tumble for a moment and land on the throw.
    let spins = 0;
    const tumble = this.time.addEvent({
      delay: 60,
      repeat: 5,
      callback: () => {
        spins++;
        this.drawDice([((spins * 5 + event.dice[0]) % 6) + 1, ((spins * 3 + event.dice[1]) % 6) + 1]);
        for (const d of this.dice) d.setAngle((spins % 2 ? 8 : -8) * (6 - spins) * 0.4);
      },
    });
    cue('roll');
    this.time.delayedCall(380, () => {
      tumble.remove();
      this.drawDice(event.dice);
      for (const d of this.dice) d.setAngle(0);
      this.play(event);
    });
  }

  /** The hops one after another, then anyone knocked back, then the square's say. */
  private play(event: GooseEvent): void {
    const token = this.tokens[event.seat]!;
    const steps: { to: number; jump: boolean }[] = [];
    let at = this.shown[event.seat]!;
    for (const hop of event.hops) {
      if (hop.kind === 'walk' || hop.kind === 'back') {
        const dir = hop.to >= at ? 1 : -1;
        while (at !== hop.to) steps.push({ to: (at += dir), jump: false });
      } else steps.push({ to: (at = hop.to), jump: true });
    }
    const next = (i: number) => {
      if (i >= steps.length) return this.landed(event);
      const { to, jump } = steps[i]!;
      const p = this.spot(to, event.seat);
      const from = { x: token.x, y: token.y };
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: jump ? JUMP_MS : STEP_MS,
        ease: jump ? 'Sine.easeInOut' : 'Linear',
        onUpdate: (tween) => {
          const t = tween.getValue() ?? 1;
          token.setPosition(from.x + (p.x - from.x) * t, from.y + (p.y - from.y) * t - Math.sin(Math.PI * t) * (jump ? 70 : 14));
        },
        onComplete: () => {
          if (jump) cue('place');
          next(i + 1);
        },
      });
    };
    next(0);
  }

  private landed(event: GooseEvent): void {
    const token = this.tokens[event.seat]!;
    this.shown[event.seat] = this.state.positions[event.seat]!;
    this.tweens.add({ targets: token, scaleX: 1.25, scaleY: 0.8, duration: 90, yoyo: true });
    cue(event.effect === 'home' ? 'win' : event.effect ? 'buzz' : 'tap');
    const settle = () => {
      this.moving--;
    };
    if (event.bumped) {
      const b = event.bumped;
      const other = this.tokens[b.seat]!;
      const p = this.spot(b.to, b.seat);
      this.shown[b.seat] = b.to;
      cue('hit');
      this.tweens.add({ targets: other, x: p.x, y: p.y, duration: JUMP_MS, ease: 'Back.easeOut', onComplete: settle });
    } else this.time.delayedCall(120, settle);
  }

  /** The board and the dice, for the layout check. */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    return [
      { name: 'the board', top: BOARD.y - 12, bottom: BOARD.y + SIDE * CELL + 20 },
      { name: 'the dice', top: DICE_Y - 30, bottom: DICE_Y + 114 },
    ];
  }
}

/** What the last throw did, in a few plain words, and whose turn it is. */
export function gooseStatus(state: GooseState, names: readonly string[]): string | undefined {
  if (state.result) return undefined;
  const name = (seat: number) => names[seat] ?? `Player ${seat + 1}`;
  const e = state.last;
  const turn = `${name(state.currentSeat)} to roll`;
  if (!e) return turn;
  const who = name(e.seat);
  const jumped = e.hops.find((h) => h.kind !== 'walk' && h.kind !== 'back');
  const said =
    e.effect === 'inn'
      ? `${who} is at the Inn: miss a turn`
      : e.effect === 'well'
        ? `${who} fell in the Well`
        : e.effect === 'prison'
          ? `${who} is in Jail`
          : jumped?.kind === 'goose'
            ? `Goose! ${who} flies on ${e.dice[0] + e.dice[1]}`
            : jumped?.kind === 'bridge'
              ? `${who} crosses the Bridge`
              : jumped?.kind === 'maze'
                ? `${who} is lost in the Maze`
                : jumped?.kind === 'death'
                  ? `${who} goes back to the start`
                  : jumped?.kind === 'first'
                    ? `A lucky first throw for ${who}`
                    : `${who} threw ${e.dice[0] + e.dice[1]}`;
  const freed = e.released ? ' · everyone is let out' : e.bumped ? ` · ${name(e.bumped.seat)} is knocked back` : '';
  return `${said}${freed} · ${turn}`;
}

export function gooseResult(state: GooseState, names: readonly string[]): string | undefined {
  if (!state.result) return undefined;
  return `${names[state.result.winners[0]!] ?? 'Someone'} reached home! 🎉`;
}
