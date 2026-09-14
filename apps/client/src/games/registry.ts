import {
  airHockey,
  COLORS_BY_PLAYERS,
  fourInARow,
  ludo,
  memory,
  penaltyKicks,
  pingPong,
  reflexRace,
  snakeBattle,
  solitaire,
  sudoku,
  SUDOKU_HINTS,
  SUDOKU_LEVELS,
  sumo,
  ticTacToe,
  tugOfWar,
  twenty48,
  type GameDefinition,
  type GameState,
  type LudoState,
  type MemoryState,
  type PlayMode,
  type RealtimeGameDefinition,
  type SolitaireState,
  type SudokuLevel,
  type SudokuState,
  type Twenty48State,
} from '@gamepals/rules';
import type { Scene } from 'phaser';
import type { ComponentType } from 'preact';
import type { Session } from '../session';
import type { SoundName } from '../sfx';
import { COLORS, DARK } from '../theme';
import { AIR_HOCKEY_COLORS, AIR_HOCKEY_SIZE, AirHockeyScene, type RealtimeSceneOptions } from './air-hockey/AirHockeyScene';
import { DUEL_COLORS } from './duel';
import { FOUR_IN_A_ROW_SIZE, FourInARowScene } from './four-in-a-row/FourInARowScene';
import { LudoControls } from './ludo/LudoControls';
import { LUDO_COLOR_NAMES, LUDO_COLORS, LUDO_SIZE, LudoScene } from './ludo/LudoScene';
import { PENALTY_SIZE, PenaltyScene } from './penalty-kicks/PenaltyScene';
import { PING_PONG_SIZE, PingPongScene } from './ping-pong/PingPongScene';
import { REFLEX_RACE_SIZE, ReflexRaceScene } from './reflex-race/ReflexRaceScene';
import { SNAKE_SIZE, SnakeScene } from './snake-battle/SnakeScene';
import { MEMORY_COLORS, MEMORY_NAMES, MEMORY_SIZE, MemoryScene } from './memory/MemoryScene';
import { SolitaireControls } from './solitaire/SolitaireControls';
import { SOLITAIRE_SIZE, SolitaireScene } from './solitaire/SolitaireScene';
import { SudokuControls } from './sudoku/SudokuControls';
import { SUDOKU_SIZE, SudokuScene } from './sudoku/SudokuScene';
import { SUMO_SIZE, SumoScene } from './sumo/SumoScene';
import { TIC_TAC_TOE_SIZE, TicTacToeScene } from './tic-tac-toe/TicTacToeScene';
import { TUG_OF_WAR_SIZE, TugOfWarScene } from './tug-of-war/TugOfWarScene';
import { TWENTY48_SIZE, Twenty48Scene } from './twenty48/Twenty48Scene';

/** Short, plain-language rules shown before a game starts. No jargon, no long sentences. */
export interface HowTo {
  readonly goal: string;
  readonly controls: string;
  readonly win: string;
  readonly draw?: string;
  readonly tip?: string;
}

/** What the home shelf and the table setup need to know about any game. */
export interface EntryBase {
  readonly definition: {
    readonly id: string;
    readonly name: string;
    readonly minPlayers: number;
    readonly maxPlayers: number;
    readonly modes: readonly PlayMode[];
  };
  readonly tagline: string;
  readonly howTo: HowTo;
  /** Levels picked at the table (passed to the rules as the game variant). */
  readonly levels?: readonly { readonly id: string; readonly label: string }[];
  /** Name of each seat's side for a given player count, e.g. X and O. */
  sideNames(players: number): readonly string[];
  /** CSS color of each seat's side for a given player count. */
  sideColors(players: number): readonly string[];
  /** Logical canvas size; rendered at device pixel density and scaled to fit. */
  readonly size: { readonly width: number; readonly height: number };
  /** The game's own flat candy color (tile, table, Play button). */
  readonly color: string;
}

/** Turn-based game driven by a `Session`. */
export interface GameEntry<M = unknown> extends EntryBase {
  readonly kind: 'turn';
  readonly definition: GameDefinition<M>;
  /** Pause before bot actions (longer for games with long animations). */
  readonly botDelayMs?: number;
  /** Game-specific sound for a state change; defaults to place/bot place. */
  moveCue?(before: GameState<M>, after: GameState<M>): SoundName | undefined;
  /** Extra controls rendered under the board (e.g. dice). */
  readonly Controls?: ComponentType<{ session: Session<M> }>;
  /** Replaces "X to move" (e.g. a score for solo puzzles); undefined keeps the default. */
  status?(state: GameState<M>): string | undefined;
  /** Replaces the result headline (e.g. "No more moves. 2,340 points"); undefined keeps the default. */
  resultText?(state: GameState<M>): string | undefined;
  createScene(session: Session<M>): Scene;
}

/** Real-time game whose scene runs its own fixed-step simulation. */
export interface RealtimeEntry extends EntryBase {
  readonly kind: 'realtime';
  readonly definition: RealtimeGameDefinition;
  createScene(options: RealtimeSceneOptions): Scene;
}

export type AnyEntry = GameEntry | RealtimeEntry;

function entry<M>(value: Omit<GameEntry<M>, 'kind'>): GameEntry {
  return { ...value, kind: 'turn' } as unknown as GameEntry;
}

const LEVEL_LABEL: Record<SudokuLevel, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' };

const ludoSides = (players: number) => COLORS_BY_PLAYERS[players] ?? COLORS_BY_PLAYERS[4]!;
const duelSides = { sideNames: () => ['Bottom', 'Top'], sideColors: () => DUEL_COLORS } as const;

export const GAMES: readonly AnyEntry[] = [
  entry({
    definition: ticTacToe,
    tagline: 'Three in a row wins',
    howTo: {
      goal: 'Get three of your marks in a row.',
      controls: 'Tap an empty square to put your mark there.',
      win: 'Three in a row across, down, or corner to corner.',
      draw: 'If all nine squares fill up and nobody has three in a row, it is a draw.',
    },
    sideNames: () => ['X', 'O'],
    sideColors: () => [COLORS.tomato, COLORS.sky],
    size: TIC_TAC_TOE_SIZE,
    color: COLORS.grape,
    createScene: (session) => new TicTacToeScene(session),
  }),
  entry({
    definition: fourInARow,
    tagline: 'Drop discs, connect four',
    howTo: {
      goal: 'Line up four of your discs.',
      controls: 'Tap a column. Your disc drops to the lowest empty spot.',
      win: 'Four in a row across, down, or on a slant.',
      draw: 'If the board fills up first, it is a draw.',
    },
    sideNames: () => ['Yellow', 'Red'],
    sideColors: () => [COLORS.sunny, COLORS.tomato],
    size: FOUR_IN_A_ROW_SIZE,
    color: COLORS.sky,
    createScene: (session) => new FourInARowScene(session),
  }),
  entry({
    definition: ludo,
    tagline: 'Race your four tokens home',
    howTo: {
      goal: 'Move all four of your tokens around the board and into the middle.',
      controls: 'Tap Roll. Then tap a bouncing token to move it.',
      win: 'The first player with all four tokens home wins.',
      tip: 'You need a 6 to bring a token out. A 6 gives you another roll, but three 6s in a row ends your turn. Land on someone to send them back. Star squares are safe.',
    },
    sideNames: (players) => ludoSides(players).map((color) => LUDO_COLOR_NAMES[color]!),
    sideColors: (players) => ludoSides(players).map((color) => LUDO_COLORS[color]!),
    size: LUDO_SIZE,
    color: COLORS.mint,
    botDelayMs: 1000,
    moveCue: (_before, after) => {
      const state = after as LudoState;
      if (!state.lastEvent) return 'roll';
      return state.lastEvent.captured.length > 0 ? 'capture' : undefined;
    },
    Controls: LudoControls,
    createScene: (session) => new LudoScene(session),
  }),
  entry({
    definition: twenty48,
    tagline: 'Slide, merge, reach 2048',
    howTo: {
      goal: 'Join tiles with the same number to make bigger numbers.',
      controls: 'Swipe up, down, left or right. Every tile slides that way.',
      win: 'Make a 2048 tile. You can keep going for a higher score.',
      tip: 'A new tile appears after every move. The game ends when nothing can move.',
    },
    sideNames: () => ['You'],
    sideColors: () => [COLORS.peach],
    size: TWENTY48_SIZE,
    color: COLORS.peach,
    status: (state) => `Score ${(state as Twenty48State).score.toLocaleString()}`,
    resultText: (state) => {
      const s = state as Twenty48State;
      return s.best >= 2048 ? `You made 2048! ${s.score.toLocaleString()} points 🎉` : `No more moves. ${s.score.toLocaleString()} points`;
    },
    createScene: (session) => new Twenty48Scene(session),
  }),
  entry({
    definition: sudoku,
    tagline: 'Fill the grid with 1 to 9',
    levels: SUDOKU_LEVELS.map((id) => ({ id, label: LEVEL_LABEL[id] })),
    howTo: {
      goal: 'Fill every empty square with a number from 1 to 9.',
      controls: 'Tap a square, then tap a number. Turn on Notes to jot down small guesses.',
      win: 'Every row, every column and every 3 by 3 box has 1 to 9 exactly once.',
      tip: 'Each puzzle has only one answer, so you never have to guess. A repeated number turns red. Stuck? You get 3 hints.',
    },
    sideNames: () => ['You'],
    sideColors: () => [COLORS.sunny],
    size: SUDOKU_SIZE,
    color: DARK.sky,
    status: (state) => {
      const s = state as SudokuState;
      return `${LEVEL_LABEL[s.level]}: ${s.remaining} squares left`;
    },
    resultText: (state) => {
      const used = SUDOKU_HINTS - (state as SudokuState).hintsLeft;
      return used === 0 ? 'Solved with no hints! 🌟' : `Solved! You used ${used} hint${used === 1 ? '' : 's'}.`;
    },
    moveCue: (before, after) => {
      const a = after as SudokuState;
      if (a.lastHint) return 'go';
      if (a.conflicts().size > (before as SudokuState).conflicts().size) return 'buzz';
      return a.values.some((v, i) => v !== (before as SudokuState).values[i]) ? 'place' : 'tap';
    },
    Controls: SudokuControls,
    createScene: (session) => new SudokuScene(session),
  }),
  entry({
    definition: solitaire,
    tagline: 'Sort the deck, Ace to King',
    levels: [
      { id: 'draw1', label: 'Draw 1' },
      { id: 'draw3', label: 'Draw 3' },
    ],
    howTo: {
      goal: 'Move all 52 cards onto the four piles at the top. Each pile is one suit, from Ace up to King.',
      controls: 'Tap a card to send it to the best spot, or drag it where you want. Tap the deck to draw.',
      win: 'You win when every card is on the four piles.',
      tip: 'In the columns, stack cards going down and switch between red and black. Only a King can go in an empty column. Draw 3 is harder than Draw 1.',
    },
    sideNames: () => ['You'],
    sideColors: () => [COLORS.mint],
    size: SOLITAIRE_SIZE,
    color: DARK.mint,
    status: (state) => `Score ${(state as SolitaireState).score}`,
    resultText: (state) => {
      const s = state as SolitaireState;
      return `You won! ${s.score} points in ${s.moveCount} moves.`;
    },
    moveCue: (before, after) => {
      const a = after as SolitaireState;
      const b = before as SolitaireState;
      if (a.moveCount < b.moveCount) return 'tap';
      if (a.stock.length !== b.stock.length) return 'tap';
      const home = (s: SolitaireState) => s.foundations.reduce((n, pile) => n + pile.length, 0);
      return home(a) > home(b) ? 'go' : 'place';
    },
    Controls: SolitaireControls,
    createScene: (session) => new SolitaireScene(session),
  }),
  entry({
    definition: memory,
    tagline: 'Flip two, find the pairs',
    levels: [
      { id: 'small', label: '12 cards' },
      { id: 'medium', label: '20 cards' },
      { id: 'large', label: '30 cards' },
    ],
    howTo: {
      goal: 'Find the matching pairs of cards.',
      controls: 'Tap a card to flip it over, then tap a second card.',
      win: 'Whoever finds the most pairs wins. Playing alone, clear the board in as few turns as you can.',
      draw: 'If everyone ends with the same number of pairs, it is a draw.',
      tip: 'Find a pair and you go again. Miss, and both cards flip back, so remember where they were.',
    },
    sideNames: (players) => MEMORY_NAMES.slice(0, players),
    sideColors: (players) => MEMORY_COLORS.slice(0, players),
    size: MEMORY_SIZE,
    color: DARK.bubblegum,
    botDelayMs: 1100,
    status: (state) => {
      const s = state as MemoryState;
      return s.players === 1 ? `Turns ${s.turns}` : undefined;
    },
    resultText: (state) => {
      const s = state as MemoryState;
      return s.players === 1 ? `All pairs found in ${s.turns} turns!` : undefined;
    },
    moveCue: (before, after) => {
      const event = (after as MemoryState).last;
      if (!event || event === (before as MemoryState).last) return 'tap';
      return event.match ? 'capture' : 'thud';
    },
    createScene: (session) => new MemoryScene(session),
  }),
  {
    kind: 'realtime',
    definition: airHockey,
    tagline: 'Fast 1-on-1, first to 7',
    howTo: {
      goal: 'Knock the puck into the other goal.',
      controls: 'Drag your paddle around your half of the table. On a keyboard: the arrow keys for the bottom player, W A S D for the top.',
      win: 'First to 7 goals wins.',
    },
    sideNames: () => ['Bottom', 'Top'],
    sideColors: () => AIR_HOCKEY_COLORS,
    size: AIR_HOCKEY_SIZE,
    color: COLORS.tomato,
    createScene: (options) => new AirHockeyScene(options),
  },
  {
    kind: 'realtime',
    definition: pingPong,
    tagline: 'Swipe to hit, first to 11',
    howTo: {
      goal: 'Hit the ball over the net so it bounces on the other side.',
      controls: 'When the ball bounces on your side, swipe toward the net. Swipe faster to hit harder. Swipe to serve too. On a keyboard: Left and Right move, Space hits (the top player uses A, D and Shift).',
      win: 'First to 11 points. You must be 2 points ahead.',
      tip: 'The ball must bounce once on each side. Hitting it long, wide or into the net loses the point.',
    },
    ...duelSides,
    size: PING_PONG_SIZE,
    color: COLORS.peach,
    createScene: (options) => new PingPongScene(options),
  },
  {
    kind: 'realtime',
    definition: tugOfWar,
    tagline: 'Tap faster to pull them over',
    howTo: {
      goal: 'Pull the yellow knot over to your side.',
      controls: 'Tap your half of the screen as fast as you can. On a keyboard: Space for the bottom player, Shift for the top.',
      win: 'Pull the knot past your dashed line.',
    },
    ...duelSides,
    size: TUG_OF_WAR_SIZE,
    color: COLORS.bubblegum,
    createScene: (options) => new TugOfWarScene(options),
  },
  {
    kind: 'realtime',
    definition: reflexRace,
    tagline: 'Wait for green, then tap first',
    howTo: {
      goal: 'Tap faster than the other player.',
      controls: 'Wait until the big circle turns green. Then tap your half. On a keyboard: Space for the bottom player, Shift for the top.',
      win: 'First to 3 points wins.',
      tip: 'Tap too soon and the other player gets the point.',
    },
    ...duelSides,
    size: REFLEX_RACE_SIZE,
    color: COLORS.grape,
    createScene: (options) => new ReflexRaceScene(options),
  },
  {
    kind: 'realtime',
    definition: sumo,
    tagline: 'Shove them out of the ring',
    howTo: {
      goal: 'Push the other wrestler out of the ring.',
      controls: 'Hold and drag in your half to move. Tap to shove. On a keyboard: the arrow keys move and Space shoves (the top player uses W A S D and Shift).',
      win: 'Win 2 rounds to win the match.',
      tip: 'Stay away from the edge. A big shove that misses can carry you out.',
    },
    ...duelSides,
    size: SUMO_SIZE,
    color: DARK.peach,
    createScene: (options) => new SumoScene(options),
  },
  {
    kind: 'realtime',
    definition: penaltyKicks,
    tagline: 'Shoot, dive, five kicks each',
    howTo: {
      goal: 'Score more goals than the other player.',
      controls: 'Kicking: swipe toward the goal. Saving: drag to move, then flick left or right to dive. On a keyboard: hold Left or Right to aim or move, and press Space to kick or dive (the top player uses A, D and Shift).',
      win: 'Five kicks each. If it is tied, keep going until one scores and the other misses.',
      tip: 'You take turns kicking and saving. A very hard kick can fly over the bar.',
    },
    ...duelSides,
    size: PENALTY_SIZE,
    color: DARK.mint,
    createScene: (options) => new PenaltyScene(options),
  },
  {
    kind: 'realtime',
    definition: snakeBattle,
    tagline: 'Trap them before they trap you',
    howTo: {
      goal: 'Make the other snake crash first.',
      controls: 'Tap the arrow buttons to turn left or right. On a keyboard: the arrow keys for the bottom snake, A and D for the top.',
      win: 'Win 3 rounds to win the match.',
      draw: 'If both snakes crash into each other head first, nobody gets the round.',
      tip: 'Hitting a wall, yourself or the other snake ends the round. Eat fruit to grow longer.',
    },
    ...duelSides,
    size: SNAKE_SIZE,
    color: DARK.grape,
    createScene: (options) => new SnakeScene(options),
  },
];

/** Shown on the home shelf so the catalog direction is visible from day one (docs/12). */
export const COMING_SOON: readonly { id: string; name: string; color: string }[] = [
  { id: 'checkers', name: 'Checkers', color: COLORS.peach },
  { id: 'chess', name: 'Chess', color: COLORS.grape },
  { id: 'sea-battle', name: 'Sea Battle', color: COLORS.sky },
];
