import { createRng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Charades (docs/games/charades.md): one person holds the phone up to their forehead, the others act
 * out or describe the word on it, and the holder calls out their guesses. Got it or pass, as many as
 * they can in a minute, then the phone goes to the next person.
 */
export const CHARADE_WORDS: readonly string[] = [
  // Animals
  'Kangaroo', 'Penguin', 'Elephant', 'Snake', 'Monkey', 'Chicken', 'Crab', 'Frog', 'Giraffe', 'Octopus',
  'Dog', 'Cat', 'Horse', 'Owl', 'Shark', 'Bee', 'Butterfly', 'Duck', 'Lion', 'Gorilla',
  'Rabbit', 'Snail', 'Spider', 'Bat', 'Crocodile', 'Dolphin', 'Tortoise', 'Flamingo', 'Pig', 'Cow',
  // Things people do
  'Brushing teeth', 'Swimming', 'Juggling', 'Sneezing', 'Skipping', 'Yawning', 'Knitting', 'Fishing', 'Sleeping', 'Dancing',
  'Climbing', 'Ice skating', 'Riding a bike', 'Taking a photo', 'Washing dishes', 'Painting a wall', 'Blowing bubbles', 'Walking a dog', 'Baking a cake', 'Reading',
  'Laughing', 'Whistling', 'Tying shoes', 'Planting seeds', 'Making a snowman', 'Playing drums', 'Flying a kite', 'Hula hoop', 'Surfing', 'Rowing a boat',
  // Jobs
  'Doctor', 'Chef', 'Pilot', 'Teacher', 'Firefighter', 'Farmer', 'Dentist', 'Painter', 'Magician', 'Astronaut',
  'Waiter', 'Hairdresser', 'Builder', 'Police officer', 'Mail carrier', 'Clown', 'Pirate', 'Robot', 'Superhero', 'Ghost',
  'King', 'Queen', 'Wizard', 'Cowboy', 'Mermaid', 'Dragon', 'Zombie', 'Ninja', 'Detective', 'Referee',
  // Sports
  'Football', 'Tennis', 'Basketball', 'Golf', 'Boxing', 'Skiing', 'Bowling', 'Cricket', 'Karate', 'Archery',
  'Weightlifting', 'Diving', 'Running a race', 'Tug of war', 'Table tennis', 'Gymnastics', 'Horse riding', 'Skateboarding', 'Hockey', 'Volleyball',
  // Things
  'Umbrella', 'Toothbrush', 'Balloon', 'Scissors', 'Guitar', 'Piano', 'Telephone', 'Camera', 'Ladder', 'Hammer',
  'Kite', 'Rocket', 'Train', 'Helicopter', 'Bicycle', 'Washing machine', 'Vacuum cleaner', 'Alarm clock', 'Sandwich', 'Pizza',
  'Ice cream', 'Spaghetti', 'Popcorn', 'Banana', 'Candle', 'Hat', 'Glasses', 'Backpack', 'Snowball', 'Fireworks',
  // Feelings and places
  'Happy', 'Angry', 'Scared', 'Tired', 'Surprised', 'Cold', 'Hot', 'Hungry', 'Beach', 'Zoo',
  'Library', 'Cinema', 'Swimming pool', 'Birthday party', 'Wedding', 'Haunted house', 'Rollercoaster', 'Camping', 'Traffic jam', 'Thunderstorm',
];

/** How long each person's go lasts. The clock is the scene's; it plays `end` when it runs out. */
export const CHARADE_SECONDS = 60;

export type CharadesPhase = 'ready' | 'playing' | 'over';

/** `start` (the holder is ready), `got` and `pass` (this word), `end` (the minute is up). */
export type CharadesMove = 'start' | 'got' | 'pass' | 'end';

export class CharadesState implements GameState<CharadesMove> {
  constructor(
    readonly players: number,
    /** How many goes each person gets. */
    readonly goes: number,
    /** Every word in the order this game deals them. */
    readonly deck: readonly number[],
    /** How far through the deck we are. */
    readonly dealt: number,
    /** Which go this is, counting from 0; the holder is `go % players`. */
    readonly go: number,
    readonly phase: CharadesPhase,
    readonly scores: readonly number[],
    /** The words of the current go: got (true) or passed (false), in order. */
    readonly thisGo: readonly boolean[],
    readonly result: GameResult | null,
  ) {}

  get currentSeat(): Seat {
    return this.go % this.players;
  }

  /** The word on the forehead right now. */
  get word(): string {
    return CHARADE_WORDS[this.deck[this.dealt % this.deck.length]!]!;
  }

  legalMoves(seat: Seat): readonly CharadesMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    return this.phase === 'ready' ? ['start'] : ['got', 'pass', 'end'];
  }

  apply(move: CharadesMove): CharadesState {
    if (!this.legalMoves(this.currentSeat).includes(move)) throw new Error(`Illegal move: ${move}`);
    const make = (dealt: number, go: number, phase: CharadesPhase, scores: readonly number[], thisGo: readonly boolean[], result: GameResult | null) =>
      new CharadesState(this.players, this.goes, this.deck, dealt, go, phase, scores, thisGo, result);
    if (move === 'start') return make(this.dealt, this.go, 'playing', this.scores, [], null);
    if (move === 'got' || move === 'pass') {
      const scores = move === 'got' ? this.scores.map((s, seat) => (seat === this.currentSeat ? s + 1 : s)) : this.scores;
      return make(this.dealt + 1, this.go, 'playing', scores, [...this.thisGo, move === 'got'], null);
    }
    // The minute is up. The word on show when it ran out is not counted and not reused.
    const go = this.go + 1;
    if (go < this.players * this.goes) return make(this.dealt + 1, go, 'ready', this.scores, this.thisGo, null);
    return make(this.dealt + 1, go - 1, 'over', this.scores, this.thisGo, charadesOutcome(this.scores));
  }
}

export function charadesOutcome(scores: readonly number[]): GameResult {
  const best = Math.max(...scores);
  const winners = scores.map((s, seat) => (s === best ? seat : -1)).filter((seat) => seat >= 0);
  return winners.length === scores.length ? { winners: [], draw: true } : { winners, draw: false };
}

export function newCharades(seed: number, players: number, goes = 1): CharadesState {
  const rng = createRng(seed);
  const deck = CHARADE_WORDS.map((_, i) => i);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return new CharadesState(players, goes, deck, 0, 0, 'ready', Array<number>(players).fill(0), [], null);
}

/** There is no bot for acting. Autoplay plays a steady table: two got, one passed, six words a go. */
function createCharadesBot(): Bot<CharadesMove> {
  return {
    chooseMove(generic: GameState<CharadesMove>): CharadesMove {
      const state = generic as CharadesState;
      if (state.phase === 'ready') return 'start';
      if (state.thisGo.length >= 6) return 'end';
      return state.thisGo.length % 3 === 2 ? 'pass' : 'got';
    },
  };
}

export const CHARADES_GOES: Readonly<Record<string, number>> = { one: 1, two: 2 };

export const charades: GameDefinition<CharadesMove> = {
  id: 'charades',
  name: 'Charades',
  minPlayers: 2,
  maxPlayers: 8,
  modes: ['sameDevice'],
  hiddenInfo: true,
  realtime: false,
  newGame: (config, seed) => newCharades(seed, Math.max(2, Math.min(8, config.players)), CHARADES_GOES[config.variant ?? 'one'] ?? 1),
  createBot: () => createCharadesBot(),
  encodeMove: (move) => move,
};
