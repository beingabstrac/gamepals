import { createRng, type Rng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Truth or Dare (docs/games/truth-or-dare.md), the family-safe kind: each go, pick a truth to answer
 * or a dare to do. Every card is our own, safe indoors, and kind: nothing risky, nothing unkind,
 * nothing that asks for anyone's details. Do it for a point, or pass for none.
 */
export const TRUTHS: readonly string[] = [
  'What is the silliest thing you have ever been scared of?',
  'What food could you eat every day and never get bored of?',
  'What is the funniest dream you remember?',
  'If you could be any animal for a day, which would you be?',
  'What is the best present you have ever been given?',
  'What song do you sing when nobody is listening?',
  'What is the most embarrassing thing that happened to you at school? (Keep it kind!)',
  'Who in this room would you want with you on a desert island?',
  'What is one thing you are really proud of?',
  'If you had a superpower, what would you use it for first?',
  'What is the strangest food you have ever tried?',
  'What was your favorite toy when you were little?',
  'What is something you are secretly good at?',
  'If you could meet anyone from history, who would it be?',
  'What is the best joke you know?',
  'What is your favorite smell?',
  'Have you ever pretended to be sick to stay home?',
  'What is the longest you have gone without brushing your teeth?',
  'What would your dream day out be?',
  'What job would you be terrible at?',
  'What is the worst haircut you have ever had?',
  'What is one thing you would change about your bedroom?',
  'Which cartoon character are you most like?',
  'What is the nicest thing someone has done for you?',
  'What makes you laugh every time?',
  'If you could live anywhere in the world, where would it be?',
  'What is a word you always spell wrong?',
  'What is your earliest memory?',
  'What is the bravest thing you have ever done?',
  'If your pet could talk, what would it say about you?',
  'What is the weirdest thing you believed when you were small?',
  'What would you name a pet dragon?',
  'What is your favorite thing about the person on your left?',
  'What is a rule you would make if you were in charge for a day?',
  'Have you ever laughed so hard that juice came out of your nose?',
  'What is the messiest you have ever been?',
  'What would your superhero name be?',
  'What is the best thing you have ever made or built?',
  'What game are you secretly a sore loser at?',
  'What would you do with a whole day on your own?',
];

export const DARES: readonly string[] = [
  'Talk like a pirate until your next go.',
  'Do your best robot dance for ten seconds.',
  'Say the alphabet backwards as far as you can.',
  'Pretend to be a chicken laying an egg.',
  'Sing "Happy Birthday" in an opera voice.',
  'Do five jumping jacks, counting in a silly voice.',
  'Make the funniest face you can and hold it for five seconds.',
  'Talk without closing your mouth until your next go.',
  'Pretend to be a tiny mouse who has found a giant cheese.',
  'Walk like a penguin across the room and back.',
  'Tell a joke in a whisper.',
  'Give the person on your right a compliment, then bow.',
  'Pretend to be a news reader telling everyone what is for dinner.',
  'Hop on one foot while saying your name three times.',
  'Balance a book on your head for ten seconds.',
  'Act out a sport without talking until someone guesses it.',
  'Make an animal noise and let everyone guess the animal.',
  'Do your best impression of someone famous (be kind!).',
  'Say a tongue twister three times fast: red leather, yellow leather.',
  'Pretend to be a statue until someone makes you laugh.',
  'Draw a cat with your eyes closed.',
  'Sing your answer to the next question anyone asks you.',
  'Make up a short poem about the room you are in.',
  'Pretend to be a waiter and take everyone\'s order.',
  'Do a slow-motion replay of scoring a goal.',
  'Speak in rhyme until your next go.',
  'Pretend you are a cat for thirty seconds.',
  'Tell everyone your favorite thing about each of them.',
  'Try to lick your elbow.',
  'Hum a song and let everyone guess it.',
  'Do your best evil laugh.',
  'Pretend to be a tour guide showing everyone the room.',
  'Wiggle your ears, or try to.',
  'Make up a new dance move and teach it to the room.',
  'Say "banana" in five different voices.',
  'Pretend to row a boat across a stormy sea.',
  'Name ten fruits in fifteen seconds.',
  'Walk backwards to the door and back.',
  'Pull the funniest face you can for a photo in your head.',
  'Give a thirty second speech about why socks are important.',
];

export const TOD_GOES = 3;

/** `truth` or `dare` to draw a card; `done` or `pass` once it is answered. */
export type TodMove = 'truth' | 'dare' | 'done' | 'pass';

export class TodState implements GameState<TodMove> {
  constructor(
    readonly players: number,
    readonly seed: number,
    /** Which go this is; the player is `go % players`. */
    readonly go: number,
    readonly phase: 'choose' | 'card' | 'over',
    /** The card showing, as [kind, index]. */
    readonly card: readonly ['truth' | 'dare', number] | null,
    readonly drawn: readonly number[],
    readonly scores: readonly number[],
    readonly result: GameResult | null,
  ) {}

  get currentSeat(): Seat {
    return this.go % this.players;
  }

  get text(): string | null {
    if (!this.card) return null;
    return this.card[0] === 'truth' ? TRUTHS[this.card[1]]! : DARES[this.card[1]]!;
  }

  legalMoves(seat: Seat): readonly TodMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    return this.phase === 'choose' ? ['truth', 'dare'] : ['done', 'pass'];
  }

  apply(move: TodMove): TodState {
    if (!this.legalMoves(this.currentSeat).includes(move)) throw new Error(`Illegal move: ${move}`);
    if (move === 'truth' || move === 'dare') {
      const card = drawCard(this.seed, this.drawn, move);
      return new TodState(this.players, this.seed, this.go, 'card', card, [...this.drawn, (move === 'truth' ? 0 : 1000) + card[1]], this.scores, null);
    }
    const scores = move === 'done' ? this.scores.map((s, seat) => (seat === this.currentSeat ? s + 1 : s)) : this.scores;
    const go = this.go + 1;
    if (go >= this.players * TOD_GOES) {
      const best = Math.max(...scores);
      const winners = scores.flatMap((s, seat) => (s === best ? [seat] : []));
      const result: GameResult = winners.length === this.players ? { winners: [], draw: true } : { winners, draw: false };
      return new TodState(this.players, this.seed, this.go, 'over', this.card, this.drawn, scores, result);
    }
    return new TodState(this.players, this.seed, go, 'choose', null, this.drawn, scores, null);
  }
}

/** The next card of a kind this game has not shown yet, from the seed. */
function drawCard(seed: number, drawn: readonly number[], kind: 'truth' | 'dare'): ['truth' | 'dare', number] {
  const list = kind === 'truth' ? TRUTHS : DARES;
  const base = kind === 'truth' ? 0 : 1000;
  const rng = createRng((seed ^ Math.imul(drawn.length + 1, 0x2545f491)) >>> 0);
  const left = list.map((_, i) => i).filter((i) => !drawn.includes(base + i));
  return [kind, left.length ? rng.pick(left) : rng.int(list.length)];
}

export function newTruthOrDare(seed: number, players: number): TodState {
  return new TodState(players, seed >>> 0, 0, 'choose', null, [], Array<number>(players).fill(0), null);
}

/** Test play: alternate truth and dare, do most, pass the odd one. */
function createTodBot(): Bot<TodMove> {
  return {
    chooseMove(generic: GameState<TodMove>, _seat: Seat, _rng: Rng): TodMove {
      const s = generic as TodState;
      if (s.phase === 'choose') return s.go % 2 ? 'dare' : 'truth';
      return s.go % 5 === 4 ? 'pass' : 'done';
    },
  };
}

export const truthOrDare: GameDefinition<TodMove> = {
  id: 'truth-or-dare',
  name: 'Truth or Dare',
  minPlayers: 2,
  maxPlayers: 8,
  modes: ['sameDevice'],
  hiddenInfo: false,
  realtime: false,
  newGame: (config, seed) => newTruthOrDare(seed, Math.max(2, Math.min(8, config.players))),
  createBot: () => createTodBot(),
  encodeMove: (move) => move,
};
