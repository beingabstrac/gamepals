import { fourInARow, ticTacToe, type GameDefinition } from '@gamepals/rules';
import type { Scene } from 'phaser';
import type { Session } from '../session';
import { FOUR_IN_A_ROW_SIZE, FourInARowScene } from './four-in-a-row/FourInARowScene';
import { TicTacToeScene } from './tic-tac-toe/TicTacToeScene';

export interface GameEntry<M = unknown> {
  readonly definition: GameDefinition<M>;
  readonly emoji: string;
  readonly tagline: string;
  /** Name of each seat's side, e.g. X and O. */
  readonly seatNames: readonly string[];
  /** Logical canvas size; scaled to fit the screen. */
  readonly size: { readonly width: number; readonly height: number };
  /** Two-color gradient that identifies the game across screens. */
  readonly colors: readonly [string, string];
  createScene(session: Session<M>): Scene;
}

function entry<M>(value: GameEntry<M>): GameEntry {
  return value as unknown as GameEntry;
}

export const GAMES: readonly GameEntry[] = [
  entry({
    definition: ticTacToe,
    emoji: '❌',
    tagline: 'Three in a row wins',
    seatNames: ['X', 'O'],
    size: { width: 600, height: 600 },
    colors: ['#4f8cff', '#7b5cff'],
    createScene: (session) => new TicTacToeScene(session),
  }),
  entry({
    definition: fourInARow,
    emoji: '🟡',
    tagline: 'Drop discs, connect four',
    seatNames: ['Yellow', 'Red'],
    size: FOUR_IN_A_ROW_SIZE,
    colors: ['#ffb627', '#ff6b6b'],
    createScene: (session) => new FourInARowScene(session),
  }),
];

/** Shown on the home screen so the catalog direction is visible from day one. */
export const COMING_SOON: readonly { name: string; emoji: string; colors: readonly [string, string] }[] = [
  { name: 'Ludo', emoji: '🎲', colors: ['#3ddc97', '#1fa2ff'] },
  { name: 'Air Hockey', emoji: '🏒', colors: ['#00c6ff', '#0072ff'] },
  { name: 'Checkers', emoji: '⚫', colors: ['#ff8a65', '#d84315'] },
  { name: 'Chess', emoji: '♟️', colors: ['#b388ff', '#5e35b1'] },
  { name: 'Solitaire', emoji: '🃏', colors: ['#43e97b', '#1b8a5a'] },
];
