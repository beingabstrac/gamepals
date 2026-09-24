import type { Rng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Switch Board (docs/games/switch-board.md), a chill toy: a fidget board of chunky toggles,
 * sliders, dials, push buttons and one big lever, every one of them clicking, each lighting its
 * lamp on the strip along the top. Turn everything all the way on and the lamps go rainbow. It is
 * done when you say so.
 */
export const SB_TOGGLES = 4;
export const SB_SLIDERS = 3;
export const SB_SLIDER_MAX = 10;
export const SB_DIALS = 2;
export const SB_DIAL_MAX = 11;
export const SB_BUTTONS = 4;

/** `t2` flips toggle 2, `s1.7` sets slider 1 to 7, `d0.11` turns dial 0 to 11, `b3` presses button 3, `lever`, `done`. */
export type SwitchMove = string;

export interface SwitchBoard {
  readonly toggles: readonly boolean[];
  readonly sliders: readonly number[];
  readonly dials: readonly number[];
  /** How many times each button has been pressed; a lamp stays lit while the count is odd. */
  readonly presses: readonly number[];
  readonly lever: boolean;
}

export class SwitchState implements GameState<SwitchMove> {
  readonly currentSeat: Seat = 0;

  constructor(
    readonly board: SwitchBoard,
    readonly clicks: number,
    readonly last: SwitchMove | null,
    readonly result: GameResult | null,
  ) {}

  /** Every control all the way on: the lamps go rainbow. */
  get rainbow(): boolean {
    const b = this.board;
    return b.toggles.every(Boolean) && b.sliders.every((v) => v === SB_SLIDER_MAX) && b.dials.every((v) => v === SB_DIAL_MAX) && b.presses.every((n) => n % 2 === 1) && b.lever;
  }

  /** How many lamps are lit, out of one per control. */
  get lit(): number {
    const b = this.board;
    return b.toggles.filter(Boolean).length + b.sliders.filter((v) => v > 0).length + b.dials.filter((v) => v > 0).length + b.presses.filter((n) => n % 2 === 1).length + (b.lever ? 1 : 0);
  }

  legalMoves(seat: Seat): readonly SwitchMove[] {
    if (this.result || seat !== 0) return [];
    const b = this.board;
    const out: SwitchMove[] = [];
    for (let i = 0; i < SB_TOGGLES; i++) out.push(`t${i}`);
    for (let i = 0; i < SB_SLIDERS; i++) for (let v = 0; v <= SB_SLIDER_MAX; v++) if (v !== b.sliders[i]) out.push(`s${i}.${v}`);
    for (let i = 0; i < SB_DIALS; i++) for (let v = 0; v <= SB_DIAL_MAX; v++) if (v !== b.dials[i]) out.push(`d${i}.${v}`);
    for (let i = 0; i < SB_BUTTONS; i++) out.push(`b${i}`);
    out.push('lever', 'done');
    return out;
  }

  apply(move: SwitchMove): SwitchState {
    if (!this.legalMoves(0).includes(move)) throw new Error(`Illegal move: ${move}`);
    if (move === 'done') return new SwitchState(this.board, this.clicks, move, { winners: [0], draw: false });
    const b = this.board;
    const [kind, rest] = [move[0], move.slice(1)];
    const [i, v] = rest.split('.').map(Number) as [number, number | undefined];
    const set = <T>(list: readonly T[], at: number, value: T) => list.map((x, k) => (k === at ? value : x));
    const board: SwitchBoard =
      move === 'lever'
        ? { ...b, lever: !b.lever }
        : kind === 't'
          ? { ...b, toggles: set(b.toggles, i, !b.toggles[i]) }
          : kind === 's'
            ? { ...b, sliders: set(b.sliders, i, v!) }
            : kind === 'd'
              ? { ...b, dials: set(b.dials, i, v!) }
              : { ...b, presses: set(b.presses, i, b.presses[i]! + 1) };
    return new SwitchState(board, this.clicks + 1, move, null);
  }
}

export function newSwitchBoard(): SwitchState {
  const board: SwitchBoard = {
    toggles: Array<boolean>(SB_TOGGLES).fill(false),
    sliders: Array<number>(SB_SLIDERS).fill(0),
    dials: Array<number>(SB_DIALS).fill(0),
    presses: Array<number>(SB_BUTTONS).fill(0),
    lever: false,
  };
  return new SwitchState(board, 0, null, null);
}

/** Test play: turn everything all the way on, one control at a time, then call it done. */
function createSwitchBot(): Bot<SwitchMove> {
  return {
    chooseMove(generic: GameState<SwitchMove>, _seat: Seat, _rng: Rng): SwitchMove {
      const s = generic as SwitchState;
      const b = s.board;
      const t = b.toggles.findIndex((on) => !on);
      if (t >= 0) return `t${t}`;
      const sl = b.sliders.findIndex((v) => v < SB_SLIDER_MAX);
      if (sl >= 0) return `s${sl}.${SB_SLIDER_MAX}`;
      const d = b.dials.findIndex((v) => v < SB_DIAL_MAX);
      if (d >= 0) return `d${d}.${SB_DIAL_MAX}`;
      const p = b.presses.findIndex((n) => n % 2 === 0);
      if (p >= 0) return `b${p}`;
      if (!b.lever) return 'lever';
      return 'done';
    },
  };
}

export const switchBoard: GameDefinition<SwitchMove> = {
  id: 'switch-board',
  name: 'Switch Board',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo'],
  hiddenInfo: false,
  realtime: false,
  newGame: () => newSwitchBoard(),
  createBot: () => createSwitchBot(),
  encodeMove: (move) => move,
};
