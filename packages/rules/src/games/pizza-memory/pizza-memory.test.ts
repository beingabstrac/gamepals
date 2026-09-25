import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { replay } from '../../core/replay';
import { newPizza, NO_TOPPING, pizzaMemory, pizzaOrders, PIZZA_ORDERS, PIZZA_SLICES, type PizzaState } from './index';

describe('pizza memory', () => {
  it('orders grow by one topping each and fit eight slices', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const orders = pizzaOrders(seed);
      expect(orders.length).toBe(PIZZA_ORDERS);
      orders.forEach((o, r) => {
        expect(o.length).toBe(PIZZA_SLICES);
        expect(o.filter((t) => t !== NO_TOPPING).length).toBe(Math.min(7, 3 + r));
      });
    }
  });

  it('look takes only Ready; placing, replacing and taking off', () => {
    const s = newPizza(2);
    expect(s.legalMoves(0)).toEqual(['go']);
    const m = s.apply('go').apply('p3t2').apply('p3t4');
    expect(m.plate[3]).toBe(4);
    expect(m.apply('p3x').plate[3]).toBe(NO_TOPPING);
    expect(() => m.apply('p3t4')).toThrow();
    expect(() => s.apply('p0t0')).toThrow();
  });

  it('serving scores the slices that match and moves on', () => {
    const s = newPizza(4).apply('go');
    const empties = s.order.filter((t) => t === NO_TOPPING).length;
    const served = s.apply('serve');
    expect(served.scores).toEqual([empties]);
    expect(served.round).toBe(1);
    expect(served.phase).toBe('look');
  });

  it('five orders end it; test play is perfect and the referee replays it', () => {
    let s = pizzaMemory.newGame({ players: 1 }, 9);
    const bot = pizzaMemory.createBot('easy');
    const rng = createRng(9);
    const moves: string[] = [];
    while (!s.result) {
      const m = bot.chooseMove(s, 0, rng);
      moves.push(m);
      s = s.apply(m);
    }
    expect((s as PizzaState).perfect).toBe(PIZZA_ORDERS);
    expect((s as PizzaState).total).toBe(PIZZA_ORDERS * PIZZA_SLICES);
    expect(replay(pizzaMemory, { gameId: 'pizza-memory', seed: 9, config: { players: 1 }, moves }).result).toEqual(s.result);
  });
});
