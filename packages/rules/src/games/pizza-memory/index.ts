import { createRng, type Rng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Pizza Memory (docs/games/pizza-memory.md): an order is shown, then hidden, and you make it from
 * memory: eight slices, a topping (or none) on each. Five orders, each with one topping more.
 */
export const PIZZA_SLICES = 8;
export const PIZZA_TOPPINGS = 5;
export const PIZZA_ORDERS = 5;
/** Empty slice. */
export const NO_TOPPING = -1;

/** The toppings on each slice of every order, from the seed. */
export function pizzaOrders(seed: number): number[][] {
  const rng = createRng(seed >>> 0);
  return Array.from({ length: PIZZA_ORDERS }, (_, round) => {
    const count = Math.min(7, 3 + round);
    const slices: number[] = Array(PIZZA_SLICES).fill(NO_TOPPING);
    const spots = [...Array(PIZZA_SLICES).keys()];
    for (let k = 0; k < count; k++) {
      const at = spots.splice(rng.int(spots.length), 1)[0]!;
      slices[at] = rng.int(PIZZA_TOPPINGS);
    }
    return slices;
  });
}

/** `go` ends the look; `p3t2` puts topping 2 on slice 3 (`p3x` takes it off); `serve`. */
export type PizzaMove = string;

export class PizzaState implements GameState<PizzaMove> {
  readonly currentSeat: Seat = 0;

  constructor(
    readonly orders: readonly (readonly number[])[],
    readonly round: number,
    readonly phase: 'look' | 'make',
    readonly plate: readonly number[],
    /** Slices right on each order served so far. */
    readonly scores: readonly number[],
    readonly last: PizzaMove | null,
    readonly result: GameResult | null,
  ) {}

  get order(): readonly number[] {
    return this.orders[this.round] ?? this.orders[this.orders.length - 1]!;
  }

  get total(): number {
    return this.scores.reduce((a, b) => a + b, 0);
  }

  get perfect(): number {
    return this.scores.filter((s) => s === PIZZA_SLICES).length;
  }

  legalMoves(seat: Seat): readonly PizzaMove[] {
    if (this.result || seat !== 0) return [];
    if (this.phase === 'look') return ['go'];
    const out: PizzaMove[] = [];
    this.plate.forEach((t, s) => {
      for (let k = 0; k < PIZZA_TOPPINGS; k++) if (k !== t) out.push(`p${s}t${k}`);
      if (t !== NO_TOPPING) out.push(`p${s}x`);
    });
    return [...out, 'serve'];
  }

  apply(move: PizzaMove): PizzaState {
    if (!this.legalMoves(0).includes(move)) throw new Error(`Illegal move: ${move}`);
    const empty = Array<number>(PIZZA_SLICES).fill(NO_TOPPING);
    if (move === 'go') return new PizzaState(this.orders, this.round, 'make', empty, this.scores, move, null);
    if (move === 'serve') {
      const right = this.plate.filter((t, s) => t === this.order[s]).length;
      const scores = [...this.scores, right];
      const done = scores.length === this.orders.length;
      return new PizzaState(this.orders, done ? this.round : this.round + 1, 'look', this.plate, scores, move, done ? { winners: [0], draw: false } : null);
    }
    const m = /^p(\d)(?:t(\d)|x)$/.exec(move)!;
    const slice = Number(m[1]);
    const topping = m[2] === undefined ? NO_TOPPING : Number(m[2]);
    return new PizzaState(this.orders, this.round, 'make', this.plate.map((t, s) => (s === slice ? topping : t)), this.scores, move, null);
  }
}

export const newPizza = (seed: number) => new PizzaState(pizzaOrders(seed), 0, 'look', Array(PIZZA_SLICES).fill(NO_TOPPING), [], null, null);

/** Test play: makes each order exactly. */
function createPizzaBot(): Bot<PizzaMove> {
  return {
    chooseMove(generic: GameState<PizzaMove>, _seat: Seat, _rng: Rng): PizzaMove {
      const s = generic as PizzaState;
      if (s.phase === 'look') return 'go';
      const wrong = s.plate.findIndex((t, i) => t !== s.order[i]);
      if (wrong < 0) return 'serve';
      const want = s.order[wrong]!;
      return want === NO_TOPPING ? `p${wrong}x` : `p${wrong}t${want}`;
    },
  };
}

export const pizzaMemory: GameDefinition<PizzaMove> = {
  id: 'pizza-memory',
  name: 'Pizza Memory',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo', 'race'],
  hiddenInfo: false,
  realtime: false,
  newGame: (_config, seed) => newPizza(seed),
  createBot: () => createPizzaBot(),
  encodeMove: (move) => move,
};
