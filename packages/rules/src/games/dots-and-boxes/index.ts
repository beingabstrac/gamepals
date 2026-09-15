import type { Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Dots & Boxes (docs/games/dots-and-boxes.md). A square board of n × n boxes.
 * Lines: horizontal (r, c) for r in 0..n, c in 0..n-1 first, then vertical (r, c) for r in 0..n-1, c in 0..n.
 */
export type DotsLevel = 'small' | 'medium' | 'large';
export const DOTS_SIZES: Record<DotsLevel, number> = { small: 3, medium: 4, large: 5 };

/** `l<line>` draws that line. */
export type DotsMove = string;
export const drawLine = (line: number): DotsMove => `l${line}`;

export const lineTotal = (n: number) => 2 * n * (n + 1);
export const hLine = (n: number, r: number, c: number) => r * n + c;
export const vLine = (n: number, r: number, c: number) => n * (n + 1) + r * (n + 1) + c;

/** The four sides of a box: top, bottom, left, right. */
export function boxSides(n: number, box: number): [number, number, number, number] {
  const r = Math.floor(box / n);
  const c = box % n;
  return [hLine(n, r, c), hLine(n, r + 1, c), vLine(n, r, c), vLine(n, r, c + 1)];
}

/** The one or two boxes a line borders. */
export function boxesOfLine(n: number, line: number): number[] {
  if (line < n * (n + 1)) {
    const r = Math.floor(line / n);
    const c = line % n;
    return [r > 0 ? (r - 1) * n + c : -1, r < n ? r * n + c : -1].filter((b) => b >= 0);
  }
  const k = line - n * (n + 1);
  const r = Math.floor(k / (n + 1));
  const c = k % (n + 1);
  return [c > 0 ? r * n + c - 1 : -1, c < n ? r * n + c : -1].filter((b) => b >= 0);
}

export interface DotsEvent {
  readonly seat: Seat;
  readonly line: number;
  /** Boxes this line closed (0, 1 or 2). */
  readonly completed: readonly number[];
}

export class DotsState implements GameState<DotsMove> {
  constructor(
    readonly players: number,
    readonly n: number,
    /** Who drew each line, or -1 while it's still open. */
    readonly lines: readonly number[],
    /** Who claimed each box, or -1. */
    readonly boxes: readonly number[],
    readonly scores: readonly number[],
    readonly currentSeat: Seat,
    readonly result: GameResult | null,
    readonly last: DotsEvent | null,
  ) {}

  sidesDrawn(box: number): number {
    return boxSides(this.n, box).filter((s) => this.lines[s] !== -1).length;
  }

  openLines(): number[] {
    const out: number[] = [];
    this.lines.forEach((owner, i) => {
      if (owner === -1) out.push(i);
    });
    return out;
  }

  legalMoves(seat: Seat): readonly DotsMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    return this.openLines().map(drawLine);
  }

  apply(move: DotsMove): DotsState {
    if (this.result) throw new Error('Game is over');
    const line = Number(move.slice(1));
    if (!/^l\d+$/.test(move) || this.lines[line] !== -1) throw new Error(`Illegal move: ${move}`);
    const seat = this.currentSeat;
    const lines = this.lines.slice();
    lines[line] = seat;
    const boxes = this.boxes.slice();
    const completed = boxesOfLine(this.n, line).filter((b) => boxes[b] === -1 && boxSides(this.n, b).every((s) => lines[s] !== -1));
    for (const b of completed) boxes[b] = seat;
    const scores = this.scores.slice();
    scores[seat]! += completed.length;
    // Closing a box earns another turn.
    const next = completed.length ? seat : (seat + 1) % this.players;
    const done = lines.every((owner) => owner !== -1);
    return new DotsState(this.players, this.n, lines, boxes, scores, next, done ? resultFor(scores) : null, { seat, line, completed });
  }
}

function resultFor(scores: readonly number[]): GameResult {
  const best = Math.max(...scores);
  const winners = scores.flatMap((s, seat) => (s === best ? [seat] : []));
  // Everyone tied: a draw. Some players tied for first: they share the win.
  return winners.length === scores.length ? { winners: [], draw: true } : { winners, draw: false };
}

export function newDotsAndBoxes(players: number, level: DotsLevel): DotsState {
  if (players < 2 || players > 4) throw new Error(`Dots & Boxes needs 2–4 players, got ${players}`);
  const n = DOTS_SIZES[level];
  return new DotsState(players, n, Array<number>(lineTotal(n)).fill(-1), Array<number>(n * n).fill(-1), Array<number>(players).fill(0), 0, null, null);
}

// ---------- Bots

/** Lines that close a box right now. */
const closingLines = (s: DotsState) => s.openLines().filter((l) => boxesOfLine(s.n, l).some((b) => s.sidesDrawn(b) === 3));
/** Lines that don't give the next player a box (no neighbouring box reaches 3 sides). */
const safeLines = (s: DotsState) => s.openLines().filter((l) => boxesOfLine(s.n, l).every((b) => s.sidesDrawn(b) < 2));

/** How many boxes the next player could take in a row if this line is drawn. */
function givesAway(s: DotsState, line: number): number {
  let t = s.apply(drawLine(line));
  if (t.result) return 0;
  const before = t.scores[t.currentSeat]!;
  const taker = t.currentSeat;
  for (let guard = 0; guard < s.lines.length && !t.result && t.currentSeat === taker; guard++) {
    const close = closingLines(t);
    if (!close.length) break;
    t = t.apply(drawLine(close[0]!));
  }
  return t.scores[taker]! - before;
}

/** The quick, sensible policy used by Zed and inside Nova's playouts. */
function sensibleLine(s: DotsState): number {
  const close = closingLines(s);
  if (close.length) return close[0]!;
  const safe = safeLines(s);
  if (safe.length) return safe[0]!;
  let best = s.openLines()[0]!;
  let fewest = Infinity;
  for (const line of s.openLines()) {
    const given = givesAway(s, line);
    if (given < fewest) {
      fewest = given;
      best = line;
    }
  }
  return best;
}

/** Plays the game out with the sensible policy and returns `seat`'s lead over the best other player. */
function playout(s: DotsState, seat: Seat): number {
  let t = s;
  for (let guard = 0; guard < s.lines.length * 2 && !t.result; guard++) t = t.apply(drawLine(sensibleLine(t)));
  const mine = t.scores[seat]!;
  const others = Math.max(...t.scores.filter((_, i) => i !== seat));
  return mine - others;
}

function createDotsBot(tier: BotTier): Bot<DotsMove> {
  return {
    chooseMove(generic: GameState<DotsMove>, seat: Seat, rng: Rng): DotsMove {
      const s = generic as DotsState;
      const open = s.openLines();
      if (!open.length) throw new Error('No legal moves');
      const close = closingLines(s);
      if (tier === 'easy') {
        if (close.length && rng.next() < 0.6) return drawLine(rng.pick(close));
        return drawLine(rng.pick(open));
      }
      const safe = safeLines(s);
      if (tier === 'medium') {
        if (close.length) return drawLine(rng.pick(close));
        return drawLine(rng.pick(safe.length ? safe : open));
      }
      // Zed and Nova: while safe lines remain, take boxes and play safe.
      if (safe.length) return drawLine(close.length ? close[0]! : rng.pick(safe));
      if (tier === 'hard') return drawLine(sensibleLine(s));
      // Nova, in the endgame: try every line and play the rest out; this finds sacrifices and double-crosses.
      let best = open[0]!;
      let bestScore = -Infinity;
      for (const line of open) {
        const score = playout(s.apply(drawLine(line)), seat);
        if (score > bestScore) {
          bestScore = score;
          best = line;
        }
      }
      return drawLine(best);
    },
  };
}

const isLevel = (value: string | undefined): value is DotsLevel => value === 'small' || value === 'medium' || value === 'large';

export const dotsAndBoxes: GameDefinition<DotsMove> = {
  id: 'dots-and-boxes',
  name: 'Dots & Boxes',
  minPlayers: 2,
  maxPlayers: 4,
  modes: ['bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: false,
  realtime: false,
  newGame: (config, _seed) => newDotsAndBoxes(config.players, isLevel(config.variant) ? config.variant : 'medium'),
  createBot: (tier) => createDotsBot(tier),
  encodeMove: (move) => move,
};
