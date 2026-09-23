import { createSearchBot, type SearchTier } from '../../core/bots';
import type { BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Nine Men's Morris (docs/games/morris.md): nine pieces each, placed and then moved along the lines
 * of three nested squares. Three in a row on a line is a mill and takes one of the other player's
 * pieces. Down to two pieces, or no move, loses. With three left a player may fly anywhere.
 *
 * The 24 points, numbered row by row:
 *   0 . . 1 . . 2
 *   . 3 . 4 . 5 .
 *   . . 6 7 8 . .
 *   9 10 11 . 12 13 14
 *   . . 15 16 17 . .
 *   . 18 . 19 . 20 .
 *   21 . . 22 . . 23
 */
export const MORRIS_POINTS = 24;
export const MORRIS_PIECES = 9;
/** Plies in the moving game with no piece taken before it is called a draw. */
export const MORRIS_QUIET_LIMIT = 100;

/** Where each point sits on a 7 by 7 grid, for drawing. */
export const MORRIS_XY: readonly (readonly [number, number])[] = [
  [0, 0], [3, 0], [6, 0], [1, 1], [3, 1], [5, 1], [2, 2], [3, 2], [4, 2],
  [0, 3], [1, 3], [2, 3], [4, 3], [5, 3], [6, 3],
  [2, 4], [3, 4], [4, 4], [1, 5], [3, 5], [5, 5], [0, 6], [3, 6], [6, 6],
];

export const MORRIS_LINKS: readonly (readonly [number, number])[] = [
  [0, 1], [1, 2], [0, 9], [9, 21], [21, 22], [22, 23], [2, 14], [14, 23],
  [3, 4], [4, 5], [3, 10], [10, 18], [18, 19], [19, 20], [5, 13], [13, 20],
  [6, 7], [7, 8], [6, 11], [11, 15], [15, 16], [16, 17], [8, 12], [12, 17],
  [1, 4], [4, 7], [9, 10], [10, 11], [12, 13], [13, 14], [16, 19], [19, 22],
];

export const MILLS: readonly (readonly [number, number, number])[] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11], [12, 13, 14], [15, 16, 17], [18, 19, 20], [21, 22, 23],
  [0, 9, 21], [3, 10, 18], [6, 11, 15], [1, 4, 7], [16, 19, 22], [8, 12, 17], [5, 13, 20], [2, 14, 23],
];

const NEIGHBORS: readonly (readonly number[])[] = Array.from({ length: MORRIS_POINTS }, (_, p) =>
  MORRIS_LINKS.flatMap(([a, b]) => (a === p ? [b] : b === p ? [a] : [])),
);
const MILLS_AT: readonly (readonly (readonly [number, number, number])[])[] = Array.from({ length: MORRIS_POINTS }, (_, p) => MILLS.filter((m) => m.includes(p)));

/** `p<point>` places, `m<from>-<to>` moves, `x<point>` takes a piece after a mill. */
export type MorrisMove = string;

export interface MorrisEvent {
  readonly seat: Seat;
  readonly kind: 'place' | 'move' | 'take';
  readonly from: number | null;
  readonly to: number;
  /** The move made a mill, so a take follows. */
  readonly mill: boolean;
}

export class MorrisState implements GameState<MorrisMove> {
  constructor(
    /** -1 empty, else the seat whose piece is there. */
    readonly board: readonly number[],
    readonly inHand: readonly [number, number],
    readonly currentSeat: Seat,
    /** The player to move has just made a mill and must take a piece. */
    readonly taking: boolean,
    readonly quiet: number,
    readonly last: MorrisEvent | null,
    readonly result: GameResult | null,
  ) {}

  onBoard(seat: Seat): number {
    return this.board.filter((b) => b === seat).length;
  }

  /** Placing, moving along a line, or flying once down to three. */
  stage(seat: Seat): 'place' | 'move' | 'fly' {
    if (this.inHand[seat]! > 0) return 'place';
    return this.onBoard(seat) === 3 ? 'fly' : 'move';
  }

  inMill(point: number): boolean {
    const who = this.board[point];
    return who !== -1 && MILLS_AT[point]!.some((m) => m.every((q) => this.board[q] === who));
  }

  /** The pieces that can be taken: any not in a mill, unless every one is. */
  takeable(seat: Seat): number[] {
    const theirs = this.board.flatMap((b, p) => (b === seat ? [p] : []));
    const loose = theirs.filter((p) => !this.inMill(p));
    return loose.length ? loose : theirs;
  }

  legalMoves(seat: Seat): readonly MorrisMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    const other: Seat = seat === 0 ? 1 : 0;
    if (this.taking) return this.takeable(other).map((p) => `x${p}`);
    const empty = this.board.flatMap((b, p) => (b === -1 ? [p] : []));
    const stage = this.stage(seat);
    if (stage === 'place') return empty.map((p) => `p${p}`);
    const moves: MorrisMove[] = [];
    this.board.forEach((b, from) => {
      if (b !== seat) return;
      const to = stage === 'fly' ? empty : NEIGHBORS[from]!.filter((q) => this.board[q] === -1);
      for (const q of to) moves.push(`m${from}-${q}`);
    });
    return moves;
  }

  apply(move: MorrisMove): MorrisState {
    if (!this.legalMoves(this.currentSeat).includes(move)) throw new Error(`Illegal move: ${move}`);
    const seat = this.currentSeat;
    const other: Seat = seat === 0 ? 1 : 0;
    const board = this.board.slice();
    const inHand: [number, number] = [this.inHand[0], this.inHand[1]];
    if (move[0] === 'x') {
      const point = Number(move.slice(1));
      board[point] = -1;
      const event: MorrisEvent = { seat, kind: 'take', from: point, to: point, mill: false };
      return this.pass(board, inHand, other, 0, event);
    }
    let from: number | null = null;
    let to: number;
    if (move[0] === 'p') {
      to = Number(move.slice(1));
      inHand[seat]--;
    } else {
      const [a, b] = move.slice(1).split('-').map(Number);
      from = a!;
      to = b!;
      board[from] = -1;
    }
    board[to] = seat;
    const mill = MILLS_AT[to]!.some((m) => m.every((q) => board[q] === seat));
    const event: MorrisEvent = { seat, kind: from === null ? 'place' : 'move', from, to, mill };
    if (mill) return new MorrisState(board, inHand, seat, true, this.quiet + 1, event, null);
    return this.pass(board, inHand, other, this.quiet + 1, event);
  }

  /** Hands the turn over, ending the game if the next player is out of pieces, out of moves, or it has gone quiet too long. */
  private pass(board: number[], inHand: [number, number], next: Seat, quiet: number, event: MorrisEvent): MorrisState {
    const mover: Seat = next === 0 ? 1 : 0;
    const placingOver = inHand[0] === 0 && inHand[1] === 0;
    const state = new MorrisState(board, inHand, next, false, placingOver ? quiet : 0, event, null);
    const left = board.filter((b) => b === next).length + inHand[next];
    if (left < 3 || state.legalMoves(next).length === 0) return new MorrisState(board, inHand, next, false, state.quiet, event, { winners: [mover], draw: false });
    if (state.quiet >= MORRIS_QUIET_LIMIT) return new MorrisState(board, inHand, next, false, state.quiet, event, { winners: [], draw: true });
    return state;
  }
}

export function newMorris(): MorrisState {
  return new MorrisState(Array<number>(MORRIS_POINTS).fill(-1), [MORRIS_PIECES, MORRIS_PIECES], 0, false, 0, null, null);
}

/** Pieces, mills, lines two of three filled with the third open, room to move and pieces with none. */
function evaluate(state: GameState<MorrisMove>, seat: Seat): number {
  const s = state as MorrisState;
  const side = (who: Seat) => {
    let score = (s.onBoard(who) + s.inHand[who]) * 100;
    for (const mill of MILLS) {
      const mine = mill.filter((p) => s.board[p] === who).length;
      const open = mill.filter((p) => s.board[p] === -1).length;
      if (mine === 3) score += 12;
      else if (mine === 2 && open === 1) score += 18;
    }
    // Room to move, and pieces with none: a blocked piece is nearly as bad as a lost one late on.
    let blocked = 0;
    let room = 0;
    s.board.forEach((b, p) => {
      if (b !== who) return;
      const free = NEIGHBORS[p]!.filter((q) => s.board[q] === -1).length;
      room += free;
      if (free === 0) blocked++;
    });
    score += 2 * room - 10 * blocked;
    return score;
  };
  const other: Seat = seat === 0 ? 1 : 0;
  return side(seat) - side(other) + (s.taking ? (s.currentSeat === seat ? 90 : -90) : 0);
}

const TIERS: Record<BotTier, SearchTier> = {
  easy: { depth: 1, randomMoveRate: 0.35 },
  medium: { depth: 2, randomMoveRate: 0.1 },
  hard: { depth: 3, randomMoveRate: 0.02 },
  expert: { depth: 5, randomMoveRate: 0 },
};

export const morris: GameDefinition<MorrisMove> = {
  id: 'morris',
  name: "Nine Men's Morris",
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: false,
  realtime: false,
  newGame: () => newMorris(),
  createBot: (tier) => {
    const deep = createSearchBot(TIERS[tier], evaluate);
    // Placing has up to 24 choices a ply and flying every empty point, so both search shallower
    // than the moving game, where a piece has only a few lines to go along.
    const placing = createSearchBot({ ...TIERS[tier], depth: Math.min(TIERS[tier].depth, 4) }, evaluate);
    const shallow = createSearchBot({ ...TIERS[tier], depth: Math.min(TIERS[tier].depth, 2) }, evaluate);
    return {
      chooseMove: (state, seat, rng) => {
        const s = state as MorrisState;
        if (s.stage(0) === 'fly' || s.stage(1) === 'fly') return shallow.chooseMove(state, seat, rng);
        return (s.inHand[0] + s.inHand[1] > 0 ? placing : deep).chooseMove(state, seat, rng);
      },
    };
  },
  encodeMove: (move) => move,
};
