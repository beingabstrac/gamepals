/** Flat candy palette (docs/12). No gradients anywhere: depth comes from darker "lips" and soft shadows. */
export const COLORS = {
  tomato: '#FF6B6B',
  sunny: '#FFC93C',
  mint: '#3DDC97',
  sky: '#4DA8FF',
  grape: '#9B7BFF',
  peach: '#FF9F6B',
  bubblegum: '#FF8CC6',
  ink: '#2B2A3A',
  soft: '#7A7890',
  paper: '#FFFDF8',
  line: '#ECE8F5',
} as const;

/** Slightly darker shade of each candy color, for lips, inner rings and outlines. */
export const DARK = {
  tomato: '#E24E4E',
  sunny: '#E8A91A',
  mint: '#22B97A',
  sky: '#2E8AE6',
  grape: '#7B5BE3',
  peach: '#E9824C',
  bubblegum: '#E866A8',
} as const;

export const toHex = (css: string): number => Number.parseInt(css.replace('#', ''), 16);
