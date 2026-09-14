import type { Rng } from '../../core/rng';
import { createRng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/** Echo, the repeat-the-sequence memory game (docs/games/echo.md). */
export type EchoLevel = 'short' | 'classic' | 'long' | 'marathon';
export const ECHO_LEVELS: readonly EchoLevel[] = ['short', 'classic', 'long', 'marathon'];
/** Solo goals, as in the classic toy's settings. */
export const ECHO_GOALS: Record<EchoLevel, number> = { short: 8, classic: 14, long: 20, marathon: 31 };
export const ECHO_PADS = 4;
/** Party games stop here; everyone still in shares the win. */
export const ECHO_PARTY_CAP = 40;

/** `p<pad>` presses a pad (0–3); `t` means time ran out, which counts as a mistake. */
export type EchoMove = string;
export const pressMove = (pad: number): EchoMove => `p${pad}`;
export const TIMEOUT_MOVE: EchoMove = 't';
const MOVES: readonly EchoMove[] = [pressMove(0), pressMove(1), pressMove(2), pressMove(3), TIMEOUT_MOVE];

export interface EchoPress {
  readonly seat: Seat;
  readonly pad: number | null;
  readonly correct: boolean;
  /** This press finished the sequence (round done, or a step was added). */
  readonly roundDone: boolean;
}

export class EchoState implements GameState<EchoMove> {
  constructor(
    readonly players: number,
    readonly seed: number,
    readonly level: EchoLevel,
    readonly sequence: readonly number[],
    /** Steps of the sequence repeated so far on this turn. */
    readonly progress: number,
    /** Party: after repeating, the player adds one step of their own. */
    readonly phase: 'repeat' | 'add',
    readonly currentSeat: Seat,
    readonly alive: readonly boolean[],
    readonly result: GameResult | null,
    readonly last: EchoPress | null,
  ) {}

  get party(): boolean {
    return this.players > 1;
  }

  /** Longest sequence repeated in full so far (the solo score). */
  get best(): number {
    return this.result && !this.result.winners.length ? this.sequence.length - 1 : this.sequence.length - (this.progress === 0 && !this.result ? 1 : 0);
  }

  legalMoves(seat: Seat): readonly EchoMove[] {
    return this.result || seat !== this.currentSeat ? [] : MOVES;
  }

  private nextAlive(from: Seat, alive: readonly boolean[]): Seat {
    for (let k = 1; k <= this.players; k++) {
      const seat = (from + k) % this.players;
      if (alive[seat]) return seat;
    }
    return from;
  }

  apply(move: EchoMove): EchoState {
    if (this.result) throw new Error('Game is over');
    if (!MOVES.includes(move)) throw new Error(`Illegal move: ${move}`);
    const seat = this.currentSeat;
    const pad = move === TIMEOUT_MOVE ? null : Number(move.slice(1));

    if (this.phase === 'add') {
      // Party: the player's own step joins the end of the sequence; a timeout here is a mistake too.
      if (pad === null) return this.mistake(seat);
      const sequence = [...this.sequence, pad];
      const alive = this.alive;
      const next = this.nextAlive(seat, alive);
      if (sequence.length >= ECHO_PARTY_CAP) {
        const winners = alive.flatMap((a, s) => (a ? [s] : []));
        return this.with({ sequence, result: { winners, draw: false }, last: { seat, pad, correct: true, roundDone: true } });
      }
      return this.with({ sequence, progress: 0, phase: 'repeat', currentSeat: next, last: { seat, pad, correct: true, roundDone: true } });
    }

    if (pad !== this.sequence[this.progress]) return this.mistake(seat, pad);
    const progress = this.progress + 1;
    if (progress < this.sequence.length) return this.with({ progress, last: { seat, pad, correct: true, roundDone: false } });

    // The whole sequence repeated.
    if (this.party) return this.with({ progress, phase: 'add', last: { seat, pad, correct: true, roundDone: false } });
    if (this.sequence.length >= ECHO_GOALS[this.level]) {
      return this.with({ progress, result: { winners: [0], draw: false }, last: { seat, pad, correct: true, roundDone: true } });
    }
    const sequence = [...this.sequence, stepFor(this.seed, this.sequence.length)];
    return this.with({ sequence, progress: 0, last: { seat, pad, correct: true, roundDone: true } });
  }

  private mistake(seat: Seat, pad: number | null = null): EchoState {
    const last: EchoPress = { seat, pad, correct: false, roundDone: true };
    if (!this.party) return this.with({ result: { winners: [], draw: false }, last });
    const alive = this.alive.map((a, s) => (s === seat ? false : a));
    const left = alive.flatMap((a, s) => (a ? [s] : []));
    if (left.length === 1) return this.with({ alive, result: { winners: left, draw: false }, last });
    // The next player repeats the same sequence (the one who slipped added nothing).
    return this.with({ alive, progress: 0, phase: 'repeat', currentSeat: this.nextAlive(seat, alive), last });
  }

  private with(patch: Partial<{ sequence: readonly number[]; progress: number; phase: 'repeat' | 'add'; currentSeat: Seat; alive: readonly boolean[]; result: GameResult | null; last: EchoPress | null }>): EchoState {
    return new EchoState(
      this.players,
      this.seed,
      this.level,
      patch.sequence ?? this.sequence,
      patch.progress ?? this.progress,
      patch.phase ?? this.phase,
      patch.currentSeat ?? this.currentSeat,
      patch.alive ?? this.alive,
      patch.result === undefined ? this.result : patch.result,
      patch.last === undefined ? this.last : patch.last,
    );
  }
}

/** Step `index` of a solo sequence: fixed by the seed, so a game replays exactly. */
const stepFor = (seed: number, index: number) => createRng((seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0).int(ECHO_PADS);

export function newEcho(players: number, seed: number, level: EchoLevel): EchoState {
  if (players < 1 || players > 4) throw new Error(`Echo needs 1–4 players, got ${players}`);
  const s = seed >>> 0;
  return new EchoState(players, s, level, [stepFor(s, 0)], 0, 'repeat', 0, Array<boolean>(players).fill(true), null, null);
}

/**
 * Past this many steps a bot starts to slip, a little more with every extra step, like a person
 * whose memory fades (bots never look at anything but the sequence).
 */
const RECALL: Record<BotTier, number> = { easy: 6, medium: 10, hard: 16, expert: 25 };
const slipChance = (length: number, recall: number) => Math.min(0.3, Math.max(0, length - recall) * 0.015);

function createEchoBot(tier: BotTier): Bot<EchoMove> {
  return {
    chooseMove(generic: GameState<EchoMove>, _seat: Seat, rng: Rng): EchoMove {
      const state = generic as EchoState;
      if (state.phase === 'add') return pressMove(rng.int(ECHO_PADS));
      const right = state.sequence[state.progress]!;
      const slips = rng.next() < slipChance(state.sequence.length, RECALL[tier]);
      return pressMove(slips ? (right + 1 + rng.int(ECHO_PADS - 1)) % ECHO_PADS : right);
    },
  };
}

const isLevel = (value: string | undefined): value is EchoLevel => ECHO_LEVELS.includes(value as EchoLevel);

export const echo: GameDefinition<EchoMove> = {
  id: 'echo',
  name: 'Echo',
  minPlayers: 1,
  maxPlayers: 4,
  modes: ['solo', 'bot', 'sameDevice', 'onlineLive'],
  hiddenInfo: false,
  realtime: false,
  newGame: (config, seed) => newEcho(config.players, seed, isLevel(config.variant) ? config.variant : 'classic'),
  createBot: (tier) => createEchoBot(tier),
  encodeMove: (move) => move,
};
