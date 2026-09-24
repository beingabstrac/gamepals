import { createRng, type Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Tower (docs/games/tower.md): the stacking game where you pull a block and put it on top, seen
 * side on. Each row has three places, left, middle and right. On your turn take one block from any
 * row below the top two and lay it in a free place on the top row (a full top row starts a new
 * one). If the weight above any row no longer sits over that row's blocks, the tower falls and the
 * player who made it fall loses. Any pull can wobble it over, more so the taller the tower and the
 * thinner the row, and less so the more carefully it is pulled: a person's care is how slowly and
 * steadily they drew the block out, a bot's is its steadiness. That is the skill a real one has.
 */
export const TOWER_ROWS = 18;
/** The free rows at the top you may not pull from: the top row and the one under it. */
const KEEP = 2;

/**
 * A move: take the block at row `row`, place `slot`, lay it in place `to` on top, pulled with
 * `care` from 0 to 100, as `12.0>1@80`.
 */
export type TowerMove = string;

export const towerMove = (row: number, slot: number, to: number, care = 60): TowerMove => `${row}.${slot}>${to}@${Math.round(care)}`;

export function parseTower(move: string): { row: number; slot: number; to: number; care: number } | null {
  const m = /^(\d+)\.([012])>([012])@(\d{1,3})$/.exec(move);
  if (!m || Number(m[4]) > 100) return null;
  return { row: Number(m[1]), slot: Number(m[2]), to: Number(m[3]), care: Number(m[4]) };
}

/** How safely every row carries what is above it: the smallest gap, in block widths, from the
 * weight's middle to the edge of what holds it up (below zero, it falls). */
export function towerMargin(rows: readonly (readonly boolean[])[]): number {
  let worst = Infinity;
  // Walk down from the top, keeping the weight above and where its middle is.
  let weight = 0;
  let moment = 0;
  for (let r = rows.length - 1; r >= 0; r--) {
    const row = rows[r]!;
    const present = [0, 1, 2].filter((s) => row[s]);
    if (weight > 0) {
      if (!present.length) return -1;
      const lo = Math.min(...present) - 1 - 0.5;
      const hi = Math.max(...present) - 1 + 0.5;
      const mid = moment / weight;
      worst = Math.min(worst, mid - lo, hi - mid);
    }
    for (const s of present) {
      weight++;
      moment += s - 1;
    }
  }
  return worst;
}

export interface TowerLast {
  readonly seat: Seat;
  readonly from: { readonly row: number; readonly slot: number };
  readonly to: { readonly row: number; readonly slot: number };
  readonly fell: boolean;
  /** It stood by the rules but wobbled over. */
  readonly wobbled: boolean;
}

export class TowerState implements GameState<TowerMove> {
  constructor(
    readonly players: number,
    readonly rows: readonly (readonly boolean[])[],
    readonly currentSeat: Seat,
    readonly seed: number,
    readonly turns: number,
    readonly result: GameResult | null,
    readonly last: TowerLast | null,
  ) {}

  /** The row blocks go on: the top row if it has room, or a new one above it. */
  get topRow(): number {
    const top = this.rows.length - 1;
    return this.rows[top]!.every(Boolean) ? top + 1 : top;
  }

  /** The highest row you may pull from: rows at and just under the top are off limits. */
  get pullBelow(): number {
    const topFull = this.rows[this.rows.length - 1]!.every(Boolean);
    // With a full top row, that row and the one under it are kept; with a part row, that one and the full one under it.
    return this.rows.length - (topFull ? KEEP : KEEP + 1);
  }

  /** Places free on the top row, where a pulled block may go. */
  get free(): number[] {
    const top = this.topRow;
    return top === this.rows.length ? [0, 1, 2] : [0, 1, 2].filter((s) => !this.rows[top]![s]);
  }

  /** Any care from 0 to 100 is a move, so this is the authority and `legalMoves` is a spread. */
  allows(move: TowerMove): boolean {
    const m = parseTower(move);
    if (this.result || !m) return false;
    return m.row < this.pullBelow && !!this.rows[m.row]?.[m.slot] && this.free.includes(m.to);
  }

  /** Every pull and place, at a middling care: for bots and tests. */
  legalMoves(seat: Seat): readonly TowerMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    const out: TowerMove[] = [];
    const free = this.free;
    for (let r = 0; r < this.pullBelow; r++)
      for (let s = 0; s < 3; s++) if (this.rows[r]![s]) for (const to of free) out.push(towerMove(r, s, to));
    return out;
  }

  /** The rows after a move, before anything is judged. */
  after(move: TowerMove): boolean[][] {
    const m = parseTower(move)!;
    const rows = this.rows.map((r) => [...r]);
    rows[m.row]![m.slot] = false;
    const top = this.topRow;
    if (top === rows.length) rows.push([false, false, false]);
    rows[top]![m.to] = true;
    return rows;
  }

  apply(move: TowerMove): TowerState {
    if (!this.allows(move)) throw new Error(`Illegal move: ${move}`);
    const m = parseTower(move)!;
    const rows = this.after(move);
    const margin = towerMargin(rows);
    // Any pull can wobble it over; the roll is seeded, so the same game plays out the same way.
    const risk = towerRisk(this, move);
    const roll = createRng((this.seed ^ Math.imul(this.turns + 1, 0x9e3779b1)) >>> 0).next();
    const fell = margin < 0 || roll < risk;
    const top = this.topRow;
    const last: TowerLast = { seat: this.currentSeat, from: { row: m.row, slot: m.slot }, to: { row: top, slot: m.to }, fell, wobbled: fell && margin >= 0 };
    if (fell) {
      const winners = [...Array(this.players).keys()].filter((s) => s !== this.currentSeat) as Seat[];
      return new TowerState(this.players, rows, this.currentSeat, this.seed, this.turns + 1, { winners, draw: false }, last);
    }
    const next = ((this.currentSeat + 1) % this.players) as Seat;
    const state = new TowerState(this.players, rows, next, this.seed, this.turns + 1, null, last);
    // Nothing left to pull that does not bring it down is still a move: the next player must make it.
    return state;
  }
}

export function newTower(seed: number, players = 2): TowerState {
  const rows = Array.from({ length: TOWER_ROWS }, () => [true, true, true]);
  return new TowerState(players, rows, 0, seed >>> 0, 0, null, null);
}

/**
 * The chance a move topples the tower. Past the edge it falls for certain. Otherwise a little for
 * every pull, more the taller the tower and the closer the weight sits to an edge, all of it cut
 * down the more carefully the block is pulled.
 */
export function towerRisk(state: TowerState, move: TowerMove): number {
  const m = parseTower(move)!;
  const rows = state.after(move);
  const margin = towerMargin(rows);
  if (margin < 0) return 1;
  const base = 0.02 + 0.004 * Math.max(0, rows.length - TOWER_ROWS) + (margin < 0.6 ? (0.6 - margin) * 0.5 : 0);
  return Math.min(0.9, base * (1.35 - m.care / 100));
}

const TIERS: Record<BotTier, { careless: number; care: number; sides: boolean; ahead: boolean }> = {
  easy: { careless: 0.35, care: 35, sides: false, ahead: false },
  medium: { careless: 0.1, care: 55, sides: false, ahead: false },
  hard: { careless: 0, care: 72, sides: true, ahead: false },
  expert: { careless: 0, care: 85, sides: true, ahead: true },
};

/**
 * Bots: Easy often grabs any block that looks loose and pulls it roughly; the others take the
 * safest pull they can find, pulled more carefully the better they are. Hard and Expert take the
 * sides of a full row before its middle (so the row can give two), and Expert also leaves the
 * next player as few safe pulls as it can.
 */
export function chooseTowerMove(state: TowerState, tier: BotTier, rng: Rng): TowerMove {
  const t = TIERS[tier];
  const moves = state.legalMoves(state.currentSeat).map((m) => {
    const p = parseTower(m)!;
    return towerMove(p.row, p.slot, p.to, t.care);
  });
  if (!moves.length) throw new Error('No legal moves');
  if (rng.next() < t.careless) return rng.pick(moves);
  const scored = moves.map((m) => {
    const p = parseTower(m)!;
    let v = -towerRisk(state, m) * 100;
    // A full row can give two blocks if its sides go first; its middle first, only one.
    if (t.sides && p.slot === 1 && state.rows[p.row]!.every(Boolean)) v -= 0.8;
    if (t.ahead && v > -1) {
      const next = new TowerState(state.players, state.after(m), ((state.currentSeat + 1) % state.players) as Seat, state.seed, state.turns + 1, null, null);
      const safe = next.legalMoves(next.currentSeat).filter((n) => towerMargin(next.after(n)) >= 0.6).length;
      v -= safe * 0.002;
    }
    return { m, v };
  });
  const best = Math.max(...scored.map((s) => s.v));
  return rng.pick(scored.filter((s) => s.v >= best - 1e-9)).m;
}

export const tower: GameDefinition<TowerMove> = {
  id: 'tower',
  name: 'Tower',
  minPlayers: 2,
  maxPlayers: 4,
  modes: ['bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: false,
  realtime: false,
  newGame: (config, seed) => newTower(seed, config.players),
  createBot: (tier) => ({
    chooseMove: (generic: GameState<TowerMove>, _seat: Seat, rng: Rng) => chooseTowerMove(generic as TowerState, tier, rng),
  }) satisfies Bot<TowerMove>,
  encodeMove: (move) => move,
  decodeMove: (key) => (parseTower(key) ? key : null),
};
