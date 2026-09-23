import { createRng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Draw & Guess (docs/games/draw-guess.md): one person sees a word and draws it while the table
 * shouts guesses. Whoever calls it first and the one drawing both score. The drawing itself is the
 * scene's; the rules deal the words, say who draws, and keep the score.
 */
export const DRAW_WORDS: readonly string[] = [
  'Sun', 'Moon', 'Star', 'Cloud', 'Rainbow', 'Tree', 'Flower', 'Leaf', 'Mountain', 'Volcano',
  'House', 'Castle', 'Bridge', 'Tent', 'Lighthouse', 'Igloo', 'Windmill', 'Fence', 'Door', 'Window',
  'Cat', 'Dog', 'Fish', 'Bird', 'Snail', 'Spider', 'Snake', 'Turtle', 'Whale', 'Octopus',
  'Rabbit', 'Mouse', 'Pig', 'Elephant', 'Giraffe', 'Penguin', 'Owl', 'Butterfly', 'Bee', 'Crab',
  'Car', 'Bus', 'Boat', 'Train', 'Plane', 'Rocket', 'Bicycle', 'Tractor', 'Helicopter', 'Submarine',
  'Apple', 'Banana', 'Cherry', 'Carrot', 'Pizza', 'Cake', 'Ice cream', 'Egg', 'Cheese', 'Sandwich',
  'Cup', 'Spoon', 'Teapot', 'Clock', 'Lamp', 'Chair', 'Bed', 'Key', 'Book', 'Scissors',
  'Hat', 'Shoe', 'Sock', 'Glasses', 'Crown', 'Umbrella', 'Balloon', 'Kite', 'Ball', 'Drum',
  'Guitar', 'Bell', 'Candle', 'Gift', 'Heart', 'Anchor', 'Arrow', 'Ladder', 'Hammer', 'Magnet',
  'Robot', 'Ghost', 'Dragon', 'Snowman', 'Pirate ship', 'Treasure', 'Mermaid', 'Alien', 'Wizard hat', 'Skeleton',
  'Beach', 'Island', 'Waterfall', 'Desert', 'Campfire', 'Swing', 'Slide', 'Sandcastle', 'Fireworks', 'Tornado',
  'Eye', 'Hand', 'Nose', 'Tooth', 'Ear', 'Foot', 'Smile', 'Beard', 'Brain', 'Skull',
  'Phone', 'Camera', 'Television', 'Computer', 'Light bulb', 'Battery', 'Envelope', 'Map', 'Flag', 'Trophy',
  'Spider web', 'Mushroom', 'Cactus', 'Palm tree', 'Pumpkin', 'Snowflake', 'Lightning', 'Worm', 'Feather', 'Shell',
];

/** How long each drawing lasts. The clock is the scene's; it plays `end` when time is up. */
export const DRAW_SECONDS = 80;

export type DrawPhase = 'ready' | 'drawing' | 'over';

/** `seen` (the drawer has seen the word), `g<seat>` (that seat guessed it), `end` (time up, nobody got it). */
export type DrawMove = string;

export class DrawState implements GameState<DrawMove> {
  constructor(
    readonly players: number,
    readonly goes: number,
    readonly deck: readonly number[],
    /** Which drawing this is, from 0; the drawer is `turn % players`. */
    readonly turn: number,
    readonly phase: DrawPhase,
    readonly scores: readonly number[],
    /** Who guessed the last drawing, or null if time ran out; null before the first. */
    readonly lastGuesser: Seat | null,
    readonly result: GameResult | null,
  ) {}

  get currentSeat(): Seat {
    return this.turn % this.players;
  }

  get word(): string {
    return DRAW_WORDS[this.deck[this.turn % this.deck.length]!]!;
  }

  /** The word of the drawing before this one, for the cover to say what it was. */
  get lastWord(): string | null {
    return this.turn === 0 ? null : DRAW_WORDS[this.deck[(this.turn - 1) % this.deck.length]!]!;
  }

  legalMoves(seat: Seat): readonly DrawMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    if (this.phase === 'ready') return ['seen'];
    const guessers = Array.from({ length: this.players }, (_, s) => s).filter((s) => s !== this.currentSeat);
    return [...guessers.map((s) => `g${s}`), 'end'];
  }

  apply(move: DrawMove): DrawState {
    if (!this.legalMoves(this.currentSeat).includes(move)) throw new Error(`Illegal move: ${move}`);
    if (move === 'seen') return new DrawState(this.players, this.goes, this.deck, this.turn, 'drawing', this.scores, this.lastGuesser, null);
    const guesser = move === 'end' ? null : Number(move.slice(1));
    const drawer = this.currentSeat;
    // A drawing someone got scores both: the guesser for calling it, the drawer for drawing it well.
    const scores = guesser === null ? this.scores : this.scores.map((s, seat) => (seat === guesser || seat === drawer ? s + 1 : s));
    const turn = this.turn + 1;
    if (turn < this.players * this.goes) return new DrawState(this.players, this.goes, this.deck, turn, 'ready', scores, guesser, null);
    return new DrawState(this.players, this.goes, this.deck, turn - 1, 'over', scores, guesser, drawOutcome(scores));
  }
}

export function drawOutcome(scores: readonly number[]): GameResult {
  const best = Math.max(...scores);
  const winners = scores.map((s, seat) => (s === best ? seat : -1)).filter((seat) => seat >= 0);
  return winners.length === scores.length ? { winners: [], draw: true } : { winners, draw: false };
}

export function newDrawGuess(seed: number, players: number, goes = 1): DrawState {
  const rng = createRng(seed);
  const deck = DRAW_WORDS.map((_, i) => i);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return new DrawState(players, goes, deck, 0, 'ready', Array<number>(players).fill(0), null, null);
}

/** No bot can draw. Autoplay plays a table where the next person round gets it, and one in three is missed. */
function createDrawBot(): Bot<DrawMove> {
  return {
    chooseMove(generic: GameState<DrawMove>): DrawMove {
      const state = generic as DrawState;
      if (state.phase === 'ready') return 'seen';
      return state.turn % 3 === 2 ? 'end' : `g${(state.currentSeat + 1) % state.players}`;
    },
  };
}

export const DRAW_GOES: Readonly<Record<string, number>> = { one: 1, two: 2 };

export const drawGuess: GameDefinition<DrawMove> = {
  id: 'draw-guess',
  name: 'Draw & Guess',
  minPlayers: 3,
  maxPlayers: 8,
  modes: ['sameDevice'],
  hiddenInfo: true,
  realtime: false,
  newGame: (config, seed) => newDrawGuess(seed, Math.max(3, Math.min(8, config.players)), DRAW_GOES[config.variant ?? 'one'] ?? 1),
  createBot: () => createDrawBot(),
  encodeMove: (move) => move,
};
