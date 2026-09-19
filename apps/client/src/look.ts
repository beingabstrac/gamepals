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
