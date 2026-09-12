import { ticTacToe, type GameDefinition } from '@gamepals/rules';
import type { Scene } from 'phaser';
import type { Session } from '../session';
import { TicTacToeScene } from './tic-tac-toe/TicTacToeScene';

export interface GameEntry<M = unknown> {
  readonly definition: GameDefinition<M>;
  readonly emoji: string;
  readonly tagline: string;
  /** Name of each seat's side, e.g. X and O. */
  readonly seatNames: readonly string[];
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
    createScene: (session) => new TicTacToeScene(session),
  }),
];

/** Shown on the home screen so the catalog direction is visible from day one. */
export const COMING_SOON: readonly { name: string; emoji: string }[] = [
  { name: 'Four in a Row', emoji: '🔴' },
  { name: 'Ludo', emoji: '🎲' },
  { name: 'Air Hockey', emoji: '🏒' },
  { name: 'Checkers', emoji: '⚫' },
  { name: 'Chess', emoji: '♟️' },
  { name: 'Solitaire', emoji: '🃏' },
];
