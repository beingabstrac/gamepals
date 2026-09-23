import { createRng, type Rng } from '../../core/rng';
import type { Bot, BotTier, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Guess the Person (docs/games/guess-person.md): each player has a secret face from the same 24.
 * Take turns asking yes or no questions about the other's face; the phone answers truthfully and the
 * faces that no longer fit tip over. Name the face when you know it. A wrong name loses.
 */
export type FaceHair = 'black' | 'brown' | 'ginger' | 'blonde' | 'grey' | 'bald';

export interface GuessFace {
  readonly name: string;
  readonly hair: FaceHair;
  readonly long: boolean;
  readonly hat: boolean;
  readonly glasses: boolean;
  readonly beard: boolean;
  readonly earrings: boolean;
  readonly smile: boolean;
  /** Which of four skin tones the picture uses. Never asked about. */
  readonly skin: number;
}

const P = (name: string, hair: FaceHair, long: number, hat: number, glasses: number, beard: number, earrings: number, smile: number, skin: number): GuessFace => ({
  name,
  hair,
  long: long === 1,
  hat: hat === 1,
  glasses: glasses === 1,
  beard: beard === 1,
  earrings: earrings === 1,
  smile: smile === 1,
  skin,
});

/** The same 24 every game, like the board in the box. Every one differs from every other in something asked. */
export const FACES: readonly GuessFace[] = [
  P('Ana', 'black', 1, 0, 0, 0, 1, 1, 2),
  P('Ben', 'brown', 0, 1, 0, 1, 0, 0, 0),
  P('Cleo', 'ginger', 1, 0, 1, 0, 0, 1, 0),
  P('Dev', 'black', 0, 0, 1, 1, 0, 0, 3),
  P('Eva', 'blonde', 1, 1, 0, 0, 1, 0, 1),
  P('Finn', 'ginger', 0, 0, 0, 0, 0, 1, 0),
  P('Gus', 'grey', 0, 1, 1, 1, 0, 1, 1),
  P('Hana', 'black', 1, 0, 0, 0, 0, 0, 1),
  P('Ivo', 'bald', 0, 0, 1, 0, 1, 1, 2),
  P('Jo', 'brown', 1, 0, 1, 0, 1, 0, 3),
  P('Kai', 'blonde', 0, 0, 0, 1, 0, 1, 0),
  P('Lola', 'brown', 1, 1, 0, 0, 0, 1, 2),
  P('Mo', 'black', 0, 1, 0, 0, 0, 1, 3),
  P('Nia', 'grey', 1, 0, 1, 0, 1, 1, 3),
  P('Omar', 'bald', 0, 1, 0, 1, 0, 0, 2),
  P('Pia', 'blonde', 0, 0, 1, 0, 0, 0, 1),
  P('Quin', 'ginger', 0, 1, 0, 1, 1, 0, 1),
  P('Rosa', 'grey', 1, 1, 0, 0, 0, 0, 0),
  P('Sol', 'brown', 0, 0, 0, 0, 1, 1, 1),
  P('Tia', 'ginger', 1, 0, 0, 0, 1, 0, 2),
  P('Uma', 'blonde', 1, 0, 0, 0, 0, 1, 3),
  P('Vic', 'bald', 0, 0, 0, 0, 0, 0, 0),
  P('Wes', 'brown', 0, 0, 1, 1, 0, 1, 2),
  P('Zara', 'black', 1, 1, 1, 0, 1, 1, 0),
];

export interface FaceQuestion {
  readonly text: string;
  readonly test: (person: GuessFace) => boolean;
}

export const FACE_QUESTIONS: readonly FaceQuestion[] = [
  { text: 'Wearing a hat?', test: (p) => p.hat },
  { text: 'Wearing glasses?', test: (p) => p.glasses },
  { text: 'Got a beard?', test: (p) => p.beard },
  { text: 'Wearing earrings?', test: (p) => p.earrings },
  { text: 'Long hair?', test: (p) => p.long },
  { text: 'Big smile?', test: (p) => p.smile },
  { text: 'Bald?', test: (p) => p.hair === 'bald' },
  { text: 'Black hair?', test: (p) => p.hair === 'black' },
  { text: 'Brown hair?', test: (p) => p.hair === 'brown' },
  { text: 'Ginger hair?', test: (p) => p.hair === 'ginger' },
  { text: 'Blonde hair?', test: (p) => p.hair === 'blonde' },
  { text: 'Grey hair?', test: (p) => p.hair === 'grey' },
];

export interface FaceAnswer {
  readonly question: number;
  readonly answer: boolean;
}

/** `q<i>` asks question i about the other player's face; `n<i>` names face i as theirs. */
export type PersonMove = string;

export class PersonState implements GameState<PersonMove> {
  constructor(
    /** Each seat's secret face. */
    readonly secrets: readonly [number, number],
    /** What each seat has asked about the other's face, and the answers. */
    readonly asked: readonly [readonly FaceAnswer[], readonly FaceAnswer[]],
    readonly currentSeat: Seat,
    /** The last thing that happened, for the scene to show. */
    readonly last: { seat: Seat; kind: 'ask'; question: number; answer: boolean } | { seat: Seat; kind: 'name'; face: number; right: boolean } | null,
    readonly result: GameResult | null,
  ) {}

  /** The faces `seat` still has standing: the ones that fit every answer they have had. */
  standing(seat: Seat): number[] {
    const asked = this.asked[seat]!;
    return FACES.map((_, i) => i).filter((i) => asked.every((a) => FACE_QUESTIONS[a.question]!.test(FACES[i]!) === a.answer));
  }

  legalMoves(seat: Seat): readonly PersonMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    const done = new Set(this.asked[seat]!.map((a) => a.question));
    const questions = FACE_QUESTIONS.map((_, i) => i).filter((i) => !done.has(i)).map((i) => `q${i}`);
    // Any face can be named, even one tipped over: the rules never stop a person making a mistake.
    return [...questions, ...FACES.map((_, i) => `n${i}`)];
  }

  apply(move: PersonMove): PersonState {
    if (!this.legalMoves(this.currentSeat).includes(move)) throw new Error(`Illegal move: ${move}`);
    const seat = this.currentSeat;
    const other: Seat = seat === 0 ? 1 : 0;
    const index = Number(move.slice(1));
    if (move[0] === 'q') {
      const answer = FACE_QUESTIONS[index]!.test(FACES[this.secrets[other]]!);
      const mine = [...this.asked[seat]!, { question: index, answer }];
      const asked = (seat === 0 ? [mine, this.asked[1]] : [this.asked[0], mine]) as [FaceAnswer[], FaceAnswer[]];
      return new PersonState(this.secrets, asked, other, { seat, kind: 'ask', question: index, answer }, null);
    }
    const right = index === this.secrets[other];
    return new PersonState(this.secrets, this.asked, seat, { seat, kind: 'name', face: index, right }, { winners: [right ? seat : other], draw: false });
  }
}

export function newGuessPerson(seed: number): PersonState {
  const rng = createRng(seed);
  const a = rng.int(FACES.length);
  const b = rng.int(FACES.length);
  return new PersonState([a, b], [[], []], 0, null, null);
}

/** How evenly a question splits the faces still standing: 0 is a perfect half, 1 tells you nothing. */
export function faceSplit(standing: readonly number[], question: number): number {
  const yes = standing.filter((i) => FACE_QUESTIONS[question]!.test(FACES[i]!)).length;
  return Math.abs(yes * 2 - standing.length) / Math.max(1, standing.length);
}

export interface PersonTier {
  /** Chance of asking the best split rather than any question left. */
  readonly sharp: number;
  /** Names a face once this few are standing (1 means only when sure). */
  readonly nameAt: number;
}

export const PERSON_TIERS: Record<BotTier, PersonTier> = {
  easy: { sharp: 0.15, nameAt: 1 },
  medium: { sharp: 0.5, nameAt: 1 },
  hard: { sharp: 0.85, nameAt: 1 },
  expert: { sharp: 1, nameAt: 2 },
};

/** Bots only know what the answers told them, the same as a person. They never look at the secret. */
export function choosePersonMove(state: PersonState, seat: Seat, tier: PersonTier, rng: Rng): PersonMove {
  const standing = state.standing(seat);
  const other: Seat = seat === 0 ? 1 : 0;
  const theirs = state.standing(other).length;
  // Sure: name it. Expert also takes a coin flip on two when the other player is about to get theirs.
  if (standing.length === 1) return `n${standing[0]}`;
  if (standing.length <= tier.nameAt && theirs <= 2) return `n${rng.pick(standing)}`;
  const done = new Set(state.asked[seat]!.map((a) => a.question));
  // Questions that tell you something: some faces standing say yes and some say no.
  const useful = FACE_QUESTIONS.map((_, i) => i).filter((i) => !done.has(i) && faceSplit(standing, i) < 1);
  if (!useful.length) return `n${rng.pick(standing)}`;
  if (rng.next() < tier.sharp) {
    const best = Math.min(...useful.map((i) => faceSplit(standing, i)));
    return `q${rng.pick(useful.filter((i) => faceSplit(standing, i) === best))}`;
  }
  return `q${rng.pick(useful)}`;
}

export const guessPerson: GameDefinition<PersonMove> = {
  id: 'guess-person',
  name: 'Guess the Person',
  minPlayers: 2,
  maxPlayers: 2,
  modes: ['bot', 'sameDevice', 'onlineLive', 'async'],
  hiddenInfo: true,
  realtime: false,
  newGame: (_config, seed) => newGuessPerson(seed),
  createBot: (tier) => ({
    chooseMove: (state, seat, rng) => choosePersonMove(state as PersonState, seat, PERSON_TIERS[tier], rng),
  }) as Bot<PersonMove>,
  encodeMove: (move) => move,
};
