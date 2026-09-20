import { ROOM } from './look';

/** Bright, flat candy palette. No gradients anywhere: depth comes from darker "lips" and soft shadows. */
const FLAT = {
  tomato: '#FF4F4F',
  sunny: '#FFC21A',
  mint: '#16C47F',
  sky: '#2E8BFF',
  grape: '#7B4DFF',
  peach: '#FF8A2B',
  bubblegum: '#FF4DA6',
  ink: '#2B2A3A',
  soft: '#6F6D85',
  paper: '#FFFDF8',
  line: '#ECE8F5',
} as const;

/**
 * The same palette for the games room: the hues stay, so a red player is still red and a blue one
 * is still blue, but everything is deeper and warmer so it belongs on wood and felt. Changing it
 * here re-tones every board, every piece and every picture at once, which is why it lives in one
 * place rather than in forty-three scenes.
 */
const ROOM_PALETTE = {
  tomato: '#C13A38',
  sunny: '#DFA62C',
  mint: '#1E9A69',
  sky: '#3E72B8',
  grape: '#6B51B8',
  peach: '#CE7530',
  bubblegum: '#B8477C',
  ink: '#241D16',
  soft: '#7B6A55',
  paper: '#F6EAD2',
  line: '#D8C29A',
} as const;

export const COLORS = ROOM ? ROOM_PALETTE : FLAT;

const FLAT_DARK = {
  tomato: '#D93636',
  sunny: '#E0A100',
  mint: '#0FA366',
  sky: '#1C6FE0',
  grape: '#5F33E0',
  peach: '#E06F12',
  bubblegum: '#D93388',
} as const;

/** A darker shade of each color, for lips, inner rings and outlines. */
const ROOM_DARK = {
  tomato: '#8E2724',
  sunny: '#A87A18',
  mint: '#146F4C',
  sky: '#2B5288',
  grape: '#4C3888',
  peach: '#9A5520',
  bubblegum: '#8A3159',
} as const;

export const DARK = ROOM ? ROOM_DARK : FLAT_DARK;

export const toHex = (css: string): number => Number.parseInt(css.replace('#', ''), 16);
