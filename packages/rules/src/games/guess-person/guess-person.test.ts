import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { choosePersonMove, FACE_QUESTIONS, FACES, guessPerson, newGuessPerson, PERSON_TIERS, PersonState } from './index';

const withSecrets = (a: number, b: number) => new PersonState([a, b], [[], []], 0, null, null);

describe('guess the person', () => {
  it('every face differs from every other in something you can ask', () => {
    for (let a = 0; a < FACES.length; a++) {
      for (let b = a + 1; b < FACES.length; b++) {
        expect(FACE_QUESTIONS.some((q) => q.test(FACES[a]!) !== q.test(FACES[b]!)), `${FACES[a]!.name} and ${FACES[b]!.name}`).toBe(true);
      }
    }
  });

  it('a question is answered truthfully about the other face, and the turn passes', () => {
    const hat = FACE_QUESTIONS.findIndex((q) => q.text === 'Wearing a hat?');
    const ben = FACES.findIndex((f) => f.name === 'Ben');
    const s = withSecrets(0, ben).apply(`q${hat}`);
    expect(s.last).toEqual({ seat: 0, kind: 'ask', question: hat, answer: true });
    expect(s.currentSeat).toBe(1);
    expect(s.standing(0).every((i) => FACES[i]!.hat)).toBe(true);
    expect(s.standing(1)).toHaveLength(FACES.length);
  });

  it('the same question cannot be asked twice by the same player', () => {
    const s = withSecrets(3, 4).apply('q0').apply('q1');
    expect(s.legalMoves(0)).not.toContain('q0');
    expect(() => s.apply('q0')).toThrow();
    expect(s.legalMoves(1)).toEqual([]);
  });

  it('naming the right face wins, the wrong one loses', () => {
    expect(withSecrets(0, 5).apply('n5').result).toEqual({ winners: [0], draw: false });
    expect(withSecrets(0, 5).apply('n6').result).toEqual({ winners: [1], draw: false });
  });

  it('the secret face is always still standing', () => {
    for (let seed = 0; seed < 40; seed++) {
      const rng = createRng(seed);
      let s = newGuessPerson(seed);
      while (!s.result) {
        for (const seat of [0, 1] as const) expect(s.standing(seat)).toContain(s.secrets[seat === 0 ? 1 : 0]);
        const questions = s.legalMoves(s.currentSeat).filter((m) => m[0] === 'q');
        if (!questions.length) break;
        s = s.apply(rng.pick(questions));
      }
    }
  });

  it('bots never name a face their answers have ruled out, and always finish', () => {
    for (let seed = 0; seed < 40; seed++) {
      for (const tier of ['easy', 'expert'] as const) {
        const rng = createRng(seed);
        let s = newGuessPerson(seed);
        let turns = 0;
        while (!s.result) {
          const move = choosePersonMove(s, s.currentSeat, PERSON_TIERS[tier], rng);
          if (move[0] === 'n') expect(s.standing(s.currentSeat)).toContain(Number(move.slice(1)));
          s = s.apply(move);
          turns++;
        }
        expect(turns).toBeLessThan(40);
      }
    }
  });

  it('the sharper bot wins more', { timeout: 60_000 }, () => {
    let hard = 0;
    for (let seed = 0; seed < 300; seed++) {
      const rng = createRng(seed);
      const hardSeat = seed % 2;
      let s = newGuessPerson(seed);
      while (!s.result) s = s.apply(choosePersonMove(s, s.currentSeat, PERSON_TIERS[s.currentSeat === hardSeat ? 'hard' : 'easy'], rng));
      if (s.result.winners[0] === hardSeat) hard++;
    }
    expect(hard).toBeGreaterThan(165);
  });

  it('the same seed deals the same faces', () => {
    expect(newGuessPerson(7)).toEqual(newGuessPerson(7));
    expect(guessPerson.newGame({ players: 2 }, 7)).toEqual(newGuessPerson(7));
  });
});
