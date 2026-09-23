import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import type { BotTier } from '../../core/types';
import {
  BOMB_POINTS,
  dealPops,
  GOLD_POINTS,
  WHACK_HOLES,
  newWhack,
  ROUND_SECONDS,
  showing,
  STUN_SECONDS,
  stepWhack,
  WHACK_STEP,
  WHACK_TIERS,
  whackBotInput,
  type Pop,
  type WhackInput,
  type WhackState,
} from './index';

const none: WhackInput = { hole: null };
/** A round under way at `clock` seconds with the pops given. */
const at = (pops: Pop[], clock: number): WhackState => ({ ...newWhack(1), pops, phase: 'round', clock });
const hit = (hole: number): WhackInput => ({ hole });

describe('whack-a-mole', () => {
  it('a mole is up only between its pop and its duck', () => {
    const pops: Pop[] = [{ at: 1, hole: 4, kind: 'mole', for: 1 }];
    expect(showing(at(pops, 0.9), 0, 4)).toBeNull();
    expect(showing(at(pops, 1.5), 0, 4)).toBe(0);
    expect(showing(at(pops, 2.1), 0, 4)).toBeNull();
  });

  it('whacking a mole scores and puts it down on that board only', () => {
    const { state, events } = stepWhack(at([{ at: 1, hole: 4, kind: 'mole', for: 1 }], 1.2), [hit(4), none]);
    expect(events.hits).toEqual([{ seat: 0, hole: 4, kind: 'mole' }]);
    expect(state.scores).toEqual([1, 0]);
    expect(showing(state, 0, 4)).toBeNull();
    expect(showing(state, 1, 4)).toBe(0);
    // Twice is nothing.
    expect(stepWhack(state, [hit(4), none]).state.scores).toEqual([1, 0]);
  });

  it('a golden mole is worth 3, a bomb takes 2 away and leaves the mallet dizzy', () => {
    const gold = stepWhack(at([{ at: 1, hole: 0, kind: 'gold', for: 1 }], 1.2), [hit(0), none]).state;
    expect(gold.scores[0]).toBe(GOLD_POINTS);
    const pops: Pop[] = [
      { at: 1, hole: 0, kind: 'bomb', for: 1 },
      { at: 1, hole: 1, kind: 'mole', for: 1.5 },
    ];
    const bombed = stepWhack(at(pops, 1.2), [hit(0), none]).state;
    expect(bombed.scores[0]).toBe(BOMB_POINTS);
    expect(bombed.stun[0]).toBeGreaterThan(0);
    // Dizzy, the next swing does nothing, even at a mole.
    expect(stepWhack(bombed, [hit(1), none]).state.scores[0]).toBe(BOMB_POINTS);
    // After the dizziness it works again.
    let later = bombed;
    for (let t = 0; t < STUN_SECONDS + 0.05; t += WHACK_STEP) later = stepWhack(later, [none, none]).state;
    expect(stepWhack(later, [hit(1), none]).state.scores[0]).toBe(BOMB_POINTS + 1);
  });

  it('an empty hole is a miss and scores nothing', () => {
    const { state, events } = stepWhack(at([], 1), [hit(3), hit(8)]);
    expect(state.scores).toEqual([0, 0]);
    expect(events.misses).toHaveLength(2);
  });

  it('deals the same moles for both boards, never two in one hole at once, and faster as it goes', () => {
    for (let seed = 0; seed < 20; seed++) {
      const pops = dealPops(seed);
      expect(pops.length).toBeGreaterThan(50);
      for (let i = 0; i < pops.length; i++) {
        for (let j = i + 1; j < pops.length; j++) {
          const [a, b] = [pops[i]!, pops[j]!];
          if (a.hole !== b.hole) continue;
          expect(b.at >= a.at + a.for || a.at >= b.at + b.for, `seed ${seed} pops ${i} and ${j}`).toBe(true);
        }
      }
      const early = pops.filter((p) => p.at < 10).length;
      const late = pops.filter((p) => p.at > ROUND_SECONDS - 10).length;
      expect(late, `seed ${seed}`).toBeGreaterThan(early);
    }
  });

  it('ends at 45 seconds, the higher score winning, a level score a draw', () => {
    let s = at([], ROUND_SECONDS - WHACK_STEP / 2);
    s = { ...s, scores: [3, 5] };
    const end = stepWhack(s, [none, none]).state;
    expect(end.result).toEqual({ winners: [1], draw: false });
    const level = stepWhack({ ...s, scores: [4, 4] }, [none, none]).state;
    expect(level.result).toEqual({ winners: [0, 1], draw: true });
  });

  it('the same inputs always give the same round', () => {
    const play = () => {
      let s = newWhack(7);
      for (let step = 0; step < 120 * 10; step++) s = stepWhack(s, [hit(step % WHACK_HOLES), hit((step * 5) % WHACK_HOLES)]).state;
      return s;
    };
    expect(play()).toEqual(play());
  });

  it('Expert outscores Easy', { timeout: 60_000 }, () => {
    const round = (tiers: [BotTier, BotTier], seed: number) => {
      const rolls = new Map<string, number>();
      const rng = createRng(seed);
      const roll = (seat: number) => (pop: number) => {
        const key = `${seat}:${pop}`;
        if (!rolls.has(key)) rolls.set(key, rng.next());
        return rolls.get(key)!;
      };
      let s = newWhack(seed);
      while (!s.result) s = stepWhack(s, [whackBotInput(s, 0, WHACK_TIERS[tiers[0]], roll(0)), whackBotInput(s, 1, WHACK_TIERS[tiers[1]], roll(1))]).state;
      return s;
    };
    let expertWins = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const s = round(seed % 2 === 0 ? ['expert', 'easy'] : ['easy', 'expert'], seed);
      const expertSeat = seed % 2 === 0 ? 0 : 1;
      if (s.result?.winners.length === 1 && s.result.winners[0] === expertSeat) expertWins++;
    }
    expect(expertWins).toBeGreaterThanOrEqual(8);
  });
});

/** Invariant: a hole never shows two things at once, and a score only ever moves by what was hit. */
describe('whack-a-mole invariants', () => {
  it('keeps one thing to a hole and the scores honest', { timeout: 60_000 }, () => {
    for (let seed = 0; seed < 5; seed++) {
      const rng = createRng(seed);
      let s = newWhack(seed);
      while (!s.result) {
        const pick = (): WhackInput => (rng.next() < 0.2 ? { hole: rng.int(WHACK_HOLES) } : none);
        const before = s.scores;
        const { state, events } = stepWhack(s, [pick(), pick()]);
        s = state;
        for (const seat of [0, 1] as const) {
          const moved = events.hits.filter((h) => h.seat === seat).reduce((sum, h) => sum + (h.kind === 'bomb' ? BOMB_POINTS : h.kind === 'gold' ? GOLD_POINTS : 1), 0);
          expect(s.scores[seat] - before[seat], `seed ${seed} at ${s.clock.toFixed(2)}`).toBe(moved);
        }
        if (s.phase === 'round') {
          for (let hole = 0; hole < WHACK_HOLES; hole++) {
            const up = s.pops.filter((p) => p.hole === hole && p.at <= s.clock && s.clock < p.at + p.for).length;
            expect(up, `seed ${seed} hole ${hole}`).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });
});
