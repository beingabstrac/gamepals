/** Bright, flat candy palette. No gradients anywhere: depth comes from darker "lips" and soft shadows. */
export const COLORS = {
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

/** A darker shade of each color, for lips, inner rings and outlines. */
export const DARK = {
  tomato: '#D93636',
  sunny: '#E0A100',
  mint: '#0FA366',
  sky: '#1C6FE0',
  grape: '#5F33E0',
  peach: '#E06F12',
  bubblegum: '#D93388',
} as const;

export const toHex = (css: string): number => Number.parseInt(css.replace('#', ''), 16);
