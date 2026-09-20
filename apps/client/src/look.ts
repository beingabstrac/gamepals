/**
 * Which look the app is wearing. `?look=2` turns on the playroom: the same bright, warm colours
 * with real volume under them, the way a Playrix game is built (docs/12 Part 4). The first
 * attempt made everything dark walnut and felt, which is a card room, not a toy shelf.
 */
const search = typeof location === 'undefined' ? '' : location.search;
export const ROOM = new URLSearchParams(search).get('look') === '2';

if (typeof document !== 'undefined' && ROOM) document.documentElement.dataset.look = 'room';

/** The games room palette, for the Phaser scenes. Numbers, because that is what Phaser takes. */
export const ROOM_COLORS = {
  /** A table is sunlit baize: bright enough to be cheerful, green enough to be a table. */
  felt: 0x3fae74,
  feltDark: 0x2c8d5c,
  /** Wood is honey and maple, not walnut. */
  wood: 0xd79a4e,
  woodLight: 0xf0bd72,
  woodDark: 0xb0742f,
  brass: 0xffc64b,
  brassDark: 0xe0952a,
  cream: 0xfff6e2,
  creamDark: 0xf5e3bf,
  /** Chequered boards: warm maple and honey. */
  square: 0xfbe7c2,
  squareDark: 0xd39a5f,
  white: 0xfffdf6,
  black: 0x4a3526,
  ink: 0x4a3020,
  glow: 0xffd66b,
} as const;

export const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;

/** The table a card game is played on: green felt in the games room, its own colour otherwise. */
export const tableFill = (flat: number): number => (ROOM ? ROOM_COLORS.felt : flat);

/** An empty slot drawn on that table: a darker patch of felt in the games room. */
export const slotFill = (flat: number): number => (ROOM ? ROOM_COLORS.feltDark : flat);

/** Writing on the table: cream in the games room, where the felt is dark. */
export const tableInk = (flat: string): string => (ROOM ? '#fff6e2' : flat);

/** Switch looks and reload. The look is in the URL, so there is nothing stored to go stale. */
export function switchLook(): void {
  const url = new URL(location.href);
  if (ROOM) url.searchParams.delete('look');
  else url.searchParams.set('look', '2');
  location.href = url.toString();
}

/** The materials a board is made of in the games room, for the colours scenes hardcode. */
export const ROOM_TONES = {
  /** The dark square of a chequered board: honey wood. */
  woodSquare: 0xd39a5f,
  /** The light square, or any pale board face. */
  parchment: 0xfbe7c2,
  /** Lines ruled on a board. */
  line: 0xe6c894,
  /** A panel or card lying on the table. */
  panel: 0xfff8e8,
  water: 0x4fb3d9,
  waterLine: 0x2f8cb5,
} as const;

/** `tone(flat, room)`: the colour to use for this look. */
export const tone = (flat: number, room: number): number => (ROOM ? room : flat);
