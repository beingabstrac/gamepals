import { createRng, type Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Dominoes, Block and Draw games with a double-six set (docs/games/dominoes.md).
 * Moves: `p<tile><L|R>` plays a tile on the left or right end, `draw`, `pass`, and `deal` for the next hand.
 */
export const DOMINO_TILES: readonly (readonly [number, number])[] = (() => {
  const tiles: [number, number][] = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) tiles.push([a, b]);
  return tiles;
})();
export const tileIndex = (a: number, b: number): number => DOMINO_TILES.findIndex(([x, y]) => (x === a && y === b) || (x === b && y === a));
export const pipsOf = (tile: number): number => DOMINO_TILES[tile]![0] + DOMINO_TILES[tile]![1];
const isDouble = (tile: number) => DOMINO_TILES[tile]![0] === DOMINO_TILES[tile]![1];
const handPips = (hand: readonly number[]) => hand.reduce((sum, t) => sum + pipsOf(t), 0);

export type DominoLevel = 'draw-100' | 'draw-50' | 'block-100' | 'block-50';
export const DOMINO_LEVELS: readonly DominoLevel[] = ['draw-100', 'draw-50', 'block-100', 'block-50'];
export type DominoMove = string;
export const playTile = (tile: number, side: 'L' | 'R'): DominoMove => `p${tile}${side}`;

/** A tile on the table, with its pips in line order (left to right). */
export interface Placed {
  readonly tile: number;
  readonly left: number;
  readonly right: number;
}

export type DominoEvent =
  | { readonly kind: 'play'; readonly seat: Seat; readonly tile: number; readonly side: 'L' | 'R' }
  | { readonly kind: 'draw'; readonly seat: Seat; readonly tile: number }
  | { readonly kind: 'pass'; readonly seat: Seat }
  | { readonly kind: 'deal'; readonly seat: Seat }
  | {
      readonly kind: 'handEnd';
      readonly seat: Seat;
      /** Who won the hand; null when a blocked hand is tied. */
      readonly winner: Seat | null;
      readonly points: number;
      readonly blocked: boolean;
      /** Everyone's tiles when the hand ended, shown face up. */
      readonly hands: readonly (readonly number[])[];
    };

export class DominoState implements GameState<DominoMove> {
  constructor(
    readonly level: DominoLevel,
    readonly seed: number,
    readonly hand: number,
    readonly hands: readonly (readonly number[])[],
    readonly boneyard: readonly number[],
    readonly line: readonly Placed[],
    readonly currentSeat: Seat,
    readonly scores: readonly number[],
    /** Passes in a row; everyone passing blocks the hand. */
    readonly passes: number,
    /** Numbers each player has shown they don't hold (they passed or drew on them). Public. */
    readonly missing: readonly (readonly number[])[],
    readonly phase: 'play' | 'handOver',
    readonly result: GameResult | null,
    readonly last: DominoEvent | null,
  ) {}

  get players(): number {
    return this.hands.length;
  }

  get drawGame(): boolean {
    return this.level.startsWith('draw');
  }

  get target(): number {
    return this.level.endsWith('50') ? 50 : 100;
  }

  get ends(): readonly [number, number] | null {
    return this.line.length ? [this.line[0]!.left, this.line[this.line.length - 1]!.right] : null;
  }

  /** The tile that must open the hand: the highest double dealt, or else the heaviest tile. */
  get opening(): number {
    const dealt = this.hands.flat();
    const doubles = dealt.filter(isDouble);
    const pool = doubles.length ? doubles : dealt;
    return pool.reduce((best, t) => (pipsOf(t) > pipsOf(best) || (pipsOf(t) === pipsOf(best) && Math.max(...DOMINO_TILES[t]!) > Math.max(...DOMINO_TILES[best]!)) ? t : best));
  }

  /** Tile moves only (no draw or pass) for a hand against the current ends. */
  playsFor(hand: readonly number[]): DominoMove[] {
    const ends = this.ends;
    if (!ends) return hand.includes(this.opening) ? [playTile(this.opening, 'L')] : [];
    const moves: DominoMove[] = [];
    for (const tile of hand) {
      const [a, b] = DOMINO_TILES[tile]!;
      const fitsLeft = a === ends[0] || b === ends[0];
      const fitsRight = a === ends[1] || b === ends[1];
      if (fitsLeft) moves.push(playTile(tile, 'L'));
      // The same number on both ends: one choice is enough.
      if (fitsRight && !(fitsLeft && ends[0] === ends[1])) moves.push(playTile(tile, 'R'));
    }
    return moves;
  }

  legalMoves(seat: Seat): readonly DominoMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    if (this.phase === 'handOver') return ['deal'];
    const plays = this.playsFor(this.hands[seat]!);
    if (plays.length) return plays;
    return this.drawGame && this.boneyard.length ? ['draw'] : ['pass'];
  }

  apply(move: DominoMove): DominoState {
    if (this.result) throw new Error('Game is over');
    if (!this.legalMoves(this.currentSeat).includes(move)) throw new Error(`Illegal move: ${move}`);
    const seat = this.currentSeat;
    const next = (seat + 1) % this.players;
    if (move === 'deal') return dealHand(this.level, this.seed, this.hand + 1, this.players, this.scores, { kind: 'deal', seat });

    const noteMissing = () => {
      const ends = this.ends;
      if (!ends) return this.missing;
      return this.missing.map((known, s) => (s === seat ? [...new Set([...known, ends[0], ends[1]])] : known));
    };
    if (move === 'draw') {
      const [tile, ...boneyard] = this.boneyard;
      const hands = this.hands.map((h, s) => (s === seat ? [...h, tile!] : h));
      return new DominoState(this.level, this.seed, this.hand, hands, boneyard, this.line, seat, this.scores, this.passes, noteMissing(), 'play', null, { kind: 'draw', seat, tile: tile! });
    }
    if (move === 'pass') {
      const passes = this.passes + 1;
      const passed = new DominoState(this.level, this.seed, this.hand, this.hands, this.boneyard, this.line, next, this.scores, passes, noteMissing(), 'play', null, { kind: 'pass', seat });
      return passes >= this.players ? passed.endHand(true) : passed;
    }

    const tile = Number(move.slice(1, -1));
    const side = move.slice(-1) as 'L' | 'R';
    const [a, b] = DOMINO_TILES[tile]!;
    const ends = this.ends;
    let line: Placed[];
    if (!ends) line = [{ tile, left: a, right: b }];
    else if (side === 'L') line = [{ tile, left: a === ends[0] ? b : a, right: ends[0] }, ...this.line];
    else line = [...this.line, { tile, left: ends[1], right: a === ends[1] ? b : a }];
    const hands = this.hands.map((h, s) => (s === seat ? h.filter((t) => t !== tile) : h));
    const played = new DominoState(this.level, this.seed, this.hand, hands, this.boneyard, line, next, this.scores, 0, this.missing, 'play', null, { kind: 'play', seat, tile, side });
    return hands[seat]!.length === 0 ? played.endHand(false, seat) : played;
  }

  /** Score a finished hand: going out scores everyone else's pips; a blocked hand goes to the lightest hand. */
  private endHand(blocked: boolean, outSeat?: Seat): DominoState {
    const pips = this.hands.map(handPips);
    let winner: Seat | null;
    let points: number;
    if (!blocked) {
      winner = outSeat!;
      points = pips.reduce((sum, p, s) => (s === winner ? sum : sum + p), 0);
    } else {
      const least = Math.min(...pips);
      const lightest = pips.flatMap((p, s) => (p === least ? [s] : []));
      winner = lightest.length === 1 ? lightest[0]! : null;
      points = winner === null ? 0 : pips.reduce((sum, p, s) => (s === winner ? sum : sum + p), 0) - least;
    }
    const scores = this.scores.map((s, i) => (i === winner ? s + points : s));
    const event: DominoEvent = { kind: 'handEnd', seat: this.last?.seat ?? 0, winner, points, blocked, hands: this.hands };
    const won = winner !== null && scores[winner]! >= this.target;
    const dealer = winner ?? this.currentSeat;
    return new DominoState(this.level, this.seed, this.hand, this.hands, this.boneyard, this.line, dealer, scores, 0, this.missing, 'handOver', won ? { winners: [winner!], draw: false } : null, event);
  }
}

/** Tiles per player: 7 with two players; with more, 5 in the Draw game and 6 or 5 in the Block game. */
export function handSize(level: DominoLevel, players: number): number {
  if (players === 2) return 7;
  return level.startsWith('block') && players === 3 ? 6 : 5;
}

function dealHand(level: DominoLevel, seed: number, hand: number, players: number, scores: readonly number[], last: DominoEvent | null): DominoState {
  const rng = createRng((seed ^ Math.imul(hand + 1, 0x9e3779b1)) >>> 0);
  const tiles = DOMINO_TILES.map((_, i) => i);
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [tiles[i], tiles[j]] = [tiles[j]!, tiles[i]!];
  }
  const size = handSize(level, players);
  const hands = Array.from({ length: players }, (_, s) => tiles.slice(s * size, s * size + size));
  const boneyard = tiles.slice(players * size);
  const missing = Array.from({ length: players }, () => [] as number[]);
  const dealt = new DominoState(level, seed, hand, hands, boneyard, [], 0, scores, 0, missing, 'play', null, last);
  const opener = hands.findIndex((h) => h.includes(dealt.opening));
  return new DominoState(level, seed, hand, hands, boneyard, [], opener, scores, 0, missing, 'play', null, last);
}

export function newDominoes(players: number, seed: number, level: DominoLevel = 'draw-100'): DominoState {
  if (players < 2 || players > 4) throw new Error(`Dominoes needs 2–4 players, got ${players}`);
  return dealHand(level, seed >>> 0, 0, players, Array<number>(players).fill(0), null);
}

// ---- Bots: they read only their own hand, the table, hand sizes and what others have passed on.

function heuristic(state: DominoState, seat: Seat, move: DominoMove): number {
  const tile = Number(move.slice(1, -1));
  const after = state.apply(move);
  let score = pipsOf(tile) + (isDouble(tile) ? 2 : 0);
  const ends = after.ends;
  if (!ends || after.phase === 'handOver') return score + 100;
  const mine = state.hands[seat]!.filter((t) => t !== tile);
  // Keep tiles that still fit, and close ends the next player couldn't match before.
  score += 3 * mine.filter((t) => DOMINO_TILES[t]!.some((v) => v === ends[0] || v === ends[1])).length;
  const nextMissing = state.missing[(seat + 1) % state.players]!;
  for (const end of ends) if (nextMissing.includes(end)) score += 4;
  return score;
}

/** One possible deal of the tiles this seat can't see, keeping hand sizes and known misses. */
function determinize(state: DominoState, seat: Seat, rng: Rng): DominoState {
  const seen = new Set([...state.hands[seat]!, ...state.line.map((p) => p.tile)]);
  const unknown = DOMINO_TILES.map((_, i) => i).filter((t) => !seen.has(t));
  for (let attempt = 0; attempt < 20; attempt++) {
    const pool = unknown.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    const hands = state.hands.map((h, s) => (s === seat ? h.slice() : []));
    let ok = true;
    for (let s = 0; s < state.players && ok; s++) {
      if (s === seat) continue;
      const need = state.hands[s]!.length;
      const miss = attempt < 19 ? state.missing[s]! : [];
      for (let k = 0; k < pool.length && hands[s]!.length < need; ) {
        const t = pool[k]!;
        if (DOMINO_TILES[t]!.some((v) => miss.includes(v))) k++;
        else hands[s]!.push(pool.splice(k, 1)[0]!);
      }
      if (hands[s]!.length < need) ok = false;
    }
    if (ok) return new DominoState(state.level, state.seed, state.hand, hands, pool, state.line, state.currentSeat, state.scores, state.passes, state.missing, state.phase, null, state.last);
  }
  return state;
}

type DominoTier = { readonly style: 'random' | 'heavy' | 'smart'; readonly samples: number };
const TIERS: Record<BotTier, DominoTier> = {
  easy: { style: 'random', samples: 0 },
  medium: { style: 'heavy', samples: 0 },
  hard: { style: 'smart', samples: 0 },
  expert: { style: 'smart', samples: 24 },
};

function quickMove(state: DominoState, seat: Seat, style: DominoTier['style'], rng: Rng): DominoMove {
  const moves = state.legalMoves(seat);
  if (moves.length === 1 || !moves[0]!.startsWith('p')) return moves[0]!;
  if (style === 'random') return rng.pick(moves);
  const value = (m: DominoMove) => (style === 'heavy' ? pipsOf(Number(m.slice(1, -1))) : heuristic(state, seat, m));
  return moves.reduce((best, m) => (value(m) > value(best) ? m : best));
}

function createDominoBot(tier: DominoTier): Bot<DominoMove> {
  return {
    chooseMove(generic: GameState<DominoMove>, seat: Seat, rng: Rng): DominoMove {
      const state = generic as DominoState;
      const moves = state.legalMoves(seat);
      if (moves.length === 0) throw new Error('No legal moves');
      if (tier.samples === 0 || moves.length === 1) return quickMove(state, seat, tier.style, rng);
      // Try each move against many possible deals of the hidden tiles, playing the hand out.
      let best = moves[0]!;
      let bestValue = -Infinity;
      for (const move of moves) {
        let total = 0;
        for (let s = 0; s < tier.samples; s++) {
          let sim = determinize(state, seat, rng).apply(move);
          let guard = 0;
          while (sim.phase === 'play' && !sim.result && guard++ < 200) sim = sim.apply(quickMove(sim, sim.currentSeat, 'smart', rng));
          total += sim.scores.reduce((sum, v, i) => sum + (i === seat ? 1 : -1 / (state.players - 1)) * (v - state.scores[i]!), 0);
        }
        if (total > bestValue) {
          bestValue = total;
          best = move;
        }
      }
      return best;
    },
  };
}

const isLevel = (v: string | undefined): v is DominoLevel => DOMINO_LEVELS.includes(v as DominoLevel);

export const dominoes: GameDefinition<DominoMove> = {
  id: 'dominoes',
  name: 'Dominoes',
  minPlayers: 2,
  maxPlayers: 4,
  modes: ['bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: true,
  realtime: false,
  newGame: (config, seed) => newDominoes(config.players, seed, isLevel(config.variant) ? config.variant : 'draw-100'),
  createBot: (tier) => createDominoBot(TIERS[tier]),
  encodeMove: (move) => move,
};
