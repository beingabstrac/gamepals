import {
  airHockey,
  COLORS_BY_PLAYERS,
  fourInARow,
  ludo,
  ticTacToe,
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
import { AIR_HOCKEY_COLORS, AIR_HOCKEY_SIZE, AirHockeyScene, type RealtimeSceneOptions } from './air-hockey/AirHockeyScene';
import { FOUR_IN_A_ROW_SIZE, FourInARowScene } from './four-in-a-row/FourInARowScene';
import { LudoControls } from './ludo/LudoControls';
import { LUDO_COLOR_NAMES, LUDO_COLORS, LUDO_SIZE, LudoScene } from './ludo/LudoScene';
import { TicTacToeScene } from './tic-tac-toe/TicTacToeScene';

/** What the home grid and setup screen need to know about any game. */
export interface EntryBase {
  readonly definition: {
    readonly id: string;
    readonly name: string;
    readonly minPlayers: number;
    readonly maxPlayers: number;
    readonly modes: readonly PlayMode[];
  };
  readonly emoji: string;
  readonly tagline: string;
  /** Name of each seat's side for a given player count, e.g. X and O. */
  sideNames(players: number): readonly string[];
  /** CSS color of each seat's side for a given player count. */
  sideColors(players: number): readonly string[];
  /** Logical canvas size; scaled to fit the screen. */
  readonly size: { readonly width: number; readonly height: number };
  /** Two-color gradient that identifies the game across screens. */
  readonly colors: readonly [string, string];
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
    emoji: '❌',
    tagline: 'Three in a row wins',
    sideNames: () => ['X', 'O'],
    sideColors: () => ['#4f8cff', '#ff6b6b'],
    size: { width: 600, height: 600 },
    colors: ['#4f8cff', '#7b5cff'],
    createScene: (session) => new TicTacToeScene(session),
  }),
  entry({
    definition: fourInARow,
    emoji: '🟡',
    tagline: 'Drop discs, connect four',
    sideNames: () => ['Yellow', 'Red'],
    sideColors: () => ['#ffd23f', '#ff6b6b'],
    size: FOUR_IN_A_ROW_SIZE,
    colors: ['#ffb627', '#ff6b6b'],
    createScene: (session) => new FourInARowScene(session),
  }),
  entry({
    definition: ludo,
    emoji: '🎲',
    tagline: 'Race your four tokens home',
    sideNames: (players) => ludoSides(players).map((color) => LUDO_COLOR_NAMES[color]!),
    sideColors: (players) => ludoSides(players).map((color) => LUDO_COLORS[color]!),
    size: LUDO_SIZE,
    colors: ['#3ddc97', '#1fa2ff'],
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
    emoji: '🏒',
    tagline: 'Fast 1-on-1, first to 7',
    sideNames: () => ['Bottom', 'Top'],
    sideColors: () => AIR_HOCKEY_COLORS,
    size: AIR_HOCKEY_SIZE,
    colors: ['#00c6ff', '#0072ff'],
    createScene: (options) => new AirHockeyScene(options),
  },
];

/** Shown on the home screen so the catalog direction is visible from day one. */
export const COMING_SOON: readonly { name: string; emoji: string; colors: readonly [string, string] }[] = [
  { name: 'Checkers', emoji: '⚫', colors: ['#ff8a65', '#d84315'] },
  { name: 'Chess', emoji: '♟️', colors: ['#b388ff', '#5e35b1'] },
  { name: 'Solitaire', emoji: '🃏', colors: ['#43e97b', '#1b8a5a'] },
  { name: 'Sea Battle', emoji: '🚢', colors: ['#4facfe', '#1d4ed8'] },
  { name: 'Sudoku', emoji: '🔢', colors: ['#f6d365', '#fda085'] },
];
