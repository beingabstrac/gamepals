import {
  airHockey,
  COLORS_BY_PLAYERS,
  fourInARow,
  ludo,
  penaltyKicks,
  pingPong,
  reflexRace,
  snakeBattle,
  sumo,
  ticTacToe,
  tugOfWar,
  twenty48,
  type Twenty48State,
  type GameDefinition,
  type GameState,
  type LudoState,
  type PlayMode,
  type RealtimeGameDefinition,
} from '@gamepals/rules';
import type { Scene } from 'phaser';
import type { ComponentType } from 'preact';
import type { Session } from '../session';
import type { SoundName } from '../sfx';
import { COLORS, DARK } from '../theme';
import { AIR_HOCKEY_COLORS, AIR_HOCKEY_SIZE, AirHockeyScene, type RealtimeSceneOptions } from './air-hockey/AirHockeyScene';
import { DUEL_COLORS } from './duel';
import { FOUR_IN_A_ROW_SIZE, FourInARowScene } from './four-in-a-row/FourInARowScene';
import { PENALTY_SIZE, PenaltyScene } from './penalty-kicks/PenaltyScene';
import { PING_PONG_SIZE, PingPongScene } from './ping-pong/PingPongScene';
import { REFLEX_RACE_SIZE, ReflexRaceScene } from './reflex-race/ReflexRaceScene';
import { SNAKE_SIZE, SnakeScene } from './snake-battle/SnakeScene';
import { SUMO_SIZE, SumoScene } from './sumo/SumoScene';
import { TUG_OF_WAR_SIZE, TugOfWarScene } from './tug-of-war/TugOfWarScene';
import { LudoControls } from './ludo/LudoControls';
import { LUDO_COLOR_NAMES, LUDO_COLORS, LUDO_SIZE, LudoScene } from './ludo/LudoScene';
import { TIC_TAC_TOE_SIZE, TicTacToeScene } from './tic-tac-toe/TicTacToeScene';
import { TWENTY48_SIZE, Twenty48Scene } from './twenty48/Twenty48Scene';

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
  /** Replaces "X to move" (e.g. a score for solo puzzles). */
  status?(state: GameState<M>): string;
  /** Replaces the result headline (e.g. "No more moves · 2,340 points"). */
  resultText?(state: GameState<M>): string;
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

const ludoSides = (players: number) => COLORS_BY_PLAYERS[players] ?? COLORS_BY_PLAYERS[4]!;

export const GAMES: readonly AnyEntry[] = [
  entry({
    definition: ticTacToe,
    tagline: 'Three in a row wins',
    sideNames: () => ['X', 'O'],
    sideColors: () => [COLORS.tomato, COLORS.sky],
    size: TIC_TAC_TOE_SIZE,
    color: COLORS.grape,
    createScene: (session) => new TicTacToeScene(session),
  }),
  entry({
    definition: fourInARow,
    tagline: 'Drop discs, connect four',
    sideNames: () => ['Yellow', 'Red'],
    sideColors: () => [COLORS.sunny, COLORS.tomato],
    size: FOUR_IN_A_ROW_SIZE,
    color: COLORS.sky,
    createScene: (session) => new FourInARowScene(session),
  }),
  entry({
    definition: ludo,
    tagline: 'Race your four tokens home',
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
    sideNames: () => ['You'],
    sideColors: () => [COLORS.peach],
    size: TWENTY48_SIZE,
    color: COLORS.peach,
    status: (state) => `Score ${(state as Twenty48State).score.toLocaleString()}`,
    resultText: (state) => {
      const s = state as Twenty48State;
      return s.best >= 2048 ? `2048! ${s.score.toLocaleString()} points 🎉` : `No more moves · ${s.score.toLocaleString()} points`;
    },
    createScene: (session) => new Twenty48Scene(session),
  }),
  {
    kind: 'realtime',
    definition: airHockey,
    tagline: 'Fast 1-on-1, first to 7',
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
    sideNames: () => ['Bottom', 'Top'],
    sideColors: () => DUEL_COLORS,
    size: PING_PONG_SIZE,
    color: COLORS.peach,
    createScene: (options) => new PingPongScene(options),
  },
  {
    kind: 'realtime',
    definition: tugOfWar,
    tagline: 'Tap faster to pull them over',
    sideNames: () => ['Bottom', 'Top'],
    sideColors: () => DUEL_COLORS,
    size: TUG_OF_WAR_SIZE,
    color: COLORS.bubblegum,
    createScene: (options) => new TugOfWarScene(options),
  },
  {
    kind: 'realtime',
    definition: reflexRace,
    tagline: 'Wait for green, then tap first',
    sideNames: () => ['Bottom', 'Top'],
    sideColors: () => DUEL_COLORS,
    size: REFLEX_RACE_SIZE,
    color: COLORS.grape,
    createScene: (options) => new ReflexRaceScene(options),
  },
  {
    kind: 'realtime',
    definition: sumo,
    tagline: 'Shove them out of the ring',
    sideNames: () => ['Bottom', 'Top'],
    sideColors: () => DUEL_COLORS,
    size: SUMO_SIZE,
    color: DARK.peach,
    createScene: (options) => new SumoScene(options),
  },
  {
    kind: 'realtime',
    definition: penaltyKicks,
    tagline: 'Shoot, dive, five kicks each',
    sideNames: () => ['Bottom', 'Top'],
    sideColors: () => DUEL_COLORS,
    size: PENALTY_SIZE,
    color: DARK.mint,
    createScene: (options) => new PenaltyScene(options),
  },
  {
    kind: 'realtime',
    definition: snakeBattle,
    tagline: 'Trap them before they trap you',
    sideNames: () => ['Bottom', 'Top'],
    sideColors: () => DUEL_COLORS,
    size: SNAKE_SIZE,
    color: DARK.grape,
    createScene: (options) => new SnakeScene(options),
  },
];

/** Shown on the home shelf so the catalog direction is visible from day one (docs/12). */
export const COMING_SOON: readonly { id: string; name: string; color: string }[] = [
  { id: 'checkers', name: 'Checkers', color: COLORS.peach },
  { id: 'chess', name: 'Chess', color: COLORS.grape },
  { id: 'solitaire', name: 'Solitaire', color: COLORS.mint },
  { id: 'sea-battle', name: 'Sea Battle', color: COLORS.sky },
  { id: 'sudoku', name: 'Sudoku', color: COLORS.sunny },
];
