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
 * The playroom palette: the same candy hues, warmed and enriched rather than muted. Brightness was
 * never the problem with the flat look, flatness was, so the colours stay cheerful and the depth
 * comes from gradients, highlights, lips and shadows. One edit re-tones forty-three scenes.
 */
const ROOM_PALETTE = {
  tomato: '#FF5B4A',
  sunny: '#FFC64B',
  mint: '#35C47F',
  sky: '#37A8F0',
  grape: '#8A63F0',
  peach: '#FF9A3C',
  bubblegum: '#FF5FA8',
  ink: '#4A3020',
  soft: '#9A7B5E',
  paper: '#FFF8E8',
  line: '#F2DFBC',
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
  tomato: '#D93A2C',
  sunny: '#E0952A',
  mint: '#1E9A5F',
  sky: '#1F80C4',
  grape: '#6941C8',
  peach: '#DE7420',
  bubblegum: '#DB3E86',
} as const;

export const DARK = ROOM ? ROOM_DARK : FLAT_DARK;

export const toHex = (css: string): number => Number.parseInt(css.replace('#', ''), 16);
