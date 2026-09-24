import { createRng, type Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Mexican Train (docs/games/mexican-train.md), one round with a double-nine set. The double nine
 * sits in the middle as the hub. Everyone builds their own train out from it, and there is one
 * Mexican train anyone may add to. On your turn put one tile on your own train, on the Mexican
 * train, or on anyone's train that has a marker on it. Can't? Draw one; still can't, put a
 * marker on your own train (it is open to everyone until you play on it again) and pass. Play a
 * double and it must be covered before anything else is played, by you if you can. First to play
 * out wins; if the boneyard is empty and everyone passes, the fewest pips in hand wins.
 */
export const MT_HIGH = 9;
/** Every tile of the double-nine set but the hub, as [a, b] with a <= b. */
export const MT_TILES: readonly (readonly [number, number])[] = (() => {
  const out: [number, number][] = [];
  for (let a = 0; a <= MT_HIGH; a++) for (let b = a; b <= MT_HIGH; b++) if (!(a === MT_HIGH && b === MT_HIGH)) out.push([a, b]);
  return out;
})();
export const mtPips = (t: number) => MT_TILES[t]![0] + MT_TILES[t]![1];
export const isDouble = (t: number) => MT_TILES[t]![0] === MT_TILES[t]![1];
export const MT_HANDS: Record<number, number> = { 2: 12, 3: 10, 4: 9 };

/** `t12>2` plays tile 12 on train 2 (trains 0 to n-1 are the players', n is the Mexican train); `draw`; `pass`. */
export type TrainMove = string;
export const trainMove = (tile: number, train: number): TrainMove => `t${tile}>${train}`;

export interface Train {
  readonly tiles: readonly number[];
  /** The number showing at the open end. */
  readonly end: number;
}

export type TrainEvent =
  | { readonly kind: 'play'; readonly seat: Seat; readonly tile: number; readonly train: number }
  | { readonly kind: 'draw'; readonly seat: Seat; readonly tile: number }
  | { readonly kind: 'pass'; readonly seat: Seat };

export class TrainState implements GameState<TrainMove> {
  constructor(
    readonly players: number,
    readonly hands: readonly (readonly number[])[],
    readonly boneyard: readonly number[],
    /** One per player, then the Mexican train last. */
    readonly trains: readonly Train[],
    readonly markers: readonly boolean[],
    /** A double waiting to be covered: which train it is on. */
    readonly openDouble: number | null,
    readonly currentSeat: Seat,
    readonly drew: boolean,
    readonly passes: number,
    readonly result: GameResult | null,
    readonly last: TrainEvent | null,
  ) {}

  get mexican(): number {
    return this.players;
  }

  /** Trains `seat` may play on right now. */
  openTo(seat: Seat): number[] {
    if (this.openDouble !== null) return [this.openDouble];
    const out = [seat as number, this.mexican];
    for (let p = 0; p < this.players; p++) if (p !== seat && this.markers[p]) out.push(p);
    return out;
  }

  plays(seat: Seat): TrainMove[] {
    const out: TrainMove[] = [];
    for (const t of this.hands[seat]!)
      for (const train of this.openTo(seat)) {
        const [a, b] = MT_TILES[t]!;
        if (a === this.trains[train]!.end || b === this.trains[train]!.end) out.push(trainMove(t, train));
      }
    return out;
  }

  legalMoves(seat: Seat): readonly TrainMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    const plays = this.plays(seat);
    if (plays.length) return plays;
    return !this.drew && this.boneyard.length ? ['draw'] : ['pass'];
  }

  apply(move: TrainMove): TrainState {
    if (!this.legalMoves(this.currentSeat).includes(move)) throw new Error(`Illegal move: ${move}`);
    const seat = this.currentSeat;
    const next = ((seat + 1) % this.players) as Seat;
    if (move === 'draw') {
      const tile = this.boneyard[0]!;
      const hands = this.hands.map((h, i) => (i === seat ? [...h, tile] : h));
      return new TrainState(this.players, hands, this.boneyard.slice(1), this.trains, this.markers, this.openDouble, seat, true, this.passes, null, { kind: 'draw', seat, tile });
    }
    if (move === 'pass') {
      // A marker goes on your own train: it is open to everyone until you play on it again.
      const markers = this.markers.map((m, i) => (i === seat ? true : m));
      const passes = this.passes + 1;
      const blocked = this.boneyard.length === 0 && passes >= this.players;
      const state = new TrainState(this.players, this.hands, this.boneyard, this.trains, markers, this.openDouble, next, false, passes, null, { kind: 'pass', seat });
      return blocked ? state.finish() : state;
    }
    const m = /^t(\d+)>(\d+)$/.exec(move)!;
    const tile = Number(m[1]);
    const train = Number(m[2]);
    const [a, b] = MT_TILES[tile]!;
    const t = this.trains[train]!;
    const trains = this.trains.map((tr, i) => (i === train ? { tiles: [...tr.tiles, tile], end: a === t.end ? b : a } : tr));
    const hands = this.hands.map((h, i) => (i === seat ? h.filter((x) => x !== tile) : h));
    const markers = this.markers.map((mk, i) => (i === seat && train === seat ? false : mk));
    const event: TrainEvent = { kind: 'play', seat, tile, train };
    if (hands[seat]!.length === 0) return new TrainState(this.players, hands, this.boneyard, trains, markers, null, seat, false, 0, { winners: [seat], draw: false }, event);
    // A double must be covered: the same player goes again to try.
    if (isDouble(tile)) return new TrainState(this.players, hands, this.boneyard, trains, markers, train, seat, false, 0, null, event);
    return new TrainState(this.players, hands, this.boneyard, trains, markers, null, next, false, 0, null, event);
  }

  /** Nobody can go on: fewest pips in hand wins, level is a draw. */
  finish(): TrainState {
    const pips = this.hands.map((h) => h.reduce((s, t) => s + mtPips(t), 0));
    const least = Math.min(...pips);
    const winners = pips.flatMap((p, i) => (p === least ? [i as Seat] : []));
    const result: GameResult = winners.length === this.players ? { winners: [], draw: true } : { winners, draw: false };
    return new TrainState(this.players, this.hands, this.boneyard, this.trains, this.markers, this.openDouble, this.currentSeat, false, this.passes, result, this.last);
  }

  pipsIn(seat: Seat): number {
    return this.hands[seat]!.reduce((s, t) => s + mtPips(t), 0);
  }
}

export function newMexicanTrain(players: number, seed: number): TrainState {
  const rng = createRng(seed >>> 0);
  const deck = [...MT_TILES.keys()];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  const size = MT_HANDS[players] ?? 9;
  const hands = Array.from({ length: players }, (_, p) => deck.slice(p * size, (p + 1) * size));
  const boneyard = deck.slice(players * size);
  const trains = Array.from({ length: players + 1 }, () => ({ tiles: [] as number[], end: MT_HIGH }));
  return new TrainState(players, hands, boneyard, trains, Array<boolean>(players).fill(false), null, 0, false, 0, null, null);
}

/** The longest run the hand can lay from `end`, as tiles in order: what a player's own train wants. */
export function longestRun(hand: readonly number[], end: number): number[] {
  let best: number[] = [];
  const walk = (at: number, left: number[], run: number[]) => {
    if (run.length > best.length) best = run;
    for (const t of left) {
      const [a, b] = MT_TILES[t]!;
      if (a !== at && b !== at) continue;
      walk(a === at ? b : a, left.filter((x) => x !== t), [...run, t]);
    }
  };
  // Hands are small (at most a dozen or so), so the search is quick.
  walk(end, [...hand], []);
  return best;
}

export function chooseTrainMove(state: TrainState, tier: BotTier, rng: Rng): TrainMove {
  const seat = state.currentSeat;
  const moves = state.legalMoves(seat);
  if (moves.length === 1 || tier === 'easy') return rng.pick(moves);
  const parse = (m: TrainMove) => {
    const x = /^t(\d+)>(\d+)$/.exec(m)!;
    return { tile: Number(x[1]), train: Number(x[2]) };
  };
  const score = (m: TrainMove): number => {
    const { tile, train } = parse(m);
    let v = mtPips(tile);
    if (isDouble(tile)) v += 6;
    if (tier === 'hard' || tier === 'expert') {
      // Keep the run planned for your own train; lay other tiles elsewhere.
      const run = longestRun(state.hands[seat]!, state.trains[seat]!.end);
      if (train === seat) v += run[0] === tile ? 20 : -5;
      else if (run.includes(tile)) v -= 15;
      if (tier === 'expert' && train !== seat && train !== state.mexican) v += 4;
    }
    return v;
  };
  const scored = moves.map((m) => ({ m, v: score(m) }));
  const best = Math.max(...scored.map((s) => s.v));
  return rng.pick(scored.filter((s) => s.v >= best - 1e-9)).m;
}

export const mexicanTrain: GameDefinition<TrainMove> = {
  id: 'mexican-train',
  name: 'Mexican Train',
  minPlayers: 2,
  maxPlayers: 4,
  modes: ['bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: true,
  realtime: false,
  newGame: (config, seed) => newMexicanTrain(config.players, seed),
  createBot: (tier) => ({
    chooseMove: (generic: GameState<TrainMove>, _seat: Seat, rng: Rng) => chooseTrainMove(generic as TrainState, tier, rng),
  }) satisfies Bot<TrainMove>,
  encodeMove: (move) => move,
};
