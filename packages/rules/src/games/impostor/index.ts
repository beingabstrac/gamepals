import { createRng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Impostor (docs/games/impostor.md): everyone but one sees the secret word. Pass the phone round to
 * see your card, talk, vote, and if the impostor is caught they get one guess at the word.
 */
export const WORD_SETS: readonly { readonly name: string; readonly words: readonly string[] }[] = [
  { name: 'Places', words: ['Beach', 'Zoo', 'School', 'Hospital', 'Airport', 'Library', 'Cinema', 'Farm', 'Castle', 'Museum'] },
  { name: 'Food', words: ['Pizza', 'Soup', 'Pancakes', 'Salad', 'Curry', 'Ice cream', 'Toast', 'Noodles', 'Burger', 'Popcorn'] },
  { name: 'Animals', words: ['Penguin', 'Giraffe', 'Octopus', 'Rabbit', 'Elephant', 'Owl', 'Shark', 'Kangaroo', 'Snail', 'Parrot'] },
  { name: 'Jobs', words: ['Doctor', 'Chef', 'Pilot', 'Teacher', 'Farmer', 'Firefighter', 'Painter', 'Dentist', 'Baker', 'Astronaut'] },
  { name: 'Sports', words: ['Football', 'Tennis', 'Swimming', 'Skiing', 'Boxing', 'Golf', 'Cricket', 'Cycling', 'Surfing', 'Bowling'] },
  { name: 'At home', words: ['Sofa', 'Fridge', 'Bath', 'Toaster', 'Lamp', 'Mirror', 'Pillow', 'Oven', 'Stairs', 'Curtains'] },
  { name: 'Weather', words: ['Rain', 'Snow', 'Rainbow', 'Thunder', 'Fog', 'Wind', 'Sunshine', 'Hail', 'Storm', 'Frost'] },
  { name: 'Things to wear', words: ['Hat', 'Scarf', 'Boots', 'Gloves', 'Pajamas', 'Raincoat', 'Socks', 'Sunglasses', 'Sweater', 'Slippers'] },
  { name: 'Travel', words: ['Train', 'Bicycle', 'Boat', 'Bus', 'Rocket', 'Taxi', 'Helicopter', 'Tractor', 'Scooter', 'Submarine'] },
  { name: 'Party', words: ['Balloon', 'Cake', 'Candle', 'Present', 'Music', 'Dancing', 'Games', 'Costume', 'Confetti', 'Invitation'] },
];

/** How many words the impostor chooses between when caught: the word and five from the same set. */
export const GUESS_CHOICES = 6;

export type ImpostorPhase = 'reveal' | 'talk' | 'vote' | 'guess' | 'over';

/** `seen` (done looking at your card), `talked` (time to vote), `v<seat>` (the table's accusation), `g<i>` (the impostor's guess). */
export type ImpostorMove = string;

export class ImpostorState implements GameState<ImpostorMove> {
  constructor(
    readonly players: number,
    readonly set: number,
    readonly word: number,
    readonly impostor: Seat,
    /** Who starts the talking round, from the seed, so it is never always the same person. */
    readonly starter: Seat,
    /** The words the impostor chooses between if caught, as indexes into the set, in shown order. */
    readonly choices: readonly number[],
    readonly phase: ImpostorPhase,
    /** Whose card is being shown in the reveal; the group's seat (0) at other times. */
    readonly turn: Seat,
    readonly accused: Seat | null,
    readonly guessed: number | null,
    readonly result: GameResult | null,
  ) {}

  get currentSeat(): Seat {
    if (this.phase === 'reveal') return this.turn;
    if (this.phase === 'guess') return this.impostor;
    return 0;
  }

  get secret(): string {
    return WORD_SETS[this.set]!.words[this.word]!;
  }

  get setName(): string {
    return WORD_SETS[this.set]!.name;
  }

  /** What `seat` sees on their card: the word, or that they are the impostor. */
  cardFor(seat: Seat): { impostor: boolean; set: string; word: string | null } {
    return { impostor: seat === this.impostor, set: this.setName, word: seat === this.impostor ? null : this.secret };
  }

  legalMoves(seat: Seat): readonly ImpostorMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    if (this.phase === 'reveal') return ['seen'];
    if (this.phase === 'talk') return ['talked'];
    if (this.phase === 'vote') return Array.from({ length: this.players }, (_, s) => `v${s}`);
    if (this.phase === 'guess') return this.choices.map((_, i) => `g${i}`);
    return [];
  }

  apply(move: ImpostorMove): ImpostorState {
    if (!this.legalMoves(this.currentSeat).includes(move)) throw new Error(`Illegal move: ${move}`);
    const next = (changes: Partial<{ phase: ImpostorPhase; turn: Seat; accused: Seat | null; guessed: number | null; result: GameResult | null }>) =>
      new ImpostorState(
        this.players,
        this.set,
        this.word,
        this.impostor,
        this.starter,
        this.choices,
        changes.phase ?? this.phase,
        changes.turn ?? this.turn,
        changes.accused !== undefined ? changes.accused : this.accused,
        changes.guessed !== undefined ? changes.guessed : this.guessed,
        changes.result !== undefined ? changes.result : this.result,
      );
    const everyoneElse = (): GameResult => ({ winners: Array.from({ length: this.players }, (_, s) => s).filter((s) => s !== this.impostor), draw: false });
    if (move === 'seen') return this.turn + 1 < this.players ? next({ turn: this.turn + 1 }) : next({ phase: 'talk', turn: 0 });
    if (move === 'talked') return next({ phase: 'vote' });
    if (move[0] === 'v') {
      const accused = Number(move.slice(1));
      // The wrong person accused: the impostor got away with it.
      if (accused !== this.impostor) return next({ phase: 'over', accused, result: { winners: [this.impostor], draw: false } });
      return next({ phase: 'guess', accused });
    }
    const guessed = this.choices[Number(move.slice(1))]!;
    // Caught, but a right guess at the word still wins it for the impostor.
    return next({ phase: 'over', guessed, result: guessed === this.word ? { winners: [this.impostor], draw: false } : everyoneElse() });
  }
}

export function newImpostor(seed: number, players: number): ImpostorState {
  const rng = createRng(seed);
  const set = rng.int(WORD_SETS.length);
  const words = WORD_SETS[set]!.words;
  const word = rng.int(words.length);
  const impostor = rng.int(players);
  const starter = rng.int(players);
  const others = words.map((_, i) => i).filter((i) => i !== word);
  for (let i = others.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [others[i], others[j]] = [others[j]!, others[i]!];
  }
  const choices = [word, ...others.slice(0, GUESS_CHOICES - 1)];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [choices[i], choices[j]] = [choices[j]!, choices[i]!];
  }
  return new ImpostorState(players, set, word, impostor, starter, choices, 'reveal', 0, null, null, null);
}

/**
 * There is no bot for a talking game. Autoplay (the test mode) plays it as a quiet table would: look,
 * move on, vote for someone, and guess the first word.
 */
function createImpostorBot(): Bot<ImpostorMove> {
  return {
    chooseMove(generic: GameState<ImpostorMove>): ImpostorMove {
      const state = generic as ImpostorState;
      return state.legalMoves(state.currentSeat)[state.phase === 'vote' ? state.starter % state.players : 0]!;
    },
  };
}

export const impostor: GameDefinition<ImpostorMove> = {
  id: 'impostor',
  name: 'Impostor',
  minPlayers: 3,
  maxPlayers: 8,
  modes: ['sameDevice'],
  hiddenInfo: true,
  realtime: false,
  newGame: (config, seed) => newImpostor(seed, Math.max(3, Math.min(8, config.players))),
  createBot: () => createImpostorBot(),
  encodeMove: (move) => move,
};
