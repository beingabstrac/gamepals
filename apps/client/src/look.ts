/**
 * Which look the app is wearing. `?look=2` turns on the games room: wood, felt and brass with
 * real depth, against the flat candy look that shipped first (docs/12 Part 4). Both are in the
 * build so they can be compared on the same phone, on the same URL, in the same minute.
 */
const search = typeof location === 'undefined' ? '' : location.search;
export const ROOM = new URLSearchParams(search).get('look') === '2';

if (typeof document !== 'undefined' && ROOM) document.documentElement.dataset.look = 'room';

/** The games room palette, for the Phaser scenes. Numbers, because that is what Phaser takes. */
export const ROOM_COLORS = {
  /** The table the board sits on. */
  felt: 0x1f5a43,
  feltDark: 0x14402f,
  /** The frame around it. */
  wood: 0x6b3f22,
  woodLight: 0x8a5a33,
  woodDark: 0x4a2a14,
  brass: 0xd8a94a,
  brassDark: 0x9c7526,
  cream: 0xf6ead2,
  creamDark: 0xe2cfa9,
  square: 0xecd9b0,
  squareDark: 0x9c6b41,
  white: 0xfbf3e2,
  black: 0x2a2520,
  ink: 0x241d16,
  glow: 0xffc86b,
} as const;

export const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;

/** The table a card game is played on: green felt in the games room, its own colour otherwise. */
export const tableFill = (flat: number): number => (ROOM ? ROOM_COLORS.felt : flat);

/** An empty slot drawn on that table: a darker patch of felt in the games room. */
export const slotFill = (flat: number): number => (ROOM ? ROOM_COLORS.feltDark : flat);

/** Writing on the table: cream in the games room, where the felt is dark. */
export const tableInk = (flat: string): string => (ROOM ? '#f3e3c4' : flat);

/** Switch looks and reload. The look is in the URL, so there is nothing stored to go stale. */
export function switchLook(): void {
  const url = new URL(location.href);
  if (ROOM) url.searchParams.delete('look');
  else url.searchParams.set('look', '2');
  location.href = url.toString();
}

/** The materials a board is made of in the games room, for the colours scenes hardcode. */
export const ROOM_TONES = {
  /** The dark square of a chequered board. */
  woodSquare: 0x9c6b41,
  /** The light square, or any pale board face. */
  parchment: 0xecd9b0,
  /** Lines ruled on a board. */
  line: 0xc6a878,
  /** A panel or card lying on the table: cream paper, not white. */
  panel: 0xf7ecd6,
  water: 0x2b6e7a,
  waterLine: 0x1d5560,
} as const;

/** `tone(flat, room)`: the colour to use for this look. */
export const tone = (flat: number, room: number): number => (ROOM ? room : flat);
