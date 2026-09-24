import { createRng, type Rng } from '../../core/rng';
import type { Bot, GameDefinition, GameResult, GameState, Seat } from '../../core/types';

/**
 * Would You Rather (docs/games/would-you-rather.md): pass the phone round. Everyone picks one of
 * two in secret, then the split is shown. Side with most of the table and you score; after ten
 * questions, whoever was most often with the crowd wins. All our own questions, all family-safe.
 */
export const RATHER: readonly (readonly [string, string])[] = [
  ['be able to fly', 'be able to breathe underwater'],
  ['have a pet dragon', 'have a pet unicorn'],
  ['eat only pizza for a week', 'eat only ice cream for a week'],
  ['live in a treehouse', 'live on a boat'],
  ['talk to animals', 'speak every language'],
  ['be really tall', 'be really small'],
  ['never have homework again', 'never do chores again'],
  ['have a robot friend', 'have a ghost friend'],
  ['go to the moon', 'go to the bottom of the sea'],
  ['always be a little too hot', 'always be a little too cold'],
  ['have a slide instead of stairs', 'have a trampoline for a floor'],
  ['be the funniest person in the room', 'be the cleverest person in the room'],
  ['have hair that changes color with your mood', 'have eyes that glow in the dark'],
  ['only whisper', 'only shout'],
  ['meet a real dinosaur', 'meet a real alien'],
  ['have a magic carpet', 'have a time machine'],
  ['eat a bowl of worms made of jelly', 'drink a glass of green soup'],
  ['be a famous singer', 'be a famous soccer player'],
  ['have a tail', 'have wings that cannot fly'],
  ['live where it always snows', 'live where it is always summer'],
  ['be invisible', 'read minds'],
  ['have ten brothers and sisters', 'be an only child'],
  ['go on a rollercoaster', 'go on a hot air balloon'],
  ['have fingers as long as your legs', 'have legs as long as your fingers'],
  ['be able to run as fast as a cheetah', 'be able to jump as high as a house'],
  ['always know when someone is fibbing', 'always be believed'],
  ['sleep in a castle', 'sleep in a space station'],
  ['have breakfast for dinner every day', 'have dinner for breakfast every day'],
  ['be a pirate', 'be a wizard'],
  ['have a pocket that never runs out of candy', 'have a pocket that never runs out of coins'],
  ['swim with dolphins', 'ride an elephant'],
  ['only be able to hop', 'only be able to skip'],
  ['have a giant garden', 'have a giant playroom'],
  ['be a superhero with a silly power', 'be an ordinary person with a great car'],
  ['be stuck in an elevator with a clown', 'be stuck in an elevator with a mime'],
  ['have your own zoo', 'have your own candy store'],
  ['be able to stop time', 'be able to rewind time'],
  ['sing everything you say', 'dance everywhere you go'],
  ['live without music', 'live without television'],
  ['have a nose that honks', 'have ears that wiggle on their own'],
  ['travel by jetpack', 'travel by teleporter'],
  ['be the youngest in your family', 'be the oldest'],
  ['have a house made of chocolate', 'have a house made of cheese'],
  ['win a dance contest', 'win a spelling contest'],
  ['have a secret door in your bedroom', 'have a secret slide in your garden'],
  ['be able to shrink to the size of an ant', 'be able to grow to the size of a giraffe'],
  ['lose your sense of taste', 'lose your sense of smell'],
  ['always have a song stuck in your head', 'always have an itch you cannot reach'],
  ['have a best friend who is a cat', 'have a best friend who is a dog'],
  ['explore a jungle', 'explore a desert'],
  ['be famous for something silly', 'be unknown for something great'],
  ['eat spaghetti with your hands', 'eat soup with a fork'],
  ['wear pajamas to a wedding', 'wear a wedding dress to bed'],
  ['have a snowball fight in summer', 'go to the beach in winter'],
  ['be a chef', 'be an astronaut'],
  ['be able to paint anything perfectly', 'be able to play any instrument perfectly'],
  ['live in the past', 'live in the future'],
  ['have a phone that only calls grandparents', 'have no phone at all'],
  ['do a cartwheel every time you sneeze', 'sneeze every time you laugh'],
  ['be friends with a giant', 'be friends with a fairy'],
];

export const RATHER_ROUNDS = 10;

/** `a` or `b`: the player whose turn it is picks; `seen` moves on after the reveal. */
export type RatherMove = 'a' | 'b' | 'seen';

export class RatherState implements GameState<RatherMove> {
  constructor(
    readonly players: number,
    /** The questions of this game, in order, as indexes into RATHER. */
    readonly deck: readonly number[],
    readonly round: number,
    /** 'pick' while the phone goes round; 'reveal' once everyone has picked. */
    readonly phase: 'pick' | 'reveal' | 'over',
    /** Who picks next in this round. */
    readonly turn: Seat,
    /** This round's picks so far, by seat: 0 for the first, 1 for the second. */
    readonly picks: readonly number[],
    readonly scores: readonly number[],
    readonly result: GameResult | null,
  ) {}

  get currentSeat(): Seat {
    return this.phase === 'pick' ? this.turn : 0;
  }

  get question(): readonly [string, string] {
    return RATHER[this.deck[this.round]!]!;
  }

  legalMoves(seat: Seat): readonly RatherMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    return this.phase === 'pick' ? ['a', 'b'] : ['seen'];
  }

  apply(move: RatherMove): RatherState {
    if (!this.legalMoves(this.currentSeat).includes(move)) throw new Error(`Illegal move: ${move}`);
    if (move === 'seen') {
      const round = this.round + 1;
      if (round >= RATHER_ROUNDS) return new RatherState(this.players, this.deck, this.round, 'over', 0, this.picks, this.scores, ratherResult(this.scores));
      return new RatherState(this.players, this.deck, round, 'pick', 0, [], this.scores, null);
    }
    const picks = [...this.picks, move === 'a' ? 0 : 1];
    if (picks.length < this.players) return new RatherState(this.players, this.deck, this.round, 'pick', this.turn + 1, picks, this.scores, null);
    // Everyone has picked: the side most of the table took scores; a tie scores nobody.
    const a = picks.filter((p) => p === 0).length;
    const b = picks.length - a;
    const winner = a === b ? -1 : a > b ? 0 : 1;
    const scores = this.scores.map((s, seat) => s + (picks[seat] === winner ? 1 : 0));
    return new RatherState(this.players, this.deck, this.round, 'reveal', 0, picks, scores, null);
  }
}

function ratherResult(scores: readonly number[]): GameResult {
  const best = Math.max(...scores);
  const winners = scores.flatMap((s, seat) => (s === best ? [seat] : []));
  return winners.length === scores.length ? { winners: [], draw: true } : { winners, draw: false };
}

export function newRather(seed: number, players: number): RatherState {
  const rng = createRng(seed);
  const deck = RATHER.map((_, i) => i);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return new RatherState(players, deck.slice(0, RATHER_ROUNDS), 0, 'pick', 0, [], Array<number>(players).fill(0), null);
}

/** Test play: a table that mostly agrees, with seat 1 the odd one out. */
function createRatherBot(): Bot<RatherMove> {
  return {
    chooseMove(generic: GameState<RatherMove>, seat: Seat, _rng: Rng): RatherMove {
      const s = generic as RatherState;
      if (s.phase === 'reveal') return 'seen';
      return (s.round + (seat === 1 ? 1 : 0)) % 2 === 0 ? 'a' : 'b';
    },
  };
}

export const wouldYouRather: GameDefinition<RatherMove> = {
  id: 'would-you-rather',
  name: 'Would You Rather',
  minPlayers: 2,
  maxPlayers: 8,
  modes: ['sameDevice'],
  hiddenInfo: true,
  realtime: false,
  newGame: (config, seed) => newRather(seed, Math.max(2, Math.min(8, config.players))),
  createBot: () => createRatherBot(),
  encodeMove: (move) => move,
};
