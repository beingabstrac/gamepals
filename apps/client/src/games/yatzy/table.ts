import type { YatzyBox } from '@gamepals/rules';
import { COLORS } from '../../theme';

export const YATZY_COLORS = [COLORS.tomato, COLORS.mint, COLORS.sunny, COLORS.sky];
export const YATZY_NAMES = ['Red', 'Green', 'Yellow', 'Blue'];
export const yatzyNames = (players: number): string[] => (players === 1 ? ['You'] : YATZY_NAMES.slice(0, players));
export const yatzyColors = (players: number): string[] => (players === 1 ? [COLORS.grape] : YATZY_COLORS.slice(0, players));

export const YATZY_LABELS: Record<YatzyBox, string> = {
  ones: 'Ones',
  twos: 'Twos',
  threes: 'Threes',
  fours: 'Fours',
  fives: 'Fives',
  sixes: 'Sixes',
  pair: 'One pair',
  twoPairs: 'Two pairs',
  three: 'Three of a kind',
  four: 'Four of a kind',
  smallStraight: 'Small straight',
  largeStraight: 'Large straight',
  fullHouse: 'Full house',
  chance: 'Chance',
  yatzy: 'Yatzy',
};

/**
 * Which dice the player is keeping. It lives outside the rules (a keep only counts when you roll),
 * and both the dice tray (canvas) and the Roll button (DOM) share it through this per-session table.
 */
export interface YatzyTable {
  keep: boolean[];
  readonly listeners: Set<() => void>;
}

const tables = new WeakMap<object, YatzyTable>();

export function tableFor(session: object): YatzyTable {
  let table = tables.get(session);
  if (!table) {
    table = { keep: [false, false, false, false, false], listeners: new Set() };
    tables.set(session, table);
  }
  return table;
}

export function setKeep(table: YatzyTable, keep: readonly boolean[]): void {
  table.keep = [...keep];
  for (const listener of table.listeners) listener();
}
