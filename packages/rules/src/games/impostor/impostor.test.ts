import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { impostor, ImpostorState, newImpostor, WORD_SETS } from './index';

const through = (state: ImpostorState, moves: string[]) => moves.reduce((s, m) => s.apply(m), state);
const revealAll = (state: ImpostorState) => through(state, Array.from({ length: state.players }, () => 'seen'));

describe('impostor', () => {
  it('one impostor, everyone else sees the word and the set', () => {
    for (let seed = 0; seed < 30; seed++) {
      const s = newImpostor(seed, 5);
      const cards = Array.from({ length: 5 }, (_, seat) => s.cardFor(seat));
      expect(cards.filter((c) => c.impostor)).toHaveLength(1);
      for (const card of cards) {
        expect(card.set).toBe(s.setName);
        if (!card.impostor) expect(card.word).toBe(s.secret);
        else expect(card.word).toBeNull();
      }
    }
  });

  it('the reveal goes round every seat in order, then the talk', () => {
    let s = newImpostor(1, 4);
    for (let seat = 0; seat < 4; seat++) {
      expect(s.phase).toBe('reveal');
      expect(s.currentSeat).toBe(seat);
      expect(s.legalMoves(seat)).toEqual(['seen']);
      s = s.apply('seen');
    }
    expect(s.phase).toBe('talk');
    expect(s.apply('talked').phase).toBe('vote');
  });

  it('accusing someone else hands the impostor the win', () => {
    const s = through(revealAll(newImpostor(3, 4)), ['talked']);
    const innocent = (s.impostor + 1) % 4;
    const end = s.apply(`v${innocent}`);
    expect(end.result).toEqual({ winners: [s.impostor], draw: false });
  });

  it('a caught impostor guesses: right still wins, wrong loses', () => {
    const s = through(revealAll(newImpostor(7, 5)), ['talked']).apply(`v${newImpostor(7, 5).impostor}`);
    expect(s.phase).toBe('guess');
    expect(s.currentSeat).toBe(s.impostor);
    const right = s.choices.indexOf(s.word);
    expect(s.apply(`g${right}`).result).toEqual({ winners: [s.impostor], draw: false });
    const wrong = s.choices.findIndex((c) => c !== s.word);
    const lost = s.apply(`g${wrong}`).result!;
    expect(lost.winners).not.toContain(s.impostor);
    expect(lost.winners).toHaveLength(4);
  });

  it('the six choices include the word, all from its set, none twice', () => {
    for (let seed = 0; seed < 30; seed++) {
      const s = newImpostor(seed, 6);
      expect(s.choices).toContain(s.word);
      expect(new Set(s.choices).size).toBe(6);
      for (const c of s.choices) expect(WORD_SETS[s.set]!.words[c]).toBeDefined();
    }
  });

  it('refuses moves out of turn and out of phase', () => {
    const s = newImpostor(2, 3);
    expect(() => s.apply('talked')).toThrow();
    expect(() => s.apply('v0')).toThrow();
    expect(s.legalMoves(1)).toEqual([]);
  });

  it('the same seed deals the same game, and test play finishes it', () => {
    expect(newImpostor(11, 6)).toEqual(newImpostor(11, 6));
    const bot = impostor.createBot('medium');
    let s = newImpostor(11, 6) as ImpostorState;
    const rng = createRng(1);
    while (!s.result) s = s.apply(bot.chooseMove(s, s.currentSeat, rng)) as ImpostorState;
    expect(s.phase).toBe('over');
  });
});

/** Invariant: exactly one impostor, and only the seat whose turn it is can move. */
describe('impostor invariants', () => {
  it('keeps one impostor and one mover', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = createRng(seed);
      let s = newImpostor(seed, 3 + (seed % 6));
      while (!s.result) {
        const cards = Array.from({ length: s.players }, (_, seat) => s.cardFor(seat));
        expect(cards.filter((c) => c.impostor)).toHaveLength(1);
        for (let seat = 0; seat < s.players; seat++) if (seat !== s.currentSeat) expect(s.legalMoves(seat)).toEqual([]);
        s = s.apply(rng.pick(s.legalMoves(s.currentSeat)));
      }
    }
  });
});
