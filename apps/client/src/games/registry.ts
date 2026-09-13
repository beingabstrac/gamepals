import {
  airHockey,
  COLORS_BY_PLAYERS,
  fourInARow,
  ludo,
  pingPong,
  reflexRace,
  ticTacToe,
  tugOfWar,
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
import { COLORS } from '../theme';
import { AIR_HOCKEY_COLORS, AIR_HOCKEY_SIZE, AirHockeyScene, type RealtimeSceneOptions } from './air-hockey/AirHockeyScene';
import { DUEL_COLORS } from './duel';
import { FOUR_IN_A_ROW_SIZE, FourInARowScene } from './four-in-a-row/FourInARowScene';
import { PING_PONG_SIZE, PingPongScene } from './ping-pong/PingPongScene';
import { REFLEX_RACE_SIZE, ReflexRaceScene } from './reflex-race/ReflexRaceScene';
import { TUG_OF_WAR_SIZE, TugOfWarScene } from './tug-of-war/TugOfWarScene';
import { LudoControls } from './ludo/LudoControls';
import { LUDO_COLOR_NAMES, LUDO_COLORS, LUDO_SIZE, LudoScene } from './ludo/LudoScene';
import { TIC_TAC_TOE_SIZE, TicTacToeScene } from './tic-tac-toe/TicTacToeScene';

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
    tagline: 'Angle it past them, first to 7',
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
];

/** Shown on the home shelf so the catalog direction is visible from day one (docs/12). */
export const COMING_SOON: readonly { id: string; name: string; color: string }[] = [
  { id: 'checkers', name: 'Checkers', color: COLORS.peach },
  { id: 'chess', name: 'Chess', color: COLORS.grape },
  { id: 'solitaire', name: 'Solitaire', color: COLORS.mint },
  { id: 'sea-battle', name: 'Sea Battle', color: COLORS.sky },
  { id: 'sudoku', name: 'Sudoku', color: COLORS.sunny },
];
