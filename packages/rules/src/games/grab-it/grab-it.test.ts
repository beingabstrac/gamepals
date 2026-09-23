import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import type { BotTier } from '../../core/types';
import {
  dealCall,
  FREEZE_SECONDS,
  GRAB_TIERS,
  grabBotInput,
  isTargetUp,
  LOOK_ALIKE,
  newGrab,
  POINTS_TO_WIN_GRAB,
  showingPicture,
  stepGrab,
  TARGET_SECONDS,
  type GrabInput,
  type GrabState,
} from './index';

const none: GrabInput = { grab: false };
const grab: GrabInput = { grab: true };
/** Step until `until` says so, with no grabs. */
const wait = (state: GrabState, until: (s: GrabState) => boolean, limit = 120 * 30) => {
  let s = state;
  for (let i = 0; i < limit && !until(s); i++) s = stepGrab(s, [none, none]).state;
  return s;
};

describe('grab it', () => {
  it('every call ends with its target and never shows the target early', () => {
    for (let n = 0; n < 200; n++) {
      const call = dealCall(9, n);
      expect(call.flashes[call.flashes.length - 1]).toBe(call.target);
      expect(call.flashes.slice(0, -1)).not.toContain(call.target);
      expect(call.flashes.length).toBeGreaterThanOrEqual(3);
      expect(call.gaps[call.gaps.length - 1]).toBe(TARGET_SECONDS);
    }
    // About four in ten decoys of a picture with a look-alike are that look-alike.
    let alike = 0;
    let decoys = 0;
    for (let n = 0; n < 400; n++) {
      const call = dealCall(3, n);
      if (LOOK_ALIKE[call.target] === undefined) continue;
      for (const f of call.flashes.slice(0, -1)) {
        decoys++;
        if (f === LOOK_ALIKE[call.target]) alike++;
      }
    }
    expect(alike / decoys).toBeGreaterThan(0.3);
  });

  it('a grab on the called picture scores and starts a new call', () => {
    const up = wait(newGrab(1), isTargetUp);
    const { state, events } = stepGrab(up, [grab, none]);
    expect(events.point).toBe(0);
    expect(state.scores).toEqual([1, 0]);
    expect(state.phase).toBe('pause');
    const next = wait(state, (s) => s.phase === 'call');
    expect(next.calls).toBe(2);
  });

  it('a grab on a decoy loses a point, never below nought, and freezes the hand', () => {
    const decoy = wait(newGrab(1), (s) => s.phase === 'flashing' && !isTargetUp(s));
    const once = stepGrab({ ...decoy, scores: [2, 0] }, [grab, none]).state;
    expect(once.scores[0]).toBe(1);
    expect(Math.abs(once.frozen[0] - FREEZE_SECONDS)).toBeLessThan(1e-9);
    // Frozen, a grab at the target does nothing.
    const target = wait(once, isTargetUp);
    if (target.frozen[0] > 0) expect(stepGrab(target, [grab, none]).state.scores[0]).toBe(1);
    const zero = stepGrab({ ...decoy, scores: [0, 0] }, [grab, none]).state;
    expect(zero.scores[0]).toBe(0);
  });

  it('nobody grabbing in time gives up the call with no point', () => {
    const up = wait(newGrab(4), isTargetUp);
    const after = wait(up, (s) => s.phase === 'pause');
    expect(after.scores).toEqual([0, 0]);
    expect(after.lastWinner).toBeNull();
  });

  it('both grabbing in the same step goes to each seat in turn', () => {
    const winners: number[] = [];
    let s = newGrab(2);
    for (let call = 0; call < 4; call++) {
      s = wait(s, isTargetUp);
      const r = stepGrab(s, [grab, grab]);
      winners.push(r.events.point!);
      s = r.state;
    }
    expect(new Set(winners).size).toBe(2);
  });

  it('first to five wins', () => {
    let s = newGrab(5);
    while (!s.result) {
      s = wait(s, (x) => isTargetUp(x) || !!x.result);
      if (!s.result) s = stepGrab(s, [none, grab]).state;
    }
    expect(s.scores[1]).toBe(POINTS_TO_WIN_GRAB);
    expect(s.result).toEqual({ winners: [1], draw: false });
  });

  it('the same inputs always give the same round', () => {
    const play = () => {
      let s = newGrab(8);
      for (let i = 0; i < 120 * 20; i++) s = stepGrab(s, [{ grab: i % 97 === 0 }, { grab: i % 131 === 0 }]).state;
      return s;
    };
    expect(play()).toEqual(play());
  });

  it('Expert beats Easy', { timeout: 60_000 }, () => {
    const round = (tiers: [BotTier, BotTier], seed: number) => {
      const rng = createRng(seed);
      let s = newGrab(seed);
      let roll = [0.5, 0.5];
      let flash = -1;
      for (let i = 0; i < 120 * 300 && !s.result; i++) {
        if (s.flash !== flash) {
          flash = s.flash;
          roll = [rng.next(), rng.next()];
        }
        s = stepGrab(s, [grabBotInput(s, 0, GRAB_TIERS[tiers[0]], roll[0]), grabBotInput(s, 1, GRAB_TIERS[tiers[1]], roll[1])]).state;
      }
      return s.result;
    };
    let expert = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const seat = seed % 2;
      if (round(seat === 0 ? ['expert', 'easy'] : ['easy', 'expert'], seed)?.winners[0] === seat) expert++;
    }
    expect(expert).toBeGreaterThanOrEqual(7);
  });
});

/** Invariant: scores stay between nought and five, and the picture showing is always this call's flash. */
describe('grab it invariants', () => {
  it('keeps scores in range and the picture honest', { timeout: 60_000 }, () => {
    for (let seed = 0; seed < 5; seed++) {
      const rng = createRng(seed);
      let s = newGrab(seed);
      for (let i = 0; i < 120 * 120 && !s.result; i++) {
        s = stepGrab(s, [{ grab: rng.next() < 0.02 }, { grab: rng.next() < 0.02 }]).state;
        for (const score of s.scores) {
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(POINTS_TO_WIN_GRAB);
        }
        const shown = showingPicture(s);
        if (shown !== null) expect(shown).toBe(s.call.flashes[s.flash]);
      }
    }
  });
});

