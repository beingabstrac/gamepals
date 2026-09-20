import { createRng, type Rng } from '../../core/rng';
import type { Bot, BotTier, GameConfig, GameDefinition, GameResult, GameState, Seat } from '../../core/types';
import { CLUES } from '../crossword/clues';
import { ANSWERS } from '../word-guess/words';

/**
 * Word Ladder (docs/games/word-ladder.md). Change one letter at a time, every rung a real word,
 * climb from the first word to the last.
 *
 * Moves: `s<word>` puts a word on the next rung, `-` takes the last one back.
 */
export type LadderMove = string;
export const rung = (word: string): LadderMove => `s${word}`;
export const TAKE_BACK: LadderMove = '-';

/** How far apart the two ends are. Fewer is a puzzle, more is a slog. */
const PAR_LOW = 4;
const PAR_HIGH = 6;

export interface LadderSize {
  readonly letters: number;
  readonly label: string;
}

export const LADDER_SIZES: Record<string, LadderSize> = {
  short: { letters: 3, label: 'Three letters' },
  medium: { letters: 4, label: 'Four letters' },
  long: { letters: 5, label: 'Five letters' },
};

export const ladderSizeFor = (variant?: string): LadderSize =>
  LADDER_SIZES[variant ?? 'medium'] ?? LADDER_SIZES.medium!;

/**
 * The words each length climbs through. Three and four letters come from the crossword's clue
 * dictionary and five from the Word Guess answers, because the clue dictionary's own five-letter
 * words barely connect: 86 of 833 in one piece, against 1,207 of 2,332. Measured, not guessed.
 */
const wordsOf = (letters: number): readonly string[] =>
  letters === 5 ? ANSWERS : Object.keys(CLUES).filter((word) => word.length === letters);

const cache = new Map<number, { words: readonly string[]; next: ReadonlyMap<string, readonly string[]> }>();

/** Every word one letter away from each word, worked out once per length. */
function ladderWords(letters: number): { words: readonly string[]; next: ReadonlyMap<string, readonly string[]> } {
  const had = cache.get(letters);
  if (had) return had;
  const words = wordsOf(letters);
  const buckets = new Map<string, string[]>();
  for (const word of words) {
    for (let i = 0; i < letters; i++) {
      const key = `${word.slice(0, i)}.${word.slice(i + 1)}`;
      const bucket = buckets.get(key) ?? [];
      bucket.push(word);
      buckets.set(key, bucket);
    }
  }
  const next = new Map<string, string[]>();
  for (const bucket of buckets.values()) {
    for (const word of bucket) {
      const list = next.get(word) ?? [];
      for (const other of bucket) if (other !== word && !list.includes(other)) list.push(other);
      next.set(word, list);
    }
  }
  const built = { words, next };
  cache.set(letters, built);
  return built;
}

/** One letter different, in the same places. */
export function oneApart(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let different = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) different++;
  return different === 1;
}

/** How many rungs the shortest ladder takes, or 0 when there is no way through. */
export function shortest(from: string, to: string, letters: number): number {
  if (from === to) return 0;
  const { next } = ladderWords(letters);
  const seen = new Set([from]);
  let edge = [from];
  for (let steps = 1; edge.length; steps++) {
    const further: string[] = [];
    for (const word of edge) {
      for (const other of next.get(word) ?? []) {
        if (seen.has(other)) continue;
        if (other === to) return steps;
        seen.add(other);
        further.push(other);
      }
    }
    edge = further;
  }
  return 0;
}

export class LadderState implements GameState<LadderMove> {
  constructor(
    readonly start: string,
    readonly target: string,
    /** The rungs climbed so far, not counting the starting word. */
    readonly rungs: readonly string[],
    readonly par: number,
    readonly currentSeat: Seat,
    readonly moves: number,
    readonly result: GameResult | null,
  ) {}

  get letters(): number {
    return this.start.length;
  }

  /** The word you are standing on. */
  get here(): string {
    return this.rungs[this.rungs.length - 1] ?? this.start;
  }

  /** Every word used so far, because a ladder may not step on one twice. */
  get used(): ReadonlySet<string> {
    return new Set([this.start, ...this.rungs]);
  }

  get over(): number {
    return Math.max(0, this.rungs.length - this.par);
  }

  legalMoves(seat: Seat): readonly LadderMove[] {
    if (this.result || seat !== this.currentSeat) return [];
    const { next } = ladderWords(this.letters);
    const used = this.used;
    const moves = (next.get(this.here) ?? []).filter((word) => !used.has(word)).map(rung);
    return this.rungs.length ? [...moves, TAKE_BACK] : moves;
  }

  apply(move: LadderMove): LadderState {
    if (this.result) throw new Error('Game is over');
    if (move === TAKE_BACK) {
      if (!this.rungs.length) throw new Error(`Illegal move: ${move}`);
      return new LadderState(this.start, this.target, this.rungs.slice(0, -1), this.par, 0, this.moves + 1, null);
    }
    const word = move.startsWith('s') ? move.slice(1) : '';
    const { next } = ladderWords(this.letters);
    if (!next.has(word)) throw new Error(`Illegal move: ${move}`);
    if (!oneApart(this.here, word)) throw new Error(`Illegal move: ${move}`);
    if (this.used.has(word)) throw new Error(`Illegal move: ${move}`);
    const rungs = [...this.rungs, word];
    const result: GameResult | null = word === this.target ? { winners: [0], draw: false } : null;
    return new LadderState(this.start, this.target, rungs, this.par, 0, this.moves + 1, result);
  }
}

export function newWordLadder(config: GameConfig, seed: number): LadderState {
  const size = ladderSizeFor(config.variant);
  const rng = createRng(seed >>> 0);
  const { words, next } = ladderWords(size.letters);
  // Walk out from a random word and take one that is a decent climb away. Most words are in the
  // big connected piece, so a few tries always finds a pair rather than a dead end.
  for (let attempt = 0; attempt < 200; attempt++) {
    const start = words[rng.int(words.length)]!;
    const seen = new Set([start]);
    let edge = [start];
    const reached: string[][] = [];
    for (let steps = 1; steps <= PAR_HIGH && edge.length; steps++) {
      const further: string[] = [];
      for (const word of edge) {
        for (const other of next.get(word) ?? []) {
          if (seen.has(other)) continue;
          seen.add(other);
          further.push(other);
        }
      }
      reached[steps] = further;
      edge = further;
    }
    const pars = [];
    for (let steps = PAR_LOW; steps <= PAR_HIGH; steps++) if (reached[steps]?.length) pars.push(steps);
    if (!pars.length) continue;
    const par = pars[rng.int(pars.length)]!;
    const options = reached[par]!;
    const target = options[rng.int(options.length)]!;
    return new LadderState(start, target, [], par, 0, 0, null);
  }
  throw new Error('Could not lay a word ladder');
}

/** What a seat may know. There is nothing held back: both ends are on the board. */
export interface LadderView {
  readonly here: string;
  readonly target: string;
  readonly par: number;
}

export const ladderViewFor = (state: LadderState): LadderView => ({
  here: state.here,
  target: state.target,
  par: state.par,
});

/** How many letters of the target this word already has in the right places. */
const warmth = (word: string, target: string): number =>
  [...word].reduce((count, letter, i) => count + (letter === target[i] ? 1 : 0), 0);

interface LadderStyle {
  /** Works out which rungs still reach the target, rather than just which look closer. */
  readonly looksAhead: boolean;
  /** How often it takes a rung for no reason. A weak player is not a random one. */
  readonly blunders: number;
}

const TIERS: Record<BotTier, LadderStyle> = {
  easy: { looksAhead: false, blunders: 3 },
  medium: { looksAhead: false, blunders: 0 },
  hard: { looksAhead: true, blunders: 0 },
  expert: { looksAhead: true, blunders: 0 },
};

/**
 * A solo puzzle has no opponent to be fair to, so the bot is an autoplayer. The good ones work
 * out which rungs still reach the target; the weak ones go by which word looks most like it,
 * which is how a person plays and, unlike a random walk, actually arrives.
 */
function createLadderBot(style: LadderStyle): Bot<LadderMove> {
  return {
    chooseMove(generic: GameState<LadderMove>, seat: Seat, rng: Rng): LadderMove {
      const state = generic as LadderState;
      const all = state.legalMoves(seat);
      if (!all.length) throw new Error('No legal moves');
      const moves = all.filter((move) => move !== TAKE_BACK);
      // A ladder can be climbed into a corner where every neighbour has been used already. A
      // person gets down the same way: take the last rung back and go another way.
      if (!moves.length) return TAKE_BACK;
      const words = moves.map((move) => move.slice(1));
      const home = words.find((word) => word === state.target);
      if (home) return rung(home);
      if (style.blunders && rng.int(style.blunders) === 0) return rung(words[rng.int(words.length)]!);

      if (!style.looksAhead) {
        // Warmest first, and the tie broken by the seed so two games do not walk in step.
        const best = Math.max(...words.map((word) => warmth(word, state.target)));
        const warm = words.filter((word) => warmth(word, state.target) === best);
        return rung(warm[rng.int(warm.length)]!);
      }

      // Only rungs that still reach the target are worth taking.
      const alive = words.filter((word) => shortest(word, state.target, state.letters) > 0);
      if (!alive.length) return state.rungs.length ? TAKE_BACK : rung(words[rng.int(words.length)]!);
      let best = alive[0]!;
      let bestSteps = Infinity;
      for (const word of alive) {
        const steps = shortest(word, state.target, state.letters);
        if (steps > 0 && steps < bestSteps) {
          bestSteps = steps;
          best = word;
        }
      }
      return rung(best);
    },
  };
}

export const wordLadderGame: GameDefinition<LadderMove> = {
  id: 'word-ladder',
  name: 'Word Ladder',
  minPlayers: 1,
  maxPlayers: 1,
  modes: ['solo'],
  hiddenInfo: false,
  realtime: false,
  newGame: (config, seed) => newWordLadder(config, seed),
  createBot: (tier) => createLadderBot(TIERS[tier]),
  encodeMove: (move) => move,
};
